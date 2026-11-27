// C3 · Sheet's drag to close (ANIMATIONS.md `drawer-drag`, D-n): it follows the finger down, resists up, and on
// release a flick or the distance decides; a touch on the content drags the sheet only when the content is at its top.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SHEET_DRAG, barAxis, closeDuration, contentGesture, dragOffset, handsOver, pullShare, releaseCloses, releaseVelocity } from '../../../../../packages/ui/components/sheet-drag.ts';

test('down it follows the finger 1:1; up it resists, a third as far and never past 24 px', () => {
  assert.equal(dragOffset(0), 0);
  assert.equal(dragOffset(137), 137);
  const small = dragOffset(-9);
  assert.ok(small < 0 && small > -3.1, `a short pull up moves about a third: ${small}`);
  assert.ok(dragOffset(-60) < dragOffset(-30), 'further up is further');
  assert.ok(dragOffset(-5000) >= -SHEET_DRAG.maxUp, 'never past maxUp');
});

test('the release speed is the last 80 ms of the finger, so a pause before letting go is no flick', () => {
  assert.equal(releaseVelocity([]), 0);
  assert.equal(releaseVelocity([{ y: 10, t: 0 }]), 0);
  const flick = [{ y: 0, t: 0 }, { y: 10, t: 90 }, { y: 30, t: 140 }, { y: 70, t: 180 }];
  assert.equal(releaseVelocity(flick), 1, '40 px in the last 40 ms');
  const paused = [{ y: 0, t: 0 }, { y: 200, t: 100 }, { y: 201, t: 400 }];
  assert.equal(releaseVelocity(paused), 0, 'one sample in the window');
  assert.ok(releaseVelocity([{ y: 100, t: 0 }, { y: 60, t: 40 }]) < 0, 'upwards is negative');
});

test('it closes past 30 % of its height or on a flick down; a flick up or no pull keeps it', () => {
  assert.equal(releaseCloses(200, 600, 0.1), true, 'a third of the way');
  assert.equal(releaseCloses(150, 600, 0.1), false);
  assert.equal(releaseCloses(40, 600, 0.8), true, 'a flick');
  assert.equal(releaseCloses(0, 600, 2), false, 'not moved');
  assert.equal(releaseCloses(-10, 600, 2), false, 'above its rest');
  assert.equal(releaseCloses(40, 600, -0.8), false, 'flicked back up');
  assert.equal(releaseCloses(400, 600, -0.8), false, 'far down but flicked back up');
});

test('a close from a drag goes on at the finger’s speed, 120–240 ms', () => {
  assert.equal(closeDuration(300, 600, 3), SHEET_DRAG.closeMs.min, 'fast: the floor');
  assert.equal(closeDuration(0, 600, 0), SHEET_DRAG.closeMs.max, 'slow: the ceiling');
  assert.equal(closeDuration(420, 600, 1), 150, '180 px left at 1.2 px/ms');
});

test('the backdrop lightens by the share pulled', () => {
  assert.equal(pullShare(0, 600), 0);
  assert.equal(pullShare(300, 600), 0.5);
  assert.equal(pullShare(-20, 600), 0);
  assert.equal(pullShare(900, 600), 1);
  assert.equal(pullShare(10, 0), 0);
});

test('a touch on the content drags the sheet only pulling down from the top; anything else is its scroll', () => {
  assert.equal(contentGesture(3, 0, 0), null, 'not moved enough to tell');
  assert.equal(contentGesture(12, 2, 0), 'drag');
  assert.equal(contentGesture(12, 2, 40), 'scroll', 'the content is scrolled: it scrolls back first');
  assert.equal(contentGesture(-12, 0, 0), 'scroll', 'pushing up scrolls');
  assert.equal(contentGesture(8, 20, 0), 'scroll', 'sideways');
});

test('a scroll back up that reaches the top and goes on pulling down becomes the drag (the hand-over)', () => {
  assert.equal(handsOver(0, 4), true);
  assert.equal(handsOver(12, 4), false, 'not at the top yet');
  assert.equal(handsOver(0, -4), false, 'pushing up scrolls');
  assert.equal(handsOver(0, 0), false);
});

test('the title bar locks its axis after 6 px: sideways never drags', () => {
  assert.equal(barAxis(3, 2), null);
  assert.equal(barAxis(10, 4), 'y');
  assert.equal(barAxis(-10, 4), 'y', 'up: the rubber band');
  assert.equal(barAxis(3, 12), 'x');
});
