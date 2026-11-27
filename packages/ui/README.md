# packages/ui: shared foundation for every screen

Owned by the UI/UX session. The apps that use it:
- `apps/stage/`: projector scenes, plain TypeScript;
- `apps/console/`: the presenters' console, Svelte 5;
- `apps/player/`: the player app, Svelte 5;
- `apps/admin/`: Admin, Svelte 5.

Each app imports only from `packages/ui/`, `packages/rules/`, `@quina/protocol` and `apps/show/engine/src/net/bus.ts`, never from engine internals.

## Layers

| Layer | Where | Rule |
|---|---|---|
| Contract | `@quina/protocol`, plus `packages/ui/flow.ts` and `packages/ui/plan.ts` until the show-flow proposal is merged | Types only, plus pure validators |
| Rules | `packages/rules/` | Pure functions: no DOM, no clock, no randomness unless injected. Tested in `apps/show/tests/ui/` |
| Client | `packages/ui/client/` | `ShowClient` connects a `Bus` and keeps the latest `state`. `show.svelte.ts` makes it reactive for Svelte. The `demo` transport replays fixtures |
| Look | `packages/ui/tokens.css`, `packages/ui/base.css` | Every colour, size, radius and duration is a CSS custom property in `tokens.css`. Nothing else hard-codes them |
| Words | `packages/ui/i18n/ca.ts` (shared terms) and `<app>/strings.ts` | All on-screen text is Catalan and lives in these files, never inline in markup |

## Theming contract

The final game look (see the "Quina Musical look" mockups) must drop in without touching logic. So:
- **Semantic markup with stable hooks.** Components use plain elements and BEM-ish class names (`card-grid__cell`, `is-marked`, `is-needed`), plus `data-scene` and `data-state` attributes. A theme stylesheet targets those.
- **Look values come from tokens only:** `var(--color-…)`, `var(--space-…)`, `var(--radius-…)`, `var(--font-…)` and `var(--dur-…)`. The basic theme is `tokens.css` plus `base.css`; a later `theme-game.css` overrides the same tokens and adds decoration.
- **Named animation hooks.** A component that animates sets a class or `data-anim="landing"`, `"check-step"`, `"celebrate"` and so on, and declares a `--dur-*` token. The basic theme uses simple CSS transitions. A richer theme may replace them with keyframes on the same hook. Scenes also dispatch DOM events (`quina:anim`) that a theme script can listen to.
- **Reduced motion:** every animation respects `prefers-reduced-motion`.

## Cascade layers

**Every stylesheet declares its layer; nothing is unlayered.** Vite loads the stylesheets in one order on the dev
server (as the modules run: tokens, base, the app's own CSS, then each component's as it's imported) and in another in
the build (shared chunks first, `base.css`'s chunk last). Two rules of equal weight used to flip between them: the
number pad's ⌫ got a white face and the name field a gold ring in production only. Cascade layers make the order
explicit, whatever order the files arrive in. The order, weakest first (`packages/ui/layers.ts`):

```css
@layer reset, tokens, resources, defaults, components, recipes, app;
```

| Layer | Files | Why here |
|---|---|---|
| `reset` | `base.css` | Element defaults (`button`, `input`, `:focus-visible`, `h2`): anything more specific in intent must win, even at the same weight |
| `tokens` | `tokens.css`, `fonts.css`, `ds/palette.css` | Values only: custom properties, the font faces, the `data-color` palette slots (zero weight already) |
| `resources` | `ds/resources.css`, `ds/mark.css` | The shared resources (rings, the press, patterns, corners): each component builds on them and tunes them |
| `defaults` | `@layer defaults { … }` blocks in an app's or a component's file | The overridable defaults, where weight decides as it always did: an app's own defaults for what the components also draw (the generic `.icon` size, a `.cover`'s frame, the player's title type and card header, the stage's element reset and `.qr`, the throw stickers), which always lost to the components' own rules and must keep losing; and the zero-weight `:where()` bases those defaults tune (Cover's frame, SongTile's box), which they must keep beating |
| `components` | `components/*.css`, `icons/*.css`, `wii/*.svelte` | The design system's components |
| `recipes` | `recipes/*.css` | Domain compositions of components (the prize card, the ticket) |
| `app` | every `apps/<app>/` stylesheet and Svelte `<style>`, the gallery's too | An app's context (`.next-song__tile`, `.finale-stage__switch`) tunes the components inside it, by layer, not by load order |

Why `defaults`: the components loaded after the apps' stylesheets on both sides, so the CSS was written with an app's
generic rule (`.icon { width: 1.5em }`) losing to a component's (`.button__icon > svg`), by weight or by order. With the
components under `app`, those generic rules would win everywhere; in `defaults` they keep losing. A rule that tunes one
context stays in `app`. When you write an app rule that a component must still beat, it goes in `defaults`.

- `apps/show/vite.config.ts` (`cascadeLayers`) writes the statement as the first thing in every page's `<head>`, so it
  comes before any stylesheet in development and in the build. Nothing else declares the order. A layer name that
  isn't in it becomes the strongest of all, so the lint only takes the listed names; restart the relay after changing
  `layers.ts` (the dev server reads it once).
- A stylesheet wraps everything after its header comment and `@import`s in one block: `@layer components {` on its own
  line, the rules as they were (not reindented), `}` at the end. In an app's file, a run of defaults closes the `app`
  block, opens `@layer defaults {`, and reopens `@layer app {` after it, in place (a component's `:where()` base the
  same way, before its `@layer components {`). An `@import` of a package names its layer
  (`@import '@fontsource/…' layer(tokens);`); a relative one brings a file that wraps itself. A component's `<style>`
  is one `@layer app { … }` block (`components` under `packages/ui/`); Svelte scopes the rules inside as usual.
- An unlayered rule beats every layered one, so a stylesheet left out would win everything: `tests/ui/ds/layers-lint.test.ts`
  fails on any stylesheet or `<style>` outside its folder's layer (`layerFor` in `layers.ts`). A new folder gets its
  layer there first.
- Within a layer, the load order still decides between two rules of equal weight. Don't rely on it: give the rule that
  must win more weight, or move it to a later layer. `!important` runs the other way across layers (an earlier layer's
  wins), so it stays for what must never be overridden (`.visually-hidden`, `[hidden]`).
- **The check:** `npm run check:css` (repo root) builds the screens into a scratch folder, serves the build and the dev
  server, loads every screen in `tools/e2e/css-order/pages.ts` on both (the demo fixtures, the drawers, the menu, Admin's
  views, the gallery at its densities) and compares every element's computed style; it exits 1 on any difference.
  About 7 minutes, too slow for `npm test` (the root one runs the lint and the check's unit tests); `--only <name>` for a
  few screens, `--shots <dir>` for both sides' screenshots, `--save <dir>` and `check.ts diff` to compare before and
  after a change. It needs Chrome. In a
  worktree whose `node_modules` links to another checkout, the dev server refuses the font files and every width
  differs: it says so.

## Checks

```sh
npx tsc -p tsconfig.ui.json                                        # types: ui/ and the four apps
npx svelte-check --tsconfig ./tsconfig.ui.json --threshold error   # Svelte components
node --test "tests/ui/**/*.test.ts"                                # pure rules
```

## Demo mode

Any app page accepts `?demo=<fixture>` (for example `/console/?demo=check`) and runs on `packages/ui/client/demo.ts` instead of the relay. It replays the typed fixtures in `packages/ui/fixtures/`, so every scene can be reviewed without the show page or audio.
