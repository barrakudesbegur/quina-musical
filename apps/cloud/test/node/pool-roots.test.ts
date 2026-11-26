// Which folders the media sync takes from a pool: the shared Hold and Interval music go under their own roots, for
// every pool, and never twice (the default pool's data and cache folders are the shared folders' parents).
import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { CACHE, OUT, type Pool } from '../../../show/relay/pool.ts';
import { poolRoots } from '../../laptop/pool-roots.ts';
import { isSyncPath } from '../../src/domain/media-sync.ts';

const pool = (name: string, dataDir: string, cacheDir: string): Pool => ({
  name,
  manifest: `/pools/${name}.json`,
  songsJson: '/songs.json',
  audioDir: '/audio',
  coversDir: '/covers',
  cardsJson: null,
  spotifyFeatures: '/spotify_features.json',
  dataDir,
  cacheDir,
  overridesDir: '/overrides',
});

test("the Interval music syncs with every pool, under its own roots, like the Hold music", () => {
  for (const p of [pool('default', OUT, CACHE), pool('2026', path.join(OUT, 'pools', '2026'), path.join(CACHE, 'pools', '2026'))]) {
    const roots = poolRoots(p);
    assert.deepEqual(roots.find((r) => r.root === 'interval-cache')?.dir, path.join(CACHE, 'interval'), p.name);
    assert.deepEqual(roots.find((r) => r.root === 'interval-data')?.dir, path.join(OUT, 'interval'), p.name);
    assert.deepEqual(roots.find((r) => r.root === 'hold-cache')?.dir, path.join(CACHE, 'hold'), p.name);
  }
});

test("the default pool's data and cache roots leave the shared music to its own roots (no file synced twice)", () => {
  const roots = poolRoots(pool('default', OUT, CACHE));
  const cache = roots.find((r) => r.root === 'cache');
  const data = roots.find((r) => r.root === 'data');
  for (const shared of ['interval/some-track.flac', 'hold/loop.flac']) assert.equal(cache?.exclude?.(shared), true, shared);
  for (const shared of ['interval/index.json', 'hold/index.json']) assert.equal(data?.exclude?.(shared), true, shared);
  assert.equal(cache?.exclude?.('1/mix.flac'), false, "a song's own files stay");
});

test('the cloud accepts the shared roots in sync paths', () => {
  assert.equal(isSyncPath('interval-cache/some-track.flac'), true);
  assert.equal(isSyncPath('interval-data/index.json'), true);
  assert.equal(isSyncPath('interval/index.json'), false, 'unknown roots stay refused');
});
