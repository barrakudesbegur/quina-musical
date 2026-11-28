# A show with nothing installed: browsers, a phone at the mixer, a stick at the projector

Research for the user's message (28 Nov): "just a website. cant we run python with web assembly? and make a PWA that works offline. and they use a peer to peer realtime library like gun.eco (npm install gun), where we use a cloudflare worker as relay. and simply serve the websites as static. so the show page simply displays the info, and then we have a media player, that simply makes the sound based on the commands he gets, and we could even connect a phone to the jack sound system, so i dont need the laptop right next to the speaker, and i can place it where the projector is, and maybe for the projector i could even use a chromecast or similar that just opens the website and stays connected to internet, and my laptop is free to move. the only devices that would need to be close are the wii remote and the macbook … This last setup is what i've been trying to get since the beginning."

The user asked for arguments, not agreement. This report argues.

## The answer

Most of the pieces can be built, but not as "just a website", and not safely before this year's code freeze. Browsers can't act as servers. So with no laptop server, every command from the MacBook's console to a phone at the mixer has to go through the cloud, or through WebRTC links that need the internet to start and to reconnect after a reload. A 5G drop then stops the presenters controlling the music, which ADR-0003 rejected. gun.eco adds nothing we lack and loses things we need: it is last-write-wins per field, with no order and no single authority. The Durable Object and the engine's journal already give us both. Python in WebAssembly is the wrong tool for the Blend. If the Blend moves into the browser, the route is Rubber Band compiled to WASM (`rubberband-wasm` exposes R3 and the key-frame map), driven from TypeScript. The distances problem, though, has a cheap hardware answer this year: the laptop at the stage with a fibre HDMI cable to the projector, or the laptop at the projector with a long balanced audio cable to the mixer (already the recorded default in mixer-design-decisions.md › Devices). The split mode of ADR-0002 is recorded but not built. It is the one piece of the target worth building first, over the existing relay on the hotspot, and it doesn't need the internet.

## What exists today

### Where things run

- **The cloud owns the Game; the laptop owns playback** (ADR-0003, R2-Q1e). "Cloud as the hub for the live show" was rejected: "A 5G drop would stop the music being controlled." event.md › What must never fail: "the show must never stop because of it, and the music never depends on it."
- **R2-Q26 (Active): A+.** An installed show laptop (the repo, Node, the relay, the link), with media pulled from R2. "'Nothing installed' is deferred until after this year's event." On 24 Nov the orchestrator had recommended C (the browser by default, plus the installed programs). The user picked A+. The Sound engine handoff (apps/show/docs/HANDOFF.md › Decided since the pause) adds: "No WASM or browser time-stretcher".
- **Today's processes** ([laptop-app.md](laptop-app.md)): `caffeinate`, the relay (Node: pages, media from `data/`, the WebSocket hub, and Python for the Blend), the cloud link (Node), the preflight, the show page in Chrome with flags, and the console on the laptop for the Wii remote (WebHID).
- **The PA** is on a cable, never Bluetooth or AirPlay (operations.md › Where things run; night-runbook.md › Setting up 2). mixer-design-decisions.md › Devices already gives the default: "A long cable runs through a USB audio interface or DI box to the mixer on stage."

### The split mode (ADR-0002): recorded, not built

ADR-0002 (from R1-Q14) says the audio may play on a device near the mixer, with the drum elsewhere, synced by landing times announced ahead. What the code has:
- **Built:** every engine event carries epoch-ms times (`transition.scheduled` has `spinStartAtMs` and `landAtMs`; `AudioClock.ctxToEpochMs` in apps/show/engine/src/clock.ts converts with the output latency). The standalone projector `/stage/` page follows the relay and corrects its clock with `ClockOffset` (packages/rules/time.ts). The player app already draws **a drum on another device** from public landing times, with the projector's own solver (`packages/rules/drum-solver.ts`, `apps/player/logic/drum.ts`, D237).
- **Not built:** apps/show/README.md › Not done yet lists "split-device mode (ADR 0002)" under Next. The projector's drum lives only in the show page (`apps/show/engine/src/wheel/drum.ts`) and is driven by the audio clock directly (`clock.audible()` in main.ts). That goes against ADR-0002's own rule ("the drum never assumes it can read the audio clock directly"). The standalone stage has no drum. Its feed strips `drum.targetId` for privacy (apps/stage/source.ts), so a drum there couldn't land on the right card. There's no audio-only page either. The drum's ticks are audio made by the engine (`drumTick`), so in split mode they would play at the mixer device.
- **Clock sync today:** `ClockOffset` keeps the largest of the last 8 samples of (sender time − arrival time). That's fine for countdowns. Its error is the smallest one-way delay: a few ms on the hotspot, tens of ms over 5G (estimated, not measured). A drum landing needs to be within about a frame (17–33 ms) of the sound. So split mode needs a proper ping–pong sync (NTP-style, the best of several round trips), which is small work.

