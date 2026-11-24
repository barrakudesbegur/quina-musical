// Two levels per button: a tap is the first level, holding past holdMs the second (Parlem → Pausa,
// Aguanta → Suspens), and what each action sends.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { modeCommand, secondLevel } from '../../../../console/logic/hold-modes.ts';
import { TWO_LEVEL_IDLE, twoLevel, twoLevelProgress, type TwoLevelEvent, type TwoLevelState } from '../../../../console/logic/two-level.ts';

const CFG = { holdMs: 800, canEscalate: true };

/** Run events through the machine; return the final state and every action in order. */
function run(events: TwoLevelEvent[], config = CFG, start: TwoLevelState = TWO_LEVEL_IDLE) {
  let state = start;
  const actions: string[] = [];
  for (const e of events) {
    const out = twoLevel(state, e, config);
    state = out.state;
    actions.push(...out.actions);
  }
  return { state, actions };
}

test('a short press is a tap, acted on release', () => {
  const down = run([{ type: 'down', atMs: 0 }, { type: 'tick', atMs: 300 }]);
  assert.deepEqual(down.actions, [], 'nothing while the finger is down');
  assert.deepEqual(run([{ type: 'down', atMs: 0 }, { type: 'tick', atMs: 300 }, { type: 'up', atMs: 400 }]).actions, ['tap']);
});

test('holding past holdMs escalates at once, while still pressed; letting go releases', () => {
  const held = run([{ type: 'down', atMs: 0 }, { type: 'tick', atMs: 799 }, { type: 'tick', atMs: 800 }]);
  assert.equal(held.state.phase, 'escalated');
  assert.deepEqual(held.actions, ['escalate']);
  const after = run([{ type: 'tick', atMs: 2000 }, { type: 'up', atMs: 2100 }], CFG, held.state);
  assert.deepEqual(after.actions, ['release'], 'no second escalate, one release');
  assert.equal(after.state.phase, 'idle');
});

test('a release after the threshold with no frame in between still escalates, then releases', () => {
  assert.deepEqual(run([{ type: 'down', atMs: 0 }, { type: 'up', atMs: 900 }]).actions, ['escalate', 'release']);
});

test('without a second level now, any press is a tap', () => {
  const cfg = { holdMs: 800, canEscalate: false };
  const r = run([{ type: 'down', atMs: 0 }, { type: 'tick', atMs: 5000 }, { type: 'up', atMs: 5100 }], cfg);
  assert.deepEqual(r.actions, ['tap']);
  assert.equal(twoLevelProgress({ phase: 'pressing', downAtMs: 0 }, 400, cfg), 0, 'no fill either');
});

test('a cancelled press does nothing; a cancelled escalated press lets go', () => {
  assert.deepEqual(run([{ type: 'down', atMs: 0 }, { type: 'cancel', atMs: 300 }]).actions, []);
  assert.deepEqual(run([{ type: 'down', atMs: 0 }, { type: 'tick', atMs: 900 }, { type: 'cancel', atMs: 1000 }]).actions, ['escalate', 'release']);
});

test('key auto-repeat or a second finger does not restart the press', () => {
  const r = run([{ type: 'down', atMs: 0 }, { type: 'down', atMs: 500 }, { type: 'tick', atMs: 800 }]);
  assert.deepEqual(r.actions, ['escalate']);
});

test('progress fills 0 → 1 over holdMs', () => {
  const pressing: TwoLevelState = { phase: 'pressing', downAtMs: 1000 };
  assert.equal(twoLevelProgress(pressing, 1400, CFG), 0.5);
  assert.equal(twoLevelProgress(pressing, 9000, CFG), 1);
  assert.equal(twoLevelProgress({ phase: 'escalated', downAtMs: 1000 }, 1000, CFG), 1);
  assert.equal(twoLevelProgress(TWO_LEVEL_IDLE, 1000, CFG), 0);
});

const OFF = { on: false, canEnter: true };
const ON = { on: true, canEnter: false };

test('Parlem: a tap toggles Parlem, a hold enters Pausa, a tap in Pausa leaves it', () => {
  assert.deepEqual(modeCommand('talk', 'tap', null, OFF), { cmd: 'hold', args: { on: true, duck: true } });
  assert.deepEqual(modeCommand('talk', 'tap', 'talk', OFF), { cmd: 'hold', args: { on: false } });
  assert.deepEqual(modeCommand('talk', 'escalate', 'talk', OFF), { cmd: 'pause', args: { on: true } });
  assert.equal(modeCommand('talk', 'release', 'talk', ON), null, 'Pausa stays on after letting go');
  assert.deepEqual(modeCommand('talk', 'tap', 'talk', ON), { cmd: 'pause', args: { on: false } });
});

test('Aguanta: a tap toggles Aguanta, a hold opens Suspens and letting go lands; a tap releases an open Suspens', () => {
  assert.deepEqual(modeCommand('stay', 'tap', null, OFF), { cmd: 'hold', args: { on: true, duck: false } });
  assert.deepEqual(modeCommand('stay', 'tap', 'talk', OFF), { cmd: 'hold', args: { on: true, duck: false } }, 'switches from Parlem');
  assert.deepEqual(modeCommand('stay', 'escalate', null, OFF), { cmd: 'suspense', args: { on: true } });
  assert.deepEqual(modeCommand('stay', 'release', null, ON), { cmd: 'suspense', args: { on: false } });
  assert.deepEqual(modeCommand('stay', 'tap', null, ON), { cmd: 'suspense', args: { on: false } });
});

test('secondLevel: on, and whether holding can enter it now', () => {
  const base = { paused: false, suspenseOpen: false, canPause: true, canSuspense: true };
  assert.deepEqual(secondLevel('talk', base), { on: false, canEnter: true });
  assert.deepEqual(secondLevel('talk', { ...base, paused: true }), { on: true, canEnter: false });
  assert.deepEqual(secondLevel('talk', { ...base, canPause: false }), { on: false, canEnter: false });
  assert.deepEqual(secondLevel('stay', { ...base, suspenseOpen: true }), { on: true, canEnter: false });
  assert.deepEqual(secondLevel('stay', { ...base, canSuspense: false }), { on: false, canEnter: false });
});
