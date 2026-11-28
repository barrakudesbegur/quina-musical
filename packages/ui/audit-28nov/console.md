# Console audit (audit-console, 28 Nov 2026)

**Scope:** apps/console and how it drives the show, checked against docs/requirements/screens.md › Console, game-rules.md, the decision log's console D-numbers, ANIMATIONS.md's console rows and the 17 agreed Console boards.

**How it was checked:**
- **The running app:** a clean worktree of origin/main at 49a962b7 (a30542e7 plus two handoff-only commits). I ran it as the runbook does: `npm start` (dist build), relay on :5830, repertoire 2026, the laptop's real plan (a copy of `data/link/cloud-plan.json`: 12 rounds), and the temporary cards (1–399 normal, 400–699 especial).
  - The relay ran with `--test` only so that I could use `testJump` to reach round 6 and round 12. Everything else was pressed on the console, as a presenter would.
  - The show page ran in headless Chrome. The console ran at 1194×834, plus a second console for the lock.
  - A relay tap logged every state and event (`scratchpad/ac-tools/tap/`).
- **Rounds walked:** a whole round 1 (from the doors through the Line, a failed Bingo, a wrong-type Bingo, a review with a discard, and a late Bingo); the Interval; round 2's intro; the Desgraciat with its finale; the last round; the end.
- **Code:** I read it to confirm each finding.
- **Screenshots** are in `scratchpad/audit/console-shots/` (`live-NN-*.png`). Board evidence is in `console-shots/boards/`.

Severity: **BLOCKS** = can break or derail the night; **CONFUSING** = presenters will hesitate, press the wrong thing or be told something false; **POLISH**.

---

## 1. Logic and flow problems, by area

### 1.1 Setup and startup (cold laptop → running night)

