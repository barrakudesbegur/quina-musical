// A song's first play in the Game (D174, D175): a slot of the Pace × 22/14 on its best hook, whatever the round; a repeat
// gets the Pace. The journal's replay keeps the songs counted in earlier rounds (`playedBefore`), and the Schedule counts
// first plays: exactly in the round under way, by the share of the pool still unplayed in later rounds.
import test from 'node:test';
import assert from 'node:assert/strict';
import { dataTest } from './support/data.ts';
import { setup, songs, analyses } from './support/harness.ts';
import { FIRST_PLAY_FACTOR, roundLengthSec, scheduleEstimate, slotSongs } from '../engine/src/plan/pace.ts';
import { FLOW, PACE, SCHEDULE } from '../engine/src/config.ts';
import { PACE_DEFAULT_SEC, extendJournal, firstPlaySec, foldPlayed, replayJournal, type GameRecord, type JournalEntry } from '@quina/protocol';

const journalOf = (log: readonly { type: string }[]) => log.flatMap((e) => (e.type === 'journal' ? [(e as unknown as { entry: JournalEntry }).entry] : []));

test('a first play is the Pace × 22/14, one constant: the default Pace 14 s gives 22 s', () => {
  assert.deepEqual(PACE_DEFAULT_SEC, { firstPlay: 22, repeat: 14 });
  assert.equal(PACE.defaultSec, 14);
  assert.equal(firstPlaySec(14), 22);
  assert.ok(Math.abs(firstPlaySec(11) - 11 * (22 / 14)) < 1e-12, 'a faster Pace scales both');
  assert.equal(FIRST_PLAY_FACTOR, 22 / 14);
  assert.equal(slotSongs(10, 0), 10);
  assert.ok(Math.abs(slotSongs(10, 7) * 14 - (7 * 22 + 3 * 14)) < 1e-9);
  assert.equal(slotSongs(3, 9), slotSongs(3, 3), 'never more first plays than songs');
});

test('foldPlayed: the round in progress joins as the next one starts, each song once, in order; the same round again replaces it', () => {
  const r1 = { number: 1, queue: [5, 3, 9, 1], position: 2 };
  assert.deepEqual(foldPlayed([], r1, 2), [5, 3, 9], 'its counted songs, up to the last counted landing');
  assert.deepEqual(foldPlayed([3, 7], r1, 2), [3, 7, 5, 9]);
  assert.deepEqual(foldPlayed([7], r1, 1), [7], 'round 1 started again: not counted twice');
  assert.deepEqual(foldPlayed([7], null, 1), [7]);
  assert.deepEqual(foldPlayed([], { ...r1, position: -1 }, 2), [], 'nothing landed');
});

dataTest("round 2 knows round 1's songs: repeats at the Pace, first plays longer and on their best hook; the record equals the replay", () => {
  // The same Queue every round (a fixed Queue): round 2 starts with round 1's songs. Mid phase lands best or main hooks.
  const h = setup({ seed: 3, fixedQueue: songs.map((s) => s.id), settings: { phaseOverride: 'mid' } });
  h.send('unlock');
  h.send('next');
  for (let k = 1; k <= 5; k++) h.until(() => h.show.position === k && h.show.status === 'playing', 80);
  const tagOf = (songId: number, hookId: string) => analyses.get(songId)?.hooks.find((x) => x.id === hookId)?.tag;
  for (const l of h.show.history) assert.equal(tagOf(l.songId, l.hookId), 'best', `round 1's song ${l.songId}: a first play on its best hook`);
  const round1 = h.show.queue.slice(0, 6);
  h.send('newRound', { number: 2 });
  assert.deepEqual(h.show.playedBefore, round1);
  h.advance(FLOW.shuffleSec + 0.1);
  h.send('next');
  for (let k = 1; k <= 9; k++) h.until(() => h.show.position === k && h.show.status === 'playing', 80);
  const snap = h.show.snapshot();
  assert.equal(snap.current?.firstPlay, true, 'song 10 is new');
  assert.equal(snap.pace.firstPlaySec, 22);
  assert.ok(Math.abs(snap.pace.slotSec - 22 * h.show.nudge) < 0.01, `the slot is the song playing's (${snap.pace.slotSec} s, nudge ${h.show.nudge})`);
  const repeats = h.show.history.filter((l) => round1.includes(l.songId));
  const firsts = h.show.history.filter((l) => !round1.includes(l.songId));
  assert.equal(repeats.length, 6);
  for (const l of firsts) assert.equal(tagOf(l.songId, l.hookId), 'best', `song ${l.songId}: a first play on its best hook`);
  assert.ok(repeats.some((l) => tagOf(l.songId, l.hookId) === 'main'), 'a repeat may land another approved hook');
  const record = h.show.record();
  assert.deepEqual(record.playedBefore, round1);
  assert.deepEqual(replayJournal(journalOf(h.log)), record);
  // The next round folds round 2's counted songs in after round 1's, each once.
  h.send('newRound', { number: 3 });
  const round2 = h.show.playedBefore;
  assert.deepEqual(round2, [...round1, ...songs.map((s) => s.id).slice(6, 10)]);
  assert.deepEqual(replayJournal(journalOf(h.log)), h.show.record());
});

