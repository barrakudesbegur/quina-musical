# Cloud: the Game's home in Cloudflare

The cloud backend of the Quina Musical ([ADR 0003](../../../docs/adr/0003-cloud-owns-the-game-laptop-owns-playback.md)): a Cloudflare Worker and **one GameRoom Durable Object per edition**, with SQLite storage and the WebSocket Hibernation API. The show laptop owns playback and keeps journalling offline. The cloud owns the Game: it takes the laptop's journal, feeds the players' phones, and exports everything as JSON.

```
show page ──(relay /ws)── laptop link ──(wss /ws/show, Access service token)──┐
                          laptop/        journal copy on disk                 │
                                                                              ▼
phones ──(wss /feed?cards=…, public, receive only)──────────────▶ Worker ─▶ GameRoom (SQLite: journal + 1 snapshot row)
consoles ─(wss /ws/console, the relay protocol, Access)──────────▶   │      commands → link → relay → show
admins ──(https /api/export, /api/stats, Access with Google)─────▶   │
player app, covers ── static assets, never through the Worker (free) ┘
```

Terms follow [GLOSSARY.md](../../../GLOSSARY.md). The shared contracts are in `@quina/protocol` (`../protocol/`): the commands, the events, and the Game journal with `replayJournal`/`extendJournal`. The public feed for phones is drafted here as [`src/feed/public.ts`](src/feed/public.ts) and moves into the protocol once it's merged.

## Run it

