import { airportByIcao, type Airport } from "./world";
import { pointAlong, routeAround, tfrBlocks, type Pt, type Tfr } from "./tfr";

export type FlightPlan = {
  id: string;
  user_id: string;
  callsign: string;
  airline: string | null;
  aircraft: string;
  dep_icao: string;
  arr_icao: string;
  alternate_icao: string | null;
  dep_time: string;
  arr_time: string;
  cruise_alt: number;
  cruise_speed: number;
  route: string | null;
  status: string;
  squawk: string;
  atc_status: string;
  atc_note: string | null;
};


export type FlightPhase = "scheduled" | "departing" | "enroute" | "arriving" | "arrived";

export type LiveFlight = {
  plan: FlightPlan;
  dep: Airport;
  arr: Airport;
  /** 0 before departure, 1 after arrival. */
  progress: number;
  phase: FlightPhase;
  x: number;
  y: number;
  heading: number;
  altitude: number;
  groundSpeed: number;
  minutesToDeparture: number;
  minutesToArrival: number;
  /** Actual track, bent around any restricted areas the flight must avoid. */
  path: Pt[];
  /** TFRs this flight is routing around. */
  avoiding: string[];
};

const MIN = 60_000;

function easeClimb(p: number) {
  // Climb over the first 15%, cruise, descend over the last 20%.
  if (p <= 0.15) return p / 0.15;
  if (p >= 0.8) return Math.max(0, (1 - p) / 0.2);
  return 1;
}

export function computeFlight(plan: FlightPlan, now: number, tfrs: Tfr[] = []): LiveFlight | null {
  const dep = airportByIcao(plan.dep_icao);
  const arr = airportByIcao(plan.arr_icao);
  if (!dep || !arr) return null;

  const depMs = new Date(plan.dep_time).getTime();
  const arrMs = new Date(plan.arr_time).getTime();
  const total = Math.max(arrMs - depMs, MIN);
  const raw = (now - depMs) / total;
  const progress = Math.min(1, Math.max(0, raw));

  let phase: FlightPhase;
  if (raw <= 0) phase = "scheduled";
  else if (raw >= 1) phase = "arrived";
  else if (progress < 0.12) phase = "departing";
  else if (progress > 0.85) phase = "arriving";
  else phase = "enroute";

  const blocking = tfrs.filter((t) => tfrBlocks(t, plan.callsign, plan.airline));
  const start: Pt = { x: dep.x, y: dep.y };
  const end: Pt = { x: arr.x, y: arr.y };
  const detour = routeAround(start, end, blocking.map((t) => t.points));
  const rerouted = detour.length > 2;

  const dx = arr.x - dep.x;
  const dy = arr.y - dep.y;
  const dist = Math.hypot(dx, dy) || 1;

  // Straight legs get a slight great-circle-like bow so tracks don't look like
  // plain rulers; detoured legs already have shape from the avoidance waypoints.
  let path: Pt[] = detour;
  if (!rerouted) {
    const bow = Math.min(dist * 0.08, 24);
    const nx = -dy / dist;
    const ny = dx / dist;
    path = Array.from({ length: 17 }, (_, i) => {
      const p = i / 16;
      const arc = Math.sin(p * Math.PI) * bow;
      return { x: dep.x + dx * p + nx * arc, y: dep.y + dy * p + ny * arc };
    });
  }

  const at = pointAlong(path, progress);
  const x = at.x;
  const y = at.y;
  const heading = at.heading;

  const altitude =
    phase === "scheduled" || phase === "arrived"
      ? phase === "scheduled"
        ? dep.elevation
        : arr.elevation
      : Math.round(plan.cruise_alt * easeClimb(progress));

  // Ground speed mirrors the speed filed in the flight plan.
  const groundSpeed = Math.round(plan.cruise_speed);

  return {
    plan,
    dep,
    arr,
    progress,
    phase,
    x,
    y,
    heading,
    altitude,
    groundSpeed: phase === "scheduled" || phase === "arrived" ? 0 : groundSpeed,
    minutesToDeparture: Math.round((depMs - now) / MIN),
    minutesToArrival: Math.round((arrMs - now) / MIN),
    path,
    avoiding: rerouted ? blocking.map((t) => t.name) : [],
  };
}

export function isVisibleOnRadar(f: LiveFlight, now: number): boolean {
  // Show active flights, plus flights within 30 min of pushback and 20 min
  // after landing (still parked at the gate, like FR24 does).
  const depMs = new Date(f.plan.dep_time).getTime();
  const arrMs = new Date(f.plan.arr_time).getTime();
  return now >= depMs - 30 * MIN && now <= arrMs + 20 * MIN;
}

export function formatHm(iso: string): string {
  return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false });
}

export function phaseLabel(phase: FlightPhase): string {
  switch (phase) {
    case "scheduled":
      return "Scheduled";
    case "departing":
      return "Departing";
    case "enroute":
      return "En route";
    case "arriving":
      return "Arriving";
    default:
      return "Arrived";
  }
}
