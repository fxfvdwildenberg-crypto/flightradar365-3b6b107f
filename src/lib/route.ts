import { airportByIcao } from "./world";
import { segmentHitsPolygon, tfrBlocks, type Pt, type Tfr } from "./tfr";
import { waypointByName, type Waypoint } from "./waypoints";

/** Resolve filed fix names into chart waypoints, dropping unknown names. */
export function resolveFixes(names: string[]): Waypoint[] {
  return names
    .map((n) => waypointByName(n))
    .filter((w): w is Waypoint => !!w);
}

/**
 * Names of restricted areas a waypoint route would cut through for this flight.
 * Whitelisted callsigns are allowed inside and never reported.
 */
export function routeViolations(
  depIcao: string,
  arrIcao: string,
  fixNames: string[],
  tfrs: Tfr[],
  callsign: string,
  airline: string | null,
): string[] {
  const dep = airportByIcao(depIcao);
  const arr = airportByIcao(arrIcao);
  if (!dep || !arr) return [];
  const path: Pt[] = [
    { x: dep.x, y: dep.y },
    ...resolveFixes(fixNames).map((w) => ({ x: w.x, y: w.y })),
    { x: arr.x, y: arr.y },
  ];
  const hits: string[] = [];
  for (const t of tfrs) {
    if (t.points.length < 3) continue;
    if (!tfrBlocks(t, callsign, airline)) continue;
    for (let i = 1; i < path.length; i++) {
      if (segmentHitsPolygon(path[i - 1]!, path[i]!, t.points)) {
        hits.push(t.name);
        break;
      }
    }
  }
  return [...new Set(hits)];
}

/** Rough track length in world units for a waypoint route. */
export function routeDistance(depIcao: string, arrIcao: string, fixNames: string[]): number {
  const dep = airportByIcao(depIcao);
  const arr = airportByIcao(arrIcao);
  if (!dep || !arr) return 0;
  const pts: Pt[] = [
    { x: dep.x, y: dep.y },
    ...resolveFixes(fixNames).map((w) => ({ x: w.x, y: w.y })),
    { x: arr.x, y: arr.y },
  ];
  let total = 0;
  for (let i = 1; i < pts.length; i++)
    total += Math.hypot(pts[i]!.x - pts[i - 1]!.x, pts[i]!.y - pts[i - 1]!.y);
  return total;
}