### The Blend: why Rubber Band runs during the show

- The engine asks the relay for a render when the next song is known (`prepareNext` in apps/show/engine/src/show/show.ts → `prepareBlend` → `blend.ts` → `POST /api/stretch` → `tools/prep/stretch.py`).
- It runs during the show because **the pair is only known then.** The render is song B's 8 bars before its hook (`LAYERING.renderBars: 8`, plus 1 after), stretched to song A's tempo. A is whatever played before B in the shuffled Queue, and B's hook is picked live (`pickHook` with the Phase, the history and a random seed).
- Pre-rendering every possible pair is too big. About 37% of ordered pairs can be beat-matched ([layering-prep.md](layering-prep.md)). With 135 songs and about 2 hooks each, that's around 13,000 renders at 6–8.5 MB each (stems, FLAC): about 80–110 GB (my estimate).
- Native cost: with stems, 1.6–1.9 s of wall time for 8+1 bars on the M1 Pro with 8 threads (layering-prep.md § 2.4).
- **It already degrades safely:** "Never rejects: without a render the planner simply does not blend" (blend.ts). With no stretcher, the night loses the Blend (drums under A, about 1 transition in 3 could have one), not the music. That still matters: the user wants fancy transitions from the first song.

### The console through the cloud

The path exists: cloud console (`/console/` behind Cloudflare Access) → `/ws/console` on the GameRoom Durable Object (apps/cloud/src/game-room.ts) → the laptop's link (`apps/cloud/laptop/link.ts`, an **outbound** WebSocket to `/ws/show` with the Access service token, so no tunnel or open port) → the relay's `/ws` → the show page. The link sends the show only `getJournal` and commands the cloud has already checked. A browser can't do the link's job as it stands: link.ts notes that the service token goes in headers, "which a browser WebSocket can't set". The journal copy, the uploads, the plan and the resume files also live on disk.

### The media

- Repertoire 2026 in R2: 2,783 files, 8.04 GB (apps/cloud/docs/HANDOFF.md, D248). The 27 Nov push broke down as: songs' cache 6.4 GB, Break music cache 1.5 GB, Hold music 0.18 GB, plus covers and data (apps/cloud/docs/deploy-plan.md).
- **The night needs nearly all of it.** Each pool's rounds shuffle the whole pool, so any of the 135 songs can land. Blends and some transitions use the stems. Signatures, snippets (for the Check), Hold music and Break music are all played.
- Everything is FLAC: a lossless copy of sources that were lossy to begin with (spotDL downloads). Re-encoding to Opus at about 160 kbps would bring it to roughly 1.2–1.5 GB (my estimate, not measured). That costs one more lossy generation, and the beat grids would need checking after the codec's start padding (unverified).
- Decoded audio is float32: about 92 MB for a 4-minute song. The engine keeps a sliding window of about 370 MB ("Bingo DJ mixer research.md" › Memory), plus decoded stems, Blend renders and the Break playlist.

## The target, piece by piece

### 1. A static PWA that works offline

