// The card types come from the printed cards (card-types.json, next to cards.json): any valid id, names and colours
// from the file, the plan's old copy only as a fallback, and a plain "Cartró <id>" for a type nobody lists. Each
// round names its own type; which rounds a type plays comes from the rounds.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { CARD_TYPE_ID_RE, DEFAULT_POOL, POOL_ID_RE, SIDE_MAX, defaultCardType } from '@quina/protocol';
import {
  UNKNOWN_CARD_TYPE_COLOR,
  cardTypeLabel,
  knownCardTypes,
  readPrintedCardTypes,
  roundsByCardType,
  typeSideLabel,
} from '../../../../packages/ui/data/card-types.ts';
import { cardTypesUrlFor, loadCardTypes, loadCatalog } from '../../../../packages/ui/data/catalog.ts';
import { SAMPLE_PLAN } from '../../../../packages/ui/fixtures/plan.ts';
import {
  CARD_TYPE_ID_RE as CARDS_ID_RE,
  POOL_ID_RE as CARDS_POOL_ID_RE,
  SIDE_MAX as CARDS_SIDE_MAX,
  assertCardTypes,
  cardTypeProblems,
  unlistedCardTypes,
} from '../../../cards/src/card-types.ts';
import { DEFAULT_POOL as CARDS_DEFAULT_POOL } from '../../../cards/src/sides.ts';

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
  assert.equal(readPrintedCardTypes([PRINTED[0], PRINTED[0]]), null, 'a type twice');
  assert.equal(readPrintedCardTypes([{ ...PRINTED[0], color: 'blue' }]), null);
  assert.equal(readPrintedCardTypes([{ ...PRINTED[0], priceCents: -5 }]), null);
});

test('any type id isCardTypeId accepts is read, and nothing else', () => {
  const gold = { type: 'daurat2', name: 'Cartró daurat', color: '#f5d77a', title: '', priceCents: 500 };
  assert.deepEqual(readPrintedCardTypes([...PRINTED, gold])?.map((t) => t.type), ['normal', 'especial', 'daurat2']);
  for (const bad of ['Gold', 'super-quina', '2x', '', 'a'.repeat(25), 7]) assert.equal(readPrintedCardTypes([{ ...gold, type: bad }]), null, String(bad));
});

test('a type is named from the list; one nobody lists is "Cartró <id>" in a neutral colour', () => {
  const types = readPrintedCardTypes(PRINTED) ?? [];
  assert.deepEqual(cardTypeLabel('normal', types), { type: 'normal', name: 'Cartró normal', shortName: 'Normal', color: '#cfe8ff', priceCents: 200, known: true });
  assert.deepEqual(cardTypeLabel('daurat', types), { type: 'daurat', name: 'Cartró daurat', shortName: 'Daurat', color: UNKNOWN_CARD_TYPE_COLOR, priceCents: null, known: false });
  assert.equal(cardTypeLabel('especial', []).name, 'Cartró especial', 'with no list at all, the default ids still read well');
});

// ---- sides (D101, D102, D171, D178, D226) and the Check's label (D163)

const SIDED = [
  { ...PRINTED[0], shortName: 'Normal', sides: [{ side: 1, pool: '1', label: '1–5' }, { side: 2, pool: '2', label: '6–10' }] },
  { ...PRINTED[1], shortName: 'Especial', sides: [{ side: 1, pool: '1', label: 'Desgraciat' }, { side: 2, pool: '2', label: 'Quina Especial' }] },
];
/** A type printed on one side only. */
const ONE_SIDED = { type: 'daurat', name: 'Cartró daurat', shortName: 'Daurat', color: '#f5d77a', title: '', priceCents: 500, sides: [{ side: 1, pool: '1' }] };

