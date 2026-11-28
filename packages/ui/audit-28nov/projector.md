# Projector audit (audit-projector, 28 Nov 2026)

Read-only audit of the projector: `apps/stage` (standalone `/stage/`) and the real show page `/show/` with the stage mounted over the engine's drum. It compares the app with the 22 boards on the canvas's Projector page (`temp/design-canvas/look/project/Projector-*.dc.html`). Code: clean worktree of `origin/main` at **d3634e28**.

## How this was checked (and its limits)

- **Boards:** served locally (`preview/serve.mjs 5801`) and screenshotted at full height. PNGs are in `audit/projector/boards/`. I also shot the archived pre-redraw versions (`Abans-28nov-Projector-*`, see "The most important finding") into `audit/projector/boards-pre-redraw/`.
- **Standalone stage:** `/stage/?demo=<fixture>`, from a `--dist` relay on port 5810.
  - All 72 fixtures in `packages/ui/fixtures/states.ts` at 1440×1080: `audit/projector/app/4x3/<fixture>.png`.
  - 29 key fixtures at 1920×1080: `audit/projector/app/16x9/`.
  - **Limit:** standalone has **no drum**. The band shows a placeholder, «Tambor · a la pàgina del show».
- **The real show page:** `/show/` on a `--test --repertoire 2026` relay (port 5811), loaded with the user's real Game plan (a copy of `data/link/cloud-plan.json` and its logo media).
  - It was driven over the relay socket, as a `tablet`: `setCardsInPlay`, `roundIntro`, `newRound`, `next`, `suspense`, `hold`, `pause`, `claim`, `checkNext`, `interval`, `testJump`, `endGame`.
  - Screens are in `audit/projector/app/show-4x3/`, `show-4x3-b/`, `show-16x9-b/` and `show-16x9/`. Each folder has a `drive-log.txt` with the engine scene per shot.
  - The scripts are in `audit/projector/tools/` (`drive.mjs`, `drive2.mjs`).
  - **Limits:** headless Chrome with audio output disabled, so no sound was judged. Python prep was stubbed, so the Blend "stretch" renders failed; that is an engine warning, not the stage.
- **Motion:** only seen in stills taken at timed points. I didn't verify timings and easings frame by frame.

All paths below are relative to `<scratch>`.

## The most important finding: the "agreed" boards were redrawn to match the app

On **28 Nov (01:43–03:16)**, most of the 22 Projector boards were regenerated "**As built**". Their captions say so, and many carry a «NOT BUILT YET» tag listing what the app still lacks. The earlier versions were moved to the Archive as «Before the redraw (28 Nov)»:
- `Abans-28nov-Projector-Joc`, `-Abans`, `-Comprovacio`, `-Comprovacio-Fallida`, `-Comprovacio-Revisio`, `-Linia`, `-MitjaPart`, `-Desgraciat-Dempeus`, `-Desgraciat-Final`.

Consequences:
1. **Against the current boards, the app looks close in most scenes.** This is because the boards now depict the app, plus a short "not built yet" list per board.
2. **Against the boards the user reviewed and agreed before 28 Nov**, the main play screen is very different. This is very likely what the user means by "nothing to do with the mockups".
   - Compare `boards-pre-redraw/Abans-28nov-Projector-Joc.png` with `app/show-4x3/08-landed-4.png`.
   - The pre-redraw Joc has:
     - a curved ring of about 7 smaller covers with ink outlines and a shadow;
     - a thick glowing gold window with an ink pointer;
     - the gold «QUINA 3» plate;
     - an ink-stroked white title with a gold artist;
     - a starfield sky.
   - The app has:
     - three huge flat covers filling a 640 px band, the side ones dimmed to 35 %;
     - a thin gold reticle and a small gradient flapper;
     - «QUINA 3» as small plain gold text;
     - a plain white title with no stroke and a lilac artist;
     - a flat navy ground with no stars.
