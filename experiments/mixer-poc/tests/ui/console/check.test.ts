// The Check song by song: which step plays comes from each step's atMs against the clock; the result waits
// for endAtMs.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { FIXTURES } from '../../../ui/fixtures/states.ts';
import { checkProgress, stepState, suggestedVerdict } from '../../../console/logic/check.ts';
import type { CheckInfo } from '../../../ui/flow.ts';

const NOW = 1_800_000_000_000;
const check = (): CheckInfo => {
  const s = FIXTURES.check(NOW).state;
  assert.ok(s.check);
  return s.check;
};

test('stepState: pending, then playing for durationMs, then done', () => {
  const step = { atMs: 1000, durationMs: 2500 };
  assert.equal(stepState(step, 999), 'pending');
  assert.equal(stepState(step, 1000), 'playing');
  assert.equal(stepState(step, 3499), 'playing');
  assert.equal(stepState(step, 3500), 'done');
});

test('before the first step the Check is waiting and nothing is revealed', () => {
  const p = checkProgress(check(), NOW);
  assert.equal(p.stage, 'waiting');
  assert.equal(p.playingIndex, null);
  assert.equal(p.doneCount, 0);
  assert.ok(p.steps.every((s) => s.state === 'pending' && s.landed === null));
});

test('the playing step is highlighted, and its mark shows only once it is done', () => {
  const c = check(); // steps at +600, +3600, +6600, +9600, 2.5 s each; the 4th song (20) has not landed
  const p = checkProgress(c, NOW + 600 + 3000 + 100);
  assert.equal(p.stage, 'running');
  assert.equal(p.playingIndex, 1);
  assert.deepEqual(p.steps.map((s) => s.state), ['done', 'playing', 'pending', 'pending']);
  assert.deepEqual(p.steps.map((s) => s.landed), [true, null, null, null]);
  assert.equal(p.doneCount, 1);
  assert.equal(p.landedCount, 1);
});

test('between two steps nothing plays', () => {
  const p = checkProgress(check(), NOW + 600 + 2600);
  assert.equal(p.playingIndex, null);
  assert.equal(p.doneCount, 1);
});

test('the result shows from endAtMs, with every mark', () => {
  const c = check();
  const before = checkProgress(c, c.endAtMs - 1);
  assert.equal(before.stage, 'running');
  const p = checkProgress(c, c.endAtMs);
  assert.equal(p.stage, 'result');
  assert.equal(p.doneCount, 4);
  assert.equal(p.landedCount, 3);
  assert.deepEqual(p.steps.map((s) => s.landed), [true, true, true, false]);
});

test('a Check without steps (unknown card, wrong type) goes straight to its result', () => {
  const c: CheckInfo = { ...check(), outcome: 'unknownCard', steps: [], startAtMs: NOW, endAtMs: NOW };
  const p = checkProgress(c, NOW);
  assert.equal(p.stage, 'result');
  assert.equal(p.total, 0);
});

test('only a complete card points to a valid verdict', () => {
  assert.equal(suggestedVerdict('complete'), true);
  assert.equal(suggestedVerdict('incomplete'), false);
  assert.equal(suggestedVerdict('unknownCard'), false);
  assert.equal(suggestedVerdict('wrongType'), false);
});
