// Rough countdowns, the Interval's ring and small time helpers of the stage.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { linkLost, nearLanding, parseCssTime, ringLeft, roughCountdown, sameCountdown } from '../../../../stage/model/timing.ts';

const OPTS = { clockAboveMin: 90, fineBelowMin: 10, coarseStepMin: 5 };

test('the Interval ring empties from its start to the guide end, and never goes past', () => {
  assert.equal(ringLeft(0, 180_000, 0), 1);
  assert.equal(ringLeft(0, 180_000, 90_000), 0.5);
  assert.equal(ringLeft(0, 180_000, 200_000), 0, 'overdue');
  assert.equal(ringLeft(0, 180_000, -5000), 1, 'before the start');
  assert.equal(ringLeft(0, 3000, 1), 1, 'rounded to 1/1000, so a frame loop rarely writes');
  assert.equal(ringLeft(0, null, 0), null, 'no guide end: no ring');
  assert.equal(ringLeft(10, 10, 0), 0);
});

test('a rough countdown: clock time when far, rounded minutes, then "soon"', () => {
  const min = 60_000;
  assert.equal(roughCountdown(null, 0, OPTS), null);
  assert.deepEqual(roughCountdown(120 * min, 0, OPTS), { kind: 'at', atMs: 120 * min });
  assert.deepEqual(roughCountdown(42 * min, 0, OPTS), { kind: 'minutes', minutes: 40 });
  assert.deepEqual(roughCountdown(8.2 * min, 0, OPTS), { kind: 'minutes', minutes: 9 });
  assert.deepEqual(roughCountdown(1.5 * min, 0, OPTS), { kind: 'minutes', minutes: 2 });
  assert.deepEqual(roughCountdown(0.5 * min, 0, OPTS), { kind: 'soon' });
  assert.deepEqual(roughCountdown(-3 * min, 0, OPTS), { kind: 'soon' }, 'overdue: rounds start by hand');
});

test('countdowns compare by what they say', () => {
  assert.equal(sameCountdown({ kind: 'minutes', minutes: 3 }, { kind: 'minutes', minutes: 3 }), true);
  assert.equal(sameCountdown({ kind: 'minutes', minutes: 3 }, { kind: 'minutes', minutes: 2 }), false);
  assert.equal(sameCountdown({ kind: 'soon' }, { kind: 'soon' }), true);
  assert.equal(sameCountdown(null, { kind: 'soon' }), false);
  assert.equal(sameCountdown(null, null), true);
});

test('CSS times read from tokens', () => {
  assert.equal(parseCssTime('480ms', 0), 480);
  assert.equal(parseCssTime(' 0.4s', 0), 400);
  assert.equal(parseCssTime('0s', 99), 0);
  assert.equal(parseCssTime('', 99), 99);
  assert.equal(parseCssTime('fast', 99), 99);
});

test('the quiet window before a landing', () => {
  assert.equal(nearLanding(1000, 700, 300), true);
  assert.equal(nearLanding(1000, 699, 300), false);
  assert.equal(nearLanding(1000, 1000, 300), false);
  assert.equal(nearLanding(null, 0, 300), false);
});

test('the link counts as lost only after the grace time', () => {
  assert.equal(linkLost(null, 10_000, 3000), false);
  assert.equal(linkLost(10_000, 12_999, 3000), false);
  assert.equal(linkLost(10_000, 13_000, 3000), true);
});