3. **Nobody can tell from the canvas which version is "agreed".** The new orchestrator should ask the user (plain (a)/(b)):
   - (a) the pre-redraw look;
   - (b) the "as built" boards plus their «NOT BUILT YET» items.

   Until then, every entry below lists both: what differs from the current board, and the bigger gap to the pre-redraw board where one exists.

## Look gaps on every scene

These were checked in `apps/stage/stage.css` and in every screenshot.

- **No starfield anywhere.**
  - Every Projector board's ground is the `.night` star pattern (two radial-gradient dot layers).
  - The stage paints flat `var(--color-bg)` (`.stage__backdrop`, stage.css ~241), plus a soft radial in the drum band.
  - There is no `.night`-style background in `apps/stage`.
- **Display type is inconsistent.** Some scenes have the ink-stroked Londrina capitals (Celebrations, Break title, Check plate, intro prize chips). Others don't:
  - the play title, `.play__title`: no stroke;
  - the round label, `.play__round`: plain small gold text;
  - the intro name, `.round-start__title`: no stroke;
  - «Tornem de seguida»: no stroke;
  - «Gràcies per venir!», `.after__title`: smaller than the board.
- **The play scene's artist** is `--color-text-muted` (lilac). Board: gold.

---

## Board by board (the most important first)

### 1. Projector-Joc (the main play screen) and the drum: **partly built**

- **Board:** `boards/Projector-Joc.png`. Pre-redraw: `boards-pre-redraw/Abans-28nov-Projector-Joc.png`.
- **App:**
  - real show, 4:3: `app/show-4x3/08-landed-4.png`, `app/show-4x3-b/a04-play.png`;
  - real show, 16:9: `app/show-16x9-b/a04-play.png`;
  - standalone: `app/4x3/play.png`, `app/16x9/play.png`.
- **Code:**
  - `apps/stage/render/play.ts`, `render/garland.ts`, `model/motion.ts`, `model/songs.ts`;
  - the drum: `apps/show/engine/src/wheel/drum.ts` and `apps/show/engine/css/drum.css`;
  - the band layout: `apps/stage/stage.ts`.
- **Built:** the band layout, the title and artist under it, the row of 3 tiles with the current one ringed in gold, and the garland whose pattern follows the Heat.
- **Differs from the current board** (its own «NOT BUILT YET» list, confirmed in CSS):
  - no gold «QUINA N» plate (`.play__round` is plain gold text, stage.css ~1230);
  - no ink-stroked title (`.play__title` has no `-webkit-text-stroke`);
  - the artist isn't gold (`.play__artist` uses `--color-text-muted`);
  - no ink outlines on the drum's covers;
  - no thick gold window (the app has a thin reticle);
  - no ink pointer (the app has a small gradient flapper);
  - no starfield.
- **Differs from the pre-redraw board, the bigger gap:**
  - The drum is three giant flat covers, not a curved ring of about 7 outlined covers.
  - The band is 640 px tall, edge to edge: the drum "owns the screen".
  - The side covers are dimmed to 35 % with tiny captions.
  - The tiles don't fade along the row.
- **16:9 overlap:**
  - «QUINA 2» is placed inside the pillarboxed 1440 box but over the drum band, which spans the full width. So it sits on top of the second cover from the left (`app/show-16x9-b/a04-play.png`, x≈272).
  - At 4:3 it sits on the drum's left cover too.
- **The garland's bulbs hang over the drum's window and pointer** in every play shot. The board shows the same, but it hides the pointer.
- **Sound cues:** none expected from the stage (ANIMATIONS: the projector is silent). Not judged.

### 2. Projector-Barreja-Gir-Suspens (Shuffle, Spin, Suspense): **partly built**

- **Board:** `boards/Projector-Barreja-Gir-Suspens.png`.
- **App:**
  - Shuffle: `app/show-4x3/04-shuffle-1500-*.png`, `04-shuffle-3000-*.png`;
  - Spin: `app/show-4x3-b/a02-spin-early.png`, `app/show-4x3/06-spin.png`;
  - Suspense: `app/show-4x3-b/a05-suspense-a.png`;
  - standalone: `app/4x3/shuffle.png`, `spin.png`, `suspense.png`.
