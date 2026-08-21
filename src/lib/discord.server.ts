/**
 * Discord relay for ATC365.
 *
 * Flight plans go to the flight plans channel in the ICAO ("hard") format that
 * controllers read; ATIS broadcasts go to the ATIS channel.
 */

import { buildFpl } from "./fpl";

const FLIGHTPLAN_CHANNEL_ID = "1513951469018021898";
const ATIS_CHANNEL_ID = "1514326357763686611";

type PostResult = { ok: boolean; reason?: string };

async function send(channelId: string, payload: unknown): Promise<PostResult> {
  const token = process.env["DISCORD_BOT_TOKEN"];
  if (!token) return { ok: false, reason: "discord-not-configured" };

  const res = await fetch(`https://discord.com/api/v10/channels/${channelId}/messages`, {
    method: "POST",
    headers: {
      Authorization: `Bot ${token}`,
      "content-type": "application/json",
    },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    console.error("[discord] post failed", channelId, res.status, await res.text());
    return { ok: false, reason: `discord-${res.status}` };
  }
  return { ok: true };
}

type PlanRow = {
  callsign: string;
  airline: string | null;
  aircraft: string;
  aircraft_icao: string | null;
  registration: string | null;
  flight_rules: string | null;
  flight_type: string | null;
  dep_icao: string;
  arr_icao: string;
  alternate_icao: string | null;
  dep_time: string;
  arr_time: string;
  cruise_alt: number;
  cruise_speed: number;
  route: string | null;
  remarks: string | null;
  squawk: string | null;
  atc_status: string | null;
};

export async function postFlightPlanMessage(plan: PlanRow): Promise<PostResult> {
  const fpl = buildFpl({
    callsign: plan.callsign,
    flightRules: plan.flight_rules === "VFR" ? "VFR" : "IFR",
    flightType: plan.flight_type ?? "S",
    aircraft: plan.aircraft,
    aircraftIcao: plan.aircraft_icao ?? "",
    registration: plan.registration ?? "",
    depIcao: plan.dep_icao,
    arrIcao: plan.arr_icao,
    depTime: plan.dep_time,
    arrTime: plan.arr_time,
    cruiseSpeed: plan.cruise_speed,
    cruiseFl: Math.round(plan.cruise_alt / 100),
    route: plan.route ?? "",
    alternateIcao: plan.alternate_icao ?? "",
    remarks: plan.remarks ?? "",
  });

  return send(FLIGHTPLAN_CHANNEL_ID, {
    embeds: [
      {
        title: `FPL ${plan.callsign.toUpperCase()} — ${plan.dep_icao} → ${plan.arr_icao}`,
        description: "```\n" + fpl + "\n```",
        color: 0xf0b429,
        fields: [
          { name: "Aircraft", value: plan.aircraft, inline: true },
          { name: "Operator", value: plan.airline || "Private", inline: true },
          { name: "Status", value: (plan.atc_status ?? "pending").toUpperCase(), inline: true },
          { name: "Squawk", value: plan.squawk ?? "----", inline: true },
          { name: "Off blocks", value: `<t:${Math.floor(new Date(plan.dep_time).getTime() / 1000)}:t>`, inline: true },
          { name: "ETA", value: `<t:${Math.floor(new Date(plan.arr_time).getTime() / 1000)}:t>`, inline: true },
        ],
        footer: { text: "ATC365 · ICAO-style simulation flight plan (PTFS)" },
        timestamp: new Date().toISOString(),
      },
    ],
  });
}

type AtisRow = {
  airport_icao: string;
  letter: string;
  runway_in_use: string | null;
  wind: string | null;
  visibility: string | null;
  clouds: string | null;
  temperature: string | null;
  dew_point?: string | null;
  qnh: string | null;
  approaches?: string | null;
  remarks: string | null;
};

export async function postAtisMessage(atis: AtisRow): Promise<PostResult> {
  const line = (name: string, value: string | null | undefined) =>
    value && value.trim() ? { name, value: value.trim(), inline: true } : null;

  const fields = [
    line("Runway", atis.runway_in_use),
    line("Wind", atis.wind),
    line("Visibility", atis.visibility),
    line("Clouds", atis.clouds),
    line("Temp / Dew", atis.temperature),
    line("QNH", atis.qnh),
    line("Approaches", atis.approaches),
  ].filter(Boolean);

  const text = [
    `${atis.airport_icao.toUpperCase()} INFORMATION ${atis.letter.toUpperCase()}`,
    atis.runway_in_use ? `RWY IN USE ${atis.runway_in_use}` : "",
    atis.wind ? `WIND ${atis.wind}` : "",
    atis.visibility ? `VIS ${atis.visibility}` : "",
    atis.clouds ? `CLOUD ${atis.clouds}` : "",
    atis.temperature ? `TEMP ${atis.temperature}` : "",
    atis.qnh ? `QNH ${atis.qnh}` : "",
    atis.remarks ? atis.remarks : "",
    `ADVISE ON INITIAL CONTACT YOU HAVE INFORMATION ${atis.letter.toUpperCase()}`,
  ]
    .filter(Boolean)
    .join(". ")
    .toUpperCase();

  return send(ATIS_CHANNEL_ID, {
    embeds: [
      {
        title: `${atis.airport_icao.toUpperCase()} ATIS ${atis.letter.toUpperCase()}`,
        description: "```\n" + text + "\n```",
        color: 0x2dd4bf,
        fields,
        footer: { text: "ATC365 · ATIS broadcast" },
        timestamp: new Date().toISOString(),
      },
    ],
  });
}
