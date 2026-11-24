// The card types come from the printed cards (card-types.json, next to cards.json): any valid id, names and colours
// from the file, the plan's old copy only as a fallback, and a plain "Cartró <id>" for a type nobody lists. Each
// round names its own type; which rounds a type plays comes from the rounds.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { CARD_TYPE_ID_RE } from '@quina/protocol';
import {
  UNKNOWN_CARD_TYPE_COLOR,
  cardTypeLabel,
  knownCardTypes,
  readPrintedCardTypes,
  roundsByCardType,
} from '../../../../packages/ui/data/card-types.ts';
import { cardTypesUrlFor, loadCardTypes, loadCatalog } from '../../../../packages/ui/data/catalog.ts';
import { SAMPLE_PLAN } from '../../../../packages/ui/fixtures/plan.ts';
import { CARD_TYPE_ID_RE as CARDS_ID_RE, assertCardTypes, cardTypeProblems, unlistedCardTypes } from '../../../cards/src/card-types.ts';

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
  assert.deepEqual(cardTypeLabel('normal', types), { type: 'normal', name: 'Cartró normal', color: '#cfe8ff', priceCents: 200, known: true });
  assert.deepEqual(cardTypeLabel('daurat', types), { type: 'daurat', name: 'Cartró daurat', color: UNKNOWN_CARD_TYPE_COLOR, priceCents: null, known: false });
  assert.equal(cardTypeLabel('especial', []).name, 'Cartró especial', 'with no list at all, the default ids still read well');
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
    { number: 6, kind: 'desgraciat' as const },
  ];
  assert.deepEqual(roundsByCardType(rounds), [
    { type: 'normal', regularRounds: [1, 2], special: false, desgraciat: true },
    { type: 'desgraciat', regularRounds: [3], special: false, desgraciat: false },
    { type: 'especial', regularRounds: [5], special: true, desgraciat: false },
  ]);
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
