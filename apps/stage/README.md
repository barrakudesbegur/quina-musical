# stage/: the projector

The audience screen's scenes, in plain TypeScript and the DOM. It follows the show, never commands it. The brief is `docs/show-ui-and-platform-decisions.md` › Projector, and the motion is `packages/ui/ANIMATIONS.md` › Projector.

- **In the show page:** it mounts over the drum with `mountStage(el, { bus })` (see Integration).
- **Standalone** (`/stage/`): used for development and split mode. It runs on the relay, or on a fixture with `?demo=<fixture>`. Add `?debug` to log every animation moment.

## Layout

The projector is 4:3 and far from the audience, but the stage must also work at 16:9:
- Every scene is laid out in a **1440×1080 reference box**, scaled to fit the screen and letterboxed. Sizes come from `--stage-text-*`.
- **The drum's band** is the top 640 px of the box (about 60 %), stretched to the full width of the screen. It has no frame.
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
- winners' names and notes.

Songs are named only from landings (the `transition.landed` event, or the snapshot's `landings` and `current`), and only from their landing time. `apps/show/tests/ui/stage/view.test.ts` fills every private field with a secret and checks that none comes out, in every fixture.

### Failure behaviour

- **Relay lost:** the scene stays. After 3 s a small dot turns red (`link-lost`).
- **`cards.json` or covers missing:** titles still show, from the snapshot. A Check grid shows only the played songs.
- **No plan:** the prize and sponsor blocks hide. "Quina N de M" falls back to `game.roundsTotal`.
- **Ninos stickers:** the game-style versions (flat colour, white sticker border) of `brand/ninos/` live in `assets/` and are bundled by Vite (`STAGE.stickers`). Today: `nino-espatxarrat.svg` on a failed Check's plaque. A null sticker is left out and the plaque centres its text.

## Theming

A theme targets these hooks without touching any logic:
- `data-scene` on each scene's `<section>`, plus `data-scene` on the root for the current scene;
- `data-anim` with the ANIMATIONS.md hook names;
- `data-state` on Check cells (`pending`, `playing`, `landed`, `missed`, `idle`) and covers (`loading`, `loaded`, `missing`, `empty`);
- on the Check's `.check`: `data-verdict` (`complete`, `incomplete`, `notValid`) once the result shows, `data-plaque` (`rows`, `row`, `card`) and `--plaque-at` for where the result plaque sits (`model/check.ts` › `plaqueSpot`); `data-sticker` on the plaque when its nino shows;
- the BEM classes;
- `data-drum="shown|hidden"`, `data-link` and `data-paused` on the root.

On each hook, the basic theme plays a short CSS transition: the element is held in `.is-entering` for one frame, then transitions in. The root also dispatches `quina:anim` events with `detail.name`, one of:
- `scene-enter`, `spin`, `landing`, `suspense`, `heat`;
- `shuffle`, `check-enter`, `check-step`, `check-result`;
- `celebrate`, `interval-rotate`, `idle`, `credits`, `pause`, `link-lost`.

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
   - `landing.undone`.

   They are all emitted already.

## Checks

```sh
npx tsc -p tsconfig.ui.json
node --test "tests/ui/**/*.test.ts"
node relay/server.ts --port 5192   # then open /stage/?demo=play (or before, roundStart, shuffle, spin, hold,
                                   # suspense, check, checkValid, celebration, celebrationBingo, interval, after, pause)
```
