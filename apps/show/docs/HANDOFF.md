# Sound engine handoff

The single place to resume the sound engine's work from. It was first written when the user paused the work (2026-11-24) and is kept current at each milestone.

**What this covers:** the show engine and its transitions, Signatures, Suspense and its Decoy teases, the song preparation pipeline (tools/prep), `@quina/protocol` and the Game journal. The journal is shared with the platform session.

**Where else to look:**
- The decisions are in `GLOSSARY.md`, `docs/how-the-quina-works.md` (the current-state read of a whole night), `docs/mixer-design-decisions.md`, `docs/show-ui-and-platform-decisions.md` (its "Changes" section) and `docs/adr/`. They override older research.
- The dates are in `docs/timeline.md`: the playlist is final on Tue 1 Dec, the night is Sun 27 Dec.
- The team roles are in `docs/team.md`. Questions only the user can answer go in `docs/open-questions.md`.

## Now (kept current at each milestone)

- **In progress:** downloading the draft playlist (D66 answered U1). It has 151 songs now, up from 86 on 23 Nov. The pool is `data/media/draft/pool.json` (`draft2026`, gitignored). Run it with `--pool data/media/draft/pool.json`.
  - **The cause of the bot check was the VPN.** All traffic went through ProtonVPN, and YouTube asks VPN addresses to sign in. With the VPN off (the user paused it on 25 Nov) spotDL downloads normally, about 30 s a song.
  - **Ids are stable** (`fb321f4`): a track keeps its first id (`output/song-ids.json`), and audio is named `<Spotify id>.opus`. So the user's reordering moves no download, cache or hook decision.
- **Next:**
  - prep on the draft (covers, decode, `quality`, analyze, hooks);
  - one short list for the user of the songs spotDL couldn't get or that `quality` flags, which they download by hand as `<id>.mp3`;
  - automatic hooks proposed for the whole draft; then tell the orchestrator;
  - the provisional bulk hook approval (a test aid, marked provisional everywhere; Backend's preflight WARNs).
- **Blocked:** nothing.
- **Waiting on the user:**
  - U13: the listening pass (transitions stay frozen until then). The demo for it is rendered, and the orchestrator has sent it: `data/out/listen-demo/listen-demo.m4a` plus `cues.md`, made by `node apps/show/tests/support/listen-demo.ts` (804e35f). A plan is ready (not applied) if call and response feels too frequent: it labels 70% of transitions today, and would become an occasional move at about 15–25%, with a variety bound;
  - U14: hook approval, before the first rehearsal (U27 sets when that is).
- **Disk:** 12 GB free on 25 Nov, down from about 21 GB. Decoding 151 songs takes about 4 GB, and the stems guard wants 10 GB free. Two old sets could go, but deleting them is the user's call:
  - the 4-song dry run, about 273 MB: `data/cache/pools/draft`, `data/out/pools/draft`, `data/media/draft/{overrides,covers,lastyear-audio,prev-fetch,songs4.json}`;
  - last year's test pool in `data/cache`, about 7 GB, once the draft can replace it.
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
2. **The draft playlist (151 songs on 25 Nov), downloaded and prepared** (see Now):
   - **Downloads (D66):** spotDL, as last year, with the VPN off; YouTube's own Opus stream copied (`--format opus --bitrate disable`), one song at a time. The bot check came from ProtonVPN's address. The PO-token plugin is not needed (its server was built in `data/cache/tools/bgutil-pot`, gitignored, not running, and can go).
   - **Quality** (the user's condition): prep's `quality` step (`71236b8`) flags low bitrate, a low-pass under 15 kHz, a length more than 5 s off Spotify's, and version words. Songs it flags or spotDL couldn't get go to the user as one short list; they download those by hand.
   - **Timings per song:** decode about 1.5 s, analyse 6 s, stems 21 s. Hook approval is the user's part, about 2 minutes a song.
   - **A pool nobody tagged** is playable only after its automatic hooks are approved and prep runs again; the README's steps say so.
   - **No Spotify features** this year, so the half-time rule also works from librosa alone (`680e4bc`).
   - **Size per song in R2:** about 68 MB with two approved hooks (mix.flac 28–47 MB, stems 19–30 MB, Signatures and snippet about 1 MB). **At 151 songs that is about 10.3 GB, over R2's free 10 GB.** Option (d) (the original audio plus Opus 256k stems, decoded at sync time) is about 20 MB a song: measured, the mix re-decodes bit-identically, and Opus stems come back at their exact length within 2 samples. Needed if the final playlist stays above about 100 songs (Backend's call with the orchestrator).
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
