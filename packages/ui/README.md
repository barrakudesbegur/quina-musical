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

## Checks

```sh
npx tsc -p tsconfig.ui.json                                        # types: ui/ and the four apps
npx svelte-check --tsconfig ./tsconfig.ui.json --threshold error   # Svelte components
node --test "tests/ui/**/*.test.ts"                                # pure rules
```

## Demo mode

Any app page accepts `?demo=<fixture>` (for example `/console/?demo=check`) and runs on `packages/ui/client/demo.ts` instead of the relay. It replays the typed fixtures in `packages/ui/fixtures/`, so every scene can be reviewed without the show page or audio.
