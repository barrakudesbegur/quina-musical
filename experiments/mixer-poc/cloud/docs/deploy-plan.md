# Deploy plan: the cloud on Cloudflare

What gets deployed, what this session changed in the Cloudflare account, and what needs the user. No secret, token, AUD tag or account ID is written here or anywhere in git: they go in with `wrangler secret put`, or in the gitignored `.dev.vars` and `.env.link`.

Guard-rails (from the user, through the orchestrator, 2026-11-24): never touch existing DNS records or projects (`quina` is still the old app on GitHub Pages, `fitxes` is coin-reader). Deploy to `*.workers.dev` or a NEW subdomain. Free plan only. Private R2 bucket only. Moving `quina.barrakudesbegur.org` to the new app needs the user's explicit OK.

## What gets deployed

| Piece | Name | Notes |
|---|---|---|
| Worker | `quina-cloud` | `src/worker.ts`; about 87 KiB (23 KiB gzipped) |
| Durable Object class | `GameRoom` (SQLite) | migration `v1` (`new_sqlite_classes`); one object per edition, named `edition:26`, placed in western Europe |
| Static assets | `public/` | a placeholder page for now. At deploy time the UI build goes in (agreed with the UI session): the player app at the root, with an SPA fallback so `/26/123` serves it (set `not_found_handling: "single-page-application"` in wrangler.jsonc when it lands); `console/` and `admin/` (built as `manage`); `assets/`; and the covers. No `stage/`: the projector runs on the laptop. Static files are free and never run the Worker |
| Variable | `EDITION = "26"` | in wrangler.jsonc |
| Secrets | `CF_ACCESS_TEAM_DOMAIN`, `CF_ACCESS_AUD`, `CF_ACCESS_EMAILS` (or `CF_ACCESS_EMAIL_DOMAIN`), `CF_ACCESS_SERVICE_TOKENS` | `wrangler secret put`; until they exist, every admin route and the laptop route answer 403 (fail-closed), and only `/feed` and `/api/health` work |

`ACCESS_DEV` is never set in Cloudflare: it lives in `.dev.vars` only, and the Worker honours it only on localhost anyway.

## Done

| When | What | Where | How to undo |
|---|---|---|---|
| 2026-11-24 | The user logged wrangler in (`wrangler login`, OAuth) | this Mac, machine-wide | `npx wrangler logout` |
| 2026-11-24 | Read-only checks: `wrangler whoami`; `wrangler deployments list --name quina-cloud` (no Worker of that name exists, so a deploy overwrites nothing); `wrangler deploy --dry-run` | none | nothing to undo |

**No change has been made to the Cloudflare account.** The first `wrangler deploy` was stopped by Claude Code's permission check (auto mode), and this session doesn't work around such a stop. Everything is ready and tested locally.

## Needs the user

### 1. Deploy the Worker (2 minutes)

```sh
cd experiments/mixer-poc/cloud
npm install
npm test            # green before any deploy
npm run deploy      # = wrangler deploy
```

- It creates the Worker `quina-cloud` at `https://quina-cloud.<account subdomain>.workers.dev` (every account has a workers.dev subdomain).
- To let a Claude session deploy next time, allow it in Claude Code (`/permissions`, for example `Bash(npx wrangler deploy:*)`), or just run the command yourself.
- Check: `curl https://quina-cloud.<subdomain>.workers.dev/api/health` → `{"ok":true,"edition":"26"}`. A phone feed: `wss://…/feed?cards=1`.
- Undo: `npx wrangler rollback` (the previous version), or `npx wrangler delete quina-cloud`, which removes the Worker **and the GameRoom's data**: export first (`/api/export`).

### 2. A new subdomain for the cloud (needed for Access)

Cloudflare documents Access for `workers.dev` only for a whole URL ("Access can protect one Worker's production `workers.dev` URL, preview URLs, or both"). That would put the phones' `/feed` behind a login too. Path-scoped applications (`/api`, `/ws/show`) belong on a hostname in one of the account's zones.

- Add to wrangler.jsonc, then `npm run deploy`:
  ```jsonc
  "routes": [{ "pattern": "quina-dev.barrakudesbegur.org", "custom_domain": true }]
  ```
  Cloudflare then creates the DNS record and the certificate for that NEW name only. Nothing else in the zone changes.
- Undo: remove the route and deploy again, or delete the Custom Domain under Workers & Pages → quina-cloud → Settings → Domains & Routes.
- Later, with the user's explicit OK: move `quina.barrakudesbegur.org` (today the old app on GitHub Pages) to the new player app.

### 3. Cloudflare Access (Zero Trust) for admins and the laptop

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
- On the show laptop, create `experiments/mixer-poc/cloud/.env.link` (gitignored):
  ```sh
  QUINA_CLOUD_URL=wss://quina-dev.barrakudesbegur.org/ws/show
  CF_ACCESS_CLIENT_ID=<client id>
  CF_ACCESS_CLIENT_SECRET=<client secret>
  ```

**d. Only if there's no Google login method yet:**
1. In Google Cloud console, configure the OAuth consent screen.
2. Create an OAuth client ID of type Web application, with the authorized redirect URI `https://<team>.cloudflareaccess.com/cdn-cgi/access/callback`.
3. In Zero Trust → Settings → Authentication → Login methods → Add → Google, paste the client ID and secret.

**e. The Worker's secrets** (in `experiments/mixer-poc/cloud`; each command asks for the value):
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

### 4. R2 for media (milestone C3, not needed yet)

- One private bucket: `npx wrangler r2 bucket create quina-media --location weur`.
- No public `r2.dev` access and no custom domain on the bucket. The laptop link downloads through the Worker, with the service token.
- If the dashboard asks to enable R2 or to add a payment method first, that's the user's call. Copyrighted audio goes to the private bucket only, never to git.
- Undo: `npx wrangler r2 bucket delete quina-media` (empty it first).

### 5. If a free limit is hit on the night

- The free plan's daily limits reset at **00:00 UTC (01:00 in Catalonia in winter)**. The load test projects a pessimistic night at about half the request limit ([reports/](../reports/)).
- **Rehearsals the same UTC day share the quota.** Rehearse on another day when it's big, or keep rehearsals to a few phones.
- If it happens anyway: phones and remote consoles stop getting updates, and the show itself goes on, because the laptop never needs the cloud (ADR 0003). Upgrade on the spot: Dashboard → Workers & Pages → Plans → **Workers Paid** (5 USD a month minimum, usage-based beyond what's included). It takes effect at once.
- Watch it live: Workers & Pages → quina-cloud → Metrics, plus Durable Objects → GameRoom, and `/api/stats` (admins).

## On the night

- **The show laptop runs:**
  - the relay: `npm start` in `experiments/mixer-poc`;
  - the cloud link: `npm run link` in `experiments/mixer-poc/cloud`, with `.env.link`.
- **Its log says:**
  - `cloud: connected`;
  - every 30 s, a status line ("N journalled, N in the cloud, 0 to send").
- **Offline (5G drops):**
  - the link keeps the journal on disk and catches up on reconnect;
  - phones show "Connexió perduda" after 20 s.
- **If the link says CONFLICT:** another device wrote different entries for the same Game. Uploads stop. Export the Game, decide which one is right, and resume by hand (Admin's manual resume comes with milestone C3).
