// The expected end (D100): a round lasts its songs × its own Pace, plus its Checks; the night adds its Intervals.
// Measured on 2025's twelve rounds (docs/research/reports/night-2025-data.md), and on the Show: the exact songs
// from the round's Queue and cards in play, and a Drift that doesn't jump when the cards change mid-round.
import test from 'node:test';
import assert from 'node:assert/strict';
import { dataTest } from './support/data.ts';
import { roundLengthSec, roundSongs, scheduleEstimate } from '../engine/src/plan/pace.ts';
import { SCHEDULE } from '../engine/src/config.ts';
import { firstWinAt, standingCourse } from '../engine/src/game/cards.ts';
import { setup, allCards } from './support/harness.ts';
import { checkGamePlan, replayJournal, type GamePlan, type JournalEntry, type RoundKind } from '@quina/protocol';

/** 2025's rounds: first song and close (local time), songs to the win, seconds per song (gaps up to 45 s). */
const NIGHT_2025: { round: string; kind: RoundKind; first: string; closed: string; songs: number; secPerSong: number }[] = [
  { round: 'Quina 1', kind: 'normal', first: '18:19', closed: '18:39', songs: 48, secPerSong: 22.9 },
  { round: 'Quina 2', kind: 'normal', first: '18:41', closed: '18:58', songs: 49, secPerSong: 18.1 },
  { round: 'Quina 3', kind: 'normal', first: '19:03', closed: '19:24', songs: 56, secPerSong: 16.7 },
  { round: 'Quina 4', kind: 'normal', first: '19:27', closed: '19:45', songs: 49, secPerSong: 15.5 },
  { round: 'Quina 5', kind: 'normal', first: '19:50', closed: '20:07', songs: 49, secPerSong: 16.6 },
  { round: 'Quina 6', kind: 'normal', first: '20:08', closed: '20:25', songs: 53, secPerSong: 13.3 },
  { round: 'Quina 7', kind: 'normal', first: '20:26', closed: '20:41', songs: 50, secPerSong: 13.2 },
  { round: 'Quina 8', kind: 'normal', first: '20:42', closed: '20:55', songs: 52, secPerSong: 11.6 },
  { round: 'Quina 9', kind: 'normal', first: '20:55', closed: '21:06', songs: 42, secPerSong: 11.0 },
  { round: 'Quina 10', kind: 'normal', first: '21:07', closed: '21:22', songs: 49, secPerSong: 12.4 },
  { round: 'Desgraciat', kind: 'desgraciat', first: '21:25', closed: '21:33', songs: 21, secPerSong: 17.5 },
  { round: 'Especial', kind: 'special', first: '21:36', closed: '21:56', songs: 55, secPerSong: 16.9 },
];
const minutes = (hhmm: string) => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3));
const actualMin = (r: (typeof NIGHT_2025)[number]) => minutes(r.closed) - minutes(r.first);
// 2025's times start at the first landing; a round's length counts from its start, so one Spin (one Pace) less.
const modelMin = (r: (typeof NIGHT_2025)[number], pace: number) => (roundLengthSec({ pace, kind: r.kind, songs: r.songs }) - pace) / 60;

test("2025's rounds: songs × the round's own seconds a song, plus the Checks, within about 2 minutes each", () => {
  let model = 0;
  let actual = 0;
  for (const r of NIGHT_2025) {
    const m = modelMin(r, r.secPerSong);
    // The timestamps are to the minute: up to a minute either way comes from them alone.
    assert.ok(Math.abs(m - actualMin(r)) <= 2.5, `${r.round}: ${m.toFixed(1)} min against ${actualMin(r)}`);
    model += m;
    actual += actualMin(r);
  }
  assert.ok(Math.abs(model - actual) / actual < 0.02, `the night's rounds: ${model.toFixed(0)} min against ${actual}`);
});

test("one flat 14 s after round 1 reads 2025's first half short and its second half long; each round's own Pace doesn't", () => {
  // Signed minutes off (model − actual) over Quina 2–5 and Quina 6–10.
  const off = (paceOf: (r: (typeof NIGHT_2025)[number]) => number, from: number, to: number) =>
    NIGHT_2025.slice(from, to).reduce((sum, r) => sum + modelMin(r, paceOf(r)) - actualMin(r), 0);
  const flat = [off(() => 14, 1, 5), off(() => 14, 5, 10)];
  const own = [off((r) => r.secPerSong, 1, 5), off((r) => r.secPerSong, 5, 10)];
  assert.ok(flat[0] < -6 && flat[1] > 4, `flat: ${flat.map((m) => m.toFixed(1)).join(', ')} min`);
  assert.ok(own.every((m) => Math.abs(m) < 2), `own: ${own.map((m) => m.toFixed(1)).join(', ')} min`);
});

