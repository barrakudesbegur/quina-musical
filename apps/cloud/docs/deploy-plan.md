# Deploy plan: the cloud on Cloudflare

What gets deployed, what this session changed in the Cloudflare account, and what needs the user. No secret, token, AUD tag or account ID is written here or anywhere in git: they go in with `wrangler secret put`, or in the gitignored `.dev.vars` and `.env.link`.

Guard-rails (from the user, through the orchestrator, 2026-11-24): never touch existing DNS records or projects (`quina` is still the old app on GitHub Pages, `fitxes` is coin-reader). Deploy to `*.workers.dev` or a NEW subdomain. Free plan only. Private R2 bucket only. Moving `quina.barrakudesbegur.org` to the new app needs the user's explicit OK.

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
- Later, with the user's explicit OK: move `quina.barrakudesbegur.org` (today the old app on GitHub Pages) to the new player app.

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

### 4. R2 for the pool's media (milestone C3, for a takeover laptop): DONE (2026-11-24, see the log)

- One private bucket: `npx wrangler r2 bucket create quina-media --location weur`.
- Switch the binding on in wrangler.jsonc: uncomment `"r2_buckets": [{ "binding": "MEDIA", "bucket_name": "quina-media" }]`, then `npm run deploy`. Without it, `/api/sync` answers 503 and nothing else changes. With it and no bucket, a deploy fails.
- No public `r2.dev` access and no custom domain on the bucket. Files only go in and out through the Worker, with the laptop's service token.
- If the dashboard asks to enable R2, or to add a payment method first, that's the user's call. Copyrighted audio goes to the private bucket only, never to git.
- Then, the day before the show, on the show laptop: `npm run media -- push`. On a takeover laptop: `npm run media -- pull` (it needs the same pool manifest in `data/pools/`).
- Size: last year's pool is 6 GB in 1,085 files (1,086 requests to push; R2's free tier is 10 GB). Two pools don't fit, so delete last year's test pool from the bucket (`pools/default/`) before pushing this year's.
- Undo: `npx wrangler r2 bucket delete quina-media` (empty it first).

### 5. If a free limit is hit on the night

- The free plan's daily limits reset at **00:00 UTC (01:00 in Catalonia in winter)**. The load test projects a pessimistic night at about half the request limit ([reports/](../reports/)).
- **Rehearsals the same UTC day share the quota.** Rehearse on another day when it's big, or keep rehearsals to a few phones.
- If it happens anyway: phones and remote consoles stop getting updates, and the show itself goes on, because the laptop never needs the cloud (ADR 0003). Upgrade on the spot: Dashboard → Workers & Pages → Plans → **Workers Paid** (5 USD a month minimum, usage-based beyond what's included). It takes effect at once.
- Watch it live: Workers & Pages → quina-cloud → Metrics, plus Durable Objects → GameRoom, and `/api/stats` (admins).

### 6. This year's pool, once the playlist is final

The R2 free tier is 10 GB and last year's test pool takes 6.6 GB, so the old pool goes before the new one is pushed. Laptops keep their own copies; only the bucket's copy goes.

1. On the main laptop, prepare the new pool (apps/show README › Pools): fetch the playlist (`tools/prep/playlist-fetcher`), write `data/pools/2026.json`, tag the hooks, `npm run prep -- --pool 2026` in `apps/show`, and set `cardsJson` once the cards are generated.
2. In `apps/cloud`, see what's in the bucket: `npm run media -- prune` (every pool, its files and size, against the 10 GB).
3. Free the room: `npm run media -- prune --pool default` is a dry run (what it would free); `npm run media -- prune --pool default --yes` deletes the pool's files and manifest from the bucket.
4. Push the new pool: `npm run media -- push --pool 2026` (progress every few seconds; about an hour for 6–7 GB at home upload speeds). Do it at least the day before the show.
5. Use it everywhere: the relay `npm start -- --pool 2026 --lan`, the preflight `npm run preflight -- --pool 2026`, and each spare laptop `npm run setup:laptop -- --pool 2026` (it pulls the new pool; its finished steps are skipped).

Undo: push the old pool again from a laptop that still has it (`npm run media -- push --pool default`).

### 7. Point quina.barrakudesbegur.org at the Worker: NEEDS THE USER'S EXPLICIT OK

This year's printed cards have QR codes to `https://quina.barrakudesbegur.org/26/<card>`. Today that name is last year's app on GitHub Pages: a DNS-only `CNAME quina → barrakudesbegur.github.io`, with the repository's Pages custom domain set to `quina.barrakudesbegur.org` (checked 2026-11-24). Phones that scan a card must reach this year's player, so **this must be live before the cards are handed out**, at least a day before the event and after a rehearsal on quina-dev, never on the night itself.

Steps, in this order (about 15 minutes, a few minutes of downtime for the old app):
1. **Access first**, so the organizers' pages are protected on the new name from the first minute: in Zero Trust → Access → Applications, add to `quina-cloud organizers` the destinations `quina.barrakudesbegur.org/api`, `/ws/console`, `/console` and `/admin`; to `quina-cloud laptop` add `quina.barrakudesbegur.org/ws/show`; to `quina-cloud health (public)` add `quina.barrakudesbegur.org/api/health`. The apps' AUD tags don't change, so the Worker's secrets stay as they are. (Dashboard, or a short-lived API token from the user.)
2. **GitHub Pages:** in the repository's Settings → Pages, remove the custom domain. Last year's app stays at `https://barrakudesbegur.github.io/quina-musical/`. Its deploy workflow can stay; it only runs when `legacy/2025` changes.
3. **DNS:** delete the record `quina` (`CNAME → barrakudesbegur.github.io`) in the zone `barrakudesbegur.org`. Cloudflare refuses a Custom Domain over an existing record, and nothing else in the zone is touched (`quina-api`, `fitxes`, `quina-dev` stay).
4. **The Worker:** add `{ "pattern": "quina.barrakudesbegur.org", "custom_domain": true }` to `routes` in `wrangler.jsonc`, then `npx wrangler triggers deploy`. Cloudflare creates the record and its certificate (a minute or two).
5. **Check:**
   - `https://quina.barrakudesbegur.org/26/123` opens the player with card 123;
   - a phone that had last year's app gets it cleaned by the service-worker kill switch (`/sw.js`);
   - `/api/health` answers, `/admin/` asks for the Google login;
   - the preflight with `QUINA_CLOUD_URL=wss://quina.barrakudesbegur.org/ws/show` passes (the link can stay on quina-dev; both names serve the same Worker).
6. Log it here, with the time.

Undo (a few minutes): remove the `quina.barrakudesbegur.org` route and run `npx wrangler triggers deploy` (Cloudflare removes its record); recreate `CNAME quina → barrakudesbegur.github.io` (DNS only); set the Pages custom domain back to `quina.barrakudesbegur.org`. The Access destinations for the name can stay.

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
