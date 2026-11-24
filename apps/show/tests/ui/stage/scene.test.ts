// Which scene the projector draws, and when the drum shows through.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { flowOf } from '../../../ui/flow.ts';
import { drumShown, stageScene } from '../../../stage/model/scene.ts';

const base = flowOf(null);

test('the scene follows the flow', () => {
  for (const scene of ['before', 'roundStart', 'play', 'interval', 'after'] as const) assert.equal(stageScene({ ...base, scene }), scene);
});

test('a Check or Celebration without its data stays on play (a Hold shows no change)', () => {
  assert.equal(stageScene({ ...base, scene: 'check', check: null }), 'play');
  assert.equal(stageScene({ ...base, scene: 'celebration', celebration: null }), 'play');
  const check = { claimId: 'c', cardId: 1, kind: 'line' as const, outcome: 'complete' as const, row: 0, otherRows: [], steps: [], startAtMs: 0, endAtMs: 0 };
  assert.equal(stageScene({ ...base, scene: 'check', check }), 'check');
});

test('the drum shows in play, the Celebration, and the round start except under the Shuffle grid', () => {
  assert.equal(drumShown('play', null, false), true);
  assert.equal(drumShown('celebration', null, false), true);
  assert.equal(drumShown('check', null, false), false);
  assert.equal(drumShown('interval', null, false), false);
  assert.equal(drumShown('roundStart', null, false), true);
  assert.equal(drumShown('roundStart', 'appear', false), false);
  assert.equal(drumShown('roundStart', 'fly', false), false);
  assert.equal(drumShown('roundStart', 'settle', false), true);
  assert.equal(drumShown('play', null, true), false, 'a technical pause covers it');
});