1. **BLOCKS: the runbook's show-page command skips the doors, the intro and the Shuffle.**
   - **What happens:**
     - `docs/night-runbook.md` step 5 opens `/show/?autostart=1`.
     - `autostart=1` makes the "Start show" click also send `next` (apps/show/engine/src/main.ts:1233-1238).
     - In the `before` scene the engine accepts every play command (packages/protocol/scenes.ts:4, 34, 65). So that click spins and lands round 1's first song immediately: no doors screen, no intro, no prizes and no public Shuffle.
     - The song that plays comes from a Queue that was never shuffled in public.
   - **Evidence:** live-02-after-startshow-show.png (the drum spinning "QUINA 1" seconds after the click) and live-03-first-song-console.png.
   - **Same after a crash:** a show-page reload with the same URL lands the next song as soon as someone clicks Start show, even when the presenters were in Parlem. The tap logged `transition.scheduled` with reqId `local-…` right after the click (live-53-show-reload.png).
   - **Required:** doors, then the intro, then Barreja, then the songs (show-and-music.md › the night's running order; game-rules: "A round never starts by itself"). This matches the handoff's "the show jumped straight into a round".
2. **BLOCKS: the show page always waits for a physical click on the projector window, and the console can't do it.**
   - **What happens:** every load or reload of the show page shows a "START SHOW" overlay (live-01-cold-show.png). The console only says «La pàgina del show espera un clic a «Start show» al portàtil» (strings.ts:75).
   - The show page runs in kiosk mode on the projector. So the tech must click inside the projected image, in front of the audience, and with autostart that click also starts a song (item 1).
   - No console button unlocks the show.
3. **BLOCKS: with no cloud plan file, the console says there's no plan and falls back to 5 rounds.**
   - **What happens:** with an empty link folder, the before screen says «Encara no hi ha pla de la nit: deseu-lo des de l'Admin.» (live-01-cold-console.png).
   - The engine then uses its default `roundsTotal: 5` (apps/show/engine/src/config.ts:194; show.ts:838) and the default schedule.
   - Nothing on the console tells the tech how to get the plan onto the laptop. It only arrives through `npm run link` from the cloud (runbook step 4), or Admin's local save.
   - The preflight is the only check.
4. **CONFUSING: the engine's `roundsTotal` (5) leaks into the console even when a 12-round plan is loaded.** Verified live with the 12-round plan:
   - the menu shows «Quines en total 5» with −/+ buttons (Menu.svelte:150-155), and its subtitle says «Quina 1 de 5» (Menu.svelte:65);
   - the Interval says «QUINA 2 DE 5» and, before round 7, «QUINA 6 DE 5» (IntervalPanel.svelte:19; live-42-interval.png, live-49-descans.png);
   - **BLOCKS-level:** the Desgraciat's Celebration (round 6 of 12) says «Era l'última quina: acabeu la nit des del menú.» (CelebrationPanel.svelte:21 compares `celebration.round >= game.roundsTotal`; live-48-desgraciat-celebration.png). From round 5 on, every Bingo's Celebration tells the presenters to end the night.
   - The engine itself uses the plan for `lastRound` (show.ts:3613), so the stepper does nothing while a plan exists. It is a dead control that shows a false number.
5. **CONFUSING: the console offers "Següent" content before any round exists.**
   - **What happens:** at the doors, and at a round's intro before Barreja, the «SEGÜENT (PRIVAT)» panel names a song: «Hips Don't Lie» (live-04, live-06).
   - Barreja then reshuffles, and the real first song was «Bailando por Ahí» (live-08-shuffling.png).
   - A presenter reading the panel during the intro reads a song that won't play.
6. **CONFUSING: the setup is spread over many places, and much of it is invisible to the console.**
   - **Terminals and windows:** two terminals (the relay and the link), up to three hand-typed Chrome commands with eight flags each (the show, the laptop console, the projector-delay test), `caffeinate`, a token URL typed into the tablet, and `npm run preflight`.
   - **Hidden choices:** `fresh=1` the first time, but never again (the show page drops the parameter from its URL after use; I saw it gone). And never `--test` on the night, while a test run needs it.
   - **What the console checks:** only the before screen's local «Preparació» checklist. It is per device (localStorage), so the tablet's ticks aren't the laptop's.
   - **D282 (the Mac app with a control page) isn't built.** No control-page board exists either.
   - **Cards in play:** the console's menu «Cartrons venuts» works (live-05-menu.png; «Afegits 301 cartrons…»). But until cards are entered, the Phase is a placeholder and the Estat tab says «No hi ha cartrons en joc registrats», with no hint where to add them.
7. **BLOCKS (robustness, not the console's code): one failed helper process kills the relay mid-show.**
   - **What happens:** the relay spawns `tools/prep/.venv/bin/python stretch.py` on demand. When that binary is missing, the spawn's `error` event is unhandled and the whole relay process exits (ac-relay.log: `Error: spawn …/.venv/bin/python ENOENT`, "Unhandled 'error' event").
   - Every console dropped to «Sense connexió amb el portàtil» (live-11-first-landed.png).
   - It happened in my worktree because there was no venv. On the night, any broken or moved venv does the same.
   - This belongs to the Sound engine and Backend, but the presenters see it as "the console died".
8. **POLISH: the drift and Pace nudges start before the night and the first round.** Between round 1's first landing and its tenth, the console said, in turn, «+1 min», «Recuperant l'horari: cada cançó dura 1 s menys», «Anem avançats…» and «−11 min». The schedule is computed from a plan start (7:00 pm) that isn't the real start.

### 1.2 The doors and the round start

1. **CONFUSING: the doors' layout contradicts D195.**
   - **D195:** "At the doors and in a break: «Comença la quina» takes the right column's big slot; «Llançament» becomes a slimmer button; «Enrere» and «Comprovar» aren't shown". U173 only asks whether the doors' big button starts the night.
   - **The app:** the big slot is a pink «LLANÇAMENT» (a tap plays the throw song at full volume at the doors), with greyed «Enrere» and «Comprovar cartró» above it (cluster-layout.ts:26-27; live-04-console-before.png).
   - The most tempting button on the doors' screen is the one that blasts "Flying Free".
2. **CONFUSING: starting the night is a small item deep in the menu.**
   - The before screen says «Per començar la nit: Menú → Començar la nit» (strings.ts:686). The button is a MiniButton in the menu's second column (Menu.svelte:164; live-05-menu.png).
   - A, → and PageDown do nothing before the night (default-action.ts:100-102).
   - That's U173 (c), which the user hasn't picked. The doors simply have no main action.
3. **CONFUSING: the doors are silent.**
   - The requirement: "Doors and card sales… Music plays" (show-and-music.md › running order, «Music for each moment»: "The doors… each have their own set").
   - The engine has no doors set (`MUSIC_SETS = ['breaks','pausa','end']`, packages/protocol/vocabulary.ts:222). `intervalSkip` and `intervalSet` aren't allowed in `before`.
   - The console shows «No sona cap cançó», and the only sound it can start at the doors is the throw song.
   - The doors' voice countdown exists in the engine (show.ts:3469-3478). I didn't hear it: headless, silent.
4. **CONFUSING: at the round's intro, the console shows Parlem as on and says «prem per reprendre», but a tap does nothing.**
   - **Why:** the intro is an engine Hold (`hold.reason: 'music'`), so Parlem renders pressed and striped.
   - `hold` isn't allowed in `roundStart` (scenes.ts:69). HoldModeButton keeps the button enabled because Pausa could be entered (`usable = enabled || level2.canEnter`, HoldModeButton.svelte:57), then silently drops the tap (`!enabled → return`, line 76). No toast, no command: I checked the tap log (live-07-intro-parlem-tap.png).
   - **Same in the Interval** (live-42-interval.png) **and on the end screen** (live-51-after.png): a pressed, striped Parlem saying «prem per reprendre» that does nothing.
   - Holding it does enter Pausa, which D135 limits to a round, a Check or a Celebration.
5. **CONFUSING: the intro's main action isn't in the action column.**
   - «Barreja» is a button inside the left panel. In the right column, «Enrere» and «Comprovar» are greyed and the big «SEGÜENT» is disabled (live-06-roundintro.png).
   - D196 says the right column holds the actions. The presenters' thumbs rest on a dead Següent while the action is elsewhere.
   - After the Shuffle, the big Següent lights up (correct).
6. **CONFUSING: the intro has no «Ara sona».**
   - D196 and D199: the playback is always at the top of the left column, on every screen.
   - In `roundStart`, `nowPanels` returns neither panel (logic/now-line.ts:51-54), while the intro music plays (engine.health: `holdMusic: parasail-minigame`).
   - After the Shuffle the intro music keeps playing, but «Ara sona» says «No sona cap cançó» (live-09-after-shuffle-play-idle.png).
7. **CONFUSING: D291 (Enrere on the first song undoes the round's start) isn't built.**
   - Enrere on song 1 only undoes that landing and leaves the round in Hold.
   - The decision log marks it "to model and build later", but it's one of the user's own test complaints.

### 1.3 The play cluster

1. **BLOCKS (perceived as "the show froze"): auto-advance silently stops at the final Phase, and the console's Auto still shows on.**
   - **What happens:** after 11 songs of round 1 (9 cards one song from a Line, Heat 0.87), the Phase went `final`. Auto-advance stopped (`autoAtMs: null`), and the song played on for minutes.
   - **What the console shows:**
     - the «Auto» toggle stays pressed and green, because PacePanel.svelte:68 reads `game.autoAdvance` only;
     - the only hint is a small orange chip «Fase final · prem «Següent»» and a flag on the ring (live-24-final-phase-stalled.png);
     - no toast.
   - The switch to keep auto-advance on in the final Phase is in the menu, not beside «Auto» (Menu.svelte:183).
   - **Required:** "The final Phase: auto-advance is off by default… with a switch to keep it on". The behaviour is as specified, but the presenters aren't told clearly. This happens before every first Line and every Bingo, so several times per round.
2. **CONFUSING: "Últim gir: automàtic" is shown for the presenters' own presses.**
   - The console attributes a Spin by the reqId's label prefix. An unlabelled console's reqIds start with `r-`, which reads as auto-advance (logic/device.ts:68-72; strings.ts:152).
   - Every press I made read «Últim gir: automàtic».
   - The label is blank by default, and the menu's label field says the new name applies only after a reload.
3. **POLISH: the Bingo Celebration's way on is hidden.**
   - The right column's big button is a disabled «SEGÜENT». «Passa al descans», the default and A, sits under the winner form in the left column, below the fold at 1194×834 (live-41-celebration-bingo.png).
   - It also goes on by itself after a while.
4. **CONFUSING: three different "go on" controls after a failed Check.**
   - The left panel has «Reprèn», Parlem says «prem per reprendre», the big button is «SEGÜENT», and the ring's chip says «prem «Reprèn»» (live-35-after-last-fail.png).
   - «Reprèn» and «Següent» both start the next song's Spin (checked: Reprèn → `transition.scheduled`).
5. **POLISH: the Celebration's «Ara sona» says «No sona cap cançó»** while the winning song or «Victòria» plays (live-29, live-41). NowPlaying only knows `current`, hold music and throws (NowPlaying.svelte:34, 68).
6. **POLISH: the Bingo Celebration and the Desgraciat's still show «SEGÜENT (PRIVAT)»** with a song, though the round is over (live-41).
7. **Works as specified:** Next, Back (long press; the tap shows «Mantén premut per confirmar»), Hold, Pace presets and the lock, the next song's countdown, the Futur reveal.
   - The Back flow: after Enrere, Hold music plays, «S'ha desfet l'última cançó» shows, and the song becomes Següent again (live-21-enrere-done.png).

### 1.4 Parlem / Pausa

1. **Works:**
   - a Parlem tap gives `hold`, ducked, with the HoldPanel and the ring badge (live-13-parlem.png);
   - a hold past 800 ms gives Pausa, with Parlem locked on and the zigzag, and the projector shows «Tornem de seguida» (live-15-pausa.png, live-15-pausa-show.png);
   - a tap on Parlem ends Pausa, and Parlem stays on (D128; the tap state after live-16).
2. **CONFUSING: Pausa stacks two «Ara sona» panels.**
   - The playlist's («kokiri forest ~ zelda lofi», «Música de la pausa · cançó 1 de 37») sits above NowPlaying's «Música de la pausa», with a ring and «Últim gir: automàtic».
   - Under them come a yellow Pausa panel with «Acaba la pausa» and the old «En espera · Els presentadors parlen» HoldPanel.
   - That's four panels before Següent's (live-15-pausa.png). D196 asks for one «Ara sona».
3. **CONFUSING: Parlem is shown striped and on in places where it isn't a presenter's Parlem:** the intro, after the Shuffle's Hold, the Interval, the end screen and every Celebration (reason `music` or `claim`). See 1.2.4. The presenters can't tell "we pressed Parlem" from "the engine is holding".
4. **D234's lock works.** Holding Parlem on one console showed «la manté una altra consola» and the lock on the other (live-52-lock-other.png). Without a label it names no console.

### 1.5 Aguanta / Suspens

1. **Works:**
   - an Aguanta tap switches from Parlem in place (`ducked: false`), and Següent disables (D133);
   - a hold gives Suspens, with the countdown «s'allibera sol en 26 s» on the strip, the ring's drum icon, and Següent's panel says «Suspens obert»;
   - letting go lands on the phrase (the `SUSPENSE` recipe; live-18b-suspens-held-5s.png).
2. **POLISH:** after letting go, the ring still says «Últim gir: automàtic» (1.3.2).

### 1.6 The claims (the claim pad)

1. **BLOCKS (fairness): songs keep landing while the claim pad is open, and Parlem can't be reached from it.**
   - **What happens:** «Comprovar cartró» opens the pad locally and sends nothing. The pad covers the whole body, and the cluster is gone (App.svelte:129-136).
   - So once a presenter opens it to type a number, they can't press Parlem. Auto-advance goes on until the claim is sent.
   - Measured: 2 landings while I typed two numbers in 25 s (position 15 → 17; live-31-pad-two-chips.png).
   - **Required:** on a claim the presenters stop new songs (Parlem) first (game-rules › Claims). D110 asks them to say «Algú més?» while taking numbers, which takes time.
   - The pad should hold (or offer Parlem); today the engine enters its `claim` Hold only when the claim arrives (show.ts:3763).
2. **CONFUSING: «Complet des de la cançó N» always shows as an orange warning, even for an on-time claim.**
   - #162, completed by the song that had just landed (14), showed «⚠ Complet des de la cançó 14» (CheckCard.svelte:80-83; live-27-check-start.png).
   - It is meant for late claims (R2-Q12). Shown every time, it looks like a problem.
3. **CONFUSING: the claims strip mixes in the round's earlier, decided claims.**
   - A single new claim (#7) showed «Cartrons cantats: #162 Vàlid · #5 Fallat · #450 Fallat · #7» and «4 de 4» (live-37-review.png).
   - The Line's #162 sat in the Bingo batch's strip as «2 de 3» (live-32).
   - `summarizeClaims` takes all of `flow.claims` (logic/claims.ts:54-60; CheckPanel.svelte:56-62). The requirement shows the list only when 2 or more cards are claimed together.
4. **POLISH:**
   - D164 calls «Torna a la quina» the pad's larger button. In the app it's the smallest, a grey button next to a bigger «+ Candidat» (live-26-claimpad-typed.png).
   - The pad's Línia/Quina switch works, and the default kind follows the round (Quina after the Line).

### 1.7 The Check

1. **Works:**
   - the claimed card's grid is marked privately, with the next song large inside the big «Destapa» button («Besos · 1 de 4»);
   - «Seguides»; the cue «Celebrem!» or «Fallada»;
   - two cards in a row: «Fallada» on #5 brought #450's Check on screen by itself;
   - a wrong type: «Tipus erroni: és un cartró especial, i aquesta quina juga els normals»;
   - «Revisió manual» with its four choices, and a warning on a decision against the card;
   - a discard returns to Parlem with the old music («Cartró descartat»; D122);
   - a late claim (#106, complete since song 38, claimed at 45) passes.
   - Evidence: live-27…live-40.
2. **CONFUSING: the review breaks D196.** The review panel puts a second «Ara sona» (and «En revisió · #7») at the top of the right column, beside the left column's own compact «Ara sona» (ReviewPanel.svelte:59; live-37-review.png). D196: "on the review board: the right side is only for action buttons".
3. **POLISH:** a wrong-type especial card shows the side chip «Desgraciat» next to a big «ESPECIAL» tile (live-34-after-fail-cue.png). The two labels disagree for the same card.
4. **Not verified:** the sounds (the snippets, the broken record, the fanfares). The Chrome was headless with audio output off.

### 1.8 The Desgraciat and the finale

1. **Works:**
   - Dempeus first, with «7 dempeus de 101» and the numbers;
   - «Final a l'escenari» grows and shows «Recomanat»;
   - the finalists' pad shows each card privately and refuses a fallen card («Ja ha caigut»);
   - «Començar final»; the falls; «Celebrem! el #437 guanya»;
   - the «ÚLTIM CARTRÓ DEMPEUS» Celebration.
   - Evidence: live-44…live-48.
2. **BLOCKS-level, as above:** right after it, «Era l'última quina: acabeu la nit des del menú» (1.1.4).
3. **POLISH:** the round starts in Hold with Hold music, and «Reprèn» shows. That may be an artifact of `testJump`.

### 1.9 The Interval and the end

1. **Interval:**
   - the music panel with «Salta la cançó» and the «Descans | Pausa» picker;
   - the next round's prizes;
   - the guide countdown;
   - «COMENÇA LA QUINA» big, with a slim «Llançament» on top (D195 is right here; live-42-interval.png).
2. **Interval problems:**
   - «QUINA 2 DE 5» (1.1.4).
   - The header still says «QUINA 1», with the Heat at FINAL.
   - «Llançament» is offered after every round, though the plan's only throw is after round 6 (D192, D194).
   - Parlem shows striped and dead (1.2.4).
3. **End:** «Acabar la nit» (a long press in the menu's danger zone) worked mid-round. The end screen has the end playlist, «Tempesta» big, and no Enrere or Comprovar (D194, D199).
   - The header still says «QUINA ESPECIAL», with the Heat. Parlem is striped and dead (live-51-after.png).

### 1.10 The menu

1. **Present:**
   - the device name and presets, the theme;
   - the connections;
   - the Wii remote (Connectar, Veure el comandament, the shake switch);
   - the LAN QR;
   - the night (the rounds stepper, the night's end, «Començar la nit»);
   - «Cartrons venuts»;
   - the game (Pausa, auto in the final Phase, the phones' announce, the Phase override);
   - the tools («Confirmar la línia sense comprovació»);
   - the winners, the resume code, the Plan B cheat sheet, «Proves» (test only);
   - the interface sounds, «Sons automàtics», «Prova de so», the volumes;
   - Pànic and «Acabar la nit» in a danger footer (live-05-menu.png).
2. **Missing from the requirement:** "the Schedule". There is no timetable view, only «Final previst de la nit».
3. **CONFUSING:** «Començar la nit» (the night's single most important action) is a mini button among settings.
   - «Quines en total» is a live stepper that does nothing with a plan and shows the wrong number (1.1.4).
   - «Pausa» is a menu switch as well as Parlem's second level.
4. **POLISH:** the LAN QR card says «Obriu aquesta consola amb l'adreça IP del portàtil perquè el codi serveixi». On the laptop's own console (localhost) the QR is useless, and the console doesn't build the LAN URL itself.

### 1.11 Other

- **Refusals:** most come back as a generic toast «… ara no es pot fer» (`wrongScene`, strings.ts:1005). They don't say why or what to do. Silent no-ops are worse: see Parlem in 1.2.4.
- **Small windows:** at a 756×469 window (a small laptop console window), the cluster fills the screen and every panel is hidden (the first live-01/live-03 shots, before I set the viewport). It isn't a requirement size, but the runbook's laptop console opens in an `--app` window of no fixed size.
- **ANIMATIONS.md, the console rows:** I didn't check them one by one. What I saw: `pattern-pan` (the stripes, the zigzag), `escalate-hold`, the lock look and `check-pace` behave as written. The `next-to-now` morph didn't visibly fly in the stills, and the handoff says it was never seen live.

---

## 2. Every board

From a helper's side-by-side of each board with the app's demo fixtures, at 1194×834 and 390 px. The shots are in `console-shots/boards/` (`board-<Name>.png`, `app-<fixture>-<size>.png`) and the close-ups in `console-shots/crops/`.
- **What it couldn't check:** the prod build has no `?wii=demo`, so no Wii badges or Wii states anywhere. Nor any state that needs the engine to answer (demo mode).
- **Live confirmations:** I confirmed the menu's open disclosure, the doors' layout, the review's second «Ara sona» and the Interval in the live run.

| Board | Verdict | What differs |
|---|---|---|
| Consola-Joc | partly | The Aguanta strip reads «mantén 🥁 Suspens»; the board has «Suspens ×3 / B+A». The Estat histogram is clipped at 1194: «Falten 4+» is cut and the footer is gone. Wii badges: couldn't check |
| Consola-Joc-Fosc | partly | The palette matches; same differences as Joc |
| Consola-Joc-Bloqueig | partly | Frames ①–④ match (the locked padlock, the Suspens stripes, the Pausa zigzag). The «En espera» panel's bigger type pushes Ritme below the fold, and Pausa's page is 964 px tall, so the whole page scrolls |
| Consola-Comandament | partly, **the agreed drawing isn't built** | Frame ① (the D93 remote drawing with leader lines and the B chips) doesn't exist; only ②'s list dialog does. Its last row and its footer are cut at 1194 |
| Consola-Comprovacio-Casos | partly | ①, ③, ④ and ⑤ match. ③'s «Falla a la 1a…» foot is clipped. ② has no fixture |
| Consola-Comprovacio-Revisio | partly | ① and ② match; ③ couldn't be checked; ④ is a proposal and isn't built. ⑤'s Celebration form overflows and the whole page scrolls, header included. Live: the review puts a second «Ara sona» in the right column, against D196 (live-37) |
| Consola-Comprovacio-Ritme | partly | ①, ②, ③, ⑤ and ⑥ match; ④ couldn't be checked; ⑦ is a proposal and isn't built. ⑧ has the same Celebration overflow |
| Consola-Descans | partly | ①–③ match. The bigger type cuts the prize tickets to their first line. Live: «QUINA 2 DE 5» / «6 DE 5» with the real plan |
| Consola-Desgraciat-Final | as drawn (minor) | No «Salvats!» chip in the finaleSaved fixture. The pad's card tag reads «Normal 1–5» where the board has «☆ Desgraciat». Live: the whole finale worked |
| Consola-Efectes-Icones | as drawn | Wii cross badges and the running light: couldn't check |
| Consola-Llancament-Tempesta | partly | ①–③ and ⑤, the check and the end match; ⑥ is a proposal and isn't built. The end with no music has no «Ara sona» panel (D196) |
| Consola-Menu | partly | No «Mantén premut» pills (the app puts it in the notes). Winner names are cut short («Sense …»). **«Xuleta del pla B» can't collapse:** its body's `hidden` is overridden by CSS `display:flex`, so the keys and the checklist always show and column 3 bloats (also in live-05-menu.png). «Sons de la tauleta» is a narrow card where the board has a full-width row |
| Consola-Menu-Sons | partly | Sons automàtics, Prova de so and Cartrons venuts ②–④ match. The Volums layout isn't the board's 3 groups: General sits alone, the heads are in sentence case, and the % sits above the track. «Comença la prova» is filled orange where the board's is cream |
| Consola-Pestanyes-Noves | as drawn | Only Joc's Estat clipping |
| Consola-Portes | partly | ①–③ match; ④ has no fixture. At 1194×834 the page is 1156 px tall, so the header and the right column scroll away. **Live:** the doors' cluster follows this board, not D195 (§1.2.1) |
| Consola-Veus-Redoble | **mostly not built** (the board says so itself, D198) | Missing: the «Veu» chip, «Salta la veu», «Propera veu», the «Fanfara i veu» strip on «Comença la quina», the drum roll on Tatxan!, and the remote's redoble row. Only the Veus switch and volume exist |
| Consola-Alerta-Audio | as drawn | — |

**Phone (390 px), no boards:**
- In a Check, Enrere, Candidat, Seguides and Destapa sit off-screen (y 1143–1538 in a scrolling area). The portrait rule ("the cluster fixed at the bottom", R2-Q21) isn't met there.
- The Descans title wraps one or two letters per line.
- The doors' page is 1432 px tall.

**Totals:** 4 as drawn (Desgraciat-Final with minor differences, Efectes-Icones, Pestanyes-Noves, Alerta-Audio), 11 partly, and 2 not built as agreed (Comandament's drawing, Veus-Redoble).

---

## 3. Biggest problems first

1. **The night's start is wrong end to end (BLOCKS).**
   - The runbook's `?autostart=1` turns the projector's "Start show" click into a `next`: round 1's first song lands with no doors, no intro and no public Shuffle. The same happens after any show-page reload mid-night.
   - The show page needs a physical click on the kiosk projector, which no console can give.
   - The engine accepts every play command at the doors (`before`), so nothing stops it. (§1.1.1–2)
2. **Songs keep landing while the claim pad is open, and Parlem is unreachable from it (BLOCKS, fairness).** I measured 2 landings while typing two numbers. (§1.6.1)
3. **The console counts 5 rounds while the plan has 12 (BLOCKS).**
   - The Desgraciat's and every later Bingo Celebration tell the presenters «Era l'última quina: acabeu la nit des del menú».
   - The Interval says «QUINA 6 DE 5».
   - The menu's «Quines en total» stepper is a dead control. (§1.1.4)
4. **Auto-advance stops at every final Phase with the «Auto» toggle still green (BLOCKS in practice).** Only a small chip says «prem «Següent»». It feels like the show froze, several times per round. (§1.3.1)
5. **The doors don't match D195 and have no main action.**
   - The biggest button is «Llançament», which blasts the throw song.
   - Starting the night is a mini button in the menu.
   - There's no doors music at all (the engine has no doors set). (§1.2.1–3)
6. **Status the presenters can't trust:**
   - Parlem shows striped and «prem per reprendre» at the intro, in the Interval and at the end, where a tap silently does nothing (§1.2.4).
   - «Últim gir: automàtic» shows for their own presses (§1.3.2).
   - «Ara sona» says «No sona cap cançó» while intro or Celebration music plays (§1.2.6, §1.3.5).
   - «Següent» names a song before the Shuffle that won't play (§1.1.5).
   - Every claim shows a late-claim warning (§1.6.2).
   - The claims strip mixes in old claims («4 de 4» for one card) (§1.6.3).
7. **D196 is broken in several places:** the intro has no «Ara sona»; Pausa stacks two; the review puts one in the action column; and the intro's «Barreja» and the Bingo's «Passa al descans» live in the left column while the cluster's big button is a dead «Següent». (§1.2.5–6, §1.3.3, §1.4.2, §1.7.2)
8. **The setup is a pile of terminal commands with hidden flags** (`fresh=1` once, never `--test`, the kiosk flags, the token URL).
   - With no plan file the console falls back to engine defaults.
   - D282's Mac app and its control page aren't built.
   - One missing Python venv crashes the relay and every console with it. (§1.1.3, §1.1.6–7)
9. **The boards aren't fully built:** Comandament's agreed drawing and Veus-Redoble are missing, and the menu's Plan B disclosure can't close.
   - At 1194×834 the doors, Celebration and Pausa pages overflow, so the whole page (header and cluster too) scrolls. On a phone the Check's buttons are off-screen. (§2)
10. **Smaller ones:**
    - generic «ara no es pot fer» refusals;
    - «Llançament» offered after every round;
    - the header keeps the finished round's name and Heat in the Interval and at the end;
    - no Schedule in the menu;
    - D291 (Enrere on the first song) isn't built;
    - the doors' Pace and drift messages start before the night.

**Works and matches the requirements:**
- Next, Back, Parlem, Pausa and its resume, Aguanta, Suspens;
- the D234 two-console lock;
- the paced Check (reveals, Seguides, cue, two cards in a row, wrong type, review with its four choices, discard back to Parlem, a late claim);
- the Desgraciat finale;
- the Interval's «Comença la quina» (D195 is right there);
- the end screen;
- «Cartrons venuts»; the Futur, Cerca, Estat and Premis tabs.
