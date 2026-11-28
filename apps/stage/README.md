# stage/: the projector

The audience screen's scenes, in plain TypeScript and the DOM. It follows the show, never commands it. The brief is `docs/show-ui-and-platform-decisions.md` › Projector, and the motion is `packages/ui/ANIMATIONS.md` › Projector.

- **In the show page:** it mounts over the drum with `mountStage(el, { bus })` (see Integration).
- **Standalone** (`/stage/`): used for development and split mode. It runs on the relay, or on a fixture with `?demo=<fixture>`. Add `?debug` to log every animation moment.

## Layout

The projector is 4:3 and far from the audience, but the stage must also work at 16:10 and 16:9 (D276):
- Every scene is laid out in a **1440×1080 reference box**, scaled to fit the screen and centred: pillarboxed at 16:10 and 16:9. Sizes come from `--stage-text-*`.
- **The drum's band** is the top 640 px of the box (about 60 %), stretched to the full width of the screen. It has no frame.
- **The bleed:** `--box-bleed-x` (and `-y` on a screen taller than 4:3) is the screen past the box on each side, in box px (0 at 4:3, 144 at 16:10, 240 at 16:9), and the root has `data-wide` when it isn't 0. Only the layers that read as the whole screen reach into it (ANIMATIONS.md › Projector, "Every screen shape"): the garland's wings (`STAGE.garland.wingSwags`), the Celebration's flash and paper, the finale's floor, light and paper (its clip reaches the screen's sides), a failed Bingo's scrim and the Pausa. Everything else stays in the box, so 4:3 is unchanged.
- In play:
  - "Quina N" and the Heat garland stay small at the edges;
  - the current song's big title sits under the band;
  - the last 3 songs sit under the title, in one row.

## Structure

| Layer | Files | Rule |
|---|---|---|
| Privacy boundary | `view.ts` | `stageView(state, flow, plan, catalog, notes)` returns only what the projector may draw. The DOM code reads nothing else |
| Pure rules | `model/*.ts` | No DOM, no clock, no randomness unless injected. Tested in `apps/show/tests/ui/stage/` |
| Feed | `source.ts` | Turns the show page's Bus (local emissions only) or a `ShowClient` into one read-only feed. Strips `to` and `drum.targetId` from Spin events |
| Controller | `stage.ts` | `mountStage`. Keeps the snapshot, draws the view, runs one frame loop and fires the moments |
| Renderers | `render/*.ts` | One small class per scene that updates its own nodes. Text goes in only through `textContent` |
| Look | `stage.css` | Everything is scoped under `.stage-root`, and values come from `packages/ui/tokens.css` plus the stage's component tokens at its top |
| Words | `strings.ts` | Catalan, building on `packages/ui/i18n/ca.ts` |
| Tunables | `config.ts` | Geometry, rotation periods, Shuffle split, confetti counts, the player app URL |

### Privacy

The stage holds the full state, but these never reach the view:
- the next song (`next`, `transition.to`, `drum.targetId`);
- the Queue;
- possible winners;
- the Phase;
- claims (`completeSince` and `warnings` included);
- winners' names and notes;
- winning card numbers: not secret, but never shown (the user's review), so no list of winners or `cardIds` comes out. Only the Check names the card being checked, and the Desgraciat's finale its finalists (below);
- the cards' contents: the finale's «Salvats!» is worked out from the printed cards inside `model/finale.ts`, and only its moment comes out.

Songs are named only from landings (the `transition.landed` event, or the snapshot's `landings` and `current`), and only from their landing time. `apps/show/tests/ui/stage/view.test.ts` fills every private field with a secret and checks that none comes out, in every fixture.

### Failure behaviour

- **Relay lost:** the scene stays. After 3 s a small dot turns red (`link-lost`).
- **`cards.json` or covers missing:** titles still show, from the snapshot. A Check grid shows only the revealed songs.
- **An odd Check in a snapshot** (no `revealed`, an older engine): it draws as a Check with nothing revealed, never a crash (the stage runs inside the show page).
- **The last card's fail:** the engine goes straight back to the round (scene `play`, Hold `checkFailed`) as the cue plays, so the stage keeps that Check on screen, with its fail moment, while that Hold lasts (`model/check.ts` › `shownCheck`). A projector reloaded meanwhile shows the round.
- **No plan:** the night's preview, the prize and sponsor blocks hide. "Quina N de M" falls back to `game.roundsTotal`. The Check's type badge still names the type (below).
- **`card-types.json` missing or broken:** card type names, colours and prices fall back to the plan's old copy (`plan.cardTypes`, deprecated) while plans carry one, then to "Cartró <id>" in a neutral colour.
- **QR can't be drawn:** the short link shows in its place.
- **Ninos stickers:** the game-style versions (flat colour, white sticker border) of `brand/ninos/` live in `packages/ui/assets/ninos` (made by `tools/ninos/stickers.ts`) and are drawn by `packages/ui/components/nino-dom.ts`. `STAGE.stickers` names each spot's moment, and the scene picks from that moment's pool (`packages/ui/concepts.ts` › `NINO_FOR`) by a seed that changes each time (the card number, the round), so the same nino doesn't always come back: the sitting nino on the QR before the Game, two different ninos either side of each Interval's countdown, a squashed nino beside a failed Check's ✗, a nino in each corner of a Line's or a Quina's Celebration and three round «QUINA POTRA!» (`STAGE.stickers.celebration`, a pool per kind). A null moment is left out.

### The Desgraciat's finale

When the presenters start the finale (`state.finale`, D161, D166–D168, D180–D187), the play scene becomes a stage (`model/finale.ts`, `render/finale.ts`; board `Projector-Desgraciat-Final`, ANIMATIONS.md › The finale on stage):
- the drum's band shrinks to `STAGE.finale.band` (top 70, height 330 in the box), so the show page's drum, which follows `--stage-band-*`, gets smaller too;
- the last-3 row gives way to a floor with one nino per finalist (their pose and tint from `packages/rules/finale.ts`), their number on a plate, in ascending order; fewer stand bigger (D184);
- the finalists' numbers and fates are public by design (D161: they're on stage); `view.ts` gives only number, fate, look and timing;
- a fall shows from its landing time and leaves at the next Spin; «Salvats!» (D181) plays the ribbon, the light, the phones' two spotlights and the slow paper confetti (`packages/ui/motion/paper-confetti.ts`, D185); one left gets the party nino, gold.

The Celebration of that round reads «QUINA POTRA!» (D186).

## Theming

A theme targets these hooks without touching any logic:
- `data-scene` on each scene's `<section>`, plus `data-scene` on the root for the current scene;
- `data-anim` with the ANIMATIONS.md hook names;
- `data-state` on Check cells (`pending`, `playing`, `landed`, `missed`, `idle`), `data-replay` on the cell whose snippet a step back replays, and covers (`loading`, `loaded`, `missing`, `empty`);
- on the Check's `.check` (`data-testid="check"`): `data-revealed` (how many songs are revealed), `data-cue` (`pass` or `fail`, once the cue has played), `data-reviewing` (under review, «Revisió manual»), `data-discarded` (discarded from its review: it fades out), `data-result` (`pending`, then the verdict), `data-verdict` (`complete`, `incomplete`, `fallen`, `fellLast`, `notValid`) once the result shows, `data-wrong-type` for a card of the wrong type, `data-plaque` (`rows`, `row`, `card`) and `--plaque-at` for where the result (plaque or ✗) sits (`model/check.ts` › `plaqueSpot`); `data-state` (`pending`, `ok`, `wrong`) on the type badge `.check__type`; `data-sticker` on the result when its nino shows;
- the BEM classes;
- `data-drum="shown|hidden"`, `data-link` and `data-paused` on the root.

On each hook, the basic theme plays a short CSS transition: the element is held in `.is-entering` for one frame, then transitions in. The root also dispatches `quina:anim` events with `detail.name`, one of:
- `scene-enter`, `spin`, `landing`, `suspense`, `heat`;
- `shuffle`, `check-enter`, `check-type`, `check-step`, `check-unreveal`, `check-review`, `check-result`, `check-fallen`;
- `celebrate`, `interval-rotate`, `idle`, `credits`, `pause`, `link-lost`;
- `finale-enter`, `finale-fall`, `finale-clear`, `finale-back`, `finale-safe`, `finale-win`.

Each event fires at the show-clock time from its timestamp, never when the message arrives. A late join enters the scene without replaying past moments. `prefers-reduced-motion` switches to the still fallbacks.

## Integration with the show page (for the engine session)

1. **`apps/show/engine/show.html`:** add the stage element as the last child of `<body>`, before the script:

   ```html
   <div id="stage"></div>
   ```

   `stage.css` gives it `position: fixed; inset: 0; z-index: 4; pointer-events: none` (`--stage-z`).
   - It sits above the drum and the page, and below `.hud` (5), `.flash` (6) and `.start-overlay` (10), so "Start show" stays visible.
   - Clicks and keys pass through to the page.

2. **`apps/show/engine/src/main.ts`:** mount it right after the Bus is created and before `boot()`. That way it sees the first `state` from `created.flush()`, since `bus.emit` delivers locally even before `bus.connect()`.

   ```ts
   import { mountStage } from '../../stage/stage.ts';
   const bus = new Bus<ShowEvent>({ role: 'show' });
   const stageEl = document.getElementById('stage');
   if (stageEl) mountStage(stageEl, { bus });
   ```

   - It only calls `bus.on` and reads local emissions. It never emits.
   - `Bus<ShowEvent>` is assignable to `Bus<unknown>`.
   - It imports `stage.css` and `packages/ui/tokens.css` itself. These only add `--color-*`, `--stage-*` and the like to `:root`, with no global element styles.

3. **Put the drum in the band.** The stage paints its background everywhere except the drum's band, which spans the full width.
   - **Where the band is:**
     - `--stage-band-top` and `--stage-band-height` on `:root`, in screen px (kept up to date on resize);
     - `handle.drumSlot.getBoundingClientRect()`;
     - a `quina:layout` event on the stage element (`detail.band`).
   - **Placing the drum:**

     ```css
     .stage { position: fixed; inset-inline: 0; top: var(--stage-band-top); height: var(--stage-band-height); }
     ```

     Size `--card-size` from the band height so the drum is big, edge to edge.
   - **The page's own lines:** `.header` and `#result` would show through the band. Hide them (`visibility: hidden`) while the stage is mounted. The stage shows the round, the Heat and the current song itself.

4. **Events the stage uses:**
   - `state`, with the show flow;
   - `transition.scheduled` (only `spinStartAtMs` and `landAtMs` are read);
   - `suspense.started`;
   - `transition.landed`;
   - `transition.cancelled`;
   - `landing.undone`;
   - `check.reviewing` (when a review began, so the marks stay as they were) and `check.unrevealed` (a step back: the snippet before it replays).

   They are all emitted already. The Check itself (its reveals, the cue, a review) comes with the state.

## Checks

```sh
npx tsc -p tsconfig.ui.json
node --test "tests/ui/**/*.test.ts"
node relay/server.ts --port 5192   # then open /stage/?demo=play (or before, roundStart, shuffle, spin, hold,
                                   # suspense, checkStarted, check, checkAuto, checkValid, checkFailed, checkReview, checkTwo,
                                   # checkCuePass, checkCueFail, checkCelebrateNext, checkWrongType, celebration, celebrationBingo,
                                   # interval, after, pause)
```
