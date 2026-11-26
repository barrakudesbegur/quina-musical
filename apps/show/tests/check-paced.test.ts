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

test('the paced Check commands: checkNext names its step; checkAuto; the Review (checkReview, reviewEnd)', () => {
  assert.equal(errorOf(makeCommand('checkNext', { claimId: 'cl-1', step: 0 })), null);
  assert.match(errorOf(cmd('checkNext', { claimId: 'cl-1' }))!, /missing step/);
  assert.match(errorOf(cmd('checkNext', { claimId: 'cl-1', step: -1 }))!, /≥ 0/);
  assert.equal(errorOf(makeCommand('checkAuto', { on: true })), null);
  assert.match(errorOf(cmd('checkAuto', {}))!, /missing on/);
  assert.equal(errorOf(makeCommand('checkReview', { claimId: 'cl-1' })), null);
  for (const outcome of ['continue', 'win', 'lose', 'discard'] as const) assert.equal(errorOf(makeCommand('reviewEnd', { claimId: 'cl-1', outcome })), null);
  assert.match(errorOf(cmd('reviewEnd', { claimId: 'cl-1', outcome: 'restart' }))!, /must be one of/);
  // Reveals, auto, the Review and its end only in a Check: a Claim under review waits there with whatever was
  // playing (D118–D121); a Pausa by hand lets none of them through, as with every scene rule.
  const ctx = (scene: ShowScene, paused = false) => ({ scene, paused, introduced: false, celebrating: null });
  for (const name of ['checkNext', 'checkAuto', 'checkReview', 'reviewEnd'] as const) {
    assert.deepEqual((['before', 'play', 'check', 'celebration', 'interval'] as const).filter((s) => sceneAllows(name, ctx(s))), ['check'], name);
    assert.ok(!sceneAllows(name, ctx('check', true)), `${name} in a Pausa`);
  }
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
  const presses = [
    h.send('checkNext', { claimId: 'cl-1', step: 0 }), h.send('checkAuto', { on: true }),
    h.send('checkReview', { claimId: 'cl-1' }), h.send('reviewEnd', { claimId: 'cl-2', outcome: 'discard' }),
  ];
  for (const out of presses) assert.deepEqual(rejected(out), ['unknownCommand']);
  assert.deepEqual(replayJournal(journalOf(h.log)), h.show.record());
});

test('the Review in the journal: claim.reviewing, then claim.continued or claim.dropped, or a manual verdict', () => {
  const h = setup({ seed: 4, cards: allCards, cardsInPlay: '1-200', settings: { autoAdvance: false } });
  h.send('unlock');
  h.send('next');
  h.until(() => h.show.status === 'playing');
  h.send('claim', { cardIds: [5, 6, 7, 8] });
  const base = journalOf(h.log);
  const last = base.at(-1)!;
  const round = h.show.round.number;
  let seq = last.seq;
  type Body = { kind: 'claim.reviewing' | 'claim.continued' | 'claim.dropped'; claimId: string };
  const entry = (body: Body): JournalEntry => ({ gameId: last.gameId, seq: ++seq, atMs: last.atMs + 1000 * (seq - last.seq), round, ...body });
  const decided = (claimId: string, verdict: 'valid' | 'invalid'): JournalEntry => (
    { gameId: last.gameId, seq: ++seq, atMs: last.atMs + 1000 * (seq - last.seq), kind: 'claim.decided', round, claimId, verdict, winningSongId: null, position: 0, outcome: 'incomplete', manual: true });
  // cl-1 under review; cl-2 reviewed and discarded; cl-3 reviewed and continued; cl-4 reviewed and won by hand.
  const more = [
    entry({ kind: 'claim.reviewing', claimId: 'cl-1' }),
    entry({ kind: 'claim.reviewing', claimId: 'cl-2' }), entry({ kind: 'claim.dropped', claimId: 'cl-2' }),
    entry({ kind: 'claim.reviewing', claimId: 'cl-3' }), entry({ kind: 'claim.continued', claimId: 'cl-3' }),
    entry({ kind: 'claim.reviewing', claimId: 'cl-4' }), decided('cl-4', 'valid'),
  ];
  const record = replayJournal([...base, ...more]);
  assert.deepEqual(record.claims.map((c) => [c.claimId, c.verdict, c.reviewing ?? false]), [
    ['cl-1', null, true], ['cl-2', 'dropped', false], ['cl-3', null, false], ['cl-4', 'valid', false],
  ]);
  assert.deepEqual(record.winners.map((w) => w.claimId), ['cl-4'], 'a manual win makes a Winner');
  assert.deepEqual(extendJournal(replayJournal(base), more), record);

  // A show resumed from that record holds each Claim as it was.
  const r = setup({ seed: 9, cards: allCards, restore: record, startSec: 0.5 });
  assert.deepEqual(r.show.claims.map((c) => c.status), ['reviewing', 'dropped', 'queued', 'valid']);
  assert.deepEqual(r.show.record(), record);

  // Only a Claim under review continues or is discarded; nothing reviews a decided or dropped Claim.
  const refused = (body: Body, message: RegExp) =>
    assert.throws(() => extendJournal(record, [{ ...entry(body), seq: record.seq + 1 }]), (e: unknown) => e instanceof JournalError && message.test(e.message));
  refused({ kind: 'claim.continued', claimId: 'cl-3' }, /not under review/);
  refused({ kind: 'claim.dropped', claimId: 'cl-3' }, /not under review/);
  refused({ kind: 'claim.reviewing', claimId: 'cl-2' }, /already dropped/);
  refused({ kind: 'claim.reviewing', claimId: 'cl-4' }, /already decided/);
  refused({ kind: 'claim.reviewing', claimId: 'cl-9' }, /no claim/);
});