**Feasible on a laptop, risky on phones.**
- **Quotas** (MDN): Chrome lets one origin use up to 60% of the disk, best-effort or persistent. Safari 17+ (macOS and iOS) allows about 60% for browser apps and home-screen apps, and about 15% in other apps' web views. Before that, Safari started at 1 GiB and asked for more. 8 GB fits on a laptop. Whether it fits on a phone depends on its free space.
- **Eviction:** best-effort data is evicted whole, least recently used origin first, when the disk runs low. `navigator.storage.persist()` exempts an origin from that. Chrome and Safari grant or refuse it silently, from the user's engagement with the site. Safari also deletes script-written data after 7 days of browser use with no tap on the site (with tracking prevention on). web.dev says this doesn't apply to installed home-screen apps; MDN doesn't say whether persistent origins are exempt. **The cached media must be checked on the day, every time,** as the preflight checks hashes today.
- **First download:** 8.04 GB is 64 Gbit, which takes about 11 minutes at 100 Mbps, 21 minutes at 50 and 36 at 30 (arithmetic; real 5G speed in the tent isn't known). With Opus (about 1.3 GB) it's 2–6 minutes. It has to happen before the night, on each device, and again after every change to the repertoire.
- **What the PWA gains:** an https page can hold a Screen Wake Lock, which the hotspot's plain-http pages can't (night-runbook.md › Setting up 3 and 6).
- **What it loses:** an https page can't open `ws://192.168.x.x` to a server on the hotspot (mixed content). Chrome 142+ has a Local Network Access permission that relaxes this for private IP addresses, but its WebSocket coverage was still behind a flag, and Safari has no such exemption. So a cloud-served PWA can't fall back to a laptop relay on the LAN. An offline path then has to be WebRTC (§3) or a page served from the LAN, as today.
- **Deploy risk:** the cloud serves the QR address and the test address from one Worker (operations.md › Where things run). A show page served from it would also change with every deploy and every service worker update. It would have to be pinned to a version, because "the relay refuses a stale build" has no equivalent in a browser.
- **Work:** medium. A service worker plus a media store in OPFS or the Cache API, filled from R2 with hash checks (Backend); the engine loading from it instead of the relay's routes (Sound engine).

### 2. Python in WebAssembly versus a JS/WASM stretcher

- **Pyodide can't load Homebrew's `librubberband.dylib`.** ctypes in Pyodide only loads WebAssembly "side modules", never a Mach-O or ELF library. Rubber Band would have to be built as an Emscripten side module. Threaded code needs a special Pyodide build. `soundfile` needs libsndfile, which exists in emscripten-forge, not in Pyodide's own packages (unverified for Pyodide). You'd download a Python runtime plus numpy (tens of MB) to call the same C library you could call from JS. **No gain; don't.**
- **Rubber Band in WASM exists:** `rubberband-wasm` 3.3.0 (Daninet, GPLv2, last published Dec 2024) wraps the whole C API, `rb_set_key_frame_map` and `rb_study` included. The R3 engine is an option flag in 3.x, as `steps/rubberband.py` uses it (`OPT_ENGINE_FINER`). Checked in its `src/rubberband.c`. It's library 3.3.0 against Homebrew's 4.0.0 today. `rubberband-web` (0.2.1, 2022) is an old realtime worklet; skip it.
- **Signalsmith Stretch** (MIT, npm `signalsmith-stretch` 1.3.2, mid-2025) is a WASM/AudioWorklet build. It "sounds best for more modest changes (between 0.75x and 1.5x)", which covers our ±8%. It has no key-frame map, but `stretch.py` already renders the mix and drums bar by bar at a constant ratio, so that part could be copied. Nobody here has compared its quality with R3. That needs a listening test.
- **Speed:** native R3 with stems is 1.6–1.9 s of wall time on 8 threads. WASM runs on one thread unless the page is cross-origin isolated. A laptop might take several seconds, and a phone tens of seconds (unverified). The render starts when the next song is known, about a song ahead, so a laptop keeps up. A phone that's also playing is the doubtful case.
- **Licence:** Rubber Band is GPL. Serving it to browsers counts as distributing it, unlike today's local use. The repo is public and MIT, which is GPL-compatible, so it can be met (or Rubber Band's commercial licence bought). Worth a line in the README.
- **Work:** medium to large for Sound engine. Port `stretch.py` and `steps/rubberband.py` (about 900 lines of Python: bar slicing, splices, "other" = mix − stems, caching) to TypeScript in a Worker. Then measure the timing again (1 ms median today) and listen.

### 3. gun.eco with a Cloudflare Worker relay, and true peer-to-peer

