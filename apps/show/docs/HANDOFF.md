# Sound engine handoff

The single place to resume the sound engine's work from. It was first written when the user paused the work (2026-11-24) and is kept current at each milestone.

**What this covers:** the show engine and its transitions, Signatures, Suspense and its Decoy teases, the song preparation pipeline (tools/prep), `@quina/protocol` and the Game journal. The journal is shared with the platform session.

**Where else to look:**
- The decisions are in `GLOSSARY.md`, `docs/how-the-quina-works.md` (the current-state read of a whole night), `docs/mixer-design-decisions.md`, `docs/show-ui-and-platform-decisions.md` (its "Changes" section) and `docs/adr/`. They override older research.
- The dates are in `docs/timeline.md`: the playlist is final on Tue 1 Dec, the night is Sun 27 Dec.
- The team roles are in `docs/team.md`. Questions only the user can answer go in `docs/open-questions.md`.

## Now (kept current at each milestone)

- **In progress:** nothing. Done on 25 Nov: the expected end at 70 (D100, `8e6f563`). The side/Part protocol is agreed with Frontend and Backend: step A (my protocol types and checks) waits for U54 and the user's go.
  - **Part 1's ids are alphabetical (D103, 26 Nov):** ids 1–70 are the user's title-sorted playlist positions.
    - The decoded audio moved with each song; the 6 cut songs' audio is in `data/cache/pools/2026/_cut/<Spotify id>`. The old id record and song list are kept as `output/*.before-D103.json`.
    - The temporary cards were remade with these ids.
    - Part 2 (U57, default ids 71–140): the same once the user says it's filtered and sorted.
  - **The Interval music is the new playlist (D104, 26 Nov):** Spotify `0XTlZPUpt7xPoPxk4AUU3O`; Pausa plays it too.
    - 37 of its 39 tracks are prepared: `data/out/interval/index.json`, 121–175 kbps, no quality flag. The old set is kept in `data/media/interval-old-0SsuXelEzN8gsS7WufySOg/`.
    - #15 "Island Broadcast" (Masters of Sound's cover) and #22 "Frappe Snowland – Original" (Game Monsters) aren't on YouTube. The user said on 26 Nov that it's fine if some can't be downloaded, so the Interval plays without them.
  - **Part 3** (Especial and Desgraciat, `79G8VcNrkih9GGjIzb47Gt`, D105) is empty. The especial card's side plays Part 1 until it's final; then it gets ids 141–210 (U57), alphabetical (D103). Don't fetch it before then.
  - **The presenter-paced Check (D107–D110), agreed on 26 Nov with Frontend and Backend; waits for the orchestrator's go:**
    - commands: `claim { cardIds[] }`, `checkNext { claimId, step }` (idempotent; the press after the reveals stop is the cue), `checkAuto { on }` (never past the cue), `checkStop`, `checkStart`, `claimDrop`; `decide` goes away;
    - private ClaimInfo `markedCard`, `cueNext`, `revealUntil`; public CheckInfo only revealed steps plus `cue`;
    - journal `claim.stopped` and `claim.dropped`;
    - a passing card that isn't last gets its plaque without a fanfare; the shared Celebration comes after the last cue;
    - Parlem in the Celebration ducks the victory music;
    - order: my additive protocol, then Backend's cloud and Frontend's console, then my engine switch (removing decide, `checked` and the timed steps);
    - U62 open: is Següent refused while a claim is stopped; does the next card's Check enter by itself after a fail cue?
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
- **The relay gets killed by other sessions' restarts.** When another Vite dev server holds port 24678, `npm run dev` exits. Use `npm run build && npm start` (dist) instead.

## How to run, test and listen

From the repo root, once: `npm install` (workspaces). Then from `apps/show`:

**Run it:**
- `npm run dev`: relay plus Vite on http://localhost:5174, this laptop only. Add `-- --lan` for the hotspot, which pairs with the printed `?t=` token.
- `npm run build && npm start`: the built pages (more robust when other sessions run Vite).

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
