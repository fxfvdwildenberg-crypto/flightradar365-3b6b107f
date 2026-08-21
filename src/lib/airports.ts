import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { setAirports, type Airport } from "@/lib/world";

export type AirportRow = {
  icao: string;
  iata: string | null;
  name: string;
  island: string;
  x: number;
  y: number;
  runway: number;
  elevation: number;
  major: boolean;
  info: string | null;
  image_url: string | null;
};

export const rowToAirport = (r: AirportRow): Airport => ({
  ...(r.iata ? { iata: r.iata } : {}),
  icao: r.icao,
  name: r.name,

  island: r.island,
  x: r.x,
  y: r.y,
  runway: r.runway,
  elevation: r.elevation,
  major: r.major,
  info: r.info,
  image_url: r.image_url,
});

/** Loads admin-managed airports and syncs them into the world registry. */
export function useAirportRegistry() {
  return useQuery({
    queryKey: ["airports"],
    staleTime: 30_000,
    queryFn: async () => {
      const { data, error } = await supabase.from("airports").select("*").order("icao");
      if (error) throw error;
      const rows = (data ?? []) as AirportRow[];
      if (rows.length) setAirports(rows.map(rowToAirport));
      return rows;
    },
  });
}
