// The presenter-paced Check (D107–D110): the protocol's commands, scene rules and journal entries, a claim of
// several cards, and the Review in the journal. tests/flow.test.ts plays the Check itself, press by press.
import { dataTest as test } from './support/data.ts';
import assert from 'node:assert/strict';
import { checkCommand, extendJournal, makeCommand, replayJournal, sceneAllows, JournalError, type JournalEntry, type ShowScene } from '@quina/protocol';
import type { Effect } from '../engine/src/show/show.ts';
import { setup, allCards } from './support/harness.ts';
import { computeCheck } from '../engine/src/game/check.ts';

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
  assert.equal(errorOf(makeCommand('checkBack', { claimId: 'cl-1', step: 2 })), null);
  assert.match(errorOf(cmd('checkBack', { claimId: 'cl-1' }))!, /missing step/);
  for (const name of ['checkNext', 'checkBack', 'checkAuto', 'checkReview', 'reviewEnd'] as const) {
    assert.deepEqual((['before', 'play', 'check', 'celebration', 'interval'] as const).filter((s) => sceneAllows(name, ctx(s))), ['check'], name);
    assert.ok(!sceneAllows(name, ctx('check', true)), `${name} in a Pausa`);
  }
});

test('a claim of several cards opens one Claim each, in order; the first one\'s Check on screen, the others queued', () => {
  const h = setup({ seed: 3, cards: allCards, cardsInPlay: '1-200', settings: { autoAdvance: false } });
  h.send('unlock');
  h.send('next');
  h.until(() => h.show.status === 'playing');
  h.send('claim', { cardIds: [17, 3, 150] });
  assert.equal(h.show.scene, 'check');
  assert.deepEqual(h.show.claims.map((c) => c.cardId), [17, 3, 150]);
  assert.deepEqual(journalOf(h.log).filter((e) => e.kind === 'claim.opened').map((e) => (e.kind === 'claim.opened' ? e.cardId : 0)), [17, 3, 150]);
  assert.deepEqual(h.show.claims.map((c) => c.status), ['checking', 'queued', 'queued']);
  assert.equal(h.show.check?.info.claimId, 'cl-1');
  assert.deepEqual(rejected(h.send('reviewEnd', { claimId: 'cl-2', outcome: 'discard' })), ['invalid'], 'only a Claim under review');
  assert.deepEqual(replayJournal(journalOf(h.log)), h.show.record());
});

test('the Review in the journal: claim.reviewing, then claim.continued or claim.discarded, or a manual verdict', () => {
  const h = setup({ seed: 4, cards: allCards, cardsInPlay: '1-200', settings: { autoAdvance: false } });
  h.send('unlock');
  h.send('next');
  h.until(() => h.show.status === 'playing');
  h.send('claim', { cardIds: [5, 6, 7, 8] });
  const base = journalOf(h.log);
  const last = base.at(-1)!;
  const round = h.show.round.number;
  let seq = last.seq;
  type Body = { kind: 'claim.reviewing' | 'claim.continued' | 'claim.discarded'; claimId: string };
  const entry = (body: Body): JournalEntry => ({ gameId: last.gameId, seq: ++seq, atMs: last.atMs + 1000 * (seq - last.seq), round, ...body });
  const decided = (claimId: string, verdict: 'valid' | 'invalid'): JournalEntry => (
    { gameId: last.gameId, seq: ++seq, atMs: last.atMs + 1000 * (seq - last.seq), kind: 'claim.decided', round, claimId, verdict, winningSongId: null, position: 0, outcome: 'incomplete', manual: true });
  // cl-1 under review; cl-2 reviewed and discarded; cl-3 reviewed and continued; cl-4 reviewed and won by hand.
  const more = [
    entry({ kind: 'claim.reviewing', claimId: 'cl-1' }),
    entry({ kind: 'claim.reviewing', claimId: 'cl-2' }), entry({ kind: 'claim.discarded', claimId: 'cl-2' }),
    entry({ kind: 'claim.reviewing', claimId: 'cl-3' }), entry({ kind: 'claim.continued', claimId: 'cl-3' }),
    entry({ kind: 'claim.reviewing', claimId: 'cl-4' }), decided('cl-4', 'valid'),
  ];
  const record = replayJournal([...base, ...more]);
  assert.deepEqual(record.claims.map((c) => [c.claimId, c.verdict, c.reviewing ?? false]), [
    ['cl-1', null, true], ['cl-2', 'discarded', false], ['cl-3', null, false], ['cl-4', 'valid', false],
  ]);
  assert.deepEqual(record.winners.map((w) => w.claimId), ['cl-4'], 'a manual win makes a Winner');
  assert.deepEqual(extendJournal(replayJournal(base), more), record);

  // A show resumed from that record holds each Claim as it was.
  const r = setup({ seed: 9, cards: allCards, restore: record, startSec: 0.5 });
  assert.deepEqual(r.show.claims.map((c) => c.status), ['reviewing', 'discarded', 'queued', 'valid']);
  assert.deepEqual(r.show.record(), record);

  // Only a Claim under review continues or is discarded; nothing reviews a decided or discarded Claim.
  const refused = (body: Body, message: RegExp) =>
    assert.throws(() => extendJournal(record, [{ ...entry(body), seq: record.seq + 1 }]), (e: unknown) => e instanceof JournalError && message.test(e.message));
  refused({ kind: 'claim.continued', claimId: 'cl-3' }, /not under review/);
  refused({ kind: 'claim.discarded', claimId: 'cl-3' }, /not under review/);
  refused({ kind: 'claim.reviewing', claimId: 'cl-2' }, /already discarded/);
  refused({ kind: 'claim.reviewing', claimId: 'cl-4' }, /already decided/);
  refused({ kind: 'claim.reviewing', claimId: 'cl-9' }, /no claim/);
});

