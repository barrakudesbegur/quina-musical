# Sound engine handoff

The single place to resume the sound engine's work from. It was first written when the user paused the work (2026-11-24) and is kept current at each milestone.

**What this covers:** the show engine and its transitions, Signatures, Suspense and its Decoy teases, the song preparation pipeline (tools/prep), `@quina/protocol` and the Game journal. The journal is shared with the platform session.

**Where else to look:**
- The decisions are in `GLOSSARY.md`, `docs/how-the-quina-works.md` (the current-state read of a whole night), `docs/mixer-design-decisions.md`, `docs/show-ui-and-platform-decisions.md` (its "Changes" section) and `docs/adr/`. They override older research.
- The dates are in `docs/timeline.md`: the playlist is final on Tue 1 Dec, the night is Sun 27 Dec.
- The team roles are in `docs/team.md`. Questions only the user can answer go in `docs/open-questions.md`.

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
| **The old Decoys experiment retired** (the orchestrator's decision): `DECOYS.enabled`/`chance`, `plan/decoys.ts`, `docs/decoys.md`, `?decoys=1` and the planner's `allowTease` are gone. A Decoy is now only what Suspense teases (`DecoyEvent`, the slimmed `DECOYS` timing) | `fd07f2e` |

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
2. **Ready for this year's playlist by Mon 30 Nov: dry run done (2026-11-25), one blocker for the user.** The draft playlist has 86 songs. The pipeline ran end to end on a 4-song draft pool (`data/media/draft/pool.json`, gitignored: the draft songs that were also in last year's pool, with last year's audio):
   - **Blocker:** spotDL can't download. YouTube answers "Sign in to confirm you're not a bot", even after updating yt-dlp to 2026.11.23 (the venv's `uv pip install -U yt-dlp`). It needs the user's browser cookies (`--cookies-from-browser`), the user downloading the playlist themselves, or another source. The orchestrator has asked the user; don't touch cookies without their OK.
   - **Timings per song:** decode about 1.5 s, analyse 6 s, stems 21 s, so a full run of 86 songs takes about 45 minutes. Hook approval is the user's part, about 2 minutes a song.
   - **A pool nobody tagged** is playable only after its automatic hooks are approved and prep runs again; the README's steps say so now.
   - **No Spotify features** this year, so the half-time rule now also works from librosa alone (`680e4bc`; Besos comes out at 105 BPM again).
   - **Size per song in R2:** about 68 MB with two approved hooks (mix.flac 28–47 MB, stems 19–30 MB, Signatures and snippet about 1 MB), up to about 92 MB with more hooks (last year's). For 86 songs that's 5.9–7.9 GB plus the shared Hold and Interval music, so it fits in 10 GB once last year's pool is pruned. With option (d) (the original MP3 plus Opus 256k stems, decoded at sync time) it's about 20 MB a song. Measured: the mix re-decodes bit-identically, and Opus stems come back at their exact length within 2 samples.
3. **Low priority, approved by the orchestrator as a test aid:** a provisional bulk approval of every song's top automatic hook, so a new pool can be synced and rehearsed before the user's approval pass ends (by 10 Dec). Mark it `provisional` everywhere: the audition page, and a preflight WARN (Backend's, asked). Option (d)'s ffmpeg commands went to Backend as a measured contingency; today's format stays.
4. **This year's playlist, when it arrives (Tue 1 Dec):**
   - Make it a pool (`data/pools/<name>.json`) and run `npm run prep -- --pool <name>` by **Wed 2 Dec**. Flag unusable songs the same day, so the user can swap them before the cards print (Thu 3 Dec).
   - The `hooks` and `signatures` steps propose candidates. The user approves hooks and vets Signatures on the audition page by **Thu 10 Dec**; stems and the variety and phrase measures rerun on that pool by then.
   - **Done when:** every playable song has an approved best hook and reviewed Signatures, and `npm test` is green on the new pool.

## Waiting on the user

- **Listening feedback** on the new sound (queue item 1), including the ~9 s Suspense release.
- **This year's playlist** (Tue 1 Dec), then its hooks to approve and Signatures to vet.
- **More Hold music and victory tracks** (the media pools are tiny).
- **The last card standing unsold** (the orchestrator asked): until the user says otherwise, the presenters decide by the room. The engine needs nothing either way.

## Decided since the pause

- **Q26 = A+:** the show laptop stays installed (the relay, plus Python Rubber Band for the Blend renders) and pulls its media from R2. No WASM or browser time-stretcher; "nothing installed" is deferred until after the event.
- **The Wii remote mapping** (Q34) is decided and built by Frontend (`357cba4`, `c4632f8`, `b9825f1`); the engine needed nothing new.
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
