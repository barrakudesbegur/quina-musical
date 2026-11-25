# Frontend handoff

Resume the Frontend's work from this file. Keep it current at every milestone, because sessions get cleared.

## Now (2026-11-25, night)

- **In progress:** the U30 proposals are drawn (three boards, see "In progress"). Publishing them to the design canvas waits on the user's OK: this session's permission check stopped the publish.
- **Next:**
  - when the user picks (U30): build the drawers. One home screen, the two corner buttons and stacked drawers; the tabs go, with no fallback layout in the code (D73);
  - the presenters' checklist on the cheat sheet (from the 2025 running order: welcome points, every prize and sponsor before each round, the throw breaks, the close);
  - the player's before-the-Game card types preview (the Mobil-Abans board). The special card plays the Especial and the Desgraciat (D70), so nothing says it's "only for the Especial";
  - Admin's Games view shows Backend's `flaggedDecisions` (accepted claims whose Check didn't pass; a safety net);
  - "el tècnic" wording;
  - the player router's `hashchange`.
- **Blocked:** publishing to the design canvas (the user's OK).
- **On hold:** the theme pass (U12: "not ready yet").
- **Waiting on the user** (`docs/open-questions.md`):
  - U30 (the corner buttons' style and the Horari icon, the drawers' hierarchy, the prizes drawer);
  - U17 (the PDF install script; until then the committed PDFs keep last year's title);
  - U26 (one special card for both the Especial and the Desgraciat; the default is yes);
  - U28 (when the cards are printed);
  - U29 (how far "no fallbacks" goes).

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

### The player drawers (D73, U30)

The user answered U8 and U10 (25 Nov): one home screen, two corner buttons (Premis on the left, Horari on the right) and stacked drawers. The tabs go, and no fallback layout stays in the code. Their words: the drawers' content got "uglier, the visual hierarchy is broken", they don't like the prizes drawer, and the corner icons are "inconsistent and don't look good" (the best so far is option C, the sky-blue box with the pink ribbon, with a taller lid skirt; Horari needs a better icon).

Proposals first, no code until the user picks. Three boards, under the canvas title "Per triar (U30)", generated by `temp/design-canvas/look/gen/u30_corners.py` and `u30_drawers.py` (the icons are in `u30_icons.py`):
- `Component-Cantonades-Estils`: three styles where both icons always match. A · Joguina 3D (C with the taller lid, a 3D alarm clock at the same angle), B · Adhesiu (flat, white sticker border, paper buttons), C · Línia gruixuda (two-tone line icons, night buttons with a coloured rim). Plus Horari icon alternatives (alarm clock, hourglass, a clock in a Santa hat) and the lid before and after.
- `Mobil-Calaixos-Jerarquia`: J1 Paper, J2 Nit tranquil·la, J3 Primer, el que passa ara, each on Horari and the menu. The menu has the reorder grip the user asked for on the canvas.
- `Mobil-Premis-Propostes`: P1 Aparador (one round at a time, Línia or Quina with the home screen's switch), P2 Llista neta (both bundles, only headline prizes on paper), P3 Tiquets (each bundle a raffle ticket, a whole round on one screen). Each one also shows a round that hasn't started.

They're generated into `temp/design-canvas/look/project/` with `canvas.json` updated, but not published: publishing needs the user's OK.

## The next queue, in priority order

The user's only dates: the playlist arrives Tue 1 Dec and the night is Sun 27 Dec 2026. The other dates in older notes were invented, and were dropped on 25 Nov.

1. **From `docs/event.md`** (approved by the user; the Orchestrator's brief of 2026-11-25), in this order:
   - ~~The Check decides~~ and ~~no prices on the projector~~: done (`ff13a81`). Sound engine adds the `failedCheck` reject reason, plus its console string.
   - ~~Fallbacks are requirements~~: done (`45bc5e1`).
     - The laptop's own console needs no pairing token.
     - → or PageDown (a keyboard or a USB presenter clicker) presses the default action, as the Wii's A.
     - The console holds a screen wake lock where allowed.
     - **Safari and iPad gaps:**
       - the console needs iPadOS 15.4 or later (`:has`, `dvh`, `<dialog>`, `structuredClone`);
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

   Prices aren't printed (docs/event.md); the screens read them from card-types.json. The PDF needs the native `canvas` module: `npm install-scripts approve canvas` in `apps/cards`, once (the user's call, U17: it runs an install script).

   Then: the pool arrives Tue 1 Dec (86 songs in the draft); generate and proof with the user after it, never before the playlist is final. Cards are sold only on the night and print in a few hours (D71); the print date is open (U28). The README has the steps.
3. **Small, when next in the player:** the router should also follow `hashchange`. A `#/26/23` link on an already-open page doesn't add the card today. Real QR codes are path links (`/26/23`) and fully load, so only dev and e2e links are affected (Backend, 2026-11-25).
4. When the user picks (U30): the drawers. The theme pass is on hold (U12).
5. When the user says "address the comments": every canvas comment sent to Claude (see the workflow below).

## Waiting on the user

- **U30, the drawers and the corner buttons:** three boards to pick from (see "In progress"). Answered on 25 Nov: D73 (drawers, no fallback), D74 (the your-song look: built), D75 (no card stack), D72 (the Desgraciat's board points: as built), D77 (card text size: as it is).
- **The theme pass (U12):** on hold, "not ready yet".
- **Naming the "Ara" tab** ("I would call this songs"): moot once the tabs go (D73).
- **Canvas comments:** the your-song thread and the menu's drag-handle thread were sent to Claude and are addressed but still open; reply and resolve when the user says "address the comments". About 100 plain comments were addressed (versions 40–46) but remain open, because they weren't sent to Claude.
- **U17, U26, U28, U29** in `docs/open-questions.md`, and U19 (the checks on real phones, the projector and the tablet).

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
- **`cards.json` is public** (D78: anything may be public unless there's a reason; the code stays simple).