test("D121: a Claim under review whose Check left the screen comes back where it was: its marks, no snippet replayed, the next reveal on a press", () => {
  const h = setup({ seed: 3, cards: allCards, cardsInPlay: '1-200', settings: { autoAdvance: false } });
  h.send('unlock');
  for (let i = 0; i < 16; i++) {
    const p = h.show.position;
    h.send('next');
    h.until(() => h.show.position === p + 1 && h.show.status === 'playing');
  }
  // A card whose Line Check reveals at least three songs, and another card.
  const valid = h.show.phaseModel.valid;
  const target = valid.find((c) => computeCheck({ allCards, cardId: c.id, kind: 'line', cardType: 'normal', cardsInPlay: new Set(h.show.cardsInPlay), queue: h.show.queue, position: h.show.position }).revealUntil! >= 2);
  assert.ok(target, 'a card with three landed songs at the front of its row');
  const other = valid.find((c) => c.id !== target.id)!;
  h.send('claim', { cardIds: [target.id, other.id], kind: 'line' });
  const [a, b] = h.show.claims.map((c) => c.claimId);
  h.send('checkNext', { claimId: a, step: 0 });
  h.send('checkNext', { claimId: a, step: 1 });
  h.advance(4);
  assert.equal(h.show.check?.info.revealed.length, 2);
  h.send('checkReview', { claimId: a });
  // Meanwhile the other card's Check takes the screen.
  assert.deepEqual(rejected(h.send('checkStart', { claimId: b })), []);
  assert.equal(h.show.check?.info.claimId, b);
  // Continuing the Review brings it back with its two marks, the music far down, and nothing replayed.
  const out = h.send('reviewEnd', { claimId: a, outcome: 'continue' });
  const started = out.flatMap((e) => (e.type === 'emit' && e.message.type === 'check.started' ? [e.message.check] : []));
  assert.deepEqual(started.map((c) => [c.claimId, c.revealed.length]), [[a, 2]]);
  assert.ok(out.some((e) => e.type === 'checkDuck' && e.on), 'far down, as before it left the screen');
  assert.ok(!out.some((e) => e.type === 'checkReveal'), 'no snippet replayed');
  assert.equal(h.show.check?.awaitPress, true);
  // The next press reveals the third song.
  const next = h.send('checkNext', { claimId: a, step: 2 });
  assert.equal(next.flatMap((e) => (e.type === 'emit' && e.message.type === 'check.revealed' ? [e.message.index] : [])).at(0), 2);
  assert.deepEqual(replayJournal(journalOf(h.log)), h.show.record());
});
