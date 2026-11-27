// Several consoles at once (D234): the presenters' tablet, the tech's laptop, a Wii's console. Adding sold cards
// merges, so two consoles adding at the same moment keep both.
import nodeTest from 'node:test';
import { dataTest as test } from './support/data.ts';
import assert from 'node:assert/strict';
import { formatCardRanges, makeCommand, parseCardRanges, replayJournal, type JournalEntry } from '@quina/protocol';
import type { Effect } from '../engine/src/show/show.ts';
import { allCards, setup } from './support/harness.ts';

const rejected = (effects: readonly Effect[]) => effects.filter((e) => e.type === 'reject').map((e) => e.reason);
const rejection = (effects: readonly Effect[]) => effects.find((e) => e.type === 'reject');
const journalOf = (effects: readonly Effect[]): JournalEntry[] => effects.flatMap((e) => (e.type === 'journal' ? [e.entry] : []));
const cardsOf = (h: ReturnType<typeof setup>) => h.show.snapshot().cards;

nodeTest('formatCardRanges writes sorted ids back as ranges that parseCardRanges reads the same', () => {
  assert.equal(formatCardRanges([1, 2, 3, 7, 9, 10]), '1-3, 7, 9-10');
  assert.equal(formatCardRanges([]), '');
  const ids = parseCardRanges('400-450, 1-100, 452 460');
  assert.deepEqual(parseCardRanges(formatCardRanges(ids)), ids);
});

test('D234: addCardsInPlay merges into the cards in play; two adds in a row keep both', () => {
  const h = setup({ seed: 3, cards: allCards, cardsInPlay: '1-100' });
  h.send('unlock');
  h.send('addCardsInPlay', { ranges: '400-450' });
  // The second console's add, sent before it saw the first one's: both stay.
  h.send('addCardsInPlay', { ranges: '452, 460' });
  assert.equal(cardsOf(h).inPlay, '1-100, 400-450, 452, 460');
  assert.equal(cardsOf(h).inPlayCount, 100 + 51 + 2);
  assert.deepEqual(h.show.cardsInPlay, parseCardRanges('1-100, 400-450, 452, 460'));
});

test('D234: addCardsInPlay refuses numbers that aren’t printed, whole, and nothing changes', () => {
  const h = setup({ seed: 3, cards: allCards, cardsInPlay: '1-100' });
  h.send('unlock');
  const max = Math.max(...allCards.map((c) => c.id));
  const out = h.send('addCardsInPlay', { ranges: `200, ${max + 1}-${max + 3}` });
  assert.deepEqual(rejected(out), ['invalid']);
  assert.equal(rejection(out)?.type === 'reject' && rejection(out)?.detail, `${max + 1}-${max + 3}`, 'the unprinted numbers, as ranges');
  assert.deepEqual(journalOf(out), []);
  assert.equal(cardsOf(h).inPlay, '1-100');
  assert.deepEqual(rejected(h.send('addCardsInPlay', { ranges: '12a' })), ['invalid'], 'not a range');
  assert.deepEqual(rejected(h.dispatch({ v: 1, type: 'cmd', cmd: 'addCardsInPlay', reqId: 'r', ranges: '' })), ['invalid'], 'empty');
  assert.deepEqual(rejected(h.send('addCardsInPlay', { ranges: ' , ' })), ['invalid'], 'no numbers');
  assert.equal(cardsOf(h).lastAdd, null);
});

test('D234: addCardsInPlay reports the numbers already in play in the state, for the console that sent it', () => {
  const h = setup({ seed: 3, cards: allCards, cardsInPlay: '1-100' });
  h.send('unlock');
  const add = makeCommand('addCardsInPlay', { ranges: '95-105' });
  h.dispatch(add);
  assert.deepEqual(cardsOf(h).lastAdd, { reqId: add.reqId, added: '101-105', alreadyIn: '95-100' });
  // Everything in already (another console added them a moment before): nothing changes, nothing journaled.
  const again = makeCommand('addCardsInPlay', { ranges: '101-105' });
  const out = h.dispatch(again);
  assert.deepEqual(rejected(out), []);
  assert.deepEqual(journalOf(out), []);
  assert.deepEqual(cardsOf(h).lastAdd, { reqId: again.reqId, added: '', alreadyIn: '101-105' });
  assert.equal(cardsOf(h).inPlay, '1-105');
});

test('D234: addCardsInPlay is journaled as cards.set with the merged list, as setCardsInPlay is, and replays', () => {
  const h = setup({ seed: 3, cards: allCards, cardsInPlay: '1-100' });
  h.send('unlock');
  const [added] = journalOf(h.send('addCardsInPlay', { ranges: '400-450' })).filter((e) => e.kind === 'cards.set');
  const [set] = journalOf(h.send('setCardsInPlay', { ranges: '1-100, 400-450' })).filter((e) => e.kind === 'cards.set');
  const shape = (e: JournalEntry) => Object.keys(e).sort();
  assert.deepEqual(shape(added), shape(set));
  assert.deepEqual([added.kind === 'cards.set' && added.ranges, set.kind === 'cards.set' && set.ranges], ['1-100, 400-450', '1-100, 400-450']);
  h.send('addCardsInPlay', { ranges: '460' });
  const record = replayJournal(journalOf(h.log));
  assert.equal(record.cardsInPlay, '1-100, 400-450, 460');
  assert.equal(setup({ seed: 4, cards: allCards, restore: record }).show.snapshot().cards.inPlay, '1-100, 400-450, 460');
});
