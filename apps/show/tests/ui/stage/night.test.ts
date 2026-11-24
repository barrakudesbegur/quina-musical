// Before the Game: the night's preview, each card type with the rounds it plays (model/night.ts).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { nightCardTypes } from '../../../../stage/model/night.ts';
import type { CardType, RoundPlan } from '../../../../../packages/ui/plan.ts';

const round = (number: number, kind: RoundPlan['kind']): RoundPlan => ({ number, kind, line: [], bingo: [] });
const TYPES: CardType[] = [
  { type: 'normal', name: 'Cartró normal', color: '#cfe8ff', priceCents: 200, rounds: ['normal'] },
  { type: 'especial', name: 'Cartró especial', color: '#ffd9e8', priceCents: 300, rounds: ['special'] },
];

test('each card type lists the regular rounds it plays, and whether it plays the Quina Especial', () => {
  const rounds = [round(1, 'normal'), round(2, 'normal'), round(3, 'normal'), round(4, 'special'), round(5, 'normal')];
  assert.deepEqual(nightCardTypes({ cardTypes: TYPES, rounds }), [
    { type: 'normal', label: 'Cartró normal', color: '#cfe8ff', priceCents: 200, regularRounds: [1, 2, 3, 5], special: false },
    { type: 'especial', label: 'Cartró especial', color: '#ffd9e8', priceCents: 300, regularRounds: [], special: true },
  ]);
});

test('rounds are listed in play order, whatever order the plan keeps them in', () => {
  const rounds = [round(3, 'normal'), round(1, 'normal'), round(2, 'normal')];
  assert.deepEqual(nightCardTypes({ cardTypes: TYPES, rounds })[0].regularRounds, [1, 2, 3]);
});

test('a card type that plays no round tonight is left out; no plan, no preview', () => {
  const rounds = [round(1, 'normal'), round(2, 'normal')];
  assert.deepEqual(nightCardTypes({ cardTypes: TYPES, rounds }).map((t) => t.type), ['normal']);
  assert.deepEqual(nightCardTypes({ cardTypes: TYPES, rounds: [] }), []);
  assert.deepEqual(nightCardTypes(null), []);
});
