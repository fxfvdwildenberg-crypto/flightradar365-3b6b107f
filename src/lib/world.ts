/**
 * World model for the radar.
 *
 * The world is a flat 1000 x 1000 coordinate space (no real geography).
 * Islands sit at fixed positions matching the in-game island selection map,
 * and each airport carries local coordinates in that same space.
 *
 * `detailImage` is the hook for a high-resolution island image: when supplied,
 * the map crossfades from the vector island into that image as you zoom in.
 */

import orenjiImg from "@/assets/islands/orenji.png";
import perthImg from "@/assets/islands/perth.png";
import izoliraniImg from "@/assets/islands/izolirani.png";
import cyprusImg from "@/assets/islands/cyprus.png";
import skopelosImg from "@/assets/islands/skopelos.png";
import stBarthImg from "@/assets/islands/saint-barthelemy.png";
import grindavikImg from "@/assets/islands/grindavik.png";
import rockfordImg from "@/assets/islands/greater-rockford.png";
import sauthemptonaImg from "@/assets/islands/sauthemptona.png";
import ussImg from "@/assets/islands/uss-carrier.png";
import hmsImg from "@/assets/islands/hms-carrier.png";
import oilRigImg from "@/assets/islands/oil-rig.png";

export type Airport = {

  icao: string;
  iata?: string;
  name: string;
  island: string;
  x: number;
  y: number;
  /** Runway heading in degrees, used to draw the runway on the detail layer. */
  runway: number;
  elevation: number;
  major?: boolean;
  /** Admin-authored description shown on the airport panel. */
  info?: string | null;
  /** Admin-uploaded in-game photo of the airport. */
  image_url?: string | null;
};


export type Island = {
  slug: string;
  name: string;
  x: number;
  y: number;
  /** Half-size of the island footprint in world units. */
  radius: number;
  seed: number;
  terrain: "green" | "dry" | "mixed" | "vessel";
  /** High-resolution cut-out image of the real island. */
  image?: string;
  /** width / height of that image. */
  imageAspect?: number;
};

const img = (
  a: string,
  w: number,
  h: number,
): { image: string; imageAspect: number } => ({ image: a, imageAspect: w / h });

export const ISLANDS: Island[] = [
  { slug: "orenji", name: "Orenji", x: 433, y: 78, radius: 58, seed: 11, terrain: "green", ...img(orenjiImg, 792, 628) },
  { slug: "perth", name: "Perth", x: 667, y: 318, radius: 62, seed: 23, terrain: "green", ...img(perthImg, 740, 640) },
  { slug: "izolirani", name: "Izolirani", x: 811, y: 486, radius: 55, seed: 37, terrain: "dry", ...img(izoliraniImg, 697, 640) },
  { slug: "cyprus", name: "Cyprus", x: 678, y: 843, radius: 72, seed: 41, terrain: "mixed", ...img(cyprusImg, 739, 629) },
  { slug: "skopelos", name: "Skopelos", x: 691, y: 629, radius: 20, seed: 53, terrain: "green", ...img(skopelosImg, 399, 409) },
  {
    slug: "saint-barthelemy",
    name: "Saint Barthélemy",
    x: 549,
    y: 452,
    radius: 26,
    seed: 61,
    terrain: "green",
    ...img(stBarthImg, 630, 581),
  },
  { slug: "grindavik", name: "Grindavik", x: 156, y: 448, radius: 58, seed: 71, terrain: "dry", ...img(grindavikImg, 425, 635) },
  {
    slug: "greater-rockford",
    name: "Greater Rockford",
    x: 400, y: 706, radius: 88, seed: 83, terrain: "green",
    ...img(rockfordImg, 670, 640),
  },
  { slug: "sauthemptona", name: "Sauthemptona", x: 128, y: 766, radius: 16, seed: 97, terrain: "vessel", ...img(sauthemptonaImg, 560, 444) },
  { slug: "uss-carrier", name: "USS Carrier", x: 344, y: 334, radius: 12, seed: 101, terrain: "vessel", ...img(ussImg, 812, 536) },
  { slug: "hms-carrier", name: "HMS Carrier", x: 486, y: 620, radius: 12, seed: 103, terrain: "vessel", ...img(hmsImg, 791, 529) },
  { slug: "oil-rig", name: "Oil Rig", x: 178, y: 631, radius: 10, seed: 107, terrain: "vessel", ...img(oilRigImg, 703, 582) },
];


