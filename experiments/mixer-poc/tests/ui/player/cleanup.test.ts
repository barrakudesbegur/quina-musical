// Last year's leftovers: foreign service workers, caches, known keys and databases go, ours stay, it runs once
// per edition, and a missing or failing API never stops it.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_CLEANUP, cleanupLegacy, type CleanupEnv, type RegistrationLike } from '../../../player/logic/cleanup.ts';
import { MemoryStorage } from '../../../player/logic/storage.ts';

function fakeEnv() {
  const unregistered: string[] = [];
  const reg = (scriptURL: string): RegistrationLike => ({
    scope: '/',
    active: { scriptURL },
    unregister: async () => {
      unregistered.push(scriptURL);
      return true;
    },
  });
  const cacheNames = new Set(['songs-cache', 'workbox-precache-v2-https://quina.barrakudesbegur.org/', 'quina-player-covers']);
  const deletedDbs: string[] = [];
  const local = new MemoryStorage();
  const session = new MemoryStorage();
  session.setItem('spa-redirect', '/x');
  session.setItem('adminAuth', 'true');
  session.setItem('keep-me', '1');
  local.setItem('quina.plan.v1', '{}');
  const env: CleanupEnv = {
    serviceWorker: { getRegistrations: async () => [reg('https://quina.barrakudesbegur.org/sw.js'), reg('https://quina.barrakudesbegur.org/player-sw.js')] },
    caches: { keys: async () => [...cacheNames], delete: async (name) => cacheNames.delete(name) },
    localStorage: local,
    sessionStorage: session,
    indexedDB: { deleteDatabase: (name) => void deletedDbs.push(name) },
  };
  return { env, unregistered, cacheNames, deletedDbs, local, session };
}

const options = { ...DEFAULT_CLEANUP, edition: '26' };

test("removes last year's worker, caches, keys and database, and keeps ours and others' keys", async () => {
  const f = fakeEnv();
  const report = await cleanupLegacy(f.env, options);
  assert.deepEqual(f.unregistered, ['https://quina.barrakudesbegur.org/sw.js']);
  assert.deepEqual([...f.cacheNames], ['quina-player-covers']);
  assert.deepEqual(report.cachesDeleted.sort(), ['songs-cache', 'workbox-precache-v2-https://quina.barrakudesbegur.org/'].sort());
  assert.deepEqual(report.keysRemoved, ['session:spa-redirect', 'session:adminAuth']);
  assert.equal(f.session.getItem('keep-me'), '1');
  assert.equal(f.local.getItem('quina.plan.v1'), '{}', 'other apps on the same origin are untouched');
  assert.deepEqual(f.deletedDbs, ['workbox-expiration']);
  assert.deepEqual(report.errors, []);
});

test('runs once per edition, and again for a new one', async () => {
  const f = fakeEnv();
  await cleanupLegacy(f.env, options);
  assert.equal((await cleanupLegacy(f.env, options)).skipped, true);
  assert.equal((await cleanupLegacy(f.env, { ...options, edition: '27' })).skipped, false);
});

test('works with no APIs at all (an old browser, a LAN page)', async () => {
  const report = await cleanupLegacy({}, options);
  assert.equal(report.skipped, false);
  assert.equal(report.unregistered, 0);
  assert.deepEqual(report.errors, []);
});

test('a failing API is reported and the other steps still run', async () => {
  const f = fakeEnv();
  const env: CleanupEnv = {
    ...f.env,
    serviceWorker: {
      getRegistrations: async () => {
        throw new Error('SecurityError');
      },
    },
  };
  const report = await cleanupLegacy(env, options);
  assert.equal(report.errors.length, 1);
  assert.match(report.errors[0], /serviceWorker: SecurityError/);
  assert.ok(report.cachesDeleted.includes('songs-cache'));
  assert.equal(f.local.getItem(options.markerKey), '26');
});
