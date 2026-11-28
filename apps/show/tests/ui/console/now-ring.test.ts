// The ring next to "Ara sona" (Consola-Anell): its state from the snapshot, most pressing first, with the
// countdown it empties to and the badge on its corner.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { ShowState } from '@quina/protocol';
import { FIXTURES, baseState } from '../../../../../packages/ui/fixtures/states.ts';
import { flowOf } from '../../../../../packages/ui/flow.ts';
import { RING_STATES, modeBadge, nowRing, type RingView } from '../../../../console/logic/now-ring.ts';

const NOW = 1_800_000_000_000;
const LAST = 3;

const ring = (state: ShowState, nowMs = NOW): RingView => nowRing({ state, flow: flowOf(state), nowMs, lastSec: LAST });
const fixture = (name: string): ShowState => FIXTURES[name](NOW).state;

test('auto: counts down to autoAtMs with the auto badge; the last seconds turn into autoLast', () => {
  const s = baseState(NOW); // autoAtMs = NOW + 9 s
  const r = ring(s);
  assert.equal(r.state, 'auto');
  assert.equal(r.badge, 'auto');
  assert.equal(r.countdown?.secondsLeft, 9);
  assert.equal(ring(s, NOW + 6_000).state, 'autoLast', '3 s left');
  assert.equal(ring(s, NOW + 5_500).state, 'auto', '4 s left (rounded up)');
  assert.equal(ring(s, NOW + 9_500).state, 'auto', 'past autoAtMs (the snapshot is late): not red, the ring is just empty');
});

test('spinning: a transition counts down to its landing; suspense wins over the Spin', () => {
  const spin = ring(fixture('spin'));
  assert.equal(spin.state, 'spinning');
  assert.equal(spin.countdown?.secondsLeft, 6);
  assert.equal(spin.badge, 'auto', 'the badge still names the mode');
  const suspense = ring(fixture('suspense'));
  assert.equal(suspense.state, 'suspense');
  assert.equal(suspense.countdown?.secondsLeft, 22);
});

test('manual: auto-advance off, or off in the final phase, asks for Següent', () => {
  const s = baseState(NOW);
  const off = ring({ ...s, autoAtMs: null, game: { ...s.game, autoAdvance: false } });
  assert.deepEqual([off.state, off.badge, off.countdown], ['manual', 'autoOff', null]);
  const final = ring({ ...s, autoAtMs: null, phase: 'final', game: { ...s.game, autoAdvanceFinal: false } });
  assert.deepEqual([final.state, final.badge], ['manualFinal', 'final']);
  const waiting = ring({ ...s, autoAtMs: null });
  assert.deepEqual([waiting.state, waiting.badge], ['waiting', 'auto']);
});

test('Parlem and Aguanta: a Hold by its mode, with since and whether Hold music took over', () => {
  const talk = ring(fixture('hold'));
  assert.deepEqual([talk.state, talk.badge, talk.sinceMs, talk.holdMusic], ['talk', 'talk', NOW - 12_000, false]);
  const s = fixture('hold');
  const long = ring({ ...s, holdMusic: true, hold: { ...s.hold!, holdMusic: true } });
  assert.deepEqual([long.state, long.holdMusic], ['talk', true]);
  const stay = ring({ ...s, hold: { ...s.hold!, ducked: false } });
  assert.deepEqual([stay.state, stay.badge], ['stay', 'stay']);
  const older = ring({ ...s, hold: { ...s.hold!, ducked: undefined } });
  assert.equal(older.state, 'talk', 'an older engine without `ducked` is Parlem');
});

test('a Check in progress names its card; a failed Check plays error music until Resume', () => {
  const check = ring(fixture('check'));
  assert.deepEqual([check.state, check.badge, check.cardId], ['checking', 'held', 57]);
  const s = fixture('hold');
  const claim = ring({ ...s, hold: { ...s.hold!, reason: 'claim' } });
  assert.deepEqual([claim.state, claim.cardId], ['checking', null], 'a Claim hold with no Check yet');
  const failed = ring({ ...s, hold: { ...s.hold!, reason: 'checkFailed', holdMusic: true } });
  assert.deepEqual([failed.state, failed.badge, failed.holdMusic], ['checkFailed', 'held', true]);
});

test('a Claim hold through the Celebration is not a Check, nor Parlem until the presenters turn it on (whats-left 2.3)', () => {
  const s = fixture('celebration');
  const held = { ...s, status: 'hold' as const, hold: { sinceMs: NOW - 1_000, reason: 'claim' as const, holdMusic: false } };
  assert.deepEqual([ring(held).state, ring(held).badge], ['waiting', null]);
  assert.ok(s.celebration);
  const parlem = { ...held, celebration: { ...s.celebration, parlem: true } };
  assert.deepEqual([ring(parlem).state, ring(parlem).badge], ['talk', 'talk']);
});

test('the technical pause wins over everything, with Hold music and no badge', () => {
  const p = ring(fixture('pause'));
  assert.deepEqual([p.state, p.badge, p.sinceMs, p.holdMusic], ['paused', null, NOW - 30_000, true]);
});

test('every fixture maps to a known state', () => {
  for (const [name, make] of Object.entries(FIXTURES)) {
    const s = make(NOW).state;
    assert.ok(RING_STATES.includes(ring(s).state), name);
  }
});

test('modeBadge: auto, off, or off for the final phase', () => {
  const s = baseState(NOW);
  assert.equal(modeBadge(s), 'auto');
  assert.equal(modeBadge({ ...s, game: { ...s.game, autoAdvance: false } }), 'autoOff');
  assert.equal(modeBadge({ ...s, phase: 'final' }), 'final');
  assert.equal(modeBadge({ ...s, phase: 'final', game: { ...s.game, autoAdvance: false } }), 'autoOff');
});

test("the Desgraciat's last card standing: the ring points at its Check, not at Següent", () => {
  const last = ring(fixture('desgraciatLast'));
  assert.deepEqual([last.state, last.badge, last.cardId], ['lastStanding', 'final', 57]);
  const many = ring(fixture('desgraciat'));
  assert.notEqual(many.state, 'lastStanding', 'more than one standing: the usual states');
  const spin = fixture('desgraciatLast');
  assert.equal(ring({ ...spin, status: 'hold', hold: { reason: 'claim', sinceMs: NOW, ducked: true, holdMusic: false } as ShowState['hold'] }).state, 'checking', 'a Check wins');
});