export const AIRPORTS: Airport[] = [
  // Grindavik
  { icao: "IKFL", iata: "KFL", name: "Keflavik International", island: "grindavik", x: 152, y: 486, runway: 65, elevation: 32, major: true },
  { icao: "IPGY", name: "Pingeyri", island: "grindavik", x: 178, y: 414, runway: 120, elevation: 55 },
  { icao: "ITAV", name: "Tavaro Seabase", island: "grindavik", x: 196, y: 442, runway: 0, elevation: 4 },
  { icao: "IGCG", name: "Grindavik Coastguard", island: "grindavik", x: 128, y: 452, runway: 90, elevation: 12 },

  // Greater Rockford
  { icao: "IRFD", iata: "RFD", name: "Rockford Airport", island: "greater-rockford", x: 442, y: 716, runway: 80, elevation: 3, major: true },
  { icao: "IMLR", iata: "MLR", name: "Mellor Airport", island: "greater-rockford", x: 330, y: 654, runway: 40, elevation: 21, major: true },
  { icao: "IBTH", name: "Boltic Airfield", island: "greater-rockford", x: 400, y: 686, runway: 130, elevation: 44 },
  { icao: "IGRV", name: "Airbase Garry", island: "greater-rockford", x: 356, y: 748, runway: 25, elevation: 30 },
  { icao: "ITRC", name: "Training Centre", island: "greater-rockford", x: 470, y: 782, runway: 100, elevation: 18 },
  { icao: "IROD", name: "Road Base", island: "greater-rockford", x: 420, y: 728, runway: 15, elevation: 26 },
  { icao: "IWLO", name: "Waterloo", island: "greater-rockford", x: 428, y: 660, runway: 70, elevation: 61 },
  { icao: "IRCG", name: "Rockford Coastguard", island: "greater-rockford", x: 392, y: 736, runway: 55, elevation: 8 },

  // Perth
  { icao: "IPPH", iata: "PPH", name: "Perth International", island: "perth", x: 630, y: 296, runway: 95, elevation: 47, major: true },
  { icao: "ILKL", name: "Lukla", island: "perth", x: 672, y: 322, runway: 20, elevation: 940 },
  { icao: "ISAV", name: "Sea Haven", island: "perth", x: 700, y: 282, runway: 145, elevation: 15 },
  { icao: "IPCG", name: "Perth Coastguard", island: "perth", x: 652, y: 348, runway: 75, elevation: 6 },

  // Cyprus
  { icao: "ILAR", iata: "LAR", name: "Larnaca International", island: "cyprus", x: 654, y: 806, runway: 60, elevation: 24, major: true },
  { icao: "IPAP", name: "Paphos", island: "cyprus", x: 726, y: 818, runway: 110, elevation: 33 },
  { icao: "IBAR", name: "Barra", island: "cyprus", x: 700, y: 858, runway: 30, elevation: 12 },
  { icao: "IMCN", name: "McConnell", island: "cyprus", x: 664, y: 878, runway: 85, elevation: 41 },
  { icao: "IHEN", name: "Henstridge Airfield", island: "cyprus", x: 624, y: 892, runway: 140, elevation: 19 },

  // Izolirani
  { icao: "IZOL", iata: "ZOL", name: "Izolirani Airport", island: "izolirani", x: 811, y: 486, runway: 50, elevation: 28, major: true },
  { icao: "ITKO", iata: "TKO", name: "Tokyo Airport", island: "izolirani", x: 842, y: 462, runway: 130, elevation: 11, major: true },

  // Other regions
  { icao: "IORE", name: "Orenji Airstrip", island: "orenji", x: 433, y: 82, runway: 35, elevation: 9 },
  { icao: "ISKP", name: "Skopelos Field", island: "skopelos", x: 691, y: 629, runway: 100, elevation: 22 },
  { icao: "IBAR2", name: "Saint Barthélemy", island: "saint-barthelemy", x: 549, y: 452, runway: 70, elevation: 14 },
  { icao: "IUSS", name: "USS Carrier", island: "uss-carrier", x: 344, y: 334, runway: 10, elevation: 0 },
  { icao: "IHMS", name: "HMS Carrier", island: "hms-carrier", x: 486, y: 620, runway: 350, elevation: 0 },
  { icao: "ISTH", name: "Sauthemptona", island: "sauthemptona", x: 128, y: 766, runway: 0, elevation: 0 },
  { icao: "IOIL", name: "Oil Rig", island: "oil-rig", x: 178, y: 631, runway: 0, elevation: 0 },
];

