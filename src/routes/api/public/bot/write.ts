import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

/**
 * Write endpoint for external bots.
 *
 * POST /api/public/bot/write
 * Header: x-bot-key: <BOT_API_KEY>
 *
 * Body (one of):
 *  { "action": "publish_atis", "atis": { airport_icao, letter, wind, clouds, temperature, dew_point, qnh, runway_in_use, approaches, remarks } }
 *  { "action": "update_flight_plan", "id": "<uuid>", "patch": { status?, atc_status?, squawk?, atc_note?, route?, nav_mode? } }
 *  { "action": "delete_flight_plan", "id": "<uuid>" }
 */

function timingSafeEqualStr(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

function authorizeBot(request: Request): Response | null {
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

const icao = z.string().trim().min(3).max(6).regex(/^[A-Za-z0-9]+$/);
const short = z.string().trim().max(120);

const bodySchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("publish_atis"),
    atis: z.object({
      airport_icao: icao,
      letter: z.string().trim().length(1).optional(),
      runway_in_use: short.optional(),
      approaches: short.optional(),
      wind: short.optional(),
      clouds: short.optional(),
      temperature: short.optional(),
      dew_point: short.optional(),
      qnh: short.optional(),
      visibility: short.optional(),
      remarks: z.string().trim().max(500).optional(),
    }),
  }),
  z.object({
    action: z.literal("update_flight_plan"),
    id: z.string().uuid(),
    patch: z
      .object({
        status: z.enum(["pending", "approved", "active", "landed", "cancelled"]).optional(),
        atc_status: z.string().trim().max(40).optional(),
        atc_note: z.string().trim().max(500).optional(),
        squawk: z.string().trim().regex(/^[0-7]{4}$/).optional(),
        route: z.string().trim().max(2000).optional(),
        nav_mode: z.enum(["radar_vectors", "waypoints"]).optional(),
      })
      .refine((p) => Object.keys(p).length > 0, { message: "patch must not be empty" }),
  }),
  z.object({ action: z.literal("delete_flight_plan"), id: z.string().uuid() }),
]);

export const Route = createFileRoute("/api/public/bot/write")({
  server: {
    handlers: {
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
          return Response.json({ error: parsed.error.issues[0]?.message ?? "Invalid body" }, { status: 400 });
        }

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const body = parsed.data;

        if (body.action === "publish_atis") {
          const a = body.atis;
          const airportIcao = a.airport_icao.toUpperCase();

          const { data: airport, error: airportError } = await supabaseAdmin
            .from("airports")
            .select("icao")
            .eq("icao", airportIcao)
            .maybeSingle();
          if (airportError) return Response.json({ error: airportError.message }, { status: 500 });
          if (!airport) return Response.json({ error: `Unknown airport ${airportIcao}` }, { status: 404 });

          await supabaseAdmin
            .from("atis")
            .update({ active: false })
            .eq("airport_icao", airportIcao)
            .eq("active", true);

          const { data, error } = await supabaseAdmin
            .from("atis")
            .insert({
              airport_icao: airportIcao,
              letter: (a.letter ?? "A").toUpperCase(),
              runway_in_use: a.runway_in_use ?? "ALL RUNWAYS",
              approaches: a.approaches ?? null,
              wind: a.wind ?? null,
              clouds: a.clouds ?? null,
              temperature: a.temperature ?? null,
              dew_point: a.dew_point ?? null,
              qnh: a.qnh ?? null,
              visibility: a.visibility ?? null,
              remarks: a.remarks ?? null,
              active: true,
            })
            .select("id, airport_icao, letter, updated_at")
            .single();
          if (error) return Response.json({ error: error.message }, { status: 500 });
          return Response.json({ ok: true, atis: data });
        }

        if (body.action === "update_flight_plan") {
          const { data, error } = await supabaseAdmin
            .from("flight_plans")
            .update({ ...body.patch, updated_at: new Date().toISOString() })
            .eq("id", body.id)
            .select("id, callsign, status, atc_status, squawk")
            .maybeSingle();
          if (error) return Response.json({ error: error.message }, { status: 500 });
          if (!data) return Response.json({ error: "Flight plan not found" }, { status: 404 });
          return Response.json({ ok: true, flight_plan: data });
        }

        const { error } = await supabaseAdmin.from("flight_plans").delete().eq("id", body.id);
        if (error) return Response.json({ error: error.message }, { status: 500 });
        return Response.json({ ok: true, deleted: body.id });
      },
    },
  },
});
