/**
 * Deterministic pseudo-weather.
 *
 * PTFS has no real METAR feed, so every airport gets its own weather that is
 * randomised once per hour: the same airport + hour always produces the same
 * report for every viewer, and it rolls over on the hour.
 */

export type AirportWeather = {
  condition: string;
  /** Celsius. */
  temperature: number;
  dewPoint: number;
  windDir: number;
  windSpeed: number;
  /** Metres, 9999 = 10 km or more. */
  visibility: number;
  humidity: number;
  /** inHg. */
  pressure: number;
  qnh: number;
  cloudCode: string;
  metar: string;
  /** Hour bucket the report was generated for. */
  issued: Date;
};

const CONDITIONS: { label: string; cloud: string }[] = [
  { label: "Clear", cloud: "CAVOK" },
  { label: "Few clouds", cloud: "FEW035" },
  { label: "Scattered clouds", cloud: "SCT028" },
  { label: "Broken clouds", cloud: "BKN021" },
  { label: "Overcast", cloud: "OVC012" },
  { label: "Light rain", cloud: "OVC009" },
  { label: "Mist", cloud: "BKN006" },
];

function hash(str: string): number {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** Small deterministic generator so each field varies independently. */
function rng(seed: number) {
  let s = seed || 1;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

const pad = (n: number, w = 2) => String(Math.round(n)).padStart(w, "0");

export function airportWeather(icao: string, at: number = Date.now()): AirportWeather {
  const issued = new Date(at);
  issued.setMinutes(0, 0, 0);
  const rand = rng(hash(`${icao.toUpperCase()}|${issued.getTime()}`));

  const idx = Math.floor(rand() * CONDITIONS.length);
  const cond = CONDITIONS[idx]!;
  const temperature = Math.round(4 + rand() * 26);
  const spread = Math.round(rand() * 6);
  const dewPoint = temperature - spread;
  const windDir = Math.round(rand() * 35) * 10;
  const windSpeed = Math.round(rand() * 22);
  const visibility = cond.label === "Mist" ? 2500 + Math.round(rand() * 3000) : 9999;
  const humidity = Math.min(100, Math.round(60 + (6 - spread) * 6 + rand() * 8));
  const qnh = Math.round(995 + rand() * 30);
  const pressure = Math.round((qnh / 33.8639) * 100) / 100;

  const metar = [
    icao.toUpperCase(),
    `${pad(issued.getUTCDate())}${pad(issued.getUTCHours())}${pad(issued.getUTCMinutes())}Z`,
    `${pad(windDir, 3)}${pad(windSpeed)}KT`,
    visibility >= 9999 ? "9999" : String(visibility),
    cond.cloud,
    `${pad(temperature)}/${pad(Math.max(dewPoint, 0))}`,
    `Q${qnh}`,
  ].join(" ");

  return {
    condition: cond.label,
    temperature,
    dewPoint,
    windDir,
    windSpeed,
    visibility,
    humidity,
    pressure,
    qnh,
    cloudCode: cond.cloud,
    metar,
    issued,
  };
}

export function windArrow(dir: number): string {
  const arrows = ["↓", "↙", "←", "↖", "↑", "↗", "→", "↘"];
  return arrows[Math.round(((dir % 360) / 45)) % 8]!;
}
