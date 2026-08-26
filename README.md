# Flight Plan Companion

Download this website from the GitHub: https://github.com/fxfvdwildenberg-crypto/ptfs-radar-crew.git



I asked CHATGPT to make this:

Make it so all flightplans get sent to the flightplans channel in the Discord, the channel ID is 1513951469018021898



Do the same for ATIS the ATIS channel id is 1514326357763686611







I asked chatgpt to explain a new flightplan format to use, make it so its easier to fill in the website so pilots can easily understand, but make it so ATC sees the harder version, the Flightplan channel should also see the hard version



ATC365 ICAO Flight Plan Generator







Build an ICAO-style flight plan generator for ATC365.







1. User Interface







Create a flight plan form with these fields:







- Callsign



- Flight Rules



- Aircraft Type



- Wake Turbulence Category



- Equipment / Capabilities



- Departure Airport



- Departure Time (UTC)



- Cruising Speed



- Cruising Altitude



- Route



- Arrival Airport



- Estimated Enroute Time



- Alternate Airport



- Remarks / Other Information



- Aircraft Registration







Use dropdowns where appropriate.







Example input







Callsign: "KLM123"



Flight Rules: "IFR"



Aircraft Type: "B738"



Wake Turbulence: "M"



Equipment: "SDFGIRWXYZ"



Departure: "EHAM"



Departure Time: "10:30"



Cruising Speed: "N0450"



Cruising Altitude: "F360"



Route: "ARNEM L980 REDFA"



Arrival: "EGLL"



EET: "0055"



Alternate: "EGCC"



Remarks: "PBN/B2B3"



Registration: "PHABC"







2. Generate the ICAO-style FPL







When the user submits the form, automatically convert the fields into an ICAO-style flight plan message.







Example output:







(FPL-KLM123-IS



-B738/M-SDFGIRWXYZ/LB1



-EHAM1030



-N0450F360 ARNEM L980 REDFA



-EGLL0055 EGCC



-PBN/B2B3 REG/PHABC)







Display this in a monospace/code-style box with a Copy button.







3. Field structure







The generated message should follow this general structure:







(FPL-[CALLSIGN]-[FLIGHT RULES][TYPE OF FLIGHT]



-[AIRCRAFT TYPE]/[WAKE]-[EQUIPMENT]



-[DEPARTURE][TIME]



-[SPEED][ALTITUDE] [ROUTE]



-[ARRIVAL][EET] [ALTERNATE]



-[OTHER INFORMATION])







Do not blindly copy the example values. Generate the values dynamically from the user's form.







4. Important behavior







- Convert "IFR" to "I".



- Convert "VFR" to "V".



- Departure time must be UTC.



- Keep ICAO airport codes uppercase.



- Keep the route exactly as entered, apart from normalizing unnecessary spaces.



- Convert cruising speed into ICAO format, e.g. "450 KTS" → "N0450".



- Convert altitude into ICAO format, e.g. "FL360" → "F360".



- Do not add fields that the user left empty unless required.



- Validate ICAO airport codes as 4-letter codes.



- Validate the callsign format.



- Show clear validation errors instead of generating an invalid flight plan.







5. ATC365 presentation







Make the normal form easy for PTFS players to understand.







Have two tabs:







Flight Plan Form







A normal user-friendly form with labels such as:







"Callsign"



"Aircraft"



"Departure"



"Arrival"



"Route"



"Cruising Altitude"



etc.







ICAO FPL







Show the generated raw ICAO-style message:







(FPL-KLM123-IS



-B738/M-SDFGIRWXYZ/LB1



-EHAM1030



-N0450F360 ARNEM L980 REDFA



-EGLL0055 EGCC



-PBN/B2B3 REG/PHABC)







Add:







Copy FPL







and optionally:







Download / Export







6. Important note







This is for ATC365/PTFS simulation and should be treated as an ICAO-style representation. Do not claim that it is an officially filed real-world flight plan or that it is actually submitted to aviation authorities.







The goal is to make the ATC365 system look and behave similarly to real aviation flight-plan systems while remaining simple enough for PTFS users.



You dont have to add Estimated Enroute Time Equipment / Capabilities and Wake Turbulence Category but there should be a estimated arrival time



He responded with:

Here's where things stand.



Done this session

- Imported the updated site from `radar-companion-pro` (TFR/restricted-area system, Discord sign-in routes, updated radar/admin/flights code, assets and migrations).

- Applied the database changes: restricted-areas table with its access rules, plus new flight plan fields (flight rules, flight type, ICAO aircraft type, registration, remarks).

- Added `src/lib/fpl.ts`: ICAO FPL generator with aircraft→ICAO type/wake table, UTC time and EET formatting, speed (`N0450`) and level (`F360`) conversion, route normalisation, callsign/ICAO validation with clear per-field errors.

- Rewrote the flight plan dialog with two tabs: a pilot-friendly Flight plan form (callsign, airline, aircraft dropdown, registration, rules, type, departure/arrival, alternate, departure time, estimated arrival, cruise level/speed, route, remarks) and an ICAO FPL tab showing the generated message in a monospace box with Copy and Export buttons. Filing is blocked with readable errors until the plan is valid.

- Added the Discord relay (`src/lib/discord.server.ts` + `discord.functions.ts`): filed flight plans post the ICAO ("hard") version to channel `1513951469018021898`, and ATIS posts to `1514326357763686611`, both as embeds. Both server functions require a signed-in user and re-read the record from the database rather than trusting the client.



Remaining

1. A Discord bot token secret (`DISCORD_BOT_TOKEN`) — nothing can post to the channels without it; I'd request it via the secret prompt and the bot needs Send Messages in both channels.

2. Wire `announceAtis` into the ATIS dialog after publishing (the function exists, the call isn't hooked up yet).

3. Show the ICAO FPL in the controller views (ATC review page and flight panel) so ATC sees the hard version.

4. Typecheck + preview pass to confirm the build is clean after the import.



Please continue making it

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://flightradar365.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/cec75f02-7cb4-4fc1-84df-f09c7222d352).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