dataTest("a resumed Game keeps the songs played before; a record kept from before them reads as none", () => {
  const h = setup({ seed: 4, fixedQueue: songs.map((s) => s.id) });
  h.send('unlock');
  h.send('next');
  for (let k = 1; k <= 3; k++) h.until(() => h.show.position === k && h.show.status === 'playing', 80);
  h.send('newRound', { number: 2 });
  const record = h.show.record();
  assert.equal(record.playedBefore?.length, 4);
  const again = setup({ seed: 4, restore: record, fixedQueue: songs.map((s) => s.id) });
  assert.deepEqual(again.show.playedBefore, record.playedBefore);
  assert.equal(again.show.isFirstPlay(songs[0].id), false);
  assert.equal(again.show.isFirstPlay(songs[5].id), true);
  // An older stored record (no `playedBefore`) extends as if it had none.
  const { playedBefore: _gone, ...old } = replayJournal(journalOf(h.log).slice(0, 3));
  const extended = extendJournal(old as GameRecord, journalOf(h.log).slice(3));
  assert.deepEqual(extended, replayJournal(journalOf(h.log)));
});

dataTest("the round's target counts its exact first plays, so a round of new songs starts with no Drift", () => {
  const h = setup({ seed: 5, fixedQueue: songs.map((s) => s.id) });
  h.send('unlock');
  h.send('next');
  for (let k = 1; k <= 6; k++) h.until(() => h.show.position === k && h.show.status === 'playing', 80);
  h.send('newRound', { number: 2 });
  // No cards in play: the typical 46 songs, whose slots before the last count; 7 of them are repeats now.
  const songsExpected = SCHEDULE.bingoAtSong;
  const firstPlays = songsExpected - 1 - 7;
  const target = (h.show.round.targetEndMs - h.show.round.startedAtMs) / 1000;
  assert.ok(Math.abs(target - roundLengthSec({ pace: 14, firstPlays })) < 1e-6, `target ${target.toFixed(1)} s`);
  assert.ok(Math.abs(target - (roundLengthSec({ pace: 14 }) + firstPlays * 8)) < 1e-6, 'each first play adds 8 s');
  assert.ok(Math.abs(h.show.schedule().roundDriftSec) < 1, `Drift ${h.show.schedule().roundDriftSec.toFixed(2)} s at the start`);
  // The pool's songs nobody will have played by this round's end, for the later rounds' first plays.
  assert.deepEqual(h.show.poolsLeft(), { 1: { songs: songs.length, unplayed: songs.length - songsExpected } }, 'the test songs are all pool 1');
});

test("later rounds expect their songs × the pool's share still unplayed as first plays, at the Pace they'll start with", () => {
  const nowMs = 1_000_000;
  const base = { nowMs, round: { number: 1, kind: 'normal' as const, pool: '1' }, game: {}, position: -1, pace: 14, phase: 'early' };
  const later = { kinds: ['normal', 'normal'] as const, intervalSec: 150, throwsSec: 0 };
  const est = scheduleEstimate({ ...base, later: { ...later, kinds: [...later.kinds] }, pools: { 1: { songs: 70, unplayed: 24 } } });
  const n = SCHEDULE.bingoAtSong;
  const f1 = (n * 24) / 70;
  const f2 = (n * (24 - f1)) / 70;
  const expected = 2 * 150 + roundLengthSec({ pace: 14, firstPlays: f1 }) + roundLengthSec({ pace: 14, firstPlays: f2 });
  assert.ok(Math.abs((est.gameEndMs - est.roundEndMs) / 1000 - expected) < 1e-6);
  const none = scheduleEstimate({ ...base, later: { ...later, kinds: [...later.kinds] } });
  assert.ok(est.gameEndMs > none.gameEndMs, 'new songs make the night longer');
  // A locked Pace carries into later rounds; else each starts at the default.
  const fast = scheduleEstimate({ ...base, pace: 11, later: { ...later, kinds: [...later.kinds] } });
  const fastLocked = scheduleEstimate({ ...base, pace: 11, locked: true, later: { ...later, kinds: [...later.kinds] } });
  assert.equal(fast.gameEndMs - fast.roundEndMs, none.gameEndMs - none.roundEndMs);
  assert.ok(fastLocked.gameEndMs - fastLocked.roundEndMs < fast.gameEndMs - fast.roundEndMs);
  // Per pool (D178): a later round on pool 2 starts on its own unplayed songs, all of them new.
  const two = scheduleEstimate({ ...base, later: { ...later, kinds: [...later.kinds], pools: ['2', '1'] }, pools: { 1: { songs: 70, unplayed: 24 }, 2: { songs: 70, unplayed: 70 } } });
  const g1 = n, g2 = (n * 24) / 70;
  assert.ok(Math.abs((two.gameEndMs - two.roundEndMs) / 1000 - (2 * 150 + roundLengthSec({ pace: 14, firstPlays: g1 }) + roundLengthSec({ pace: 14, firstPlays: g2 }))) < 1e-6);
});
