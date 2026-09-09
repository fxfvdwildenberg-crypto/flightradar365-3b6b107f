import { createFileRoute } from "@tanstack/react-router";

/**
 * Read endpoint for external bots.
 *
 * GET /api/public/bot/data?resource=airports|flight_plans|atis
 * Header: x-bot-key: <BOT_API_KEY>
 *
 * Requires the shared bot key; uses privileged access only after the caller is
 * verified, and returns no user PII (user ids are stripped).
 */

const RESOURCES = ["airports", "flight_plans", "atis"] as const;
type Resource = (typeof RESOURCES)[number];

function timingSafeEqualStr(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export function authorizeBot(request: Request): Response | null {
  const expected = process.env["BOT_API_KEY"];
  if (!expected) return new Response("Bot API key not configured", { status: 503 });
  const provided =
    request.headers.get("x-bot-key") ??
    (request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "");
  if (!provided || !timingSafeEqualStr(provided, expected)) {
    return new Response("Unauthorized", { status: 401 });
  }
  return null;
}

export const Route = createFileRoute("/api/public/bot/data")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const denied = authorizeBot(request);
        if (denied) return denied;

        const url = new URL(request.url);
        const resource = (url.searchParams.get("resource") ?? "airports") as Resource;
        if (!RESOURCES.includes(resource)) {
          return Response.json({ error: `resource must be one of ${RESOURCES.join(", ")}` }, { status: 400 });
        }

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        if (resource === "airports") {
          const { data, error } = await supabaseAdmin
            .from("airports")
            .select("icao, iata, name, island, runway, elevation, major, x, y")
            .order("icao");
          if (error) return Response.json({ error: error.message }, { status: 500 });
          return Response.json({ resource, count: data?.length ?? 0, data });
        }

        if (resource === "atis") {
          const { data, error } = await supabaseAdmin
            .from("atis")
            .select(
              "id, airport_icao, letter, runway_in_use, approaches, wind, clouds, temperature, dew_point, qnh, altimeter, visibility, remarks, notices, active, updated_at",
            )
            .eq("active", true)
            .order("updated_at", { ascending: false });
          if (error) return Response.json({ error: error.message }, { status: 500 });
          return Response.json({ resource, count: data?.length ?? 0, data });
        }

        const { data, error } = await supabaseAdmin
          .from("flight_plans")
          .select(
            "id, callsign, airline, aircraft, aircraft_icao, flight_rules, dep_icao, arr_icao, alternate_icao, dep_time, arr_time, cruise_alt, cruise_speed, route, nav_mode, waypoints, squawk, status, atc_status, atc_note, remarks, created_at, updated_at",
          )
          .order("created_at", { ascending: false })
          .limit(200);
        if (error) return Response.json({ error: error.message }, { status: 500 });
        return Response.json({ resource, count: data?.length ?? 0, data });
      },
    },
  },
});
