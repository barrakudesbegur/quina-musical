// The menu's «Proves» card (logic/tests-mode.ts): shown only after the relay's `relay.mode { test: true }`; the
// commands its controls send; «Nova partida» behind a hold.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PROTOCOL_VERSION } from '@quina/protocol';
import type { CatalogCard } from '../../../../../packages/ui/data/catalog.ts';
import { LONG_PRESS_IDLE, longPress, type LongPressEvent } from '../../../../../packages/ui/components/hold/long-press.ts';
import type { GamePlan } from '../../../../../packages/ui/plan.ts';
import { ACTIONS } from '../../../../console/actions.ts';
import { S, commandText } from '../../../../console/strings.ts';
import { TEST_SONGS_FALLBACK_MAX, sendTestCommand, testCanSend, testJumpArgs, testModeAfter, testRounds, testSongsMax } from '../../../../console/logic/tests-mode.ts';

const mode = (test: unknown) => ({ v: PROTOCOL_VERSION, type: 'relay.mode', test });

test('no relay.mode: hidden (an older relay, or a cloud console)', () => {
  let shown = false;
  for (const m of [{ v: PROTOCOL_VERSION, type: 'state' }, { v: PROTOCOL_VERSION, type: 'relay.clients', clients: [] }, null, 'relay.mode', 42]) shown = testModeAfter(shown, m);
  assert.equal(shown, false);
});

test('relay.mode { test: true } shows it; other messages keep it', () => {
  const shown = testModeAfter(false, mode(true));
  assert.equal(shown, true);
  assert.equal(testModeAfter(shown, { v: PROTOCOL_VERSION, type: 'state' }), true);
});

test('anything else in relay.mode hides it: false, a truthy non-boolean, a missing field', () => {
  for (const m of [mode(false), mode('true'), mode(1), mode(undefined), { v: PROTOCOL_VERSION, type: 'relay.mode' }]) assert.equal(testModeAfter(true, m), false, JSON.stringify(m));
  assert.equal(testModeAfter(false, { v: 99, type: 'relay.mode', test: true }), false, 'another protocol version is ignored');
});

test('the commands: offline or locked can’t send; any scene can', () => {
  assert.equal(testCanSend({ online: false, state: { status: 'playing' } }), false);
  assert.equal(testCanSend({ online: true, state: null }), false);
  assert.equal(testCanSend({ online: true, state: { status: 'locked' } }), false);
  assert.equal(testCanSend({ online: true, state: { status: 'hold' } }), true);
});

test('the messages: testReset {} and testJump, like ShowClient.send builds them', () => {
  const reset = sendTestCommand('testReset', {}, 'Tauleta');
  assert.deepEqual(reset.message, { v: PROTOCOL_VERSION, type: 'cmd', cmd: 'testReset', reqId: reset.reqId });
  assert.match(reset.reqId, /^Tauleta-/);
  const jump = sendTestCommand('testJump', testJumpArgs(4, 7), 'Tauleta');
  assert.deepEqual(jump.message, { v: PROTOCOL_VERSION, type: 'cmd', cmd: 'testJump', reqId: jump.reqId, round: 4, songs: 7 });
  assert.equal(commandText('testReset'), S.tests.reset, 'a refusal names it');
});

/** A card of `type`, its side 1 songs `first` … `first + 11`. */
const card = (id: number, type: string, first: number, side = 1): CatalogCard => ({
  id,
  type,
  sides: [{ side, lines: [0, 1, 2].map((l) => [0, 1, 2, 3].map((s) => first + l * 4 + s)) }],
});
const PRINTED = new Map<number, CatalogCard>([
  [1, card(1, 'normal', 1)],
  [2, card(2, 'normal', 7)], // overlaps card 1: songs 1…18
  [3, card(3, 'especial', 100, 2)],
]);
const bundle = { line: [], bingo: [] };
const PLAN: Pick<GamePlan, 'rounds'> = {
  rounds: [
    { number: 2, kind: 'special', cardType: 'especial', side: 2, ...bundle },
    { number: 1, kind: 'normal', cardType: 'normal', ...bundle },
    { number: 3, kind: 'desgraciat', cardType: 'especial', side: 1, ...bundle },
  ],
};

test('the picker: the plan’s rounds in order, each with its songs from the printed cards', () => {
  const rounds = testRounds(PLAN, 0, PRINTED);
  assert.deepEqual(rounds, [
    { number: 1, kind: 'normal', songs: 18 },
    { number: 2, kind: 'special', songs: 12 },
    { number: 3, kind: 'desgraciat', songs: 0 },
  ]);
  assert.deepEqual(testRounds(PLAN, 0, null).map((r) => r.songs), [null, null, null], 'before cards.json loads');
  assert.deepEqual(testRounds(null, 2, PRINTED), [{ number: 1, kind: 'normal', songs: 18 }, { number: 2, kind: 'normal', songs: 18 }], 'no plan: 1 … roundsTotal');
});

test('«Anar a la ronda N»: { round }; «després de K cançons»: { round, songs: K }, 0 … the round’s songs', () => {
  const [first] = testRounds(PLAN, 0, PRINTED);
  assert.deepEqual(testJumpArgs(first!.number, null), { round: 1 });
  assert.deepEqual(testJumpArgs(first!.number, 0), { round: 1, songs: 0 }, 'K = 0 is sent, not dropped');
  assert.equal(testSongsMax(first!), 18);
  assert.deepEqual(testJumpArgs(first!.number, testSongsMax(first!)), { round: 1, songs: 18 });
  assert.equal(testSongsMax({ number: 1, kind: 'normal', songs: null }), TEST_SONGS_FALLBACK_MAX, 'unknown count: the engine refuses past the Queue');
});

test('«Nova partida» is behind «Acabar la nit»’s hold: a tap never sends, a hold sends once', () => {
  assert.equal(ACTIONS.testReset.layout, 'row');
  assert.equal(ACTIONS.testReset.variant, ACTIONS.endNight.variant);
  assert.match(ACTIONS.testReset.note, /^Mantén premut/);
  const config = { holdMs: 900, hintMs: 1500 };
  const fires = (events: LongPressEvent[]) => {
    let state = LONG_PRESS_IDLE;
    let n = 0;
    for (const e of events) {
      const step = longPress(state, e, config);
      state = step.state;
      if (step.fire) n++;
    }
    return n;
  };
  assert.equal(fires([{ type: 'down', atMs: 0 }, { type: 'up', atMs: 150 }]), 0, 'a tap only shows the hint');
  assert.equal(fires([{ type: 'down', atMs: 0 }, { type: 'tick', atMs: 500 }, { type: 'up', atMs: 600 }]), 0, 'let go early');
  assert.equal(fires([{ type: 'down', atMs: 0 }, { type: 'tick', atMs: 950 }, { type: 'tick', atMs: 2000 }, { type: 'up', atMs: 2100 }]), 1);
});
