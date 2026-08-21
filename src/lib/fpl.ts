/**
 * ICAO-style flight plan generation for ATC365.
 *
 * Pilots fill in a friendly form; controllers (and the Discord flight plan
 * channel) see the raw ICAO-style FPL message built from the same data.
 *
 * This is a simulation tool for PTFS — nothing here is filed with a real
 * aviation authority.
 */

import { aircraftInfo, type AircraftType } from "./aircraft";

export type FplInput = {
  callsign: string;
  flightRules: "IFR" | "VFR";
  /** ICAO flight type letter: S scheduled, N non-scheduled, G general, M military. */
  flightType: string;
  /** Friendly aircraft name, e.g. "Boeing 737-800". */
  aircraft: string;
  /** ICAO type designator, e.g. "B738". */
  aircraftIcao: string;
  registration: string;
  depIcao: string;
  arrIcao: string;
  /** ISO strings. */
  depTime: string;
  arrTime: string;
  /** Knots. */
  cruiseSpeed: number;
  /** Flight level, e.g. 360. */
  cruiseFl: number;
  route: string;
  alternateIcao: string;
  remarks: string;
};

/** Friendly aircraft names → ICAO type designator + wake category. */
const TYPE_TABLE: Record<string, { icao: string; wake: "L" | "M" | "H" | "J" }> = {
  "airbus a220-300": { icao: "BCS3", wake: "M" },
  "airbus a320": { icao: "A320", wake: "M" },
  "airbus a321neo": { icao: "A21N", wake: "M" },
  "boeing 737-800": { icao: "B738", wake: "M" },
  "boeing 737 max 8": { icao: "B38M", wake: "M" },
  "boeing 757-200": { icao: "B752", wake: "M" },
  "airbus a330-300": { icao: "A333", wake: "H" },
  "airbus a340-600": { icao: "A346", wake: "H" },
  "airbus a350-900": { icao: "A359", wake: "H" },
  "airbus a380-800": { icao: "A388", wake: "J" },
  "boeing 747-400": { icao: "B744", wake: "H" },
  "boeing 767-300": { icao: "B763", wake: "H" },
  "boeing 777-300er": { icao: "B77W", wake: "H" },
  "boeing 787-9": { icao: "B789", wake: "H" },
  "mcdonnell douglas md-11": { icao: "MD11", wake: "H" },
  "atr 72": { icao: "AT72", wake: "M" },
  "bombardier dash 8 q400": { icao: "DH8D", wake: "M" },
  "bombardier crj-700": { icao: "CRJ7", wake: "M" },
  "embraer e175": { icao: "E75L", wake: "M" },
  "airbus beluga xl": { icao: "A3ST", wake: "H" },
  "antonov an-124": { icao: "A124", wake: "H" },
  "antonov an-225 mriya": { icao: "A225", wake: "J" },
  "lockheed c-130 hercules": { icao: "C130", wake: "M" },
  "boeing c-17 globemaster iii": { icao: "C17", wake: "H" },
  "boeing kc-135 stratotanker": { icao: "K35R", wake: "H" },
  "boeing e-3 sentry": { icao: "E3TF", wake: "H" },
  "lockheed f-16 fighting falcon": { icao: "F16", wake: "M" },
  "lockheed f-22 raptor": { icao: "F22", wake: "M" },
  "boeing f/a-18 super hornet": { icao: "F18S", wake: "M" },
  "eurofighter typhoon": { icao: "EUFI", wake: "M" },
  "fairchild a-10 thunderbolt ii": { icao: "A10", wake: "M" },
  "northrop b-2 spirit": { icao: "B2", wake: "H" },
  "north american p-51 mustang": { icao: "P51", wake: "L" },
  "cessna 172 skyhawk": { icao: "C172", wake: "L" },
  "cessna 208 caravan": { icao: "C208", wake: "L" },
  "cirrus sf50 vision jet": { icao: "SF50", wake: "L" },
  "beechcraft king air": { icao: "BE20", wake: "L" },
  "pitts special": { icao: "PTS2", wake: "L" },
  "bell 412 rescue": { icao: "B412", wake: "L" },
  "sikorsky uh-60 black hawk": { icao: "H60", wake: "M" },
  concorde: { icao: "CONC", wake: "H" },
  "supermarine walrus": { icao: "WALR", wake: "L" },
  "airship / blimp": { icao: "SHIP", wake: "L" },
  "hot air balloon": { icao: "BALL", wake: "L" },
  "santa's sleigh": { icao: "SLGH", wake: "L" },
  glider: { icao: "GLID", wake: "L" },
};

/** Wake category from the aircraft's radar kind, used as a fallback. */
function wakeFromKind(info: AircraftType | null): "L" | "M" | "H" | "J" {
  switch (info?.kind) {
    case "widebody":
    case "cargo":
      return "H";
    case "an225":
      return "J";
    case "light":
    case "glider":
    case "balloon":
    case "blimp":
      return "L";
    default:
      return "M";
  }
}

export function typeDesignator(aircraft: string): { icao: string; wake: "L" | "M" | "H" | "J" } {
  const key = aircraft.trim().toLowerCase();
  const hit = TYPE_TABLE[key];
  if (hit) return hit;
  const info = aircraftInfo(aircraft);
  const viaInfo = info ? TYPE_TABLE[info.name.toLowerCase()] : undefined;
  if (viaInfo) return viaInfo;
  const fallback = aircraft.replace(/[^A-Za-z0-9]/g, "").toUpperCase().slice(0, 4) || "ZZZZ";
  return { icao: fallback, wake: wakeFromKind(info) };
}

