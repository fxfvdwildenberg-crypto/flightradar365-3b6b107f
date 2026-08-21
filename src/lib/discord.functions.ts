import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { postFlightPlanMessage, postAtisMessage } from "./discord.server";

/** Posts a filed flight plan (ICAO format) to the ATC365 flight plans channel. */
export const announceFlightPlan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { flightPlanId: string }) => input)
  .handler(async ({ data, context }) => {
    const { data: plan, error } = await context.supabase
      .from("flight_plans")
      .select("*")
      .eq("id", data.flightPlanId)
      .maybeSingle();
    if (error || !plan) return { ok: false, reason: "not-found" as const };
    return postFlightPlanMessage(plan);
  });

/** Posts a newly published ATIS to the ATC365 ATIS channel. */
export const announceAtis = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { atisId: string }) => input)
  .handler(async ({ data, context }) => {
    const { data: atis, error } = await context.supabase
      .from("atis")
      .select("*")
      .eq("id", data.atisId)
      .maybeSingle();
    if (error || !atis) return { ok: false, reason: "not-found" as const };
    return postAtisMessage(atis);
  });
