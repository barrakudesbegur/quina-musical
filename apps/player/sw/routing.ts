// What the player's service worker (/player-sw.js, D222) does with each request: pure, so the tests
// (apps/show/tests/ui/player/sw.test.ts) check the same code the worker runs. It imports nothing: the worker is
// bundled on its own (apps/show/vite.config.ts), never sharing a chunk with the pages.
//
// The worker answers only the player's own pages and the build's hashed /assets/, always from the network first;
// its cache is only the fallback when the network fails (offline), so a phone never runs an old version
// ("I don't want issues of users having an old version", the user, D222). Everything else passes straight
// through, never answered by the worker: the console and Admin (Cloudflare Access's redirect must never be
// cached), the API, the feed's socket, the audio, last year's kill switch (/sw.js), any request that isn't a GET
// and any other origin.

/** Its caches' names start with this; apps/player/config.ts `LEGACY.ourCachePrefix` keeps them from the cleanup. */
export const SW_CACHE_PREFIX = 'quina-player-';
/** Every player page is the same app (the cloud's SPA fallback serves index.html for /26/123), cached under this. */
export const SHELL_KEY = '/';

/** Paths the worker never answers, as path prefixes (the folder itself with or without its slash). */
export const SW_PASS_THROUGH = ['/console', '/admin', '/api', '/ws', '/media', '/sw.js', '/player-sw.js'] as const;

/** How the worker answers: a player page (navigation), a hashed build file, or not at all (null). */
export type SwRoute = 'page' | 'asset' | null;

export interface RequestLike {
  readonly url: string;
  readonly method: string;
  /** 'navigate' for a page load. */
  readonly mode: string;
}

/** The player's own pages: the root (also last year's /?c=123 links) and this or any edition's card links (/26/123). */
export function isPlayerPage(path: string): boolean {
  return path === '/' || path === '/index.html' || /^\/\d{2}(?:\/\d{0,4})?\/?$/.test(path);
}

const passesThrough = (path: string): boolean =>
  SW_PASS_THROUGH.some((prefix) => path === prefix || path.startsWith(prefix.endsWith('.js') ? `${prefix}?` : `${prefix}/`));

/** How the worker answers this request (`origin`: the worker's own, self.location.origin). */
export function routeOf(request: RequestLike, origin: string): SwRoute {
  if (request.method !== 'GET') return null;
  let url: URL;
  try {
    url = new URL(request.url);
  } catch {
    return null;
  }
  if (url.origin !== origin) return null;
  const path = url.pathname;
  if (passesThrough(path)) return null;
  if (path.startsWith('/assets/')) return 'asset';
  if (request.mode === 'navigate' && isPlayerPage(path)) return 'page';
  return null;
}

export interface ResponseLike {
  readonly ok: boolean;
  readonly status: number;
  /** 'basic' for a same-origin answer. */
  readonly type: string;
  readonly redirected: boolean;
}

/** A network answer worth keeping as the offline fallback: a plain same-origin 200, never a redirect. */
export const cacheable = (response: ResponseLike): boolean => response.status === 200 && response.ok && response.type === 'basic' && !response.redirected;

/** This build's cache. */
export const cacheName = (build: string): string => `${SW_CACHE_PREFIX}${build}`;

/** An older build's cache, to delete when this one takes over (other names are none of the worker's business). */
export const isOldCache = (name: string, current: string): boolean => name.startsWith(SW_CACHE_PREFIX) && name !== current;

/** The cache key a response is kept under: every page under the shell's key, a build file under its own URL. */
export const cacheKeyOf = (route: Exclude<SwRoute, null>, url: string): string => (route === 'page' ? SHELL_KEY : url);