```sh
cd experiments/mixer-poc/cloud
npm install
cp .dev.vars.example .dev.vars      # the dev Access bypass (localhost only)
npm run dev                          # wrangler dev on http://localhost:8787
npm run link                         # the laptop link: relay ws://localhost:5174/ws → ws://localhost:8787/ws/show
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
| `GET`, `PUT /api/plan` | admins (Access) | The edition's Game plan (`GamePlan`, protocol/plan.ts). PUT saves it whole, checked with `checkGamePlan` and only for this edition (400 with every error otherwise). Phones get it in the feed, and the laptop link keeps a copy in `laptop-data/plan.json` |
| `POST /api/media` | admins (Access) | Upload a sponsor logo or prize picture (WebP, PNG or JPEG, at most 300 KB; the body is the file). Answers `{ path: '/media/<hash>.webp' }`, which goes in the plan. The same file twice is stored once |
| `GET /media/<hash>.<ext>` | anyone | An uploaded image, immutable (cached a year by browsers, and by Cloudflare's cache on a custom domain) |
| `GET /api/export` | admins (Access) | Every Game of the edition: journal entries, each Game replayed with the protocol's reducer, and the public state |
| `GET /api/stats` | admins (Access) | Connections, messages and SQLite rows since the GameRoom last woke |
| `GET /api/health` | anyone | `{ ok, edition }`, without waking the GameRoom |
| anything else | anyone | Static files from `public/` (the player app and covers later), served without running the Worker |

## How it works

- **The journal is idempotent by `seq`** ([`src/domain/ingest.ts`](src/domain/ingest.ts)). The GameRoom extends its one snapshot row with `extendJournal`, so it never reads history back. A resent entry is skipped, a gap gets `cloud.need` (never applied out of order), and a *different* entry with a known `seq` is a `cloud.conflict` (uploads stop and a person decides). Entries are checked field by field before replay ([`journal-check.ts`](src/domain/journal-check.ts)).
- **Games inside an edition.** One GameRoom per edition (`EDITION = "26"`, the year tag in the players' links), with a current-Game pointer. A rehearsal or a `?fresh=1` show is another Game: its own journal, and the phones' rounds reset (their saved cards don't). Going back to an older Game rebuilds it from its stored entries.
- **The public feed is a whitelist** ([`src/domain/projection.ts`](src/domain/projection.ts)). An exhaustive switch over journal kinds plus named live events. It never carries the Queue, the next song, possible winners, the Phase, the real Heat, `roundEndMs`, a Check's ✓/✗ before its verdict, claim details, or winners' names. A song reaches phones only once its landing is journalled. A late upload (after an offline stretch) never stops a newer Spin. One reducer, `applyPublic`, runs in the GameRoom and on every phone; `seq` gaps make a phone resync.
- **The laptop link** ([`laptop/`](laptop)) is a Node process next to the relay, not the show page. It can send the Access service token headers, keep the journal on disk, and later download R2 media, and a cloud problem can't touch playback. It uploads one batch at a time (up to 200 entries), resends unanswered ones, reconnects with full jitter (1 s doubling to 30 s), and sends a keepalive every 20 s when idle. A newer laptop replaces it (close 4001) and it doesn't fight back.
- **Consoles through the cloud** ([`src/domain/consoles.ts`](src/domain/consoles.ts)). The cloud checks a console's command with `checkCommand` and hands it to the link, which gives it to the relay; the show checks it again. While at least one console listens through the cloud, the link forwards every event except the journal and engine health (`state` at most 4 a second); otherwise only what phones need, to save requests. The relay's client list lives in the laptop socket's attachment, so it survives hibernation. A console that has just connected sends `getState`.
- **The Game plan** is all public (rounds, prizes, sponsors, schedule), so it lives in the public state. Saving it sends one change to every phone and a `cloud.plan` to the laptop, which also gets it on every hello. Logos are files under `/media/`, never data URLs in the plan, so a phone's snapshot stays small.
- **A silent laptop** (nothing for 50 s) is marked offline by an alarm. Phones show "Connexió perduda" after 20 s of `link.online === false`.
- **Clocks.** Every link message carries the laptop's clock; the GameRoom keeps the smallest (receive − send) as the offset. The feed's times are on the cloud's clock, and every message carries `nowMs` for the phones.
- **Access** ([`src/access.ts`](src/access.ts), adapted from coin-reader's `requireAccess`) is checked once in the Worker, before the GameRoom. It accepts multiple AUDs and fails closed. People pass on admin routes when their email is on `CF_ACCESS_EMAILS` or under `CF_ACCESS_EMAIL_DOMAIN`. The laptop's service token passes on `/ws/show` when its client ID is in `CF_ACCESS_SERVICE_TOKENS`. `ACCESS_DEV=true` only works on localhost.
- **Free plan.** Phones send nothing; there are no heartbeats except the laptop's, one snapshot row, and static files that never run the Worker. The [load test](reports/) puts a pessimistic show night at about half the daily request quota.

Every tunable is in [`src/config.ts`](src/config.ts); the phones' own are `PUBLIC_FEED` in `src/feed/public.ts`. Deployment, secrets and dashboard steps: [docs/deploy-plan.md](docs/deploy-plan.md).

## Layout

| Path | What |
|---|---|
| `src/worker.ts` | The Worker: Access, routing |
| `src/game-room.ts` | The Durable Object: SQLite, WebSockets, the alarm (I/O only) |
| `src/domain/` | Pure logic: journal check and ingest, the public projection, consoles (forwarding, client list), routes, clock |
| `src/feed/public.ts` | The public feed contract (draft of `protocol/public.ts`) |
| `src/link-protocol.ts` | Laptop ↔ cloud messages |
| `src/api.ts` | The HTTP API's response types |
| `laptop/` | The laptop link: `main.ts` (CLI), `link.ts`, `uploader.ts` (pure), `journal-copy.ts` (disk) |
| `loadtest/` | `run.ts`, the night `model.ts`, `dev-server.ts`, `fake-relay.ts` |
| `test/node/` | Pure modules, Access, the link end to end against `wrangler dev` |
| `test/worker/` | The GameRoom in workerd (`@cloudflare/vitest-plugin`), hibernation included |
| `test/support/journal-builder.ts` | Realistic journals for tests and the load test |
