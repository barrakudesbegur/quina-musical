// The printed cards come from a song pool (apps/cards/src/pool.ts): the command line names it, its paths resolve
// against the repo, and its songs are checked before a card is drawn.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { DEFAULT_POOL, parsePool, poolNameFrom, songProblems } from '../../../cards/src/pool.ts';

test('the pool comes from --pool, else the default one', () => {
  assert.equal(poolNameFrom([]), DEFAULT_POOL);
  assert.equal(poolNameFrom(['--pool', 'nadal26']), 'nadal26');
  assert.equal(poolNameFrom(['--check', '--pool=nadal26']), 'nadal26');
  assert.throws(() => poolNameFrom(['--pool']), /needs a pool name/);
  assert.throws(() => poolNameFrom(['--pool', '../etc']), /needs a pool name/);
});

test("a pool's paths are made absolute against the repo; a file that isn't a pool is refused", () => {
  const pool = parsePool('x', { songsJson: 'data/pools/x/songs.json', cardsJson: 'apps/cards/dist/cards.json' }, '/repo');
  assert.deepEqual(pool, { name: 'x', songsJson: '/repo/data/pools/x/songs.json', cardsJson: '/repo/apps/cards/dist/cards.json' });
  assert.throws(() => parsePool('x', { songsJson: 'a.json' }, '/repo'), /needs "songsJson" and "cardsJson"/);
});

test("a pool's songs are checked before any card is drawn", () => {
  const song = (id: number) => ({ id, title: `Song ${id}`, artist: 'A', cover: '', spotifyId: '' });
  assert.deepEqual(songProblems(Array.from({ length: 12 }, (_, i) => song(i + 1)), 12), []);
  assert.deepEqual(songProblems([song(1)], 12), ['a card needs 12 songs; the pool has 1']);
  const bad = songProblems([song(1), song(1), { id: 2, title: ' ', artist: 'A' }, 'x'], 2);
  assert.deepEqual(bad, ['song 2: id 1 is used twice', 'song 3: no title', 'song 4: not an object']);
  assert.deepEqual(songProblems({}, 12), ['the songs file must be a list of songs']);
});

test("the default pool (last year's songs) is fit for cards", () => {
  const pool = JSON.parse(readFileSync(new URL('../../../../data/pools/default.json', import.meta.url), 'utf8'));
  const songs = JSON.parse(readFileSync(new URL(`../../../../${pool.songsJson}`, import.meta.url), 'utf8'));
  assert.deepEqual(songProblems(songs, 12), []);
});

test('the pool-size report (R1-Q31): songs to the first Line, the Quina and the last card standing', async () => {
  const { poolReport, describeReport, seededRandom, roundMinutes, nightMinutes, DEFAULT_TIMING } = await import('../../../cards/src/report.ts');
  // Two cards over 24 songs: card A is songs 1–12, card B 13–24.
  const card = (from: number) => ({ lines: [0, 1, 2].map((l) => [0, 1, 2, 3].map((c) => from + l * 4 + c)) });
  const songs = Array.from({ length: 24 }, (_, i) => i + 1);
  const r = poolReport(songs, [card(1), card(13)], 500, 7);
  assert.equal(r.songs, 24);
  for (const s of [r.firstLine, r.bingo, r.lastStanding]) assert.ok(s.p10 <= s.median && s.median <= s.p90);
  assert.ok(r.firstLine.p10 >= 4, 'a Line needs at least its 4 songs');
  assert.ok(r.bingo.p90 <= 24 && r.bingo.p10 >= 12, 'a full card needs at least 12 songs');
  assert.ok(r.firstLine.median <= r.bingo.median);
  assert.deepEqual(poolReport(songs, [card(1), card(13)], 500, 7), r, 'the same seed, the same report');
  assert.throws(() => poolReport(songs, [card(1)], 10), /at least 2 cards/);
  const text = describeReport(r, { kinds: ['normal', 'desgraciat', 'special'], intervalMinutes: 3, throwMinutes: 5 });
  assert.match(text, /^24 songs, 2 cards sold:\n  first Line after \d+ \(\d+–\d+\) songs/);
  assert.match(text, /the night \(3 rounds, 3-min Intervals, 5 min of Throws\): about \d h \d\d min to \d h \d\d min/);
  // Minutes: the songs at the Pace (22 s in round 1, 14 s after), plus the Checks.
  assert.deepEqual(roundMinutes(48, 'regular', false), [(48 * 14) / 60 + 1 + 1.5, (48 * 14) / 60 + 2 + 3.5], "2025's 48-song rounds: about 13.7 to 16.7 min");
  assert.deepEqual(roundMinutes(30, 'desgraciat', true), [(30 * 22) / 60 + 1.5, (30 * 22) / 60 + 3.5], 'no Line Check in the Desgraciat');
  const [lo, hi] = nightMinutes(r, { kinds: ['normal', 'normal'], intervalMinutes: 3, throwMinutes: 5 });
  const one = roundMinutes(r.bingo.median, 'regular', true), two = roundMinutes(r.bingo.median, 'regular', false);
  assert.deepEqual([lo, hi], [one[0] + two[0] + 3 + 5, one[1] + two[1] + 3 + 5]);
  assert.equal(DEFAULT_TIMING.firstRoundSec, 22);
  const random = seededRandom(1);
  assert.ok(Array.from({ length: 100 }, random).every((x) => x >= 0 && x < 1));
});

test("the report's Pace is the protocol's (a copy, since apps/cards builds on its own)", async () => {
  const { DEFAULT_TIMING } = await import('../../../cards/src/report.ts');
  const { PACE_DEFAULT_SEC } = await import('@quina/protocol');
  assert.deepEqual([DEFAULT_TIMING.firstRoundSec, DEFAULT_TIMING.laterRoundsSec], [PACE_DEFAULT_SEC.firstRound, PACE_DEFAULT_SEC.laterRounds]);
});