test('the expected end: later rounds each at the Pace they start with, with their Intervals and Throws', () => {
  const nowMs = 1_000_000;
  const later = { kinds: ['normal', 'normal', 'desgraciat'] as RoundKind[], intervalSec: 150, throwsSec: 300 };
  // Without the pool, later rounds count no first plays (tests/first-play.test.ts counts them).
  const est = scheduleEstimate({ nowMs, round: { number: 1, kind: 'normal' }, game: {}, position: -1, pace: 22, phase: 'early', later });
  const laterSec = 300 + later.kinds.reduce((s, kind) => s + 150 + roundLengthSec({ pace: 14, kind }), 0);
  assert.ok(Math.abs((est.gameEndMs - est.roundEndMs) / 1000 - laterSec) < 1e-6);
  // At 70 songs a Part (D100): about 46 songs to the Bingo, 21 to the last card standing.
  assert.equal(roundSongs('normal'), SCHEDULE.bingoAtSong);
  assert.equal(roundSongs('desgraciat'), SCHEDULE.desgraciatAtSong);
  assert.equal(roundSongs('normal', SCHEDULE, 38), 38, 'the exact count wins');
});

dataTest("the Show counts the round's songs from its Queue: the first Bingo, or the last card standing", () => {
  const h = setup({ seed: 4, cards: allCards, cardsInPlay: '1-190, 400-550', settings: { autoAdvance: false } });
  h.send('unlock');
  const valid = h.show.phaseModel.valid;
  assert.equal(h.show.expectedSongs, firstWinAt(valid, h.show.queue, 'bingo')!.index + 1);
  h.send('roundIntro', { number: 2, kind: 'desgraciat' });
  h.send('newRound');
  const standing = h.show.phaseModel.valid;
  assert.ok(standing.every((c) => c.type === 'especial'));
  assert.equal(h.show.expectedSongs, standingCourse(standing, h.show.queue).lastStandingAt! + 1);
});

dataTest('cards set mid-round move the expected end but not the Drift, and a replayed journal agrees', () => {
  const h = setup({ seed: 6, cards: allCards, cardsInPlay: '1-60', settings: { autoAdvance: false } });
  h.send('unlock');
  for (let i = 0; i < 5; i++) {
    h.send('next');
    h.until(() => h.show.status === 'playing');
  }
  const before = h.show.schedule();
  const songsBefore = h.show.expectedSongs;
  h.send('setCardsInPlay', { ranges: '1-300' });
  const after = h.show.schedule();
  assert.notEqual(h.show.expectedSongs, songsBefore, 'more cards: another first Bingo');
  assert.notEqual(after.roundEndMs, before.roundEndMs);
  assert.ok(Math.abs(after.roundDriftSec - before.roundDriftSec) < 1, `Drift ${before.roundDriftSec.toFixed(1)} → ${after.roundDriftSec.toFixed(1)} s`);
  const journal = h.log.flatMap((e) => (e.type === 'journal' ? [e.entry as JournalEntry] : []));
  assert.deepEqual(replayJournal(journal), h.show.record());
});

// The flag and moon say when the round and the night should end: at the doors, from the planned start (or now, if later).
function doorsPlan(startAtMs: number | null): GamePlan {
  const checked = checkGamePlan({
    v: 3, edition: '26', title: 'Q', prizeReveal: 'perRound', sponsors: [],
    rounds: ['normal', 'normal', 'desgraciat', 'normal'].map((kind, i) => ({ number: i + 1, kind, line: [], bingo: [] })),
    schedule: { startAtMs, roundMinutes: 25, intervalMinutes: 3 }, cheatSheet: { claimRules: [], specialRoundRules: [] },
  });
  assert.ok(checked.ok, checked.ok ? '' : checked.errors.join('; '));
  return checked.plan;
}

function doorsPair(offsetMs: number) {
  const a = setup({ seed: 3, settings: { autoAdvance: false } });
  const b = setup({ seed: 3, settings: { autoAdvance: false } });
  const startAtMs = a.env.nowMs() + offsetMs;
  a.show.setPlan(doorsPlan(startAtMs));
  b.show.setPlan(doorsPlan(null));
  for (const h of [a, b]) h.send('unlock');
  return { a, b, startAtMs };
}

dataTest("at the doors, the flag and moon count from the plan's start when it's ahead", () => {
  const { a, b, startAtMs } = doorsPair(30 * 60_000);
  assert.equal(a.show.scene, 'before');
  const doors = a.show.snapshot().schedule;
  const fromNow = b.show.snapshot().schedule;
  const roundSec = (fromNow.roundEndMs - b.env.nowMs()) / 1000;
  assert.ok(roundSec > 0);
  assert.ok(doors.roundEndMs >= startAtMs + 1000 * roundSec - 1, 'the round ends no earlier than the start plus its length');
  assert.equal(doors.roundEndMs - fromNow.roundEndMs, 30 * 60_000, 'not now plus it');
  assert.equal(doors.gameEndMs - fromNow.gameEndMs, 30 * 60_000);
  assert.equal(doors.roundDriftSec, fromNow.roundDriftSec, 'the Drift stays');
});

dataTest("at the doors past the plan's start, the flag and moon count from now", () => {
  const { a, b } = doorsPair(-10 * 60_000);
  assert.deepEqual(a.show.snapshot().schedule, b.show.snapshot().schedule);
});

dataTest("once round 1 has started, the plan's start no longer moves the flag and moon", () => {
  const { a, b } = doorsPair(30 * 60_000);
  for (const h of [a, b]) {
    h.send('next');
    h.until(() => h.show.status === 'playing');
  }
  assert.equal(a.show.scene, 'play');
  assert.deepEqual(a.show.schedule(), b.show.schedule());
});
