import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type Airline = {
  name: string;
  icao: string | null;
  iata: string | null;
  logo_url: string | null;
};

/** Every livery available in the flight-plan picker. */
export function useAirlines() {
  return useQuery({
    queryKey: ["airlines"],
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.from("airlines").select("*").order("name");
      if (error) throw error;
      return (data ?? []) as Airline[];
    },
  });
}

/** Short badge text used when a livery has no logo image. */
export function airlineBadge(a: Pick<Airline, "name" | "iata" | "icao">): string {
  return (a.iata || a.icao || a.name.slice(0, 3)).toUpperCase();
}
