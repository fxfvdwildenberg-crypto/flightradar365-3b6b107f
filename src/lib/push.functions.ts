import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const subscriptionSchema = z.object({
  endpoint: z.string().url(),
  p256dh: z.string().min(1),
  auth: z.string().min(1),
  flightPlanId: z.string().uuid().nullable().optional(),
});

const endpointSchema = z.object({ endpoint: z.string().url() });

/** Public: the browser needs the VAPID public key to subscribe. */
export const getPushPublicKey = createServerFn({ method: "GET" }).handler(async () => {
  const { getVapidPublicKey } = await import("./push.server");
  return { publicKey: getVapidPublicKey() };
});

/** Store (or refresh) a push subscription and the flight it is watching. */
export const savePushSubscription = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => subscriptionSchema.parse(input))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("push_subscriptions").upsert(
      {
        endpoint: data.endpoint,
        p256dh: data.p256dh,
        auth: data.auth,
        flight_plan_id: data.flightPlanId ?? null,
        last_phase: null,
        last_emergency: false,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "endpoint" },
    );
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Stop watching: drop the subscription row for this browser. */
export const deletePushSubscription = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => endpointSchema.parse(input))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("push_subscriptions")
      .delete()
      .eq("endpoint", data.endpoint);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Fire a single test notification at the calling browser. */
export const sendTestPush = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => endpointSchema.parse(input))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row, error } = await supabaseAdmin
      .from("push_subscriptions")
      .select("endpoint, p256dh, auth")
      .eq("endpoint", data.endpoint)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!row) throw new Error("This browser is not subscribed to alerts");

    const { sendPush } = await import("./push.server");
    const alive = await sendPush(row, {
      title: "ATC365 alerts are on",
      body: "You'll get takeoff, approach, landing and emergency alerts for pinned flights.",
      tag: "atc365-test",
      url: "/",
    });
    if (!alive) {
      await supabaseAdmin.from("push_subscriptions").delete().eq("endpoint", data.endpoint);
      throw new Error("This browser's push subscription expired — re-pin the flight");
    }
    return { ok: true };
  });