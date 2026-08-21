/**
 * ATC365 ATIS wording.
 *
 * One canonical spoken/written broadcast format used by the website, the
 * Discord relay and the automatic hourly generator:
 *
 * {ICAO} Information {phonetic}. Time {zulu} Zulu. Departure runway {rwys}.
 * Arrival runway {rwys}. Wind {deg} degrees at {kt} knots. {Broken/no/a lot of}
 * clouds. Temperature {c} degrees, dew point {c} degrees. QNH {qnh}.
 * Advise on initial contact you have Information {LETTER}.
 */

export const NATO: Record<string, string> = {
  A: "Alpha", B: "Bravo", C: "Charlie", D: "Delta", E: "Echo", F: "Foxtrot",
  G: "Golf", H: "Hotel", I: "India", J: "Juliett", K: "Kilo", L: "Lima",
  M: "Mike", N: "November", O: "Oscar", P: "Papa", Q: "Quebec", R: "Romeo",
  S: "Sierra", T: "Tango", U: "Uniform", V: "Victor", W: "Whiskey",
  X: "X-ray", Y: "Yankee", Z: "Zulu",
};

export function phonetic(letter: string): string {
  const L = (letter || "A").trim().toUpperCase().charAt(0);
  return NATO[L] ?? L;
}

/** Both runway designators for a runway heading, e.g. 80 -> "08/26". */
export function runwayNames(heading: number): string {
  const n = (deg: number) => {
    const d = ((Math.round(deg / 10) * 10) % 360 + 360) % 360;
    const num = d === 0 ? 36 : d / 10;
    return String(num).padStart(2, "0");
  };
  return `${n(heading)}/${n(heading + 180)}`;
}

export function zuluTime(iso: string | number | Date): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}`;
}

/** Turns "250/12KT", "250 12", "25012KT" into degrees + knots. */
export function parseWind(wind: string | null | undefined): { dir: number | null; kt: number | null } {
  if (!wind) return { dir: null, kt: null };
  const w = wind.trim().toUpperCase();
  let m = w.match(/(\d{1,3})\s*[/@ ]\s*(\d{1,3})/);
  if (!m) m = w.match(/^(\d{3})(\d{2})/);
  if (!m) return { dir: null, kt: null };
  return { dir: Number(m[1]), kt: Number(m[2]) };
}

/** "Broken", "no" or "a lot of" clouds, from a cloud code or plain words. */
export function cloudWording(clouds: string | null | undefined): string {
  const c = (clouds ?? "").trim().toUpperCase();
  if (!c || c.includes("CAVOK") || c.includes("SKC") || c.includes("NSC") || c.includes("CLEAR")) return "no";
  if (c.includes("OVC") || c.includes("OVERCAST")) return "a lot of";
  if (c.includes("FEW")) return "no";
  return "broken";
}

const num = (v: string | null | undefined): number | null => {
  if (!v) return null;
  const m = v.trim().match(/-?\d+/);
  return m ? Number(m[0]) : null;
};

export type AtisTextInput = {
  airport_icao: string;
  letter: string;
  runway_in_use: string | null;
  /** Arrival runways; stored in the ATIS `approaches` column. */
  approaches?: string | null;
  wind: string | null;
  clouds: string | null;
  /** "18" or "18/12". */
  temperature: string | null;
  dew_point?: string | null;
  qnh: string | null;
  altimeter?: string | null;
  updated_at?: string;
};

export function atisText(atis: AtisTextInput, at?: string | number | Date): string {
  const icao = atis.airport_icao.toUpperCase();
  const L = (atis.letter || "A").toUpperCase().charAt(0);
  const dep = (atis.runway_in_use ?? "").trim();
  const arr = (atis.approaches ?? "").trim() || dep;
  const { dir, kt } = parseWind(atis.wind);

  const tempRaw = (atis.temperature ?? "").trim();
  const parts = tempRaw.split("/");
  const temp = num(parts[0] ?? null);
  const dew = num(atis.dew_point ?? parts[1] ?? null);
  const qnh = (atis.qnh || atis.altimeter || "").trim();

  const out = [`${icao} Information ${phonetic(L)}.`, `Time ${zuluTime(at ?? atis.updated_at ?? Date.now())} Zulu.`];
  if (dep) out.push(`Departure runway ${dep}.`);
  if (arr) out.push(`Arrival runway ${arr}.`);
  out.push(
    dir !== null && kt !== null
      ? `Wind ${dir} degrees at ${kt} knots.`
      : "Wind calm.",
  );
  out.push(`${cloudWording(atis.clouds)} clouds.`);
  if (temp !== null) {
    out.push(dew !== null ? `Temperature ${temp} degrees, dew point ${dew} degrees.` : `Temperature ${temp} degrees.`);
  }
  if (qnh) out.push(`QNH ${qnh}.`);
  out.push(`Advise on initial contact you have Information ${L}.`);

  const text = out.join(" ");
  return text.charAt(0).toUpperCase() + text.slice(1);
}