**gun's model doesn't fit commands.**
- gun's HAM is last-write-wins on each property, with eventual consistency. Its author: "GUN is AP and Eventually consistent", with no linearizability (gun wiki, Hacker News).
- Our commands are events that must apply once, in order, decided by the engine. «Següent» is refused `busy` while a transition runs (packages/protocol/commands.ts). That refusal is how the 2025 bug (three songs landing within 10 ms, [night-2025-data.md](night-2025-data.md)) can't come back.
- Writing "next" to a gun field merges two presses into one value and has no order. You would end up building a log with ids and an authority anyway, which is what the Durable Object and the journal already are.
- **Running gun on Workers:** community projects run gun's browser build inside a Durable Object (`openmic-relay`, memory only; `ankushKun/gun`, SQLite in the DO). One of them went down when it hit the free tier's daily SQLite write limit. Not an official path.
- **Project health:** one npm maintainer. The last npm release is 0.2020.1241 (1 Jul 2025); the one before it was April 2024. 316 open issues. Commits still land on GitHub (5 on 21 Nov 2026). It's active but run by one person.
- **What gun would really give** is peer-to-peer sync without a server. That rests on WebRTC (gun's own WebRTC adapter), which brings back the issues below.

**WebRTC between browsers:**
- **On mobile data:** carrier-grade NAT usually needs a TURN relay. Cloudflare Realtime TURN has 1,000 GB free a month, then 0.05 USD per GB. Commands are tiny, so the cost is nothing. But a TURN path goes through the internet, so it fails exactly when 5G drops.
- **On the same hotspot:** devices can connect host to host. Chrome hides local addresses behind random `.local` mDNS names when a page has no camera or microphone permission, and data-channel-only pages never ask. The other device must resolve that name by multicast on the hotspot. Nobody here has tested that on an iPhone or Android hotspot. Hotspots that isolate clients block it outright (the runbook already has a row for that).
- **When the internet drops:** a data channel already up on a host-to-host pair keeps working. ICE only needs the LAN. A channel on a TURN or server-reflexive pair breaks. The spec keeps the data channel open through ICE "failed", but an ICE restart needs a signalling message.
- **After a reload or a crash:** a new connection needs signalling. Without the internet and without a local server, the only route is copying the offer and answer by hand (for example by QR code between the two screens), every time.
- **Bottom line:** browsers on a hotspot can keep talking with no internet **only over links set up earlier that found a host-to-host path**. They can't start one or reconnect after a reload without a signalling path. The relay on the laptop is exactly that local server. It's what R2-Q26 kept.

### 4. A phone as the audio player at the mixer

- **The phone would be the engine, not a "media player".** The show page owns the state (the Queue, the Phase, the Check, the journal, auto-advance) and plays the sound (apps/show/relay/server.ts: "No game logic lives here; the show page owns the state"). Sample-accurate scheduling needs the decoded buffers in the same AudioContext as the planner. A player that "simply makes the sound based on the commands he gets" would mean splitting the engine in two. ADR-0002's design is better: the audio device runs the whole engine, and the drum and consoles follow it.
- **iOS Safari:** with the screen off, the AudioContext goes "interrupted" and the sound stops. Setting `navigator.audioSession.type = 'playback'` (iOS 17+) stops the silent switch muting it and lets it resume, but people report contexts stuck in "interrupted". The screen must stay on and the page in front for 3–4 hours.
- **Android Chrome:** with only Web Audio playing (no media element), Chrome isn't treated as playing media, and a backgrounded or screen-off tab gets frozen or muted. A Chromium bug reports `state` saying "running" after the sound had stopped, so the page can't even detect it.
- **Memory:** iOS kills a tab over its budget with no warning, then reloads it. The budget isn't documented. Developers report kills with a few hundred MB of decoded audio on iPhones. The engine's window alone is about 370 MB, before stems and Break music. This needs a real-device test with the real repertoire. Android's low-memory killer can also end Chrome's renderer.
- **Calls and notifications:** a phone's ringtone or notification sounds go out through the same output into the PA. The audio phone must be in Do Not Disturb, or in airplane mode on Wi-Fi only.
- **Output:** most phones have no headphone jack. Apple's USB-C to 3.5 mm adapter has no charging pass-through. Adapters with PD pass-through exist, and some phones refuse audio and charging together on cheap ones (unverified). A phone charging from mains while feeding the PA can hum through a ground loop, so it needs a DI box or an isolator, as the laptop does.
- **Heat and battery:** 3–4 hours with the screen on, charging, decoding and running the graph. The cold tent helps. Untested.
- **Output latency:** about 40 ms on Android phones with the low-latency path, hundreds on others (android-show-app.md). The engine already measures it (`getOutputTimestamp`, `outputLatency`; Safari 18.4+) and converts it into epoch times, so a fixed latency doesn't matter. Jitter does.
- **Clock sync with the projector's drum:** over the hotspot LAN, a ping–pong sync gets a few ms. Over the cloud, 5G jitter of tens of ms makes landings visibly off unless the sync is good (estimate). And over the cloud, the drum freezes when 5G drops.

### 5. The projector page on a Chromecast or similar

- **A Cast receiver app:** 5 USD one-time registration. Test devices run unpublished receivers. Published ones must be https. A non-media receiver needs `disableIdleTimeout`, or it closes after a few minutes idle. Google's docs say the Web Receiver is "a Chrome browser optimized for video playback", with **no WebGL**. Our drum is CSS 3D plus an SVG `feGaussianBlur` (packages/ui/ANIMATIONS.md, the drum's motion blur), not WebGL, but how a TV stick's GPU handles it isn't known. Frontend's jank pass targets a 4-year-old mid-range phone at 4× CPU slowdown; a TV stick may be slower than that (unverified).
- **Google TV (Chromecast with Google TV, Google TV Streamer):** no browser comes with it. Sideloaded or Play Store browsers (TV Bro, Firefox and others), or a kiosk browser. Chromecast with Google TV has 2 GB of RAM and a low-end chip. Fire TV ships Amazon's Silk browser. Neither has been tried here.
- **Casting a tab** from the laptop re-encodes the screen as video. That adds a variable delay and drift (unverified, likely hundreds of ms) between the drum and the sound. The display offset can't compensate for a delay that varies. Not usable for landings.
- **Staying awake:** a Cast receiver with the idle timeout off. A TV-stick browser needs the screensaver and sleep turned off.
- **On a 5G drop:** if the stick follows the cloud, the projector freezes mid-round while the music plays on, and the room sees a dead screen. If it follows a server on the hotspot, it carries on. With no laptop, there is no such server.
- **A simpler projector device:** the spare laptop, or any mini PC with Chrome in kiosk mode, on the hotspot, opening the relay's split-mode page. It's more capable than a stick, and already the kind of device the runbook knows.

