# Platform handoff

The single place to resume Platform's work from. Sessions get cleared, so keep it current at each milestone.

## Now (2026-11-25, afternoon)

- **In progress:** nothing half-built.
- **Just done:**
  - **`quina.barrakudesbegur.org` serves this year's player** (deploy-plan step 7, D76; 14:20 UTC on 25 Nov). The user deleted the old CNAME, `wrangler triggers deploy` attached the name, and the GitHub Pages custom domain was removed. Checked live: `/26/123` adds the card; `?c=123` shows last year's notice; `/sw.js` is the kill switch; `/api/*` refuses (no Access destinations on the name yet; optional, see step 7).
  - D70 (the Desgraciat plays special cards). My tests follow the protocol's default card type (`9f4f005`). The order agreed with Frontend: Frontend's tests, then mine, then Sound engine's flip, which is on origin (`364c916`). The live Desgraciat e2e now plays especial cards 400–429.
  - D69 (2025's prices): a preflight test with 1.50 €/5 €, 15 € before round 1 and 5 € before the Desgraciat (`9c83ebe`). The real check passes once Frontend puts the prices in `apps/cards/src/config.ts`. Today they're `null`, so it WARNs.

  - D86: the user deleted the `quina-api` record (last year's API), and I deleted its Cloudflare Tunnel with the user's OK. U24: the previous session's `ci-head` worktree is removed; everything in it was already on main.

  The Worker runs `f1aacdd` (version `87650e0c`) on both quina-dev and the QR name, with this year's prices. The live Desgraciat run passed on it with especial cards.
- **Next:**
  - remember that one Worker serves both names, so every deploy also changes what the QR codes open;
  - this year's pool: prepared 1–4 Dec, cards made 4–5 Dec (D83); then measure, prune, push, and sync both laptops **before the tech rehearsal** (D82: no fixed date; the user runs it when everything feels ready);
  - 1–3 Dec: the cards move to the pools (queue item 3), and deploys name their pool;
  - the night's settings file and `npm run plan` (queue item 4), once U43 is answered;
  - the provisional-hooks WARN, once Sound engine sends the field.
- **Blocked:** nothing.
- **Waiting on the user** (docs/open-questions.md): optionally, the Access destinations for `quina.barrakudesbegur.org` (deploy-plan step 7.4; the dashboard, or a short-lived token); **U16**, the logo library upload (needs an organizer's Google login); **U19**, real devices (the Wii remote's range at the venue; iPad and Android; last year's offline cache after the switch); **U43**, which copy of the night's settings file wins on the night (blocks `npm run plan`); **U48**, sponsors' names and logos in the file (default yes); **U53**, R2 storage for about 210 songs (default: the plain pool, pushed about a week before the night and pruned right after, which keeps it within the free GB-month average, plus a check that R2 has a payment method; option d is the alternative); **U54**, naming: one Pool with three Parts of 70 (Part 1 for side 1, Part 2 for side 2, Especial), the default, against three pools. Build nothing on either shape until U54 is answered. The cloud must accept the round's `part`/`side` and be deployed before the engine journals it.

**What this covers:** the cloud (`apps/cloud`: the Worker, one GameRoom Durable Object per edition, Access, R2), the laptop's cloud link, media sync and preflight (`apps/cloud/laptop`), the public feed for phones (with UI; `packages/protocol/public.ts`), the load test, CI (`.github/workflows/ci.yml`), the end-to-end test (`tools/e2e`) and the laptop setup (`tools/laptop`). The Game journal is shared with Sound engine.

**Where else to look:**
- How the cloud works and every route: [`../README.md`](../README.md).
- What was changed in Cloudflare, with how to undo it, and the user's remaining steps: [`deploy-plan.md`](deploy-plan.md).
- The load test's numbers: [`../reports/`](../reports/).
- The decisions: `GLOSSARY.md`, `docs/adr/` (0003: the cloud owns the Game, the laptop owns playback), `docs/show-ui-and-platform-decisions.md`. The team roles: `docs/team.md`. Questions for the user: `docs/open-questions.md`.

## Milestones

The night is **Sun 27 Dec 2026**; the final playlist arrives **Tue 1 Dec**; the user makes the cards on **4–5 Dec** (D83). Cards are sold only on the night and print in a few hours (D71). Rehearsals have no fixed dates (D82): the user runs a tech rehearsal when everything feels ready, and maybe a presenters' rehearsal a day or two before or on the day itself. The whole plan is in [`docs/timeline.md`](../../../docs/timeline.md). Tell the orchestrator early if one of these slips.

| When | Platform's milestone | Depends on |
|---|---|---|
| Done (25 Nov) | The cloud side of card type per round and of the Desgraciat round | |
| Done (25 Nov) | `quina.barrakudesbegur.org` points at the Worker (deploy-plan step 7, D76) | |
| By Fri 4 Dec | This year's pool measured against R2's 10 GB | the pool prepared (1–4 Dec) |
| Before the tech rehearsal | Last year's pool pruned from R2, this year's pushed; the show laptop and the spare synced (deploy-plan step 6) | the pool prepared; hooks and stems done |
| Each rehearsal | The preflight; watch the daily quota (`/api/stats`). A presenters' rehearsal on the day itself runs laptop-only (no `npm run link`) | D82 |
| Sun 27 Dec | The night | |

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
| **Card type per round, step B:** journal-check accepts `cardType` (format only); the projection gives `PublicRound.cardType` and `intro.cardType` (else the kind's default); the GameRoom reads its stored plan through `checkGamePlan` on load (older versions migrate, and phones' public plan is derived again); the resume point carries `cardType`; `card-types.json` is served beside `cards.json` and synced to takeover laptops; the preflight checks every card's type against `card-types.json` and that every round's type has printed cards | `f3e8ade` |
| **The Desgraciat round, step B:** journal-check takes round and win kinds from the protocol's lists (`desgraciat`, `standing` accepted; a `fallen` verdict refused); a valid `standing` claim ends the round like a Bingo, with no Line; `ShowState.standing`, the Futur's `lastStandingAt`/`standingCurve` and a Check's `outcome` are checked never to reach phones (projection test, e2e) | `cb35dd1` |
| **quina-dev redeployed** (version `ee41deae`) with `cbcc1d3`: card type per round (the live v2 plan migrates on read) and the Desgraciat round's cloud side, so Sound engine's C may journal the new kinds | `cbcc1d3` (deploy only) |
| **Card type per round, step C** (Sound engine's plan v3, with Platform's v3 test fixtures `91b1a43`); quina-dev redeployed (version `3095a797`): its stored v2 plan reads as v3 | `ebf1a5d` (deploy) |
| **The live Desgraciat run on quina-dev** (`tools/e2e/desgraciat-live.spec.ts`, opt-in with `QUINA_LIVE_CLOUD`). It found two cloud bugs, both fixed and deployed: phones never saw round 1's intro, because the engine journals round 1 at boot (`5ed3a84`); and the cloud refused a `standing` Check's live event (`92002a6`). Then it passed: intro, every landing, the Check, the winner, the round's end, nothing refused, nothing private | `5ed3a84`, `92002a6` |
| **`npm run sync-main`** (tools/git): brings the shared main up to origin without touching anyone's uncommitted work. It replays local commits in the object store, writes only the files origin changed, and refuses if one of them is being edited. Tested on throwaway repos (`npm run test:tools`, in `npm test` and CI) | `53c09db`, `b4c8981` |

## In progress

Nothing half-built. Card type per round and the Desgraciat round are done on Platform's side (see Done); both landed in steps A/B/C with Sound engine and Frontend.

## The next queue, in priority order

1. **Provisional hooks WARN in the preflight**, once Sound engine sends the field (see item 2).
2. **This year's pool** (before the tech rehearsal): measure it once prepared (1–4 Dec), then deploy-plan step 6. **Today's format stays** (orchestrator and Sound engine, 2026-11-25). The draft playlist has 86 songs at about 68 MB each (2 approved hooks a song): 5.9–7.9 GB, which fits in R2's 10 GB once last year's pool is pruned.
   - **Contingency (option d)**, only if the final pool goes past about 100 songs, or the user approves many hooks a song. It needs about 20 MB a song and ffmpeg with libopus on both laptops. Sound engine measured these commands:
     - push: the pool's source audio as it is (`audioDir`, about 3.5 MB) plus `cache/<id>/mix.json`; each stem `ffmpeg -nostdin -v error -y -i <part>.<window>.flac -c:a libopus -b:a 256k <part>.<window>.opus` (0.55× the FLAC); the rest (signatures/, snippet.flac, onset.npy, raw.json, data/) as today;
     - pull: `ffmpeg -nostdin -v error -y -i <source> -map 0:a -ar 48000 -c:a flac -sample_fmt s16 cache/<id>/mix.flac` (bit-identical PCM with the same ffmpeg), and each stem `ffmpeg -nostdin -v error -y -i <part>.<window>.opus -ar 48000 -c:a flac -sample_fmt s16 cache/<id>/stems/<part>.<window>.flac` (exact length, within 2 samples);
     - the manifest then lists the .opus and source files. The decoded FLACs stay local, so the preflight's hash check must skip them.
   - **Provisional hooks** (Sound engine, coming): a bulk approval of each song's top automatic hook, marked `provisional: true`, so a new pool can be rehearsed before the user's approval pass. The preflight should WARN when a playable song's best hook is provisional. Sound engine sends the exact field.
3. **The cards move (1–3 Dec, agreed with Sound engine and Frontend; nothing before 1 Dec, D80).** The 2026 pool (`data/pools/2026.json`, Sound engine's) uses `apps/cards/dist/cards.json`, which becomes this year's cards on 4–5 Dec. Last year's test cards move to `data/pools/default/cards/`. Sound engine commits first; then mine, on top:
   - `tools/e2e/show.spec.ts` and `desgraciat-live.spec.ts` read the cards through `loadPool().cardsJson` ($QUINA_POOL, else default), as the e2e's relay does;
   - the live run first checks that the cloud's `/cards/cards.json` is byte-identical to that pool's, and fails at once if not (after the 2026 deploy: `QUINA_POOL=2026`);
   - **deploys name their pool** (`--pool 2026`): a plain `npm run deploy` falls back to `default`, which would put last year's test cards and covers on the QR domain;
   - a preflight check that the cloud's cards.json matches the pool's (FAIL if not).
4. **The night's settings file** (D89, D97, D98; **blocked on U43**, which copy wins on the night): `data/nights/2026.json`, tracked in this public repo, prizes included. One file per edition, next to `data/pools/2026.json`, since the night's settings don't depend on which pool plays. It holds the whole GamePlan plus Admin's soundsDefault. Never in it: the sheet's money amounts, people's names, resume codes or Shuffle seeds (sponsors' names and logos pending U48, default yes). To build:
   - `npm run plan -- check|push|pull` (check: `checkGamePlan`; push: the laptop's relay `PUT /api/plan`, which the link carries to the cloud, newest wins; pull: the cloud's plan read with the laptop's token, written to the file);
   - a preflight WARN when the laptop's plan differs from the file.
   My default for U43: the file wins until the doors open; on the night the cloud's newest plan wins, and `plan pull` brings phone edits back into the file.
5. **Card sides and Parts, step B** (D100–D102; agreed with Sound engine on 25 Nov; waits on U54 and Sound engine's step A). One night pool. Each song has a `part`; card-types.json's `sides: [{side, part}]`; cards.json's `sides: [{side, lines}]`; `RoundPlan.side`. Mine, deployed before the engine journals `side`:
   - journal-check accepts `side`;
   - the projection's PublicRound.side and intro.side, 1 when absent;
   - Admin's resume point carries side (`-C<n>`);
   - the preflight's cards check reads `sides` (each side 3×4, its songs in its Part), and every round's Part is prepared;
   - the "side exists for that card type" check, and the protocol's `sideWarnings(plan, cardTypes)` (side 2 never played, a side's rounds not contiguous), in the preflight;
   - the cards.json conversion to `sides` is one commit by Frontend, which includes my two readers (the preflight's cards check, show.spec.ts), with no dual-shape reader (D84). Send Frontend that diff once step A's types exist; Frontend sends the hash before pushing;
   - show.spec.ts reads lines through the round's side; the plan fixtures.
   The default test pool: all songs in Part "1", both card types one side on Part "1".
6. The Pausa scene in the public feed, once UI proposes its shape (it reuses `pause {on}`; nothing new expected).

## Waiting on the user

- **deploy-plan step 6:** this year's pool (the playlist isn't final). Don't start.
- **deploy-plan step 7.4 (optional):** Access destinations for `quina.barrakudesbegur.org`. Until then, organizers and the laptop use quina-dev.
- **Open questions** in `docs/open-questions.md`: the player checked on desktop only (U19). The printed cards being public is answered (D78: public unless there's a reason).
- **The logo library** isn't uploaded yet. Admin's upload needs a person's Google login. The user offered to sign in and let Platform drive their Chrome, but that was called off. Only start it if the user asks directly.

## Known issues and risks

- **Prepared data.** The e2e and the media sync need the default pool prepared on this machine (`data/out`, `data/cache`); without it the e2e skips. CI has no prepared pool, so CI doesn't run the e2e.
- **Free plan.** A pessimistic night is about half the daily request quota; rehearsals the same UTC day share it (deploy-plan step 5).
- **R2 is 10 GB free;** last year's pool takes 6.6 GB, so it goes before this year's is pushed (step 6). **This year's pool may not fit.** Each song is about 92 MB in the bucket (the decoded `mix.flac` about 45 MB, plus `stems/` about 47 MB). With the shared Hold and Interval music, that's room for about **100 songs**. If the playlist is bigger, the options are: R2 storage beyond 10 GB (a few cents a month, but it needs the user's OK because the rule is free plan only); leaving the stems out of the bucket and rendering them on the spare laptop; or copying the overflow laptop to laptop on a USB disk. Measure it once the pool is prepared (2 Dec): `npm run media -- prune` shows the bucket against 10 GB.
- **The shared tree.** Other sessions' uncommitted edits sit in the same checkout: commit by path, and test the committed state in a detached worktree of HEAD (node_modules symlinked, `QUINA_OUT_DIR` pointing at the real `data/out`). Never `rm` inside a copy whose node_modules is a symlink. When main and origin have diverged, use `npm run sync-main`, never `pull --rebase --autostash`. For the e2e in a worktree, also link `data/out`, `data/cache`, the untracked `data/media/*` folders and `tools/prep/.venv` (the relay renders Blends with it; without it the relay crashes at the first Check).
- **The live Desgraciat run** (`QUINA_LIVE_CLOUD=https://quina-dev.barrakudesbegur.org npx playwright test desgraciat-live` in tools/e2e) leaves a rehearsal Game as quina-dev's current Game. Its phone screenshots go to `tools/e2e/results/`. Run it again after any change to the feed or the player's Desgraciat screens.
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
