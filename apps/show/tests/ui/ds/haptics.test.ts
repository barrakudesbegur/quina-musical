// R4's haptics (ANIMATIONS.md › press): a ~10 ms vibration where the browser has the Vibration API and the page may
// use it (after the first tap); nothing, and no error, anywhere else (iOS Safari, the console, tests).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { HAPTIC_MS, buzz } from '../../../../../packages/ui/sounds/delegate.ts';

test('a press buzzes once, for about 10 ms, where the API exists and the page has had a tap', () => {
  const calls: unknown[] = [];
  const nav = { vibrate: (p: number | number[]) => (calls.push(p), true), userActivation: { hasBeenActive: true } };
  assert.equal(buzz(nav), true);
  assert.deepEqual(calls, [HAPTIC_MS]);
  assert.ok(HAPTIC_MS >= 5 && HAPTIC_MS <= 15);
});

test('no API (iOS Safari), no tap yet, or a refusal: nothing, quietly', () => {
  assert.equal(buzz({}), false);
  assert.equal(buzz(undefined), false);
  let called = false;
  assert.equal(buzz({ vibrate: () => ((called = true), true), userActivation: { hasBeenActive: false } }), false);
  assert.equal(called, false);
  assert.equal(
    buzz({
      vibrate: () => {
        throw new Error('blocked');
      },
    }),
    false,
  );
});
