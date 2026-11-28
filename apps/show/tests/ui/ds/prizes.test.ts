// C2's prize recipes (D-p): the card's words top to bottom and the kind chip's palette, shared by the phone and the
// console.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PRIZE_COLOR, prizeCardText, ticketRibbon } from '../../../../../packages/ui/recipes/prizes.ts';

test('the kind chip: the Line gold, the Bingo orange, the last card standing green', () => {
  assert.deepEqual(PRIZE_COLOR, { line: 'gold', bingo: 'orange', standing: 'green' });
  assert.deepEqual(ticketRibbon('bingo'), { label: 'Quina', color: 'orange' });
});

test('a prize card: the prize first, then the sponsor, then how many more; the kind is the chip', () => {
  const text = prizeCardText({ kind: 'line', headline: [{ title: 'Entrada al spa per a 2', detail: 'Dissabte', sponsor: '[Patrocinador 1]' }], more: 4 });
  assert.deepEqual(text, {
    chip: 'Premi de línia',
    color: 'gold',
    title: 'Entrada al spa per a 2',
    detail: 'Dissabte',
    sponsor: 'Gentilesa de [Patrocinador 1]',
    more: 'i 4 premis més',
  });
});

test('several headline prizes: one title, no detail, each sponsor once; nothing more says nothing', () => {
  const text = prizeCardText({
    kind: 'bingo',
    headline: [
      { title: 'Sopar per a dos', detail: 'Menú', sponsor: 'Can Pep' },
      { title: 'Pernil', detail: null, sponsor: 'Can Pep' },
    ],
    more: 0,
  });
  assert.equal(text.title, 'Sopar per a dos · Pernil');
  assert.equal(text.detail, null);
  assert.equal(text.sponsor, 'Gentilesa de Can Pep');
  assert.equal(text.more, null);
});