test("card-types.json's sides and short names are read; a file from before them reads as one side 1 on pool 1", () => {
  const read = readPrintedCardTypes(SIDED);
  assert.deepEqual(read?.map((t) => [t.shortName, t.sides]), [
    ['Normal', [{ side: 1, pool: '1', label: '1–5' }, { side: 2, pool: '2', label: '6–10' }]],
    ['Especial', [{ side: 1, pool: '1', label: 'Desgraciat' }, { side: 2, pool: '2', label: 'Quina Especial' }]],
  ]);
  assert.deepEqual(readPrintedCardTypes(PRINTED)?.map((t) => [t.shortName, t.sides]), [
    ['Normal', [{ side: 1, pool: '1' }]],
    ['Especial', [{ side: 1, pool: '1' }]],
  ], 'no short name: the name without "Cartró"');
  const bad = (sides: unknown) => readPrintedCardTypes([{ ...PRINTED[0], sides }]);
  for (const sides of [[], [{ side: 0, pool: '1' }], [{ side: 1, pool: 'Pool 1' }], [{ side: 1, pool: '1' }, { side: 1, pool: '2' }], [{ side: 1, pool: '1', label: 4 }], 'both']) {
    assert.equal(bad(sides), null, JSON.stringify(sides));
  }
  assert.equal(readPrintedCardTypes([{ ...PRINTED[0], shortName: ' ' }]), null);
});

test("the Check's label (D163): the type and its side in one, «Normal 1–5», «Especial · Desgraciat»", () => {
  const types = readPrintedCardTypes([...SIDED, ONE_SIDED]) ?? [];
  assert.equal(typeSideLabel('normal', 1, types), 'Normal 1–5', 'a range joins with a space');
  assert.equal(typeSideLabel('normal', 2, types), 'Normal 6–10');
  assert.equal(typeSideLabel('especial', 1, types), 'Especial · Desgraciat', "D226, U198's (a): a round's name joins with « · »");
  assert.equal(typeSideLabel('especial', 2, types), 'Especial · Quina Especial');
  assert.equal(typeSideLabel('daurat', 1, types), 'Daurat', 'one side: no side in the label');
  assert.equal(typeSideLabel('normal', 1, readPrintedCardTypes([{ ...SIDED[0], sides: [{ side: 1, pool: '1', label: 'A' }, { side: 2, pool: '2' }] }]) ?? []), 'Normal · A');
  assert.equal(typeSideLabel('normal', 2, readPrintedCardTypes([{ ...SIDED[0], sides: [{ side: 1, pool: '1', label: 'A' }, { side: 2, pool: '2' }] }]) ?? []), 'Normal 2', 'a side with no label: its number');
  assert.equal(typeSideLabel('normal', 1, readPrintedCardTypes(PRINTED) ?? []), 'Normal', 'a card-types.json from before sides');
  assert.equal(typeSideLabel('plata', 2, types), 'Plata', 'a type nobody lists: its stand-in');
  assert.equal(typeSideLabel('normal', 1, []), 'Normal', 'without card-types.json');
});

test('the types to name things with: card-types.json, else none (the plan carries no copy since version 3)', () => {
  const printed = readPrintedCardTypes(PRINTED);
  assert.equal(knownCardTypes(printed), printed);
  assert.deepEqual(knownCardTypes(null), []);
  assert.deepEqual(knownCardTypes(undefined), []);
});

test('which rounds each type plays, from the rounds (a round without a type plays its kind\'s default)', () => {
  const rounds = [
    { number: 3, kind: 'normal' as const, cardType: 'desgraciat' },
    { number: 1, kind: 'normal' as const },
    { number: 2, kind: 'normal' as const, cardType: 'normal' },
    { number: 4, kind: 'special' as const },
    { number: 5, kind: 'normal' as const, cardType: 'especial' },
    { number: 6, kind: 'desgraciat' as const, cardType: 'normal' },
  ];
  // By Quina number: round 5 comes after the special round 4, so it is Quina 4.
  assert.deepEqual(roundsByCardType(rounds), [
    { type: 'normal', regularRounds: [1, 2], special: false, desgraciat: true },
    { type: 'desgraciat', regularRounds: [3], special: false, desgraciat: false },
    { type: 'especial', regularRounds: [4], special: true, desgraciat: false },
  ]);
  // A Desgraciat round without a type plays its kind's default (the special cards since D70).
  assert.deepEqual(roundsByCardType([{ number: 1, kind: 'desgraciat' }]), [{ type: defaultCardType('desgraciat'), regularRounds: [], special: false, desgraciat: true }]);
});

// ---- loading: card-types.json next to cards.json, never breaking the screen

