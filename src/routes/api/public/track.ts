import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

/**
 * Live aircraft tracking ingest endpoint.
 *
 * POST /api/public/track
 * Header: x-bot-key: <BOT_API_KEY>
 *
 * Body:
 *  {
 *    "aircraft": [
 *      { "callsign": "DLH123", "x": 123.4, "y": -56.7, "altitude": 32000,
 *        "ground_speed": 440, "heading": 270, "flight_plan_id": "<uuid?>" }
 *    ],
 *    "replace": true   // optional: remove live aircraft not present in this payload
 *  }
 *
 * Also accepts a bare array as the body. Positions older than 3 minutes are
 * pruned automatically on every accepted payload.
 *
 * GET /api/public/track  (no key required) returns the current live aircraft.
 */

function timingSafeEqualStr(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

function authorizeBot(request: Request): Response | null {
  const expected = (process.env["BOT_API_KEY"] ?? "").trim();
  if (!expected) return new Response("Bot API key not configured", { status: 503 });
  const provided = (
    request.headers.get("x-bot-key") ??
    request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ??
    ""
  ).trim();
  if (!provided || !timingSafeEqualStr(provided, expected)) {
    return new Response("Unauthorized", { status: 401 });
  }
  return null;
}

const aircraftSchema = z.object({
  callsign: z.string().trim().min(2).max(20).regex(/^[A-Za-z0-9-]+$/),
  x: z.number().finite(),
  y: z.number().finite(),
  altitude: z.number().int().min(-2000).max(80000).optional(),
  ground_speed: z.number().int().min(0).max(2000).optional(),
  heading: z.number().int().min(0).max(360).optional(),
  flight_plan_id: z.string().uuid().nullish(),
});

const bodySchema = z.union([
  z.array(aircraftSchema).min(0).max(500),
  z.object({
    aircraft: z.array(aircraftSchema).min(0).max(500),
    replace: z.boolean().optional(),
  }),
]);

export const Route = createFileRoute("/api/public/track")({
  server: {
    handlers: {
      GET: async () => {
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const cutoff = new Date(Date.now() - 3 * 60_000).toISOString();
        const { data, error } = await supabaseAdmin
          .from("live_aircraft")
          .select("callsign, x, y, altitude, ground_speed, heading, flight_plan_id, updated_at")
          .gte("updated_at", cutoff);
        if (error) return Response.json({ error: error.message }, { status: 500 });
        return Response.json({ count: data?.length ?? 0, data });
      },

      POST: async ({ request }) => {
        const denied = authorizeBot(request);
        if (denied) return denied;

        let json: unknown;
        try {
          json = await request.json();
        } catch {
          return Response.json({ error: "Invalid JSON body" }, { status: 400 });
        }

        const parsed = bodySchema.safeParse(json);
        if (!parsed.success) {
          return Response.json(
            { error: parsed.error.issues[0]?.message ?? "Invalid body" },
            { status: 400 },
          );
        }

        const { aircraft, replace } = Array.isArray(parsed.data)
          ? { aircraft: parsed.data, replace: false }
          : parsed.data;

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const now = new Date().toISOString();

        const rows = aircraft.map((a) => ({
          callsign: a.callsign.toUpperCase(),
          x: a.x,
          y: a.y,
          altitude: a.altitude ?? 0,
          ground_speed: a.ground_speed ?? 0,
          heading: a.heading ?? 0,
          flight_plan_id: a.flight_plan_id ?? null,
          updated_at: now,
        }));

        if (rows.length) {
          const { error } = await supabaseAdmin
            .from("live_aircraft")
            .upsert(rows, { onConflict: "callsign" });
          if (error) return Response.json({ error: error.message }, { status: 500 });
        }

        if (replace) {
          const keep = rows.map((r) => r.callsign);
          let query = supabaseAdmin.from("live_aircraft").delete();
          query = keep.length ? query.not("callsign", "in", `(${keep.join(",")})`) : query;
          const { error } = await query;
          if (error) return Response.json({ error: error.message }, { status: 500 });
        }

        // Prune aircraft that stopped reporting.
        const cutoff = new Date(Date.now() - 3 * 60_000).toISOString();
        await supabaseAdmin.from("live_aircraft").delete().lt("updated_at", cutoff);

        return Response.json({ ok: true, received: rows.length });
      },
    },
  },
});
