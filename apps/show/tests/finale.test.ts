// The Desgraciat's finale (D161, D166–D171, D180): the presenters enter the finalists; at each landing those with that
// song fall, each on their own card; a landing that would take out everyone left counts for none of them, so the finale
// goes on until exactly one is left, the winner (never a shared win); Enrere brings a fall back; a removal by hand that
// leaves one makes that one the winner; the fanfare waits for the cue.
import { dataTest as test } from './support/data.ts';
import assert from 'node:assert/strict';
import { replayJournal, type JournalEntry } from '@quina/protocol';
import { FLOW } from '../engine/src/config.ts';
import { standingRun } from '../engine/src/game/cards.ts';
import type { Effect } from '../engine/src/show/show.ts';
import { setup, allCards, type Harness } from './support/harness.ts';

const journalOf = (effects: readonly Effect[]): JournalEntry[] => effects.flatMap((e) => (e.type === 'journal' ? [e.entry] : []));
const rejected = (effects: readonly Effect[]) => effects.flatMap((e) => (e.type === 'reject' ? [`${e.reason}${e.detail ? `: ${e.detail}` : ''}`] : []));

function desgraciat(seed = 11): Harness {
  const h = setup({ seed, cards: allCards, cardsInPlay: '400-459', settings: { autoAdvance: false } });
  h.send('unlock');
  h.send('roundIntro', { number: 4, kind: 'desgraciat' });
  h.send('newRound');
  h.advance(FLOW.shuffleSec + 0.1);
  return h;
}

function land(h: Harness, count: number) {
  for (let i = 0; i < count; i++) {
    const position = h.show.position;
    h.send('next');
    h.until(() => h.show.position === position + 1 && h.show.status === 'playing');
  }
}

/** Where each of the round's valid cards falls on the whole Queue (the last one standing never does: Infinity). */
function fallsOf(h: Harness): Map<number, number> {
  const run = standingRun(h.show.phaseModel.valid, h.show.queue);
  return new Map(h.show.phaseModel.valid.map((c) => [c.id, run.fallAt.get(c.id) ?? Infinity]));
}

test('the finale: finalists fall one by one, the last one standing wins; Enrere brings a fall back; the cue starts the Celebration', () => {
  const h = desgraciat();
  land(h, 2);
  const falls = fallsOf(h);
  // Four standing cards that fall on three different later landings, the last two apart.
  const standing = h.show.standingNow().map((c) => c.id).sort((a, b) => falls.get(a)! - falls.get(b)!);
  const distinct = standing.filter((id, i) => i === 0 || falls.get(id) !== falls.get(standing[i - 1]));
  const finalists = distinct.slice(-4);
  assert.equal(finalists.length, 4);
  const setOut = h.send('finale', { cardIds: finalists });
  assert.deepEqual(rejected(setOut), []);
  assert.deepEqual(journalOf(setOut).map((e) => e.kind === 'finale.set' && e.cardIds), [finalists]);
  assert.deepEqual(h.show.snapshot().finale && [h.show.snapshot().finale?.standing, h.show.snapshot().finale?.fallen, h.show.snapshot().finale?.winner], [finalists, [], null]);
  // Land to the first finalist's fall: it goes out, as a group of one.
  const firstFall = falls.get(finalists[0])!;
  land(h, firstFall - h.show.position);
  const after1 = h.show.finaleInfo()!;
  assert.deepEqual(after1.fallen.map((f) => [f.cardId, f.position]), [[finalists[0], firstFall]]);
  assert.equal(after1.fallen[0].songId, h.show.queue[firstFall]);
  // Enrere brings it back.
  h.send('back');
  assert.deepEqual(h.show.finaleInfo()?.fallen, []);
  h.send('next');
  h.until(() => h.show.position === firstFall && h.show.status === 'playing');
  // On to the third finalist's fall: one is left, and wins; nothing advances by itself; Next waits for the cue.
  land(h, falls.get(finalists[2])! - h.show.position);
  const won = h.show.finaleInfo()!;
  assert.equal(won.winner?.cardId, finalists[3]);
  assert.deepEqual([won.winner?.position, won.winner?.byHand], [falls.get(finalists[2]), undefined]);
  assert.equal(won.standing.length, 1);
  assert.equal(h.show.autoAdvanceAllowed(), false);
  assert.deepEqual(rejected(h.send('next')), ['finaleDecided: the finale has its winner: the cue comes first']);
  assert.equal(h.show.scene, 'play', 'no fanfare before the cue');
  const cue = h.send('finaleCue');
  assert.equal(h.show.scene, 'celebration');
  assert.equal(h.show.celebration?.kind, 'standing');
  assert.deepEqual(h.show.winners.map((w) => [w.cardId, w.kind]), [[finalists[3], 'standing']]);
  assert.deepEqual(journalOf(cue).map((e) => e.kind), ['claim.opened', 'claim.decided', 'scene.changed']);
  assert.ok(journalOf(cue).every((e) => e.kind !== 'claim.decided' || e.manual === undefined), 'decided by the song, not by hand');
  assert.equal(h.show.snapshot().finale?.cued, true);
  // The journal replays to the show, and a restarted page comes back with the finale.
  const record = replayJournal(journalOf(h.log));
  assert.deepEqual(record, h.show.record());
  const r = setup({ seed: 5, cards: allCards, restore: record, startSec: 0.5 });
  assert.deepEqual(r.show.finale?.cardIds, finalists);
  assert.equal(r.show.finaleInfo()?.cued, true);
});

