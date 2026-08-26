# ATC365 ATIS voice bot

Reads the newest ATIS of every airport on the website into a Discord voice
channel, one airport after another, looping forever. The airport list is
refetched every lap, so airports you add or delete on the website are picked up
automatically.

It uses the **same bot token** as the Discord login — no second bot needed.

## Why it can't live inside the website

Discord voice requires a permanently open gateway connection plus a UDP audio
stream. The website's backend runs on short-lived serverless requests and cannot
hold that open. So the voice part is this one small always-on process. It is a
one-time, 5-minute setup and then it runs forever on its own.

---

## Easiest setup: Railway (free trial, no server knowledge, ~5 minutes)

1. Push this project to your GitHub (it already is: `ptfs-radar-crew`).
2. Go to <https://railway.com> and sign in with GitHub.
3. **New Project → Deploy from GitHub repo →** pick your repo.
4. Open the created service → **Settings**:
   - **Root Directory**: `bots/atis-voice`
   - **Start Command**: `node index.mjs`
5. Go to **Variables** → **New Variable**:
   - Name: `DISCORD_BOT_TOKEN`
   - Value: the same bot token used for the website login
6. Click **Deploy**. Open **Logs** — you should see:

```
[atis-voice] logged in as YourBot#1234
[voice] ready
[atis-voice] reading IRFD information Hotel
```

That's it. It stays online and keeps cycling forever. If you add or delete an
airport on the website, the bot picks it up on the next lap — no redeploy.

### Discord permissions checklist (do this once)

In your Discord server, the bot needs on channel `1542190160501022881`:
- **View Channel**
- **Connect**
- **Speak**

If the channel is a **Stage** channel, also give it **Request to Speak** (the
bot un-suppresses itself automatically).

---

## Alternative hosts

Same three settings everywhere: root dir `bots/atis-voice`, start command
`node index.mjs`, env var `DISCORD_BOT_TOKEN`.

- **Fly.io** — `fly launch` inside `bots/atis-voice`, then
  `fly secrets set DISCORD_BOT_TOKEN=...`
- **Render** — New → Background Worker, root dir `bots/atis-voice`,
  build `npm install`, start `node index.mjs`
- **Your own PC / Raspberry Pi / VPS**:

```bash
cd bots/atis-voice
npm install
DISCORD_BOT_TOKEN=your_bot_token npm start
```

(On your own machine it only speaks while that terminal stays open.)

---

## Troubleshooting

| What you see | Fix |
| --- | --- |
| `DISCORD_BOT_TOKEN is required` | The variable isn't set on the host. |
| `Used disallowed intents` | Nothing to enable — this bot only uses Guilds + Voice States; re-check the token is the right bot. |
| Logs say `reading ...` but no sound | Missing **Connect**/**Speak** on the voice channel. |
| `channel is not a voice channel` | Wrong `ATIS_VOICE_CHANNEL_ID`. |
| `feed 500` / no airports | No active ATIS exists yet; the site generates one automatically per airport every 6 hours. |

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
