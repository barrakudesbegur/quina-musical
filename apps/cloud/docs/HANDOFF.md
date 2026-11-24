# Platform handoff

The single place to resume Platform's work from. Sessions get cleared, so keep it current at each milestone.

**What this covers:** the cloud (`apps/cloud`: the Worker, one GameRoom Durable Object per edition, Access, R2), the laptop's cloud link, media sync and preflight (`apps/cloud/laptop`), the public feed for phones (with UI; `packages/protocol/public.ts`), the load test, CI (`.github/workflows/ci.yml`), the end-to-end test (`tools/e2e`) and the laptop setup (`tools/laptop`). The Game journal is shared with Sound engine.

**Where else to look:**
- How the cloud works and every route: [`../README.md`](../README.md).
- What was changed in Cloudflare, with how to undo it, and the user's remaining steps: [`deploy-plan.md`](deploy-plan.md).
- The load test's numbers: [`../reports/`](../reports/).
- The decisions: `GLOSSARY.md`, `docs/adr/` (0003: the cloud owns the Game, the laptop owns playback), `docs/show-ui-and-platform-decisions.md`. The team roles: `docs/team.md`. Questions for the user: `docs/open-questions.md`.

## Milestones

The night is **Sun 27 Dec 2026**; the final playlist arrives **Tue 1 Dec**. The whole plan is in [`docs/timeline.md`](../../../docs/timeline.md). Tell the orchestrator early if one of these slips.

| By | Platform's milestone | Depends on |
|---|---|---|
| Fri 27 Nov | The cloud side of card type per round (queue item 1) | Sound engine's step A on main |
| Mon 30 Nov | The cloud side of the Desgraciat round (queue item 2) | Sound engine's proposal and its types |
| Thu 10 Dec | Last year's pool pruned from R2, this year's pushed; the show laptop and the spare synced (deploy-plan step 6) | the pool prepared (2 Dec), hooks and stems done (10 Dec) |
| Fri 11 Dec | `quina.barrakudesbegur.org` points at the Worker, checked with a printed card (deploy-plan step 7) | **the user's explicit OK**; the cards printed |
| Sun 13, Sat 19 Dec | Rehearsals (default dates): watch the daily quota (`/api/stats`, the preflight) | |
| Mon 21 Dec | Code freeze: only fixes for what a rehearsal finds | |

## Done so far

All of this is on `main`, green when committed.

