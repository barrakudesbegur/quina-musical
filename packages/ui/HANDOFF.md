# Frontend handoff

Resume the Frontend's work from this file. Keep it current at every milestone, because sessions get cleared.

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

Everything here is on `main`, with `npm run test:ui` green (447 tests on 2026-11-25).

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

## In progress

### 1. Card type per round: step B done (2026-11-25)

`5579442` (473 UI tests, up from 447). Each round names its printed card type, and the screens read names, colours and prices from `card-types.json`:
- packages/ui:
  - `data/card-types.ts`: `cardTypeLabel`, `knownCardTypes`, `roundsByCardType`;
  - `data/catalog.ts` loads `card-types.json` next to `cards.json`;
  - `plan.ts`: `roundIntroFields`, `prizeBundleOf`.
- Admin: a type picker per round, with the kind-change rule and the unknown-type warning.
- Console and Admin's start: `roundIntro` carries `cardType`.
- Stage: the night preview and the Check badge.
- Player: validity uses `PublicRound.cardType`, and a round that plays a non-default type shows a one-line rule.
- apps/cards: checks the type ids and every card's type before writing.

**Step C is in too** (`b717bc6`, `360523f`, on Sound engine's `bd29f4d`):
- plan version 3, with no card types copy in the plan;
- `knownCardTypes(printed)` takes card-types.json only, else every type is named "Cartró <id>";
- `parseCardRanges` now comes from `@quina/protocol`, so the screens no longer import from the engine.

### 2. The Desgraciat round (approved; the rules are in the decisions doc › Changes and in the GLOSSARY)

The order is: ANIMATIONS.md entries, then canvas boards for the user, then code against Sound engine's protocol.
- **Done (2026-11-25):**
  - the ANIMATIONS.md section "The Desgraciat round" (`4f350ab`, `3690a53`);
  - the canvas boards, version 50, under the title "Quina Desgraciada · proposta per revisar":
    - `Mobil-Desgraciat` and `Mobil-Desgraciat-Teva`;
    - `Mobil-Desgraciat-Cau` (the card falling: 3 frames plus a live loop);
    - `Projector-Desgraciat-Comprovacio`, `-Caigut` and `-Dempeus`;
    - `Consola-Dempeus` (the tab at 143, 23 and 1 standing).

    The generator is `temp/design-canvas/look/gen/desgraciat_boards.py`.
- **The protocol, agreed with Sound engine on 2026-11-25:**
  - `RoundKind 'desgraciat'`, at most one per plan, with an empty `line` bundle; its `bingo` bundle is the last-standing prize. Resume token head `D`.
  - `WinKind 'standing'`, and `climbingTo: 'standing'` all round. A valid claim ends the round like a Bingo.
  - `CheckOutcome 'fallen'`.
  - Private `ShowState.standing { count, cardIds | null }`; `cardIds` is null above 60. There is no not-in-play flag: inside the in-play ranges, the engine can't tell sold cards from unsold ones.
  - `FutureInfo.lastStandingAt` and `standingCurve`. In this round `lineAt`, `bingoAt`, `toLine` and `toBingo` are empty, and `possibleWinners` is `{line: [], bingo: []}`.
  - Claims default to `'standing'` in that round; `'line'` and `'bingo'` are rejected there.
  - The Check goes over the 12 songs in card order. Each ✓ step is a ~0.6 s tick. It stops at the first landed song, which plays its snippet (~2.5 s) and gives `'fallen'`.
  - Auto-advance stops once one card stands.
  - Phones get nothing new on the feed.
- **Landing:** Sound engine's step A (`caa5662`) and my compile keys (`b47a633`) are in. Their step C makes the engine play the round, and my screens follow after it (due Fri 4 Dec).
- **Screens to build:**
  - console: the Dempeus tab;
  - stage: the round's name, the "no ha sonat ✓" steps, `check-fallen`, "DEMPEUS!";
  - phones: `stand-up`, `card-fall`, the fall "bloop";
  - Admin: the round kind, one per night, no Line bundle.

## The next queue, in priority order

The dates come from `docs/timeline.md`: the night is Sun 27 Dec 2026, the playlist arrives Tue 1 Dec, and the code freezes Mon 21 Dec.

1. The Desgraciat screens. Sound engine's step C is live (`2e359dd`): the commands take kind 'desgraciat' and claim kind 'standing'. My compile keys are `b47a633`. Due Fri 4 Dec. Known gaps the keys commit left:
   - the console's default action after a 'standing' Celebration doesn't go to the Interval;
   - the player's `celebrationOf` ignores 'standing';
   - Admin's kind select has no 'desgraciat' option;
   - `roundsByCardType` counts a Desgraciat round as a regular one;
   - `roundIntroFields` leaves out a 'desgraciat' kind until the commands accept it (step C).
2. **The card generator, due Mon 30 Nov.** It's ready except for the user's values (`c20250d`):
   - it draws from a song pool (`--pool <name>`, the same `data/pools/<name>.json` as the prep and the relay);
   - `--check` validates without writing;
   - the amounts and the seed are in `src/config.ts`;
   - the default pool still gives exactly the committed `cards.json`.

   Still needed from the user (the Orchestrator is asking): title, paper colour, card types, prices and amounts. The PDF needs the native `canvas` module: `npm install-scripts approve canvas` in `apps/cards`, once (the user's call: it runs an install script).

   Then the dates: the pool on Tue 1 Dec (86 songs in the draft), cards generated and proofed with the user by Thu 3 Dec, then printed. Don't generate before the playlist is final. The README has the steps.
3. When the user decides: the player drawers layout, the card stack, the theme pass, and the three design choices below.
4. When the user says "address the comments": every canvas comment sent to Claude (see the workflow below).

## Waiting on the user

- **The player drawers layout** (the canvas boards from v40): a home screen, two corner buttons (Premis on the left, Horari on the right) and stacked drawers.
  - **Status:** proposed, not confirmed. The code keeps the current tabs until the user confirms.
  - **Why it matters:** the user wants it to feel like a base that's always running, with native-quality drawer gestures.
- **The Desgraciat boards** (canvas v50, under "Quina Desgraciada · proposta per revisar"), and the three open points at the end of ANIMATIONS.md:
  - a public standing count on the projector (default: no);
  - the sitting nino on a fallen card;
  - "DEMPEUS!" as the Celebration title.
- **The theme pass:** the approved look applied to the basic stage, console and Admin screens. The player already has it (`cd9fa6d`).
- **Three design choices left open by the previous session (2026-11-24):**
  1. The prizes corner icon: board "Component · icona de premis", options A–E (A is in use).
  2. The effect when a landed song is on your card: board "App · quan la cançó és teva", options A–D.
  3. The player drawers layout (above).

  The Efectes pads were decided (icons): see the queue.
- **The card stack on phones** (24 Nov, "I will need to confirm this"): specced as `card-stack` in ANIMATIONS.md, not built.
- **Naming the "Ara" tab** (the user's comment, "I would call this songs"): the Orchestrator raises it with the drawers choice.
- **Canvas comments:** about 100 plain comments were addressed (versions 40–46) but remain open, because they weren't sent to Claude.
- **My entries in `docs/open-questions.md`:** card text size on phones, this year's printed card title and colour, and the checks that need real phones, the projector and the tablet.

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
- **End to end:** Backend's headless smoke test is in `tools/e2e/` and reads the `data-testid` hooks. Keep them stable: one element per hook.

## The design canvas

- **URL:** https://claude.ai/code/artifact/c959a819-18bf-486f-9443-2ecf508c1f3f. It's a multi-file artifact: `project/canvas.json` holds the board positions and the notes, and each board is a `project/<Name>.dc.html` file.
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
- **`cards.json` is public** (the agreed default). Someone determined could work out live which cards are close to winning.
