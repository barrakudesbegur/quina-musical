# Platform handoff

The single place to resume Platform's work from. Sessions get cleared, so keep it current at each milestone.

## Now (2026-11-27)

- **D227 and D235, the realistic run in production (27 Nov):**
  - **The edition tool's shared parts** (tools/edition, `npm run edition`): `check`, `upload` (preview, then `--yes` saves the cloud's plan to `data/link/backups/` and PUTs; `--start "YYYY-MM-DD HH:MM"` moves the start, Begur's time, and the doors an hour before, for a test, without touching the file), and `logos` (sips to the 300 KB limit, POST /api/media, paths written into the plan). The laptop's service token may now save the plan and upload images (a separate agent token is U63). `build 2026` assembles the plan source, the repertoire's songs (Sound engine's `editionSongs`) and its cards (song ids) into `data/editions/2026.json`, checked with the protocol's `checkEdition` (628 KB; committing it waits on U75).
  - **The plan is up on quina-dev:** `data/editions/2026.plan.json` (tracked): D192's order with D193's and D226's sides, the 10-minute Descans after round 6, the Orchestrator's example bundles (96 prizes, 58 sponsors, 55 logos; no money), 27 Dec times. The old plan is saved in `data/link/backups/`. The test's start time is U204: re-upload with `--start`, then a plain upload restores 27 Dec.
  - **The 2026 temporary cards and covers are on both names** (`db958fd2`): deploys now name their repertoire (`QUINA_REPERTOIRE=2026 npm run deploy`; assets.ts refuses dist/ without one).
  - **The voice cues sync** (roots `voice-cache` and `voice-data`, D198, D202–D204; `voice/` left out of the default repertoire's `cache` and `data` roots), with a preflight check (FAIL a missing cue or file, WARN placeholders). The Worker's `SYNC_ROOTS` takes them, so they go up with the next push.
  - **The 2026 media is in R2, by content (D248, 27 Nov, 10 pm):** `manifests/2026.json` names 2,796 files in 2,785 blobs (`blobs/<sha256>`), 8,087 MB, 0 unnamed: identical file by file to the v2 copy it replaced. A test pull into an empty folder (`npm run media -- pull --repertoire 2026 --into <dir>`) wrote every file and a second pull wrote 0; the v2 `repertoires/` copy is deleted. When Sound engine changes hooks, stems or voices, push again (only new hashes go), then `npm run media -- prune` (dry run) and `--yes`. R2's transient `10001` errors happen (twice in about 2,000 PUTs tonight); since `e3de22c4` they're 503 and retried. `data/*/repertoires/2026-before-final` is the old fetch's, never pushed; deleting it waits on the user.
  - **The preflight** now FAILs a stale show build (Sound engine's build stamp, `distProblem`) and WARNs provisional hooks. My tests remove their temp folders (5,500 had piled up, 2.1 GB, deleted).
- **In progress (27 Nov, evening), nothing half-built.**
  - **Step 6.5 is done (27 Nov, about 8:15 pm; D246, D247):** all of `pools/` is deleted: 1,903 files one by one from its old manifest (`wrangler r2 object delete`), then the rest (older files the manifest no longer named) with the dashboard's folder delete of `pools/default/`, at the user's suggestion. The bucket root holds only `repertoires/`; `/api/sync` shows 2026 with 2,796 files, 8.18 GB, and a dry run shows 0 to upload. The rule `pools-before-d178` is removed: nothing in the bucket expires (D246). U161 is moot.
  - **D248 is live** (`5cc26fce`, then `e3de22c4`): the routes, push, pull and prune as the README's media section says; deploy-plan step 6 is the runbook.
  - **U204, the test's start time, from the Orchestrator:** `npm run edition -- upload data/editions/2026.plan.json --repertoire 2026 --start "2026-11-27 HH:MM"` (preview), then the same with `--yes`. After the test, the same without `--start` restores 27 Dec 17:00/18:00.
  - **Every deploy from now:** `QUINA_REPERTOIRE=2026 npm run deploy`, from a detached worktree at the tested sha, after the e2e there.
- **Resume here (the deploy cycle, as run all day on 27 Nov):**
  - Make a detached worktree in your scratchpad (`git worktree add --detach <scratchpad>/wt-fix origin/main`) and link it as "The shared tree" says below. Then for each sha: `git checkout -q --detach <sha>`, and relink new root node_modules entries (`for e in <repo>/node_modules/*; do n=$(basename $e); [ "$n" = "@quina" ] && continue; [ -e node_modules/$n ] || ln -s "$e" node_modules/$n; done`).
  - The e2e: `cd tools/e2e && QUINA_OUT_DIR=<repo>/data/out npx playwright test --reporter=line` (1 passed, 1 skipped, about 4 min). Don't run the cloud suite (`npm test` in apps/cloud) at the same time, nor in the shared checkout: once it hung in link.e2e for 10 minutes.
  - Deploy: `cd apps/cloud && QUINA_REPERTOIRE=2026 npm run deploy`. Verify both names (`/`, `/26/123`; `/console/` and `/admin/` 302 on quina-dev), and `/api/ping` and `/api/plan` with the token from `.env.link` (`QUINA_CLOUD_URL`'s wss origin as https; headers `CF-Access-Client-Id` and `CF-Access-Client-Secret`).
  - Then a deploy-plan.md row and this file's deploy list, committed by path; `git fetch`, rebase onto origin (check the incoming commits don't touch apps/cloud), push the explicit sha.
- **The player's PWA is live (`956645b2`, 27 Nov, D221–D223).** Agreed with Frontend: the worker `/player-sw.js` (scope `/`, `updateViaCache: 'none'`; never `/sw.js`, which stays last year's kill switch), caches prefixed `quina-player-`, `/player.webmanifest`, fixed icons under `/icons/` (`player-192`, `player-512`, `player-maskable-512`, `player-badge-96`, `apple-touch-icon-180`, all `.png`), from the UI build's public folder at `apps/show/dist/`. The worker never answers `/console/`, `/admin/`, `/api/`, `/ws/`, `/media/`, `/sw.js`, non-GET or cross-origin requests (Access's 302 must never be cached). Done: scripts/assets.ts copies the three into dist/ (and warns while the UI build lacks them); static/_headers gives them `no-cache` (the manifest `application/manifest+json`) and hashed `/assets/*` a year, immutable; test/node/static.e2e.test.ts checks it; live since `650d9089`. When Frontend's files land: check them live after that deploy (the deploy's PWA warning goes).
  - **For Sound engine when the pause lifts** ("not now" in docs/HANDOFF.md since 27 Nov: Sound engine does important tasks only): the relay's `--dist` serving (apps/show/relay/server.ts `serveFile`, one `cache` per target) needs the same `no-cache` for `/player-sw.js` and the manifest, and a MIME type for `.webmanifest`. Service workers need a secure context, so on the venue LAN over plain http (not localhost) the worker won't register at all; the relay part matters only for localhost.
