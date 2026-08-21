/**
 * PTFS aircraft catalogue.
 *
 * Every aircraft maps to an icon "kind"; the radar draws a different silhouette
 * per kind (military jets, light aircraft, the An-225, the Walrus, Concorde,
 * the blimp, Santa's sleigh, the hot air balloon, helicopters…).
 * Source list: https://roblox-ptfs.fandom.com/wiki/Category:Planes
 */

export type IconKind =
  | "airliner"
  | "widebody"
  | "regional"
  | "cargo"
  | "military"
  | "fighter"
  | "light"
  | "helicopter"
  | "an225"
  | "walrus"
  | "concorde"
  | "blimp"
  | "sleigh"
  | "balloon"
  | "glider";

export type AircraftType = {
  name: string;
  kind: IconKind;
  /** Typical cruise in knots — prefills the flight plan. */
  speed: number;
  /** Typical cruise flight level. */
  fl: number;
};

export const AIRCRAFT_TYPES: AircraftType[] = [
  // Narrowbody
  { name: "Airbus A220-300", kind: "airliner", speed: 450, fl: 350 },
  { name: "Airbus A320", kind: "airliner", speed: 450, fl: 350 },
  { name: "Airbus A321neo", kind: "airliner", speed: 455, fl: 360 },
  { name: "Boeing 737-800", kind: "airliner", speed: 450, fl: 350 },
  { name: "Boeing 737 MAX 8", kind: "airliner", speed: 455, fl: 370 },
  { name: "Boeing 757-200", kind: "airliner", speed: 460, fl: 370 },
  // Widebody
  { name: "Airbus A330-300", kind: "widebody", speed: 470, fl: 380 },
  { name: "Airbus A340-600", kind: "widebody", speed: 475, fl: 380 },
  { name: "Airbus A350-900", kind: "widebody", speed: 480, fl: 390 },
  { name: "Airbus A380-800", kind: "widebody", speed: 490, fl: 390 },
  { name: "Boeing 747-400", kind: "widebody", speed: 490, fl: 380 },
  { name: "Boeing 767-300", kind: "widebody", speed: 470, fl: 370 },
  { name: "Boeing 777-300ER", kind: "widebody", speed: 490, fl: 380 },
  { name: "Boeing 787-9", kind: "widebody", speed: 485, fl: 400 },
  { name: "McDonnell Douglas MD-11", kind: "widebody", speed: 480, fl: 370 },
  // Regional
  { name: "ATR 72", kind: "regional", speed: 275, fl: 220 },
  { name: "Bombardier Dash 8 Q400", kind: "regional", speed: 300, fl: 250 },
  { name: "Bombardier CRJ-700", kind: "regional", speed: 420, fl: 330 },
  { name: "Embraer E175", kind: "regional", speed: 430, fl: 340 },
  // Cargo / special heavy
  { name: "Airbus Beluga XL", kind: "cargo", speed: 440, fl: 330 },
  { name: "Antonov An-124", kind: "cargo", speed: 460, fl: 350 },
  { name: "Antonov An-225 Mriya", kind: "an225", speed: 430, fl: 330 },
  // Military
  { name: "Lockheed C-130 Hercules", kind: "military", speed: 290, fl: 220 },
  { name: "Boeing C-17 Globemaster III", kind: "military", speed: 450, fl: 330 },
  { name: "Boeing KC-135 Stratotanker", kind: "military", speed: 460, fl: 350 },
  { name: "Boeing E-3 Sentry", kind: "military", speed: 430, fl: 300 },
  { name: "Lockheed F-16 Fighting Falcon", kind: "fighter", speed: 520, fl: 400 },
  { name: "Lockheed F-22 Raptor", kind: "fighter", speed: 550, fl: 450 },
  { name: "Boeing F/A-18 Super Hornet", kind: "fighter", speed: 530, fl: 400 },
  { name: "Eurofighter Typhoon", kind: "fighter", speed: 540, fl: 430 },
  { name: "Fairchild A-10 Thunderbolt II", kind: "fighter", speed: 300, fl: 250 },
  { name: "Northrop B-2 Spirit", kind: "military", speed: 480, fl: 400 },
  { name: "North American P-51 Mustang", kind: "fighter", speed: 300, fl: 200 },
  // Light / GA
  { name: "Cessna 172 Skyhawk", kind: "light", speed: 110, fl: 60 },
  { name: "Cessna 208 Caravan", kind: "light", speed: 170, fl: 90 },
  { name: "Cirrus SF50 Vision Jet", kind: "light", speed: 300, fl: 280 },
  { name: "Beechcraft King Air", kind: "light", speed: 270, fl: 250 },
  { name: "Pitts Special", kind: "light", speed: 130, fl: 40 },
  // Rotary
  { name: "Bell 412 Rescue", kind: "helicopter", speed: 120, fl: 30 },
  { name: "Sikorsky UH-60 Black Hawk", kind: "helicopter", speed: 140, fl: 40 },
  // Curiosities
  { name: "Concorde", kind: "concorde", speed: 1050, fl: 550 },
  { name: "Supermarine Walrus", kind: "walrus", speed: 110, fl: 50 },
  { name: "Airship / Blimp", kind: "blimp", speed: 45, fl: 20 },
  { name: "Hot Air Balloon", kind: "balloon", speed: 15, fl: 20 },
  { name: "Santa's Sleigh", kind: "sleigh", speed: 600, fl: 100 },
  { name: "Glider", kind: "glider", speed: 70, fl: 80 },
];

