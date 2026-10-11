import { createFileRoute } from "@tanstack/react-router";

/**
 * Automatic ATIS generator.
 *
 * Every airport that has not had a new ATIS filed in the past 6 hours gets one
 * generated from its current weather. Airports with an explicit runway list
 * (e.g. Rockford's "07L/25R, 07C/25C, 07R/25L") announce every parallel
 * designator on the side into the wind; other single-runway airports get their
 * actual designator (same runway for departures and arrivals, picked into the
 * wind); airports without a runway strip keep "ALL RUNWAYS". Runs hourly.
 *
 * Call with `apikey: <publishable key>` or `Authorization: Bearer <PUSH_CRON_SECRET>`.
 */

const SIX_HOURS = 6 * 60 * 60 * 1000;
const LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

/** "08" style designator for a runway heading in degrees. */
function designator(heading: number): string {
  const d = (((Math.round(heading / 10) * 10) % 360) + 360) % 360;
  return String(d === 0 ? 36 : d / 10).padStart(2, "0");
}

/** Smallest angle between two headings. */
function headingDiff(a: number, b: number): number {
  return Math.abs((((a - b) % 360) + 540) % 360 - 180);
}

/**
 * Runway in use for a single-runway airport: the strip direction closest to
 * the wind, so departures and arrivals use the same runway into the wind.
 */
function runwayInUse(heading: number, windDir: number): string {
  const opposite = (heading + 180) % 360;
  return designator(headingDiff(heading, windDir) <= headingDiff(opposite, windDir) ? heading : opposite);
}

/**
 * Runways in use for an airport. When the airport carries an explicit strip
 * list ("07L/25R, 07C/25C, 07R/25L"), every strip's direction closest to the
 * wind is announced, keeping parallel suffixes: "07L 07C 07R". Otherwise fall
 * back to the single-strip heading, or ALL RUNWAYS when there is no strip.
 */
function runwaysInUse(ap: { runway: number; runways: string | null }, windDir: number): string {
  if (ap.runways) {
    const chosen = ap.runways
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)
      .map((strip) => {
        const [a, b] = strip.split("/").map((s) => s.trim());
        if (!a) return "";
        if (!b) return a;
        return headingDiff(parseInt(a, 10) * 10, windDir) <= headingDiff(parseInt(b, 10) * 10, windDir) ? a : b;
      })
      .filter(Boolean);
    if (chosen.length) return chosen.join(" ");
  }
  return ap.runway > 0 ? runwayInUse(ap.runway, windDir) : "ALL RUNWAYS";
}

export const Route = createFileRoute("/api/public/atis/auto")({
  server: {
    handlers: {
      POST: async ({ request }) => handle(request),
      GET: async ({ request }) => handle(request),
    },
  },
});

async function handle(request: Request): Promise<Response> {
  const apikey = request.headers.get("apikey") ?? "";
  const bearer = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
  const publishable = process.env["SUPABASE_PUBLISHABLE_KEY"] ?? "";
  const cronSecret = process.env["PUSH_CRON_SECRET"] ?? "";
  const authorized =
    (publishable && (apikey === publishable || bearer === publishable)) ||
    (cronSecret && bearer === cronSecret);
  if (!authorized) return new Response("Unauthorized", { status: 401 });

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { airportWeather } = await import("@/lib/weather");
  const { postAtisMessage } = await import("@/lib/discord.server");

  const { data: airports, error } = await supabaseAdmin
    .from("airports")
    .select("icao, runway, runways")
    .order("icao");
  if (error) return new Response(error.message, { status: 500 });

  const { data: existing } = await supabaseAdmin
    .from("atis")
    .select("airport_icao, letter, updated_at")
    .order("updated_at", { ascending: false });

  const latest = new Map<string, { letter: string; updated_at: string }>();
  for (const row of existing ?? []) {
    if (!latest.has(row.airport_icao)) latest.set(row.airport_icao, row);
  }

  const now = Date.now();
  const created: string[] = [];

  for (const ap of airports ?? []) {
    const last = latest.get(ap.icao);
    if (last && now - new Date(last.updated_at).getTime() < SIX_HOURS) continue;

    const prev = last ? LETTERS.indexOf(last.letter.toUpperCase().charAt(0)) : -1;
    const letter = LETTERS.charAt((prev + 1 + LETTERS.length) % LETTERS.length);

    const wx = airportWeather(ap.icao, now);
    // Airports with an explicit strip list announce every parallel designator
    // into the wind; single-runway airports broadcast their real designator
    // for both departures and arrivals; strips without a runway keep ALL RUNWAYS.
    const runways = runwaysInUse(ap, wx.windDir);

    await supabaseAdmin.from("atis").update({ active: false }).eq("airport_icao", ap.icao).eq("active", true);

    const row = {
      airport_icao: ap.icao,
      letter,
      runway_in_use: runways,
      approaches: runways,
      wind: `${String(wx.windDir).padStart(3, "0")}/${String(wx.windSpeed).padStart(2, "0")}KT`,
      visibility: wx.visibility >= 9999 ? "10KM" : `${wx.visibility}M`,
      clouds: wx.cloudCode,
      temperature: String(wx.temperature),
      dew_point: String(wx.dewPoint),
      qnh: String(wx.qnh),
      remarks: "Automatically generated ATIS.",
      active: true,
    };

    const { error: insertError } = await supabaseAdmin.from("atis").insert(row);
    if (insertError) {
      console.error("[atis-auto] insert failed", ap.icao, insertError.message);
      continue;
    }
    created.push(ap.icao);
    try {
      await postAtisMessage({ ...row, updated_at: new Date().toISOString() });
    } catch (e) {
      console.error("[atis-auto] discord relay failed", ap.icao, e);
    }
  }

  return Response.json({ checked: airports?.length ?? 0, created });
}