- **Just done (26 Nov):**
  - **Thirty-four deploys** (deploy-plan.md), each tested on its sha first:
    - `94b395be` (`2503050`): the plan-save fix;
    - `fddfdc1d` (`a89826f`): step 1 of the paced Check;
    - `ec6983b0` (`242a8cd`): step 2 (D127–D165);
    - `d963856b` (`ba17a40`): the Desgraciat's finale (D166–D172);
    - `18f816f5` (`fd9feaa`): a song's first play slower (D174, D175). The shared reducer folds `playedBefore`; the settings check takes `remoteShake` (D148). The new state fields stay off phones (the projection copies named fields only).
    - `c93f219c` (`161c3f6`): the repertoire (D178), D177 and D180. The media sync keeps each repertoire under `repertoires/<name>/` (v2 manifest); `fellLast` stays readable in older journals;
    - `228d23ab` (`f4185fd`): the cloud's step B of card sides (queue item 4);
    - `5a57015e` (`ec4912c`): cards in sides, with my two readers (`5ff17b7`);
    - `f63790a9` (`593fef2`): screens only (round names, the phones' confetti);
    - `0948f16b` (`c612e95`): screens and card-types.json only (the finale's screens, D193's labels, D192's Throw, D194);
    - `e86ecb72` (`2fe0ace`): the console only (D195, D196, D199);
    - `e1fb7821` (`1dfc1ea`, 27 Nov): Frontend's labels and the phone's add-card drawer, and the preflight's clock check (`8c884a8`: time.apple.com from the Laptop group, WARN past 2 s, FAIL past 60 s, since the doors cues count down by it);
    - `d2155f8a` (`92f531e`): the voice cues' engine side and the drum roll, and the «Veus» slider;
    - `514a042c` (`5d91be5`): Frontend's first modern-web fixes;
    - `55028805` (`5fda630`): the audit's batch 2 and reduced motion (D209);
    - `057f4fcc` (`6aff25e`): the player's maximum width (D212) and the UI sounds (D206–D208).
    - `3cb67cbf` (`9a168b6`): screens only («Aquest cartró no existeix», the garland's lights, the falling comet, beams to the edge).
    - `c7289263` (`a843dff`): screens only (the icon family, H1, R8).
    - `9ca2350b` (`81ba3e0`): screens only (the design system's foundation, D210, D211; the 15.4 fallbacks go, D219). The gallery (`apps/ds`) stays out of the build.
    - `1da4c336` (`cca19f4`): screens only (the player's fixes from the user's Android test: no tap highlight, no pull-to-refresh, full-height layers).
    - `bd1dbd97` (`8912640`): screens only (no welcome flash on reload, the home's labels);
    - `650d9089` (`1cd2bb9`): mine, the serving of the player's PWA (no-cache for its worker, manifest and icons; hashed assets a year, immutable). Checked live on both names.
    - `7497175b` (`13e7c19`): screens only (the ninos, the sponsors redone D216, the QR panel, the card and song components D1–D6).
    - `7bb3cc92` (`de04d5e`): screens only (the panels family: native dialogs and sheets, the drawer fixes, tickets and prize cards).
    - `133446fd` (`c7e9058`): screens only (the buttons family: the hold buttons, the SoundPad grid, the "on" stripes, the pressed look).
    - `ae688f69` (`47a6e09`): screens only (the ✗ marks back to the error red, long card names, the projector's last three on SongTile).
    - `1909c987` (`17bc4ca`): screens only (the phone's sponsors row, components on the palette, the Break's countdown Ring, the error red).
    - `a0650f6e` (`efe30fb`): screens only (the controls family: switches, tabs, the Cerca search, the slider, the «Editar» drawer).
    - `acf7c5a2` (`6dbc57d`, pushed as `3aa5879`): Frontend's phone home and D226, Admin's banner and sounds sent to the phones, and my GET for them;
    - `c4449e5c` (`1c367a1`, pushed as `2968b58`): the laptop's token saves the plan and uploads logos; the preflight's show build and provisional hooks; tests clean their temp folders;
    - `db958fd2` (`2c37ec3`, `--repertoire 2026`): the 2026 temporary cards (both types two-sided) and 136 covers on both names.
    - `bc4113ec` (`81c8205`, `QUINA_REPERTOIRE=2026 npm run deploy`): Frontend's `96f6ee8` (the home's fixed garland, the drum's landing, your song's gold), the push's `--dry-run` and the deploy's repertoire guard; the 2026 cards and covers kept.
    - `8ae5bf1d` (`067fd01`, repertoire 2026): the Worker's sync takes the voice cues' roots (`voice-cache`, `voice-data`).
    - `956645b2` (`48fda40`, repertoire 2026): Frontend's player PWA (D221–D223): `/player-sw.js`, `/player.webmanifest` and `/icons/*` served `no-cache` on both names; the deploy's PWA warning is gone.
    - `9ceb373f` (`ea5c234`, tested as `a38dba4`, repertoire 2026): D237's public drum seeds for phones (`PublicRound.drumSeed`, `PublicSpin.spinSeed`; the Spin's `drum` stays private, U206), and D229's `soundTest` through the cloud's command check. Frontend's dev copy of the feed (`apps/player/feed/project.ts`) doesn't carry the seeds yet: theirs, with the phone's drum.
    - `ca3c0a3d` (`8659ff1`, tested as `3ded3ed`, repertoire 2026): Frontend's `3e3cb15` and `e190854` (the drawers, forms and toasts, add another; the console's Descans picker, Sons automàtics, Prova de so, Cartrons venuts); the media sync's retries and resume; the settings' `finalLapStinger`/`voicesOn` optional and `autoSounds` checked (D237), so the engine drops the mirrors.
    - `a242fba5` (`a5db23c`, repertoire 2026): Frontend's phone drum matching the projector's (`3a0d00b`, D237, the drum's physics in packages/rules) and the cells' playing ring; Sound engine's `addCardsInPlay` (journaled as `cards.set`), `twoLevelHold` and the relay's `from` stamps, and the mirrors' removal (`717cbf3`).
    - `5cc26fce` (`f817bf9`, repertoire 2026): D248, R2 by content (blobs and v3 manifests); v2's routes gone.
    - `e3de22c4` (`51a5aa2`, repertoire 2026): Frontend's `7d68998` and everything under it (the Premis drawer, the throw and storm icons, the lock UI); D234's cloud ids; the blob PUT's 503 for R2's transient errors; the preflight's «Reduce motion» WARN.
    - `837b4f33` (`66f0968`, repertoire 2026): Frontend's cascade layers (production orders CSS as development does; the hold buttons' `touch-action` in production) and the CSS order check.
    - `64ced39e` (`70065cb`, repertoire 2026): D251, «Quina del Desgraciat» on every screen; the 2026 card-types.json's especial side 1 «Desgraciat» (Sound engine updated the file; R2 got the one changed blob, and the old one was pruned).
  - **The cloud side of step 2:**
    - `check.started` replaces `check.scheduled`; reveals stay off phones;
    - Pausa reaches phones only with its overlay (D135);
    - `settings.volumes` is checked up to VOLUME_MAX;
    - the GameRoom folds the journal's newest volumes into `plan.volumes` (domain/volumes.ts), and a plan saved from Admin or the laptop keeps the cloud's.
  - **The finale:** `finale.set` is checked and publishes nothing (U150). Its wins are standing claims (`manual: true` when a removal decided it).
  - **The e2e** runs the presenter-paced Check (`0cabdf1`): a claim reviewed then discarded, a Line by presses, and a two-card Bingo with automatic reveal (the second card fails, then the press for the Celebration). Green on step 2 and on the finale.
    - **Frontend's rule:** read the stage's `check` only while its scene is `check`. A lone pass goes straight to the Celebration.
  - **R2:** the breaks set, the intro, the throw song and Pausa's set (in `pausa/`) are pushed. The old top-level `interval-*` keys left the manifest and wait for the post-night prune (agreed with Sound engine: under a cent a month). Hold's `audition/` is excluded.
  - **The plan-save bug** (`2503050`): edits that change nothing public were lost when the GameRoom restarted. U126 asks the user to check quina-dev.
- **Next:**
  - **D234's lock through the cloud is live** (`e3de22c4`): each cloud console's commands carry `from: cloud:<its hello clientId>`, and the link hands the relay `cloud.consoles { ids }` (Sound engine's `ed63184`). A laptop's link must run the new code (`npm run link` restarted) to forward the list. Frontend checks it live.
  - remember that one Worker serves both names, so every deploy also changes what the QR codes open;
  - Sound engine's `upcoming` event (D170, getUpcoming) is private: add it to the scans when it lands;
  - the fail cue's 3 s in `check` (Sound engine's `a54d866`): the e2e can check the stage's `data-cue="fail"` there;
  - **D178**: each set of 70 songs is a pool (Pool 1, Pool 2); what the tools prepare together is the **repertoire** (agreed with Sound engine and the Orchestrator; "library" is the logo library's). My side is `40e3df1` (deployed as `c93f219c`): `--repertoire` everywhere, R2 under `repertoires/<name>/` (manifest v2), the preflight's Repertoire group. The old `pools/` keys stay, unreachable by the tool, until deploy-plan step 6.5 expires them (after this year's push: until then they're R2's only copy of the Hold and Interval music);
  - this year's songs to R2 as soon as they're prepared (U55, D113). Prune last year's after the night;
  - 1–3 Dec: the cards move into the repertoires (queue item 3; deploys already name their repertoire).
- **Not building:** Pausa in the journal (U111); the edition file's `build`, cloud-kept versions and reset (U68–U75); a token of its own for agents (U63).
- **Blocked:** nothing.
- **Waiting on the user** (docs/open-questions.md):
  - optionally, the Access destinations for `quina.barrakudesbegur.org` (deploy-plan step 7.4);
  - **U16**, the logo library upload;
  - **U19**, real devices;
  - **U55** (Sound engine's), preparing Pool 1;
  - **U63**, **U68–U75**: the plan tool, its `quina-agent` token, and the edition file;
  - **U64**, a glance at Cloudflare's billing for R2's payment method;
  - **U79** and **U150**: whether phones show a Review, and the finale;
  - **U126**, whether any Admin edits on quina-dev were lost to the plan-save bug;
  - the permission rules for deploys and R2 pushes (`/permissions`), which only the user can add.

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
| By Fri 4 Dec | This year's repertoire measured in R2 | the repertoire prepared (1–4 Dec) |
| Before the tech rehearsal | This year's repertoire pushed, the old copies pruned from R2; the show laptop and the spare synced (deploy-plan step 6) | the repertoire prepared; hooks and stems done |
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
2. **This year's repertoire** (D113: each pool goes to R2 as soon as it's prepared; going past 10 GB is fine): measure it, push it, and sync both laptops before the tech rehearsal; prune last year's songs, and this year's after the night (deploy-plan step 6). **Today's format stays** (orchestrator and Sound engine, 2026-11-25). The draft playlist has 86 songs at about 68 MB each (2 approved hooks a song): 5.9–7.9 GB, which would fit in R2's 10 GB on its own.
   - **Contingency (option d)**, only if the final repertoire goes past about 100 songs, or the user approves many hooks a song. It needs about 20 MB a song and ffmpeg with libopus on both laptops. Sound engine measured these commands:
     - push: the repertoire's source audio as it is (`audioDir`, about 3.5 MB) plus `cache/<id>/mix.json`; each stem `ffmpeg -nostdin -v error -y -i <part>.<window>.flac -c:a libopus -b:a 256k <part>.<window>.opus` (0.55× the FLAC); the rest (signatures/, snippet.flac, onset.npy, raw.json, data/) as today;
     - pull: `ffmpeg -nostdin -v error -y -i <source> -map 0:a -ar 48000 -c:a flac -sample_fmt s16 cache/<id>/mix.flac` (bit-identical PCM with the same ffmpeg), and each stem `ffmpeg -nostdin -v error -y -i <part>.<window>.opus -ar 48000 -c:a flac -sample_fmt s16 cache/<id>/stems/<part>.<window>.flac` (exact length, within 2 samples);
     - the manifest then lists the .opus and source files. The decoded FLACs stay local, so the preflight's hash check must skip them.
   - **Provisional hooks** (Sound engine, coming): a bulk approval of each song's top automatic hook, marked `provisional: true`, so a new repertoire can be rehearsed before the user's approval pass. The preflight should WARN when a playable song's best hook is provisional. Sound engine sends the exact field.
3. **The cards move (1–3 Dec, agreed with Sound engine and Frontend; nothing before 1 Dec, D80).** The 2026 repertoire (`data/repertoires/2026.json`, Sound engine's) uses `apps/cards/dist/cards.json`, which becomes this year's cards on 4–5 Dec. Last year's test cards move to `data/repertoires/default/cards/`. Sound engine commits first; then mine, on top:
   - `tools/e2e/show.spec.ts` and `desgraciat-live.spec.ts` read the cards through `loadRepertoire().cardsJson` ($QUINA_REPERTOIRE, else default), as the e2e's relay does;
   - the live run first checks that the cloud's `/cards/cards.json` is byte-identical to that repertoire's, and fails at once if not (after the 2026 deploy: `QUINA_REPERTOIRE=2026`);
   - ~~deploys name their repertoire~~ done (`81c8205`): `QUINA_REPERTOIRE=2026 npm run deploy`; assets.ts refuses dist/ without a named repertoire, so last year's test cards can't reach the QR domain by accident;
   - a preflight check that the cloud's cards.json matches the repertoire's (FAIL if not).
4. **Card sides and pools, step B** (D100–D102, D178; Sound engine's step A is `e8e10d3`/`e1c54ec`). **Done in `3cf30a6`:** journal-check takes `side` (1–9, absent for side 1); PublicRound.side and the public intro's side, only when not 1; Admin's resume point carries it (`-C<n>`); the preflight's Card sides check (the protocol's `sideWarnings`, pools counted from songs.json: FAIL for a round on an unprinted side or an empty pool, WARN for a printed side no round plays). Deployed as `228d23ab`, before any side-2 round. **The cards.json readers** (on Frontend's `dd240f2`, cards in `sides`): the preflight's cards check reads each card's sides against its type's (card-types.json), each side 3×4 with its songs in its side's pool, and an old card's `lines` as side 1, as the engine's `cardFace` does; a side whose pool has no songs here (today's test repertoire has no pool 2) warns. show.spec.ts reads the round's side. The default test repertoire: all songs in pool 1, so its cards' side 2 is drawn from the whole repertoire.
5. The Pausa scene in the public feed, once UI proposes its shape (it reuses `pause {on}`; nothing new expected).

6. **The presenter-paced Check, step 2** (D107–D110; agreed with Sound engine, 26 Nov; after Sound engine's protocol step 1):
   - journal-check and the projection accept `claim.stopped` and `claim.dropped`;
   - the public CheckInfo (total, revealed[], auto, cue) never says in advance whether the card passes;
   - the projection strips ClaimInfo's private `markedCard`, `cueNext` and `revealUntil`; the e2e's forbidden keys include them;
   - flaggedDecisions is reduced to a valid card with `notSold`;
   - Admin's Games and the export show stopped and dropped claims.
   Deploy it before Sound engine's step 3 journals them. That same day, the e2e moves from `decide` to `checkNext {claimId, step}` presses: one claim by presses, one with checkAuto, one stopped then dropped, and a two-number claim. The live Desgraciat run uses presses.
7. **The plan tool (U63; D111: the cloud is always the source of truth, no settings file in git).** Proposed: `npm run plan -- pull|check|push` on a gitignored working copy (data/link/plan-edit.json). Push shows the diff and refuses if the cloud's plan changed since the pull, so a phone edit is never overwritten. It uses a separate Access service token `quina-agent` that may only GET/PUT /api/plan (apps/cloud/.env.agent, never on the show laptops). Build nothing until U63.

## Waiting on the user

- **deploy-plan step 6:** this year's repertoire (the playlist isn't final). Don't start.
- **deploy-plan step 7.4 (optional):** Access destinations for `quina.barrakudesbegur.org`. Until then, organizers and the laptop use quina-dev.
- **Open questions** in `docs/open-questions.md`: the player checked on desktop only (U19). The printed cards being public is answered (D78: public unless there's a reason).
- **The logo library** isn't uploaded yet. Admin's upload needs a person's Google login. The user offered to sign in and let Platform drive their Chrome, but that was called off. Only start it if the user asks directly.

## Known issues and risks

- **Prepared data.** The e2e and the media sync need the default repertoire prepared on this machine (`data/out`, `data/cache`); without it the e2e skips. CI has no prepared repertoire, so CI doesn't run the e2e.
- **Free plan.** A pessimistic night is about half the daily request quota; rehearsals the same UTC day share it (deploy-plan step 5).
- **R2 is 10 GB free, and going past it is fine (D113).** Last year's songs take 6.6 GB. For size: Each song is about 92 MB in the bucket (the decoded `mix.flac` about 45 MB, plus `stems/` about 47 MB). With the shared Hold and Interval music, that's room for about **100 songs**. Past that, R2 just costs a few cents a month (D113); option d above shrinks it if needed. Measure it once the repertoire is prepared (2 Dec): `npm run media -- prune` shows the bucket against 10 GB.
- **The shared tree.** Other sessions' uncommitted edits sit in the same checkout: commit by path, and test the committed state in a detached worktree of HEAD (node_modules symlinked, `QUINA_OUT_DIR` pointing at the real `data/out`). Never `rm` inside a copy whose node_modules is a symlink. When main and origin have diverged, use `npm run sync-main`, never `pull --rebase --autostash`. For the e2e in a worktree, also link `data/out`, `data/cache`, the untracked `data/media/*` folders and `tools/prep/.venv` (the relay renders Blends with it; without it the relay crashes at the first Check).
- **The live Desgraciat run** (`QUINA_LIVE_CLOUD=https://quina-dev.barrakudesbegur.org npx playwright test desgraciat-live` in tools/e2e) leaves a rehearsal Game as quina-dev's current Game. Its phone screenshots go to `tools/e2e/results/`. Run it again after any change to the feed or the player's Desgraciat screens.
- **Don't commit** `legacy/2025/last-year-data/` (last year's app database export: personal data) or anything from `legacy/2025` that isn't Platform's.
- **macOS has no `timeout`:** use `perl -e 'alarm N; exec @ARGV' …`.

## How to run and test

From the repo root, once: `npm install` (workspaces). Then:

**Test:**
- `npm test` (repo root): the show's suites, then the cloud's (`apps/cloud`: typecheck, Node tests, the Worker in workerd).
- `npm run test:e2e` (repo root): one whole show, headless, with the phones' production path. It builds apps/show first and needs the prepared default repertoire. About 4 minutes.
- `npm run relay-audit` in apps/cloud (on a build): the relay lockdown checks.
- `npm run loadtest -- --report reports/loadtest-$(date +%F).md` in apps/cloud: 400 phones.

**Run:**
- `npm run dev` in apps/cloud: wrangler dev on http://localhost:8787 (copy `.dev.vars.example` to `.dev.vars` first).
- `npm run link` in apps/cloud: the laptop link, relay → cloud (`.env.link` for quina-dev).
- `npm run preflight` in apps/cloud: before every rehearsal and show.
- `npm run setup:laptop` (repo root): a spare show laptop, safe to rerun.

**Deploy (quina-dev, within the guard-rails in docs/team.md):** `npm run build` in apps/show; then in apps/cloud `npm test`, `npm run assets`, `npx wrangler deploy`; check `/api/health`, the player, a locked route (403 or the Google login); log it in deploy-plan.md with its undo.
