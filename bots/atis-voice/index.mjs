/**
 * ATC365 ATIS voice bot.
 *
 * Joins one Discord voice channel and reads the newest ATIS of every airport on
 * the website, one after another, then loops forever. The airport list is
 * refetched on every cycle, so new airports appear and deleted ones disappear
 * without restarting the bot.
 *
 * Discord voice needs a long-lived gateway + UDP audio connection, which the
 * website's serverless backend cannot hold open — that is why this piece runs
 * as its own tiny process. It uses the SAME bot token as the Discord login.
 *
 * Run:
 *   cd bots/atis-voice
 *   npm install
 *   DISCORD_BOT_TOKEN=... npm start
 */

import {
  Client,
  GatewayIntentBits,
  ChannelType,
} from "discord.js";
import {
  joinVoiceChannel,
  createAudioPlayer,
  createAudioResource,
  entersState,
  AudioPlayerStatus,
  VoiceConnectionStatus,
  NoSubscriberBehavior,
  StreamType,
} from "@discordjs/voice";

const TOKEN = process.env.DISCORD_BOT_TOKEN;
const VOICE_CHANNEL_ID = process.env.ATIS_VOICE_CHANNEL_ID || "1542190160501022881";
const FEED_URL =
  process.env.ATIS_FEED_URL || "https://flightradar365.lovable.app/api/public/atis/current";
/** Pause between two airport broadcasts, ms. */
const GAP_MS = Number(process.env.ATIS_GAP_MS || 2000);
/** Pause after a full cycle, ms. */
const CYCLE_GAP_MS = Number(process.env.ATIS_CYCLE_GAP_MS || 5000);

if (!TOKEN) {
  console.error("DISCORD_BOT_TOKEN is required");
  process.exit(1);
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Text-to-speech audio for one chunk (<=200 chars) of the broadcast. */
async function speechStream(text) {
  const url =
    "https://translate.google.com/translate_tts?ie=UTF-8&client=tw-ob&tl=en&q=" +
    encodeURIComponent(text);
  const res = await fetch(url, {
    headers: { "user-agent": "Mozilla/5.0", referer: "https://translate.google.com/" },
  });
  if (!res.ok) throw new Error(`tts ${res.status}`);
  return Buffer.from(await res.arrayBuffer());
}

/** Google TTS caps each request, so split on sentences. */
function chunk(text, limit = 190) {
  const sentences = text.match(/[^.!?]+[.!?]*/g) ?? [text];
  const out = [];
  let current = "";
  for (const s of sentences) {
    const piece = s.trim();
    if (!piece) continue;
    if ((current + " " + piece).trim().length > limit) {
      if (current) out.push(current.trim());
      current = piece;
    } else {
      current = (current + " " + piece).trim();
    }
  }
  if (current) out.push(current);
  return out;
}

async function fetchBroadcasts() {
  const res = await fetch(FEED_URL, { headers: { accept: "application/json" } });
  if (!res.ok) throw new Error(`feed ${res.status}`);
  const json = await res.json();
  return Array.isArray(json.broadcasts) ? json.broadcasts : [];
}

const player = createAudioPlayer({
  behaviors: { noSubscriber: NoSubscriberBehavior.Play },
});
player.on("error", (e) => console.error("[player]", e.message));

async function play(buffer) {
  const { Readable } = await import("node:stream");
  const resource = createAudioResource(Readable.from(buffer), {
    inputType: StreamType.Arbitrary,
  });
  player.play(resource);
  await entersState(player, AudioPlayerStatus.Playing, 15_000);
  await entersState(player, AudioPlayerStatus.Idle, 5 * 60_000);
}

const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildVoiceStates] });

client.once("clientReady", async () => {
  console.log(`[atis-voice] logged in as ${client.user.tag}`);

  const channel = await client.channels.fetch(VOICE_CHANNEL_ID);
  if (!channel || (channel.type !== ChannelType.GuildVoice && channel.type !== ChannelType.GuildStageVoice)) {
    console.error("[atis-voice] channel is not a voice channel");
    process.exit(1);
  }

  const connection = joinVoiceChannel({
    channelId: channel.id,
    guildId: channel.guild.id,
    adapterCreator: channel.guild.voiceAdapterCreator,
    selfDeaf: true,
  });
  connection.on("stateChange", (_, to) => console.log(`[voice] ${to.status}`));
  connection.on(VoiceConnectionStatus.Disconnected, async () => {
    try {
      await entersState(connection, VoiceConnectionStatus.Connecting, 5_000);
    } catch {
      connection.destroy();
      process.exit(1);
    }
  });
  await entersState(connection, VoiceConnectionStatus.Ready, 30_000);
  connection.subscribe(player);
  if (channel.type === ChannelType.GuildStageVoice) {
    await channel.guild.members.me.voice.setSuppressed(false).catch(() => {});
  }

  // Cycle forever, refetching the airport list every lap.
  for (;;) {
    let broadcasts = [];
    try {
      broadcasts = await fetchBroadcasts();
    } catch (e) {
      console.error("[atis-voice] feed failed:", e.message);
    }

    if (broadcasts.length === 0) {
      await sleep(30_000);
      continue;
    }

    for (const b of broadcasts) {
      console.log(`[atis-voice] reading ${b.icao} information ${b.letter}`);
      for (const part of chunk(b.text)) {
        try {
          await play(await speechStream(part));
        } catch (e) {
          console.error(`[atis-voice] ${b.icao} playback failed:`, e.message);
        }
      }
      await sleep(GAP_MS);
    }
    await sleep(CYCLE_GAP_MS);
  }
});

client.login(TOKEN);
