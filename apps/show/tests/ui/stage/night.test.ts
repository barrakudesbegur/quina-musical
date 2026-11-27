// Before the Game: the night's preview, each card type with the rounds it plays (model/night.ts): which rounds from
// each round's card type, names, colours and prices from card-types.json.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { defaultCardType } from '@quina/protocol';
import { ballsPerRow, nightCardTypes } from '../../../../stage/model/night.ts';
import { UNKNOWN_CARD_TYPE_COLOR, knownCardTypes, type PrintedCardType } from '../../../../../packages/ui/data/card-types.ts';
import { SAMPLE_PLAN } from '../../../../../packages/ui/fixtures/plan.ts';
import type { RoundPlan } from '../../../../../packages/ui/plan.ts';

const round = (number: number, kind: RoundPlan['kind'], cardType?: string): RoundPlan => ({ number, kind, ...(cardType ? { cardType } : {}), line: [], bingo: [] });
const TYPES: PrintedCardType[] = [
  { type: 'normal', name: 'Cartró normal', color: '#cfe8ff', title: '', priceCents: 200 },
  { type: 'especial', name: 'Cartró especial', color: '#ffd9e8', title: '', priceCents: 300 },
  { type: 'desgraciat', name: 'Cartró desgraciat', color: '#d8f0c8', title: '', priceCents: 100 },
];

test('each card type lists the regular rounds it plays by Quina number (round 5, after the Especial, is Quina 4), and whether it plays the Quina Especial', () => {
  const rounds = [round(1, 'normal', 'normal'), round(2, 'normal', 'normal'), round(3, 'normal', 'normal'), round(4, 'special', 'especial'), round(5, 'normal', 'normal')];
  assert.deepEqual(nightCardTypes({ rounds }, TYPES), [
    { type: 'normal', label: 'Cartró normal', color: '#cfe8ff', priceCents: 200, regularRounds: [1, 2, 3, 4], special: false, desgraciat: false },
    { type: 'especial', label: 'Cartró especial', color: '#ffd9e8', priceCents: 300, regularRounds: [], special: true, desgraciat: false },
  ]);
});

test('the Quina Desgraciada is its own entry (its sad-face pill), not one of the numbered rounds', () => {
  const night = (desgraciatType: string) =>
    nightCardTypes({ rounds: [round(1, 'normal'), round(2, 'desgraciat', desgraciatType), round(3, 'normal'), round(4, 'special')] }, TYPES).map((t) => [t.type, t.regularRounds, t.special, t.desgraciat]);
  assert.deepEqual(night('normal'), [
    ['normal', [1, 2], false, true],
    ['especial', [], true, false],
  ]);
  // D70: the special card plays both the Especial and the Desgraciat (as in 2025), so its band gets both pills.
  assert.deepEqual(night('especial'), [
    ['normal', [1, 2], false, false],
    ['especial', [], true, true],
  ]);
  // The sample plan: round 5 is the Desgraciat round (its kind's default type), round 7 the Especial.
  const d = defaultCardType('desgraciat');
  assert.deepEqual(
    nightCardTypes(SAMPLE_PLAN, TYPES).map((t) => [t.type, t.regularRounds, t.special, t.desgraciat]),
    [
      ['normal', [1, 2, 3, 4, 5, 6], false, d === 'normal'],
      ['especial', [], true, d === 'especial'],
    ],
  );
});

test('a type plays the rounds that name it, whatever their kind; listed types keep card-types.json\'s order', () => {
  const rounds = [round(1, 'normal', 'desgraciat'), round(2, 'normal'), round(3, 'special', 'especial'), round(4, 'normal', 'especial')];
  assert.deepEqual(
    nightCardTypes({ rounds }, TYPES).map((t) => [t.type, t.regularRounds, t.special]),
    [['normal', [2], false], ['especial', [3], true], ['desgraciat', [1], false]],
  );
});

test("a round without a card type (an older plan) plays its kind's default", () => {
  const rounds = [round(1, 'normal'), round(2, 'special')];
  assert.deepEqual(nightCardTypes({ rounds }, TYPES).map((t) => [t.type, t.regularRounds, t.special]), [['normal', [1], false], ['especial', [], true]]);
});

test('rounds are listed in play order, whatever order the plan keeps them in', () => {
  const rounds = [round(3, 'normal'), round(1, 'normal'), round(2, 'normal')];
  assert.deepEqual(nightCardTypes({ rounds }, TYPES)[0].regularRounds, [1, 2, 3]);
});

test('a card type that plays no round tonight is left out; no plan, no preview', () => {
  const rounds = [round(1, 'normal'), round(2, 'normal')];
  assert.deepEqual(nightCardTypes({ rounds }, TYPES).map((t) => t.type), ['normal']);
  assert.deepEqual(nightCardTypes({ rounds: [] }, TYPES), []);
  assert.deepEqual(nightCardTypes(null, TYPES), []);
});

test('without card-types.json: a neutral stand-in names each type; unlisted types go last', () => {
  const rounds = [round(1, 'normal', 'daurat'), round(2, 'normal')];
  assert.deepEqual(nightCardTypes({ rounds }, knownCardTypes(null)), [
    { type: 'daurat', label: 'Cartró daurat', color: UNKNOWN_CARD_TYPE_COLOR, priceCents: null, regularRounds: [1], special: false, desgraciat: false },
    { type: 'normal', label: 'Cartró normal', color: UNKNOWN_CARD_TYPE_COLOR, priceCents: null, regularRounds: [2], special: false, desgraciat: false },
  ]);
  assert.deepEqual(nightCardTypes({ rounds }, TYPES).map((t) => t.type), ['normal', 'daurat'], 'a listed type before an unlisted one');
});

test('the balls take one line up to 7 rounds, two lines of half each above (D243: 1–5 over 6–10)', () => {
  assert.deepEqual([1, 6, 7, 8, 10, 11].map(ballsPerRow), [1, 6, 7, 4, 5, 6]);
});
