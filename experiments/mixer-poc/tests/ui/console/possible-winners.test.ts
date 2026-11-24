// Possible winners: unsold cards are flagged only when the cards in play are known.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { FIXTURES } from '../../../ui/fixtures/states.ts';
import { cardsInPlay, isNotSold, possibleWinnersView } from '../../../console/logic/possible-winners.ts';

test('cards in play are parsed from the engine text; junk or empty means unknown', () => {
  const known = cardsInPlay('1-210, 400-440');
  assert.equal(known.error, false);
  assert.equal(known.ids?.size, 251);
  assert.deepEqual(cardsInPlay(''), { ids: null, error: false });
  assert.deepEqual(cardsInPlay('   '), { ids: null, error: false });
  assert.deepEqual(cardsInPlay(null), { ids: null, error: false });
  assert.deepEqual(cardsInPlay('1-10, abc'), { ids: null, error: true });
});

test('a card is "not registered as sold" only against known cards in play', () => {
  const inPlay = cardsInPlay('1-210');
  assert.equal(isNotSold(57, inPlay), false);
  assert.equal(isNotSold(300, inPlay), true);
  assert.equal(isNotSold(300, cardsInPlay('')), false);
  assert.equal(isNotSold(300, cardsInPlay('x')), false);
});

test('the fixture: both candidates are among the cards in play, with 1-based rows', () => {
  const s = FIXTURES.possibleWinners(0).state;
  const v = possibleWinnersView(s.possibleWinners, cardsInPlay(s.cards.inPlay));
  assert.deepEqual(v.line.map((c) => [c.cardId, c.rows, c.completedBy, c.notSold]), [
    [57, [3], 7, false],
    [204, [2], 7, false],
  ]);
  assert.equal(v.total, 2);
});

test('unsold candidates are flagged; Bingo candidates have no rows', () => {
  const v = possibleWinnersView(
    { line: [{ cardId: 999, lines: [0, 2], completedBy: 5 }], bingo: [{ cardId: 12, lines: [0, 1, 2], completedBy: 5 }] },
    cardsInPlay('1-100'),
  );
  assert.deepEqual(v.line[0], { cardId: 999, kind: 'line', rows: [1, 3], completedBy: 5, notSold: true });
  assert.deepEqual(v.bingo[0], { cardId: 12, kind: 'bingo', rows: [], completedBy: 5, notSold: false });
});
