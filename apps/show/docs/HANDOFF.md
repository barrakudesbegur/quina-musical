# Sound engine handoff

The single place to resume the sound engine's work from. It was first written when the user paused the work (2026-11-24) and is kept current at each milestone.

**What this covers:** the show engine and its transitions, Signatures, Suspense and its Decoy teases, the song preparation pipeline (tools/prep), `@quina/protocol` and the Game journal. The journal is shared with the platform session.

**Where else to look:**
- The decisions are in `GLOSSARY.md`, `docs/how-the-quina-works.md` (the current-state read of a whole night), `docs/mixer-design-decisions.md`, `docs/show-ui-and-platform-decisions.md` (its "Changes" section) and `docs/adr/`. They override older research.
- The dates are in `docs/timeline.md`: the playlist is final on Tue 1 Dec, the night is Sun 27 Dec.
- The team roles are in `docs/team.md`. Questions only the user can answer go in `docs/open-questions.md`.

## Now (kept current at each milestone)

- **27 Nov, evening (D227, D230, D235: the realistic run). The user lifted the pause for this work.**
  - **Pushed today:** 3cb10aa (repertoire 2026 tracked: `data/repertoires/2026.json`, `2026/pools.json`, `songs.json` 136 songs, pool 1 = 1–70, pool 2 = 71–136 without the 4 tracks also in pool 1 (U199); `tools/prep/pools.py`, letter-by-letter order D238; `hooks_auto.py --provisional`, the flag `provisional: true` on hooks in the analysis and index, song flag `provisional_best_hook`, the audition page's "best (provisional)"); a6cc4a5 (113 provisional overrides); f89d972 (`npm start` builds first; `vite build` stamps `dist/build.json`, the relay with `--dist` refuses a stale or unstamped dist: relay/build-stamp.ts); ca46f3a (D239: a song left playing loops its last phrase, else its last 4 bars, never hands over by itself); c528ee9 (`EditionFile`, `checkEdition` in packages/protocol/edition.ts; `tools/edition/songs.ts` for Backend).
  - **Media (gitignored):** the final playlists are fetched into `data/media/2026/pool1/` and `pool2/` (the old fetches are in `pool2-before-final/`; pool 1's old list stays in `output/`); all 136 audio files are in `data/media/2026/output/songs/`. Swapped for YouTube Music uploads: Only Girl, Good Feeling, La Bicicleta, A Dios Le Pido (old files in `output/rejected/`). Kept: YMCA (official video, +10 s), Antes Muerta Que Sencilla (official video, 95 kbps). The old 2026 data is moved aside as `data/out|cache/repertoires/2026-before-final` (delete nothing, D80). Temporary cards from both final pools: `data/media/2026/cards-TEMPORARY-not-for-print/` (699).
  - **Also pushed (27 Nov evening):** 694ec1d D228 `intervalSet { set }` in a break; 517ab60 D237 auto-sound toggles (`AUTO_SOUNDS` drumTicks, djFx, finalLap, winFanfare, failFanfare, voices; `setAutoSound`; `game.autoSounds`; off mutes the node in graph.setVolumes); fd16345 D229 `soundTest { kind }` (SOUND_TEST_KINDS, runtime `soundTest()` in main.ts, only in `before`); 2a0aa645 D237 the drum's public `drumSeed` (round.started/resumed, record) and per-Spin `spinSeed` (transition.scheduled), `drumOrder` in packages/protocol/drum.ts, the projector's drum uses both.
  - **Repertoire 2026 is in R2** (Backend, 2,796 files, 8.2 GB; /api/sync lists 2026): all 136 songs playable on provisional best hooks. When hooks or stems change, tell Backend to push the difference. The old fetch's data stays in `data/out|cache/repertoires/2026-before-final` until the user OKs deleting it (D80).
  - **Also pushed:** f94c7ec0 (D234: `twoLevelHold` / state `twoLevelHeld`, the relay stamps each command's `from`; `addCardsInPlay` with `cards.lastAdd`; the sound test lifts the mutes; `formatCardRanges` in the protocol), 717cbf35 (the `finalLapStinger`/`voicesOn` mirrors gone; `autoSounds` required; old journals restore through `autoSoundsOf`). Both built by subagents (D240), reviewed and tested here. Known limit: consoles through the cloud share the link's clientId for the lock (in Backend's Next list).
  - **Drum (D237, D249), pushed:** aa865883 (`state.round.drumSeed`), d7ef205a (the solver test bounds CPU time, so a busy laptop passes), 7ec0b6af + 39a39f01 (drum-back: a returning card goes to its drumOrder place; `drumBack`/`cancelTransition.drum` carry `ids`; a Back turns the shortest way, 0.9–1.6 s; a cancel brakes as before, then glides 0.8–1.6 s, the Back's timing so a far card never whips; reduced motion: at once; headless check of 4000 cases in the scratchpad). The solver now lives in packages/rules (drum-solver.ts, drum-physics.ts; Frontend moved it): edit it there. Phones don't model the show laptop's «Reduce motion»; Backend's preflight WARNs.
  - **D234 lock, pushed:** 75fcead1 (the engine refuses `hold`/`pause`/`suspense` from anyone but the `twoLevelHeld` holder, `busy` "held by <id>"; the sound test's win and fail steps play their fanfares), ed631847 (the relay keeps a `cloud:<clientId>` `from` on the cloud socket only, and folds `cloud.consoles { ids }` into `relay.clients`; types in packages/protocol). Backend builds the cloud side (the GameRoom stamps `cloud:` + the console's hello clientId, sends `cloud.consoles`).
  - **Waiting on the user:** U199 (the 4 tracks in both pools: swap, or pool 2 at 66), U205 (Parlem's 40 s takeover), U206 (the drum's landing tile early). Backend projects `drumSeed`/`spinSeed` to the phones (queued with them).
  - **28 Nov, the night's data work (all pushed):** D260 clean names (0800e5e8: `printTitle`/`printArtist` in songs.json from tools/prep/print_names.py + the tracked `data/repertoires/2026/print-names.json` by Spotify id, 16 fixes; every output carries them in plain `title`/`artist`). D268 songs in several pools (d2a36f2e: `pools` per song, one id per shared song; Backend's readers 7c2c6a5; the cards generator reads `pools`). The user's playlist edits renumbered 2026 (78aef631: tools/prep/renumber.py moves every per-id file by Spotify id, retired tracks to `_retired/`, record `data/out/repertoires/2026/renumber-2026-11-28.json`): 135 songs, pool 2 = 65 own + 5 shared (5, 44, 46, 54, 62), new #93/#112 prepared. Temporary cards remade with card design's generator (a3-6 layout, `checkLabel` in card-types.json, protocol 9689b2c0). Covers audit: data/media/2026/output/covers-report.md (#122 replaced; #5/#93/#112 settled by the user's new tracks; #117 kept).
  - **Next, mine:** D268 step 3, drop `pool` (pools.py, analyze.py's index, the engine's older-index fallback, both songs.json) once Backend's 2026 push is done. Later (C): the Pausa, break and Hold music into the repertoire, a design with Backend first. A cover fix is only a local file today (`covers.py --force` would undo #122): make cover overrides durable through print-names.json or a sibling file if the user picks more.
  - **Found today:** the user's production test ran a dist built on 25 Nov (no Pausa, no new Check), which explained bugs (b) and (c); the stale-build guard prevents it now. 17:13: the disk fell to 198 MiB (swap 10 GB, plus about 12 GB of old headless-Chrome profiles in /private/tmp/claude-501); it recovered by itself.
  - **Canvas comments (team.md):** only the session the user names reads them, when the user says so; no watches or auto-replies. Web UI work loads the modern-web-guidance skill first.
- **Before 27 Nov evening:** my last engine range was 92f531e, deployed as d2155f8a.
  - **Shipped 26–27 Nov:**
    - D174/D175 (5bcf1e3): a song's first play in the Game gets the Pace × 22/14 on its best hook; `GameRecord.playedBefore` (foldPlayed); targets and the Schedule count first plays (per pool since step A).
    - 161c3f6: D177 (A held, then B, turns the running Spin into a Suspense; `suspense.started { fromSpin }`), the repertoire rename (D178: `data/repertoires/`, `relay/repertoire.ts`, `tools/prep/repertoire.py`, `--repertoire`, `QUINA_REPERTOIRE`, `/api/repertoire`; outputs in `data/out|cache/repertoires/`), D180 (no shared win in the Desgraciat: `standingRun`, a landing that would take out everyone left counts for none; the Desgraciat's Shuffle rule `none`; `FinaleInfo.winner`; no `fellLast`).
    - Step A (49fe19a) and B (f4185fd, Backend), cards in sides (ec4912c, Frontend): `pool` per song, card-type `sides`, `cardFace`, `RoundPlan.side`, `side` on the round commands, state, journal (absent for 1), record and token `-C<n>`, `sideWarnings`. The finale lists each fallen finalist (`fallen`).
    - D183 (593fef2): no fallen finalist comes back by hand; "fallen" is reckoned among the finalists sent, so the room's last players who fell on one song can be entered.
    - D121 (71157bb): a reviewed Claim whose Check left the screen comes back with its marks.
    - c612e95: D194 (no `throw` on the end screen), a planned Throw is its break's length (`breakSecAfter`; the 2026 night ends about 9:45 pm), D193's split in my docs and fixtures (Quines 1–5 side 1, 6–10 side 2).
    - 92f531e: the voice cues and the drum roll (D198, D202–D204): `VOICE_CUES`, `setGame { voicesOn }`, `voiceSkip`, `padHold { effect: 'drumroll', on, intensity }`, state `voice { cue, sinceMs, durationMs }` / `voiceNext` / `padHold`, the `voices` slider, `DRUMROLL_LAND_AFTER_SEC`. roundIntro and endGame play theirs at once over the music they start; the doors' countdown (from the plan's `startAtMs`, never before `doorsAtMs`) and "Tornem en dos minuts" wait for quiet and drop after 60 s. Runtime: `audio/voice.ts` (VoicePlayer, `graph.voiceDuck`), `audio/padhold.ts` (DrumRoll). `tools/prep/voices.py` (prepare step `voices`) made 23 placeholders (macOS `say` "Mónica", tones) in `data/cache/voice/` + `data/out/voice/index.json` (`placeholder: true`); the user's recordings go in `data/media/voice/<name>.mp3` under the same names, then rerun it.
  - **Waiting (don't start without the Orchestrator's relay):**
    - the user: U166 (the music during a review with no reveals: (a) far down for the whole review is my proposal), U167 (the specials' pool), U173 (the night's start cue: `start` exists, nothing plays it), U176 (`doors-3`), U177 (the drum roll's vibration, Frontend's), U178 (more `padHold` effects: only names in `PAD_HOLD_EFFECTS` and the runtime's player).
    - Frontend's voices/drum-roll console waits for the user's look at board v104; Backend's voice sync root and preflight check wait for the Orchestrator's go.
  - **Data done today (gitignored):** the temporary 2026 cards regenerated with sides from the 2026-temp repertoire (`data/media/2026/cards-TEMPORARY-not-for-print/`, side 2 from the whole repertoire, stamped not for print); `data/repertoires/2026-temp.json` (untracked, never commit) points at `data/out|cache/repertoires/2026`.
  - **Throwaway smoke runs in the worktree (untracked):** `tools/e2e/smoke-step2.ts`, `smoke-d177.ts`, `smoke-voices.ts`; run with `node tools/e2e/<file>` after `npx vite build` in apps/show.
  - **D240 (the user, 27 Nov): subagents do the work.** Features with their tests, docs, investigations, sweeps and long verify runs go to subagents (medium or high effort; xhigh only when very important). I plan and brief, review each result before committing, commit, push, and talk to peers and the user. Subagents never push, deploy or message peers.
  - **How I work here:** edit in `/Users/blue/Projects/barrakudes/quina-step2` (branch `sound/step2`; `git checkout -B sound/step2 main` to reset; `git add` exact paths; `git diff --cached --summary | grep 120000` before each commit), land with `git merge --ff-only sound/step2` in the shared checkout, `npm run sync-main`, test the exact tip in `/Users/blue/Projects/barrakudes/quina-test-step2` (`git checkout -q --detach <sha>`, `QUINA_OUT_DIR=<main>/data/out npm test`), send Backend the sha when the cloud or screens change, and push `git push origin <sha>:main` only on exit 0 with origin/main an ancestor. Typecheck all three apps/show configs (json, node, ui) before telling peers a change can wait.
- **Done (26 Nov): step 2 (D127–D170) is pushed:** 2d86b7a (deployed as ec6983b0) and the follow-ups b686073 (Parlem in a review, the lone fail ✗'s 3 s, getUpcoming). The media moved to the new layout and the browser smoke run passes with the real sets. Next: the finale (D166–D169) after U151; the side/Part protocol (step A, D163's side) after U54.
  - **Part 1's ids are alphabetical (D103, 26 Nov):** ids 1–70 are the user's title-sorted playlist positions.
    - The decoded audio moved with each song; the 6 cut songs' audio is in `data/cache/pools/2026/_cut/<Spotify id>`. The old id record and song list are kept as `output/*.before-D103.json`.
    - The temporary cards were remade with these ids.
    - Part 2 (U57, default ids 71–140): the same once the user says it's filtered and sorted.
  - **The Interval music is the new playlist (D104, 26 Nov):** Spotify `0XTlZPUpt7xPoPxk4AUU3O`; Pausa plays it too.
    - 37 of its 39 tracks are prepared: `data/out/interval/index.json`, 121–175 kbps, no quality flag. The old set is kept in `data/media/interval-old-0SsuXelEzN8gsS7WufySOg/`.
    - #15 "Island Broadcast" (Masters of Sound's cover) and #22 "Frappe Snowland – Original" (Game Monsters) aren't on YouTube. The user said on 26 Nov that it's fine if some can't be downloaded, so the Interval plays without them.
  - **Part 3** (Especial and Desgraciat, `79G8VcNrkih9GGjIzb47Gt`, D105) is empty. The especial card's side plays Part 1 until it's final; then it gets ids 141–210 (U57), alphabetical (D103). Don't fetch it before then.
  - **The order (keep it):** step 1's range on main (local, unpushed) → Frontend's labels commit on top (blocked: U124, the user's OK in Frontend's session) → test the range in a clean worktree, push its top sha, Backend deploys → rebase `sound/step2` onto main, put it on main as local commits, send Frontend and Backend the hash → they commit their sides on top (Backend's `backend/step2` follows mine) → test the whole range, push, Backend deploys first. Never push a range that breaks the console build; never commit Frontend's files.
  - **Step 1: pushed (a89826f, 26 Nov),** with Frontend's labels (fd498ad) and a sync-main fix (a local commit origin already has as the same patch is left out, not a conflict). Backend deploys it.
  - **Step 2 since:** D155 (`storm` in the last round's play and check too; `state.lastRound`, SceneContext `lastRound`; in play it first puts the round into a Hold so no song lands unheard), D157/D158 (VOLUME_MAX 150 per key, `throws` defaults to 141% = +6 dB, MIX.headroomDb −6 in front of the limiter, the music fades under a throw song through graph.throwDuck), 02fbf70.
  - **Incident (fixed, 76e2c6f):** 0c46db1 carried my worktree's `tools/prep/.venv` symlink; fast-forwarding the shared main across it deleted the real venv. Rebuilt with uv from the pins (requirements.txt + -layering + -test), test:pipeline passes (62); the ignore rule is now `.venv*`. Never check out 0c46db1..02fbf70 in a checkout that has a real venv (moving straight to 76e2c6f or later is safe). Memory: feedback-worktree-symlinks.
  - **D161–D163, sketched, NOT BUILT (waits for U145, U146, U149, U150; U54 for D163):** the Desgraciat's finalists: a command `finalists { cardIds }` (standing cards only), public `state.finalists { cardIds, out[] }`, journal `finalists.set`, the outs recomputed from landings, auto-advance stopping at one finalist, the end journaled as claim.opened + claim.decided `auto`. D162: `getUpcoming` on the tablet's tap (the Queue after the position, private), answered by an event; search and card preview need no engine change. D163: CheckInfo gets `side` with step A.
  - **The laptop is 6 dB quieter than before (MIX.headroomDb):** the sound check turns the PA up about 6 dB. Told Backend (laptop notes) and the Orchestrator (cheat sheet).
  - **Step 2 (`sound/step2`: 865fd84 protocol, 8b31dcd engine, then ccda55b, 4eb842b, 62e02cb; on 6bac72c):** 253 engine tests and the prep tests pass; the only type errors left are Frontend's (packages/ui fixtures and flow, console logic/check, default-action, config, strings, stage/view).
    - **The Check (D107–D126):** on screen with nothing revealed; `checkNext { claimId, step }` reveals one song (grid order, a Line's row), stopping at the first ✗; the cue decides (a pass that isn't the batch's last: plaque, no fanfare; the last: the Celebration; a failed last after an earlier pass: `celebrationNext { claimId, step }`); the next card on screen by itself 3 s after a cue, its first reveal waiting for a press; `checkAuto` through the cue, never a self-entered card's first reveal; `checkReview` / `reviewEnd` (continue; win or lose by hand, warned notPassing / wouldPass, journal `manual`; discard into HoldReason `discarded`, plain Parlem); `unknownCard` (detail: the numbers, comma-separated); `endGame` refused `claimOpen` during a Review. `decide`, `checked`, `failedCheck`, `check.scheduled` and the timed steps are gone. The runtime's CheckPlayer plays one reveal at a time; the music ducks (−32 dB) from the first reveal to the cue, or back to none.
    - **`checkBack` (D127, D134):** one mark back, the previous snippet again, at none the music back up; auto off for that Check only. The long-press `back` is today's (U104).
    - **Pausa (D128, D135):** `pausePlayback` suspends the song deck (Deck.suspend), Hold music (also the intro), the Celebration loop, the breaks and end sets and the throw song, each where it is; `resumePlayback` brings them back there, fading in; the engine moves the song's timeline and every timer on by the paused time and comes back under Parlem (HoldReason `pause` when no Hold was on). Next ends Pausa out of the Pausa set (bed `pausa`); Panic and endGame drop what was saved. `pause.overlay` only in play, check, celebration. A Spin within 0.15 s of landing refuses Pausa as `busy`.
    - **Holds (D133, D142, D144, D145, D117):** Next refused `nextBlocked` in Aguanta and Suspens; Next ends Parlem as before; `suspense { on: false, cancel: true }` backs the build out over `SUSPENSE.backOutSec` (1.2 s) to Aguanta (if it started there) or the song playing; a claim in Aguanta ducks to Parlem; Parlem in a Celebration ducks its music (`bedDuck`, `CelebrationInfo.parlem`).
    - **Music (D129, D137, D138):** three IntervalPlayers (breaks; pausa; end = the breaks' folder in playlist order, U97); `/intervalaudio/<set>/<slug>.flac` and `/data/interval/<set>/`; interval.py takes `--set` and does every folder by default. The intro track (`INTRO`, −14 dB) on HoldMusic's new `intro` mood, from roundIntro through the Shuffle to the first Spin (U99). The throw: `throw { restart? }`, ThrowPlayer on `/holdaudio/flying-free.flac` from `THROW.hookSec` 193.18 (my pick: the build's phrase start, 16 s before the drop at 208.8), the break music (intervalBus) fading under it; it ends on any scene change.
    - **Volumes (D139):** `setVolume { key, percent }`, VOLUME_KEYS / VOLUME_DEFAULTS / volumeDb (gain = (p/100)²) in the protocol; graph.vol has one gain per slider (win and fail reach both their music and their fanfares); `songsParlem` is the Parlem duck itself (default 45% ≈ −14 dB, HOLD.duckDb is gone); journaled 1 s after the sliders are still; the record shows the volumes as last journaled; `plan.volumes` only for a Game that set none. `intervalVolumeDb` is gone.
    - **The plan:** `schedule.breaks` → `schedule.throws` (PlannedThrow), also in the Schedule, the countdown and apps/cards' reports.
    - **Added after (26 Nov, 62e02cb):** the throw's loudness trim (ccda55b); a throw test (4eb842b); D150 `plan.schedule.doorsAtMs` (optional, never after startAtMs, public: Horari's first row); D151 the corn-seed storm, `storm { restart? }` in `after` (U132 (a)), `ThrowInfo.song`, each throw song a setting in `THROW.songs` (throw 193.18 s, storm Flying Free's drop 208.76 s), sharing the `throws` slider. D147/D148 needed no engine change (the window and the shake toggle are the console's settings).
    - **Defaults while open (as today, easy to change):** U85/U78 (the −32 dB duck), U88/U89, U97 (end = breaks in order), U99 (the intro's span), U104, U105 (Suspense cancelled at Pausa), U106 (Parlem), U107 (Pausa allowed in a Check, marks kept), U108/U109 (own level), U110 (the countdown runs on), U111 (not journaled), U113 (short sounds ring out), U114 (paused time counts as lost), U120 (letting go of B lands).
  - **Checked in a headless browser (26 Nov):** `tools/e2e/smoke-step2.ts` in the worktree (untracked, a throwaway), run with `node tools/e2e/smoke-step2.ts` after `npx vite build` in apps/show. The worktree's `data/cache`, `data/out` and `data/media/*` are symlinks to the main checkout's. All ok: the throw's taps, Pausa resuming the song deck where it was with Parlem, a cancelled Suspense backing out, the Check's reveals and duck, the cue's Celebration, Parlem ducking it, a slider's gain, no page errors.
  - **Media:**
    - **Done:** the breaks set (pop `0fvoRGCC8zXqDyj5uLhJVg`) in `data/media/interval/breaks/`, prepared into `data/out/interval/breaks/` and `data/cache/interval/breaks/` with the worktree's interval.py (`--set breaks --source/--out/--cache` to the main checkout's data); all 50 tracks (a second spotDL run got #2–#10, whose metadata lookups had failed), no duplicates, the lowest 115 kbps Opus; Backend told it's ready for R2. The intro (`data/media/intro/parasail-minigame.mp3`, a copy from temp/) and the throw (`data/media/throw/flying-free.mp3`, a copy of song/24.mp3) are decoded into `data/cache/hold/`; their hold.py JSON is staged in the worktree's `tmp-hold-staging/` (Parasail: a clean 41 s body loop).
    - **Done after the push (26 Nov):** today's Interval files moved into `pausa/` (media, cache and out), prepared with `interval.py --set pausa` (37 tracks); hold.py lists the intro (`intro`) and the throw song (`throw`). Backend pushes them to R2 and prunes the old top-level interval keys.
  - **The agreed plan:**
    - one night pool with `part` per song, card-type sides `{ side, part, label?, mark? }`, cards with `sides`, and `side` on the plan, commands, journal and ResumePoint (token `-C<n>`);
    - checkGamePlan fills side 1, and the `sideWarnings(plan, cardTypes)` helper is for Admin and the preflight;
    - the cards.json conversion is one commit run by Frontend; the engine journals `side` only after Backend's step B is deployed;
    - the default test pool's 77 songs get part "1".
  - **Waiting on the user:** U51 (round 6's pace), U53 (R2), U55 (preparing Part 1 and the 7.3 GB cache), U56 (hook tools: default (a) quick review + (b) one hook).
  - **The model (D100–D102):**
    - two playlists of 70: playlist 1 (Spotify 0EOwwaDVItDHMRkYoO1m8y, final) plays rounds 1–5 on side 1 of the normal card, playlist 2 (0sWgctjhXP6TS1aB4jfaHb, not filtered yet: don't download) rounds 6–10 on side 2;
    - a third playlist for the especial card, which plays both special rounds (U49, default);
    - a normal card is double-sided with one number;
    - U34 = 70.
  - **Proposed in the report, not built:**
    - one night pool with a `playlist` per song and ids unique across the night;
    - card-types with sides → playlists, cards with `sides`, `RoundPlan.side`;
    - the round's songs and lines from its side;
    - the default Pace keyed to the first round of each playlist (U51);
    - the expected end from each round's Queue and its own Pace;
    - a quick-review mode for hooks;
    - option (d) for R2.
  - **Playlist 1 at 70:** all downloaded, ids 1–76 with 6 gaps. The temporary cards were remade from the 70, one side only.
  - **The pool `2026-temp`:** `data/pools/2026-temp.json`, untracked, never deployed. Audio is in `data/media/2026/output/songs/<Spotify id>.opus`. The ids are in `output/song-ids.json`, 1–76 in the order of 25 Nov; a cut leaves gaps and moves nothing.
    - Its data, cache and overrides folders are pool `2026`'s (`data/out/pools/2026`, `data/cache/pools/2026`, `data/pools/2026/overrides`), so nothing is redone when it becomes pool 2026.
    - Run it from apps/show: `npm run prep -- --pool 2026-temp --steps decode,quality`.
  - **All 76 are downloaded, and none need a hand download.**
    - spotDL fell back to plain YouTube videos for 11 songs. 7 of them (12, 29, 35, 40, 46, 61, 70) were swapped for YouTube Music's official upload with `yt-dlp -f 251 -x --audio-format opus`; the replaced files are kept in `output/rejected/`.
    - Quality: 122–159 kbps Opus (median 138), every song within 4 s of Spotify's length. The only flag left is song 29's own "Remix" title, the playlist's pick.
    - Decoded: `data/cache/pools/2026`. No hooks, Signatures or stems yet, and nothing in R2: those wait for the user.
  - **Temporary cards:** `data/media/2026/cards-TEMPORARY-not-for-print/`: cards.json, card-types.json, and the PDFs named `TEMPORARY-NOT-FOR-PRINT-*`. 699 cards (399 normal, 300 especial) from the 76 songs, never for print; remade after the cut.
  - The old draft (`data/media/draft`, 26 of 151 songs, plus the 4-song dry run) is kept as it is.
  - **The VPN:** YouTube asks ProtonVPN's address to sign in. Download with it off, and never touch it yourself.
- **Next:**
  - **1 Dec, first commit (agreed with Frontend and Backend on 25 Nov):** the pool and cards path. Frontend's and Backend's moves go on top the same day; send them the sha.
    - Create `data/pools/2026.json`, tracked, with `cardsJson` set to `apps/cards/dist/cards.json`. The user makes the cards with `npm start -- --pool 2026` in apps/cards; `--check` validates without writing.
    - Copy today's `apps/cards/dist/{cards,card-types}.json` to `data/pools/default/cards/`, byte-identical, with 65b74ef's fixes; not legacy's file, which repeats #398's and #492's lines. Point `data/pools/default.json`'s `cardsJson` there. Gitignore `data/pools/*/cards/*.pdf`.
    - Make my tests read the cards through the default pool (relay/pool.ts `loadPool('default').cardsJson`, pool.py): support/harness.ts, support/data.ts, the cards, phase and shuffle tests, support/desgraciat.ts, support/listen-demo.ts, tools/prep/tests/test_pool.py, the engine/src/game/cards.ts comment.
    - Frontend: the UI tests check both files, and the fixtures read the default pool's copy. Backend: the e2e reads `loadPool().cardsJson`; the live run checks that quina-dev serves the same cards; deploys name their pool, and the preflight checks the cloud's cards match.
  - **After the cut (about 70 songs):** fetch the playlist again (`fetch.py` from `data/media/2026`), then remake the temporary cards with `npm start -- --pool 2026-temp` in apps/cards. Download new songs, if any, with the VPN off.
  - **1–3 Dec, if the playlist is ready on 1 Dec (D83):**
    - fetch it, then download the rest with the VPN off;
    - run prep with `quality`;
    - give the user one short list of the songs spotDL couldn't get or that `quality` flags, at once, so they can swap them before making the cards on 4–5 Dec. They download the leftovers by hand as `<id>.mp3`.
  - **After the cards, before the tech rehearsal (D82, D83):** propose automatic hooks, and the user approves them (U14). Then Signatures and stems, and tell the orchestrator.
  - **U34 (the pool size; about 70 songs recommended by `docs/research/reports/pool-size-2026.md`), not before the user picks:** `SCHEDULE` in `engine/src/config.ts` is fixed for 77 songs: `bingoAtSong` 50, `lineAtSong` 16, `desgraciatAtSong` 24. At 70 songs with about 190 normal cards in play it should be about 46, 14–15 and 21, or the Drift reads late and speeds the Pace for nothing.
    - Proposal: derive these from the round's Queue and its cards in play instead of hard-coding them. The engine knows the seeded Queue at the Shuffle, so it can count the songs to the first possible Line and Bingo (Futur's numbers) or the last card standing. The Drift then aims at the real end, which is fixed for whatever pool size and sales.
    - The constants stay only as the guess before cards are in play. `pace.ts` reads them in two places: `roundSongs` and `songsLeft`.
    - **Weigh 2025's acceleration** (`docs/research/reports/night-2025-data.md`): Quina 1–5 took 108 min and Quina 6–10 took 74 min for the same number of songs. That's about 18 s a song in Q2 and 11 s in Q9, and the Intervals shrank from 1.6–5.2 min to 0.5–1.5. A flat 14 s after Quina 1 reads late early and early late, so the expected end needs a per-round seconds-per-song, not one Pace.
  - until then, nothing new on sound: transitions stay frozen until U13.
- **Blocked:** nothing.
- **Waiting on the user:**
  - the playlist (1 Dec), and U34 (the pool size);
  - U13: the listening pass (transitions stay frozen until then). The demo for it is rendered, and the orchestrator has sent it: `data/out/listen-demo/listen-demo.m4a` plus `cues.md`, made by `node apps/show/tests/support/listen-demo.ts` (804e35f). A plan is ready (not applied) if call and response feels too frequent: it labels 70% of transitions today, and would become an occasional move at about 15–25%, with a variety bound;
  - U14: hook approval, after the cards and before the tech rehearsal (D82: no fixed date; the user calls it when ready).
- **Decided:** D81: one special card plays both the Desgraciat and the Especial; the engine's default (D70) already fits.
- **Size:** the final playlist will have fewer than 100 songs (the user), so today's format (about 68 MB a song) fits R2's free 10 GB, and option (d) isn't needed. Disk: 15 GB free on 25 Nov.
- **Code rule (D78, U29 pending):** keep code simple, and keep no alternative versions of a feature; the operational plan Bs stay. Two unused, deprecated aliases are gone (`1ced37a`).
- **Rules:** a new question for the user goes to the orchestrator, never into open-questions.md directly. A decision the user gives me directly is reported to the orchestrator the same day.

## Done so far

All of this is on `main`, green when committed.

| What | Commits |
|---|---|
| The repo move: paths after `60f9d12`, and the show app's README retitle | `30ed5ee` |
| **Phrase alignment** (the user's top complaint). Landings sit on the outgoing song's 4- or 8-bar phrase. A presenter's Next waits up to 11 s for one. Before: 59% mid-phrase. After: 99% on a phrase, kept above 90% by `tests/variety.test.ts` | `633649a` |
| **The intensity range by Phase.** Light, quick and clean early, growing with the Phase. Impacts are rare early, and the orchestra hit comes only late or in final, with a cooldown | `3ed3a6a` |
| `relay.plan`, the Game plan pushed to every screen (b2's proposal) | `6833380` |
| A stale held-back-song comment in `public.ts` | `5977903` |
| **Signatures** are instrumental teases (riff, build, motif), auto-picked at a score ≥ 0.6. Only B's plays, ending on the landing. Audition page: Pick, Veto, Undo, and Off for a song | `3e47471` |
| **Aguanta** (`hold {duck:false}`, `HoldInfo.ducked`), **Futur** (private `ShowState.future`), and `HEAT_BANDS` / `PACE_DEFAULT_SEC` in the protocol | `80e3eb8` |
| **The phrase loop.** Aguanta loops the song's last phrase before its outro | `afec1e4` |
| **Suspense rework.** A loops its 4-bar phrase while the build grows. The drum hovers over 3 pending songs with Decoy teases. The release lands B on A's phrase boundary | `2cb2123`, `2531bca` |
| **The drum shows only pending songs.** A model test. The behaviour already existed, and 1e confirmed the stage agrees | `e14f140` |
| **Vocals.** A sudden vocal entry gets a quick, clean move straight into the voice. Call and response puts A's line, then B's on the downbeat | `f4d0870` |
| **Automatic hooks** for this year's playlist (structure + energy jump + vocal onset), plus a ±1-bar refine suggestion for hand tags. Both are approved on the audition page | `dcd9bcb` |
| CI: the engine tests skip cleanly without `data/out` (`dataTest`, `QUINA_OUT_DIR`) | `8c6f581` |
| `?mute=1` on the show page, for b2's headless e2e test | `ea79df7` |
| **Plan v2:** prize bundles with headline prizes, `prizeReveal`, `revealPrizes`, the journal's `prizes.revealed` (also at every `roundIntro`), `revealedRounds()` / `publicPlan()`, and `CheckInfo.cardType` | `7e502c4` |
| **The variety review.** D20 Count-in (a new family), the open landing, R1's sweep lengths, and early quarter-beat gaps. Before → after is in the next section | `6871c26` |
| **Card type per round**, step A: each round plays the printed type it is given (`RoundPlan.cardType`, a card-types.json id; `roundIntro`/`newRound`/`resumeAt { cardType? }`). It drives the valid cards, the Shuffle's Tie check, the Phase and the Check's `wrongType`; journaled in `round.started`/`round.resumed`/`scene.changed`; resume tokens add `-T<ID>` when it isn't the kind's default. Frontend's and Backend's step B followed (card-types.json on every screen, the cloud's projection and preflight) | `b71d843`, B: `5579442`, `f3e8ade` |
| **Card type per round**, step C: plan version 3. `RoundPlan.cardType` is required; `GamePlan.cardTypes`, `PublicPlan.cardTypes`, `CardType` and `DEFAULT_CARD_TYPES` are gone; `checkGamePlan` reads v1 and v2 plans as v3 (a v2 `cardTypes` list only picks each round's type). `parseCardRanges` moved to `@quina/protocol` (`ranges.ts`). Frontend and Backend followed on top | `bd29f4d`; `91b1a43`, `b717bc6`, `360523f` |
| **`remote.status` in `@quina/protocol`** (`events.ts`): the relay imports it there, and packages/ui re-exports it (Frontend, `71e618e`) | `cccfd82` |
| **The Desgraciat round** (played in reverse: the last card standing wins). A: `RoundKind 'desgraciat'`, `WinKind 'standing'`, `CheckOutcome 'fallen'`, the console's private `standing` and Futur's `lastStandingAt`/`standingCurve`; the pure parts (`fallIndex`, `standingCourse`, the Shuffle's `lastStanding` rule, the standing Check, the count-based `standingPlan`). C: the engine plays it (commands, standing claims, auto-advance stops at one card, a 0.55 s knock per song not heard yet, the Celebration and Interval like a Bingo). Covered by `desgraciat.test.ts`, `desgraciat-flow.test.ts` (with a fuzz), and a Desgraciat round 7 in every simulated night | A `caa5662`, C `2e359dd`; cloud B `cb35dd1` |
| **The Check decides** (docs/event.md): `decide { valid: true }` on a card whose Check failed is refused (`failedCheck`); a passed card may still be rejected | `233e3a3` |
| **The Desgraciat shared win:** CheckOutcome `fellLast` (the card sat down with the latest landing) passes, so several such cards can share one Celebration; `isPassingOutcome`, `CHECK_OUTCOMES`, `standing.fellLast`, the winner's `slip`, `claim.decided.outcome` | `30ef20d` |
| **Planned breaks and the Schedule by round kind:** `SchedulePlan.breaks`, the show page passes `relay.plan` to the engine (`setPlan`), the expected end follows each round's kind, the planned Interval and breaks, and the Interval's countdown adds the break; `roundCardPrice` for the Interval screen's price (U5) | `dde6941`, `471b519` |
| **The listening demo:** the show page records itself (`?record=1`, engine/src/demo-recorder.ts), and `tests/support/listen-demo.ts` plays one round headless (early to final, Aguanta, Count-in, Suspense, the Line and Bingo Checks and Celebrations, the Interval), writing the audio and a cue list under data/out/listen-demo | `804e35f` |
| `remote.status` carries the remote's recent `drops` and `lastDropMs` (Frontend's proposal, for the Wii's range) | `df48789` |
| **The old Decoys experiment retired** (the orchestrator's decision): `DECOYS.enabled`/`chance`, `plan/decoys.ts`, `docs/decoys.md`, `?decoys=1` and the planner's `allowTease` are gone. A Decoy is now only what Suspense teases (`DecoyEvent`, the slimmed `DECOYS` timing) | `fd07f2e` |
| **D70: the Desgraciat plays especial cards by default** (2025's special card played the Especial and the Desgraciat; U26 pending, default one card for both). `DEFAULT_CARD_TYPE.desgraciat = 'especial'`; the Desgraciat tests and simulated nights put especial cards in play. Frontend and Backend made their tests default-agnostic first (`4bf8d55`, `dafdbcd`, `d8345e9`) | `364c916`, `1ced37a` |
| **The expected end at 70 songs** (D100). SCHEDULE: Line 14, Bingo 46, last standing 21 (1,500 Shuffles of the draft cards). A round counts its exact songs from its Queue and cards in play; a mid-round change moves an unjournaled offset, so the Drift doesn't jump. Each later round at its own Pace. `tests/schedule.test.ts`: 2025's rounds within about 2 minutes, and a flat 14 s reads Quina 2–5 ten minutes short | `8e6f563` |
| **Stable song ids** for a changing playlist: `song-ids.json`, downloads named `<Spotify id>.opus`, `pool.py` resolves them through songs.json; README: download with the VPN off | `fb321f4` |

Earlier work, before the move, is summarised in the README and `docs/dj-techniques.md` › Built: the planner, every recipe up to D19, the show state machine, the journal, resumeAt, the Interval and the relay security.

### The variety measures

Over 4 simulated 12-round nights (`node tests/support/variety.ts 4 1`, 2,430 transitions):

| Measure | Before | After |
|---|---|---|
| Family again within 3 | 20% | 17% |
| Landing = previous | 20% | 12% |
| Build length = previous | 46% | 36% |
| Gap = previous | 27% | 20% |
| Effective recipes early | 8.9 | 9.8 |

Since `2e359dd` every simulated night plays a Desgraciat round (round 7), so the same command now covers 2,331 transitions; the measures barely move (family again within 3: 18%, landing = previous: 13%, build length = previous: 35%, gap = previous: 20%, effective recipes early: 9.9).

**Not fixable in code:** Hold music replays a loop heard that night 53% of the time, and the victory track 92%. There are only 3 Hold loops and 1 victory track (`data/media/hold`, `data/media/celebration`): the user may add more (see Waiting on the user).

## In progress

Nothing: items 1 and 2 of the old queue and the Decoys retirement are done and pushed (`ebf1a5d`).

## The next queue, in priority order

1. **The user's listening pass on the new sound** (not heard yet). Transitions and effects stay frozen until then:
   - phrase landings, the light early palette and rare impacts;
   - Signatures before the landing;
   - the new Suspense (A loops, hover, teases);
   - Aguanta's loop;
   - vocal entries;
   - D20 Count-in and the open landing.

   Adjust from their notes. One known candidate: **the Suspense release can take up to ~9 s** (B waits for the end of a 4-bar pass plus A's exit in free bars). A faster option would land on the next 2-bar boundary.
2. **This year's playlist, once the user hands it over** (on hold, see Now):
   - **Downloads (D66):** spotDL, as last year, with the VPN off; YouTube's own Opus stream copied (`--format opus --bitrate disable`), one song at a time. The bot check came from ProtonVPN's address. The PO-token plugin is not needed (its server was built in `data/cache/tools/bgutil-pot`, gitignored, not running).
   - **Quality** (the user's condition): prep's `quality` step (`71236b8`) flags low bitrate, a low-pass under 15 kHz, a length more than 5 s off Spotify's, and version words. Songs it flags or spotDL couldn't get go to the user as one short list; they download those by hand.
   - **Timings per song:** decode about 1.5 s, analyse 6 s, stems 21 s. Hook approval is the user's part, about 2 minutes a song.
   - **A pool nobody tagged** is playable only after its automatic hooks are approved and prep runs again; the README's steps say so.
   - **No Spotify features** this year, so the half-time rule also works from librosa alone (`680e4bc`).
   - **Size per song in R2:** about 68 MB with two approved hooks (mix.flac 28–47 MB, stems 19–30 MB, Signatures and snippet about 1 MB). The final playlist has fewer than 100 songs (the user), so it fits R2's free 10 GB; option (d) (about 20 MB a song, measured) isn't needed.
3. **Low priority, approved by the orchestrator as a test aid:** a provisional bulk approval of every song's top automatic hook, so a new pool can be synced and rehearsed before the user's approval pass ends. Mark it `provisional` everywhere: the audition page, and a preflight WARN (Backend's, asked).
4. **The final playlist (Tue 1 Dec, the user's date):**
   - Fetch it again into the draft's folder: stable ids keep every song already downloaded, prepared or approved, and only new songs download. Then `npm run prep -- --pool data/media/draft/pool.json`, and flag unusable songs the same day, so the user can swap them before the cards print (U28).
   - The `hooks` and `signatures` steps propose candidates. The user approves hooks and vets Signatures on the audition page before the first rehearsal (U14, U27); stems and the variety and phrase measures rerun on that pool.
   - **Done when:** every playable song has an approved best hook and reviewed Signatures, and `npm test` is green on the new pool.

## Waiting on the user

- **Listening feedback** on the new sound (queue item 1), including the ~9 s Suspense release.
- **The final playlist** (Tue 1 Dec), then its hooks to approve and Signatures to vet.
- **More Hold music and victory tracks** (the media pools are tiny).
- **The last card standing unsold** (the orchestrator asked): until the user says otherwise, the presenters decide by the room. The engine needs nothing either way.

## Decided since the pause

- **D66 (U1):** the download method is the Sound engine's call, as long as the quality is good and the user does little; they download only the leftovers by hand.
- **D70:** the Desgraciat plays especial cards by default (above). **D71:** cards are sold only on the night and print in a few hours; only the night (27 Dec) and the final playlist (1 Dec) are dates, the rest waits on U27 (rehearsals) and U28 (print).
- **Q26 = A+:** the show laptop stays installed (the relay, plus Python Rubber Band for the Blend renders) and pulls its media from R2. No WASM or browser time-stretcher; "nothing installed" is deferred until after the event.
- **The Wii remote mapping** (R2-Q38) is decided and built by Frontend (`357cba4`, `c4632f8`, `b9825f1`); the engine needed nothing new.
- **Pause plays the Interval music** (orchestrator): Pausa reuses `pause {on}` / `ShowState.pause`; during a pause the engine plays the Interval music instead of Hold music, and the round resumes with a normal transition (`a11a224`, covered by `tests/flow.test.ts`).
- **The flaky hook-ranking test** (from Backend) is fixed: `section_kinds` fixes each eigenvector's sign, and the test asserts every chorus start in the top four (`a11a224`).
- **The Desgraciat details** (orchestrator, 2026-11-25): the standing set is the round's cards in play of its card type (the ranges can't tell sold from unsold); thresholds from the count alone; auto-advance stops at one card.

## Known issues and risks

- **Prepared data.** `data/out` is gitignored. The engine tests that need it skip without it (`tests/support/data.ts`), and CI runs the rest. `QUINA_OUT_DIR=/nonexistent node --test "apps/show/tests/*.test.ts"` reproduces CI.
- **Automatic hooks are proposals.** On last year's hand-tagged songs the top candidate is within a bar of a tagged hook in 26 of 77 songs, and one of the top three in 48 of 77 (chance is about 1 in 8 per candidate).
- **Hand tags scatter about ±2 beats.** The refine step suggests a one-bar shift for 45 of 386 tags, mostly a bar later. That fits the earlier finding that about 14% look a bar off. Until hooks are refined, phrase counting from a wrong hook is off too.
- **Signatures are rarer.** 38 of 77 songs get an automatic pick, and they play in about 5% of transitions. Over A they need agreeing keys and tempos within 4%. The user can pick more by hand.
- **The Pace is met on average.** Gaps between landings are whole phrases (8 bars at 120 bpm = 16 s), and the Drift nudge evens the round out.
- **The relay gets killed by other sessions' restarts.** When another Vite dev server holds port 24678, `npm run dev` exits. Use `npm start` (it builds `dist/` first) instead.

## How to run, test and listen

From the repo root, once: `npm install` (workspaces). Then from `apps/show`:

**Run it:**
- `npm run dev`: relay plus Vite on http://localhost:5174, this laptop only. Add `-- --lan` for the hotspot, which pairs with the printed `?t=` token.
- `npm start`: builds, then serves the built pages (more robust when other sessions run Vite); the relay refuses a stale `dist/`.

**Pages:**
- **Show page:** `http://localhost:5174/show/`. Parameters:
  - `auto=0`: auto-advance off;
  - `pace=8..60`: the Pace;
  - `autostart=1`: start right away;
  - `mute=1`: everything runs, nothing reaches the speakers;
  - `fresh=1`: ignore the local journal;
  - `stage=0`: no projector stage over the page;
  - `debug=1`: the plan line, D toggles;
  - `queue=3,17,45`: a fixed Queue;

  Keys:
  - → / Enter: Next (it also releases a Suspense);
  - ←: Back;
  - Space: Hold / release;
  - S: Suspense;
  - M: Hold music;
  - Esc: Panic;
  - + / −: Pace;
  - A: auto-advance;
  - 0–4: Phase;
  - D: debug HUD (with `debug=1`);
  - H: hide the controls.
- **Audition page:** `http://localhost:5174/show/audition.html?song=N`: beat-grid clicks, hooks and their fixes, the "Suggested" bar shift, **Automatic hooks** (Best, Main, Reject, nudge), and **Signatures** (Pick, Veto, Undo, Off). Save re-derives the song.
- **Transition bench:** `http://localhost:5174/show/test.html?run=1` renders every technique in three modes: landing click, mix and silence.

**Test:**
- `npm test`: typecheck, engine node tests and UI tests.
- `npm run test:pipeline`: pytest for tools/prep.
- `node tests/support/variety.ts 4 1`: the sameness table over whole nights.

**Prepare:**
- `npm run prep -- --pool <name>`: covers, decode, analyze, snippets, validate, keys, stems, signatures, hooks, interval.
- Single steps: `tools/prep/.venv/bin/python tools/prep/hooks_auto.py --report` or `tools/prep/signatures.py --force`.
