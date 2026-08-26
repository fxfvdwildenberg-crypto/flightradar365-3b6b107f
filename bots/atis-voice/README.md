# ATC365 ATIS voice bot

Reads the newest ATIS of every airport on the website into a Discord voice
channel, one airport after another, looping forever. The airport list is
refetched every lap, so airports you add or delete on the website are picked up
automatically.

It uses the **same bot token** as the Discord login — no second bot needed.

## Why it isn't part of the website

Discord voice requires a permanently open gateway connection plus a UDP audio
stream. The website's backend runs on short-lived serverless requests and cannot
hold that open, so the voice part runs as this small always-on process.

## Setup

1. In the Discord Developer Portal, make sure the bot is in your server and has
   **Connect** + **Speak** on channel `1542190160501022881`.
2. Run it anywhere that stays online (VPS, Railway, Fly.io, a Raspberry Pi):

```bash
cd bots/atis-voice
npm install
DISCORD_BOT_TOKEN=your_bot_token npm start
```

## Options (environment variables)

| Variable | Default | Meaning |
| --- | --- | --- |
| `DISCORD_BOT_TOKEN` | — | required, same token as the login bot |
| `ATIS_VOICE_CHANNEL_ID` | `1542190160501022881` | voice channel to sit in |
| `ATIS_FEED_URL` | `https://flightradar365.lovable.app/api/public/atis/current` | ATIS feed |
| `ATIS_GAP_MS` | `2000` | silence between airports |
| `ATIS_CYCLE_GAP_MS` | `5000` | silence after a full loop |

## Feed

`GET /api/public/atis/current` returns:

```json
{
  "count": 2,
  "broadcasts": [
    { "icao": "IDCS", "letter": "H", "text": "IDCS Information Hotel. Time 1505 Zulu. ..." }
  ]
}
```

Only the standard broadcast sentence is spoken — exactly the wording shown on
the website and in the ATIS Discord channel.
