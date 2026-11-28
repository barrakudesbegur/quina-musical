# Frontend handoff

Resume the Frontend's work from this file. Keep it current at every milestone, because sessions get cleared.

## What's left (28 Nov, after the realistic test)

**The user, after the realistic test:** "it went HORIBLY WRONG. yes, the songs played and the player app mostly works. but the console logic is very bad, the transitions need a lot of improvement, the setup and startup is confusing, the show page (projected screen) has absolutely nothing to do with the design from the mockups ... i thought that the frontend implemented all of it and aparently he didnt."

**How this was checked.** Four read-only audits on 28 Nov evening, against the code and the running app, not against reports:
- the code: origin/main d3634e28 / 49a962b7 in clean worktrees;
- the projector: `/stage/` on every fixture and a real `/show/` night at 1440×1080 and 1920×1080;
- the console: a real local Game with the 2026 plan, walked as presenters would;
- the phone: 147 snapshots re-shot, plus a real Game on a 390 px phone;
- Admin, the cheat sheet, setup and the DS page.

**Where the detail is:**
- **Full reports, committed:** `packages/ui/audit-28nov/` (projector.md, console.md, phone.md, phone-reqs.md, admin.md, ds-notes.md).
- **Screenshots** (git-ignored, on this laptop): `temp/audit-28nov/`.
- **Not judged:** sound (the runs were headless and silent), the Wii remote, real phones on the venue network, and a real Safari 18.

### 0. The root cause, mine
- **Boards stopped being a check.** Most Projector and Console boards were drawn by Python generators (`temp/design-canvas/look/gen/projector_*.py`, `console_*.py`), not captured from the app. 28 of the 30 phone boards are DOM snapshots of the app, so they always "match".
- **The redraw replaced the agreed boards.** In the 28 Nov "X" redraw I regenerated most Projector boards "as built", with «NOT BUILT YET» tags. That replaced the versions the user had agreed, which now sit in the Archive as `Abans-28nov-Projector-*`, `Abans-28nov-Mobil-*` and so on.
  - The canvas then looked close to the app while the app had never reached the agreed design. I treated "board matches code" as progress.
  - The same redraw quietly dropped agreed phone designs: the countdown rings before the start and in the Descans, «El teu premi d'aquesta nit», and the readable three-level QR stack.
