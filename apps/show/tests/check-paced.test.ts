// The presenter-paced Check (D107–D110), step 1: the protocol's commands, scene rules and journal entries, and
// the engine taking a claim of several cards. The engine plays the Check by presses in a later step; until then
// it refuses checkNext, checkAuto, checkStop and claimDrop clearly.
import { dataTest as test } from './support/data.ts';
import assert from 'node:assert/strict';
import { checkCommand, extendJournal, makeCommand, replayJournal, sceneAllows, JournalError, type JournalEntry, type ShowScene } from '@quina/protocol';
import type { Effect } from '../engine/src/show/show.ts';
import { setup, allCards } from './support/harness.ts';

const journalOf = (effects: readonly Effect[]): JournalEntry[] => effects.flatMap((e) => (e.type === 'journal' ? [e.entry] : []));
const rejected = (effects: readonly Effect[]) => effects.flatMap((e) => (e.type === 'reject' ? [e.reason] : []));
const cmd = (name: string, fields: Record<string, unknown>) => ({ v: 1, type: 'cmd', cmd: name, reqId: 'r', ...fields });
const errorOf = (message: unknown) => {
  const check = checkCommand(message);
  return check.ok ? null : check.error;
};

test('claim takes one card or several (cardIds: 1–10 distinct card numbers), never both', () => {
  assert.equal(errorOf(cmd('claim', { cardId: 7 })), null);
  assert.equal(errorOf(cmd('claim', { cardIds: [7, 400, 12], kind: 'bingo' })), null);
  assert.match(errorOf(cmd('claim', { cardId: 7, cardIds: [8] }))!, /exactly one/);
  assert.match(errorOf(cmd('claim', {}))!, /exactly one/);
  assert.match(errorOf(cmd('claim', { cardIds: [] }))!, /non-empty list/);
  assert.match(errorOf(cmd('claim', { cardIds: Array.from({ length: 11 }, (_, i) => i + 1) }))!, /more than 10/);
  assert.match(errorOf(cmd('claim', { cardIds: [3, 3] }))!, /repeats/);
  assert.match(errorOf(cmd('claim', { cardIds: [0] }))!, /≥ 1/);
  assert.match(errorOf(cmd('claim', { cardIds: [2.5] }))!, /integer/);
  assert.match(errorOf(cmd('claim', { cardIds: '7' }))!, /list/);
});

test('the paced Check commands: checkNext names its step; checkAuto, checkStop and claimDrop', () => {
  assert.equal(errorOf(makeCommand('checkNext', { claimId: 'cl-1', step: 0 })), null);
  assert.match(errorOf(cmd('checkNext', { claimId: 'cl-1' }))!, /missing step/);
  assert.match(errorOf(cmd('checkNext', { claimId: 'cl-1', step: -1 }))!, /≥ 0/);
  assert.equal(errorOf(makeCommand('checkAuto', { on: true })), null);
  assert.match(errorOf(cmd('checkAuto', {}))!, /missing on/);
  assert.equal(errorOf(makeCommand('checkStop', { claimId: 'cl-1' })), null);
  assert.equal(errorOf(makeCommand('claimDrop', { claimId: 'cl-1' })), null);
  // Reveals, auto, stop and drop only in a Check: a stopped Claim waits there with whatever was playing (D118); a
  // Pausa by hand lets none of them through, as with every scene rule.
  const ctx = (scene: ShowScene, paused = false) => ({ scene, paused, introduced: false, celebrating: null });
  for (const name of ['checkNext', 'checkAuto', 'checkStop'] as const) {
    assert.deepEqual((['play', 'check', 'celebration'] as const).filter((s) => sceneAllows(name, ctx(s))), ['check'], name);
  }
  assert.deepEqual((['before', 'play', 'check', 'celebration', 'interval'] as const).filter((s) => sceneAllows('claimDrop', ctx(s))), ['check']);
  for (const name of ['checkNext', 'checkAuto', 'checkStop', 'checkStart', 'claimDrop'] as const) assert.ok(!sceneAllows(name, ctx('check', true)), name);
});

