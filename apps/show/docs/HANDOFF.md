# Sound engine handoff

The single place to resume the sound engine's work from. It was written when the user paused the work.

**What this covers:** the show engine and its transitions, Signatures, Suspense and Decoys, the song preparation pipeline (tools/prep), `@quina/protocol` and the Game journal. The journal is shared with the platform session.

**Where else to look:**
- The decisions are in `GLOSSARY.md`, `docs/mixer-design-decisions.md`, `docs/show-ui-and-platform-decisions.md` (its "Changes" section) and `docs/adr/`. They override older research.
- The team roles are in `docs/team.md`.
- Questions only the user can answer go in `docs/open-questions.md`.

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

Earlier work, before the move, is summarised in the README and `docs/dj-techniques.md` › Built: the planner, every recipe up to D19, the show state machine, the journal, resumeAt, the Interval and the relay security.

## In progress when paused

### The variety review: done

Over 4 simulated 12-round nights (`node tests/support/variety.ts 4 1`, 2,430 transitions):

| Measure | Before | After |
|---|---|---|
| Family again within 3 | 20% | 17% |
| Landing = previous | 20% | 12% |
| Build length = previous | 46% | 36% |
| Gap = previous | 27% | 20% |
| Effective recipes early | 8.9 | 9.8 |

**Not fixable in code:** Hold music replays a loop heard that night 53% of the time, and the victory track 92%. There are only 3 Hold loops and 1 victory track (`data/media/hold`, `data/media/celebration`). The orchestrator is taking this to the user.

### The protocol batch: built except two items

**Built and agreed with 1e and b2:**
- plan v2 bundles;
- `prizeReveal` (`perRound` reveals at the round's intro; round 1 is open before the night);
- the edition `title` on every screen;
- `revealPrizes`;
- `publicPlan` / `revealedRounds`;
- `CheckInfo.cardType` with `wrongType` as its own failure.

b2 built prize secrecy on top (`6fbbc32`). 1e moved the UI to plan v2 (`07ed72f`): Admin edits bundles, the title, `prizeReveal` and card types; the console's Premis tab sends `revealPrizes`; the stage and phones show only revealed rounds' bundles. The Check view carries `cardType` but doesn't draw it yet: the projector's "Cartró normal ✓" first step waits for its ANIMATIONS.md entry (1e's).

**Not started: two items from the user's latest decisions (`00bd75f`).** The orchestrator asked to leave both for after the pause.

1. **Card types come from the card generation, not Admin.** cards.json gets a `types` table (name, pastel colour, title, price), owned by **1e** (apps/cards). Admin only assigns a card type per round. Design:
   - **Plan:** take `cardTypes`, colour and price out of `GamePlan`. Add `RoundPlan.cardType: string` (a cards.json type id; it defaults by kind: normal → `'normal'`, special → `'especial'`). `checkGamePlan` checks the format only; screens check it against cards.json. Migrate plans that carry `cardTypes` by dropping it.
   - **Engine:** a round's accepted card type comes from the command, instead of the fixed rule in `engine/src/game/cards.ts` `validCards`. Add `newRound { cardType? }` and `roundIntro { cardType? }` (the console sends the plan's value). `game/check.ts` then gives `wrongType` against that type. Journal it in `round.started` (`cardType`) so a resume knows it.
   - **To agree:** 1e (Admin, console, the cards.json `types` table) and b2 (the plan in the cloud and `publicPlan`).
   - **Done when:**
     - a round of any type only accepts its type's cards;
     - the Check's `cardType` and `wrongType` follow the round;
     - resume keeps it;
     - v2 plans with `cardTypes` still load.
2. **The Desgraciat round** (approved). The rules: a card is out as soon as any of its songs lands, and the last card standing wins. Design:
   - **Protocol:**
     - `RoundKind` gains `'desgraciat'`, and the public round shows it.
     - The private `ShowState.standing?: { count, cardIds (≤ 60) }` serves the console.
     - Claims stay presenter-driven: `claim { cardId, kind: 'standing' }`. `WinKind` gains `'standing'`.
     - The Check proves that none of the card's 12 songs landed: every step is a "not landed ✓", and any landed song fails it. A new `CheckOutcome` value, `'fallen'`, marks a card that has been knocked out.
     - Phones work out Dempeus or Assegut from the public landings and the round kind. Nothing new is needed on the feed.
   - **Shuffle:** `game/shuffle.ts` `tieFreeShuffle` gains a Desgraciat rule. Each valid card's elimination index is the first Queue index of any of its songs. The largest index must be held by exactly one card, so the last two can never fall on the same song. Reshuffle until it is (like today's tie rule), and journal the attempts.
   - **Phase and Heat:**
     - The climb follows the standing count. `final` comes when 2–3 cards stand, `late` around 5–8, `mid` around 15. Tune these by simulation with cards.json.
     - The expected win is the Queue index where the count reaches 1, known from the Queue.
     - Add a `PhaseModel` kind `'standing'` in `game/phase.ts`.
   - **Plan and card type:** one Desgraciat round per night, movable. Its card type is whatever Admin assigns (item 1).
   - **To agree:**
     - 1e: console standing list, stage Check steps, phone Dempeus/Assegut, Admin round kind;
     - b2: the projection of the new kind and outcome, the journal check of `kind: 'standing'`.
   - **Done when:**
     - a simulated Desgraciat round always has exactly one last card;
     - its Check passes or fails as described;
     - the console sees the standing cards privately;
     - `variety` and `journal` replay tests cover it.