- **Tests can't catch any of this.** The 1042 UI tests never mount a component or open a browser, so they stayed green throughout.
- **First decision for the user:** which projector look is agreed?
  - (a) the pre-redraw boards (`Abans-28nov-Projector-*`; the user's complaint points here);
  - (b) the current boards plus their «NOT BUILT YET» items.

### 1. The projector (apps/stage, `/show/`), board by board (projector.md)
| Board | Status | What differs (short) |
|---|---|---|
| **Projector-Joc** (main play screen) + the drum | **partly** | Three giant flat covers in a 640 px band, a thin reticle, a gradient flapper and a small plain «QUINA N» that **overlaps the covers** at 4:3 and 16:9. Missing: the gold round plate, the ink-stroked title, the gold artist, ink-outlined covers, the thick gold window, the ink pointer, the starfield |
| Projector-Barreja-Gir-Suspens (Shuffle, Spin, Suspense) | partly | The Shuffle covers have no ink outline. The «?» has no ink stroke. During a Spin the artist line overlaps the tiles. With the real repertoire the grid is ~130 small covers, two of them missing art. The Shuffle's item-box sound and whoosh bed aren't played |
| Projector-Presentacio (a round's Intro) | partly | Prize cards run off the bottom with real two-line titles (Especial «Televisor i Casc de moto», Desgraciat). Never shown on the night as runbooked (§2.1) |
| Projector-Abans (before the start) | partly | The Desgraciat pill's sad face still has a circle (D23). No starfield. «7:00 PM» on /show/ vs «7:00 pm» on /stage/. Without a plan, it's only a title and a QR. Skipped on the night by `?autostart=1` |
| Projector-Comprovacio (Check while it plays) | built (current board) | The type badge loses its ✓ from the second Check on (`render/check.ts` `setTypeMark()`, stale `dataset.mark`) |
| Projector-Comprovacio-Correcte | **built, never seen live** | The engine goes straight to the Celebration at the cue for the last (usually only) card (`show.ts` `cue()` → `finishBatch`) |
| Projector-Comprovacio-Fallida | built (current board) | Same badge bug |
| Projector-Comprovacio-Revisio | built (fixtures) | — |
| Projector-Comprovacio-TipusErroni-Abans / -TipusErroni | built | The second has no fixture |
| Projector-Comprovacio-Desgraciat (fallback) | built | — |
| Projector-Linia | built (current board) | — |
| Projector-Quina | partly | The spec's "fireworks sticker" isn't built |
| Projector-Quina-Focs | proposal, not to build | Fireworks C, waiting for a go |
| Projector-Pausa | built (current board) | — |
| Projector-Descans / -Descans-Desgraciat | built (current board) | — |
| Projector-Desgraciat-Joc | partly | The play-screen gaps |
| Projector-Desgraciat-Final | partly | The finale's pop, bloop and ta-da sounds aren't played |
| Projector-Desgraciat-Potra | built | — |
| Projector-Final (end of the night) | partly | A ragged rolling list that starts empty, not the board's static grid of white logo tiles under a big title; a sponsor with no logo is bare text |
| Projector-Sense-Connexio | built (no fixture) | — |

- **"Built" means built as the current redrawn board.** Against the agreed pre-redraw boards, every scene also lacks the starfield ground and consistent ink-stroked Londrina titles.
- **Not wired anywhere:** D285/D287's sponsor sticker collage (the module and gallery are on main; the stage and phones still show the old PrizeCard), and fireworks C.

### 2. The console (apps/console) (console.md)
**Blocks the night:**
1. **The start is wrong end to end.**
   - **autostart:** the runbook's `/show/?autostart=1` (Backend: `apps/cloud/laptop/chrome-profiles.ts:37`) makes the show page's «Start show» unlock send `next` (`apps/show/engine/src/main.ts:1237`). Round 1's first song lands with no doors, no Intro and no public Shuffle. A show-page reload mid-night does the same.
   - **The click:** the kiosk show page needs a physical click that no console can send.
   - **No refusal:** the engine accepts every play command at the doors.
2. **Songs keep landing while the claim pad is open, and Parlem can't be reached from it.** Two landings were measured while typing two numbers (App.svelte:129-136). A fairness problem.
3. **The engine counts 5 rounds; the plan has 12** (`apps/show/engine/src/config.ts:194` `roundsTotal: 5`, never taken from the plan).
   - From round 5 on, every Bingo Celebration says «Era l'última quina: acabeu la nit des del menú» (CelebrationPanel.svelte:21).
   - The Interval says «QUINA 6 DE 5».
   - The menu's «Quines en total» stepper does nothing.
4. **Auto-advance stops at every final Phase while «Auto» stays green** (PacePanel.svelte:68). It feels like the show froze, several times per round.

**Wrong or confusing:**
5. **The doors break D195.** The big button is «Llançament» (it blasts the throw song). Starting the night is a mini button in the menu. There's no doors music (the engine has no doors set).
6. **Status the presenters can't trust:**
   - Parlem is striped with «prem per reprendre» at the intro, the Interval and the end, where a tap does nothing.
   - «Últim gir: automàtic» shows for the presenters' own presses.
   - «No sona cap cançó» shows while intro or Celebration music plays.
   - «Següent» names a song before the Shuffle that then never plays.
   - Every claim shows a late-claim warning, and the claims strip mixes in old claims.
7. **D196 is broken in several places:**
   - the intro has no «Ara sona»;
   - Pausa stacks two;
   - the review puts one in the action column;
   - «Barreja» and «Passa al descans» sit in the left column while the cluster shows a dead «Següent».
8. **At 1194×834** the doors, Celebration and Pausa pages overflow, so the header and the cluster scroll away. On a phone the Check's buttons are off-screen.
9. **The menu's «Xuleta del pla B» can't collapse:** `hidden` is overridden by `display:flex`.
10. **Smaller:**
    - generic «ara no es pot fer» refusals;
    - «Llançament» offered after every round;
    - the header keeps the finished round's name and Heat;
    - no Schedule in the menu;
    - D291 (Enrere on the first song) isn't built;
    - Pace and drift messages start before the night.

**Boards:**
- **4 built as drawn:** Desgraciat-Final (minor gaps), Pestanyes-Noves, Efectes-Icones, Alerta-Audio.
- **11 partly built.**
- **Not as agreed:** Consola-Comandament (the D93 remote drawing with leader lines isn't built) and Consola-Veus-Redoble (D198 mostly not built: the «Veu» chip, «Salta la veu», «Propera veu», the «Fanfara i veu» strip, the drum roll on Tatxan!, the remote's redoble row).
- **Consola-Menu-Sons:** the Volums layout isn't the board's three groups.

**What works:**
- Next, Back, Parlem, Pausa and its resume, Aguanta and Suspens;
- the D234 two-console lock;
- the paced Check (reveals, cue, wrong type, review, discard, late claim);
- the Desgraciat finale;
- the Interval's «Comença la quina»;
- the end screen;
- «Cartrons venuts»;
- the Futur, Cerca, Estat and Premis tabs.

### 3. The phone (apps/player) (phone.md, phone-reqs.md)
1. **Offline is never shown in a real Game.** With the browser offline for 25 s: no strip, no veil. The feed has no heartbeat or silence timeout. Mobil-SenseConnexio is built only in the demo.
2. **Wrong round on the cards during Intros and the Descans.** At round 2's intro the cards still show round 1's marks (logic/view.ts:115-128), exactly when players turn their paper cards over.
3. **«Sons» off doesn't survive a reload** (read in the code; not tested live).
4. **The relay feed has no plan for phones** (LocalPlanStore), so laptop-only rehearsals show «0 premis / Per anunciar». Phones have no LAN fallback without internet.
5. **Not built:**
   - card types and prices before the Game (Mobil-Abans ③);
   - the price in the Descans;
   - the QR camera switch;
   - before the Game, the home lacks the rounds and round 1's prizes (they're only in drawers).
6. **Drift from decisions:**
   - the pad's leave question uses «Continuar» / «Descartar» (rejected in D188);
   - Horari says «Primer descans» (D192);
   - a count pill shows before the first landing;
   - the end header reads «QUINA QUINA! 3».
7. **Collapsed cards (D289):** a one-card phone never announces «LÍNIA!»/«QUINA!», because big cards need 2+ playing cards (`collapsed.ts:22-24`). Nobody decided that.
8. **UX:**
   - the last-year card drawer is a dead end (no button);
   - the floating «+ Cartró» covers the Historial/Cartrons switch;
   - the link opens scrolled.
9. **iOS 18:**
   - nothing hides content any more (D293, the lint);
   - but iOS 18 phones get an untested home: no strip-fade, the drum collapse snaps;
   - the your-song layer sits under drawers on 18.0–18.2;
   - wake lock in an installed app may fail before 18.4.
   - Test on a real iOS 18 iPhone on the venue network.
10. **Boards:** several snapped frames show impossible states («La teva línia!» with no complete row; Afegir-Estats ① empty; B-J2 ⑤ «#6»; B-J2 shows two Descans against D192). Fix the fixtures and the snapshotter's taps.

### 4. Admin, the cheat sheet, setup, the DS page (admin.md, ds-notes.md)
1. **Setup is not usable by a non-developer.**
   - A cold start is 4 terminals, 2 Chrome commands of about 300 characters and an English «START SHOW» click on the projector. The click stays even with the autoplay flag.
   - The relay's start-up output gives no next steps.
   - D282 (`npm run night`, the Mac app, a control page) has no code and no board.
2. **The runbook's repertoire doesn't match.** Following it, the preflight FAILs and says to restart with last year's songs: the relay runs `--repertoire 2026`, but `npm run preflight` and `setup:laptop` default to `default`. The README's relay command has no `--repertoire`, so it serves the 77 songs of 2025 (Backend).
3. **Opening Admin can overwrite the saved plan with a blank one** (Admin is mine).
   - When neither the GET nor the socket push arrives within 0.6 s, the autosave sends 1 round, 0 sponsors (`apps/admin/state/plan-session.svelte.ts`). Reproduced.
   - No save history exists.
4. **The cheat sheet** (`/admin/#xuleta`, printed):
   - it drops the claim rules and the special round's rules (a blank band in print);
   - pages hold 4–5 rounds, not 3;
   - there's no presenters' running-order checklist and no "+6 dB" note;
   - Admin's and the console's laptop-key lists contradict each other;
   - the keys can't start a round, Shuffle, check a card or end a round, and only work with the projector window focused. A presenter couldn't run the night from it.
5. **Admin at this plan's size:**
   - Preparació is 58,325 px tall on a laptop (134 dropdowns, 58-sponsor selects repeated) and 84,607 px on a phone, scrolling sideways;
   - three places edit the plan with no merge: the git file, the cloud Admin and the laptop Admin;
   - stubs: cards opened on phones and the Shuffle seeds;
   - the audition link is dead on the cloud.
6. **The DS page** covers every generic component on the boards. It lacks the projector's scenes (the Check grid and verdicts, the drum, the finale), the your-song effect, the console's real SoundIcon pad and an Admin density.

### 5. Reported as done that isn't fully done (my reports, 24–28 Nov)
- **The 28 Nov canvas redraw ("X done")** made the boards match the app instead of the app match the agreed boards (§0). Every "as built" board since then hides a gap.
- **Projector scenes:** I reported boards and stage fixes (the D276 ratios, the stage bugs, U225 thick marks) as done. The main play screen and the drum were never built to the agreed design, and the round label overlaps the covers at both ratios.
- **The phone's offline strip and veil:** built and snapped from the demo, but never shown in a real Game.
- **The console's D195 doors and D196 «Ara sona»** (843bb85b, 80fe9250): reported as built, broken in the live walk (§2).
- **Comandament's remote drawing (D93) and Veus-Redoble (D198):** not built.
- **The menu's Plan B disclosure** doesn't close.
- **Collapsed cards (D289):** built, but one card never announces «LÍNIA!», and the user's "zig zag" reading is unconfirmed.
- **strip-fade (449ccb2e)** shipped blank on iOS 18 (fixed in 20c8423e/e6d95db1). The iOS 18 home is still untested on a real phone.
- **mark-bob, announceWins and the empty state:** built and tested only in headless Chrome and demos, never on real phones or with sound.
- **The sticker collage (D287) and fireworks C:** board and module only, not wired. I said so at the time; listed so nobody counts them.
- **«Green tests» in my reports** meant node and type tests only. No component or browser test exists.

### Cross-team items found (route them)
- **Backend:**
  - the runbook's `?autostart=1`;
  - the preflight / setup / README repertoire defaults;
  - the relay crashes on an unhandled python spawn error when `tools/prep/.venv` is missing and a Blend calls `/api/stretch` (server.ts `stretchRender`);
  - phones on the relay feed have no plan.
- **Sound engine:**
  - `unlock()` sends `next` with autostart;
  - `roundsTotal` isn't taken from the plan;
  - the engine accepts play commands at the doors;
  - no doors music;
  - the Shuffle's and the finale's missing sound cues;
  - «Cartró correcte!» skipped for the last card.

## Now (2026-11-26, late)

## Now (2026-11-27, night): read this block first

- **The running list of everything the user asked** is `temp/design-canvas/ds/comments-27nov.md` (git-ignored, main checkout only): §1 rules R1–R11, §2 delegated decisions, §6 the first phone test, §7 PWA, §8 the second production test (Y1–Y4, X), §9 the Orchestrator's queue, §10 the drum sync, **§11 the screen comments S1–S7 (done), §12 Sound engine's console protocol, §13 the drum sync's open points, §14 what was published and the canvas lessons, §15 the card design session's D251–D253**. Helpers read `temp/design-canvas/ds/helper-brief.md` first (it now covers boards, cascade layers and "docs/ is the Orchestrator's"). D236: every change lands in code **and** the mockups **and** the design system.
- **Agents (D240):** subagents do the work; I plan, brief, review, merge, push and talk to peers. The user lifted the parallel limit (27 Nov). **docs/ is the Orchestrator's:** send them the lines, never edit docs/.
- **Pushed and live tonight (all after `npm run sync-main` + `npm test` on the exact sha):** the phone drum = the projector's (3a0d00bf; solver moved to `packages/rules`, Sound engine agreed), the relay feed's drumSeed (c5e8ced8), drum-back spec (db48f54a/df2bb4e0), the prizes drawer D244 + no Line prize D242 on phones + wake lock only while live (df2bb4e0), the console lock mirror + «Cartrons venuts» on addCardsInPlay + the sound test's «apagat» note (480088da), the projector's Before/Break/Line/End work D242/D243 + its wake lock (480088da), the Wii lock (4e9dfa9d), the DS fixes S1 ✗ / D245 icons / the real zigzag (e4c0a3ca), the engine-enforced lock's console side + `cloud:` ids (7d689982), **cascade layers** (66f09686: `@layer reset, tokens, resources, defaults, components, recipes, app`, `npm run check:css` compares dev vs build on 45 screens, the hold buttons' touch-action fixed in production), D251 «Quina del Desgraciat» (b72b5d7a, 51c0d224), the drum's performance (ee4f86a2: the solve in a Web Worker, solver golden test). Deploys asked for each; Backend confirmed through 66f09686 (837b4f33) and 7d689982 (e3de22c4).
- **Canvas:** v113 (all §14 boards; the collapsed-cards and Celebration-prize proposals on Propostes; archive moves) and v114 (D251 on 30 boards). Threads S1–S7, S2b, 2b853e91 answered + resolved. Open: U157/U158, U169. **Before any publish, diff the published copies against local** (the canvas can hold edits the generators lack: Mobil-B-J2's paragraph, Mobil-Afegir-QR's stacked sheet; 13 boards were name-patched because their generators no longer reproduce them, listed in §14).
- **28 Nov (night):** X done: the canvas redrawn from the code, v117 (DS page rendered from the gallery by `ds/gen/build.mjs` + `snap/`; Mòbil from DOM snapshots of the real player, `look/gen/phone_snap.mjs` + `mobil_boards.py`; Consola and Projector through realigned generators); the pre-redraw boards backed up on Arxiu (v116) and in `look/backup-pre-redraw-28nov/`. App fixes pushed: 855935c0 (redraw-plan §9), 1936dc79 (gallery sections), d266 30f7e61b, jank aa4c4d68. Running: the Celebrations' ninos + plate and small fixes (wt-celeb, high). **Agents: always pass `effort` explicitly (omitted = the session's, xhigh); helpers report every subagent; check the real value with grep on its output file.**
- **28 Nov (evening):** pushed 449ccb2e (the user's phone test: edge to edge with safe-area insets, `strip-fade` = content fades before the stuck strip by a scroll-driven mask, `&mask=under` in demos shows the 27 Nov look for the user to compare, each home view scrolls only its own content). Canvas v122–v123: Projector-Celebracio-Logos (D285: a Celebration shows only its sponsors' logos, projector + phones + «QUINA POTRA!», sticker examples), Projector-Quina-Focs (fireworks C, animated; draft ANIMATIONS `celebrate` ⑧ row in the scratchpad `focs/animations-row.md`), Mobil-Inici-Vores, Mobil-Plegats-A-Estats / -A-Toc / -Estats (collapsed cards: every state; tap affordances T1–T4). **Waiting on the user:** the count rule on collapsed cards (a keep Line-then-Quina / b every song left), T1–T4, a sponsorless prize (nothing / gift sticker), go to build the logos and fireworks C, the strip-fade A/B on a phone. Running list: `temp/design-canvas/ds/comments-27nov.md` §17. App nit queued: the orange «playing» pill on the orange card's band.
- **28 Nov (night): built and live (b57a3eb6).** Collapsed cards A (D289: tiles, the opened card as a modal dialog, «LÍNIA!»/«QUINA!» while the winning song plays, `PublicState.announceWins` + the console's «Anunciar Línia i Quina als mòbils» switch, the scribble hint with Caveat Brush, the peek's countdown pill; board Mobil-Plegats + DS-Cartrons-3); `mark-bob` (marks swing on the beat from `PublicState.beat`); the empty state (D290); the «Proves» console card (test-only, relay `--test`); the sticker module (D287, **not wired**: wiring plan in comments-27nov.md §17); baafcdc7's CheckStrip, round/bare icon pills, one-line card header. **iOS 18 lesson:** Safari 18 has no `animation-timeline`; an unguarded scroll-driven `animation … both` parks at its end value (strip-fade hid Historial in the live test). Guarded in 20c8423e/e6d95db1; a floor lint is being added (wt-baseline). **Waiting on the user:** D289's "zig zag" reading and full cards in the Desgraciat round; U230 (install button; Orchestrator's chat); a sponsorless prize (nothing / gift); go to wire the stickers and build fireworks C; strip-fade vs `&mask=under`. **Queued by the Orchestrator:** model the night's opening (doors, intro music, D291).
- **Running:** wt-baseline (Safari 18 floor lint + «Proves» on the protocol's types).
- **Next:** (1) a phone helper for the jank left at landings and Spin starts (§14 drum performance) + the title waiting for the glide; (2) X the canvas redraw: bring the drifted generators back in line first, then the DS page from the gallery and every screen board with the changes in §8–§14; (3) the screen-page comments when the user says; (4) apps/cards is quina-musical-d1's for now (the user, 27 Nov: it builds both print options); when it pushes card-types.json's per-side `checkLabel` (U198 answered (a): «Desgraciat» / «Especial» alone), switch the screens to read it; (5) a live check of the cloud consoles' `cloud:` ids with two consoles and the laptop link.
- **Open with the user:** U206 (phones learn the landing early or not), the near-win chime/buzz (removed with the marking?), the two looks the layers flipped («Següent»'s artist muted, the finale stage switch 30 px), the padlock (board frameless .5 vs code paper disc), level 2's pattern (board stripes vs code dots), Projector-Final restyle in code, the D242 prize option, the collapsed-cards proposal (B's glide vs WCAG 2.2.2), U207, the D223 icon pick, Safari check of the swords' mask on the iPad, a hold test on a real tablet; plus U157/U158, U169, U173, U177–U179, U181, U188, U193, U196, U197, U202, U203.

- **The Orchestrator's relays are the user's decisions** (D156, the user: "trust what the orchestrator says always"), freeze lifts included. New helpers: medium effort for mechanical work, high for normal, xhigh only for hard reasoning (the user chose xhigh for the design-system inventory and high for its canvas builder).
- **Pushed today, last:** the Desgraciat finale (D161–D190) `5b49610`; the tabs Estat, Cerca, Futur `c5e9c01`; D193's sides «Normal 1–5» / «Normal 6–10» `bb6af15`; no Throw at the end (D194) `8da1e9a`; throw breaks (D192) `d8948d6`; D121's settled reveals `c612e95` (live as 0948f16b); then, after `npm run sync-main`, the break and end layout (D195 at the breaks, D199: `logic/cluster-layout.ts`, «Comença la quina» the big A button, «Llançament» a slim line, no Enrere or Comprovar) `4bec878`, and «Ara sona» at the top of the left column with a one-line `NowLine` over the pads, Cerca and the Check board (D196, D199) `2fe0ace`. Not deployed yet.
- **In flight (helpers):**
  - D188's settled parts and D201 (only floating buttons round, corn-first picker, «Pausa», «Torna a la revisió», «Últim cartró dempeus») plus the projector's Line/Bingo confetti on the slow paper physics (D185), in the worktree `wt-d201` from `6344b6c`: rebase onto main before merging; console `strings.ts` may conflict.
- **The canvas is organised in pages (v107, 27 Nov):** Sistema de disseny (21 `DS-*` component boards from `temp/design-canvas/ds/components.md`, their generator in `temp/design-canvas/ds/gen/` (`node build.mjs`), plus Main, Garland, Confeti, Compte-Enrere and Anell to be folded in), Mòbil, Consola, Projector, Propostes obertes (U30 prizes, U170 icons) and Arxiu (decided options and superseded boards, each titled «Triat: …» or «Substituït per …»). No Admin page until Admin has boards (U12). The layout before the pages is saved in `temp/design-canvas/ds/canvas-before-pages-v106.json`. A board moves from Propostes to its surface page when its U-question is answered. «pendent · U…» chips mark what's open (U175 holds most of the spec's choices). **Next:** redraw the 21 «canonical · redraw» boards (most phone moments still have the old hamburger menu and corners) from the components, once the user has seen the pages.
- **Canvas today:** v99 the throw board (D194–D196) and the icon options for Llançament A–E and Tempesta A–D (U170, open); v100 D193's labels on five boards; v101 D199's «Ara sona» line on seven boards and the end screen, and the D200 board «Vols afegir un altre cartró?» (U174 open).
- **Waiting:** U173 (the doors: «Començar la nit» as the big button, A or not; leave the doors as they are), U174 (when D200's banner shows), U169 (Tempesta vs «+ Candidat» on the last Check), U170 (icons), U175 (the spec's choices), D198 (automatic cues and voice-overs: not to build yet). D200 code waits for U174 and design review.
- **Next to draw (board first):** D198 and D202–D204's console parts: a «Veus» volume slider, a switch for the night's automatic voices, skipping a voice while it plays, «Comença la quina»'s feedback while its fanfare and voice play, and the drum roll (D203) on a D-pad direction (held plays it, shakes intensify and never count as Suspens there, past a threshold letting go lands it; the tablet's plan B: hold the Efectes icon, slide up for the shake). U177 (vibration) and U178 (the other D-pad effects) are open: wait. Sound engine's protocol: `setGame { voicesOn }`, `voiceSkip {}`, `padHold { effect: 'drumroll', on, intensity }` (throttle `intensity` to one send per 250 ms and only when it moved ≥ 0.05), state `voice`, `voiceNext`, `padHold`, `game.voicesOn`, volume key `voices`; type the cue labels against the protocol's `VOICE_CUES` / `VoiceCue`. Board: v104 «Consola · veus automàtiques i redoble» (a tap on «Redoble» still plays «Tatxan!», holding starts the roll; the switch's reach is U181). Sound on the press (U178 item 1): the press starts the roll's first snare flick at once; released before a new 300 ms split (its own constant, tuned at the listening pass, U13; not the 800 ms `escalateHoldMs`) the flick leads into «Tatxan!», held past it the roll carries on. Three release windows (D203): before the split «Tatxan!», from the split to the 2 s threshold a smooth fade, past it the landing; the 800 ms stays for the two-level buttons only. Agree the quick-release tada with Sound engine. Sound engine's next range adds `voice.durationMs` (null until the runtime knows it) and exports `DRUMROLL_LAND_AFTER_SEC`; `roundIntro` switches the scene to `roundStart` at once, so the console keeps the Descans view while `voice.cue` is a round cue, then shows the round's start.
- **The user's rules of 27 Nov:** never act on canvas comments as they arrive; read them all, in creation order, only when the user says (docs/team.md). Load the `modern-web-guidance` skill before any HTML/CSS/JS work or motion spec. Design-system props describe what they produce (D205: a colour, not `tone='talk'`); each concept's look comes from a separate layer (registry or presets). The props rework is being written as `temp/design-canvas/ds/components-v2.md` with `props-research.md`; the DS boards are regenerated only after the user's comments on them are read.
- **UI sounds (D206, D207):** spec in `temp/design-canvas/ds/ui-sounds.md` (Josh Comeau's MIT recordings, trimmed and self-hosted, played by our own Web Audio player in the existing `Sounds` class; phones on by default with Admin's default and the player's choice winning; gain 0.3 tuned at U13; the show laptop always silent). Waiting: U182 (the tablet: silent or a switch), U183 (Admin), U184 (one switch or two), U185 (the refusal thud), U186 (which sounds). Spec only until then.
- **In flight (27 Nov, night): the design system goes into code (D211).** The user read the whole DS page, said it "is correct", and told us to code it now and to work autonomously with agents; they're commenting on the screen pages until 28 Nov (those comments wait for their next "read the comments"). All 94 open threads were read in creation order; the plan, with a decision per thread, is `temp/design-canvas/ds/comments-27nov.md` (it wins over `components-v2.md` where they differ). Helpers, each in its own worktree from `b832405`:
  - **Merged and pushed:** E effects `9a168b6` (garland light patterns per Heat level, party colours for your song, the projector's 34-bulb garland and its win pattern, the comet and beams); I icons `a843dff` (one stroke system: ink = .155em of the text beside it, `packages/ui/icons/` registry, `alone` prop, never a stroke width per context); F foundation `81ba3e0` (palette by colour name + `packages/ui/ds/palette.css` slots, `ds/resources.css` R1–R11, `packages/ui/components/Button.svelte` as the reference, `concepts.ts` + both `actions.ts` + the registry test, the `:focus` lint, haptics `buzz()` on phones, the dev-only gallery at `/ds/`, D219's fallbacks gone). About 30 threads answered + resolved.
  - **Merged and pushed since:** player quick fixes `cca19f4` (no tap highlight, no pull-to-refresh, no text selection, `100lvh` veil, typing sounds), the reload fix `8912640` (sessionStorage boot state ≤ 5 min, empty sky until the first snapshot, no fades at load, offline when it never connected; «només juga…» removed), S status/finale/stickers + K cards and songs `13e7c19` (27 ninos with pools, sponsors redone, QR panel, Toast, Plate, Ring; CardCell looks, PlayerCard counts, MiniCard, SongTile, the Drum cylinder and its 4° tug, concentric covers, the seated card's tilt), P panels `de04d5e` (native `<dialog>` Sheet/Dialog with drag from the content, the stack glitch fixed, the QR camera as a stacked drawer, mask ticket holes, the prize card's layout), B buttons `c7e9058` (LongPress/TwoLevel on one hold gesture, MiniButton, IconButton, CornerButton, TextLink, the SoundPad grid, the pressed look in the resource, the quiet floating «+ Cartró» preset). About 75 threads answered + resolved.
  - **Running:** C controls (`scratchpad/wt-ds-c`: Switch, Segmented, Tabs collapsing to icons, Chip `glow`, WiiKey, NumberPad, IconPicker, TextField, the Cerca search field, Slider ±, the edit drawer «Editar» with number field + QR + green «Desar», number-only unnamed cards, the rest of the press sweep), S leftovers (Notice, Verdict, PriceTag, Confetti, the stage's CountdownRing, the phone's sponsors placed per M31/M32), K leftovers (✗ marks back to #E8363D per U175 item 4, long card names in PlayerCard's header, the stage's CoverArt/SongTile, the console's NowPlaying/NextSong), **H the phone home** (`scratchpad/wt-ds-h`, D218 + D220: corners, floating «+ Cartró», the tab swipe with axis lock and per-tab scroll, the sticky collapsing drum, Historial's scroll-driven rows). Then **W the PWA** (D221–D224, plan §7; Backend's serving is live) and **X** the canvas's DS page redrawn from the gallery.
  - Merge discipline as always: rebase each onto main, review, `cd apps/show && npm test`, ff-merge, `npm run sync-main`, test again, push the tested sha, tell the Orchestrator for deploy.
- **Pushed and deployed 27 Nov:** `5fda630` (modern-web audit batch 2 + D209's reduced-motion rework: moving/looping animations opt-in, fades kept) and `6aff25e` (D212 the player as a 32rem column on tablets and desktops; the UI sounds D206–D208: `packages/ui/sounds/` sprites from button-sounds (MIT), our Web Audio player, the phone's «Sons», the tablet's «Sons de la tauleta» and its sound-check line, the refused-tap thud and shake; `tools/prep/ui_sounds.py` rebuilds the sprites from `picks.json`). To check on a real iPhone: Safari's 'ambient' audio session and `pointerdown` on disabled buttons.
- **Decided 27 Nov:** D219 (U187): latest browsers only, no backwards compatibility (nesting, `@container`, `@starting-style`, `popover`, `linear()` freely; the old fallbacks go). D218 (U180): build the phone's home as drawn, from the DS components (they win over outdated board details): work stream H after B. D217 (U167): the special card stays one-sided, pool 1. D213–D216 (the comment set). D210 (props v2 as recommended), D211 (DS into code now; U175 answered through the comments: items 5 and 14 changed), D212 (player max width). The delegated calls (FloatingButton → `floating`, no `hidden`/`state` props, Chip `glow`, tabs collapse to icons, `xs` size, OR = «/», SoundPad grid, Slider ±, native `<dialog>` sheets, mask ticket holes) are in the plan file and were sent to the Orchestrator.
- **Open with the user:** U169, U170, U173, U174, U177, U178, U179, U181, U188, U157/U158 (the Celebration music picker). U189 is answered in practice (text-wrap always).
- **D188 leave dialog words** wait for U175 (board «Seguir editant» / «Descartar el cartró» vs the log's «Segueix editant» / «Descarta els canvis»).

### Earlier (25–26 Nov)

- **D114, D115 done on the canvas (v63):** both Londrina exceptions kept; picker A chosen; the QR icon softened (rounded finders and dots). Threads #3 and #4 resolved.
- **The double-sided normal card (D102):** side 1 plays Quines 1–4 and the special rounds (pool 1), side 2 Quines 5–10 (pool 2; D171, provisional), the same number and QR on both, plus a new rounds mark on each side. The content spec went to the Orchestrator on 25 Nov: both sides carry the number, QR, logo, edition stamp, 12 songs and the mark; long-edge duplex, 5 mm safe zone, cut lines on the front only, a proof sheet first. Side 2's design and the mark are to be designed **with the user** when they come to it: no boards before then. U50 (the phone, console and projector pointing to the side) is designs only, later. The Orchestrator checked the spec against the model. Corrected: a round names its card type + side, and each card type lists its sides and each side's song set (normal: side 1 → set 1, side 2 → set 2; especial: one side → set 3); cards.json gets `sides` under one id. Sound engine's proposal (songs' `pool`, card-types' `sides: [{side, pool}]`; D178: each set of 70 songs is a pool, never a "Part", cards `{id, type, sides: [{side, lines}]}`, `RoundPlan.side`) got my OK with four changes: each side carries `label` + `mark` (the printed rounds mark, shown on screens as on paper); Admin defaults Quines 5–10 to side 2 (D171) and the checks warn when side 2 is never played; the cards.json conversion lands with the player's reader and the UI tests in one commit; my parts wait for the user's go. Agreed plan: step A (Sound engine: optional `side` in the protocol, card-type sides `{side, pool, label?, mark?}`, the pure `sideWarnings(plan, cardTypes)` that Admin and the preflight both call), step B (Backend's cloud; then ours after the user's go: generator, player, Admin with Quines 5–10 defaulting to side 2, console, stage, cheat sheet), step C (the engine journals `side`). The conversion commit is ours: 2026 and test cards in `sides`, our reader and UI tests, Backend's two readers (preflight CardLike, show.spec.ts; they send the diff), and Sound engine's readers if they're not already in. Test it in a clean worktree and share the hash before pushing. Test pool: every song is in pool "1", and both types map to side 1. cards.json's two-sided format is ours, to agree with Sound engine and Backend (about 50 KB) before any code. The price is unchanged (D69). The special card's back is U49 (default blank). Paper and duplex are U52 (default today's paper, long-edge, one proof sheet). Side 2's title, the mark's look and side 2's design are the user's: report their decisions to the Orchestrator the same day.
- **On hold:** the Premis drawer's content (the prizes model is being checked with the user first; then a content spec, then boards from real 2025 data); the theme pass (U12).
- **On the canvas for the user to agree** (version 53, 25 Nov, published with their OK): the section "Triat (D87, D90)": `Mobil-B-J2` (home with the B corners; Horari, Ajustos and the pad over Ajustos in J2) and `Mobil-D90` (the your-song flash and particles over drawers; a Celebration closing them, but not a typing pad); plus the U30 option boards `Component-Cantonades-Estils` and `Mobil-Calaixos-Jerarquia`. The rejected prizes boards stay local. Generator: `gen/u30_final.py`. Version 54 (25 Nov, the user's comments): the add-card drawer drawn with its agreed content (the board "App · calaix per afegir un cartró": number with the QR button, an optional name, the icon picker, the smart keypad, Desar); the completed line marked on "La teva línia!". Version 55 (the user's console comments): the Wii badges look like the real remote (A a big circle, B a rectangular trigger, HOME round with a house, − + 1 2 each its own round key), no "mantén" on the play buttons (a hold shows as a pressed-in key or strip), Enrere's badge inside the button; script `gen/wii_badges.py`; the remote board's legend no longer runs into its footer. Version 56: a remote hint on every control a remote button triggers whenever it's on screen (the user: "mark always what a button would do"): A on the Check's Rebutjar (a failed card; and no Confirmar for it, D49), the D-pad arm on the four effects (↑ Tatxan!, → Cop d'orquestra, ↓ Trombó trist, ← Among Us), the new A on Dempeus' "Comprovar #57", a shaking remote on Suspens; the menu's rare holds (Pànic, Acabar la nit, Confirmar la línia) keep "Mantén premut" as a tag beside the label (the user's answer). Version 57: the remote board redrawn (each explanation beside its button with a leader line and the button's own key; squarer corners, a softer cross; B pokes out of the main drawing; generator `gen/wii.py`), Version 60: the shake icon is picked: C's motion trail with «×3», no frame, small corners (`gen/shake_icons.py` `shake_icon()`); «×3» as tall as the remote was too big and heavy, so it is now smaller and Nunito 700 (size/weight options 1–4 on `Component-Sacsejar-Opcions`, 2 in use, `PICK`); on the console's Pausa and Suspens strips the label is centred and the remote hint sits at the strip's right edge. **When building the console:** its Wii badges and hold captions follow these boards, not today's code. **When building:** the app's add-card pad lacks the name field, the QR button and the smart keypad of that agreed board; follow the board. Version 61 (the user's 15 comments on B-J2; D95, D96, open U46, U47): Londrina always in capitals on every board (unit symbols like «9 s», «10:14 pm» stay lowercase; Nunito inside Londrina buttons keeps its case); real covers on every drum tile again (pending songs, no order; blurred in the spin); card marks tilted at random again (`home.tilt`) and every corn with the design system's dark bottom shade (`icons.json` too; CardMark.svelte needs it when code reopens); add-card: plain QR code (no frame), placeholder «Nom», one full-width square «Desar» with a tick (no «Desar i afegir-ne un altre»), the icon picker on light buttons in full colour with owner tags; options A/B/C on `Component-Icona-Opcions` (gen/picker_options.py), B-J2 uses A (`drawers.PICK_STYLE`) until the user picks (U47; threads #3 and #4 stay open until the Orchestrator relays the answers); corners style `B2` (the same paper disc, 80%, backdrop blur, no tinted ring); a plain cog on a rounded square; Horari's dark upcoming dots outlined white, the Especial star without outline, the Fi flag without pole; history markers bigger and at the right edge; on gold (your song) the drum's artist line turns ink. `gen/common.py` honours `DC_OUT` to regenerate into a scratch folder and diff before publishing.
- **Next, when allowed:** the cards before 4 Dec (D83; the generator and PDF are ready: see the queue), and the default-pool move with Sound engine on 1 Dec (tests and docs only).

**What this covers:** every screen and its motion, which is the UI/UX and animation role in `docs/team.md`:
- the projector stage (`apps/stage`, plain TypeScript);
- the presenters' console (`apps/console`, Svelte 5);
- the player app (`apps/player`, Svelte 5);
- Admin (`apps/admin`, Svelte 5, at `/admin/`);
- the printed cards and their QR (`apps/cards`);
- the shared foundation (`packages/ui`: tokens, flow, client, i18n, fixtures, `ANIMATIONS.md`) and the pure rules (`packages/rules`: marks, Heat, time, resume).

**Where else to look:**
- Decisions: `GLOSSARY.md`, `docs/show-ui-and-platform-decisions.md` (its "Changes" section overrides the rest) and `docs/adr/`.
- The protocol: `packages/protocol`, owned by Sound engine. Its docs are in `apps/show/docs/protocol.md`.
- The motion spec: [`ANIMATIONS.md`](ANIMATIONS.md). Every animation is specced there before it's coded (the user's rule).
- The look: the design canvas, "Quina Musical look", at https://claude.ai/code/artifact/c959a819-18bf-486f-9443-2ecf508c1f3f (see "The design canvas" below).
- Questions for the user go in `docs/open-questions.md`, with the default taken.
- Sound engine's handoff (`apps/show/docs/HANDOFF.md`) covers the engine, the protocol batch and its queue.

## Done so far

Everything here is on `main`, with `npm run test:ui` green (558 tests on 2026-11-25).

**Before the repo move (old paths, `experiments/mixer-poc/ui/…`):**

| What | Commits |
|---|---|
| The player app | `fc4c249` |
| The console and the projector stage | `2563fb6` |
| Admin, the printable cheat sheet and the year-tagged card QR codes; Admin saving to the cloud | `73b9556`, `69d7fe6` |
| The show-flow protocol and the GamePlan, merged into `@quina/protocol` (`packages/ui/flow.ts` and `plan.ts` are now re-exports) | `ab23722` |

**After the move (2026-11-24):**

| What | Commits |
|---|---|
| No grace rule (every landed song is marked); the near-win cell highlight instead of a banner; Christmas card icons and their picker; Historial shows the current round only; am/pm times | `01a4da7` |
| ANIMATIONS.md: near-win, `reveal`, `tab-switch`, `next-to-now` | `1abceec` |
| Admin: reorder and edit upcoming rounds live, with played rounds fixed | `639a22f` |
| Admin: import sponsors from the organisers' sheet (its private columns are never read) | `f2dfc42` |
| Card icons after the user's second look | `e847221` |
| Screens follow the relay's plan push (`relay.plan`) | `e92e91b` |
| Projector Check after the review; the failed Check screen | `659244c` |
| Images are JPEG XL with a JPEG/PNG fallback, never WebP | `c4bc94c` |
| Admin on the show laptop saves through the relay (plan B, `/api/plan`) | `fab72cb` |
| Console redesign after the user's review | `d99d16b` |
| Console `next-to-now`: the next song flies into Ara sona when it lands | `3f905e1` |
| Admin: logos as PNG plus JXL (lazy WASM encoder); a logo library picker and folder upload | `9b0e9d7`, `99b04fa` |
| Console: Aguanta, Futur and the shared rules from the engine; logos on a plate | `f87784b` |
| Self-hosted fonts (Londrina Solid, Nunito) | `d56cc2a` |
| The player app gets the approved game look | `cd9fa6d` |
| Plan v2 on every screen: prize bundles, the prize reveal, card types | `07ed72f` |
| Stable test hooks (`data-testid`) on every screen; no winning card numbers on the projector | `a5c81f8`, `4881ce2` |
| Ten card icons (heart, grapes, top hat, the Tió join the set); top hat tweak | `22a5104`, `2404037` |
| Card types come from the printed cards (`apps/cards/dist/card-types.json`); Admin shows them read-only | `c424649` |
| Projector to the latest boards: the night's card types before the Game, the compact Check plate, the card-type step (`check-type`), the red ✗ with beams | `cc58d92` |
| Console to the latest boards: two-level buttons (Parlem → Pausa, Aguanta → Suspens), the ring's states, the new menu and tabs | `2133faf` |
| Wii Remote: report parsing, the deliberate shake and the user's mapping; − or + tapped is Parlem, held is Pausa; A follows the console's default action, with badges on the controls; the Comandament dialog; the remote's status shared between consoles (`remote.status`) | `357cba4`, `b9825f1`, `c4632f8`, `35573a0` |
| **2026-11-25:** card type per round on every screen: steps B and C, and the protocol's card ranges | `5579442`, `b717bc6`, `360523f` |
| **2026-11-25:** the Desgraciat round's spec, canvas boards (v50) and the keys that make the screens compile with its protocol | `4f350ab`, `3690a53`, `b47a633` |
| **2026-11-25, the docs audit:** the motion spec; the player app (3 tabs plus the ☰ menu, no winning card numbers, offline keeps the screen, Pausa in the drum's place, the add-card leave guard; "Com es juga" removed, cards written "#123"); the console's Efectes pads with icons; "Quina Especial" and "Comprovar cartró" | `974f95f`, `c1dbb5c`, `66faf9d`, `b47a633` |
| **2026-11-25:** the Wii Remote's status message comes from `@quina/protocol` | `71e618e` |
| **2026-11-25, evening:** the Desgraciat's shared win (`fellLast`) and the winner's numbered slip; no title in the Desgraciat Celebration (U6); planned breaks in Admin's Schedule; the Final Lap switch (R2-Q18); card prices by round (U5: `priceRule` in card-types.json, `comingRoundPrice`, the projector's price tag before the Game and in the Interval); the pool-size report (R1-Q31, `npm run report` in apps/cards; the build no longer deletes `dist/`); real-sized prize bundles in SAMPLE_PLAN and every prize view fitting them (the cheat sheet lists every prize and sponsor); the projector's sponsor strip paging (`sponsor-pages`); the Wii range (`remote.status.drops`) | `5152a81`, `6857f31`, `1f0bfef`, `2e37fc1`, `e75d5b3`, `8cc02af`, `527a02c`, `df7e321`, `3436cf8`, `150f213` |
| **2026-11-25: the Desgraciat round on every screen**. Projector: the name, the intro nino, the standing Check, `check-fallen`, DEMPEUS!, the night preview's sad face. Console: the Dempeus tab (count, chips, the fall, the last card's "Comprovar #57" as the default action), the standing claim pad, "no ha sonat" Check rows, Futur's songs to the last card and its curve, the ring with one card standing. Admin: the Desgraciada kind, one per night, one bundle, Line prizes moved over, never lost. Phones: DEMPEUS/ASSEGUT, the fall and its bloop, "Dempeus fins al final!", the name and sad face. Fixtures: `desgraciatIntro`, `desgraciat`, `desgraciatFew`, `desgraciatLast`, `checkStanding`, `checkFallen`, `checkStandingValid`, `celebrationStanding`, `intervalDesgraciat`; player demos `desgraciatFall` (live), `desgraciatSeated`, `desgraciatMine`, `desgraciatOther` | `f91f80d`, `553b304`, `6b14e76`, `a618730`, `3940353`, `7fc4162` |
| **2026-11-25, night (the user's answers D66–D78):** D70, the Desgraciat plays the special cards by default (Sound engine flipped the protocol's default; phones name the card type a round plays; the UI tests follow the default) | `4bf8d55`, `dafdbcd` |
| The card generator's provisional values (D67–D69: "QUINA QUINA! 3", 399 normal and 300 especial, 1.50 € a regular round and 5 €); the JSON is written before the PDF step, so a missing `canvas` module no longer loses it | `828a6bd` |
| Phones: the your-song look (D74: the flash, the gold, the spotlights, option A's particles; gone at the next Spin; demo `yourSong`); ANIMATIONS.md: its spec, the card stack discarded (D75), the Desgraciat's open points closed (D72) | `65a0ac1` |

## In progress

### The player drawers (D73, D84, D87): built (`71caa9c`), then rebuilt to the agreed boards (`3e8f8dd`, D132; see Now)

- **Home** (`AraHome`): always there. The drum, Historial | Cartrons, the cards; the corner buttons sit over a fade at the bottom.
- **Corner buttons** (`CornerButtons`, `CornerIcon`): style B. Paper discs with a gold or ice ring, and sticker icons (option C's gift with the taller lid; an alarm clock).
- **Drawers** (`Drawer.svelte`, which was `Sheet`; `DrawerFrame`; `logic/drawers.ts`):
  - they're native modal `<dialog>`s that stack;
  - Premis grows out of the bottom-left corner and Horari the bottom-right; the rest slide up;
  - drag the handle or title bar down: past 30 % or on a flick it closes, otherwise it springs back;
  - "‹" and the back gesture close the top one, ✕ closes them all;
  - the one underneath steps back (scale 0.94).
- **Ajustos** (it was "Menú"): grip reorder (`moveCard`; drag or ↑/↓), a settings group, and "Esborrar dades" as a link.
- **Horari:** J2. Tapping a round stacks its prizes.
- **The motion spec:** ANIMATIONS.md `corner-press`, `drawer-*`, `card-reorder`.
- **Review links:** `?open=premis|horari|ajustos|pad`.
- **The U30 boards:** in `temp/design-canvas/look` (generators `gen/u30_*.py`; the real-data prizes board `project/Mobil-Premis-Reals.dc.html` holds real sponsor names, temp/ only). They aren't published to the canvas: that needs the user's OK in this session.

## The next queue, in priority order

The user's dates: the playlist Tue 1 Dec; the pool prepared and checked by Thu 3 Dec; the cards made on Fri 4 – Sat 5 Dec (D83); the night Sun 27 Dec 2026. Any other date in older notes was invented, and was dropped on 25 Nov.

1. **From `docs/event.md`** (approved by the user; the Orchestrator's brief of 2026-11-25), in this order:
   - ~~The Check decides~~ and ~~no prices on the projector~~: done (`ff13a81`). Sound engine adds the `failedCheck` reject reason, plus its console string.
   - ~~Fallbacks are requirements~~: done (`45bc5e1`).
     - The laptop's own console needs no pairing token.
     - → or PageDown (a keyboard or a USB presenter clicker) presses the default action, as the Wii's A.
     - The console holds a screen wake lock where allowed.
     - **Safari and iPad gaps:**
       - the console targets the latest iPadOS only (D219; it uses `:has`, `dvh`, `<dialog>`, container queries);
       - no WebHID on any tablet, so the Wii remote pairs only with the laptop's Chrome;
       - Wake Lock needs a secure context, so over the hotspot's http the tablet must be set to Auto-Lock › Never (in Backend's night runbook);
       - Admin's copy to clipboard falls back on http.
   - **Throw breaks ("parón", about 5 min between some rounds):** Admin's Schedule plans them, and Horari and the console's expected end include them. Agree the shape with Sound engine (the schedule maths in `packages/rules`).
   - **Winners:** an optional numbered-slip field in the console's winner form, once Sound engine adds it to the protocol.
   - **Mention every sponsor:** every sponsor in the plan appears somewhere on the projector during the night (before the start, the intros, the Interval's thanks), and the cheat sheet lists every prize with its sponsor.
   - **The Desgraciat's shared win:** when the last cards standing all fall on the same song, they share it. Sound engine designs the claim; agree the console and Check shape.
   - **Wording:** "el tècnic" is the person and "Admin" only the page. The console opens on the tech's phone.
   - "DEMPEUS!" is NOT approved (the user asked what it means). It's in `docs/open-questions.md`; keep the string until they choose.
2. **The card generator.** The user's provisional values are in (`828a6bd`; D67–D69; they may change at print time):
   - it draws from a song pool (`--pool <name>`, the same `data/pools/<name>.json` as the prep and the relay);
   - `--check` validates without writing;
   - the amounts and the seed are in `src/config.ts`;
   - the default pool still gives exactly the committed `cards.json`.

   Prices aren't printed (docs/event.md); the screens read them from card-types.json. The PDF's native `canvas` module is approved and built in the main checkout (U17); a fresh checkout needs `npm install-scripts approve canvas` in `apps/cards` once (the user's call).

   Then: the playlist on Tue 1 Dec, the pool prepared and checked by Thu 3 Dec, and the user makes the cards on 4–5 Dec (D83): generate and proof the PDFs with them, never before the playlist is final. Cards are sold only on the night (D71). The README has the steps.
3. **Small, when next in the player:** the router should also follow `hashchange`. A `#/26/23` link on an already-open page doesn't add the card today. Real QR codes are path links (`/26/23`) and fully load, so only dev and e2e links are affected (Backend, 2026-11-25).
4. When the user picks (U30): the drawers. The theme pass is on hold (U12).
5. When the user says "address the comments": every canvas comment sent to Claude (see the workflow below).

## Waiting on the user

- **U30, the drawers and the corner buttons:** three boards to pick from (see "In progress"). Answered on 25 Nov: D73 (drawers, no fallback), D74 (the your-song look: built), D75 (no card stack), D72 (the Desgraciat's board points: as built), D77 (card text size: as it is).
- **The theme pass (U12):** on hold, "not ready yet".
- **Naming the "Ara" tab** ("I would call this songs"): moot once the tabs go (D73).
- **Canvas comments:** the your-song thread and the menu's drag-handle thread were sent to Claude and are addressed but still open; reply and resolve when the user says "address the comments". About 100 plain comments were addressed (versions 40–46) but remain open, because they weren't sent to Claude.
- **U34** (the pool size) in `docs/open-questions.md`, and U19 (the checks on real phones, the projector and the tablet). Answered on 25 Nov: D81 (one special card plays both the Desgraciat and the Especial: phones and the projector checked, a test pins it), D83 (the card dates), D84 (no fallback versions in code; the operational plan Bs stay), D85 (a new title each edition; the paper colour may stay).

## Agreements with the other sessions

- **Show flow:** screens read it only through `packages/ui/flow.ts` `flowOf()`.
- **Phones:**
  - their year tag is `edition` ('26'), never `gameId` (which changes per run and rehearsal);
  - they wipe cards only when `edition` changes;
  - they never announce a win, and celebrate only a confirmed winner that is one of their own cards.
- **Public feed** (Backend writes `protocol/public.ts`):
  - a seq'd snapshot plus deltas;
  - Heat as samples that never move at a landing;
  - no `roundEndMs`, only `gameEndMs` rounded to 5 minutes;
  - never the Queue, the next song, the possible winners or the standing list.
- **Private console data from the engine:** `state.future` (Futur), `hold.ducked` (Aguanta), and soon `standing`. These never go on the stage or phones.
- **Engine hooks:** ask Sound engine for hooks rather than editing engine files. The stage mounts in `show.html` through `mountStage(el, { bus })`.
- **The plan's path to screens:** a `relay.plan` push. Admin on the laptop saves through the relay's `/api/plan` (plan B).
- **Images:**
  - covers: `/covers/<id>.jxl` + `.jpg`;
  - logos: `/media/<key>.png|.jpg` + `.jxl`;
  - Admin encodes JXL lazily with @jsquash/jxl. Never WebP.
- **The Desgraciat protocol** (with Sound engine, 2026-11-25): `RoundKind 'desgraciat'` (one per plan, an empty `line` bundle; `bingo` is the last-standing prize; resume head `D`), `WinKind 'standing'`, `CheckOutcome 'fallen'`, private `ShowState.standing { count, cardIds | null }` (null above 60), `FutureInfo.lastStandingAt` and `standingCurve`; its default card type is the special one (D70). Phones get nothing new on the feed.
- **Wii status:** `remote.status` goes between paired consoles only (the relay, `35573a0`), never to the show page, the cloud link or phones. The message type lives in `@quina/protocol` (events.ts); `packages/ui/client/remote-status.ts` re-exports it and keeps `RemoteHosts` (`71e618e`).

## How to run, test and demo

From the repo root, once: `npm install`. Then from `apps/show`:
- **Run:** `PORT=5190 npm run dev` (relay plus Vite). If another session's Vite holds port 24678, use `npm run build && npm start` instead. Pages:
  - `/stage/` (projector);
  - `/console/`;
  - `/admin/`;
  - `/26/123` (player, card 123);
  - `/show/` (the engine with the stage mounted).
- **Demo with no show running:** every page takes `?demo=<fixture>`.
  - The shared fixtures are in `packages/ui/fixtures/states.ts`: `before`, `roundStart`, `shuffle`, `play`, `spin`, `hold`, `possibleWinners`, `check`, `checkValid`, `checkFailed`, `checkWrongType`, `celebration`, `celebrationBingo`, `interval`, `after`, `pause`, `suspense`.
  - The player adds its own demos (`apps/player/feed/demo-feed.ts` `PLAYER_DEMOS`): `beforeCards`, `live`, `lineDone`, `nearBingo`, `cardFull`, `special`, `checkInvalid`, `offline`, `reconnect`, `notice`, and more.
  - `?demo=list` logs the names. The stage's `?debug` logs every animation moment. Demo mode never saves or sends anything (commands are logged to `window.__quinaDemoLog`).
- **Test:** `npm run test:ui` (tsc, svelte-check, `node --test "tests/ui/**/*.test.ts"`). `npm test` runs it with the engine tests; run that before pushing.
- **Test the committed state, not the shared tree,** which holds other sessions' uncommitted work. Use a clean worktree:
  - `git worktree add --detach <dir> HEAD`;
  - in `<dir>/node_modules`, symlink each entry of the main `node_modules` one by one, but point `@quina/*` at the worktree's own packages (`../../packages/…`, `../../apps/…`). A plain symlink of the whole `node_modules` resolves `@quina/protocol` to the main checkout's working copy, uncommitted edits included;
  - symlink `apps/show/node_modules`, then run `npm test` in `<dir>/apps/show`;
  - remove the worktree with `git worktree remove --force <dir> # cleanup-guard: <reason>` (a hook refuses it otherwise).
- **End to end:** Backend's headless smoke test is in `tools/e2e/` and reads the `data-testid` hooks. Keep them stable: one element per hook.

## The design canvas

- **URL:** https://claude.ai/code/artifact/c959a819-18bf-486f-9443-2ecf508c1f3f, the same canvas as the user's link https://claude.ai/artifact/Rs66YhT4XyRe8zQ84YUPSv. It has no pages: sections are title notes. **The user reviews and agrees every design there**, never in local HTML or the running app. It's a multi-file artifact: `project/canvas.json` holds the board positions and the notes, and each board is a `project/<Name>.dc.html` file.
- **Generators:** the boards are generated by Python scripts. A durable copy lives in `temp/design-canvas/look/gen/` (gitignored, never commit it: `logos.json` names sponsors). They write into `temp/design-canvas/look/project/`.
  - `common.py` has the shared pieces and the cover blobs.
  - The card icons are in `temp/design-canvas/icons/icons.json`.
  - `preview/serve.mjs` serves the boards locally (`/_blob/<id>` comes from `preview/blobs`).
- **To publish:**
  1. Read the artifact first (`action: read`). It may be newer than the local copy, so fetch changed files with `read_file`.
  2. Publish with `url` set, `root: temp/design-canvas/look`, `file_path: project/canvas.json`, and a `files` map listing only the boards that changed.
- **Comments:**
  - The canvas is unwatched, with auto-replies off.
  - The user marks comments "Send to Claude" while reviewing, and doesn't want to be interrupted.
  - Only when they say "address the comments": read them all, apply everything, then reply on each thread with what changed and resolve it.
  - Plain (not-sent) comments can't be replied to or resolved.

## Known issues and risks

- **Never seen live:** the `next-to-now` morph and the Wii Remote on real hardware.
- **Real devices:** iPhone and Android, the projector at 4:3 and 16:9, and the tablet over the hotspot need the user (see `docs/open-questions.md`).
- **`cards.json` is public** (D78: anything may be public unless there's a reason; the code stays simple).
