// «Cartrons venuts» (D234): adding sold cards to the cards in play, as the console sends them (`setCardsInPlay`).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { allInPlay, cardsToAdd } from '../../../../console/logic/cards-add.ts';

/** Printed cards 1–500 (the catalogue loaded). */
const PRINTED = { known: (id: number) => id >= 1 && id <= 500, max: 9999 };
/** The catalogue not loaded: anything up to `max`. */
const UNKNOWN = { known: () => null, max: 9999 };

test('nothing typed: no preview and nothing to send', () => {
  const a = cardsToAdd('1-210', '  ', PRINTED);
  assert.equal(a.empty, true);
  assert.equal(a.error, null);
  assert.equal(a.ranges, null);
});

test('a range adds to the cards in play, merged into compact ranges', () => {
  const a = cardsToAdd('1-210, 400-440', '441-450', PRINTED);
  assert.equal(a.error, null);
  assert.deepEqual(a.added, [441, 442, 443, 444, 445, 446, 447, 448, 449, 450]);
  assert.equal(a.addedRanges, '441-450');
  assert.equal(a.ranges, '1-210, 400-450');
  assert.equal(a.total, 261);
});

test('single numbers and en dashes; the ones in play already are counted, not added', () => {
  const a = cardsToAdd('1-210', '205, 300 – 302; 460', PRINTED);
  assert.equal(a.error, null);
  assert.equal(a.addedRanges, '300-302, 460');
  assert.equal(a.already, 1);
  assert.equal(a.ranges, '1-210, 300-302, 460');
});

test('with no cards in play yet, the typed ones are the list', () => {
  assert.equal(cardsToAdd('', '1-180', PRINTED).ranges, '1-180');
});

test('all in play already: refused', () => {
  const a = cardsToAdd('1-210', '5, 7-9', PRINTED);
  assert.deepEqual(a.error, { kind: 'already' });
  assert.equal(a.ranges, null);
});

test('numbers that are not printed cards are refused, named as ranges', () => {
  assert.deepEqual(cardsToAdd('1-210', '450, 4500-4502', PRINTED).error, { kind: 'unknown', ranges: '4500-4502', count: 3 });
  assert.deepEqual(cardsToAdd('1-210', '0', PRINTED).error, { kind: 'unknown', ranges: '0', count: 1 });
  // Without the catalogue only the highest card number bounds them.
  assert.equal(cardsToAdd('1-210', '4500', UNKNOWN).error, null);
  assert.deepEqual(cardsToAdd('1-210', '10000', UNKNOWN).error, { kind: 'unknown', ranges: '10000', count: 1 });
});

test('a typo is refused with the bad piece', () => {
  assert.deepEqual(cardsToAdd('1-210', '400-450, 45a', PRINTED).error, { kind: 'token', token: '45a' });
  assert.deepEqual(cardsToAdd('', '1-1000000', UNKNOWN).error, { kind: 'tooLarge', token: '1-1000000' });
});

test("an unreadable list in play is never overwritten", () => {
  assert.deepEqual(cardsToAdd('1-210, oops', '300', PRINTED).error, { kind: 'inPlay' });
});

test('a list that would no longer fit in one command is refused', () => {
  const odd = Array.from({ length: 250 }, (_, i) => i * 2 + 1).join(', ');
  const a = cardsToAdd(odd, '2, 600-700', { known: () => true, max: 9999 });
  assert.equal(a.error, null);
  const tooMany = Array.from({ length: 500 }, (_, i) => i * 2 + 1).join(', ');
  assert.deepEqual(cardsToAdd(tooMany, '2000', { known: () => true, max: 9999 }).error, { kind: 'tooLong' });
});

test('the engine took them once every added card is in its list', () => {
  assert.equal(allInPlay('1-210, 400-450', [441, 450]), true);
  assert.equal(allInPlay('1-210, 400-440', [441, 450]), false);
  assert.equal(allInPlay('nonsense', [1]), false);
});
