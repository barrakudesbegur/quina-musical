// «Cartrons venuts» (D234): adding sold cards to the cards in play, as the console sends them (`addCardsInPlay`: the
// typed cards, merged by the engine), and the engine's answer (`cards.lastAdd`, or an `invalid` refusal).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { addAnswer, cardsToAdd, refusalError } from '../../../../console/logic/cards-add.ts';
import { S } from '../../../../console/strings.ts';

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

test('a range: the preview names the new cards, and only the typed ones are sent (the engine merges)', () => {
  const a = cardsToAdd('1-210, 400-440', '441-450', PRINTED);
  assert.equal(a.error, null);
  assert.deepEqual(a.added, [441, 442, 443, 444, 445, 446, 447, 448, 449, 450]);
  assert.equal(a.addedRanges, '441-450');
  assert.equal(a.ranges, '441-450');
});

test('single numbers and en dashes; the ones in play already are counted, and sent too (the engine names them)', () => {
  const a = cardsToAdd('1-210', '205, 300 – 302; 460', PRINTED);
  assert.equal(a.error, null);
  assert.equal(a.addedRanges, '300-302, 460');
  assert.equal(a.already, 1);
  assert.equal(a.ranges, '205, 300-302, 460');
});

test('with no cards in play yet, or a list this console cannot read, every typed card is new', () => {
  assert.equal(cardsToAdd('', '1-180', PRINTED).ranges, '1-180');
  const a = cardsToAdd('1-210, oops', '205', PRINTED);
  assert.equal(a.error, null);
  assert.equal(a.already, 0);
  assert.equal(a.ranges, '205');
});

test('all in play already: nothing to send', () => {
  const a = cardsToAdd('1-210', '5, 7-9', PRINTED);
  assert.deepEqual(a.error, { kind: 'already' });
  assert.equal(a.ranges, null);
});

test('numbers that are not printed cards are refused before sending, named as ranges', () => {
  assert.deepEqual(cardsToAdd('1-210', '450, 4500-4502', PRINTED).error, { kind: 'unknown', ranges: '4500-4502', count: 3 });
  assert.deepEqual(cardsToAdd('1-210', '0', PRINTED).error, { kind: 'unknown', ranges: '0', count: 1 });
  // Without the catalogue only the highest card number bounds them (the engine checks the rest).
  assert.equal(cardsToAdd('1-210', '4500', UNKNOWN).error, null);
  assert.deepEqual(cardsToAdd('1-210', '10000', UNKNOWN).error, { kind: 'unknown', ranges: '10000', count: 1 });
});

test('a typo is refused with the bad piece', () => {
  assert.deepEqual(cardsToAdd('1-210', '400-450, 45a', PRINTED).error, { kind: 'token', token: '45a' });
  assert.deepEqual(cardsToAdd('', '1-1000000', UNKNOWN).error, { kind: 'tooLarge', token: '1-1000000' });
});

test('an add whose merged list would no longer fit in one command is refused', () => {
  const odd = Array.from({ length: 250 }, (_, i) => i * 2 + 1).join(', ');
  assert.equal(cardsToAdd(odd, '2, 600-700', { known: () => true, max: 9999 }).error, null);
  const tooMany = Array.from({ length: 500 }, (_, i) => i * 2 + 1).join(', ');
  assert.deepEqual(cardsToAdd(tooMany, '2000', { known: () => true, max: 9999 }).error, { kind: 'tooLong' });
  // The typed cards alone, too.
  const typed = Array.from({ length: 500 }, (_, i) => i * 2 + 1).join(', ');
  assert.deepEqual(cardsToAdd('', typed, { known: () => true, max: 9999 }).error, { kind: 'tooLong' });
});

test("the engine's answer is this console's only when it names its reqId", () => {
  const lastAdd = { reqId: 'Tauleta-r12', added: '441-450', alreadyIn: '205' };
  assert.equal(addAnswer(lastAdd, 'Mobil_admin-r3'), null, "another console's");
  assert.equal(addAnswer(lastAdd, null), null, 'nothing sent');
  assert.equal(addAnswer(null, 'Tauleta-r12'), null);
  assert.deepEqual(addAnswer(lastAdd, 'Tauleta-r12'), { kind: 'added', added: '441-450', addedCount: 10, alreadyIn: '205', alreadyCount: 1 });
  assert.deepEqual(addAnswer({ reqId: 'x', added: '', alreadyIn: '441-450' }, 'x'), { kind: 'added', added: '', addedCount: 0, alreadyIn: '441-450', alreadyCount: 10 });
});

test("an invalid refusal names the numbers that aren't printed; other details read as they can", () => {
  assert.deepEqual(refusalError('4500-4502, 9000'), { kind: 'unknown', ranges: '4500-4502, 9000', count: 4 });
  assert.deepEqual(refusalError('the cards in play would no longer fit in 2000 characters'), { kind: 'tooLong' });
  assert.deepEqual(refusalError('no card numbers'), { kind: 'refused' });
  assert.deepEqual(refusalError(undefined), { kind: 'refused' });
});

test('the Notice says what joined, what was in already, and the cards in play now', () => {
  const none = { count: 0, ranges: '' };
  assert.equal(S.cardsAdd.done({ count: 10, ranges: '441-450' }, none, 261), "Afegits 10 cartrons (441-450). Ara n'hi ha 261 en joc.");
  assert.equal(S.cardsAdd.done({ count: 1, ranges: '460' }, { count: 1, ranges: '205' }, 252), "Afegit el 460; el 205 ja hi era. Ara n'hi ha 252 en joc.");
  assert.equal(S.cardsAdd.done({ count: 3, ranges: '300-302' }, { count: 2, ranges: '205-206' }, 254), "Afegits 3 cartrons (300-302); 2 ja hi eren (205-206). Ara n'hi ha 254 en joc.");
  assert.equal(S.cardsAdd.done(none, { count: 10, ranges: '441-450' }, 261), "Ja hi eren tots: 441-450. N'hi ha 261 en joc.");
  assert.equal(S.cardsAdd.done(none, { count: 1, ranges: '441' }, 261), "El 441 ja hi era. N'hi ha 261 en joc.");
});