- **Code:** `render/round-start.ts`, `model/shuffle.ts`, `render/play.ts` (`setMotion`), and stage.css `spin` / `suspense`.
- **Built:**
  - the grid of every cover, shaking, then flying in;
  - the drum taking over;
  - the Spin's motion blur, with the title dropping and fading;
  - the Suspense's gold «?» and the band vignette.
- **Differs:**
  - The covers in the Shuffle grid have no ink outline (the board says so too).
  - The «?» is gold Londrina with no ink stroke (board frames ⑤⑥ keep the ink-stroked look).
  - During a Spin, the faded artist line slides down onto the tile row: «Rihanna» overlaps the top of the tiles (`a02-spin-early.png`). The board calls this "goes under the tiles' top edge"; on screen it reads as an overlap.
- **With the real 2026 repertoire:**
  - The grid holds about 130 covers at roughly 88 px each, against the board's 70 larger ones (`app/show-16x9/04-shuffle-1500-*.png`).
  - Two cells show a "?" placeholder or a blank white cover (missing art).
- **Missing sound cue:**
  - ANIMATIONS.md `shuffle` and the Sound map give the engine "the Shuffle's item box" sound at ① and a «whoosh» bed.
  - `grep` finds no Shuffle sound in `apps/show/engine/src`: `shuffle.scheduled` is emitted with no sfx (show.ts ~1316).
  - The Spin's whoosh exists (`plan/planner.ts`).

### 3. Projector-Presentacio (a round's Intro): **partly built**

- **Board:** `boards/Projector-Presentacio.png`.
- **App:**
  - real show: `app/show-4x3/03-round-intro.png`, `20-intro-round12-normal.png` (Especial), `20-intro-round6-normal.png` (Desgraciat);
  - standalone: `app/4x3/roundStart.png`, `desgraciatIntro.png`.
- **Code:** `render/round-start.ts`, `view.ts` (`prizeView`).
- **Built:** the name; the prize cards with gold and orange chips; the Especial rule beside the name; the Desgraciat nino and its single prize.
- **Differs, broken with the real plan:**
  - Prize cards overflow the bottom of the 1080 screen when titles wrap to two lines (real prize names are long):
    - Especial: «Televisor i Casc de moto»;
    - Desgraciat: «Bateig de submarinisme».
  - The card's bottom edge and padding are cut off (`20-intro-round12-normal.png`, `20-intro-round6-normal.png`).
  - The demo's one-word prizes hide this.
  - The name is left-aligned and large: in the 4:3 shots it fills about half the width. This matches the redrawn board; it isn't checked against a pre-redraw one (none exists).
- **Never shown on the night as runbooked:** see Broken behaviour B1.

### 4. Projector-Comprovacio (the Check while it plays): **built as drawn**, with one bug

- **Board:** `boards/Projector-Comprovacio.png`. Pre-redraw: `boards-pre-redraw/Abans-28nov-Projector-Comprovacio.png`.
- **App:**
  - real show: `app/show-4x3/15-check-step-2.png`, `app/show-4x3-b/a08b-check-playing.png`, `app/show-16x9-b/a08b-check-playing.png`;
  - standalone: `app/4x3/check.png`.
- **Code:** `render/check.ts`, `model/check.ts`.
- **Built:** the plate, the type badge with the side's checkLabel, the dimmed rows, ✓ discs in the cover centres, and the running dashed ring with a play disc.
- **Bug (confirmed live, `app/show-4x3/17b-check-failed.png` and `17c-after-fail.png`):**
  - From the **second Check of the night on**, the type badge's ✓ is an **empty green disc**.
  - Cause: `render/check.ts` `setTypeMark()` (line ~297). When the mark goes to `null` it empties the icon but leaves `dataset.mark`. The next `'ok'` sees `dataset.mark === 'ok'` and never puts the icon back.
