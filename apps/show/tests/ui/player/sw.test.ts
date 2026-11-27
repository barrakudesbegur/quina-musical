// The player's service worker (D222): which requests it answers (only the player's pages and the hashed build
// files; never the console, Admin, the API, the socket, the audio, last year's /sw.js, a non-GET or another origin),
// what it keeps for offline, and its caches' names (kept by the legacy cleanup).
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { LEGACY } from '../../../../player/config.ts';
import { DEFAULT_CLEANUP } from '../../../../player/logic/cleanup.ts';
import { cacheKeyOf, cacheName, cacheable, isOldCache, isPlayerPage, routeOf, SHELL_KEY, SW_CACHE_PREFIX } from '../../../../player/sw/routing.ts';

const ORIGIN = 'https://quina.barrakudesbegur.org';
const get = (path: string, mode = 'no-cors') => ({ url: `${ORIGIN}${path}`, method: 'GET', mode });
const page = (path: string) => get(path, 'navigate');

test('the player pages are answered, network first: the root, last year’s ?c= links and card links', () => {
  for (const path of ['/', '/index.html', '/?c=123', '/26/', '/26/123', '/26/123/', '/25/88', '/26']) assert.equal(routeOf(page(path), ORIGIN), 'page', path);
});

test('the hashed build files are answered, whoever asks for them', () => {
  assert.equal(routeOf(get('/assets/player-ZmReeAoJ.js'), ORIGIN), 'asset');
  assert.equal(routeOf(get('/assets/player-Bt18Uwce.css', 'cors'), ORIGIN), 'asset');
});

test('never answered: the console, Admin, the API, the socket, the audio, both workers, the rest of the site', () => {
  const never = [
    page('/console/'),
    page('/console'),
    page('/console/?pair=1'),
    page('/admin/'),
    page('/admin'),
    get('/api/plan'),
    get('/api'),
    get('/ws/feed'),
    get('/media/12.mp3'),
    get('/sw.js'),
    get('/player-sw.js'),
    get('/player-sw.js?v=2'),
    get('/cards/cards.json'),
    get('/covers/12.jxl'),
    get('/player.webmanifest'),
    get('/icons/player-192.png'),
    page('/stage/'),
    page('/26/123/x'),
    page('/whatever'),
    // a page path, but not a page load
    get('/'),
    get('/26/123'),
  ];
  for (const request of never) assert.equal(routeOf(request, ORIGIN), null, request.url);
  // a folder named like one isn't one of them
  assert.equal(routeOf(get('/assets/admin-x.js'), ORIGIN), 'asset');
});

test('never answered: anything but a GET, and any other origin', () => {
  for (const method of ['POST', 'PUT', 'DELETE', 'HEAD']) assert.equal(routeOf({ ...page('/'), method }, ORIGIN), null, method);
  assert.equal(routeOf({ ...get('/assets/a.js'), method: 'POST' }, ORIGIN), null);
  assert.equal(routeOf({ url: 'https://fonts.example.com/assets/a.js', method: 'GET', mode: 'cors' }, ORIGIN), null);
  assert.equal(routeOf({ url: 'http://quina.barrakudesbegur.org/', method: 'GET', mode: 'navigate' }, ORIGIN), null);
  assert.equal(routeOf({ url: 'not a url', method: 'GET', mode: 'navigate' }, ORIGIN), null);
});

test('isPlayerPage: only the root and card links', () => {
  assert.ok(isPlayerPage('/'));
  assert.ok(isPlayerPage('/26/1234'));
  assert.ok(!isPlayerPage('/26/12345'));
  assert.ok(!isPlayerPage('/2026/12'));
  assert.ok(!isPlayerPage('/player/'));
});

test('only a plain same-origin 200 is kept for offline: never a redirect (Access), an error or an opaque answer', () => {
  const ok = { ok: true, status: 200, type: 'basic', redirected: false };
  assert.ok(cacheable(ok));
  assert.ok(!cacheable({ ...ok, redirected: true }));
  assert.ok(!cacheable({ ...ok, ok: false, status: 404 }));
  assert.ok(!cacheable({ ...ok, ok: false, status: 0, type: 'opaqueredirect' }));
  assert.ok(!cacheable({ ...ok, status: 206 }));
  assert.ok(!cacheable({ ...ok, type: 'cors' }));
});

test('every page is kept as the one shell; a build file under its own address', () => {
  assert.equal(cacheKeyOf('page', `${ORIGIN}/26/123`), SHELL_KEY);
  assert.equal(cacheKeyOf('asset', `${ORIGIN}/assets/a.js`), `${ORIGIN}/assets/a.js`);
});

test('caches: one per build, older builds’ deleted, nobody else’s touched; the legacy cleanup keeps them and the worker', () => {
  const current = cacheName('abc123');
  assert.equal(current, 'quina-player-abc123');
  assert.ok(isOldCache('quina-player-old', current));
  assert.ok(!isOldCache(current, current));
  assert.ok(!isOldCache('songs-cache', current));
  assert.equal(SW_CACHE_PREFIX, LEGACY.ourCachePrefix);
  assert.ok(DEFAULT_CLEANUP.isOurCache(current));
  assert.ok(DEFAULT_CLEANUP.isOurWorker(`${ORIGIN}/player-sw.js`));
  assert.ok(!DEFAULT_CLEANUP.isOurWorker(`${ORIGIN}/sw.js`));
});
