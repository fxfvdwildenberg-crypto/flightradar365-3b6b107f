import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type Pt = { x: number; y: number };

export type Tfr = {
  id: string;
  name: string;
  reason: string | null;
  points: Pt[];
  allowed_callsigns: string[];
  min_alt: number;
  max_alt: number;
  expires_at: string;
  created_at: string;
};

/** TFRs live for six hours unless an admin extends them. */
export const TFR_HOURS = 6;

export function parsePoints(raw: unknown): Pt[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((p) => (p && typeof p === "object" ? (p as Pt) : null))
    .filter((p): p is Pt => !!p && Number.isFinite(p.x) && Number.isFinite(p.y));
}

/** Live, non-expired temporary flight restrictions. */
export function useTfrs() {
  return useQuery({
    queryKey: ["tfrs"],
    refetchInterval: 60_000,
    queryFn: async (): Promise<Tfr[]> => {
      const { data, error } = await supabase
        .from("tfrs")
        .select("*")
        .gt("expires_at", new Date().toISOString())
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []).map((r) => ({
        id: r.id,
        name: r.name,
        reason: r.reason,
        points: parsePoints(r.points),
        allowed_callsigns: r.allowed_callsigns ?? [],
        min_alt: r.min_alt,
        max_alt: r.max_alt,
        expires_at: r.expires_at,
        created_at: r.created_at,
      }));
    },
  });
}

export function minutesLeft(tfr: Tfr, now: number = Date.now()): number {
  return Math.max(0, Math.round((new Date(tfr.expires_at).getTime() - now) / 60_000));
}

export function expiresLabel(tfr: Tfr, now: number = Date.now()): string {
  const m = minutesLeft(tfr, now);
  if (m <= 0) return "Expired";
  const h = Math.floor(m / 60);
  return h ? `${h}h ${m % 60}m left` : `${m}m left`;
}

/* ------------------------------------------------------------------ */
/* geometry                                                            */
/* ------------------------------------------------------------------ */

export function polygonCentroid(pts: Pt[]): Pt {
  const n = pts.length || 1;
  return {
    x: pts.reduce((s, p) => s + p.x, 0) / n,
    y: pts.reduce((s, p) => s + p.y, 0) / n,
  };
}

export function pointInPolygon(p: Pt, poly: Pt[]): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i]!;
    const b = poly[j]!;
    if (a.y > p.y !== b.y > p.y && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y || 1e-9) + a.x)
      inside = !inside;
  }
  return inside;
}

function segmentsCross(a: Pt, b: Pt, c: Pt, d: Pt): boolean {
  const s = (p: Pt, q: Pt, r: Pt) => (q.x - p.x) * (r.y - p.y) - (q.y - p.y) * (r.x - p.x);
  const d1 = s(a, b, c);
  const d2 = s(a, b, d);
  const d3 = s(c, d, a);
  const d4 = s(c, d, b);
  return d1 * d2 < 0 && d3 * d4 < 0;
}

/** Does the segment a→b enter the polygon at all? */
export function segmentHitsPolygon(a: Pt, b: Pt, poly: Pt[]): boolean {
  if (poly.length < 3) return false;
  if (pointInPolygon(a, poly) || pointInPolygon(b, poly)) return true;
  const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
  if (pointInPolygon(mid, poly)) return true;
  for (let i = 0; i < poly.length; i++) {
    if (segmentsCross(a, b, poly[i]!, poly[(i + 1) % poly.length]!)) return true;
  }
  return false;
}

/** Polygon grown away from its centre so tracks clear the edge visibly. */
function inflate(poly: Pt[], margin: number): Pt[] {
  const c = polygonCentroid(poly);
  return poly.map((p) => {
    const dx = p.x - c.x;
    const dy = p.y - c.y;
    const d = Math.hypot(dx, dy) || 1;
    return { x: p.x + (dx / d) * margin, y: p.y + (dy / d) * margin };
  });
}

export function tfrBlocks(tfr: Tfr, callsign: string, airline: string | null): boolean {
  const allowed = tfr.allowed_callsigns.map((c) => c.trim().toUpperCase()).filter(Boolean);
  const cs = callsign.toUpperCase();
  if (allowed.some((a) => a === cs || (airline && a === airline.toUpperCase()) || cs.startsWith(a)))
    return false;
  return tfr.points.length >= 3;
}

/**
 * Builds a track from `start` to `end` that steers clear of every blocking
 * restricted area, picking whichever side of the zone is the shorter way round.
 */
export function routeAround(start: Pt, end: Pt, zones: Pt[][], depth = 4): Pt[] {
  if (depth <= 0) return [start, end];
  for (const poly of zones) {
    if (poly.length < 3) continue;
    const margin = Math.max(4, Math.hypot(end.x - start.x, end.y - start.y) * 0.02);
    const grown = inflate(poly, margin);
    if (!segmentHitsPolygon(start, end, grown)) continue;

    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const len = Math.hypot(dx, dy) || 1;
    const nx = -dy / len;
    const ny = dx / len;

    let left: Pt | null = null;
    let right: Pt | null = null;
    let bestL = 0;
    let bestR = 0;
    for (const p of grown) {
      const side = (p.x - start.x) * nx + (p.y - start.y) * ny;
      if (side > bestL) {
        bestL = side;
        left = p;
      }
      if (side < bestR) {
        bestR = side;
        right = p;
      }
    }

    const cost = (wp: Pt | null) =>
      wp ? Math.hypot(wp.x - start.x, wp.y - start.y) + Math.hypot(end.x - wp.x, end.y - wp.y) : Infinity;
    const via = cost(left) <= cost(right) ? left : right;
    if (!via) continue;

    const rest = zones.filter((z) => z !== poly);
    return [
      ...routeAround(start, via, [...rest, poly], depth - 1).slice(0, -1),
      ...routeAround(via, end, [...rest, poly], depth - 1),
    ];
  }
  return [start, end];
}

export function polylineLength(path: Pt[]): number {
  let total = 0;
  for (let i = 1; i < path.length; i++)
    total += Math.hypot(path[i]!.x - path[i - 1]!.x, path[i]!.y - path[i - 1]!.y);
  return total;
}

/** Position and heading at a 0..1 fraction along a polyline. */
export function pointAlong(path: Pt[], t: number): { x: number; y: number; heading: number } {
  const first = path[0] ?? { x: 0, y: 0 };
  const last = path[path.length - 1] ?? first;
  const total = polylineLength(path);
  if (total <= 0) return { x: first.x, y: first.y, heading: 0 };
  let want = Math.min(1, Math.max(0, t)) * total;
  for (let i = 1; i < path.length; i++) {
    const a = path[i - 1]!;
    const b = path[i]!;
    const seg = Math.hypot(b.x - a.x, b.y - a.y);
    if (want <= seg || i === path.length - 1) {
      const k = seg ? want / seg : 0;
      return {
        x: a.x + (b.x - a.x) * k,
        y: a.y + (b.y - a.y) * k,
        heading: (Math.atan2(b.y - a.y, b.x - a.x) * 180) / Math.PI + 90,
      };
    }
    want -= seg;
  }
  return { x: last.x, y: last.y, heading: 0 };
}