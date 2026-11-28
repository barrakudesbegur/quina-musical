// The console's countdowns: auto-advance ring, landing, Suspense release, Shuffle, Interval guide.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { baseState } from '../../../../../packages/ui/fixtures/states.ts';
import {
  autoAdvanceCountdown,
  autoAdvanceStatus,
  autoModeOn,
  countdownBetween,
  elapsedSec,
  guideCountdown,
  landingCountdown,
  lastLandingAtMs,
  shuffleCountdown,
  suspenseCountdown,
} from '../../../../console/logic/countdown.ts';

const NOW = 1_800_000_000_000;

test('countdownBetween: seconds round up, remaining goes 1 → 0, done at the end', () => {
  assert.deepEqual(countdownBetween(0, 10_000, 0), { secondsLeft: 10, remaining: 1, done: false });
  assert.deepEqual(countdownBetween(0, 10_000, 2_500), { secondsLeft: 8, remaining: 0.75, done: false });
  assert.deepEqual(countdownBetween(0, 10_000, 10_000), { secondsLeft: 0, remaining: 0, done: true });
  assert.deepEqual(countdownBetween(0, 10_000, 99_000), { secondsLeft: 0, remaining: 0, done: true });
  assert.deepEqual(countdownBetween(0, 10_000, -5_000), { secondsLeft: 15, remaining: 1, done: false }, 'clamped before the start');
  assert.equal(countdownBetween(5, 5, 4).remaining, 1, 'an empty span is full before its end');
  assert.equal(countdownBetween(5, 5, 5).done, true);
});

test('the auto-advance ring runs from the last counted landing to autoAtMs', () => {
  const s = baseState(NOW);
  s.landings = s.landings.map((l, i, all) => (i === all.length - 1 ? { ...l, atMs: NOW - 5_000 } : l));
  s.autoAtMs = NOW + 5_000;
  const c = autoAdvanceCountdown(s, NOW);
  assert.ok(c);
  assert.equal(c.secondsLeft, 5);
  assert.equal(c.remaining, 0.5);
  assert.equal(autoAdvanceStatus(s), 'running');
});

test('an undone landing does not start the ring; without a landing the span is the Pace slot', () => {
  const s = baseState(NOW);
  const last = s.landings.length - 1;
  s.landings = s.landings.map((l, i) => (i === last ? { ...l, undone: true, atMs: NOW } : i === last - 1 ? { ...l, atMs: NOW - 10_000 } : l));
  assert.equal(lastLandingAtMs(s), NOW - 10_000);
  s.landings = [];
  s.autoAtMs = NOW + 7_350;
  s.pace = { ...s.pace, slotSec: 14.7 };
  const c = autoAdvanceCountdown(s, NOW);
  assert.ok(c);
  assert.equal(c.remaining, 0.5);
});

test('autoAdvanceStatus explains a missing ring', () => {
  const s = baseState(NOW);
  s.autoAtMs = null;
  assert.equal(autoAdvanceCountdown(s, NOW), null);
  assert.equal(autoAdvanceStatus({ ...s, status: 'transition' }), 'spinning');
  assert.equal(autoAdvanceStatus({ ...s, status: 'hold' }), 'held');
  assert.equal(autoAdvanceStatus({ ...s, game: { ...s.game, autoAdvance: false } }), 'off');
  assert.equal(autoAdvanceStatus({ ...s, phase: 'final', game: { ...s.game, autoAdvanceFinal: false } }), 'offFinal');
  assert.equal(autoAdvanceStatus({ ...s, phase: 'final', game: { ...s.game, autoAdvanceFinal: true } }), 'waiting');
});

test('the landing countdown follows transition.landAtMs over the planned Spin', () => {
  const s = baseState(NOW);
  assert.equal(landingCountdown(s, NOW), null);
  s.transition = { id: 't', recipe: 'R7', phase: 'late', to: 74, landAtMs: NOW + 3_500 };
  s.pace = { ...s.pace, spinSec: 7 };
  const c = landingCountdown(s, NOW);
  assert.ok(c);
  assert.equal(c.secondsLeft, 4);
  assert.equal(c.remaining, 0.5);
});

test('Suspense counts down to its auto-release', () => {
  const s = baseState(NOW);
  assert.equal(suspenseCountdown(s, NOW), null);
  s.suspense = { id: 'x', sinceMs: NOW - 10_000, autoReleaseAtMs: NOW + 20_000 };
  const c = suspenseCountdown(s, NOW);
  assert.ok(c);
  assert.equal(c.secondsLeft, 20);
  assert.ok(Math.abs(c.remaining - 2 / 3) < 1e-9);
});

test('the Shuffle countdown disappears once it has ended', () => {
  const shuffle = { round: 4, startAtMs: NOW, endAtMs: NOW + 9_000 };
  assert.equal(shuffleCountdown(shuffle, NOW + 1_000)?.secondsLeft, 8);
  assert.equal(shuffleCountdown(shuffle, NOW + 9_000), null);
  assert.equal(shuffleCountdown(null, NOW), null);
});

test('the Interval guide may run over, and says by how much', () => {
  const interval = { sinceMs: NOW - 60_000, nextRound: 4, guideEndMs: NOW + 120_000 };
  const before = guideCountdown(interval, NOW);
  assert.ok(before);
  assert.equal(before.secondsLeft, 120);
  assert.equal(before.overSec, 0);
  const after = guideCountdown(interval, NOW + 200_000);
  assert.ok(after);
  assert.equal(after.done, true);
  assert.equal(after.overSec, 80);
  assert.equal(guideCountdown(null, NOW), null);
});

test('elapsedSec never goes negative', () => {
  assert.equal(elapsedSec(NOW - 12_900, NOW), 12);
  assert.equal(elapsedSec(NOW + 5_000, NOW), 0);
});

test('the auto badge: auto-advance on, and on in the final phase only if that is allowed', () => {
  const s = baseState(1_800_000_000_000);
  assert.equal(autoModeOn(s), true);
  assert.equal(autoModeOn({ ...s, game: { ...s.game, autoAdvance: false } }), false);
  assert.equal(autoModeOn({ ...s, phase: 'final' }), false, 'the fixture keeps it off in the final phase');
  assert.equal(autoModeOn({ ...s, phase: 'final', game: { ...s.game, autoAdvanceFinal: true } }), true);
});