### 6. Hardware that solves the same distances with less software

None of these change the code or reopen a decision.
- **Laptop at the stage (next to the mixer and the Wii remote), fibre HDMI to the projector:** active optical HDMI cables come up to 100 m. Prices found: about 150–210 USD for 50 m. 30 m costs less (not found). The light travels with no delay. They run one way only (source to display) and some need USB power at one end. A cable across a tent of 300 people must be taped down or run overhead.
- **Wireless HDMI:** the Hollyland Mars 4K quotes about 60–66 ms and 137 m line of sight (5 GHz), at about 350 USD and up. A fixed delay is fine: the engine already subtracts a calibrated display delay from the drum (`displayOffsetMs` in clock.ts, set by filming the flash-and-click test). Its risks are 5 GHz interference and a crowd blocking line of sight. Cheaper consumer kits weren't checked.
- **Laptop at the projector, long audio cable to the mixer:** a balanced cable through a DI box or a USB audio interface. This is the recorded default (mixer-design-decisions.md › Devices). It's cheap and robust. Then the Wii remote is far from the laptop (its range was at the limit in 2025, night-runbook.md › Setting up 7), and the presenters use the tablet for what the remote did. Or try the USB Bluetooth adapter on an extension cable, at a rehearsal.
- **Low-latency wireless audio:** guitar and in-ear-monitor systems on 2.4 GHz digital, such as the Xvive U2: under 6 ms, 24-bit/48 kHz, more than 70 ft (about 21 m), mono. Whether it takes line level from a laptop isn't stated (its maximum input is about +8 dBu). 2.4 GHz is shared with 300 phones' Wi-Fi and Bluetooth and with the Wii remote. Bluetooth and AirPlay stay banned for latency (operations.md).

## Failure modes on the night

What must stay powered, awake, online and loaded:

| | Today (R2-Q26) | The target |
|---|---|---|
| **For the music to play** | The laptop (relay, show page) | The audio phone (engine, its cached media, its screen on and the page in front), its DAC and charger |
| **For the drum** | The same laptop | The projector stick, plus a sync link to the audio phone |
| **For the presenters to control it** | The laptop, plus the tablet on the hotspot, or the Wii remote, or the laptop's keys | The MacBook with the Wii remote, plus a path to the audio phone (the cloud or WebRTC), plus the hotspot phone |
| **Devices that must all work** | 1 (the laptop), plus the hotspot for the tablet | 3–4 (audio phone, projector stick, MacBook, hotspot phone), plus the cloud if commands go through it |
| **5G drops** | Nothing stops. Phones pause. The tablet, the Wii remote and the keys work over the hotspot (ADR-0003) | Through the cloud: control stops, the projector freezes, and the music plays on by auto-advance with nobody able to hold or check. Over WebRTC: links already up host-to-host survive, and any reload can't reconnect until 5G is back |
| **One device crashes** | The laptop: restart, and it resumes from its journal (runbook). The spare takes over from the cloud | The audio phone: silence, then a reload; it resumes from its local journal, if iOS didn't evict it. The stick: a dead screen until it reloads, and reconnects only if online. The MacBook: the Wii remote is lost; another console works only over the cloud |
| **The hotspot phone dies** | Phone B's hotspot; the show itself carries on | Every link between the devices goes at once |