- **Vs the pre-redraw board:** the ✓ moved from the corner to the centre, and the equaliser badge became the running ring. This was intentional; the canvas notes the change.

### 5. Projector-Comprovacio-Correcte (pass at the cue): **built but never seen live**

- **Board:** `boards/Projector-Comprovacio-Correcte.png`.
- **App:**
  - standalone (fixture only): `app/4x3/checkCuePass.png`, which matches the board;
  - real show: `app/show-4x3-b/a09-cue-300.png` and `a09-cue-700.png`, and `app/show-4x3/15-check-step-4.png`.
- **Code:** `render/check.ts` `showResult`, `model/check.ts` `shownCheck`, engine `apps/show/engine/src/show/show.ts` `cue()`.
- **Differs:**
  - On a single-card claim, the **last** card's pass cue goes straight into the Celebration: `cue()` → `finishBatch(true)`, so the scene is `celebration` at the next state.
  - 300 ms after the cue the Check is already fading under «QUINA!». The gold «Cartró correcte!» plaque never shows.
  - It shows only for a pass that isn't the batch's last card.
  - The board's "at the cue … slides up … The Celebration follows" does not happen in a normal night.
  - `shownCheck` keeps a failed Check on screen; it has no equivalent for a pass.

### 6. Projector-Comprovacio-Fallida (failed Check): **built as drawn**, same badge bug

- **Board:** `boards/Projector-Comprovacio-Fallida.png`.
- **App:** real show `app/show-4x3/17b-check-failed.png`; standalone `app/4x3/checkCueFail.png`.
- **Code:** `render/check.ts`.
- **Built:** a slate plate, red beams, the huge ✗, the falling nino, and the ✗ disc on the failing song.
- **Differs:**
  - The badge's empty ✓ disc (bug in §4).
  - The unrevealed song after the ✗ in the checked row («Pan y mantequilla») stays at full brightness. The board has no such cell (all four were revealed), so this case isn't specified.

### 7. Projector-Linia (Line Celebration): **built as drawn** (current board)

- **Board:** `boards/Projector-Linia.png`. Pre-redraw: `boards-pre-redraw/Abans-28nov-Projector-Linia.png`.
- **App:** real show `app/show-4x3/15-check-step-4.png`; standalone `app/4x3/celebration.png`.
- **Code:** `render/celebration.ts`.
- **Built:** the rays, the paper confetti, «LÍNIA!» ink-stroked and tilted, the gold plate, the 4 corner ninos, and the garland's win pattern.
- **Differs:**
  - No starfield.
  - Standalone shows the «Tambor · a la pàgina del show» placeholder through the shout. That's a dev view only.

### 8. Projector-Quina (Bingo Celebration): **partly built**

- **Board:** `boards/Projector-Quina.png`.
- **App:** real show `app/show-4x3-b/a10-celebration.png`, `app/show-16x9-b/a10-celebration.png`; standalone `app/4x3/celebrationBingo.png`.
- **Code:** `render/celebration.ts`, `view.ts`.
- **Built:** «QUINA!», the plate, the ninos, the confetti, the rays, and the PrizeCard (standalone).
- **Differs:**
  - The board's own «NOT BUILT YET»: ANIMATIONS.md `celebrate` asks a Bingo for "a fireworks sticker". There is none (no `firework` anywhere in `apps/stage`).
  - In my live run the PrizeCard did **not** show. The round's prizes had not been revealed because `testJump` skips the intro. This is by design (prizes appear only once revealed), so it's a test artefact, not a bug. Worth one live check with a proper `roundIntro`.

### 9. Projector-Quina-Focs (fireworks C, animated): **proposal, not to build**

- **Board:** `boards/Projector-Quina-Focs.png`.
- Not built: no code, which is correct for an unapproved proposal.
- The fully specified spec (ANIMATIONS `celebrate` ⑧, timings, budget) is ready if the user approves it.