/**
 * Replace the airport registry with the admin-managed rows from the database.
 * Mutates in place so existing module imports keep pointing at live data.
 */
export function setAirports(next: Airport[]): void {
  AIRPORTS.splice(0, AIRPORTS.length, ...next);
}

export const airportByIcao = (icao: string): Airport | undefined =>
  AIRPORTS.find((a) => a.icao === icao.toUpperCase());


export const islandBySlug = (slug: string): Island | undefined =>
  ISLANDS.find((i) => i.slug === slug);

export const airportsOfIsland = (slug: string): Airport[] =>
  AIRPORTS.filter((a) => a.island === slug);

/* ------------------------------------------------------------------ */
/* Deterministic island geometry                                       */
/* ------------------------------------------------------------------ */

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export type Ring = { x: number; y: number }[];

/** Blobby coastline polygon for an island, stable across renders. */
export function islandOutline(island: Island, points = 26): Ring {
  const rand = mulberry32(island.seed);
  const wob = Array.from({ length: 5 }, () => ({
    amp: 0.1 + rand() * 0.26,
    phase: rand() * Math.PI * 2,
  }));
  const ring: Ring = [];
  for (let i = 0; i < points; i++) {
    const t = (i / points) * Math.PI * 2;
    let r = 1;
    wob.forEach((w, k) => {
      r += w.amp * Math.sin(t * (k + 2) + w.phase) * (1 / (k + 1.3));
    });
    r = Math.max(0.45, r);
    ring.push({
      x: island.x + Math.cos(t) * island.radius * r,
      y: island.y + Math.sin(t) * island.radius * r * 0.86,
    });
  }
  return ring;
}

export function ringToPath(ring: Ring): string {
  const first = ring[0];
  if (!first) return "";
  // Catmull-Rom-ish smoothing through the points for a natural coastline.
  const at = (i: number) => ring[((i % ring.length) + ring.length) % ring.length]!;
  const d: string[] = [`M ${first.x.toFixed(2)} ${first.y.toFixed(2)}`];
  for (let i = 0; i < ring.length; i++) {
    const p0 = at(i - 1);
    const p1 = at(i);
    const p2 = at(i + 1);
    const p3 = at(i + 2);
    const c1x = p1.x + (p2.x - p0.x) / 6;
    const c1y = p1.y + (p2.y - p0.y) / 6;
    const c2x = p2.x - (p3.x - p1.x) / 6;
    const c2y = p2.y - (p3.y - p1.y) / 6;
    d.push(
      `C ${c1x.toFixed(2)} ${c1y.toFixed(2)}, ${c2x.toFixed(2)} ${c2y.toFixed(2)}, ${p2.x.toFixed(2)} ${p2.y.toFixed(2)}`,
    );
  }
  d.push("Z");
  return d.join(" ");
}


/** Interior terrain patches used by the zoomed-in detail layer. */
export function terrainPatches(island: Island, count = 14) {
  const rand = mulberry32(island.seed * 7 + 3);
  return Array.from({ length: count }, () => {
    const a = rand() * Math.PI * 2;
    const r = Math.sqrt(rand()) * island.radius * 0.72;
    return {
      x: island.x + Math.cos(a) * r,
      y: island.y + Math.sin(a) * r * 0.86,
      w: island.radius * (0.12 + rand() * 0.3),
      h: island.radius * (0.1 + rand() * 0.26),
      rot: rand() * 90,
      tone: rand(),
    };
  });
}

/** Simple road network for the detail layer. */
export function roadNetwork(island: Island) {
  const ports = airportsOfIsland(island.slug);
  if (ports.length < 2) return [] as { x1: number; y1: number; x2: number; y2: number }[];
  const lines: { x1: number; y1: number; x2: number; y2: number }[] = [];
  for (let i = 0; i < ports.length; i++) {
    const a = ports[i]!;
    const b = ports[(i + 1) % ports.length]!;
    lines.push({ x1: a.x, y1: a.y, x2: b.x, y2: b.y });

  }
  return lines;
}

export const WORLD_SIZE = 1000;
