# Cloud: the Game's home in Cloudflare

The cloud backend of the Quina Musical ([ADR 0003](../../docs/adr/0003-cloud-owns-the-game-laptop-owns-playback.md)): a Cloudflare Worker and **one GameRoom Durable Object per edition**, with SQLite storage and the WebSocket Hibernation API. The show laptop owns playback and keeps journalling offline. The cloud owns the Game: it takes the laptop's journal, feeds the players' phones, and exports everything as JSON.

```
show page ──(relay /ws)── laptop link ──(wss /ws/show, Access service token)──┐
                          laptop/        journal copy on disk                 │
                                                                              ▼
phones ──(wss /feed?cards=…, public, receive only)──────────────▶ Worker ─▶ GameRoom (SQLite: journal + 1 snapshot row)
consoles ─(wss /ws/console, the relay protocol, Access)──────────▶   │      commands → link → relay → show
admins ──(https /api/export, /api/stats, Access with Google)─────▶   │
player app, covers ── static assets, never through the Worker (free) ┘
```

Terms follow [GLOSSARY.md](../../GLOSSARY.md). The shared contracts are in `@quina/protocol` (`packages/protocol/`): the commands, the events, and the Game journal with `replayJournal`/`extendJournal`. The public feed for phones is [`packages/protocol/public.ts`](../../packages/protocol/public.ts).

## Run it

```sh
npm install                          # at the repo root (npm workspaces)
cd apps/cloud
cp .dev.vars.example .dev.vars      # the dev Access bypass (localhost only)
npm run dev                          # wrangler dev on http://localhost:8787 (static files: static/ only)
npm run assets                       # dist/: static/ + the UI build + cards.json + covers as JXL + JPEG (sips, cjxl)
npm run link                         # the laptop link: relay ws://localhost:5174/ws → ws://localhost:8787/ws/show
npm run media -- push                # the pool's prepared media → the cloud's private R2 (pull on a takeover laptop)
npm run media -- prune               # the bucket's pools and sizes (10 GB free); --pool NAME [--yes] deletes one
npm run preflight                    # before every rehearsal and show: a pass/warn/fail table (exits 1 on any FAIL)
npm test                             # typecheck, Node tests, workerd tests (about 10 s)
npm run loadtest -- --report reports/loadtest-$(date +%F).md   # 400 phones (about 1 min)
```

A phone in a browser console: `new WebSocket('ws://localhost:8787/feed?cards=12,123').onmessage = (e) => console.log(JSON.parse(e.data))`.

## Routes