### 10. Projector-Pausa: **built as drawn**

- **Board:** `boards/Projector-Pausa.png`.
- **App:** real show `app/show-4x3/12-pause.png`; standalone `app/4x3/pause.png`.
- **Code:** `apps/stage/stage.ts`, stage.css `.stage__pause`.
- **Differs:** no starfield. «Tornem de seguida» has no ink stroke, which the board also says.

### 11. Projector-Descans (the Break): **built as drawn**, minus the board's note

- **Board:** `boards/Projector-Descans.png`. Pre-redraw: `boards-pre-redraw/Abans-28nov-Projector-MitjaPart.png`.
- **App:** real show `app/show-4x3-b/a11-interval.png`, `app/show-16x9-b/a11-interval.png`; standalone `app/4x3/interval.png`.
- **Code:** `render/interval.ts`, `render/parts.ts` (SponsorStrip).
- **Built:** «DESCANS», the gold plate «SEGÜENT: QUINA 3 DE 12», the card and price, the Ring countdown, two ninos, and the panning SponsorStrip of logos (real plan).
- **Differs:**
  - No starfield.
  - The «TORNEM D'AQUÍ…» line is cream, not white.
  - The board's «NOT BUILT YET» names "the Londrina capitals" for some text.
  - The Interval can only start from a Bingo's Celebration (`scenes.ts` `interval: celebratingBingo`); my `interval` from play was rejected. This is by design.

### 12. Projector-Abans (before the start): **partly built**

- **Board:** `boards/Projector-Abans.png`.
- **App:**
  - real show with the plan: `app/show-4x3/01-after-start.png`;
  - standalone with the real plan: `app/4x3/linkNoShow.png`;
  - demo: `app/4x3/before.png`, `app/16x9/before.png`.
- **Code:** `render/before.ts`, `model/night.ts`, `render/qr.ts`, `render/parts.ts`.
- **Built:** the edition's name, the two card types with the rounds they play, round 1's price tag, the start time, the QR with the sitting nino, and the SponsorStrip.
- **Differs:**
  - The board's «NOT BUILT YET»: the Desgraciat pill's sad face still has a circle (D23).
  - No starfield.
  - «7:00 PM» shows in capitals on `/show/` but as «7:00 pm» on standalone `/stage/`. The same component renders differently on the two pages.
  - Without a Game plan, the scene is only a title and a QR.
- **On the night it is skipped:** see B1.

### 13. Projector-Final (end of the night): **partly built**

- **Board:** `boards/Projector-Final.png`.
- **App:** real show `app/show-4x3-b/a15-end.png`, `a16-end-later.png`; demo `app/4x3/after.png`.
- **Code:** `render/after.ts`, `render/parts.ts` `SponsorList`.
- **Built:** the title, «Amb el suport de», and the sponsors rolling up.
- **Differs:**
  - The board is a static, centred 5-column grid of uniform **white LogoTiles** under a bigger ink-stroked title.
  - The app is a `SponsorList`, not the `LogoTile` / `SponsorStrip` tiles:
    - cream boxes of varying widths in ragged rows;
    - a sponsor with no logo shown as bare text outside any tile («Verdures Andreu»);
    - the list starts empty and rolls in from the bottom (5 s in, the screen is mostly empty);
    - the title is smaller with no stroke.
  - In demo (no logos) the sponsors are a wall of text names.

### 14. Projector-Comprovacio-Revisio (Review, and Back): **built as drawn** (fixtures)

- **Board:** `boards/Projector-Comprovacio-Revisio.png`.
- **App:** `app/4x3/checkReview.png`, `checkAuto.png`, `checkResumed.png`.
- **Code:** `render/check.ts`.
- Matches the board. Not exercised live.

### 15. Projector-Comprovacio-TipusErroni-Abans (wrong type, before the cue): **built as drawn**

- **Board:** `boards/Projector-Comprovacio-TipusErroni-Abans.png`.
- **App:** `app/4x3/checkWrongType.png`.
- **Code:** `render/check.ts`.
- Matches the board. Minor: the «Ó» accent of «CARTRÓ» pokes above the plate's top edge.

