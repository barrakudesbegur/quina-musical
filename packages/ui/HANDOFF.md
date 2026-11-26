# Frontend handoff

Resume the Frontend's work from this file. Keep it current at every milestone, because sessions get cleared.

## Now (2026-11-26, late)

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