| Route | Who | What |
|---|---|---|
| `GET /feed?cards=12,123` (WebSocket) | anyone (phones) | The public feed: a `public.state` snapshot, then `public.delta` messages. Phones send nothing. The card numbers (at most 30) feed Admin's anonymous "cards opened on phones" |
| `GET /ws/show` (WebSocket) | the laptop's Access service token | The laptop link: journal uploads, live events, a keepalive; the consoles' commands back ([`src/link-protocol.ts`](src/link-protocol.ts)) |
| `GET /ws/console` (WebSocket) | organizers (Access) | A console through the cloud, speaking the **relay protocol**: `hello` as `tablet` or `admin`, then commands. It gets the show's events raw (private ones included, as on the relay; never the journal) and a `relay.clients` list that merges the laptop's relay with the cloud's consoles. With the laptop offline, a command is refused at once as `notReady` |
| `GET`, `PUT /api/plan` | admins (Access) | The edition's Game plan (`GamePlan`, protocol/plan.ts). PUT saves it whole, checked with `checkGamePlan` and only for this edition (400 with every error otherwise). Phones get only what they may see of it in the feed (`publicPlan`: the revealed rounds' prizes, nothing of a locked round, no cheat sheet; rounds reveal with the journal's `prizes.revealed`), consoles get it whole as `relay.plan`, and the laptop link keeps a copy in `data/link/cloud-plan.json` (`{ savedAtMs, plan }`), which the relay pushes to the laptop's screens. A plan saved on the laptop with no cloud (the relay's `PUT /api/plan`) comes up as `link.plan` once the cloud is back: the newest save wins. The link also copies the plan's images (`/media/…`, with their JPEG XL) into `data/link/media/`, which the relay serves |
| `POST /api/media` | admins (Access) | Upload a sponsor logo or prize picture: the PNG or JPEG fallback (at most 300 KB; the body is the file; `?name=` optional). Answers `{ path: '/media/<key>.png', key }`, which goes in the plan; the key is its content hash, and the same file twice is stored once. WebP and SVG are refused |
| `PUT /api/media/<key>.jxl` | admins (Access) | Attach that image's JPEG XL (Admin encodes it in the browser; at most 300 KB) |
| `GET /api/media` | admins (Access) | Every uploaded pair, newest first, for Admin's picker: `{ media: [{ key, name, fallback, jxl, contentType, size, jxlSize, uploadedAtMs }] }` |
| `GET /media/<key>.<ext>` | anyone | An uploaded image, immutable (cached a year by browsers, and by Cloudflare's cache on a custom domain). `.jxl` answers with the fallback's bytes (cached 5 minutes) until the JPEG XL is uploaded, so `<picture><source type="image/jxl" srcset=".jxl"><img src=".png"></picture>` never breaks |
| `GET /api/games` | admins (Access) | The edition's Games, newest first (rehearsals, the night): last entry, rounds, which is current, and for the current one its resume point (round, kind, Shuffle seed, position, Line), to prefill a manual `resumeAt`. The seed is secret |
| `POST /api/resume` `{ gameId }` | admins (Access) | Admin's manual resume: that Game becomes current and its whole journal goes to the laptop, which writes `data/link/resume.json` for the show page's boot check |
| `GET /api/phones` | admins (Access) | Phones following the feed now, and which card numbers (anonymous): "cards opened on phones" |
| `PUT /api/notice` `{ notice }` | admins (Access) | The banner on every phone (at most 200 characters; null clears it) |
| `PUT /api/sounds` `{ soundsDefault }` | admins (Access) | The player app's default for interface sounds; a player's own choice wins |
| `GET`, `PUT /api/sync/<pool>/manifest`, `/api/sync/<pool>/file?path=` | the laptop's service token | The pool's media in the private R2 bucket (C3): the manifest (sizes and SHA-256 by sync path), and each file, which R2 stores only if its SHA-256 matches. 503 until the bucket exists |
| `GET /api/export` | admins (Access) | Every Game of the edition: journal entries, each Game replayed with the protocol's reducer, and the public state |
| `GET /api/stats` | admins (Access) | Connections, messages and SQLite rows since the GameRoom last woke |
| `GET /api/ping` | signed in (the laptop's token, or organizers) | The cloud's clock, edition and current Game: the preflight's sign-in and clock check |
| `GET /api/health` | anyone | `{ ok, edition }`, without waking the GameRoom |
| anything else | anyone | Static files from `dist/` (`npm run assets`): the player app at the root (it takes every page, such as `/26/123`), `console/`, `admin/`, `assets/`, `cards/cards.json` with `cards/card-types.json` (each printed type's name, colour, title and price), `covers/<id>.jxl` with `covers/<id>.jpg` as the fallback, and `sw.js`, which removes last year's service worker. Served without running the Worker |

## How it works

- **The journal is idempotent by `seq`** ([`src/domain/ingest.ts`](src/domain/ingest.ts)). The GameRoom extends its one snapshot row with `extendJournal`, so it never reads history back. A resent entry is skipped, a gap gets `cloud.need` (never applied out of order), and a *different* entry with a known `seq` is a `cloud.conflict` (uploads stop and a person decides). Entries are checked field by field before replay ([`journal-check.ts`](src/domain/journal-check.ts)).
- **Games inside an edition.** One GameRoom per edition (`EDITION = "26"`, the year tag in the players' links), with a current-Game pointer. A rehearsal or a `?fresh=1` show is another Game: its own journal, and the phones' rounds reset (their saved cards don't). Going back to an older Game rebuilds it from its stored entries.
- **The public feed is a whitelist** ([`src/domain/projection.ts`](src/domain/projection.ts)). An exhaustive switch over journal kinds plus named live events. It never carries the Queue, the next song, possible winners, the Phase, the real Heat, `roundEndMs`, a Check's ✓/✗ before its verdict, claim details, or winners' names. A song reaches phones only once its landing is journalled. A late upload (after an offline stretch) never stops a newer Spin. One reducer, `applyPublic`, runs in the GameRoom and on every phone; `seq` gaps make a phone resync.
- **The laptop link** ([`laptop/`](laptop)) is a Node process next to the relay, not the show page. It can send the Access service token headers, keep the journal on disk, and later download R2 media, and a cloud problem can't touch playback. It uploads one batch at a time (up to 200 entries), resends unanswered ones, reconnects with full jitter (1 s doubling to 30 s), and sends a keepalive every 20 s when idle. A newer laptop replaces it (close 4001) and it doesn't fight back.
- **Consoles through the cloud** ([`src/domain/consoles.ts`](src/domain/consoles.ts)). The cloud checks a console's command with `checkCommand` and hands it to the link, which gives it to the relay; the show checks it again. While at least one console listens through the cloud, the link forwards every event except the journal and engine health (`state` at most 4 a second); otherwise only what phones need, to save requests. The relay's client list lives in the laptop socket's attachment, so it survives hibernation. A console that has just connected sends `getState`.
- **Taking over and resuming.** The welcome names the cloud's current Game. A link whose copy is behind (a new laptop, or entries another laptop wrote) fetches the rest (`link.fetch` → `cloud.journal` chunks) into its disk copy, never over another Game. Admin's `POST /api/resume` pushes a whole Game the same way, plus `resume.json`. The relay serves the link's folder read-only at `/cloud/` (patch 0003), so the show page's boot check and the LAN screens can read the journal copy, `resume.json` and `plan.json`. Offline, the engine's `resumeAt` rebuilds a round from its Shuffle seed (journalled as `round.resumed`, which the projection shows as the round whole).
- **Media sync** (`npm run media -- push|pull`, [`laptop/media-sync.ts`](laptop/media-sync.ts)).
  - What: the pool's prepared playback files (decoded songs, stems, Signatures, analysis, overrides, covers, Hold music, effects, cards), never the Blend renders or the Spotify features. Last year's pool is 1,085 files, 6 GB.
  - How: the laptop pushes them to the private R2 bucket through the Worker, with its service token; a takeover laptop pulls them. Only changed files move, by SHA-256, with hashes cached by size and mtime (7.5 s for 6 GB). A pull writes `<file>.part`, checks its size and hash, then renames it, and never deletes anything.
  - When: once, the day before the show. Each file is one request.
- **Preflight** (`npm run preflight`, [`laptop/preflight/`](laptop/preflight)), run before every rehearsal and show. FAIL means it would hurt the show; WARN is worth a look; the exit code is 1 on any FAIL.
  - Pool: songs analysed with their audio; every song on a card playable, and every card's type in card-types.json; fanfares, effects and Hold music present; every media file re-hashed against the cloud's manifest (or the last push or pull).
  - Laptop: the audio output (Bluetooth and AirPlay fail), system and display sleep, power, disk, Chrome's autoplay flag.
  - Network: the relay and its pool; the show page connected; the console's LAN address answering.
  - Cloud: reachable; the laptop token signs in, with round trip and clock offset; the link's status file fresh and in sync; the Game and edition; the Game plan, with printed cards of every round's card type.
  It never connects as a second laptop: the link writes `data/link/status.json` every 5 s for it.
- **The Game plan** is all public (rounds, prizes, sponsors, schedule), so it lives in the public state. Saving it sends one change to every phone and a `cloud.plan` to the laptop, which also gets it on every hello. Logos are files under `/media/`, never data URLs in the plan, so a phone's snapshot stays small.
- **A silent laptop** (nothing for 50 s) is marked offline by an alarm. Phones show "Connexió perduda" after 20 s of `link.online === false`.
- **Clocks.** Every link message carries the laptop's clock; the GameRoom keeps the smallest (receive − send) as the offset. The feed's times are on the cloud's clock, and every message carries `nowMs` for the phones.
- **Access** ([`src/access.ts`](src/access.ts), adapted from coin-reader's `requireAccess`) is checked once in the Worker, before the GameRoom. It accepts multiple AUDs and fails closed. People pass on admin routes when their email is on `CF_ACCESS_EMAILS` or under `CF_ACCESS_EMAIL_DOMAIN`. The laptop's service token passes on `/ws/show` when its client ID is in `CF_ACCESS_SERVICE_TOKENS`. `ACCESS_DEV=true` only works on localhost.
- **Free plan.** Phones send nothing; there are no heartbeats except the laptop's, one snapshot row, and static files that never run the Worker. The [load test](reports/) puts a pessimistic show night at about half the daily request quota.

Every tunable is in [`src/config.ts`](src/config.ts); the phones' own are `PUBLIC_FEED` in `packages/protocol/public.ts`. Deployment, secrets and dashboard steps: [docs/deploy-plan.md](docs/deploy-plan.md). Where Platform's work stands and what comes next: [docs/HANDOFF.md](docs/HANDOFF.md).

## Layout

| Path | What |
|---|---|
| `src/worker.ts` | The Worker: Access, routing |
| `src/game-room.ts` | The Durable Object: SQLite, WebSockets, the alarm (I/O only) |
| `src/domain/` | Pure logic: journal check and ingest, the public projection, consoles (forwarding, client list), routes, clock |
| `src/link-protocol.ts` | Laptop ↔ cloud messages |
| `src/api.ts` | The HTTP API's response types |
| `laptop/` | The laptop link: `main.ts` (CLI), `link.ts`, `uploader.ts` (pure), `journal-copy.ts` (disk); the media sync: `media.ts` (CLI), `media-sync.ts`, `pool-roots.ts`; the preflight: `preflight.ts` (CLI), `preflight/checks.ts` (pure), `preflight/gather.ts` |
| `loadtest/` | `run.ts`, the night `model.ts`, `dev-server.ts`, `fake-relay.ts` |
| `scripts/assets.ts` | Builds `dist/`, the static files (gitignored: the built UI and album covers never enter the repo) |
| `static/` | The committed static files: `sw.js`, `_headers`, a placeholder page |
| `test/node/` | Pure modules, Access, the link end to end against `wrangler dev` |
| `test/worker/` | The GameRoom in workerd (`@cloudflare/vitest-plugin`), hibernation included |
| `test/support/journal-builder.ts` | Realistic journals for tests and the load test |