### 16. Projector-Comprovacio-TipusErroni (wrong type, after the cue): **built, no fixture**

- **Board:** `boards/Projector-Comprovacio-TipusErroni.png`.
- **No fixture shows the after-cue state**: `checkWrongType` stops before the cue.
- **Code:** `render/check.ts` handles it (`data-wrong-type`, big ✗ over the type-coloured card). It isn't seen in the app.

### 17. Projector-Comprovacio-Desgraciat (standing Check, kept as a fallback, U222): **built as drawn**

- **Board:** `boards/Projector-Comprovacio-Desgraciat.png`.
- **App:** `app/4x3/checkStanding.png`, `checkFallen.png`, `checkCueFallen.png`.
- **Code:** `render/check.ts`, `model/check.ts`.
- **Differs:**
  - The fixtures use card #23, a normal card. So the badge reads «NORMAL 1–5», not the board's «DESGRACIAT» with the pink card (the caption notes this).
  - In `checkCueFallen` the sitting nino runs off the bottom of the 1080 screen (feet cut off).

### 18. Projector-Descans-Desgraciat: **built as drawn** (fixture)

- **Board:** `boards/Projector-Descans-Desgraciat.png`.
- **App:** `app/4x3/intervalDesgraciat.png`, `app/16x9/intervalDesgraciat.png`.
- **Code:** `render/interval.ts`.
- Same notes as Descans.

### 19. Projector-Desgraciat-Joc (Desgraciat in play): **partly built**

- **Board:** `boards/Projector-Desgraciat-Joc.png`.
- **App:** real show `app/show-4x3/20b-play-round6-desgraciat.png`, `app/show-4x3-b/a12-desgraciat-play.png`; standalone `app/4x3/desgraciat.png`.
- **Code:** `render/play.ts`.
- Same gaps as Joc: plain small «QUINA DEL DESGRACIAT», no stroke, lilac artist, no outlines, thin window, no stars.

### 20. Projector-Desgraciat-Final (the finale on stage): **partly built**

- **Board:** `boards/Projector-Desgraciat-Final.png`.
- **App:** `app/4x3/finale.png`, `finaleFall.png`, `finaleFallen.png`, `finaleSaved.png`, `finaleWin.png`.
- **Code:** `render/finale.ts`, `model/finale.ts`, `stage.ts` (`setBand`).
- **Built:** the floor with ninos in costume poses, number plates, falls, «Salvats!» rays, spotlights and confetti.
- **Differs:**
  - The board's own «NOT BUILT YET»: the gold «QUINA DEL DESGRACIAT» corner plate and the Londrina capitals (the app has the plain small label).
  - The «Salvats!» ribbon wasn't visible 4 s into `finaleSaved` (it lasts 1.5 s, so this is probably expected).
  - **Missing sounds:** the board's motion table asks the engine for a «pop» per nino (`finale-enter`), a «bloop» per landing (`finale-fall`) and a short «ta-da» (`finale-safe`). `grep` finds none of these in `apps/show/engine/src`.
  - Not exercised live: `finale` with no `cardIds` did nothing at 23 cards standing.

### 21. Projector-Desgraciat-Potra («QUINA POTRA!»): **built as drawn**

- **Board:** `boards/Projector-Desgraciat-Potra.png`.
- **App:** `app/4x3/finaleCelebration.png`, `celebrationStanding.png`.
- **Code:** `render/celebration.ts`.
- **Differs:** no starfield; the standalone placeholder text shows through.

### 22. Projector-Sense-Connexio (link lost): **built as drawn**, no fixture

- **Board:** `boards/Projector-Sense-Connexio.png`.
- **App:** `app/4x3/linkNoShow.png`: the red dot plus «Esperant el show», bottom right, on standalone with no show page.
- **Code:** `stage.ts` `link-lost`, stage.css `.stage__link`.
- No fixture: I saw the `noShow` variant only.