const CARDS = [{ id: 1, type: 'normal', lines: [[1, 2, 3, 4], [5, 6, 7, 8], [9, 10, 11, 12]] }];

/** Serve these urls (anything else is a 404) for the length of `run`. */
async function withFetch(files: Record<string, unknown>, run: () => Promise<void>): Promise<void> {
  const real = globalThis.fetch;
  globalThis.fetch = (async (input: string | URL | Request) => {
    const url = String(input);
    if (!(url in files)) return new Response('not found', { status: 404 });
    const body = files[url];
    return new Response(typeof body === 'string' ? body : JSON.stringify(body), { status: 200 });
  }) as typeof fetch;
  try {
    await run();
  } finally {
    globalThis.fetch = real;
  }
}

test('card-types.json lives next to cards.json', () => {
  assert.equal(cardTypesUrlFor('/cards/cards.json'), '/cards/card-types.json');
  assert.equal(cardTypesUrlFor('https://example.org/26/cards.json?v=3'), 'https://example.org/26/card-types.json');
  assert.equal(cardTypesUrlFor('cards.json'), 'card-types.json');
});

test('the catalog loads the card types next to the cards', async () => {
  await withFetch({ '/cards/cards.json': CARDS, '/cards/card-types.json': PRINTED }, async () => {
    const catalog = await loadCatalog('/cards/cards.json');
    assert.equal(catalog.cards.size, 1);
    assert.deepEqual(catalog.cardTypes?.map((t) => t.type), ['normal', 'especial']);
  });
});

test('a missing or broken card-types.json never breaks the screen: the types read as null and fall back', async () => {
  await withFetch({ '/cards/cards.json': CARDS }, async () => {
    const catalog = await loadCatalog('/cards/cards.json');
    assert.equal(catalog.cards.size, 1, 'the cards still load');
    assert.equal(catalog.cardTypes, null);
    assert.equal(cardTypeLabel('especial', knownCardTypes(catalog.cardTypes)).color, UNKNOWN_CARD_TYPE_COLOR, 'the neutral stand-in');
  });
  await withFetch({ '/cards/cards.json': CARDS, '/cards/card-types.json': '{ not json' }, async () => {
    assert.equal((await loadCatalog('/cards/cards.json')).cardTypes, null);
    assert.equal(await loadCardTypes('/cards/card-types.json'), null);
  });
  await withFetch({ '/cards/card-types.json': [{ type: 'Bad Id', name: 'x', color: '#ffffff' }] }, async () => {
    assert.equal(await loadCardTypes('/cards/card-types.json'), null, 'a file that breaks the rules is no list');
  });
  await withFetch({}, async () => {
    await assert.rejects(loadCatalog('/cards/cards.json'), 'cards.json failing still fails the catalog (the screens retry it)');
  });
});

// ---- apps/cards: the generator checks the types before writing

test("the generator's id rule is the protocol's", () => {
  assert.equal(CARDS_ID_RE.source, CARD_TYPE_ID_RE.source);
  assert.equal(CARDS_ID_RE.flags, CARD_TYPE_ID_RE.flags);
});

test("the generator checks each type's sides: numbered 1, 2… in order, on a pool, labelled when there are several", () => {
  const [normal, especial] = readPrintedCardTypes(SIDED) ?? [];
  assert.deepEqual(cardTypeProblems([normal, especial]), []);
  const sides = (s: typeof normal.sides) => cardTypeProblems([{ ...normal, sides: s }]);
  assert.match(sides([]).join(), /has no sides/);
  assert.match(sides([{ side: 2, pool: '2', label: '6–10' }]).join(), /numbered 1, 2… in order/);
  assert.match(sides([{ side: 1, pool: 'P1', label: '1–5' }]).join(), /the pool must be/);
  assert.match(sides([{ side: 1, pool: '1' }, { side: 2, pool: '2', label: '6–10' }]).join(), /side 1: a type with several sides needs a label/);
  assert.match(cardTypeProblems([{ ...normal, shortName: '' }]).join(), /no short name/);
});

test("the generator's pool and side rules are the protocol's (copies, since apps/cards builds on its own)", () => {
  assert.equal(CARDS_POOL_ID_RE.source, POOL_ID_RE.source);
  assert.equal(CARDS_SIDE_MAX, SIDE_MAX);
  assert.equal(CARDS_DEFAULT_POOL, DEFAULT_POOL);
});

