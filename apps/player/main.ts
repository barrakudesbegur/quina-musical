// The player app's entry: pick the feed from the URL, take in the link that opened the app, clear last year's
// leftovers, and mount. The relay and demo feeds load on demand, so production phones never download them.
import '../../packages/ui/tokens.css';
import '../../packages/ui/base.css';
import './player.css';
import { mount } from 'svelte';
import { loadCatalog } from '../../packages/ui/data/catalog.ts';
import App from './App.svelte';
import { PlayerApp } from './model.svelte.ts';
import { PLAYER_CONFIG } from './config.ts';
import { keepScreenOn, watchReducedMotion } from './device/screen.ts';
import { Sounds } from './device/sounds.ts';
import { CloudFeed, defaultFeedBase } from './feed/cloud-feed.ts';
import { chooseFeed, type FeedChoice, type PlayerFeed } from './feed/feed.ts';
import { DEFAULT_CLEANUP, browserCleanupEnv, cleanupLegacy } from './logic/cleanup.ts';
import { devHints, homeHref, parseRoute, type DevHints } from './logic/router.ts';
import { MemoryStorage, PlayerStorage, addCard, emptyData, renameCard, type StorageLike } from './logic/storage.ts';

const edition = PLAYER_CONFIG.edition;

function localStore(): StorageLike | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
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
  const ids = hints.cards ?? (demoFor(name).cards === 'none' ? [] : DEMO_CARDS.map((c) => c.id));
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

function themeColor(): void {
  const meta = document.querySelector('meta[name="theme-color"]');
  const bg = getComputedStyle(document.documentElement).getPropertyValue('--color-bg').trim();
  if (meta && bg) meta.setAttribute('content', bg);
}

async function main(): Promise<void> {
  const choice = chooseFeed({ search: location.search, hostname: location.hostname, dev: import.meta.env.DEV });
  const hints = devHints(location.search);
  const route = parseRoute(location, { edition });
  const storage = choice.kind === 'demo' ? await demoStorage(choice.demo ?? 'play', hints) : new PlayerStorage(localStore());
  const feed = await createFeed(choice);
  const sounds = new Sounds();
  const app = new PlayerApp({ feed, storage, sounds, edition, loadCatalog: () => loadCatalog(PLAYER_CONFIG.catalogUrl) });

  app.openRoute(route);
  if (route.kind !== 'home') history.replaceState(null, '', homeHref(location, { edition }));
  if (hints.tab) app.tab = hints.tab;
  if (hints.open) app.dialog = { kind: hints.open };

  const motion = watchReducedMotion((reduced) => app.setReducedMotion(reduced));
  app.setReducedMotion(motion.reduced);
  const target = document.getElementById('app');
  if (!target) throw new Error('player: #app is missing');
  target.replaceChildren();
  mount(App, { target, props: { app } });
  app.start();
  keepScreenOn();
  themeColor();
  // Last year's service worker, caches and keys: once per edition, never in a demo.
  if (choice.kind !== 'demo') void cleanupLegacy(browserCleanupEnv(), { ...DEFAULT_CLEANUP, edition });
}

main().catch((error: unknown) => {
  console.error(error);
  const target = document.getElementById('app');
  if (target) target.textContent = 'No s’ha pogut obrir la Quina Musical. Torna-ho a provar.';
});
