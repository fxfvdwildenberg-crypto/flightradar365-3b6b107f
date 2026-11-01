/**
 * Real in-game traffic from the public CPDLC feed (cpdlc.up.railway.app).
 * Their world grid (nm) is mapped onto our map with an affine fit over the
 * airports both sides know, so it adapts when admins move airports.
 */
import { useQuery } from "@tanstack/react-query";
import { AIRPORTS, airportByIcao, type Airport } from "./world";
import type { FlightPlan, LiveFlight } from "./flights";

const BASE = "https://cpdlc.up.railway.app/api/public/v1";

type GridAirport = { icao: string; xNm: number; yNm: number };
type Traffic = {
  callsign: string;
  aircraftType: string | null;
  altitudeFt: number | null;
  speedKt: number | null;
  headingDeg: number | null;
  squawk: string | null;
  xNm: number | null;
  yNm: number | null;
  referenceAirport: string | null;
  fixAgeSec: number | null;
  distanceNm: number | null;
  bearingDeg: number | null;
};

type Affine = [number, number, number, number, number, number];

/** Least-squares fit of x' = a·x + b·y + c, y' = d·x + e·y + f. */
export function fitAffine(pairs: { u: number; v: number; x: number; y: number }[]): Affine | null {
  if (pairs.length < 3) return null;
  const s: number[] = new Array(9).fill(0);
  const rx = [0, 0, 0];
  const ry = [0, 0, 0];
  for (const p of pairs) {
    const r = [p.u, p.v, 1];
    for (let i = 0; i < 3; i++) {
      for (let j = 0; j < 3; j++) s[i * 3 + j]! += r[i]! * r[j]!;
      rx[i]! += r[i]! * p.x;
      ry[i]! += r[i]! * p.y;
    }
  }
  const solve = (b: number[]) => {
    const m = s.map((v) => v);
    const det = (z: number[]) => {
      const q = (i: number) => z[i]!;
      return q(0) * (q(4) * q(8) - q(5) * q(7)) - q(1) * (q(3) * q(8) - q(5) * q(6)) + q(2) * (q(3) * q(7) - q(4) * q(6));
    };
    const D = det(m);
    if (Math.abs(D) < 1e-9) return null;
    return [0, 1, 2].map((c) => {
      const q = m.slice();
      for (let r = 0; r < 3; r++) q[r * 3 + c] = b[r]!;
      return det(q) / D;
    });
  };
  const X = solve(rx);
  const Y = solve(ry);
  if (!X || !Y) return null;
  return [X[0]!, X[1]!, X[2]!, Y[0]!, Y[1]!, Y[2]!];
}

function nearestAirport(x: number, y: number): Airport | undefined {
  let best: Airport | undefined;
  let bd = Infinity;
  for (const a of AIRPORTS) {
    const d = Math.hypot(a.x - x, a.y - y);
    if (d < bd) {
      bd = d;
      best = a;
    }
  }
  return best;
}

async function fetchJson<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}/${path}`);
  if (!res.ok) throw new Error(`traffic feed ${res.status}`);
  return res.json() as Promise<T>;
}

export function useLiveTraffic(airportsVersion: number): LiveFlight[] {
  const { data: grid } = useQuery({
    queryKey: ["cpdlc-airports"],
    queryFn: () => fetchJson<{ airports: GridAirport[] }>("airports"),
    staleTime: 60 * 60_000,
  });
  const { data: traffic } = useQuery({
    queryKey: ["cpdlc-traffic"],
    queryFn: () => fetchJson<{ aircraft: Traffic[] }>("traffic"),
    refetchInterval: 3000,
  });

  void airportsVersion;
  if (!grid || !traffic) return [];
  const pairs = grid.airports
    .map((g) => {
      const a = airportByIcao(g.icao);
      return a ? { u: g.xNm, v: g.yNm, x: a.x, y: a.y } : null;
    })
    .filter((p): p is { u: number; v: number; x: number; y: number } => !!p);
  const t = fitAffine(pairs);
  if (!t) return [];

  const scale = Math.sqrt(Math.abs(t[0] * t[4] - t[1] * t[3]));
  const now = new Date().toISOString();
  return traffic.aircraft
    .filter((a) => a.xNm !== null && a.yNm !== null)
    .map((a) => {
      let x = t[0] * a.xNm! + t[1] * a.yNm! + t[2];
      let y = t[3] * a.xNm! + t[4] * a.yNm! + t[5];
      // Our map isn't drawn to scale, so anchor on the reference airport when we know it.
      const anchor = a.referenceAirport ? airportByIcao(a.referenceAirport) : undefined;
      if (anchor && a.distanceNm != null && a.bearingDeg != null) {
        const r = (a.bearingDeg * Math.PI) / 180;
        x = anchor.x + a.distanceNm * scale * Math.sin(r);
        y = anchor.y - a.distanceNm * scale * Math.cos(r);
      }
      const ref = anchor || nearestAirport(x, y)!;
      const plan: FlightPlan = {
        id: `live-${a.callsign}`,
        user_id: "",
        callsign: a.callsign,
        airline: null,
        aircraft: a.aircraftType ?? "Unknown",
        dep_icao: ref.icao,
        arr_icao: ref.icao,
        alternate_icao: null,
        dep_time: now,
        arr_time: now,
        cruise_alt: a.altitudeFt ?? 0,
        cruise_speed: a.speedKt ?? 0,
        route: "LIVE",
        status: "active",
        squawk: a.squawk ?? "2000",
        atc_status: "live",
        atc_note: null,
      };
      return {
        plan,
        dep: ref,
        arr: ref,
        progress: 0.5,
        phase: (a.altitudeFt ?? 0) > 100 ? "enroute" : "departing",
        x,
        y,
        heading: a.headingDeg ?? 0,
        altitude: a.altitudeFt ?? 0,
        groundSpeed: a.speedKt ?? 0,
        minutesToDeparture: 0,
        minutesToArrival: 0,
        path: [{ x, y }],
        avoiding: [],
        nav: "vectors",
        fixes: [],
        violating: [],
        approaching: [],
        inside: [],
      } satisfies LiveFlight;
    });
}