const pad = (n: number, len = 2) => String(Math.max(0, Math.floor(n))).padStart(len, "0");

/** UTC HHMM for an ISO timestamp. */
export function utcHhmm(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "0000";
  return `${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}`;
}

/** Estimated enroute time as HHMM from departure/arrival timestamps. */
export function eetHhmm(depIso: string, arrIso: string): string {
  const mins = Math.max(0, Math.round((new Date(arrIso).getTime() - new Date(depIso).getTime()) / 60000));
  return `${pad(Math.floor(mins / 60))}${pad(mins % 60)}`;
}

/** 450 kt → "N0450". */
export function icaoSpeed(knots: number): string {
  return `N${pad(Math.round(knots), 4)}`;
}

/** FL360 → "F360". */
export function icaoLevel(fl: number): string {
  return `F${pad(Math.round(fl), 3)}`;
}

export function normaliseRoute(route: string): string {
  const clean = route.trim().replace(/\s+/g, " ").toUpperCase();
  return clean || "DCT";
}

export type FplIssue = { field: string; message: string };

const ICAO_RE = /^[A-Z]{4}$/;
const CALLSIGN_RE = /^[A-Z0-9]{2,8}$/;

export function validateFpl(input: FplInput): FplIssue[] {
  const issues: FplIssue[] = [];
  const cs = input.callsign.trim().toUpperCase();
  if (!cs) issues.push({ field: "Callsign", message: "Callsign is required" });
  else if (!CALLSIGN_RE.test(cs))
    issues.push({ field: "Callsign", message: "Use 2–8 letters/numbers, e.g. KLM123" });

  if (!ICAO_RE.test(input.depIcao.trim().toUpperCase()))
    issues.push({ field: "Departure", message: "Departure must be a 4-letter ICAO code" });
  if (!ICAO_RE.test(input.arrIcao.trim().toUpperCase()))
    issues.push({ field: "Arrival", message: "Arrival must be a 4-letter ICAO code" });
  if (input.depIcao.trim().toUpperCase() === input.arrIcao.trim().toUpperCase())
    issues.push({ field: "Arrival", message: "Departure and arrival must differ" });
  if (input.alternateIcao.trim() && !ICAO_RE.test(input.alternateIcao.trim().toUpperCase()))
    issues.push({ field: "Alternate", message: "Alternate must be a 4-letter ICAO code" });

  if (!input.aircraft.trim()) issues.push({ field: "Aircraft", message: "Aircraft type is required" });
  if (!(input.cruiseSpeed > 0)) issues.push({ field: "Speed", message: "Cruising speed must be above zero" });
  if (!(input.cruiseFl > 0)) issues.push({ field: "Altitude", message: "Cruising level must be above zero" });

  const dep = new Date(input.depTime).getTime();
  const arr = new Date(input.arrTime).getTime();
  if (Number.isNaN(dep)) issues.push({ field: "Departure time", message: "Pick a departure time" });
  if (Number.isNaN(arr)) issues.push({ field: "Arrival time", message: "Pick an estimated arrival time" });
  if (!Number.isNaN(dep) && !Number.isNaN(arr) && arr <= dep)
    issues.push({ field: "Arrival time", message: "Arrival must be after departure" });

  if (input.registration.trim() && !/^[A-Z0-9-]{2,10}$/.test(input.registration.trim().toUpperCase()))
    issues.push({ field: "Registration", message: "Registration may only contain letters, numbers and dashes" });

  return issues;
}

/**
 * Builds the ICAO-style FPL message, e.g.
 *
 * (FPL-KLM123-IS
 * -B738/M-SDFGIRWY/S
 * -EHAM1030
 * -N0450F360 ARNEM L980 REDFA
 * -EGLL0055 EGCC
 * -REG/PHABC)
 */
export function buildFpl(input: FplInput): string {
  const cs = input.callsign.trim().toUpperCase();
  const rules = input.flightRules === "VFR" ? "V" : "I";
  const type = (input.flightType || "S").trim().toUpperCase().slice(0, 1);
  const designator = input.aircraftIcao.trim().toUpperCase() || typeDesignator(input.aircraft).icao;
  const wake = typeDesignator(input.aircraft).wake;
  const dep = input.depIcao.trim().toUpperCase();
  const arr = input.arrIcao.trim().toUpperCase();
  const alt = input.alternateIcao.trim().toUpperCase();

  const other: string[] = [];
  if (input.remarks.trim()) other.push(input.remarks.trim().toUpperCase());
  if (input.registration.trim()) other.push(`REG/${input.registration.trim().toUpperCase()}`);

  const lines = [
    `(FPL-${cs}-${rules}${type}`,
    `-${designator}/${wake}-SDFGIRWY/S`,
    `-${dep}${utcHhmm(input.depTime)}`,
    `-${icaoSpeed(input.cruiseSpeed)}${icaoLevel(input.cruiseFl)} ${normaliseRoute(input.route)}`,
    `-${arr}${eetHhmm(input.depTime, input.arrTime)}${alt ? ` ${alt}` : ""}`,
  ];
  lines.push(other.length ? `-${other.join(" ")})` : ")");
  return lines.join("\n");
}
