import { createFileRoute } from "@tanstack/react-router";

/**
 * Cron-triggered flight event fan-out.
 *
 * Recomputes the phase of every pinned flight server-side and pushes takeoff,
 * approach, landing and emergency alerts. Because this runs on a schedule and
 * not in the page, alerts still arrive when the app is closed.
 *
 * Call with `Authorization: Bearer <PUSH_CRON_SECRET>`.
 */
const MIN = 60_000;
const EMERGENCY_SQUAWKS: Record<string, string> = {
  "7500": "Hijack",
  "7600": "Radio failure",
  "7700": "General emergency",
};

type Phase = "scheduled" | "departing" | "enroute" | "arriving" | "arrived";

function phaseOf(depTime: string, arrTime: string, now: number): Phase {
  const dep = new Date(depTime).getTime();
  const arr = new Date(arrTime).getTime();
  const total = Math.max(arr - dep, MIN);
  const raw = (now - dep) / total;
  if (raw <= 0) return "scheduled";
  if (raw >= 1) return "arrived";
  if (raw < 0.12) return "departing";
  if (raw > 0.85) return "arriving";
  return "enroute";
}

function hm(iso: string): string {
  return new Date(iso).toISOString().slice(11, 16);
}

export const Route = createFileRoute("/api/public/push/flight-events")({
  server: {
    handlers: {
      POST: async ({ request }) => handle(request),
      GET: async ({ request }) => handle(request),
    },
  },
});

async function handle(request: Request): Promise<Response> {
  const secret = process.env["PUSH_CRON_SECRET"];
  const provided =
    request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ??
    request.headers.get("x-cron-secret") ??
    "";
  if (!secret || provided !== secret) {
    return new Response("Unauthorized", { status: 401 });
  }

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { sendPush } = await import("@/lib/push.server");

  const { data: subs, error } = await supabaseAdmin
    .from("push_subscriptions")
    .select("id, endpoint, p256dh, auth, flight_plan_id, last_phase, last_emergency")
    .not("flight_plan_id", "is", null);
  if (error) return new Response(error.message, { status: 500 });
  if (!subs || subs.length === 0) return Response.json({ checked: 0, sent: 0 });

  const planIds = Array.from(new Set(subs.map((s) => s.flight_plan_id!).filter(Boolean)));
  const { data: plans } = await supabaseAdmin
    .from("flight_plans")
    .select("id, callsign, dep_icao, arr_icao, dep_time, arr_time, squawk")
    .in("id", planIds);
  const byId = new Map((plans ?? []).map((p) => [p.id, p]));

  const now = Date.now();
  let sent = 0;

  for (const sub of subs) {
    const plan = byId.get(sub.flight_plan_id!);
    if (!plan) continue;

    const phase = phaseOf(plan.dep_time, plan.arr_time, now);
    const emergency = !!plan.squawk && plan.squawk in EMERGENCY_SQUAWKS;
    const messages: { title: string; body: string; tag: string }[] = [];

    if (emergency && !sub.last_emergency) {
      messages.push({
        title: `🚨 ${plan.callsign} — ${EMERGENCY_SQUAWKS[plan.squawk]}`,
        body: `${plan.dep_icao} → ${plan.arr_icao} · squawking emergency`,
        tag: `atc365-${plan.id}-emergency`,
      });
    }

    if (sub.last_phase && sub.last_phase !== phase) {
      if (phase === "departing")
        messages.push({
          title: `🛫 ${plan.callsign} has taken off`,
          body: `Departed ${plan.dep_icao} at ${hm(plan.dep_time)}Z`,
          tag: `atc365-${plan.id}-dep`,
        });
      if (phase === "arriving")
        messages.push({
          title: `🛬 ${plan.callsign} is on approach`,
          body: `Landing at ${plan.arr_icao} around ${hm(plan.arr_time)}Z`,
          tag: `atc365-${plan.id}-app`,
        });
      if (phase === "arrived")
        messages.push({
          title: `🛬 ${plan.callsign} has landed`,
          body: `Arrived at ${plan.arr_icao} at ${hm(plan.arr_time)}Z`,
          tag: `atc365-${plan.id}-arr`,
        });
    }

    let alive = true;
    for (const message of messages) {
      alive = await sendPush(sub, { ...message, url: "/" });
      if (!alive) break;
      sent += 1;
    }

    if (!alive) {
      await supabaseAdmin.from("push_subscriptions").delete().eq("id", sub.id);
      continue;
    }

    if (sub.last_phase !== phase || sub.last_emergency !== emergency) {
      await supabaseAdmin
        .from("push_subscriptions")
        .update({ last_phase: phase, last_emergency: emergency, updated_at: new Date().toISOString() })
        .eq("id", sub.id);
    }
  }

  return Response.json({ checked: subs.length, sent });
}