The target spreads the night over more devices, and each of them is a single point of failure for its own part. Today, one laptop is a single point of failure, but a rehearsed one, with a spare and a journal.

## Summary

| Piece of the target | State | Work | Owner | Risk for 27 Dec |
|---|---|---|---|---|
| Laptop at the stage + fibre HDMI to the projector | Not needed in code | None (buy and test a cable) | The user (hardware); runbook line by Backend | Low |
| Laptop at the projector + long balanced audio cable to the mixer | The recorded default | None (buy a cable, a DI box) | The user; runbook line by Backend | Low; the Wii remote's range is the catch |
| Wireless HDMI with the display offset calibrated | The offset exists (clock.ts) | Small (calibrate at a rehearsal) | The user; Sound engine for the calibration | Medium (5 GHz, line of sight) |
| Wireless audio link (guitar/IEM, 2.4 GHz) | — | None in code | The user | Medium (2.4 GHz crowded, mono, line level unverified) |
| Split mode over the relay on the hotspot (ADR-0002): audio-only show page, projector drum page from landing times, ping–pong clock sync | Recorded, partly built (epoch events, `/stage/`, the shared drum solver) | Medium | Sound engine (engine without drum, clock sync, protocol); Frontend (the projector's drum on epoch time, private `targetId` for that page only) | Medium if done well before the freeze; needs a rehearsal |
| Show page as a static PWA from the cloud, media in browser storage | Player app is already a PWA; the show page isn't | Medium | Backend (service worker, media store, R2 sync); Sound engine (loading) | High |
| Media re-encoded (Opus) to cut 8 GB to about 1.3 GB | — | Small to medium | Sound engine (prep), then a listening check | Medium (grids, quality) |
| Blend in the browser (`rubberband-wasm` or Signalsmith in a Worker) | — | Medium to large | Sound engine | High (timing, phone CPU, a new listening pass) |
| Python through Pyodide | — | Large, no gain | — | Don't |
| The show page talking to the cloud with no link (browser auth to `/ws/show`, journal uploads, plan and resume files in the browser) | The link does it in Node | Medium | Backend, Sound engine | High |
| Commands through the cloud as the live path | Exists (cloud console) | Small to wire | Backend | **Contradicts ADR-0003** |
| gun.eco | — | Large | — | Don't: no order, no authority |
| WebRTC on the hotspot (signalling through the DO, TURN, reconnects) | — | Large | Backend, Sound engine, Frontend | Very high; needs device tests on hotspots |
| A phone as the audio device | — | Depends on the PWA, the Blend and split mode, plus device tests | Sound engine, Frontend | Very high (lock, memory, calls, output) |
| Projector on a Cast receiver or Google TV browser | — | Medium (Cast) or small (a kiosk browser) | Frontend | High (GPU unknown; freezes on 5G drop without a local server) |
| Projector on the spare laptop or a mini PC in kiosk mode, on the hotspot | — | Needs split mode only | Frontend | Medium |

The code freeze comes after the tech rehearsal, which has no fixed date (timeline.md, D82). Anything above "Low" has to be built, rehearsed and passed before it.

## What could be done this year, cheaply

1. **Measure the venue first.** The repo doesn't record the distances between the mixer, the projector and where the presenters stand. ADR-0002 only says the mixer is on stage and the projector "far away".
2. **Solve the distance with a cable.** Either the laptop at the stage with fibre HDMI to the projector (the Wii remote and the mixer stay near), or the laptop at the projector with a balanced audio cable to the mixer (the recorded default). Test it at the tech rehearsal. No code, no decision reopened.
3. **If the user still wants the laptop free:** build ADR-0002's split mode over the **existing relay on the hotspot**. The laptop serves; a second device on the hotspot (the spare laptop or a mini PC at the projector) draws the drum from landing times. It works with no internet, so it keeps ADR-0003. It must be ready well before the tech rehearsal, or it waits.
4. **The cloud console stays the plan B away from the hotspot**, as today. It isn't the main path.

## What only after the night

These belong with R2-Q26's deferred "nothing installed":
1. The show page as a pinned-version PWA from the cloud, with its media in browser storage (Opus), on a laptop first.
2. The Blend in the browser with `rubberband-wasm` in a Worker, after a listening comparison with Signalsmith.
3. The show page talking to the cloud itself, replacing the Node link.
4. Only then a phone as the audio device. Test the lock, memory, calls, the DAC and charging and heat on the actual phone for a full 4-hour soak.
5. WebRTC on the hotspot, with signalling through the Durable Object while online, only if a server-less offline path is still wanted. Test mDNS on real hotspots first. Drop gun.eco.

## Decisions this touches

- **R2-Q26 (Active, A+):** a browser-only show is the "nothing installed" option, deferred until after this year. **Flag:** building the PWA, the in-browser Blend or the link-less show page before the night reopens it. The Sound engine handoff's "No WASM or browser time-stretcher" comes from it.
- **ADR-0003 / R2-Q1e (Active):** "Cloud as the hub for the live show" was rejected. **Flag:** sending the MacBook's commands to the audio phone through the cloud, or a projector that follows the cloud, contradicts it.
- **R2-Q1f (Active):** a simple Plan B when 5G drops. The target's offline behaviour (WebRTC links that can't reconnect) isn't simple.
- **ADR-0002 / R1-Q14 (Active):** supports a separate audio device. The target fits it, but the code doesn't yet obey its rule that the drum never reads the audio clock directly.
- **operations.md:** the PA on a cable, never Bluetooth or AirPlay. A phone with a USB-C DAC is still a cable, so it fits. A wireless audio kit is neither Bluetooth nor AirPlay, but it's new and not mentioned there.
- **D84:** no fallback versions in code. A browser-only mode alongside the laptop mode would be two ways to run the night. Split mode isn't that: it's one engine, with the drum on another device.
- **event.md › What must never fail:** "the music never depends on" the internet. A phone engine with cached media keeps that; its controls through the cloud don't.

