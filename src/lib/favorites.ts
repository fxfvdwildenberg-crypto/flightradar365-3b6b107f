import { useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/** Stable per-browser key so view counts work for signed-out visitors too. */
export function viewerKey(): string {
  if (typeof window === "undefined") return "ssr";
  let key = localStorage.getItem("atc365-viewer");
  if (!key) {
    key = Math.random().toString(36).slice(2) + Date.now().toString(36);
    localStorage.setItem("atc365-viewer", key);
  }
  return key;
}

export function useFavorites(userId: string | undefined) {
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: ["favorites", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("flight_favorites")
        .select("flight_plan_id")
        .eq("user_id", userId!);
      if (error) throw error;
      return new Set((data ?? []).map((r) => r.flight_plan_id as string));
    },
  });

  const toggle = useMutation({
    mutationFn: async (flightPlanId: string) => {
      if (!userId) throw new Error("Sign in to save favourites");
      if (query.data?.has(flightPlanId)) {
        const { error } = await supabase
          .from("flight_favorites")
          .delete()
          .eq("user_id", userId)
          .eq("flight_plan_id", flightPlanId);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("flight_favorites")
          .insert({ user_id: userId, flight_plan_id: flightPlanId });
        if (error) throw error;
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["favorites", userId] }),
  });

  return { favorites: query.data ?? new Set<string>(), toggleFavorite: toggle };
}

/** How many distinct people looked at each flight in the last 15 minutes. */
export function useFlightViewCounts() {
  return useQuery({
    queryKey: ["flight_views"],
    refetchInterval: 30_000,
    queryFn: async () => {
      const since = new Date(Date.now() - 15 * 60_000).toISOString();
      const { data, error } = await supabase
        .from("flight_views")
        .select("flight_plan_id")
        .gte("seen_at", since);
      if (error) throw error;
      const counts = new Map<string, number>();
      for (const row of (data ?? []) as { flight_plan_id: string }[]) {
        counts.set(row.flight_plan_id, (counts.get(row.flight_plan_id) ?? 0) + 1);
      }
      return counts;
    },
  });
}

/** Records that this browser is currently watching a flight. */
export function useRecordView(flightPlanId: string | null) {
  const qc = useQueryClient();
  useEffect(() => {
    if (!flightPlanId) return;
    let cancelled = false;
    void (async () => {
      await supabase
        .from("flight_views")
        .upsert(
          { flight_plan_id: flightPlanId, viewer_key: viewerKey(), seen_at: new Date().toISOString() },
          { onConflict: "flight_plan_id,viewer_key" },
        );
      if (!cancelled) qc.invalidateQueries({ queryKey: ["flight_views"] });
    })();
    return () => {
      cancelled = true;
    };
  }, [flightPlanId, qc]);
}
