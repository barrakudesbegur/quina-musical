// Last year's leftovers on the phone: last year's app (client/, vite-plugin-pwa) registered /sw.js with a
// runtime cache 'songs-cache' and Workbox's expiration database, and kept two sessionStorage keys. On the first
// open of each edition this removes what isn't ours: service worker registrations, caches, known old keys and
// databases. Every API is feature-detected and every step is isolated, so a missing or failing API never stops
// the app. Pure-ish: the browser APIs are passed in, so tests use fakes.
import { LEGACY, PLAYER_CONFIG } from '../config.ts';
import type { StorageLike } from './storage.ts';

export interface RegistrationLike {
  readonly scope: string;
  readonly active?: { readonly scriptURL: string } | null;
  readonly waiting?: { readonly scriptURL: string } | null;
  readonly installing?: { readonly scriptURL: string } | null;
  unregister(): Promise<boolean>;
}

export interface CleanupEnv {
  serviceWorker?: { getRegistrations(): Promise<readonly RegistrationLike[]> } | null;
  caches?: { keys(): Promise<readonly string[]>; delete(name: string): Promise<boolean> } | null;
  localStorage?: StorageLike | null;
  sessionStorage?: StorageLike | null;
  indexedDB?: { deleteDatabase(name: string): unknown } | null;
}

export interface CleanupOptions {
  edition: string;
  isOurWorker(scriptURL: string): boolean;
  isOurCache(name: string): boolean;
  localKeys: readonly string[];
  sessionKeys: readonly string[];
  databases: readonly string[];
  /** The localStorage key that records the edition already cleaned. */
  markerKey: string;
}

export interface CleanupReport {
  /** Already done for this edition. */
  skipped: boolean;
  unregistered: number;
  cachesDeleted: string[];
  keysRemoved: string[];
  databasesDeleted: string[];
  errors: string[];
}

export const DEFAULT_CLEANUP: Omit<CleanupOptions, 'edition'> = {
  isOurWorker: (url) => LEGACY.ourWorker.test(url),
  isOurCache: (name) => name.startsWith(LEGACY.ourCachePrefix),
  localKeys: LEGACY.localKeys,
  sessionKeys: LEGACY.sessionKeys,
  databases: LEGACY.databases,
  markerKey: PLAYER_CONFIG.cleanupKey,
};

const scriptOf = (r: RegistrationLike): string => r.active?.scriptURL ?? r.waiting?.scriptURL ?? r.installing?.scriptURL ?? '';
const message = (step: string, error: unknown) => `${step}: ${error instanceof Error ? error.message : String(error)}`;

/** Remove last year's leftovers, once per edition. Never throws. */
export async function cleanupLegacy(env: CleanupEnv, options: CleanupOptions): Promise<CleanupReport> {
  const report: CleanupReport = { skipped: false, unregistered: 0, cachesDeleted: [], keysRemoved: [], databasesDeleted: [], errors: [] };
  const local = env.localStorage ?? null;
  try {
    if (local?.getItem(options.markerKey) === options.edition) return { ...report, skipped: true };
  } catch (error) {
    report.errors.push(message('marker', error));
  }

  if (env.serviceWorker && typeof env.serviceWorker.getRegistrations === 'function') {
    try {
      for (const registration of await env.serviceWorker.getRegistrations()) {
        if (options.isOurWorker(scriptOf(registration))) continue;
        if (await registration.unregister()) report.unregistered++;
      }
    } catch (error) {
      report.errors.push(message('serviceWorker', error));
    }
  }

  if (env.caches && typeof env.caches.keys === 'function') {
    try {
      for (const name of await env.caches.keys()) {
        if (options.isOurCache(name)) continue;
        if (await env.caches.delete(name)) report.cachesDeleted.push(name);
      }
    } catch (error) {
      report.errors.push(message('caches', error));
    }
  }

  const removeKeys = (storage: StorageLike | null | undefined, keys: readonly string[], label: string) => {
    if (!storage) return;
    for (const key of keys) {
      try {
        if (storage.getItem(key) === null) continue;
        storage.removeItem(key);
        report.keysRemoved.push(`${label}:${key}`);
      } catch (error) {
        report.errors.push(message(`${label}:${key}`, error));
      }
    }
  };
  removeKeys(local, options.localKeys, 'local');
  removeKeys(env.sessionStorage, options.sessionKeys, 'session');

  if (env.indexedDB && typeof env.indexedDB.deleteDatabase === 'function') {
    for (const name of options.databases) {
      try {
        env.indexedDB.deleteDatabase(name);
        report.databasesDeleted.push(name);
      } catch (error) {
        report.errors.push(message(`indexedDB:${name}`, error));
      }
    }
  }

  try {
    local?.setItem(options.markerKey, options.edition);
  } catch (error) {
    report.errors.push(message('marker', error));
  }
  return report;
}

/** The real browser APIs, each only if present (a LAN page or an old browser lacks some). */
export function browserCleanupEnv(): CleanupEnv {
  const safe = <T>(get: () => T): T | null => {
    try {
      return get() ?? null;
    } catch {
      return null;
    }
  };
  return {
    serviceWorker: safe(() => (typeof navigator !== 'undefined' && 'serviceWorker' in navigator ? navigator.serviceWorker : null)),
    caches: safe(() => (typeof caches !== 'undefined' ? caches : null)),
    localStorage: safe(() => localStorage),
    sessionStorage: safe(() => sessionStorage),
    indexedDB: safe(() => (typeof indexedDB !== 'undefined' ? indexedDB : null)),
  };
}