/** Airlines seen in game, used for the flight-plan picker. */
export const AIRLINES = [
  "American Airlines",
  "British Airways",
  "Delta Air Lines",
  "Emirates",
  "Lufthansa",
  "Qatar Airways",
  "Ryanair",
  "Singapore Airlines",
  "United Airlines",
  "Air France",
  "KLM",
  "Turkish Airlines",
  "Qantas",
  "FedEx",
  "UPS Airlines",
  "PTFS Air Force",
  "Coastguard",
  "Private",
];

const BY_NAME = new Map(AIRCRAFT_TYPES.map((a) => [a.name.toLowerCase(), a]));

export function aircraftInfo(name: string): AircraftType | null {
  const key = name.trim().toLowerCase();
  const exact = BY_NAME.get(key);
  if (exact) return exact;
  return (
    AIRCRAFT_TYPES.find((a) => key.includes(a.name.toLowerCase()) || a.name.toLowerCase().includes(key)) ??
    null
  );
}

export function iconKindFor(aircraft: string): IconKind {
  const k = aircraft.toLowerCase();
  if (k.includes("225") || k.includes("mriya")) return "an225";
  if (k.includes("walrus")) return "walrus";
  if (k.includes("concorde")) return "concorde";
  if (k.includes("blimp") || k.includes("airship") || k.includes("zeppelin")) return "blimp";
  if (k.includes("balloon")) return "balloon";
  if (k.includes("sleigh") || k.includes("santa")) return "sleigh";
  if (k.includes("glider")) return "glider";
  return aircraftInfo(aircraft)?.kind ?? "airliner";
}

/**
 * Silhouettes drawn nose-up around the origin in a roughly 24x24 box.
 * `scale` lets the radar size heavies bigger than light aircraft.
 */
