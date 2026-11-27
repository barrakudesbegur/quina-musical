// The edition file's shared check (packages/protocol/edition.ts, D116): the plan, the songs and, when present, the
// card types and the cards, as the edition tool and later the cloud read them.
import test from 'node:test';
import assert from 'node:assert/strict';
import { checkEdition, type CardTypeSides } from '@quina/protocol';

const TYPES: CardTypeSides[] = [
  { type: 'normal', name: 'Normal', sides: [{ side: 1, pool: '1', label: '1–5' }, { side: 2, pool: '2', label: '6–10' }] },
  { type: 'especial', name: 'Especial', sides: [{ side: 1, pool: '1', label: 'Desgraciat' }, { side: 2, pool: '2', label: 'Quina Especial' }] },
];
const songs = [
  ...Array.from({ length: 12 }, (_, i) => ({ id: i + 1, title: `S${i + 1}`, artist: 'A', pools: ['1'] })),
  ...Array.from({ length: 12 }, (_, i) => ({ id: 71 + i, title: `T${i + 1}`, artist: 'B', pools: ['2'] })),
];
const lines = (from: number) => [0, 1, 2].map((l) => [0, 1, 2, 3].map((k) => from + l * 4 + k));
const round = (number: number, kind: string, side: number, cardType?: string) => ({ number, kind, side, ...(cardType ? { cardType } : {}), line: [], bingo: [] });
const plan = {
  v: 3, edition: '26', title: 'Quina Musical', prizeReveal: 'perRound', sponsors: [],
  rounds: [round(1, 'normal', 1), round(2, 'desgraciat', 1), round(3, 'normal', 2), round(4, 'special', 2)],
  schedule: { startAtMs: null, roundMinutes: 25, intervalMinutes: 3 }, cheatSheet: { claimRules: [], specialRoundRules: [] },
};
const edition = (extra: object = {}) => ({
  v: 1, repertoire: '2026', plan, songs,
  cardTypes: TYPES,
  cards: [
    { id: 1, type: 'normal', sides: [{ side: 1, lines: lines(1) }, { side: 2, lines: lines(71) }] },
    { id: 400, type: 'especial', sides: [{ side: 1, lines: lines(1) }, { side: 2, lines: lines(71) }] },
  ],
  ...extra,
});

test('a whole edition passes: the plan as the cloud reads it, the songs and the two-sided cards', () => {
  const check = checkEdition(edition());
  assert.ok(check.ok, JSON.stringify(!check.ok && check.errors));
  assert.equal(check.edition.plan.rounds[1].cardType, 'especial', 'checkGamePlan fills each round\'s card type');
  assert.deepEqual(check.warnings, []);
  const planOnly = checkEdition({ v: 1, repertoire: '2026', plan, songs });
  assert.ok(planOnly.ok, 'the cards are optional (U68, U75)');
});

test('what an edition gets wrong is listed, never thrown', () => {
  const bad = (doc: unknown) => {
    const check = checkEdition(doc);
    assert.ok(!check.ok);
    return check.errors;
  };
  assert.deepEqual(bad(null), ['an edition file is a JSON object']);
  assert.match(bad(edition({ v: 2 })).join(), /v: expected 1/);
  assert.match(bad(edition({ songs: [...songs, songs[0]] })).join(), /songs\[24\]\.id: 1 is listed twice/);
  for (const pools of [['Pool 1'], [], undefined, '1', ['1', '1']]) {
    assert.match(bad(edition({ songs: [{ id: 1, title: 'X', artist: 'A', pools }], cards: [] })).join(), /songs\[0\]\.pools/, JSON.stringify(pools));
  }
  assert.match(bad(edition({ songs: [{ id: 1, title: 'X', artist: 'A', pool: '1' }], cards: [] })).join(), /songs\[0\]\.pools/, 'the edition has no `pool`');
  const stray = { id: 2, type: 'normal', sides: [{ side: 1, lines: lines(71) }] };
  assert.match(bad(edition({ cards: [stray] })).join(), /card 2's side 1 has song\(s\) 71, 72.* outside pool 1/);
  assert.match(bad(edition({ cards: [{ id: 3, type: 'normal', sides: [{ side: 3, lines: lines(1) }] }] })).join(), /side 3, which type "normal" doesn't print/);
  assert.match(bad(edition({ cards: [{ id: 4, type: 'groc', sides: [{ side: 1, lines: lines(1) }] }] })).join(), /type "groc" isn't in cardTypes/);
  assert.match(bad(edition({ cards: [{ id: 5, type: 'normal', sides: [{ side: 1, lines: [[1, 2, 3, 4]] }] }] })).join(), /isn't 3 lines of 4 songs/);
  const oneSided = [TYPES[0], { type: 'especial', sides: [{ side: 1, pool: '1' }] }];
  assert.match(bad(edition({ cardTypes: oneSided, cards: [] })).join(), /round 4 plays side 2 of card type "especial", which cardTypes doesn't have/);
  assert.match(bad(edition({ cardTypes: undefined })).join(), /cards: an edition with cards needs its cardTypes/);
  assert.ok(bad(edition({ plan: { ...plan, rounds: 'x' } })).some((e) => e.startsWith('plan')));
});

test('a side no round plays, or a pool without songs, warns', () => {
  const check = checkEdition(edition({ plan: { ...plan, rounds: plan.rounds.slice(0, 2) }, cards: [] }));
  assert.ok(check.ok);
  assert.deepEqual(check.warnings, ['plan.rounds: no round plays side 2 of card type "normal"', 'plan.rounds: no round plays side 2 of card type "especial"']);
  const noPool2 = checkEdition(edition({ songs: songs.slice(0, 12), cards: [] }));
  assert.ok(noPool2.ok);
  assert.ok(noPool2.warnings.length === 2 && noPool2.warnings.every((w) => /pool 2, which has no songs/.test(w)));
});

test('a song shared by two pools (D268): listed once, a member of both sides\' pools, counted in each', () => {
  // Song 12 is in pools 1 and 2; pool 2's own songs are 71–81, so side 2's lines take 12 as their first song.
  const shared = songs.map((s) => (s.id === 12 ? { ...s, pools: ['1', '2'] } : s)).filter((s) => s.id !== 82);
  const side2 = [[12, 71, 72, 73], [74, 75, 76, 77], [78, 79, 80, 81]];
  const check = checkEdition(edition({ songs: shared, cards: [{ id: 1, type: 'normal', sides: [{ side: 1, lines: lines(1) }, { side: 2, lines: side2 }] }] }));
  assert.ok(check.ok, JSON.stringify(!check.ok && check.errors));
  assert.deepEqual(check.warnings, []);
  // Only song 12 in pool 2: the pool counts it, so no "pool 2 has no songs" warning.
  const onlyShared = checkEdition(edition({ songs: [...songs.slice(0, 11), { ...songs[11], pools: ['1', '2'] }], cards: [] }));
  assert.ok(onlyShared.ok);
  assert.deepEqual(onlyShared.warnings, [], 'pool 2 has song 12');
  // Without the sharing, side 2's 12 is outside pool 2.
  const unshared = checkEdition(edition({ songs: songs.filter((s) => s.id !== 82), cards: [{ id: 1, type: 'normal', sides: [{ side: 2, lines: side2 }] }] }));
  assert.ok(!unshared.ok && unshared.errors.some((e) => /card 1's side 2 has song\(s\) 12 outside pool 2/.test(e)));
});
