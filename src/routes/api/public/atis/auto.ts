import { createFileRoute } from "@tanstack/react-router";

/**
 * Automatic ATIS generator.
 *
 * Every airport that has not had a new ATIS filed in the past 6 hours gets one
 * generated from its current weather. Automatic broadcasts always read
 * "ALL RUNWAYS" for both departures and arrivals. Runs on a schedule (hourly).
 *
 * Call with `apikey: <publishable key>` or `Authorization: Bearer <PUSH_CRON_SECRET>`.
 */

const SIX_HOURS = 6 * 60 * 60 * 1000;
const LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

export const Route = createFileRoute("/api/public/atis/auto")({
  server: {
    handlers: {
      POST: async ({ request }) => handle(request),
      GET: async ({ request }) => handle(request),
    },
  },
});

async function handle(request: Request): Promise<Response> {
  const apikey = request.headers.get("apikey") ?? "";
  const bearer = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
  const publishable = process.env["SUPABASE_PUBLISHABLE_KEY"] ?? "";
  const cronSecret = process.env["PUSH_CRON_SECRET"] ?? "";
  const authorized =
    (publishable && (apikey === publishable || bearer === publishable)) ||
    (cronSecret && bearer === cronSecret);
  if (!authorized) return new Response("Unauthorized", { status: 401 });

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { airportWeather } = await import("@/lib/weather");
  const { postAtisMessage } = await import("@/lib/discord.server");

  const { data: airports, error } = await supabaseAdmin
    .from("airports")
    .select("icao")
    .order("icao");
  if (error) return new Response(error.message, { status: 500 });

  const { data: existing } = await supabaseAdmin
    .from("atis")
    .select("airport_icao, letter, updated_at")
    .order("updated_at", { ascending: false });

  const latest = new Map<string, { letter: string; updated_at: string }>();
  for (const row of existing ?? []) {
    if (!latest.has(row.airport_icao)) latest.set(row.airport_icao, row);
  }

  const now = Date.now();
  const created: string[] = [];

  for (const ap of airports ?? []) {
    const last = latest.get(ap.icao);
    if (last && now - new Date(last.updated_at).getTime() < SIX_HOURS) continue;

    const prev = last ? LETTERS.indexOf(last.letter.toUpperCase().charAt(0)) : -1;
    const letter = LETTERS.charAt((prev + 1 + LETTERS.length) % LETTERS.length);

    const wx = airportWeather(ap.icao, now);
    const runways = "ALL RUNWAYS";

    await supabaseAdmin.from("atis").update({ active: false }).eq("airport_icao", ap.icao).eq("active", true);

    const row = {
      airport_icao: ap.icao,
      letter,
      runway_in_use: runways,
      approaches: runways,
      wind: `${String(wx.windDir).padStart(3, "0")}/${String(wx.windSpeed).padStart(2, "0")}KT`,
      visibility: wx.visibility >= 9999 ? "10KM" : `${wx.visibility}M`,
      clouds: wx.cloudCode,
      temperature: String(wx.temperature),
      dew_point: String(wx.dewPoint),
      qnh: String(wx.qnh),
      remarks: "Automatically generated ATIS.",
      active: true,
    };

    const { error: insertError } = await supabaseAdmin.from("atis").insert(row);
    if (insertError) {
      console.error("[atis-auto] insert failed", ap.icao, insertError.message);
      continue;
    }
    created.push(ap.icao);
    try {
      await postAtisMessage({ ...row, updated_at: new Date().toISOString() });
    } catch (e) {
      console.error("[atis-auto] discord relay failed", ap.icao, e);
    }
  }

  return Response.json({ checked: airports?.length ?? 0, created });
}