export const ICON_PATHS: Record<IconKind, { d: string; scale: number }> = {
  airliner: {
    d: "M0 -10 L2.2 -3 L10 2 L10 4.5 L2.2 2.5 L2.2 7 L5 9.5 L5 11 L0 9.6 L-5 11 L-5 9.5 L-2.2 7 L-2.2 2.5 L-10 4.5 L-10 2 L-2.2 -3 Z",
    scale: 1,
  },
  widebody: {
    d: "M0 -12 L2.8 -4 L13 2 L13 5 L2.8 3 L2.8 8 L6 11 L6 12.6 L0 11 L-6 12.6 L-6 11 L-2.8 8 L-2.8 3 L-13 5 L-13 2 L-2.8 -4 Z",
    scale: 1.15,
  },
  regional: {
    d: "M0 -8 L1.8 -2.5 L8.5 1.5 L8.5 3.6 L1.8 2 L1.8 6 L4 8.4 L4 9.7 L0 8.4 L-4 9.7 L-4 8.4 L-1.8 6 L-1.8 2 L-8.5 3.6 L-8.5 1.5 L-1.8 -2.5 Z",
    scale: 0.85,
  },
  cargo: {
    d: "M0 -11 L3.4 -5 L3.4 -1 L12 2 L12 4.8 L3.4 3 L3.4 7.5 L5.6 10.5 L5.6 12 L0 10.6 L-5.6 12 L-5.6 10.5 L-3.4 7.5 L-3.4 3 L-12 4.8 L-12 2 L-3.4 -1 L-3.4 -5 Z",
    scale: 1.1,
  },
  an225: {
    d: "M0 -13 L3.2 -6 L3.2 -2 L16 2 L16 5.4 L3.2 3.4 L3.2 8 L8 12 L8 13.6 L0 11.6 L-8 13.6 L-8 12 L-3.2 8 L-3.2 3.4 L-16 5.4 L-16 2 L-3.2 -2 L-3.2 -6 Z",
    scale: 1.35,
  },
  military: {
    d: "M0 -10 L2.6 -4 L11 1 L11 4 L2.6 2.4 L2.6 7 L6 10 L6 11.6 L0 10 L-6 11.6 L-6 10 L-2.6 7 L-2.6 2.4 L-11 4 L-11 1 L-2.6 -4 Z",
    scale: 1.05,
  },
  fighter: {
    d: "M0 -12 L1.6 -4 L9 6 L9 8 L1.8 4.4 L1.8 8 L4 11 L4 12.4 L0 10.8 L-4 12.4 L-4 11 L-1.8 8 L-1.8 4.4 L-9 8 L-9 6 L-1.6 -4 Z",
    scale: 0.95,
  },
  light: {
    d: "M0 -8 L1.4 -3.4 L9 -0.6 L9 1.4 L1.4 0.6 L1.4 6.4 L3.6 8.6 L3.6 9.8 L0 8.6 L-3.6 9.8 L-3.6 8.6 L-1.4 6.4 L-1.4 0.6 L-9 1.4 L-9 -0.6 L-1.4 -3.4 Z",
    scale: 0.78,
  },
  helicopter: {
    d: "M0 -6.5 L1.9 -3 L1.9 4 L4.6 6.2 L4.6 7.6 L0 6.4 L-4.6 7.6 L-4.6 6.2 L-1.9 4 L-1.9 -3 Z M-11 -8.4 L11 -6.6 L11 -5.4 L-11 -7.2 Z M-11 -5.4 L11 -7.2 L11 -6 L-11 -4.2 Z",
    scale: 0.9,
  },
  walrus: {
    d: "M0 -9 L2.2 -4 L2.2 0 L11 -1.6 L11 0.8 L2.2 2.4 L2.2 6.4 L4.6 9 L4.6 10.4 L0 9 L-4.6 10.4 L-4.6 9 L-2.2 6.4 L-2.2 2.4 L-11 0.8 L-11 -1.6 L-2.2 0 L-2.2 -4 Z M-7 3 L7 3 L7 4.6 L-7 4.6 Z",
    scale: 0.9,
  },
  concorde: {
    d: "M0 -14 L1.4 -6 L8.6 9 L8.6 11 L1.6 8.2 L1.6 10.6 L3.4 12.6 L3.4 13.8 L0 12.6 L-3.4 13.8 L-3.4 12.6 L-1.6 10.6 L-1.6 8.2 L-8.6 11 L-8.6 9 L-1.4 -6 Z",
    scale: 1.05,
  },
  blimp: {
    d: "M0 -13 C4.6 -13 6.4 -6 6.4 0 C6.4 6 4.6 11 0 11 C-4.6 11 -6.4 6 -6.4 0 C-6.4 -6 -4.6 -13 0 -13 Z M-3 10.5 L3 10.5 L2 13.5 L-2 13.5 Z",
    scale: 0.95,
  },
  sleigh: {
    d: "M-10 4 L8 4 L8 6.4 L-8 6.4 C-10.6 6.4 -11.6 4.6 -10 4 Z M-6 -3 L2 -3 L4 4 L-6 4 Z M8 6.4 L11 9 L9.6 10.2 L6.6 7.6 Z M-4 -8 L-1.4 -8 L-1.4 -3 L-4 -3 Z M2 -9 L4.4 -9 L4.4 -3 L2 -3 Z",
    scale: 1.05,
  },
  balloon: {
    d: "M0 -12 C6 -12 8.6 -6.4 8.6 -2 C8.6 3 4 7 0 9.4 C-4 7 -8.6 3 -8.6 -2 C-8.6 -6.4 -6 -12 0 -12 Z M-2.6 9.6 L2.6 9.6 L2.6 13 L-2.6 13 Z",
    scale: 0.95,
  },
  glider: {
    d: "M0 -8 L1.1 -3 L17 0 L17 1.6 L1.1 0.4 L1.1 7 L3.2 9.4 L3.2 10.6 L0 9.4 L-3.2 10.6 L-3.2 9.4 L-1.1 7 L-1.1 0.4 L-17 1.6 L-17 0 Z",
    scale: 0.85,
  },
};