test('a claim of several cards opens one Claim each, in order; the engine refuses the paced commands until it plays them', () => {
  const h = setup({ seed: 3, cards: allCards, cardsInPlay: '1-200', settings: { autoAdvance: false } });
  h.send('unlock');
  h.send('next');
  h.until(() => h.show.status === 'playing');
  h.send('claim', { cardIds: [17, 3, 150] });
  assert.equal(h.show.scene, 'check');
  assert.deepEqual(h.show.claims.map((c) => c.cardId), [17, 3, 150]);
  assert.deepEqual(journalOf(h.log).filter((e) => e.kind === 'claim.opened').map((e) => (e.kind === 'claim.opened' ? e.cardId : 0)), [17, 3, 150]);
  for (const out of [h.send('checkNext', { claimId: 'cl-1', step: 0 }), h.send('checkAuto', { on: true }), h.send('checkStop', { claimId: 'cl-1' }), h.send('claimDrop', { claimId: 'cl-2' })]) {
    assert.deepEqual(rejected(out), ['unknownCommand']);
  }
  assert.deepEqual(replayJournal(journalOf(h.log)), h.show.record());
});

test('claim.stopped and claim.dropped: replayed, extended and resumed alike; a decided or dropped Claim refuses them', () => {
  const h = setup({ seed: 4, cards: allCards, cardsInPlay: '1-200', settings: { autoAdvance: false } });
  h.send('unlock');
  h.send('next');
  h.until(() => h.show.status === 'playing');
  h.send('claim', { cardIds: [5, 6, 7] });
  const base = journalOf(h.log);
  const last = base.at(-1)!;
  const round = h.show.round.number;
  const entry = (n: number, body: { kind: 'claim.stopped' | 'claim.dropped'; claimId: string }): JournalEntry =>
    ({ gameId: last.gameId, seq: last.seq + n, atMs: last.atMs + 1000 * n, round, ...body });
  const more = [entry(1, { kind: 'claim.stopped', claimId: 'cl-1' }), entry(2, { kind: 'claim.dropped', claimId: 'cl-2' })];
  const record = replayJournal([...base, ...more]);
  assert.deepEqual(record.claims.map((c) => [c.claimId, c.verdict, c.stopped ?? false]), [['cl-1', null, true], ['cl-2', 'dropped', false], ['cl-3', null, false]]);
  assert.deepEqual(extendJournal(replayJournal(base), more), record);

  // A show resumed from that record holds the stopped and the dropped Claim as they were.
  const r = setup({ seed: 9, cards: allCards, restore: record, startSec: 0.5 });
  assert.deepEqual(r.show.claims.map((c) => c.status), ['stopped', 'dropped', 'queued']);
  assert.deepEqual(r.show.record(), record);

  // A later verdict clears the stop; nothing may stop or drop a decided or dropped Claim.
  const decided = extendJournal(record, [{ gameId: last.gameId, seq: last.seq + 3, atMs: last.atMs + 3000, kind: 'claim.decided', round, claimId: 'cl-1', verdict: 'invalid', winningSongId: null, position: 0 }]);
  assert.deepEqual(decided.claims.map((c) => [c.verdict, c.stopped ?? false]), [['invalid', false], ['dropped', false], [null, false]]);
  assert.throws(() => extendJournal(decided, [entry(4, { kind: 'claim.stopped', claimId: 'cl-1' })]), JournalError);
  assert.throws(() => extendJournal(record, [entry(3, { kind: 'claim.dropped', claimId: 'cl-2' })]), (e: unknown) => e instanceof JournalError && /already dropped/.test(e.message));
  assert.throws(() => extendJournal(record, [entry(3, { kind: 'claim.stopped', claimId: 'cl-9' })]), JournalError);
});
