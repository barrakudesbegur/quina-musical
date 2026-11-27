# Deploy plan: the cloud on Cloudflare

What gets deployed, what this session changed in the Cloudflare account, and what needs the user. No secret, token, AUD tag or account ID is written here or anywhere in git: they go in with `wrangler secret put`, or in the gitignored `.dev.vars` and `.env.link`.

Guard-rails (from the user, through the orchestrator, 2026-11-24): never touch existing DNS records or projects (`quina` is still the old app on GitHub Pages, `fitxes` is coin-reader). Deploy to `*.workers.dev` or a NEW subdomain. Free plan only. Private R2 bucket only. Moving `quina.barrakudesbegur.org` to the new app needed the user's explicit OK: given on 2026-11-25 (D76), and done (step 7).

## What gets deployed

| Piece | Name | Notes |
|---|---|---|
| Worker | `quina-cloud` | `src/worker.ts`; about 87 KiB (23 KiB gzipped) |
| Durable Object class | `GameRoom` (SQLite) | migration `v1` (`new_sqlite_classes`); one object per edition, named `edition:26`, placed in western Europe |
| Static assets | `dist/`, built by `npm run assets` | `static/` (the kill switch for last year's service worker, `_headers`), plus the UI build: the player at the root (the SPA fallback serves it for `/26/123`), `console/`, `admin/` and `assets/`; plus `cards/cards.json` and the covers as 256 px JPEG XL (about 15 KB each) with a JPEG fallback (about 27 KB). No `stage/`: the projector runs on the laptop. Static files are free and never run the Worker. `dist/` is gitignored |
| Variable | `EDITION = "26"` | in wrangler.jsonc |
| Secrets | `CF_ACCESS_TEAM_DOMAIN`, `CF_ACCESS_AUD`, `CF_ACCESS_EMAILS` (or `CF_ACCESS_EMAIL_DOMAIN`), `CF_ACCESS_SERVICE_TOKENS` | `wrangler secret put`; until they exist, every admin route and the laptop route answer 403 (fail-closed), and only `/feed` and `/api/health` work |

`ACCESS_DEV` is never set in Cloudflare: it lives in `.dev.vars` only, and the Worker honours it only on localhost anyway.

## Done

| When | What | Where | How to undo |
|---|---|---|---|
| 2026-11-24 | The user logged wrangler in (`wrangler login`, OAuth) | this Mac, machine-wide | `npx wrangler logout` |
| 2026-11-24 | Read-only checks: `wrangler whoami`; `wrangler deployments list --name quina-cloud` (no Worker of that name existed, so a deploy overwrote nothing); `wrangler deploy --dry-run` | none | nothing to undo |
| 2026-11-24 | **Deployed the Worker `quina-cloud`** (version `27b8ce0a`), after the user allowed `npx wrangler deploy`: the GameRoom Durable Object class (SQLite, migration `v1`) and 121 static files (the player at the root, console, Admin, `cards.json` and the covers as WebP, all from last year's test pool). No secrets yet, so every admin and laptop route answers 403 and only the phone feed and `/api/health` work. Checked on the edge: a phone gets its snapshot in about 0.7 s. | https://quina-cloud.barrakudes.workers.dev (workers.dev only: no DNS record, no zone change) | `npx wrangler rollback` (the previous version), or `npx wrangler delete quina-cloud`, which also deletes the GameRoom's data (export first) |

| 2026-11-24 | Redeployed (version `61d29019`) with the UI build of c3770c8: the player never takes the relay in production, masked resume codes, relay pairing, Admin's plan B. Checked live: every page's assets load, the locked routes still answer 403, a phone gets its snapshot. | the same Worker | `npx wrangler rollback` |
| 2026-11-24 | Redeployed (version `ca93f44c`): the Worker with the `relay.plan` push and `link.plan` (12c9f40), the UI build of 60f9d12 (the repo reorganisation), and the covers as JPEG XL with a JPEG fallback (`/covers/<id>.jxl` and `.jpg`, 256 px, `image/jxl` set in `_headers`). The old `.webp` covers stay until the player that uses `<picture>` is deployed. Checked live: the three cover types, `/api/health`, `/sw.js`, the cards and the player answer. | the same Worker | `npx wrangler rollback` |
| 2026-11-24 | Redeployed (version `a03d0bcb`): logos and prize pictures as JPEG XL pairs (`POST /api/media` takes the PNG or JPEG fallback, `PUT /api/media/<key>.jxl` its JXL, `GET /api/media` lists them; WebP uploads refused; the GameRoom's `media` table gained a `name` column and a `media_jxl` table, added in place), the UI build of c4bc94c (the player's covers as `<picture>`, JXL first), and no more WebP covers. Checked live: `.jxl` and `.jpg` covers, `/api/health`, the player. | the same Worker (the two schema additions stay on a rollback, unused) | `npx wrangler rollback` |
| 2026-11-24 | **Added the Custom Domain `quina-dev.barrakudesbegur.org`** to the Worker, with the user's direct OK in this session (`routes` in wrangler.jsonc, applied with `npx wrangler triggers deploy`: no new version). Before: no record of that name existed (checked with dig). Cloudflare created that one record and its certificate; nothing else in the zone changed. Checked live: `/api/health` 200, the player and covers answer, `/api/plan` and `/api/stats` refuse (403) until Access is set up. workers.dev keeps working. | the zone `barrakudesbegur.org`: one new DNS record; the Worker's domains | remove the `routes` line and run `npx wrangler triggers deploy`, or delete the domain under Workers & Pages → quina-cloud → Settings → Domains & Routes |
| 2026-11-24 | **Cloudflare Access set up**, with the user's direct OK in this session ("anyone with a @barrakudesbegur.org", like the other apps), through the API with the token in `~/.config/quina/cloudflare-access-token`. Reused the team `barrakudesbegur.cloudflareaccess.com`, its Google login ("Compte personal Barrakudes") and the account's reusable policy "Is Barrakudes official email" (email domain `barrakudesbegur.org`), as Fitxes does. Created: the service token **`quina-laptop`** (expires 2027-11-24; its ID and secret are only in `apps/cloud/.env.link` on this Mac, mode 600, gitignored); the app **`quina-cloud organizers`** (`/api`, `/ws/console`, `/console`, `/admin`: Google, that policy, plus a Service Auth policy for `quina-laptop` so the laptop reaches `/api/ping` and `/api/sync`); the app **`quina-cloud laptop`** (`/ws/show`: Service Auth for `quina-laptop` only); the app **`quina-cloud health (public)`** (`/api/health`: Bypass, everyone). The Worker's secrets (`wrangler secret bulk`): `CF_ACCESS_TEAM_DOMAIN`, `CF_ACCESS_AUD` (the two apps' AUD tags), `CF_ACCESS_EMAIL_DOMAIN=barrakudesbegur.org`, `CF_ACCESS_SERVICE_TOKENS` (the token's client ID). Checked live: `/api/stats`, `/console/` and `/admin/` redirect to the Google login; `/api/health`, the player and the covers stay public; the laptop's token gets `/api/ping` (200) and the link's `/ws/show` (welcome), but not the people-only `/api/plan` (403); `/ws/show` without it is refused. | Zero Trust: 1 service token, 3 applications (the reusable policy is only referenced, unchanged); the Worker: 4 secrets (a new version with the same code) | delete the three applications and the service token in Zero Trust; `npx wrangler secret delete <NAME>` for each secret |
| 2026-11-24 | **Created the R2 bucket `quina-media`** (location `weur`), after the user enabled R2. Private: no `r2.dev` access, no custom domain (checked). The Worker's binding stays commented out in wrangler.jsonc until the next deploy of a coherent build (the screens' plan v2 migration): uncomment it then and `npm run deploy`. | R2: 1 empty bucket | `npx wrangler r2 bucket delete quina-media` (empty it first) |
| 2026-11-24 | Redeployed (version `897f5e72`): the R2 binding on (`MEDIA` → `quina-media`), prize secrecy in the public feed (6fbbc32), the laptop's service token may read the plan (`GET /api/plan`, never save it), and the UI build of 4942b87 (plan v2 on every screen), built from a clean checkout. Checked live: `/api/sync/default/manifest` answers (empty), the laptop's token reads the plan (200) and can't save it (403), Admin's routes still ask for the Google login, the player and covers answer. | the same Worker | `npx wrangler rollback` (the binding goes with the version) |
| 2026-11-25 | Redeployed (version `82c1b157`) with a coherent build of main at `b73e864`, built in a clean worktree: the daily usage report (`/api/stats`, 15e4e8d), the bucket's pool list and prune (`/api/sync`, 94bc4f1), and the UI build with the console, Wii and projector work. Checked live: `/api/health`, the player at `/` and `/26/123`, `.jxl`/`.jpg` covers, `cards.json`, `/sw.js`; `/console/`, `/admin/`, `/api/stats` and `/api/plan` send people to the Google login; the laptop's token gets `/api/ping`, today's usage from `/api/stats`, the pool list from `/api/sync` (`default`, 6.6 GB) and the plan; a phone's `/feed` snapshot in about 0.3 s. | the same Worker | `npx wrangler rollback` (to `897f5e72`) |
| 2026-11-25 | Redeployed (version `ee41deae`) with a coherent build of main at `cbcc1d3`, built in a clean worktree: card type per round (the GameRoom reads its stored plan through `checkGamePlan`, so the live v2 plan now gives each round its `cardType`; `cards/card-types.json` served; the feed's rounds and intro carry `cardType`) and the Desgraciat round's cloud side (`desgraciat` and `standing` accepted in the journal, so Sound engine's step C may journal them). Checked live: `/api/health`, the player, `card-types.json` and `cards.json`, covers; `/console/`, `/admin/` and `/api/plan` send people to the Google login; the laptop's token reads the plan (each round with its `cardType`) and `/api/stats`; a phone's snapshot (rounds with `cardType`) in about 0.4 s. | the same Worker | `npx wrangler rollback` (to `82c1b157`; the plan in storage is unchanged, since the migration happens on read) |
| 2026-11-25 | Redeployed (version `3095a797`) with main at `ebf1a5d` (card type per round, step C: plan version 3, the card types list gone), built in a clean worktree. Checked live: the stored plan now reads as v3, with no `cardTypes` and round 1's `cardType` kept (`normal`), for the laptop's token and in phones' public plan; `/api/health`, the player, `card-types.json`, covers; `/console/`, `/admin/` and `/api/plan` send people to the Google login. | the same Worker | `npx wrangler rollback` (to `ee41deae`, which reads the same stored plan as v2) |
| 2026-11-25 | Redeployed twice from clean worktrees, for two bugs a live Desgraciat run on quina-dev found: version `84eecefc` (`5ed3a84`: phones see round 1's intro, which the engine's boot-time `round.started` had hidden) and version `ce77e303` (`92002a6`: the cloud takes a `standing` Check's live event, so phones see the Desgraciat Check). Then `tools/e2e/desgraciat-live.spec.ts` passed against it: a whole Desgraciat round with a phone following, every landing, the intro, the Check, the `standing` winner, the round's end, the link's journal all in the cloud, nothing refused, nothing private. The run left its rehearsal Game as quina-dev's current Game. | the same Worker | `npx wrangler rollback` (to `3095a797`) |
| 2026-11-25 | Redeployed (version `179f45ed`) with main at `d218b3e`: Frontend's Desgraciat player and projector. Before it, `npm test` and the whole-show e2e passed on that commit in a clean worktree. Then the live Desgraciat run passed against it: "Quina Desgraciada", DEMPEUS and ASSEGUT cards, the Check banner, the "DEMPEUS!" Celebration. | the same Worker | `npx wrangler rollback` (to `ce77e303`) |
| 2026-11-25 | Redeployed (version `8d2b8696`) with main at `809c924` (the player's reel gets `data-testid="reel"`); `npm test` passed on that commit in a clean worktree first. The live Desgraciat run passed against it: the phone's reel showed every landing within 2 s, and the phone holding the winning card (added from its `/26/<card>` link) showed "Dempeus fins al final!". | the same Worker | `npx wrangler rollback` (to `179f45ed`) |
| 2026-11-25 | Redeployed twice from clean worktrees. First version `b5e5ac38` (`28abef7`): the cloud's side of the shared Desgraciat win, the winner's slip and the Check's result (`flaggedDecisions` in Admin's Games and the export), and the preflight's card prices. Then version `81e0d0ad` (`2e37fc1`, origin's head): the same, plus Frontend's card prices by round, Admin's planned breaks and the Última volta switch. `npm test` passed on both commits, and the e2e on `cf9666c`. Checked live: `/api/health`, the player, `card-types.json`, `/admin/` asks for the Google login, the laptop's token gets `/api/ping`. | the same Worker | `npx wrangler rollback` (to `8d2b8696`) |
| 2026-11-25 | **`quina.barrakudesbegur.org` now points at the Worker** (step 7), with the user's OK (D76, then confirmed directly in this session). At 14:15 UTC Cloudflare refused the Custom Domain while the old record existed ("externally managed DNS records", code 100117: wrangler's override covers only records Workers manage), and nothing changed. The user deleted the `quina` CNAME (→ `barrakudesbegur.github.io`) in the dashboard. At 14:20 UTC `npx wrangler triggers deploy` attached the name (no new version), and Cloudflare created its record (proxied) and certificate. Then the repository's Pages custom domain was removed (`gh api … pages` with `cname: null`), so last year's app is at `https://barrakudesbegur.github.io/quina-musical/`. Checked live through Cloudflare: `server: cloudflare`; `/api/health` 200; `/26/123` adds card 123 on a phone-sized Chrome, and `/?c=123` shows "Aquest cartró és de l'any passat"; `/sw.js` is the kill switch; `cards/card-types.json` answers; `/api/stats` and `/api/plan` answer 403 (fail-closed: no Access destinations on this name yet); the `/admin/` and `/console/` page shells load. Downtime: about 2 minutes, plus DNS caches (TTL 5 min). | the zone: the `quina` record (now the Worker's); the Worker's domains; GitHub Pages: no custom domain | see step 7's undo |
| 2026-11-25 | Redeployed (version `87650e0c`) from `f1aacdd`, built in a clean worktree where `npm test` passed. It serves both names: Sound engine's D70 flip (the Desgraciat plays especial cards by default), Frontend's D70 player, and this year's provisional title and prices in `card-types.json` (1.50 € a round, 5 € the special card; D67, D69). Checked on both names: `/api/health`, `/26/123`, `card-types.json` with the prices; on quina-dev, `/admin/` and `/api/plan` send people to the Google login; on the QR name, `/api/plan` answers 403. A phone's snapshot arrives in about 0.3 s. Then the live Desgraciat run passed against quina-dev (3.4 min) with especial cards 400–429 in play. | the same Worker (both names) | `npx wrangler rollback` (to `81e0d0ad`) |
| 2026-11-25 | **Last year's API removed (D86).** The user deleted the DNS record `quina-api` (a proxied CNAME to the Cloudflare Tunnel of the 2025 server, answering 521 since that server is off; only last year's app called it, through `VITE_API_URL`). Then, with the user's direct OK, `npx wrangler tunnel delete quina-api` deleted its tunnel (created 2024-12-26, status down) at 15:18 UTC. The account now has no tunnels. | the zone: the `quina-api` record; Zero Trust: the `quina-api` tunnel | not needed: last year's server would need a new tunnel and record anyway (`cloudflared tunnel create`, then a CNAME to `<id>.cfargotunnel.com`) |
| 2026-11-26 | Redeployed (version `79988575`) from `a1e9b17`, after `npm test` passed on it in a clean worktree: the cloud accepts the media sync's two new shared roots, `interval-cache` and `interval-data` (the Interval music, like the Hold music's). Then `npm run media -- push` (pool `default`) uploaded the new Interval music and this year's card files (115 files, 361.9 MB, D113). With `6397550`, the push leaves out `cache/relay-token`, `cache/tools` and `data/listen-demo`. The relay token had been in the private bucket since 24 Nov, so `npx wrangler r2 object delete quina-media/pools/default/files/cache/relay-token --remote` removed it. The old Interval files and other paths that left the manifest stay in the bucket until the pool is pruned (prune deletes by prefix). | the Worker (both names); R2: `pools/default` | `npx wrangler rollback` (to `87650e0c`, which refuses the new roots); the R2 files go with a prune of the pool |
| 2026-11-26 | Redeployed (version `94b395be`) from `2503050`, on its own ahead of the held paced-Check range: the cloud now saves every plan edit. Before, an edit that changes nothing public (a locked round's prizes, the cheat sheet) stayed in memory only and was lost when the GameRoom restarted (U126: check Admin's later rounds and cheat sheet). Tested on that sha in a clean worktree: cloud tests (81 node, 31 workerd, with a new restart test) and the e2e (show.spec). The auto-mode check refused the first deploy; the user approved it, and wants deploys like this done without waiting. After it: both names answer, `/api/ping` on quina-dev 200 (`/api` on quina.barrakudesbegur.org stays 403 until step 7.4), the stored plan intact. | the Worker (both names) | `npx wrangler rollback` (to `79988575`, which has the bug) |
| 2026-11-26 | Redeployed (version `fddfdc1d`) from `a89826f`, step 1 of the presenter-paced Check, before any engine journals its kinds: the cloud takes `claim.reviewing`, `claim.continued`, `claim.discarded` and `claim.decided { manual: true }`; a discard clears the phones' pending Check; flaggedDecisions flags `notPassing` and `notSold`. Tested on that sha in a clean worktree first: cloud tests 86 node + 31 workerd, the e2e (show.spec). Both names answer; `/api/ping` 200; the plan intact. | the Worker (both names) | `npx wrangler rollback` (to `94b395be`; safe only while no engine journals the new kinds) |
| 2026-11-26 | `npm run media -- push --pool default` from `b231a96`: the new breaks set (D129: the pop playlist, 50 tracks, under `interval-cache/breaks/` and `interval-data/breaks/`), the intro and throw tracks (`hold-cache/parasail-minigame.flac`, `flying-free.flac`, D138), and by mistake `hold-cache/audition/` (8 clips, 91 MB: hold.py's listening renders). 165 files, 1,333.7 MB. The auditions are excluded from the next push on (`pool-roots.ts`), so they leave the manifest and laptops never pull them; their objects stay in the bucket until the pool is pruned. | R2: `pools/default` | a prune of the pool (deletes by prefix) |
| 2026-11-26 | Redeployed (version `ec6983b0`) from `242a8cd`, step 2 of the presenter-paced Check (D127–D165), before Sound engine pushed it as `2d86b7a` (the same code re-synced over a docs commit): `check.started` replaces `check.scheduled`; phones get Pausa only with its overlay (D135); the journal takes `settings.volumes` up to VOLUME_MAX; the GameRoom folds them into `plan.volumes`. Cloud tests 90 node + 32 workerd on that sha; the e2e by presses passed on the same code (`4ed4074`). Both names answer; the stored plan reads back with step 2's checkGamePlan. | the Worker (both names) | `npx wrangler rollback` (to `fddfdc1d`; only while no engine runs step 2, which journals volumes) |
| 2026-11-26 | `npm run media -- push --pool default` from `eb8f88a`: Pausa's set in its own folder (`interval-cache/pausa/`, `interval-data/pausa/`, 37 tracks: last top-level Interval files, moved), and the Hold index listing the intro and the throw song. 116 files, 361.4 MB, as previewed. The old top-level `interval-*` keys left the manifest (no laptop pulls them); about 0.36 GB stays in the bucket until the post-night prune (D113). | R2: `pools/default` | a prune of the pool |
| 2026-11-26 | Redeployed (version `d963856b`) from `ba17a40`, the Desgraciat's finale (D166–D172), before Sound engine pushed it as `7742acb` (the same code over a docs commit): the journal takes `finale.set { round, cardIds, byHand? }`, which publishes nothing (U150); the finale's wins are standing claims. Cloud tests 91 node + 32 workerd on that sha; the e2e passed on it after the deploy. Both names answer; `/api/ping` 200; the plan intact. | the Worker (both names) | `npx wrangler rollback` (to `ec6983b0`; only while no engine journals `finale.set`) |
| 2026-11-26 | Redeployed (version `18f816f5`) from `fd9feaa`, a song's first play slower (D174, D175) with the screens on it, before Sound engine pushed it: the shared reducer folds `playedBefore` (a stored record without it reads as none); the journal's settings take `remoteShake` as a boolean (D148). The new state fields (`current.firstPlay`, `pace.firstPlaySec`, the throw songs' times) reach cloud consoles only. Cloud tests 91 node + 32 workerd; the e2e passed on `4a55730` and on `fd9feaa`. Both names answer; `/api/ping` 200; the plan intact. | the Worker (both names) | `npx wrangler rollback` (to `d963856b`; only while no engine journals `remoteShake`) |
| 2026-11-26 | Redeployed (version `c93f219c`) from `161c3f6` before Sound engine pushed it: the repertoire (D178), D177 (a Spin turned into a Suspens, `fromSpin` on `suspense.started`) and D180 (no shared win in the Desgraciat; `fellLast` stays readable in older journals). The media sync's routes now keep each repertoire under `repertoires/<name>/` with a v2 manifest; the older `pools/` keys (last year's songs and today's Hold and Interval music, about 8 GB) stay until step 6.5. Cloud tests 91 node + 32 workerd; the e2e passed on that sha. Both names answer; `/api/ping` and `/api/plan` 200; `/api/sync` lists no repertoire yet. | the Worker (both names) | `npx wrangler rollback` (to `18f816f5`; a laptop on the new code can't push media to it) |
| 2026-11-26 | Redeployed (version `228d23ab`) from `f4185fd`, the cloud's step B of card sides (D178), before Sound engine pushed it: journal-check takes `side` (1–9); phones get PublicRound.side and the intro's side when not 1; Admin's resume point carries `C<n>`. No engine journals a side yet. Cloud tests 93 node + 32 workerd; the e2e passed on that sha. Both names answer; `/api/ping` and `/api/plan` 200. | the Worker (both names) | `npx wrangler rollback` (to `c93f219c`; only while no engine journals `side`) |
| 2026-11-26 | Redeployed (version `5a57015e`) from `ec4912c` before Sound engine pushed it: cards in sides (D178, Frontend's `dd240f2`), so the served cards.json and card-types.json have `sides`; the preflight's cards check and the e2e read them (`5ff17b7`); Admin sets each round's side. Cloud tests 94 node + 32 workerd; the e2e passed on `5ff17b7` and on `ec4912c`. Both names answer and serve the new cards.json; `/api/ping` and `/api/plan` 200. | the Worker (both names) | `npx wrangler rollback` (to `228d23ab`; phones would get the old cards.json back) |
| 2026-11-26 | Redeployed (version `f63790a9`) from `593fef2`, already pushed by Sound engine: screens only for the cloud (Frontend's round names «Quina N» and the phones' slow confetti; D183 is the engine's). The e2e passed on that sha. Both names answer; `/api/ping` and `/api/plan` 200; on `quina.barrakudesbegur.org` the console's socket and `/api` stay 403 (the page shells load, as since step 7). | the Worker (both names) | `npx wrangler rollback` (to `5a57015e`) |
| 2026-11-26 | Redeployed (version `0948f16b`) from `c612e95` before Sound engine pushed it: the Desgraciat finale's screens (D180–D187), D193's side labels in card-types.json («Normal 1–5» / «Normal 6–10») and Admin's defaults, a planned Throw as its break's length (D192), no throw on the end screen (D194), the console's new tabs, a resumed Check's reveals settled (D121). Nothing in the cloud's own code. The e2e passed on `d8948d6` and on `c612e95`. Both names answer and serve the new card-types.json; `/api/ping` and `/api/plan` 200. | the Worker (both names) | `npx wrangler rollback` (to `f63790a9`) |
| 2026-11-26 | Redeployed (version `e86ecb72`) from `2fe0ace`, already pushed by Frontend: the console only (the break's and the end's layout, D195; «Ara sona» on top, D196; D199). The e2e passed on that sha. Both names answer; `/api/ping` and `/api/plan` 200. | the Worker (both names) | `npx wrangler rollback` (to `0948f16b`) |
| 2026-11-27 | Redeployed (version `e1fb7821`) from `1dfc1ea`, then pushed it: Frontend's labels and the phone's add-card drawer (D188, D189, D201; `dcf0cfd`, `0f6defc`, `1dfc1ea`), the projector's slow confetti, and the preflight's clock check (`8c884a8`, laptop-side). `npm test` passed on that sha (285 engine, 723 UI, 94 + 32 cloud, 11 tools), and the e2e on `dcf0cfd`, `0f6defc` and `1dfc1ea`. Both names answer; `/api/ping` and `/api/plan` 200. | the Worker (both names) | `npx wrangler rollback` (to `e86ecb72`) |
| 2026-11-27 | Redeployed (version `d2155f8a`) from `92f531e` before Sound engine pushed it: the automatic voice cues and the drum roll (D198, D202–D204; engine and protocol, with placeholders prepared on each laptop), Frontend's «Veus» slider. For the cloud: consoles through it pass the new commands, `volumes.voices` is a known key, `voicesOn` a settings field; the new state fields reach cloud consoles only. No voice files in R2 yet (the sync root is paused). The e2e passed on `c57c82f` and `92f531e`. Both names answer; `/api/ping` and `/api/plan` 200. | the Worker (both names) | `npx wrangler rollback` (to `e1fb7821`) |
| 2026-11-27 | Redeployed (version `514a042c`) from `5d91be5`, already pushed by Frontend: the first modern-web fixes (screens only; what came after it on origin is docs). The e2e passed on that sha. Both names answer; `/api/ping` and `/api/plan` 200. | the Worker (both names) | `npx wrangler rollback` (to `d2155f8a`) |
| 2026-11-27 | Redeployed (version `55028805`) from `5fda630`, already pushed by Frontend: the modern-web audit's batch 2 and the reduced-motion refactor (D209). The e2e passed on that sha. Both names answer; `/api/ping` and `/api/plan` 200. | the Worker (both names) | `npx wrangler rollback` (to `514a042c`) |
| 2026-11-27 | Redeployed (version `057f4fcc`) from `6aff25e`, already pushed by Frontend: the player's maximum width (D212) and the UI sounds (D206–D208), whose two sprites (the player's 206 KB, the console's 143 KB) go out with the hashed assets, no change in apps/cloud. The e2e passed on that sha. Both names answer and serve the player's sprite; `/api/ping` and `/api/plan` 200. | the Worker (both names) | `npx wrangler rollback` (to `55028805`) |
| 2026-11-27 | Redeployed (version `3cb67cbf`) from `9a168b6`, already pushed by Frontend: «Aquest cartró no existeix» in the console, the garland's lights, the falling comet and the beams to the edge; screens only, no change in packages/protocol or apps/cloud. The e2e passed on that sha. Both names answer; `/api/ping` and `/api/plan` 200, the game intact. | the Worker (both names) | `npx wrangler rollback` (to `057f4fcc`) |
| 2026-11-27 | Redeployed (version `c7289263`) from `a843dff`, already pushed by Frontend: the icon family (one registry and stroke system, H1, R8); screens only, no change in packages/protocol or apps/cloud. The e2e passed on that sha. Both names answer; `/api/ping` and `/api/plan` 200, the game intact. | the Worker (both names) | `npx wrangler rollback` (to `3cb67cbf`) |
| 2026-11-27 | Redeployed (version `9ca2350b`) from `81ba3e0`, already pushed by Frontend: the design system's foundation (tokens by colour, the generic Button, D210, D211) in the console, player and Admin, and the iOS 15.4 fallbacks dropped (D219); screens only, no change in packages/protocol or apps/cloud. The gallery (`apps/ds`) is left out of the build (`/ds/` gets the player's fallback page). The e2e passed on that sha. Both names answer; `/api/ping` and `/api/plan` 200, the game intact. | the Worker (both names) | `npx wrangler rollback` (to `c7289263`) |

The first `wrangler deploy` was stopped by Claude Code's permission check (auto mode); the user then allowed `npx wrangler deploy` in this project (`.claude/settings.local.json`, personal and gitignored).

## Needs the user

### 1. Deploy the Worker: DONE (2026-11-24), redeploy the same way

```sh
npm install                                   # once, at the repo root (npm workspaces)
cd apps/show && npm run build                 # the UI build (player, console, Admin)
cd ../cloud
npm test            # green before any deploy
npm run deploy      # = npm run assets (dist/) + wrangler deploy
```

`npm run assets` needs `sips` (macOS) and `cjxl` (`brew install jpeg-xl`) for the covers. It warns about every missing piece: without the UI build, phones get the placeholder page.

- It creates the Worker `quina-cloud` at `https://quina-cloud.<account subdomain>.workers.dev` (every account has a workers.dev subdomain).
- To let a Claude session deploy next time, allow it in Claude Code (`/permissions`, for example `Bash(npx wrangler deploy:*)`), or just run the command yourself.
- Check: `curl https://quina-cloud.<subdomain>.workers.dev/api/health` → `{"ok":true,"edition":"26"}`. A phone feed: `wss://…/feed?cards=1`.
- Undo: `npx wrangler rollback` (the previous version), or `npx wrangler delete quina-cloud`, which removes the Worker **and the GameRoom's data**: export first (`/api/export`).

### 2. A new subdomain for the cloud (needed for Access): DONE (2026-11-24)

Cloudflare documents Access for `workers.dev` only for a whole URL ("Access can protect one Worker's production `workers.dev` URL, preview URLs, or both"). That would put the phones' `/feed` behind a login too. Path-scoped applications (`/api`, `/ws/show`) belong on a hostname in one of the account's zones.

- Add to wrangler.jsonc, then `npm run deploy`:
  ```jsonc
  "routes": [{ "pattern": "quina-dev.barrakudesbegur.org", "custom_domain": true }]
  ```
  Cloudflare then creates the DNS record and the certificate for that NEW name only. Nothing else in the zone changes.
- Undo: remove the route and deploy again, or delete the Custom Domain under Workers & Pages → quina-cloud → Settings → Domains & Routes.
- `quina.barrakudesbegur.org` (until 2026-11-25 last year's app on GitHub Pages) now serves the new player app: step 7.

### 3. Cloudflare Access (Zero Trust) for admins and the laptop: DONE (2026-11-24, see the log)

Coin-reader (`fitxes`) already uses Access with Google, so the Zero Trust team and its Google login method probably exist. Reuse them. If not, see step 3d.

**a. The organizers' app** (Zero Trust → Access → Applications → Add → Self-hosted):
- Name `quina-cloud organizers`.
- Destinations on `quina-dev.barrakudesbegur.org`, one per path: `api`, `ws/console`, `console` and `admin`. The console and Admin pages must be behind the same login as their WebSocket, so the Access cookie reaches `/ws/console`.
- Login method: Google.
- Policy "Organizers": action Allow, include the organizers' emails.
- Copy the app's **AUD tag**.

**b. The laptop app** (another self-hosted app):
- Name `quina-cloud laptop`.
- Destination `quina-dev.barrakudesbegur.org`, path `ws/show`.
- Policy "Laptop": action **Service Auth**, include the service token from step 3c.
- Copy its **AUD tag**.

**c. The laptop's service token** (Zero Trust → Access → Service credentials → Service Tokens → Create):
- Name `quina-laptop`, duration 1 year.
- Copy the **Client ID** and **Client Secret**. The secret is shown only once.
- On the show laptop, create `apps/cloud/.env.link` (gitignored):
  ```sh
  QUINA_CLOUD_URL=wss://quina-dev.barrakudesbegur.org/ws/show
  CF_ACCESS_CLIENT_ID=<client id>
  CF_ACCESS_CLIENT_SECRET=<client secret>
  ```

**d. Only if there's no Google login method yet:**
1. In Google Cloud console, configure the OAuth consent screen.
2. Create an OAuth client ID of type Web application, with the authorized redirect URI `https://<team>.cloudflareaccess.com/cdn-cgi/access/callback`.
3. In Zero Trust → Settings → Authentication → Login methods → Add → Google, paste the client ID and secret.

**e. The Worker's secrets** (in `apps/cloud/`; each command asks for the value):
```sh
npx wrangler secret put CF_ACCESS_TEAM_DOMAIN      # https://<team>.cloudflareaccess.com
npx wrangler secret put CF_ACCESS_AUD              # <admin app AUD>,<laptop app AUD>
npx wrangler secret put CF_ACCESS_EMAILS           # organizer1@…,organizer2@… (or CF_ACCESS_EMAIL_DOMAIN)
npx wrangler secret put CF_ACCESS_SERVICE_TOKENS   # the service token's Client ID
```

**f. Check.**
- `https://quina-dev.barrakudesbegur.org/api/stats` asks for a Google login, then answers. The console at `/console/` connects to `/ws/console`.
- `npm run link` on the laptop logs `cloud: connected`.
- `/feed` stays public.

Undo: delete the two Access applications and the service token, and `npx wrangler secret delete <NAME>`.

### 4. R2 for the repertoire's media (milestone C3, for a takeover laptop): DONE (2026-11-24, see the log)

- One private bucket: `npx wrangler r2 bucket create quina-media --location weur`.
- Switch the binding on in wrangler.jsonc: uncomment `"r2_buckets": [{ "binding": "MEDIA", "bucket_name": "quina-media" }]`, then `npm run deploy`. Without it, `/api/sync` answers 503 and nothing else changes. With it and no bucket, a deploy fails.
- No public `r2.dev` access and no custom domain on the bucket. Files only go in and out through the Worker, with the laptop's service token.
- If the dashboard asks to enable R2, or to add a payment method first, that's the user's call. Copyrighted audio goes to the private bucket only, never to git.
- Then, on the show laptop: `npm run media -- push --repertoire <name>`. On a takeover laptop: `npm run media -- pull --repertoire <name>` (it needs the same repertoire manifest in `data/repertoires/`). Each repertoire lives under `repertoires/<name>/` in the bucket (before D178, under `pools/<name>/`: see step 6).
- Size: last year's songs are 6 GB in 1,085 files (1,086 requests to push). R2's free tier is 10 GB; going past it is fine (D113: a few cents a month).
- Undo: `npx wrangler r2 bucket delete quina-media` (empty it first).

### 5. If a free limit is hit on the night

- The free plan's daily limits reset at **00:00 UTC (01:00 in Catalonia in winter)**. The load test projects a pessimistic night at about half the request limit ([reports/](../reports/)).
- **Rehearsals the same UTC day share the quota.** Rehearse on another day when it's big, or keep rehearsals to a few phones.
- If it happens anyway: phones and remote consoles stop getting updates, and the show itself goes on, because the laptop never needs the cloud (ADR 0003). Upgrade on the spot: Dashboard → Workers & Pages → Plans → **Workers Paid** (5 USD a month minimum, usage-based beyond what's included). It takes effect at once.
- Watch it live: Workers & Pages → quina-cloud → Metrics, plus Durable Objects → GameRoom, and `/api/stats` (admins).

### 6. This year's repertoire, once it's prepared

Going past R2's 10 GB is fine (D113), so this year's repertoire goes up as soon as it's prepared, and the old copies go after. Laptops keep their own copies; only the bucket's copy goes.

1. On the main laptop, prepare the new repertoire (apps/show README › Repertoires): fetch the playlist (`tools/prep/playlist-fetcher`), write `data/repertoires/2026.json`, tag the hooks, `npm run prep -- --repertoire 2026` in `apps/show`, and set `cardsJson` once the cards are generated.
2. In `apps/cloud`, push it: `npm run media -- push --repertoire 2026` (progress every few seconds; about an hour for 6–7 GB at home upload speeds). Do it at least the day before the show. The Hold and Interval music goes with it, as with every repertoire.
3. Use it everywhere: the relay `npm start -- --repertoire 2026 --lan`, the preflight `npm run preflight -- --repertoire 2026`, and each spare laptop `npm run setup:laptop -- --repertoire 2026` (it pulls the new repertoire; its finished steps are skipped).
4. See what's in the bucket: `npm run media -- prune` (every repertoire, its files and size). A repertoire pushed since D178 goes with `npm run media -- prune --repertoire <name>` (a dry run: what it would free), then the same with `--yes`.
5. The keys from before D178, under `pools/` (last year's songs, and the first push of the Hold and Interval music), belong to no repertoire, so the tool doesn't list them. Only after step 2 (until then, they're R2's only copy of the music), let R2 expire them: `npx wrangler r2 bucket lifecycle add quina-media pools-before-d178 pools/ --expire-days 1`. A day or two later, once the dashboard shows `pools/` empty, remove the rule: `npx wrangler r2 bucket lifecycle remove quina-media --name pools-before-d178`.

Undo: push again from a laptop that still has the repertoire (`npm run media -- push --repertoire <name>`). The expired `pools/` keys can't come back, but every file in them is on the main laptop, under the default repertoire and the Hold and Interval folders.

### 7. Point quina.barrakudesbegur.org at the Worker: DONE (2026-11-25, see the log), Access destinations left

This year's printed cards have QR codes to `https://quina.barrakudesbegur.org/26/<card>`. Until 2026-11-25 that name was last year's app on GitHub Pages: a DNS-only `CNAME quina → barrakudesbegur.github.io`, with the repository's Pages custom domain set to `quina.barrakudesbegur.org`. The user answered U15 with "we can point at it now. nobody uses it" (D76), then confirmed it in the Platform session.

How it was done:
1. **DNS:** the user deleted the record `quina` (`CNAME → barrakudesbegur.github.io`) in the dashboard. Cloudflare refuses a Custom Domain over a record that Workers doesn't manage, whatever wrangler's override says (code 100117), and wrangler's login can't edit DNS. Nothing else in the zone was touched (`fitxes` and `quina-dev` stay; `quina-api` was removed later, see the log).
2. **The Worker:** added `{ "pattern": "quina.barrakudesbegur.org", "custom_domain": true }` to `routes` in `wrangler.jsonc`, then ran `npx wrangler triggers deploy` in `apps/cloud` (no new version). Cloudflare created the record and its certificate within seconds.
3. **GitHub Pages:** removed the custom domain with `gh api -X PUT repos/barrakudesbegur/quina-musical/pages --input - <<< '{"cname":null}'`. Last year's app stays at `https://barrakudesbegur.github.io/quina-musical/`. Its deploy workflow can stay: it only runs when `legacy/2025` changes, and it never sets a custom domain (`build_type: workflow`).
4. **Still to do (optional), Access for the organizers on the new name.** Organizers and the laptop keep using quina-dev, which is enough. Without Access, the Worker refuses `/api/*` and `/ws/*` on this name (403, fail-closed), so nothing private is open. Only the `/console/` and `/admin/` page shells load there (public code), and they get 403s. To use the new name for everything, go to Zero Trust → Access → Applications:
   - add to `quina-cloud organizers` the destinations `quina.barrakudesbegur.org/api`, `/ws/console`, `/console` and `/admin`;
   - add to `quina-cloud laptop` the destination `quina.barrakudesbegur.org/ws/show`;
   - add to `quina-cloud health (public)` the destination `quina.barrakudesbegur.org/api/health`.

   The apps' AUD tags don't change, so the Worker's secrets stay as they are. Then the preflight with `QUINA_CLOUD_URL=wss://quina.barrakudesbegur.org/ws/show` should pass.
5. **Checks** (all passed on 2026-11-25, see the log):
   - `server: cloudflare`;
   - `/26/123` opens the player with card 123, and `/?c=123` shows last year's notice;
   - `/sw.js` is the kill switch: a phone that had last year's app gets it cleaned (on a real phone: U19);
   - `/api/health` answers; `/api/stats` refuses.

Undo (a few minutes):
1. Set the Pages custom domain back: `gh api -X PUT repos/barrakudesbegur/quina-musical/pages -f cname=quina.barrakudesbegur.org`.
2. Remove the `quina.barrakudesbegur.org` route and run `npx wrangler triggers deploy`: Cloudflare removes its record.
3. Recreate `CNAME quina → barrakudesbegur.github.io` (DNS only) in the dashboard (DNS → Records). Wrangler's login can't write DNS records.

GitHub reissues its certificate within about an hour. The Access destinations for the name can stay.

## Privacy on the night

- **The laptop's hotspot must have a password.** Anyone on it can read, through the relay, the journal and so the Queue (`/cloud/`, and the relay's `journal.entry` events).
- **Resume codes and Shuffle seeds are secret.** A code (from the console, or `resumePoint.text` in Admin's `GET /api/games`), together with the Pool and the cards in play, gives the whole Queue. Keep a noted code like the box of cards, and never show it on a screen.
- Winners' names stay in the cloud's journal only. They are never in the public feed, and never in git.

## On the night

- **The show laptop runs:**
  - the relay: `npm start` in `apps/show/`;
  - the cloud link: `npm run link` in `apps/cloud/`, with `.env.link`.
- **Its log says:**
  - `cloud: connected`;
  - every 30 s, a status line ("N journalled, N in the cloud, 0 to send").
- **Offline (5G drops):**
  - the link keeps the journal on disk and catches up on reconnect;
  - phones show "Connexió perduda" after 20 s.
- **If the link says CONFLICT:** another device wrote different entries for the same Game. Uploads stop. Export the Game, decide which one is right, and resume by hand (Admin's manual resume comes with milestone C3).