/** Aircraft whose icon should always keep its upright orientation. */
export const UPRIGHT_KINDS: IconKind[] = ["balloon", "blimp"];

/**
 * Radar filter categories. Every aircraft kind belongs to exactly one, so the
 * filter panel can switch whole families of traffic on and off.
 */
export type CategoryKey = "airliner" | "cargo" | "military" | "light" | "rotary" | "special";

export const CATEGORIES: { key: CategoryKey; label: string; kinds: IconKind[] }[] = [
  { key: "airliner", label: "Airliners", kinds: ["airliner", "widebody", "regional"] },
  { key: "cargo", label: "Cargo & heavies", kinds: ["cargo", "an225"] },
  { key: "military", label: "Military", kinds: ["military", "fighter"] },
  { key: "light", label: "Light & GA", kinds: ["light", "glider"] },
  { key: "rotary", label: "Helicopters", kinds: ["helicopter"] },
  { key: "special", label: "Special", kinds: ["concorde", "walrus", "blimp", "balloon", "sleigh"] },
];

const KIND_TO_CATEGORY = new Map<IconKind, CategoryKey>(
  CATEGORIES.flatMap((c) => c.kinds.map((k) => [k, c.key] as [IconKind, CategoryKey])),
);

export function categoryFor(aircraft: string): CategoryKey {
  return KIND_TO_CATEGORY.get(iconKindFor(aircraft)) ?? "airliner";
}

/**
 * Single side-view silhouette used by the aircraft info card so a livery can be
 * painted onto the fuselage and tail.
 */
export const SIDE_VIEW = {
  fuselage:
    "M14 52 C34 40 92 34 168 34 C206 34 232 37 250 43 L272 52 L250 61 C232 67 206 70 168 70 C92 70 34 64 14 52 Z",
  tail: "M232 34 L268 6 L286 6 L272 34 Z",
  wing: "M96 52 L52 92 L74 92 L140 56 Z",
  stab: "M226 44 L200 24 L214 24 L248 42 Z",
  window: "M40 46 L150 44 L150 50 L40 51 Z",
} as const;

/** Flight-level formatting: 5000 ft -> "FL050". */
export function toFlightLevel(feet: number): string {
  return `FL${String(Math.round(feet / 100)).padStart(3, "0")}`;
}

export function flightLevelToFeet(fl: string): number {
  const n = Number(String(fl).replace(/[^0-9]/g, ""));
  return Number.isFinite(n) ? n * 100 : 0;
}