---

## Stage behaviour that is broken regardless of design

- **B1. The night's runbook skips the before screen, the Intro and the Shuffle.**
  - `docs/night-runbook.md` step 5 and `apps/show/README.md` open `/show/?autostart=1`.
  - `main.ts` `unlock()` sends `next` right after «Start show» when `autostart=1`. `next` is allowed in `before` and starts round 1 with no intro and no Shuffle.
  - So Projector-Abans disappears at the click, and round 1's Presentacio and Barreja never show.
  - This matches the HANDOFF's "the show jumped straight into a round".
  - Code: `apps/show/engine/src/main.ts` ~1233. Rule: `packages/protocol/scenes.ts` `next`.
- **B2. The type badge loses its ✓ from the second Check on** (`render/check.ts` `setTypeMark`). See §4.
- **B3. «Cartró correcte!» is never seen for the last (usually only) card.** See §5.
- **B4. Prize cards overflow the bottom of the screen** in the Intro with real, two-line prize titles. See §3.
- **B5. The round label overlaps the drum's covers at 16:9 and 4:3.** See §1.
- **B6. The finale's and the Shuffle's specced sound cues don't exist in the engine.** See §2 and §20.
- **B7. Off the stage, found on the way: the relay crashes** (unhandled `spawn` ENOENT) when `tools/prep/.venv/bin/python` is missing and a Blend asks `/api/stretch`. Seen at `apps/show/relay/server.ts` ~301 (`stretchRender`). This is Backend's area.
- **Console errors:** none from `apps/stage` in any of the 72 fixtures or the live runs.
  - The only errors were missing media for my setup (voice cues, Hold music, logos before I copied `data/link/media`) and the stubbed stretch.
  - On the user's laptop, check that `data/link/media` is filled; otherwise every logo tile is a broken-image icon (`app/show-4x3/02-cards-in-play.png`).
- **Scenes that never show:**
  - `before`, the Intro and the Shuffle under the runbook URL (B1);
  - the pass plaque (B3);
  - the wrong-type after-cue state has no fixture (§16).

## Biggest gaps first (the order a builder should take)

1. **Decide which look is "agreed"** (the pre-redraw boards or the "as built" boards). The user's complaint points to the pre-redraw look. Everything below is smaller than that decision.
2. **The main play screen and the drum (Joc, Desgraciat-Joc, Spin/Suspense):**
   - the gold round plate;
   - the ink-stroked title, the gold artist and an ink-stroked «?»;
   - the drum's look: ink-outlined covers, a thick gold window, the ink pointer, and the ring/size per the agreed board;
   - fix the round label sitting on the covers.
3. **The starfield ground on every scene**, plus consistent ink-stroked Londrina titles (Intro, Pausa, Final, round labels).
4. **B1: the night's opening.** Stop `autostart=1` from spinning past `before`, so the before screen, the Intro and the Shuffle actually appear.
5. **B3: show «Cartró correcte!»** at the cue before the Celebration.
6. **B2: the type badge ✓** (a one-line fix).
7. **B4: the Intro's prize cards** must fit with real two-line prize titles (and check the Celebration's PrizeCard with real titles).
8. **The Final screen:** a static, centred grid of white LogoTiles under a big ink-stroked title (not the ragged rolling list); sponsors without logos as tiles.
9. **Missing sound cues** (engine): the Shuffle's item box and whoosh bed; the finale's pop, bloop and ta-da.
10. **Bingo extras:** the fireworks sticker the spec asks for. Fireworks C (Quina-Focs) only if the user approves it.
11. **Small items:**
    - the Desgraciat pill's sad face without a circle (D23);
    - «PM» vs «pm» between `/show/` and `/stage/`;
    - the «Ó» accent above the plate;
    - the nino cut off at the bottom in `checkCueFallen`;
    - a fixture for the wrong-type after-cue state;
    - an unrevealed cell after a ✗ (spec it).
