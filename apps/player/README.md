# apps/player: the phones' app

The players' app (Svelte 5): the drum, Historial | Cartrons, the cards, the drawers. The cloud serves it at the root of
quina.barrakudesbegur.org (`/`, and `/26/123` for a printed card's QR); development serves it at `/player/`. Its words
are in `strings.ts`, its numbers in `config.ts`, its controls' looks in `actions.ts`, its motion in
`packages/ui/ANIMATIONS.md`.

## The installable app (D221–D223)

- **Manifest:** `public/player.webmanifest`, served at `/player.webmanifest`. No `start_url`, so an app added to an
  iPhone's Home Screen opens the page it was added from; `id` `/`; standalone; the night sky's colours (a test keeps
  them equal to `--color-night`); a `related_applications` `webapp` entry, so a Chrome tab can tell the app is
  installed (`getInstalledRelatedApps()`).
- **Icons:** `icons/app.svg` and `icons/badge.svg` (from `brand/ninos/figures/nino-afro.svg`) are the source;
  `node tools/ninos/app-icons.ts` renders the PNGs into `public/icons/` (committed: building never needs the renderer).
- **Installing** (`logic/install.ts`, `device/install.svelte.ts`): Chrome (Android, desktop) hands the page an install
  prompt; while one is held, Ajustos and the home's `InstallPrompt` offer «Instal·la l'app», which opens Chrome's own
  dialog. iPhones can't install from a page: only Ajustos offers it, as a drawer with the steps. Installed (running as
  the app, or a tab of a phone that has it): Ajustos says «Ja tens l'app».
- **Cards on iPhones:** a Home Screen app starts with empty storage but a copy of the browser's cookies, so the card list
  (numbers, icons, names) is also kept in the `quina_cards` cookie (`logic/card-cookie.ts`), and an empty localStorage
  restores from it. A card's own link (`/26/123`) adds that card from the URL alone, whatever browser opens it (Google
  Lens opens its own, with empty storage).

## Updates and offline (D222)

"I don't want issues of users having an old version" (the user). So:

- **One service worker, `/player-sw.js`** (`sw/player-sw.ts`; never `/sw.js`, which is last year's kill switch), scope
  `/`, registered with `updateViaCache: 'none'` and served `no-cache`, so every check asks the server. The build bundles
  it on its own (`apps/show/vite.config.ts`) with the player page's files and an id of them baked in: any deploy that
  changes the player changes the worker's bytes.
- **Network first, always.** The worker answers only the player's pages (`/`, `/26/123`) and the hashed `/assets/`, and
  only from the network while there is one. Its cache (`quina-player-<build>`) is the fallback for when there isn't:
  offline, the app still opens and shows its offline screen. Everything else never reaches it: `/console/`, `/admin/`
  (Cloudflare Access's redirect must never be cached), `/api/`, `/ws/`, `/media/`, `/sw.js`, non-GET requests and other
  origins (`sw/routing.ts`, tested in `apps/show/tests/ui/player/sw.test.ts`).
- **A new version takes over by itself.** The page asks for a new worker when it opens, when it comes back to the
  foreground or gets the focus (at most every 30 s), and every 5 minutes while on screen (`device/updates.ts`). A new
  worker installs, skips waiting and claims the page. The page then reloads into the new code at the first quiet
  moment (`logic/update-gate.ts`): never with a finger down, a drawer open, a number typed on the pad or a text field in
  use, nor during a Celebration or the your-song moment, and only after 4 s without a touch, key or scroll; in the
  background it reloads at once if nothing would be lost. A reload opens on this tab's last state (`logic/boot-cache.ts`).
- **Where:** only the cloud's player, at the site's root over HTTPS. Development, demos and the laptop's `/player/` pages
  register no worker (a LAN page over plain http can't have one anyway).
- **Last year's leftovers:** `logic/cleanup.ts` removes other workers and caches once per edition, and keeps ours
  (`config.ts` `LEGACY.ourWorker`, `ourCachePrefix`).
