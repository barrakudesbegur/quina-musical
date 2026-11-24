// The next-to-now morph: when it runs, and the FLIP that flies "Següent" into "Ara sona".
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { invert, shouldMorph } from '../../../../console/logic/next-to-now.ts';

test('it runs only when the song that lands is the one shown as next, and motion is allowed', () => {
  assert.equal(shouldMorph(42, 42, false), true);
  assert.equal(shouldMorph(42, 7, false), false, 'the next song was changed before it landed');
  assert.equal(shouldMorph(42, null, false), false);
  assert.equal(shouldMorph(42, 42, true), false, 'reduced motion: the panels swap at once');
});

test('the invert puts the new element back where the old one was', () => {
  const from = { left: 20, top: 220, width: 60, height: 60 };
  const to = { left: 30, top: 110, width: 90, height: 90 };
  const t = invert(from, to);
  assert.deepEqual(t, { dx: -10, dy: 110, sx: 60 / 90, sy: 60 / 90 });
  assert.deepEqual(invert(from, { ...to, width: 0, height: 0 }), { dx: -10, dy: 110, sx: 1, sy: 1 }, 'no division by zero');
});
