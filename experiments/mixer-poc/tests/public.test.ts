// The public feed (protocol/public.ts) that phones and the cloud share: a pure reducer, a gap means a fresh
// snapshot, jittered reconnects. The cloud's projection is tested in cloud/test/.
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  PROTOCOL_VERSION,
  applyPublic,
  cardsParam,
  emptyPublicState,
  followFeed,
  newGamePublicState,
  parseCardsParam,
  PUBLIC_FEED,
  reconnectDelayMs,
  roundGameEnd,
  type PublicChange,
  type PublicState,
} from '@quina/protocol';

function deepFreeze<T>(value: T): T {
  if (value && typeof value === 'object') {
    for (const v of Object.values(value)) deepFreeze(v);
    Object.freeze(value);
  }
  return value;
}

const round1: PublicChange = { kind: 'round', round: { number: 1, kind: 'normal', startedAtMs: 0, lineConfirmed: false, ended: false, landings: [] } };

test('applyPublic never changes the state it is given', () => {
  const state = deepFreeze(applyPublic(emptyPublicState('26'), [round1]));
  const changes: PublicChange[] = [
    { kind: 'landed', round: 1, landing: { position: 1, songId: 9, atMs: 2 } },
    { kind: 'landed', round: 1, landing: { position: 0, songId: 4, atMs: 1 } },
    { kind: 'undone', round: 1, position: 1 },
    { kind: 'line', round: 1 },
    { kind: 'winner', winner: { round: 1, kind: 'line', cardIds: [5] } },
    { kind: 'winner', winner: { round: 1, kind: 'line', cardIds: [3, 5] } },
    { kind: 'roundEnded', round: 1 },
    { kind: 'notice', notice: 'Hola' },
  ];
  const next = applyPublic(state, changes);
  assert.deepEqual(next.rounds[0]?.landings, [{ position: 0, songId: 4, atMs: 1 }], 'kept in Queue order; Back removed one');
  assert.equal(next.rounds[0]?.lineConfirmed, true);
  assert.equal(next.rounds[0]?.ended, true);
  assert.deepEqual(next.winners, [{ round: 1, kind: 'line', cardIds: [5, 3] }], 'a shared prize is one entry');
  assert.equal(next.notice, 'Hola');
});

test('a round restarted with the same number replaces the old one', () => {
  const state = applyPublic(emptyPublicState('26'), [round1, { kind: 'landed', round: 1, landing: { position: 0, songId: 4, atMs: 1 } }, round1]);
  assert.equal(state.rounds.length, 1);
  assert.deepEqual(state.rounds[0]?.landings, []);
});

test('a new Game resets the rounds but keeps the edition: plan, banner, sound default and link', () => {
  const before: PublicState = applyPublic(emptyPublicState('26'), [round1, { kind: 'notice', notice: 'x' }, { kind: 'sounds', soundsDefault: false }, { kind: 'link', link: { online: true, sinceMs: 5 } }]);
  const fresh = newGamePublicState(before, 'game-2');
  assert.equal(fresh.gameId, 'game-2');
  assert.deepEqual(fresh.rounds, []);
  assert.equal(fresh.notice, 'x');
  assert.equal(fresh.soundsDefault, false);
  assert.deepEqual(fresh.link, { online: true, sinceMs: 5 });
  assert.equal(fresh.edition, '26');
});

test('followFeed: a snapshot, then deltas in order; a gap or a delta first means reconnect', () => {
  const snapshot = { v: PROTOCOL_VERSION, type: 'public.state', seq: 7, nowMs: 0, state: emptyPublicState('26') };
  const delta = (seq: number) => ({ v: PROTOCOL_VERSION, type: 'public.delta', seq, nowMs: 0, changes: [round1] });
  assert.deepEqual(followFeed(null, delta(1)), { kind: 'resync' });
  const first = followFeed(null, snapshot);
  assert.equal(first.kind, 'ok');
  const view = first.kind === 'ok' ? first.view : null;
  const second = followFeed(view, delta(8));
  assert.equal(second.kind === 'ok' && second.view.state.rounds.length, 1);
  assert.deepEqual(followFeed(view, delta(9)), { kind: 'resync' }, 'seq 8 is missing');
  assert.deepEqual(followFeed(view, delta(7)), { kind: 'resync' }, 'an old delta');
  for (const odd of [null, 'x', { v: 2, type: 'public.state', seq: 1, nowMs: 0, state: {} }, { v: 1, type: 'state' }]) {
    assert.deepEqual(followFeed(view, odd), { kind: 'ignore' });
  }
});

test('reconnect delays: full jitter under a ceiling that doubles up to 30 s', () => {
  assert.equal(reconnectDelayMs(0, () => 0), 0);
  assert.equal(reconnectDelayMs(0, () => 0.999), 999);
  assert.equal(reconnectDelayMs(3, () => 0.5), 4000);
  assert.equal(reconnectDelayMs(40, () => 0.999), Math.floor(0.999 * PUBLIC_FEED.reconnectCapMs));
  const many = Array.from({ length: 400 }, () => reconnectDelayMs(5));
  assert.ok(many.every((d) => d >= 0 && d < 30_000));
  assert.ok(new Set(many.map((d) => Math.floor(d / 1000))).size > 20, '400 phones spread out over the window');
});

test('cards in the URL: unique and sorted, card numbers only, at most 30', () => {
  assert.equal(cardsParam([123, 12, 123]), '12,123');
  assert.deepEqual(parseCardsParam('123,12,12'), [12, 123]);
  assert.deepEqual(parseCardsParam(null), []);
  assert.deepEqual(parseCardsParam(''), []);
  for (const bad of ['0', '-1', '1.5', '12a', '012', '10000', ',', '1,,2', Array.from({ length: 31 }, (_, i) => i + 1).join(',')]) {
    assert.equal(parseCardsParam(bad), null, bad);
  }
});

test('the Game end is rounded to 5 minutes', () => {
  const step = PUBLIC_FEED.gameEndRoundingMs;
  assert.equal(roundGameEnd(3 * step + 0.49 * step), 3 * step);
  assert.equal(roundGameEnd(3 * step + 0.51 * step), 4 * step);
  assert.equal(roundGameEnd(null), null);
});
