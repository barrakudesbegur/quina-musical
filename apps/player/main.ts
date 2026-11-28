// The player app's entry: pick the feed from the URL, take in the link that opened the app, clear last year's
// leftovers, and mount. The relay and demo feeds load on demand, so production phones never download them.
import '../../packages/ui/tokens.css';
import '../../packages/ui/base.css';
import './player.css';
import './home.css';
import { mount } from 'svelte';
import { loadCatalog } from '../../packages/ui/data/catalog.ts';
import App from './App.svelte';
import { PlayerApp } from './model.svelte.ts';
import { PLAYER_CONFIG } from './config.ts';
import { watchReducedMotion } from './device/screen.ts';
import { Sounds } from './device/sounds.ts';
import { PLAYER_TOUCH } from './device/touch-rules.ts';
import { wireTouchSounds } from '../../packages/ui/sounds/delegate.ts';
import { registerTouchSounds } from '../../packages/ui/sounds/touch.ts';
import { CloudFeed, defaultFeedBase } from './feed/cloud-feed.ts';
import { chooseFeed, type FeedChoice, type PlayerFeed } from './feed/feed.ts';
import { DEFAULT_CLEANUP, browserCleanupEnv, cleanupLegacy } from './logic/cleanup.ts';
import { watchUpdates } from './device/updates.ts';
import { InstallState } from './device/install.svelte.ts';
import { devHints, homePath, parseRoute, settledHref, type DevHints } from './logic/router.ts';
import { MemoryStorage, PlayerStorage, addCard, documentCookies, emptyData, renameCard, type StorageLike } from './logic/storage.ts';
import { loadBootState } from './logic/boot-cache.ts';

const edition = PLAYER_CONFIG.edition;

function localStore(): StorageLike | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null;
  }
}

/** This tab's own store: the last state, for a reload (logic/boot-cache.ts). */
function sessionStore(): StorageLike | null {
  try {
    return typeof sessionStorage === 'undefined' ? null : sessionStorage;
  } catch {
    return null;
  }
}

async function createFeed(choice: FeedChoice): Promise<PlayerFeed> {
  if (choice.kind === 'demo') {
    const { DemoFeed } = await import('./feed/demo-feed.ts');
    return new DemoFeed(choice.demo ?? 'play');
  }
  if (choice.kind === 'relay') {
    const { DevRelayFeed } = await import('./feed/relay-feed.ts');
    return new DevRelayFeed();
  }
  return new CloudFeed({ url: defaultFeedBase(location), visibility: document });
}

/** A demo runs on memory storage holding the demo's cards, so it never touches the player's real ones. */
async function demoStorage(name: string, hints: DevHints): Promise<PlayerStorage> {
  const { DEMO_CARDS, demoFor } = await import('./feed/demo-feed.ts');
  const storage = new PlayerStorage(new MemoryStorage());
  const cards = demoFor(name).cards;
  const ids = hints.cards ?? (cards === 'none' ? [] : cards === 'default' ? DEMO_CARDS.map((c) => c.id) : cards);
  let data = emptyData(edition);
  for (const id of ids) {
    const added = addCard(data, id, Date.now());
    if (!added.ok) continue;
    data = added.data;
    const name = DEMO_CARDS.find((c) => c.id === id)?.name;
    if (name) data = renameCard(data, id, name);
  }
  storage.save(data);
  return storage;
}

/** Run when the page is idle after its first paint (Safari has no requestIdleCallback: a short timeout). */
function whenIdle(run: () => void): void {
  if (typeof requestIdleCallback === 'function') requestIdleCallback(run, { timeout: 4000 });
  else setTimeout(run, 1500);
}

function themeColor(): void {
  const meta = document.querySelector('meta[name="theme-color"]');
  const bg = getComputedStyle(document.documentElement).getPropertyValue('--color-bg').trim();
  if (meta && bg) meta.setAttribute('content', bg);
}

async function main(): Promise<void> {
  const choice = chooseFeed({ search: location.search, hostname: location.hostname, dev: import.meta.env.DEV });
  const hints = devHints(location.search);
  const route = parseRoute(location, { edition });
  // The address settles on this year's home (/26/) as the app opens: a reload never adds a removed card again, and an
  // iPhone adds /26/ to its Home Screen, the path of the cards' cookie (logic/router.ts settledHref).
  const loadPath = location.pathname;
  const settled = settledHref(location, { edition });
  if (settled) history.replaceState(null, '', settled);
  // The cards live in localStorage, with a copy in a cookie for an iPhone's Home Screen app (logic/card-cookie.ts),
  // scoped to the home's path, so it never rides on /api/ or /feed.
  const storage =
    choice.kind === 'demo' ? await demoStorage(choice.demo ?? 'play', hints) : new PlayerStorage(localStore(), PLAYER_CONFIG.storageKey, documentCookies(homePath(location, { edition }), loadPath));
  const feed = await createFeed(choice);
  const sounds = new Sounds();
  registerTouchSounds(sounds);
  wireTouchSounds(document, PLAYER_TOUCH);
  // A reload opens on the state this tab saw a moment ago, not on the before-the-night screen (never in a demo).
  const bootStore = choice.kind === 'demo' ? null : sessionStore();
  const initialState = loadBootState(bootStore, edition, Date.now());
  // Installing the app (D221): Chrome's prompt can come at any time, so this listens before the app mounts. A review
  // link's ?install= stands in for the browser in development and demos.
  const install = new InstallState({ userAgent: navigator.userAgent, maxTouchPoints: navigator.maxTouchPoints, forced: import.meta.env.DEV || choice.kind === 'demo' ? hints.install : null });
  install.watch(window);
  const app = new PlayerApp({ feed, storage, sounds, edition, initialState, bootStore, install, loadCatalog: () => loadCatalog(PLAYER_CONFIG.catalogUrl) });

  app.openRoute(route);
  if (hints.view) app.araSession = hints.view;
  if (hints.open) app.drawers = [{ kind: hints.open }];
  // `strip-fade`'s comparison (ANIMATIONS.md): the 27 Nov look, in development and demos only.
  if ((import.meta.env.DEV || choice.kind === 'demo') && hints.mask) document.documentElement.dataset.homeMask = hints.mask;

  const motion = watchReducedMotion((reduced) => app.setReducedMotion(reduced));
  app.setReducedMotion(motion.reduced);
  const target = document.getElementById('app');
  if (!target) throw new Error('player: #app is missing');
  target.replaceChildren();
  mount(App, { target, props: { app } });
  app.start();
  themeColor();
  // The touch sounds' file, once the first screen is up (it decodes at the first tap).
  whenIdle(() => sounds.prefetch());
  // Last year's service worker, caches and keys: once per edition, never in a demo.
  if (choice.kind !== 'demo') void cleanupLegacy(browserCleanupEnv(), { ...DEFAULT_CLEANUP, edition });
  // The installable app (D222): its worker, and a reload into each new version at a quiet moment. Built pages only,
  // never a demo (device/updates.ts also skips the laptop's /player/ pages).
  if (import.meta.env.PROD && choice.kind !== 'demo') {
    void watchUpdates({ moment: () => ({ drawers: app.drawers.length, padTyping: app.padTyping, bigMoment: app.celebrationOpen || app.yourSong !== null }) });
  }
}

main().catch((error: unknown) => {
  console.error(error);
  const target = document.getElementById('app');
  if (target) target.textContent = 'No s’ha pogut obrir la Quina Musical. Torna-ho a provar.';
});
