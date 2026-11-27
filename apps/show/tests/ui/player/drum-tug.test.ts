// The drum's tug (D220): a stiff wobble that never turns a hidden cover into view.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TUG, hiddenFaceLimitDeg, tugAngle, tugAxis } from '../../../../player/logic/drum-tug.ts';

test('the hidden-face limit: with 10 tiles and the perspective at 2.4 radii, the 108° tile stays hidden', () => {
  const limit = hiddenFaceLimitDeg(10, 2.4);
  // The faces show under acos(1 / 3.4) ≈ 72.9°: the tile at 108° hides until the ring turns ~35°.
  assert.ok(limit > 30 && limit < 35, `limit ${limit}`);
  assert.ok(TUG.maxDeg < limit, 'the design’s most is well inside it');
});

test('the tug is clamped: never past the most, whatever the drag', () => {
  for (const dx of [-5000, -400, -90, -1, 0, 1, 90, 400, 5000]) {
    assert.ok(Math.abs(tugAngle(dx)) <= TUG.maxDeg, `dx ${dx}`);
  }
  assert.ok(Math.abs(tugAngle(100_000)) <= TUG.maxDeg);
  assert.equal(tugAngle(0), 0);
  assert.ok(tugAngle(40) > 0 && tugAngle(-40) < 0, 'it follows the finger’s side');
  assert.ok(tugAngle(40) < tugAngle(200), 'more drag, a little more turn');
  assert.ok(tugAngle(20) < 1.5, 'stiff: a small drag barely moves it');
});

test('a tighter geometry clamps below the hidden-face limit, not the design’s most', () => {
  const tight = { ...TUG, tiles: 4, perspectiveRatio: 0.5, maxDeg: 60 };
  const limit = hiddenFaceLimitDeg(tight.tiles, tight.perspectiveRatio);
  assert.ok(limit < 60);
  assert.ok(Math.abs(tugAngle(1e6, tight)) <= limit);
});

test('the axis: a vertical start is the page’s scroll; a horizontal one tugs; nothing before the slop', () => {
  assert.equal(tugAxis(3, 2), null);
  assert.equal(tugAxis(12, 3), 'x');
  assert.equal(tugAxis(-12, 3), 'x');
  assert.equal(tugAxis(3, 14), 'y');
});
