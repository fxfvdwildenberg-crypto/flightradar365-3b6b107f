import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type AtcPosition = "ground" | "tower" | "center";

export const POSITIONS: { key: AtcPosition; short: string; label: string }[] = [
  { key: "ground", short: "G", label: "Ground" },
  { key: "tower", short: "T", label: "Tower" },
  { key: "center", short: "C", label: "Center" },
];

export type AtcSession = {
  id: string;
  user_id: string;
  airport_icao: string;
  position: AtcPosition;
  roblox_username: string | null;
  discord_username: string | null;
  online: boolean;
  started_at: string;
};

export type Atis = {
  id: string;
  airport_icao: string;
  letter: string;
  runway_in_use: string | null;
  wind: string | null;
  visibility: string | null;
  clouds: string | null;
  temperature: string | null;
  dew_point: string | null;
  qnh: string | null;
  altimeter: string | null;
  approaches: string | null;
  notices: string | null;
  remarks: string | null;
  spoken_text: string | null;
  updated_at: string;
};


/** Every online controller, keyed by airport ICAO. */
export function useAtcSessions() {
  return useQuery({
    queryKey: ["atc_sessions"],
    refetchInterval: 20_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("atc_sessions")
        .select("*")
        .eq("online", true);
      if (error) throw error;
      const map = new Map<string, AtcSession[]>();
      for (const s of (data ?? []) as AtcSession[]) {
        const list = map.get(s.airport_icao) ?? [];
        list.push(s);
        map.set(s.airport_icao, list);
      }
      return map;
    },
  });
}

/** Active ATIS for every airport, keyed by ICAO. */
export function useAtisMap() {
  return useQuery({
    queryKey: ["atis"],
    refetchInterval: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("atis")
        .select("*")
        .eq("active", true)
        .order("updated_at", { ascending: false });
      if (error) throw error;
      const map = new Map<string, Atis>();
      for (const a of (data ?? []) as Atis[]) {
        if (!map.has(a.airport_icao)) map.set(a.airport_icao, a);
      }
      return map;
    },
  });
}

export type AircraftImage = {
  aircraft: string;
  /** null = the global image used for every livery of this aircraft. */
  airline: string | null;
  image_url: string;
};

const imageKey = (aircraft: string, airline: string | null) =>
  `${aircraft.trim().toUpperCase()}|${(airline ?? "").trim().toUpperCase()}`;

/**
 * Aircraft photos, either global for the type or specific to one livery.
 * Lookup prefers the airline-specific picture and falls back to the global one.
 */
export function useAircraftImages() {
  return useQuery({
    queryKey: ["aircraft_images"],
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.from("aircraft_images").select("*");
      if (error) throw error;
      const rows = (data ?? []) as AircraftImage[];
      const map = new Map<string, string>();
      for (const row of rows) map.set(imageKey(row.aircraft, row.airline), row.image_url);
      return { rows, map };
    },
  });
}

export function pickAircraftImage(
  images: Map<string, string> | undefined,
  aircraft: string,
  airline: string | null,
): string | null {
  if (!images) return null;
  return (
    (airline ? images.get(imageKey(aircraft, airline)) : undefined) ??
    images.get(imageKey(aircraft, null)) ??
    null
  );
}


function zulu(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}`;
}

/**
 * The standard ATIS broadcast, exactly as pilots expect to read or hear it.
 *
 * [Airport] ATIS [Letter] / Information [LETTER], [TIME] ZULU / weather /
 * runways and approaches in use / notices / advisory line.
 */
export function atisReport(atis: Atis, airportName: string): string {
  const L = atis.letter.toUpperCase();
  const weather = [
    atis.wind ? `Wind ${atis.wind} knots.` : "Wind calm.",
    atis.visibility ? `Visibility ${atis.visibility}.` : "",
    atis.clouds ? `${atis.clouds}.` : "",
    atis.temperature
      ? `Temperature ${atis.temperature}${atis.dew_point ? `, dew point ${atis.dew_point}` : ""}.`
      : "",
    atis.altimeter || atis.qnh ? `Altimeter ${atis.altimeter || atis.qnh}.` : "",
  ].filter(Boolean);

  const ops = [
    atis.runway_in_use ? `Runway(s) in use: ${atis.runway_in_use}.` : "",
    atis.approaches ? `Approaches in use: ${atis.approaches}.` : "",
  ].filter(Boolean);

  const extra = [atis.notices, atis.remarks].filter((v) => v && v.trim()).join(" ");

  return [
    `${airportName} ATIS ${L}`,
    "",
    `Information ${L}, ${zulu(atis.updated_at)} ZULU.`,
    "",
    `${airportName} weather:`,
    ...weather,
    ...(ops.length ? ["", ...ops] : []),
    ...(extra ? ["", extra] : []),
    "",
    `Pilots are advised to have Information ${L} on initial contact.`,
  ].join("\n");
}

/** Human-readable broadcast text used for the ATIS text-to-speech playback. */
export function atisSpokenText(atis: Atis, airportName: string): string {
  if (atis.spoken_text?.trim()) return atis.spoken_text;
  return atisReport(atis, airportName).replace(/\n+/g, " ");
}


/** Speaks the ATIS through the browser speech engine. Returns false if unsupported. */
export function speakAtis(text: string): boolean {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return false;
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.rate = 0.95;
  utterance.pitch = 0.9;
  window.speechSynthesis.speak(utterance);
  return true;
}

export function stopAtisSpeech(): void {
  if (typeof window !== "undefined" && "speechSynthesis" in window) window.speechSynthesis.cancel();
}
