// The card types come from the printed cards (card-types.json); the plan keeps a copy and its own round kinds.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readPrintedCardTypes, withPrintedCardTypes } from '../../../../packages/ui/data/card-types.ts';
import { SAMPLE_PLAN } from '../../../../packages/ui/fixtures/plan.ts';

const PRINTED = [
  { type: 'normal', name: 'Cartró normal', color: '#CFE8FF', title: 'QUINA QUINA!', priceCents: 200 },
  { type: 'especial', name: 'Cartró especial', color: '#ffd9e8', title: 'QUINA QUINA!', priceCents: null },
];

test('card-types.json is read strictly: anything off reads as no types', () => {
  const read = readPrintedCardTypes(PRINTED);
  assert.equal(read?.[0].color, '#cfe8ff', 'colours lower-cased');
  assert.equal(read?.[1].priceCents, null);
  assert.equal(readPrintedCardTypes([]), null);
  assert.equal(readPrintedCardTypes({ types: PRINTED }), null);
  assert.equal(readPrintedCardTypes([{ ...PRINTED[0], type: 'gold' }]), null);
  assert.equal(readPrintedCardTypes([PRINTED[0], PRINTED[0]]), null, 'a type twice');
  assert.equal(readPrintedCardTypes([{ ...PRINTED[0], color: 'blue' }]), null);
  assert.equal(readPrintedCardTypes([{ ...PRINTED[0], priceCents: -5 }]), null);
});

test("the plan's copy follows the printed types and keeps its round kinds; unchanged means the same object", () => {
  const printed = readPrintedCardTypes(PRINTED) ?? [];
  const custom = { ...SAMPLE_PLAN, cardTypes: SAMPLE_PLAN.cardTypes.map((c) => (c.type === 'normal' ? { ...c, rounds: ['normal' as const, 'special' as const] } : c)) };
  const next = withPrintedCardTypes(custom, printed);
  assert.notEqual(next, custom);
  assert.deepEqual(next.cardTypes.map((c) => [c.type, c.name, c.color, c.priceCents]), [['normal', 'Cartró normal', '#cfe8ff', 200], ['especial', 'Cartró especial', '#ffd9e8', null]]);
  assert.deepEqual(next.cardTypes[0].rounds, ['normal', 'special'], 'the plan decides where a type plays');
  assert.equal(withPrintedCardTypes(next, printed), next);
  assert.deepEqual(withPrintedCardTypes({ ...SAMPLE_PLAN, cardTypes: [] }, printed).cardTypes[1].rounds, ['special'], 'a new type gets the default round kind');
});
