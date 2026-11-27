// The player's service worker, served as /player-sw.js with scope / (D222; apps/player/README.md "Updates and
// offline"). The build (apps/show/vite.config.ts) bundles this file on its own and fills in __QUINA_BUILD__ (an id
// of this build's files) and __QUINA_PRECACHE__ (the player page's own files), so every deploy that changes the
// app changes this file's bytes, and the browser's update check (the page registers it with updateViaCache
// 'none'; the cloud serves it no-cache) finds the new version at once.
//
// - Installs and takes over at once (skipWaiting, then clients.claim): no version waits for every tab to close.
//   The page reloads itself into the new version at a quiet moment (apps/player/device/updates.ts).
// - Network first, always: the cache only answers when the network fails (offline), or when an old page asks for a
//   build file the new deploy no longer has.
// - Answers only the player's pages and /assets/ (routing.ts); everything else never reaches respondWith.
import { cacheKeyOf, cacheName, cacheable, isOldCache, routeOf, SHELL_KEY, type SwRoute } from './routing.ts';

declare const __QUINA_BUILD__: string;
declare const __QUINA_PRECACHE__: readonly string[];

// The worker's own globals, typed here: the app's tsconfig has the DOM's lib, not the worker's.
interface ExtendableEventLike extends Event {
  waitUntil(promise: Promise<unknown>): void;
}
interface FetchEventLike extends ExtendableEventLike {
  readonly request: Request;
  readonly preloadResponse: Promise<Response | undefined>;
  respondWith(response: Promise<Response>): void;
}
interface WorkerScope {
  readonly location: Location;
  readonly registration: { readonly navigationPreload?: { enable(): Promise<void> } };
  readonly clients: { claim(): Promise<void> };
  skipWaiting(): Promise<void>;
  addEventListener(type: 'install' | 'activate', listener: (event: ExtendableEventLike) => void): void;
  addEventListener(type: 'fetch', listener: (event: FetchEventLike) => void): void;
}
const worker = self as unknown as WorkerScope;

const CACHE = cacheName(__QUINA_BUILD__);

/** The shell and this build's files, each on its own: one that fails never stops the new version installing. */
async function precache(): Promise<void> {
  const cache = await caches.open(CACHE);
  await Promise.allSettled(
    [SHELL_KEY, ...__QUINA_PRECACHE__].map(async (url) => {
      const response = await fetch(url, { cache: 'no-cache' });
      if (cacheable(response)) await cache.put(url, response);
    }),
  );
}

worker.addEventListener('install', (event) => {
  void worker.skipWaiting();
  event.waitUntil(precache());
});

worker.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      for (const name of await caches.keys()) if (isOldCache(name, CACHE)) await caches.delete(name);
      // A page load starts its network request while the worker boots (network first costs no start-up time).
      await worker.registration.navigationPreload?.enable().catch(() => {});
      await worker.clients.claim();
    })(),
  );
});

async function fromCache(route: Exclude<SwRoute, null>, request: Request): Promise<Response | undefined> {
  const key = cacheKeyOf(route, request.url);
  return (await caches.match(key, { cacheName: CACHE })) ?? (await caches.match(key));
}

async function networkFirst(event: FetchEventLike, route: Exclude<SwRoute, null>): Promise<Response> {
  const { request } = event;
  try {
    const response = (route === 'page' ? await event.preloadResponse.catch(() => undefined) : undefined) ?? (await fetch(request));
    if (cacheable(response)) {
      const copy = response.clone();
      event.waitUntil(caches.open(CACHE).then((cache) => cache.put(cacheKeyOf(route, request.url), copy)));
      return response;
    }
    // A build file gone from the server (an old page after a deploy): the copy kept, if there is one.
    if (route === 'asset' && !response.ok) return (await fromCache(route, request)) ?? response;
    return response;
  } catch (error) {
    // Offline: the last copy of the app, so the offline screens still show.
    const cached = await fromCache(route, request);
    if (cached) return cached;
    throw error;
  }
}

worker.addEventListener('fetch', (event) => {
  const route = routeOf(event.request, worker.location.origin);
  if (route) event.respondWith(networkFirst(event, route));
});