## Questions for the user

- **The distances,** in metres: the mixer to the projector, and the presenters' spot to each of them.
- **The laptop's place on the night:** (a) at the stage, with fibre HDMI to the projector; (b) at the projector, with a long audio cable to the mixer, and the tablet doing the Wii remote's job; (c) build split mode first, with the laptop at either end and a second device at the other. Proposed: (a), because it keeps the Wii remote near and needs no code.

## Not verified

- Real 5G speed in the tent, and the time a first media download would really take.
- Opus sizes for the repertoire, and whether decoded Opus or AAC lines up with the beat grids (codec start padding).
- `rubberband-wasm`'s R3 speed on a laptop and a phone, and whether 3.3.0 matches 4.0.0's output closely enough.
- Signalsmith Stretch's quality against R3 for our ±8% Blends.
- iPhone and Android tab memory limits with the engine's real window.
- mDNS host candidates on an iPhone or Android hotspot, and hotspots' client isolation.
- Whether Chrome's Local Network Access covers `ws://` to a private IP today.
- A TV stick's frame rate on the drum's CSS 3D and SVG blur; Silk and Google TV browsers' Web Audio and kiosk options.
- Fibre HDMI prices at 30 m in Spain; consumer wireless HDMI latencies; the Xvive U2 with a laptop's line output.
- USB-C DACs with charging pass-through on specific phones, and ground-loop hum.
- Safari's 7-day eviction for persistent origins in the browser (not a home-screen app).

## Sources

