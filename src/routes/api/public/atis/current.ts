import { createFileRoute } from "@tanstack/react-router";

/**
 * Live ATIS feed for the Discord voice bot.
 *
 * Returns one entry per airport that currently exists on the website, in ICAO
 * order, with the newest active ATIS rendered in the standard ATC365 wording.
 * Airports without an ATIS are skipped; deleted airports disappear from the
 * feed automatically, so the bot always cycles the current airport list.
 *
 * Public read-only endpoint — no secrets, no PII.
 */
export const Route = createFileRoute("/api/public/atis/current")({
  server: {
    handlers: {
      GET: async () => {
        const { createClient } = await import("@supabase/supabase-js");
        const { atisText } = await import("@/lib/atis-format");

        const url = process.env["SUPABASE_URL"] ?? "";
        const key = process.env["SUPABASE_PUBLISHABLE_KEY"] ?? "";
        if (!url || !key) return new Response("Backend not configured", { status: 500 });

        const supabase = createClient(url, key, {
          auth: { persistSession: false, autoRefreshToken: false },
          global: {
            fetch: (input: RequestInfo | URL, init?: RequestInit) => {
              const h = new Headers(init?.headers);
              if (key.startsWith("sb_") && h.get("Authorization") === `Bearer ${key}`) {
                h.delete("Authorization");
              }
              h.set("apikey", key);
              return fetch(input, { ...init, headers: h });
            },
          },
        });

        const [airportsRes, atisRes] = await Promise.all([
          supabase.from("airports").select("icao, name").order("icao"),
          supabase
            .from("atis")
            .select(
              "airport_icao, letter, runway_in_use, approaches, wind, clouds, temperature, dew_point, qnh, altimeter, remarks, updated_at, active",
            )
            .eq("active", true)
            .order("updated_at", { ascending: false }),
        ]);

        if (airportsRes.error) return new Response(airportsRes.error.message, { status: 500 });
        if (atisRes.error) return new Response(atisRes.error.message, { status: 500 });

        const latest = new Map<string, (typeof atisRes.data)[number]>();
        for (const row of atisRes.data ?? []) {
          if (!latest.has(row.airport_icao)) latest.set(row.airport_icao, row);
        }

        const broadcasts = (airportsRes.data ?? []).flatMap((ap) => {
          const atis = latest.get(ap.icao);
          if (!atis) return [];
          return [
            {
              icao: ap.icao,
              name: ap.name,
              letter: (atis.letter ?? "A").toUpperCase().charAt(0),
              updated_at: atis.updated_at,
              text: atisText({
                airport_icao: ap.icao,
                letter: atis.letter ?? "A",
                runway_in_use: atis.runway_in_use,
                approaches: atis.approaches,
                wind: atis.wind,
                clouds: atis.clouds,
                temperature: atis.temperature,
                dew_point: atis.dew_point,
                qnh: atis.qnh ?? atis.altimeter,
                updated_at: atis.updated_at,
              }),
            },
          ];
        });

        return Response.json(
          { generated_at: new Date().toISOString(), count: broadcasts.length, broadcasts },
          { headers: { "cache-control": "public, max-age=30" } },
        );
      },
    },
  },
});