test('D180: a landing that would take out every finalist left counts for none of them; the finale goes on to exactly one', () => {
  const h = desgraciat(13);
  land(h, 1);
  const falls = fallsOf(h);
  const standing = h.show.standingNow().map((c) => c.id);
  // Two standing cards that fall on the same later landing.
  const byFall = new Map<number, number[]>();
  for (const id of standing) byFall.set(falls.get(id)!, [...(byFall.get(falls.get(id)!) ?? []), id]);
  const pair = [...byFall.entries()].filter(([p, ids]) => Number.isFinite(p) && ids.length >= 2).sort((a, b) => a[0] - b[0])[0];
  assert.ok(pair, 'two cards that fall together');
  const [p, ids] = pair;
  const two = ids.slice(0, 2);
  h.send('finale', { cardIds: two });
  land(h, p - h.show.position);
  const both = h.show.finaleInfo()!;
  assert.deepEqual([both.fallen, both.standing, both.winner], [[], two, null], 'both stay in: no shared win');
  // The finale goes on until a landing takes out one of them alone; the other wins.
  const run = standingRun(h.show.phaseModel.valid.filter((c) => two.includes(c.id)), h.show.queue);
  const [outId, outAt] = [...run.fallAt.entries()][0];
  assert.ok(outAt > p);
  land(h, outAt - h.show.position);
  const won = h.show.finaleInfo()!;
  assert.deepEqual(won.fallen.map((f) => [f.cardId, f.position]), [[outId, outAt]]);
  assert.equal(won.winner?.cardId, two.find((id) => id !== outId));
  h.send('finaleCue');
  assert.deepEqual(h.show.celebration?.cardIds, [won.winner?.cardId], 'one winner');
  assert.deepEqual(replayJournal(journalOf(h.log)), h.show.record());
});

test('the finale: entering finalists privately checked, removals by hand, and a removal that leaves one makes the winner', () => {
  const h = desgraciat();
  land(h, 3);
  const standing = h.show.standingNow().map((c) => c.id);
  const fallen = h.show.phaseModel.valid.map((c) => c.id).find((id) => !standing.includes(id));
  const normal = allCards.find((c) => c.type === 'normal')!.id;
  assert.ok(fallen != null);
  assert.deepEqual(rejected(h.send('finale', { cardIds: [standing[0]] })), ['invalid: a finale starts with two finalists or more']);
  assert.deepEqual(rejected(h.send('finale', { cardIds: [standing[0], 9999] })), ['unknownCard: 9999']);
  assert.deepEqual(rejected(h.send('finale', { cardIds: [standing[0], normal] })), [`invalid: not a card of this round: ${normal}`]);
  assert.deepEqual(rejected(h.send('finale', { cardIds: [standing[0], fallen] })), [`invalid: already fallen: ${fallen}`], 'D168: a fallen card isn\'t added');
  const three = standing.slice(0, 3);
  h.send('finale', { cardIds: three });
  // Removing one, then bringing it back.
  h.send('finale', { cardIds: three.slice(0, 2) });
  assert.deepEqual(h.show.finaleInfo()?.standing, three.slice(0, 2));
  h.send('finale', { cardIds: three });
  assert.equal(h.show.finaleInfo()?.winner, null);
  // A removal that leaves one: that one wins, by hand.
  const out = h.send('finale', { cardIds: [three[1]] });
  assert.ok(journalOf(out).some((e) => e.kind === 'finale.set' && e.byHand === true));
  const winner = h.show.finaleInfo()?.winner;
  assert.deepEqual([winner?.cardId, winner?.byHand], [three[1], true]);
  const cue = h.send('finaleCue');
  assert.ok(journalOf(cue).some((e) => e.kind === 'claim.decided' && e.manual === true), 'a decision by hand, flagged');
  // Calling a finale off, and none in a normal round.
  const n = setup({ seed: 3, cards: allCards, cardsInPlay: '1-60', settings: { autoAdvance: false } });
  n.send('unlock');
  land(n, 1);
  assert.deepEqual(rejected(n.send('finale', { cardIds: [1, 2] })), ['invalid: a normal round has no finale']);
  assert.deepEqual(replayJournal(journalOf(h.log)), h.show.record());
});
