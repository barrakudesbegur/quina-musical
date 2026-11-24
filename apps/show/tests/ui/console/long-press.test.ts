// Long press to confirm (Back, End the night, Panic): fires once after holdMs, a short tap shows the hint.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { LONG_PRESS_IDLE, longPress, longPressProgress, parseCssDurationMs, type LongPressEvent, type LongPressState } from '../../../../console/logic/long-press.ts';

const config = { holdMs: 900, hintMs: 1500 };

/** Run events in order; return the final state and how many times it fired. */
function run(events: LongPressEvent[], from: LongPressState = LONG_PRESS_IDLE) {
  let state = from;
  let fired = 0;
  for (const event of events) {
    const step = longPress(state, event, config);
    state = step.state;
    if (step.fire) fired++;
  }
  return { state, fired };
}

test('holding past holdMs fires exactly once, on the tick that crosses it', () => {
  const pressed = run([{ type: 'down', atMs: 1000 }, { type: 'tick', atMs: 1500 }]);
  assert.equal(pressed.state.phase, 'pressing');
  assert.equal(pressed.fired, 0);
  const step = longPress(pressed.state, { type: 'tick', atMs: 1900 }, config);
  assert.equal(step.fire, true);
  assert.equal(step.state.phase, 'confirmed');
  const after = run([{ type: 'tick', atMs: 2000 }, { type: 'tick', atMs: 3000 }, { type: 'up', atMs: 3100 }], step.state);
  assert.equal(after.fired, 0, 'never fires twice for one press');
  assert.equal(after.state.phase, 'idle');
});

test('a short tap shows the hint, which goes away after hintMs', () => {
  const tap = run([{ type: 'down', atMs: 0 }, { type: 'up', atMs: 120 }]);
  assert.equal(tap.fired, 0);
  assert.equal(tap.state.phase, 'hint');
  assert.equal(tap.state.hintUntilMs, 120 + config.hintMs);
  assert.equal(run([{ type: 'tick', atMs: 1000 }], tap.state).state.phase, 'hint');
  assert.equal(run([{ type: 'tick', atMs: 120 + config.hintMs }], tap.state).state.phase, 'idle');
});

test('releasing just under the threshold does not fire', () => {
  assert.equal(run([{ type: 'down', atMs: 0 }, { type: 'tick', atMs: 899 }, { type: 'up', atMs: 899 }]).fired, 0);
});

test('a release after the threshold fires even when no tick crossed it (a late frame)', () => {
  const r = run([{ type: 'down', atMs: 0 }, { type: 'tick', atMs: 500 }, { type: 'up', atMs: 950 }]);
  assert.equal(r.fired, 1);
  assert.equal(r.state.phase, 'idle');
});

test('cancel (pointercancel, blur, disabled) never fires and shows no hint', () => {
  const r = run([{ type: 'down', atMs: 0 }, { type: 'tick', atMs: 800 }, { type: 'cancel', atMs: 850 }, { type: 'tick', atMs: 2000 }]);
  assert.equal(r.fired, 0);
  assert.equal(r.state.phase, 'idle');
});

test('key auto-repeat (a second down) does not restart the press', () => {
  const r = run([{ type: 'down', atMs: 0 }, { type: 'down', atMs: 500 }, { type: 'tick', atMs: 900 }]);
  assert.equal(r.fired, 1);
});

test('pressing again during the hint starts a new press', () => {
  const r = run([{ type: 'down', atMs: 0 }, { type: 'up', atMs: 100 }, { type: 'down', atMs: 300 }, { type: 'tick', atMs: 1200 }]);
  assert.equal(r.fired, 1);
});

test('stray ups and ticks while idle change nothing', () => {
  const r = run([{ type: 'up', atMs: 5 }, { type: 'tick', atMs: 10 }, { type: 'cancel', atMs: 20 }]);
  assert.deepEqual(r.state, LONG_PRESS_IDLE);
  assert.equal(r.fired, 0);
});

test('progress goes 0 → 1 while pressing and is 0 otherwise', () => {
  const pressing = run([{ type: 'down', atMs: 1000 }]).state;
  assert.equal(longPressProgress(LONG_PRESS_IDLE, 5000, config), 0);
  assert.equal(longPressProgress(pressing, 1000, config), 0);
  assert.equal(longPressProgress(pressing, 1450, config), 0.5);
  assert.equal(longPressProgress(pressing, 9999, config), 1);
  const confirmed = longPress(pressing, { type: 'tick', atMs: 1900 }, config).state;
  assert.equal(longPressProgress(confirmed, 1900, config), 1);
  assert.equal(longPressProgress(pressing, 1450, { ...config, holdMs: 0 }), 1);
});

test('parseCssDurationMs reads the --dur-hold-confirm token, with a fallback', () => {
  assert.equal(parseCssDurationMs('900ms', 1), 900);
  assert.equal(parseCssDurationMs(' 1.2s ', 1), 1200);
  assert.equal(parseCssDurationMs('.5s', 1), 500);
  assert.equal(parseCssDurationMs('0ms', 1), 0);
  assert.equal(parseCssDurationMs('', 900), 900);
  assert.equal(parseCssDurationMs('fast', 900), 900);
  assert.equal(parseCssDurationMs(null, 900), 900);
  assert.equal(parseCssDurationMs('-5ms', 900), 900);
});