- Storage: [MDN: Storage quotas and eviction criteria](https://developer.mozilla.org/en-US/docs/Web/API/Storage_API/Storage_quotas_and_eviction_criteria); [web.dev: Storage for the web](https://web.dev/articles/storage-for-the-web)
- Local network from https: [Chrome: Local Network Access prompt](https://developer.chrome.com/blog/local-network-access); [Chrome 142 release notes](https://developer.chrome.com/release-notes/142); [blink-dev: LNA and WebSockets](https://www.mail-archive.com/blink-dev@chromium.org/msg15683.html)
- Rubber Band in WASM: npm registry (`npm view rubberband-wasm`: 3.3.0, GPLv2, 2024-12-23; `rubberband-web`: 0.2.1, 2022-10-18); [Daninet/rubberband-wasm](https://github.com/Daninet/rubberband-wasm) (`build.sh`, `src/rubberband.c`); [delude88/rubberband-web](https://github.com/delude88/rubberband-web)
- Signalsmith Stretch: [GitHub](https://github.com/Signalsmith-Audio/signalsmith-stretch); npm `signalsmith-stretch` 1.3.2, MIT
- Pyodide and native libraries: [yosefk: C threads in Python/Wasm](https://yosefk.com/blog/enabling-c-threads-in-a-python-wasm-environment.html); [cactus issue 210 (ctypes can't load host libraries)](https://github.com/cactus-compute/cactus/issues/210); [emscripten-forge: libsndfile and pysoundfile](https://github.com/emscripten-forge/recipes/pull/8588)
- gun: [Conflict Resolution with Guns](https://github.com/amark/gun/wiki/Conflict-Resolution-with-Guns); [Hacker News: Show HN gun](https://news.ycombinator.com/item?id=9076558); npm `gun` release times (`npm view gun time`); GitHub API for amark/gun (open issues, latest commits); [openmic-relay](https://github.com/hectorchanht/openmic-relay); [ankushKun/gun](https://github.com/ankushKun/gun)
- WebRTC: [Cloudflare Realtime pricing](https://developers.cloudflare.com/realtime/sfu/platform/pricing/); [bloggeek: mDNS candidates](https://bloggeek.me/psa-mdns-and-local-ice-candidates-are-coming/); [discuss-webrtc: host candidate obfuscation](https://groups.google.com/g/discuss-webrtc/c/4Yggl6ZzqZk); [W3C WebRTC](https://w3c.github.io/webrtc-pc/); [WPT: data channel after ICE restart](https://searchfox.org/firefox-main/source/testing/web-platform/tests/webrtc/RTCDataChannel-iceRestart.html)
- Audio on phones: [MDN: BaseAudioContext.state](https://developer.mozilla.org/en-US/docs/Web/API/BaseAudioContext/state); [Web Audio issue 2392 (interrupted)](https://github.com/WebAudio/web-audio-api/issues/2392); [issue 2585 (stuck interrupted)](https://github.com/WebAudio/web-audio-api/issues/2585); [Apple forums: Web Audio suspended on lock](https://developer.apple.com/forums/thread/774239); [Chromium 40430666](https://issues.chromium.org/issues/40430666); [bookorbit 2124 (Android, Web Audio only)](https://github.com/bookorbit/bookorbit/issues/2124); [majo-no-tabitabi PR 59 (iPhone tab killed by decoded audio)](https://github.com/shoal-rat/majo-no-tabitabi/pull/59)
- Cast and TV sticks: [Cast registration](https://developers.google.com/cast/docs/registration); [CastReceiverOptions](https://developers.google.com/cast/docs/reference/web_receiver/cast.framework.CastReceiverOptions); [Kiosk on Chromecast](https://support.kiosk.show/articles/screens/kiosk-on-chromecast/); [9to5Google: Chromecast with Google TV performance](https://9to5google.com/2021/07/30/chromecast-google-tv-slow-tricks/); [Google TV browsers](https://www.streamingtrick.com/best-browser-for-google-tv/)
- Hardware: [50 m HDMI guide](https://electronics.alibaba.com/buyingguides/50m-hdmi-cable-guide-what-actually-works); [Projector Reviews: Bullet Train AOC](https://www.projectorreviews.com/bullet-train/bullet-train-active-optical-hdmi-cable-review/); [AVS Forum: long 4K HDMI](https://www.avsforum.com/threads/do-long-4k-hdmi-cables-that-actually-work-exist.3270706/); [B&H: Hollyland Mars 4K](https://www.bhphotovideo.com/c/product/1730376-REG/hollyland_hl_mars_4k_tx_mars_4k_wireless_video.html); [Hollyland Mars 4K](https://www.hollyland.com/product/mars-4k); [Xvive U2 manual](https://www.manualslib.com/guide/3290416/xvive-u2-guitar-wireless-system-manual.html); [zZounds: Xvive U2](https://www.zzounds.com/item--XVIU2)
- The repo: ADR-0002, ADR-0003, decision-log.md (R1-Q14, R2-Q1e, R2-Q1f, R2-Q26, D84, D248), requirements/operations.md, night-runbook.md, mixer-design-decisions.md › Devices, [laptop-app.md](laptop-app.md), [android-show-app.md](android-show-app.md), [layering-prep.md](layering-prep.md), "Bingo DJ mixer research.md", [night-2025-data.md](night-2025-data.md), apps/show/README.md, apps/show/docs/HANDOFF.md, apps/show/engine/src/{clock.ts, audio/blend.ts, show/show.ts, main.ts, wheel/drum.ts}, apps/show/relay/server.ts, tools/prep/{stretch.py, steps/rubberband.py}, apps/stage/{README.md, source.ts}, packages/rules/time.ts, packages/rules/drum-solver.ts, apps/player/logic/drum.ts, apps/cloud/laptop/link.ts, apps/cloud/src/game-room.ts, apps/cloud/docs/{HANDOFF.md, deploy-plan.md}, packages/ui/ANIMATIONS.md