| What | Commits |
|---|---|
| **C1:** the GameRoom (SQLite, Hibernation API), journal sync by `seq` (idempotent, `cloud.need` for holes, `cloud.conflict`), the laptop link, the public feed for phones, the 400-phone load test | `6494192` |
| **C2:** consoles through the cloud on `/ws/console` (the relay protocol); Admin's Game plan and logos; takeover (`link.fetch`); Admin's manual resume (`/api/resume`, `resume.json` via the relay's read-only `/cloud/`); phones opened, notice, sounds | `18243a9`, `cb716bc`, `18e9b96`, `24184b4`, `c8f0ea7` |
| **C3:** `npm run assets` builds `dist/`; R2 media sync (`npm run media -- push\|pull`); the load test with consoles; the preflight; the relay lockdown audit; privacy fixes from the audit | `51344aa`, `6fa3522`, `bc1b694`, `3376607`, `133911c`, `08a9da5`, `bc9c0ad` |
| The repo reorganisation (apps/, packages/, tools/, data/, legacy/2025) | `3399fb3`, `60f9d12` |
| `relay.plan` (the plan pushed to every screen) and the laptop's plan B (`PUT /api/plan` on the relay) | `12c9f40` |
| Covers, logos and prize pictures as JPEG XL with a JPEG/PNG fallback; the projector's logos offline | `b201f05`, `233655d`, `c1ac64d` |
| **Prize secrecy:** phones see only the revealed rounds' prizes (`publicPlan`) | `6fbbc32` |
| CI: every suite on each push to main and each PR | `29440e8`, `22c1516` |
| The Custom Domain `quina-dev.barrakudesbegur.org`, Access and the R2 bucket (logged in deploy-plan.md) | `295549a`, `6656398`, `7561eb8` |
| **The e2e test:** one whole show, headless, every screen following | `4942b87`, `811b64f`, `53abaac` |
| R2 on; a spare laptop fetches the plan without taking over; sync progress | `a170114` |
| `npm run setup:laptop`: one command to set up a show laptop | `3ae9468` |
| Preflight: FAIL when the show's Chrome can be throttled; the `especial` cards counted | `ab8e237`, `82c1ff1` |
| The relay forwards the Wii Remote's status between paired consoles only | `6243678` |
| **Show-night health:** the GameRoom counts its daily usage against the free limits (`/api/stats`, the preflight's "Daily usage") | `15e4e8d` |
| The cloud link asks again for a journal hole until it is filled (found by the production-path e2e: phones missed round 1's intro) | `988eadd` |
| **Cutover kit:** `npm run media -- prune` for this year's pool; deploy-plan steps 6 (the new pool) and 7 (the QR domain) | `94bc4f1` |
| **The e2e on the phones' production path:** the Worker in wrangler dev, the cloud link, a phone on `/feed`, the player as the cloud serves it; prize secrecy and "nothing private" checked on everything the phone got | `b73e864` |
| **quina-dev redeployed** (version `82c1b157`) with a coherent build of `b73e864`: the usage report, the pool list and prune, the console, Wii and projector UI (logged in deploy-plan.md) | `b73e864` (deploy only) |

## In progress

- **Card type per round** (Sound engine's proposal, 2026-11-25): Platform answered OK. It lands in three steps so CI stays green: **A** (Sound engine) adds every new field; **B** (Platform and Frontend) makes the cloud carry them; **C** (Sound engine) moves to plan v3 and drops `cardTypes`. Platform's step B waits for A on main. Its parts are in the queue below.

## The next queue, in priority order

1. **Card type per round, step B** (once Sound engine's step A is on main). Agreed with Sound engine on 2026-11-25:
   - `journal-check.ts`: an optional `cardType` on `round.started`, `round.resumed` and `scene.changed`, with the format `/^[a-z][a-z0-9]{0,23}$/` when present. Unknown keys are already ignored, so step A can't break ingest;
   - `projection.ts`: `PublicRound.cardType` and `intro.cardType`, falling back to `defaultCardType(kind)` when the entry has none;
   - `scripts/assets.ts`: copy `card-types.json` into `dist/cards/` from the folder of the pool's `cardsJson` (the relay serves that folder at `/cards/`);
   - `test/support/plan.ts`: drop `cardTypes` and set each round's `cardType`;
   - **the stored plan:** the GameRoom loads `room.plan` from its snapshot row without running `checkGamePlan` (game-room.ts, the snapshot load). Make it run `checkGamePlan` on load, so a v2 plan migrates to v3 in step C. quina-dev holds a v2 plan with `cardTypes` today. The relay's plan files already go through `checkGamePlan` (relay/plan.ts);
   - Admin's resume point: `resumeToken()` in game-room.ts adds `cardType` from `RecordedRound.cardType` (the valid cards, and so the Queue, depend on it);
   - media sync: the `cards` root syncs only `cards.json` today (`laptop/pool-roots.ts`). Add `card-types.json`, so a takeover laptop's relay serves it too;
   - preflight: every card's type and every round's `cardType` must be in `card-types.json`, and each round's type must have cards in play. This replaces the fixed normal/especial check from `82c1ff1`.

   Sound engine tells Platform when step C lands. Redeploy quina-dev then, so the migration runs on the live plan.
2. **The Desgraciat round** (Sound engine's item 2, after 1). Its proposal hasn't come yet. Platform's side:
   - **order:** journal-check is strict on enums (`roundKind` normal|special, `winKind` line|bingo, `verdict` valid|invalid). A refused entry stops the link's uploads, so the cloud must accept `'desgraciat'` and `'standing'` before the engine journals them (the same A/B/C);
   - the public projection of the round kind `'desgraciat'` (`src/domain/projection.ts`, the exhaustive switch). If `'fallen'` is only a live CheckOutcome, the cloud has nothing to project for it; Sound engine is asked to confirm;
   - the journal check of `claim { kind: 'standing' }` and `WinKind` `'standing'`;
   - the private `ShowState.standing` must never reach phones (add it to the e2e's "never" list and the projection test).
3. The Pausa scene in the public feed, once UI proposes its shape (it reuses `pause {on}`; nothing new expected).

## Waiting on the user

- **deploy-plan step 6:** this year's pool (the playlist isn't final). Don't start.
- **deploy-plan step 7:** pointing `quina.barrakudesbegur.org` (the printed QR codes) at the Worker. Needs the user's explicit OK. Don't start.
- **Open questions** in `docs/open-questions.md`: the printed cards are public (impact low), the player checked on desktop only.
- **The logo library** isn't uploaded yet. Admin's upload needs a person's Google login. The user offered to sign in and let Platform drive their Chrome, but that was called off. Only start it if the user asks directly.

## Known issues and risks

- **Prepared data.** The e2e and the media sync need the default pool prepared on this machine (`data/out`, `data/cache`); without it the e2e skips. CI has no prepared pool, so CI doesn't run the e2e.
- **Free plan.** A pessimistic night is about half the daily request quota; rehearsals the same UTC day share it (deploy-plan step 5).
- **R2 is 10 GB free;** last year's pool takes 6.6 GB, so it goes before this year's is pushed (step 6). **This year's pool may not fit.** Each song is about 92 MB in the bucket (the decoded `mix.flac` about 45 MB, plus `stems/` about 47 MB). With the shared Hold and Interval music, that's room for about **100 songs**. If the playlist is bigger, the options are: R2 storage beyond 10 GB (a few cents a month, but it needs the user's OK because the rule is free plan only); leaving the stems out of the bucket and rendering them on the spare laptop; or copying the overflow laptop to laptop on a USB disk. Measure it once the pool is prepared (2 Dec): `npm run media -- prune` shows the bucket against 10 GB.
- **The shared tree.** Other sessions' uncommitted edits sit in the same checkout: commit by path, and test the committed state in a detached worktree of HEAD (node_modules symlinked, `QUINA_OUT_DIR` pointing at the real `data/out`). Never `rm` inside a copy whose node_modules is a symlink.
- **Don't commit** `legacy/2025/last-year-data/` (last year's app database export: personal data) or anything from `legacy/2025` that isn't Platform's.
- **macOS has no `timeout`:** use `perl -e 'alarm N; exec @ARGV' …`.

## How to run and test

From the repo root, once: `npm install` (workspaces). Then:

**Test:**
- `npm test` (repo root): the show's suites, then the cloud's (`apps/cloud`: typecheck, Node tests, the Worker in workerd).
- `npm run test:e2e` (repo root): one whole show, headless, with the phones' production path. It builds apps/show first and needs the prepared default pool. About 4 minutes.
- `npm run relay-audit` in apps/cloud (on a build): the relay lockdown checks.
- `npm run loadtest -- --report reports/loadtest-$(date +%F).md` in apps/cloud: 400 phones.

**Run:**
- `npm run dev` in apps/cloud: wrangler dev on http://localhost:8787 (copy `.dev.vars.example` to `.dev.vars` first).
- `npm run link` in apps/cloud: the laptop link, relay → cloud (`.env.link` for quina-dev).
- `npm run preflight` in apps/cloud: before every rehearsal and show.
- `npm run setup:laptop` (repo root): a spare show laptop, safe to rerun.

**Deploy (quina-dev, within the guard-rails in docs/team.md):** `npm run build` in apps/show; then in apps/cloud `npm test`, `npm run assets`, `npx wrangler deploy`; check `/api/health`, the player, a locked route (403 or the Google login); log it in deploy-plan.md with its undo.
