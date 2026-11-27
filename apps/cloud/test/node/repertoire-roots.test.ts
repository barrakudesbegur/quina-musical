// Which folders the media sync takes from a repertoire: the shared Hold and Interval music go under their own roots,
// for every repertoire, and never twice (the default repertoire's data and cache folders are the shared folders' parents).
import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { CACHE, OUT, type Repertoire } from '../../../show/relay/repertoire.ts';
import { repertoireRoots } from '../../laptop/repertoire-roots.ts';
import { isSyncPath } from '../../src/domain/media-sync.ts';

const repertoire = (name: string, dataDir: string, cacheDir: string): Repertoire => ({
  name,
  manifest: `/repertoires/${name}.json`,
  songsJson: '/songs.json',
  audioDir: '/audio',
  coversDir: '/covers',
  cardsJson: null,
  spotifyFeatures: '/spotify_features.json',
  dataDir,
  cacheDir,
  overridesDir: '/overrides',
});

test("the Interval music syncs with every repertoire, under its own roots, like the Hold music", () => {
  for (const p of [repertoire('default', OUT, CACHE), repertoire('2026', path.join(OUT, 'repertoires', '2026'), path.join(CACHE, 'repertoires', '2026'))]) {
    const roots = repertoireRoots(p);
    assert.deepEqual(roots.find((r) => r.root === 'interval-cache')?.dir, path.join(CACHE, 'interval'), p.name);
    assert.deepEqual(roots.find((r) => r.root === 'interval-data')?.dir, path.join(OUT, 'interval'), p.name);
    assert.deepEqual(roots.find((r) => r.root === 'hold-cache')?.dir, path.join(CACHE, 'hold'), p.name);
    assert.deepEqual(roots.find((r) => r.root === 'voice-cache')?.dir, path.join(CACHE, 'voice'), p.name);
    assert.deepEqual(roots.find((r) => r.root === 'voice-data')?.dir, path.join(OUT, 'voice'), p.name);
  }
});

test("the default repertoire's data and cache roots leave the shared music to its own roots (no file synced twice)", () => {
  const roots = repertoireRoots(repertoire('default', OUT, CACHE));
  const cache = roots.find((r) => r.root === 'cache');
  const data = roots.find((r) => r.root === 'data');
  for (const shared of ['interval/some-track.flac', 'hold/loop.flac', 'voice/round-1.flac']) assert.equal(cache?.exclude?.(shared), true, shared);
  for (const shared of ['interval/index.json', 'hold/index.json', 'voice/index.json']) assert.equal(data?.exclude?.(shared), true, shared);
  assert.equal(cache?.exclude?.('1/mix.flac'), false, "a song's own files stay");
  assert.equal(cache?.exclude?.('repertoires/2026/1/mix.flac'), true, "another repertoire's files: its own push");
  assert.equal(data?.exclude?.('repertoires/2026/analysis/index.json'), true);
});

test('never synced: the relay\'s pairing token, the download tools, the listening demo, the Spotify features, the Hold auditions', () => {
  const roots = repertoireRoots(repertoire('default', OUT, CACHE));
  const cache = roots.find((r) => r.root === 'cache');
  const data = roots.find((r) => r.root === 'data');
  assert.equal(cache?.exclude?.('relay-token'), true, 'a secret: each laptop makes its own');
  assert.equal(cache?.exclude?.('tools/bgutil-pot/node_modules/x/index.js'), true, 'download tooling, thousands of files');
  assert.equal(data?.exclude?.('listen-demo/listen-demo.webm'), true);
  assert.equal(data?.exclude?.('spotify_features.json'), true);
  assert.equal(data?.exclude?.('keys/index.json'), false, 'the keys are playback data');
  const hold = roots.find((r) => r.root === 'hold-cache');
  assert.equal(hold?.exclude?.('audition/flying-free-1.flac'), true, "hold.py's audition renders: listening checks");
  assert.equal(hold?.exclude?.('flying-free.flac'), false, 'the Hold tracks themselves (the intro and the throw song too)');
});

test('the cloud accepts the shared roots in sync paths', () => {
  assert.equal(isSyncPath('interval-cache/some-track.flac'), true);
  assert.equal(isSyncPath('interval-data/index.json'), true);
  assert.equal(isSyncPath('voice-cache/round-1.flac'), true);
  assert.equal(isSyncPath('voice-data/index.json'), true);
  assert.equal(isSyncPath('interval/index.json'), false, 'unknown roots stay refused');
});