test('the generator refuses bad type ids and cards of an unlisted type', () => {
  const types = readPrintedCardTypes(PRINTED) ?? [];
  assert.deepEqual(cardTypeProblems(types), []);
  assert.equal(cardTypeProblems([{ ...types[0], type: 'Gold' }]).length, 1);
  assert.equal(cardTypeProblems([types[0], types[0]]).length, 1, 'a type twice');
  assert.deepEqual(unlistedCardTypes([{ id: 1, type: 'normal' }, { id: 9, type: 'daurat' }], types), ['card 9: type "daurat" is not in the card types']);
  assert.throws(() => assertCardTypes([{ id: 9, type: 'daurat' }], types), /card 9/);
});

test('the printed cards in apps/cards/dist pass the checks, and the screens read their card-types.json', () => {
  const dist = new URL('../../../cards/dist/', import.meta.url);
  const types: unknown = JSON.parse(readFileSync(new URL('card-types.json', dist), 'utf8'));
  const cards = JSON.parse(readFileSync(new URL('cards.json', dist), 'utf8')) as { id: number; type: string }[];
  const read = readPrintedCardTypes(types);
  assert.ok(read, 'card-types.json reads');
  assert.doesNotThrow(() => assertCardTypes(cards, read));
});

test("the price before a round (U5): a normal card × the regular rounds left, the especial card its fixed price", async () => {
  const { comingRoundPrice } = await import('../../../../packages/ui/data/card-types.ts');
  const printed = readPrintedCardTypes([
    { type: 'normal', name: 'Cartró normal', color: '#cfe8ff', title: '', priceCents: 150, priceRule: 'perRegularRound' },
    { type: 'especial', name: 'Cartró especial', color: '#ffd9e8', title: '', priceCents: 500, priceRule: 'fixed' },
  ]) ?? [];
  // SAMPLE_PLAN: 8 rounds, round 5 the Desgraciat and round 7 the Especial; 6 regular rounds.
  const regular = SAMPLE_PLAN.rounds.filter((r) => r.kind === 'normal').length;
  assert.equal(comingRoundPrice(SAMPLE_PLAN, 1, printed)?.cents, 150 * regular, 'before the start: every regular round');
  const especial = SAMPLE_PLAN.rounds.find((r) => r.kind === 'special')!;
  assert.deepEqual([comingRoundPrice(SAMPLE_PLAN, especial.number, printed)?.cents, comingRoundPrice(SAMPLE_PLAN, especial.number, printed)?.type], [500, 'especial']);
  const desgraciat = SAMPLE_PLAN.rounds.find((r) => r.kind === 'desgraciat')!;
  const playing = (cardType: string) => ({ ...SAMPLE_PLAN, rounds: SAMPLE_PLAN.rounds.map((r) => (r === desgraciat ? { ...r, cardType } : r)) });
  assert.deepEqual(comingRoundPrice(playing('especial'), desgraciat.number, printed)?.cents, 500, "the Desgraciat on special cards (D70): the especial's fixed price");
  const left = SAMPLE_PLAN.rounds.filter((r) => r.kind === 'normal' && r.number >= desgraciat.number).length;
  assert.equal(comingRoundPrice(playing('normal'), desgraciat.number, printed)?.cents, 150 * left, 'the Desgraciat on normal cards: its own round not counted');
  assert.equal(comingRoundPrice(SAMPLE_PLAN, 1, readPrintedCardTypes([{ type: 'normal', name: 'N', color: '#cfe8ff', title: '', priceCents: null }]) ?? []), null, 'no price set: nothing shown');
  assert.equal(comingRoundPrice(null, 1, printed), null);
  assert.equal(comingRoundPrice(SAMPLE_PLAN, 99, printed), null);
  assert.equal(readPrintedCardTypes([{ type: 'normal', name: 'N', color: '#cfe8ff', title: '', priceCents: 150 }])?.[0].priceRule, 'perRegularRound', 'absent: per regular round');
  assert.equal(readPrintedCardTypes([{ type: 'normal', name: 'N', color: '#cfe8ff', title: '', priceCents: 150, priceRule: 'weekly' }]), null);
});