## The next queue, in priority order

1. **Card type per round** (above). Agree with 1e and b2 first.
2. **The Desgraciat round** (above). It depends on 1.
3. **The user's listening pass on the new sound** (not heard yet):
   - phrase landings, the light early palette and rare impacts;
   - Signatures before the landing;
   - the new Suspense (A loops, hover, teases);
   - Aguanta's loop;
   - vocal entries;
   - D20 Count-in and the open landing.

   Adjust from their notes. One known candidate: **the Suspense release can take up to ~9 s** (B waits for the end of a 4-bar pass plus A's exit in free bars). A faster option would land on the next 2-bar boundary.
4. **This year's playlist, when it arrives:**
   - Make it a pool (`data/pools/<name>.json`) and run `npm run prep -- --pool <name>`. The `hooks` and `signatures` steps propose candidates.
   - The user approves hooks and vets Signatures on the audition page. Then rerun the variety and phrase measures on that pool.
   - **Done when:** every playable song has an approved best hook and reviewed Signatures, and `npm test` is green on the new pool.
5. **Retire or keep the old Decoys experiment** (`DECOYS.enabled`, off by default; `plan/decoys.ts`, `docs/decoys.md`). Suspense's teases now do the user's version of Decoys. Ask the orchestrator before removing it.

## Waiting on the user

- **The Wii remote mapping** (Q34, being iterated): proposed A Següent, B-hold Suspens, 1 Parlem, 2 Aguanta, − (hold) Enrere, + Claim, D-pad effects. Nothing is built.
- **This year's playlist:** hooks to approve and Signature vetoes (see the queue).
- **Listening feedback** not yet given on the new sound (queue item 3), including the ~9 s Suspense release.
- **More Hold music and victory tracks** (the media pools are tiny).

## Decided since the pause

- **Q26 = A+:** the show laptop stays installed (the relay, plus Python Rubber Band for the Blend renders) and pulls its media from R2. No WASM or browser time-stretcher; "nothing installed" is deferred until after the event.

## Known issues and risks

- **Prepared data.** `data/out` is gitignored. The engine tests that need it skip without it (`tests/support/data.ts`), and CI runs the rest. `QUINA_OUT_DIR=/nonexistent node --test "apps/show/tests/*.test.ts"` reproduces CI.
- **Automatic hooks are proposals.** On last year's hand-tagged songs the top candidate is within a bar of a tagged hook in 25 of 77 songs, and one of the top three in 48 of 77 (chance is about 1 in 8 per candidate).
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
  - `decoys=1`: the old Decoys experiment.

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

## Added by others while paused

- **Orchestrator, 2026-11-24:** the user decided Q26 = A+ (an installed show laptop, media pulled from R2). No browser time-stretcher is needed; "nothing installed" is deferred until after the event.
- **Orchestrator, 2026-11-24 (from 1e, c424649):** make `apps/cards/dist/cards.json` plus `card-types.json` the formal source of card types, with a type per round in `RoundPlan`. Then drop `plan.cardTypes`' name, colour and price. For now, Admin shows the types read-only from `card-types.json` and keeps `plan.cardTypes` in step (`withPrintedCardTypes`).
- **Orchestrator, 2026-11-24:** Pause (Pausa) reuses the existing `pause {on}` / `ShowState.pause` / public `pause`, the same state as the technical pause. The only engine change: **during a pause, play the interval music instead of the Hold music**, and resume into the round with a normal transition. The UI (1e) and the feed (b2) need nothing new.
- **Orchestrator, 2026-11-24 (from b2):** `tools/prep/tests/test_hooks_auto.py::test_the_candidates_are_the_chorus_starts_…` is flaky. `hook_detect.section_kinds` uses `scipy.linalg.eigh` on a near-degenerate Laplacian, and multithreaded BLAS can flip the segmentation, so the top-1 ranking changes (bar 40 at 0.925 vs bar 4 at 0.82). CI now pins BLAS to 1 thread, which hides it. To fix:
  - (a) make section_kinds deterministic and robust (fix the eigenvector signs, and/or average over several k);
  - (b) widen the synthetic song's chorus/verse gap;
  - (c) assert the docstring's real claim (all chorus starts in the top 4) instead of an exact top-1.
  On real songs it only changes which candidate is proposed first, since a human approves hooks.
