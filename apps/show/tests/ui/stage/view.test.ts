// The projector's privacy boundary: stageView must never let a secret out, in any scene, and must draw each
// scene from the right data (fixtures from ui/fixtures).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { defaultCardType } from '@quina/protocol';
import { flowOf, type FlowState } from '../../../../../packages/ui/flow.ts';
import { FIXTURES, FIXTURE_NAMES } from '../../../../../packages/ui/fixtures/states.ts';
import { SAMPLE_PLAN } from '../../../../../packages/ui/fixtures/plan.ts';
import { parseCards, type Catalog } from '../../../../../packages/ui/data/catalog.ts';
import { readPrintedCardTypes } from '../../../../../packages/ui/data/card-types.ts';
import { stageView, type StageView } from '../../../../stage/view.ts';
import { checkReveal, firstMiss, NO_CHECK_MEMORY, plaqueSpot, typeReveal } from '../../../../stage/model/check.ts';
import { STAGE_TEXT } from '../../../../stage/strings.ts';

const NOW = 1_800_000_000_000;

/** Every prize the sample plan gives away, by title and detail: none may reach the projector for now (D311). */
const PRIZE_WORDS = [...new Set(SAMPLE_PLAN.rounds.flatMap((r) => [...r.line, ...r.bingo]).flatMap((p) => [p.title, p.detail]).filter((t): t is string => !!t))];

/** The plan's prize words a view carries, and whether its body has a prize field. */
function prizesIn(view: StageView): string[] {
  const json = JSON.stringify(view);
  const words = PRIZE_WORDS.filter((t) => json.includes(JSON.stringify(t).slice(1, -1)));
  return 'prize' in view.body || 'prizes' in view.body ? ['(a prize field)', ...words] : words;
}

/** A fixture with every round's prizes revealed (D311: even then the projector shows none). */
function allRevealed(name: string, patch: Partial<FlowState> = {}): FlowState {
  const { state } = FIXTURES[name](NOW);
  return { ...state, ...patch, prizes: { revealed: SAMPLE_PLAN.rounds.map((r) => ({ round: r.number, by: 'presenters' as const })) } };
}

/** A tiny catalog: cards 57 and 508 (the especial one) on both sides, and card 123 as a card from before sides (the
 * songs as in the fixtures). */
const song = (id: number) => ({ id, title: `Song ${id}`, artist: `Artist ${id}` });
const SIDE_2_OF_57 = [[1, 6, 27, 38], [9, 21, 59, 75], [2, 39, 67, 77]];
const SIDE_2_OF_508 = [[17, 16, 68, 69], [18, 21, 24, 56], [62, 44, 60, 59]];
const CATALOG: Catalog = {
  ...parseCards([
    { id: 57, type: 'normal', sides: [{ side: 1, lines: [[5, 14, 64, 75], [15, 18, 60, 69], [2, 62, 16, 20]].map((l) => l.map(song)) }, { side: 2, lines: SIDE_2_OF_57.map((l) => l.map(song)) }] },
    { id: 123, type: 'normal', lines: [[2, 17, 41, 69], [11, 15, 31, 64], [3, 55, 66, 68]].map((l) => l.map(song)) },
    { id: 508, type: 'especial', sides: [{ side: 1, lines: [[31, 32, 39, 74], [17, 48, 75, 12], [3, 35, 38, 54]].map((l) => l.map(song)) }, { side: 2, lines: SIDE_2_OF_508.map((l) => l.map(song)) }] },
  ]),
  // card-types.json, as apps/cards writes it: the only source of the types' names, colours and sides.
  cardTypes: readPrintedCardTypes([
    { type: 'normal', name: 'Cartró normal', shortName: 'Normal', color: '#cfe8ff', title: 'QUINA QUINA!', priceCents: null, sides: [{ side: 1, pool: '1', label: '1–5', checkLabel: 'Normal 1–5' }, { side: 2, pool: '2', label: '6–10', checkLabel: 'Normal 6–10' }] },
    { type: 'especial', name: 'Cartró especial', shortName: 'Especial', color: '#ffd9e8', title: 'QUINA QUINA!', priceCents: null, sides: [{ side: 1, pool: '1', label: 'Desgraciat', checkLabel: 'Desgraciat' }, { side: 2, pool: '2', label: 'Quina Especial', checkLabel: 'Especial' }] },
  ]),
};

const SECRET = {
  nextSongId: 900001,
  nextTitle: 'SECRET-NEXT-TITLE',
  nextArtist: 'SECRET-NEXT-ARTIST',
  transitionTo: 900002,
  possibleWinnerCard: 900003,
  queuedClaimCard: 900004,
  winnerName: 'SECRET-WINNER-NAME',
  winnerNotes: 'SECRET-WINNER-NOTES',
  claimId: 'SECRET-CLAIM-ID',
  standingCount: 4545,
  standingCard: 900005,
  markedSong: 900006,
  revealUntil: 4848,
};

/** A fixture with every private field filled with a recognisable secret. */
function withSecrets(name: string): FlowState {
  const { state } = FIXTURES[name](NOW);
  return {
    ...state,
    phase: 'final',
    next: { songId: SECRET.nextSongId, title: SECRET.nextTitle, artist: SECRET.nextArtist },
    transition: { id: 'tr-x', recipe: 'R7', phase: 'final', to: SECRET.transitionTo, landAtMs: NOW + 5000 },
    possibleWinners: { line: [{ cardId: SECRET.possibleWinnerCard, lines: [0], completedBy: SECRET.nextSongId }], bingo: [] },
    future: { lineAt: 4242, bingoAt: 4343, toLine: [0, 7], toBingo: [], markCounts: [5, 6], lastStandingAt: 4444, standingCurve: [4646, 4747] },
    // The Desgraciat round's standing count and cards: the console's only.
    standing: { count: SECRET.standingCount, cardIds: [SECRET.standingCard] },
    hold: { sinceMs: NOW, reason: 'hold', holdMusic: false, ducked: false },
    queue: { ...state.queue, length: 777 },
    history: [{ recipe: 'R7', family: 'build', exit: null, songId: SECRET.nextSongId, hookId: 'h-secret', phase: 'final' }],
    claims: [
      ...(state.claims ?? []),
      {
        claimId: SECRET.claimId,
        round: 3,
        cardId: SECRET.queuedClaimCard,
        kind: 'bingo',
        atMs: NOW,
        position: 1,
        status: 'queued',
        outcome: 'complete',
        completeSince: 41,
        warnings: ['notSold'],
        markedCard: [{ songId: SECRET.markedSong, landed: true }],
        revealUntil: SECRET.revealUntil,
        cueNext: true,
      },
    ],
    winners: [
      ...(state.winners ?? []),
      { round: 3, kind: 'line', cardId: 123, claimId: SECRET.claimId, winningSongId: 69, position: 3, atMs: NOW, name: SECRET.winnerName, notes: SECRET.winnerNotes },
    ],
  };
}

// Winning card numbers aren't secret, but the projector never shows them: no list of winners or cards comes out.
const FORBIDDEN_KEYS = ['standing', 'lastStandingAt', 'standingCurve', 'winners', 'lastWinners', 'cardIds', 'next', 'queue', 'possibleWinners', 'future', 'lineAt', 'bingoAt', 'toLine', 'toBingo', 'markCounts', 'ducked', 'claims', 'claimId', 'warnings', 'completeSince', 'otherRows', 'winningSongId', 'name', 'notes', 'phase', 'history', 'to', 'targetId', 'pace', 'schedule', 'game', 'cards', 'hold', 'status', 'outcome', 'markedCard', 'revealUntil', 'cueNext'];

function keysDeep(value: unknown, out = new Set<string>()): Set<string> {
  if (Array.isArray(value)) for (const v of value) keysDeep(v, out);
  else if (value && typeof value === 'object') {
    for (const [k, v] of Object.entries(value)) {
      out.add(k);
      keysDeep(v, out);
    }
  }
  return out;
}

function assertNoSecrets(view: StageView, label: string): void {
  const json = JSON.stringify(view);
  for (const text of [SECRET.nextTitle, SECRET.nextArtist, SECRET.winnerName, SECRET.winnerNotes, SECRET.claimId, 'h-secret', 'notSold']) {
    assert.ok(!json.includes(text), `${label}: "${text}" leaked`);
  }
  for (const id of [SECRET.nextSongId, SECRET.transitionTo, SECRET.possibleWinnerCard, SECRET.queuedClaimCard, 777, SECRET.standingCount, SECRET.standingCard, 4444, 4646, SECRET.markedSong, SECRET.revealUntil]) {
    assert.ok(!new RegExp(`\\b${id}\\b`).test(json), `${label}: ${id} leaked`);
  }
  const keys = keysDeep(view);
  for (const k of FORBIDDEN_KEYS) assert.ok(!keys.has(k), `${label}: key "${k}" present`);
  assert.ok(!/"(early|mid|late|final)"/.test(json), `${label}: a Phase name leaked`);
}

test('no private field comes out of stageView, in any fixture, with or without plan and catalog', () => {
  for (const name of FIXTURE_NAMES) {
    const state = withSecrets(name);
    for (const plan of [SAMPLE_PLAN, null]) {
      for (const catalog of [CATALOG, null]) {
        const view = stageView(state, flowOf(state), plan, catalog, {
          landed: [{ songId: 74, position: 99, atMs: NOW + 9e9 }],
          spin: { id: 'tr-x', spinStartAtMs: NOW, landAtMs: NOW + 5000, autoReleaseAtMs: null },
        });
        assertNoSecrets(view, `${name} plan=${!!plan} catalog=${!!catalog}`);
      }
    }
  }
});

test('the songs are the landed ones only, newest first, with titles from the snapshot', () => {
  const state = withSecrets('play');
  const view = stageView(state, flowOf(state), SAMPLE_PLAN, CATALOG);
  assert.equal(view.songs[0].songId, 7);
  assert.equal(view.songs[0].title, 'Boig Per Tu');
  assert.deepEqual(view.songs.slice(0, 3).map((s) => s.songId), [7, 35, 45]);
  assert.ok(!view.songs.some((s) => s.songId === 74), 'the next song is not revealed');
  assert.equal(view.body.scene, 'play');
});

test('play: the round and the motion as timestamps, never the incoming song', () => {
  const state = withSecrets('spin');
  const view = stageView(state, flowOf(state), SAMPLE_PLAN, CATALOG);
  assert.equal(view.body.scene, 'play');
  if (view.body.scene !== 'play') return;
  assert.deepEqual(view.body.round, { number: 3, special: false, desgraciat: false, label: 'Quina 3' });
  assert.deepEqual(view.body.motion, { kind: 'spin', startAtMs: null, landAtMs: NOW + 5000, sinceMs: null, autoReleaseAtMs: null });
});

test('before: start time, the night\'s card types, sponsors and the player app link from the plan', () => {
  const state = FIXTURES.before(NOW).state;
  const plan = { ...SAMPLE_PLAN, schedule: { ...SAMPLE_PLAN.schedule, startAtMs: NOW + 600_000 } };
  const view = stageView(state, flowOf(state), plan, CATALOG);
  assert.equal(view.title, SAMPLE_PLAN.title, "the edition's name");
  assert.deepEqual(view.body, {
    scene: 'before',
    startAtMs: NOW + 600_000,
    // SAMPLE_PLAN's Desgraciat (round 5) plays its kind's default type: the special cards since D70.
    cardTypes: [
      { type: 'normal', label: 'Cartró normal', color: '#cfe8ff', priceCents: null, regularRounds: [1, 2, 3, 4, 5, 6], special: false, desgraciat: defaultCardType('desgraciat') === 'normal' },
      { type: 'especial', label: 'Cartró especial', color: '#ffd9e8', priceCents: null, regularRounds: [], special: true, desgraciat: defaultCardType('desgraciat') === 'especial' },
    ],
    sponsors: SAMPLE_PLAN.sponsors.map((s) => ({ label: s.name, logo: s.logo })),
    link: { href: 'https://quina.barrakudesbegur.org/26', label: 'quina.barrakudesbegur.org/26' },
  });
  const none = stageView(state, flowOf(state), null, null);
  if (none.body.scene !== 'before') return assert.fail('not before');
  assert.deepEqual(none.body.cardTypes, [], 'no plan: no preview');
});

test("before: card-types.json's names and colours; only round 1's card type shows its price (U5)", () => {
  const state = FIXTURES.before(NOW).state;
  const printed = readPrintedCardTypes([
    { type: 'normal', name: 'Cartró blau', shortName: 'Blau', color: '#aaccee', title: '', priceCents: 200, sides: [{ side: 1, pool: '1', label: '1–5', checkLabel: 'Normal 1–5' }, { side: 2, pool: '2', label: '6–10', checkLabel: 'Normal 6–10' }] },
    { type: 'especial', name: 'Cartró rosa', shortName: 'Rosa', color: '#eeaacc', title: '', priceCents: 500, sides: [{ side: 1, pool: '1', label: 'Desgraciat', checkLabel: 'Desgraciat' }, { side: 2, pool: '2', label: 'Quina Especial', checkLabel: 'Especial' }] },
  ]);
  const view = stageView(state, flowOf(state), SAMPLE_PLAN, { ...CATALOG, cardTypes: printed });
  if (view.body.scene !== 'before') return assert.fail('not before');
  // Round 1 plays the normal card at 200 a regular round: × the plan's regular rounds; the especial shows none yet.
  const regular = SAMPLE_PLAN.rounds.filter((r) => r.kind === 'normal').length;
  assert.deepEqual(view.body.cardTypes.map((t) => [t.label, t.color, t.priceCents]), [['Cartró blau', '#aaccee', 200 * regular], ['Cartró rosa', '#eeaacc', null]]);
});

/** This year's night (D171, D193): Quines 1–5, the Desgraciat, the Break, Quines 6–10, the Especial; the sample plan's
 * prizes reused. With card-types.json's prices as apps/cards writes them (D69): 1,50 € a regular round, the especial 5 €. */
const EDITION_PLAN = (() => {
  const kinds: Record<number, 'desgraciat' | 'special'> = { 6: 'desgraciat', 12: 'special' };
  const normal = SAMPLE_PLAN.rounds.find((r) => r.kind === 'normal')!;
  const rounds = Array.from({ length: 12 }, (_, i) => {
    const kind = kinds[i + 1] ?? 'normal';
    return { ...normal, number: i + 1, kind, cardType: defaultCardType(kind), side: i + 1 > 6 ? 2 : 1, line: kind === 'desgraciat' ? [] : normal.line };
  });
  return { ...SAMPLE_PLAN, rounds };
})();
const EDITION_TYPES = readPrintedCardTypes([
  { type: 'normal', name: 'Cartró normal', shortName: 'Normal', color: '#cfe8ff', title: '', priceCents: 150, priceRule: 'perRegularRound', sides: [{ side: 1, pool: '1', label: '1–5', checkLabel: 'Normal 1–5' }, { side: 2, pool: '2', label: '6–10', checkLabel: 'Normal 6–10' }] },
  { type: 'especial', name: 'Cartró especial', shortName: 'Especial', color: '#ffd9e8', title: '', priceCents: 500, priceRule: 'fixed', sides: [{ side: 1, pool: '1', label: 'Desgraciat', checkLabel: 'Desgraciat' }, { side: 2, pool: '2', label: 'Quina Especial', checkLabel: 'Especial' }] },
]);

test('before, this year (D243): the normal card plays Quines 1–10 at 15 €; the special card the Especial and the Desgraciat, no price yet', () => {
  const state = FIXTURES.before(NOW).state;
  const view = stageView(state, flowOf(state), EDITION_PLAN, { ...CATALOG, cardTypes: EDITION_TYPES });
  if (view.body.scene !== 'before') return assert.fail('not before');
  assert.deepEqual(
    view.body.cardTypes.map((t) => [t.type, t.regularRounds, t.special, t.desgraciat, t.priceCents]),
    [
      ['normal', [1, 2, 3, 4, 5, 6, 7, 8, 9, 10], false, false, 1500],
      ['especial', [], true, true, null],
    ],
  );
});

test("the Break's price, this year (D69, D81): the special card's 5 € before each special round, the normal card's 1,50 € a regular round left", () => {
  const priceBefore = (nextRound: number) => {
    const base = FIXTURES.interval(NOW).state;
    const state: FlowState = { ...base, round: { ...base.round, number: nextRound - 1 }, interval: { sinceMs: NOW - 40_000, nextRound, guideEndMs: NOW + 140_000 } };
    const view = stageView(state, flowOf(state), EDITION_PLAN, { ...CATALOG, cardTypes: EDITION_TYPES });
    if (view.body.scene !== 'interval') return assert.fail('not interval');
    return view.body.price && [view.body.price.label, view.body.price.cents];
  };
  assert.deepEqual(priceBefore(2), ['Cartró normal', 1350], 'Quina 2: nine regular rounds left');
  assert.deepEqual(priceBefore(6), ['Cartró especial', 500], 'the Desgraciat: the special card');
  assert.deepEqual(priceBefore(7), ['Cartró normal', 750], 'Quina 6, after the Break: five left (the Desgraciat never counts)');
  assert.deepEqual(priceBefore(12), ['Cartró especial', 500], 'the Especial: the special card again');
});

/** A fixture's state with its Check's cue played (as the engine's snapshot right after `check.cue`). */
function cued(name: string, cue: 'pass' | 'fail'): FlowState {
  const { state } = FIXTURES[name](NOW);
  assert.ok(state.check, name);
  return { ...state, check: { ...state.check, cue } };
}

test("check: the badge is named from card-types.json; a wrong type's ✗ only from its cue", () => {
  const printed = readPrintedCardTypes([{ type: 'especial', name: 'Cartró rosa', shortName: 'Rosa', color: '#eeaacc', title: '', priceCents: null, sides: [{ side: 1, pool: '1', checkLabel: 'Rosa' }] }]);
  const catalog = { ...CATALOG, cardTypes: printed };
  const before = FIXTURES.checkWrongType(NOW).state;
  const view = stageView(before, flowOf(before), SAMPLE_PLAN, catalog);
  if (view.body.scene !== 'check') return assert.fail('not check');
  assert.deepEqual(view.body.check.cardType, { type: 'especial', label: 'Rosa', color: '#eeaacc', special: true, ok: null });
  const after = cued('checkWrongType', 'fail');
  const failed = stageView(after, flowOf(after), SAMPLE_PLAN, catalog);
  if (failed.body.scene !== 'check') return assert.fail('not check');
  assert.equal(failed.body.check.cardType?.ok, false);
});

test('nothing tells the room the result before the cue: no verdict, no ✗ on the type, no word of it', () => {
  for (const name of FIXTURE_NAMES) {
    const state = FIXTURES[name](NOW).state;
    if (!state.check || state.check.cue !== null) continue;
    for (const catalog of [CATALOG, null]) {
      const view = stageView(state, flowOf(state), SAMPLE_PLAN, catalog);
      if (view.body.scene !== 'check') return assert.fail(`${name}: not check`);
      assert.equal(view.body.check.verdict, null, name);
      assert.notEqual(view.body.check.cardType?.ok, false, name);
      assert.ok(!/"(complete|incomplete|fallen|fellLast|wrongType|notValid)"/.test(JSON.stringify(view)), `${name}: a result word leaked`);
    }
  }
});

test('at the cue: the result as the cue says, its look from the finding', () => {
  const at = (state: FlowState) => {
    const view = stageView(state, flowOf(state), SAMPLE_PLAN, CATALOG);
    return view.body.scene === 'check' ? view.body.check.verdict : 'not check';
  };
  assert.equal(at(FIXTURES.checkCuePass(NOW).state), 'complete');
  assert.equal(at(FIXTURES.checkCueFail(NOW).state), 'incomplete');
  assert.equal(at(FIXTURES.checkCelebrateNext(NOW).state), 'incomplete', "the last card's ✗, while one more press starts the Celebration");
  assert.equal(at(FIXTURES.checkCueFallen(NOW).state), 'fallen');
  assert.equal(at(cued('checkWrongType', 'fail')), 'notValid');
  assert.equal(at(cued('checkFailed', 'pass')), 'complete', 'won by hand from a review');
});

test('roundStart: the round, no prizes (D311); the Shuffle grid by song id, its window from the engine', () => {
  const state = FIXTURES.shuffle(NOW).state;
  const view = stageView(state, flowOf(state), SAMPLE_PLAN, CATALOG);
  assert.equal(view.body.scene, 'roundStart');
  if (view.body.scene !== 'roundStart') return;
  assert.deepEqual(view.body.round, { number: 4, special: false, desgraciat: false, label: 'Quina 4' });
  assert.deepEqual(prizesIn(view), []);
  assert.equal(view.body.shuffle?.startAtMs, NOW + 500);
  assert.equal(view.body.shuffle?.endAtMs, NOW + 9500);
  assert.deepEqual(view.body.tiles, [...view.body.tiles].sort((a, b) => a - b));
  assert.equal(view.body.tiles.length, CATALOG.songs.size);
});

test('a missing plan hides the sponsors', () => {
  const state = FIXTURES.interval(NOW).state;
  const view = stageView(state, flowOf(state), null, null);
  assert.equal(view.body.scene, 'interval');
  if (view.body.scene !== 'interval') return;
  assert.deepEqual(view.body.sponsors, []);
  assert.equal(view.body.plate, 'Següent: Quina 4 de 8', "the total falls back to the engine setting, the number to the plan's");
});

test('check: the card grid from the catalog, the Line row, the songs revealed so far', () => {
  const state = FIXTURES.check(NOW).state;
  const view = stageView(state, flowOf(state), SAMPLE_PLAN, CATALOG);
  assert.equal(view.body.scene, 'check');
  if (view.body.scene !== 'check') return;
  const c = view.body.check;
  assert.equal(c.cardId, 57);
  assert.equal(c.verdict, null, 'no result before the cue');
  assert.equal(c.row, 2);
  assert.equal(c.total, 4);
  assert.equal(c.cells.length, 12);
  assert.deepEqual(c.cells.filter((cell) => cell.step !== null).map((cell) => [cell.row, cell.step]), [[2, 0], [2, 1], [2, 2], [2, 3]]);
  assert.deepEqual(c.steps.map((s) => [s.songId, s.landed]), [[2, true], [62, true]]);
  assert.equal(c.reviewing, false);
});

test('check without the catalog: only the revealed songs', () => {
  const state = FIXTURES.check(NOW).state;
  const view = stageView(state, flowOf(state), SAMPLE_PLAN, null);
  if (view.body.scene !== 'check') return assert.fail('not check');
  assert.deepEqual(view.body.check.cells.map((c) => [c.songId, c.row, c.col]), [[2, 2, 0], [62, 2, 1]]);
  const started = FIXTURES.checkStarted(NOW).state;
  const empty = stageView(started, flowOf(started), SAMPLE_PLAN, null);
  if (empty.body.scene !== 'check') return assert.fail('not check');
  assert.deepEqual(empty.body.check.cells, [], 'nothing revealed yet');
});

test('a failed check: the first song that didn\'t sound is named from the catalog, its tile is on the Line\'s row', () => {
  const state = FIXTURES.checkCueFail(NOW).state;
  const view = stageView(state, flowOf(state), SAMPLE_PLAN, CATALOG);
  if (view.body.scene !== 'check') return assert.fail('not check');
  const c = view.body.check;
  const miss = firstMiss(c);
  assert.deepEqual(miss, { step: 3, songId: 20, title: 'Song 20' });
  const tile = c.cells.find((cell) => cell.step === miss?.step);
  assert.deepEqual(tile && [tile.row, tile.col], [2, 3]);
  assert.deepEqual(plaqueSpot(c), { at: 1 / 3, over: 'rows' });
  // Without the catalog the song hasn't landed, so the projector has no title for it: it names none.
  const bare = stageView(state, flowOf(state), SAMPLE_PLAN, null);
  if (bare.body.scene !== 'check') return assert.fail('not check');
  assert.deepEqual(firstMiss(bare.body.check), { step: 3, songId: 20, title: null });
});

test('check of a wrong-type card: nothing to reveal, no grid; at its cue, not valid', () => {
  const state = cued('checkWrongType', 'fail');
  const view = stageView(state, flowOf(state), SAMPLE_PLAN, CATALOG);
  if (view.body.scene !== 'check') return assert.fail('not check');
  assert.equal(view.body.check.verdict, 'notValid');
  assert.equal(view.body.check.total, 0);
  assert.deepEqual(view.body.check.cells, []);
});

test("the last card's fail stays on the projector through the round's `checkFailed` Hold (the engine is back in play)", () => {
  const atCue = FIXTURES.checkFailed(NOW).state;
  assert.ok(atCue.check);
  // Right after the cue the engine is back in the round, in the Hold with its error music; the Check is gone.
  const after: FlowState = {
    ...atCue,
    scene: 'play',
    check: null,
    hold: { sinceMs: NOW, reason: 'checkFailed', holdMusic: true, ducked: true },
    claims: atCue.claims.map((c) => ({ ...c, status: 'invalid' as const })),
  };
  const memory = { ...NO_CHECK_MEMORY, last: atCue.check };
  const kept = stageView(after, flowOf(after), SAMPLE_PLAN, CATALOG, { landed: [], spin: null, check: memory });
  if (kept.body.scene !== 'check') return assert.fail('not kept');
  assert.equal(kept.body.check.verdict, 'incomplete');
  assert.equal(kept.body.check.key, `57@${atCue.check.startAtMs}`, 'the same Check: no entrance again');
  assertNoSecrets(kept, 'kept');
  // Without the memory (a projector reloaded meanwhile), or once the Hold ends: the round.
  assert.equal(stageView(after, flowOf(after), SAMPLE_PLAN, CATALOG).body.scene, 'play');
  const next: FlowState = { ...after, hold: null, status: 'transition' };
  assert.equal(stageView(next, flowOf(next), SAMPLE_PLAN, CATALOG, { landed: [], spin: null, check: memory }).body.scene, 'play');
});

test('under review: the plaque, the marks as they were when it began; a step back replays the song before', () => {
  const state = FIXTURES.checkReview(NOW).state;
  assert.ok(state.check);
  const review = { ...NO_CHECK_MEMORY, review: { claimId: state.check.claimId, atMs: NOW - 9000 } };
  const view = stageView(state, flowOf(state), SAMPLE_PLAN, CATALOG, { landed: [], spin: null, check: review });
  if (view.body.scene !== 'check') return assert.fail('not check');
  assert.equal(view.body.check.reviewing, true);
  assert.equal(view.body.check.reviewSinceMs, NOW - 9000);
  assert.equal(view.body.check.verdict, null);
  // A step back from 3 revealed songs to 2: the 2nd («Aserejé») replays for its snippet's length.
  const two = FIXTURES.check(NOW).state;
  assert.ok(two.check);
  const back = { ...NO_CHECK_MEMORY, unrevealed: { claimId: two.check.claimId, index: 2, atMs: NOW } };
  const stepped = stageView(two, flowOf(two), SAMPLE_PLAN, CATALOG, { landed: [], spin: null, check: back });
  if (stepped.body.scene !== 'check') return assert.fail('not check');
  assert.deepEqual(stepped.body.check.replay, { step: 1, fromMs: NOW, toMs: NOW + 2500 });
  const other = stageView(two, flowOf(two), SAMPLE_PLAN, CATALOG, { landed: [], spin: null, check: { ...back, unrevealed: { ...back.unrevealed, index: 3 } } });
  if (other.body.scene !== 'check') return assert.fail('not check');
  assert.equal(other.body.check.replay, null, 'an older step back');
});

test("D121: a review back on screen after another card's Check: its earlier reveals settled, no step back from before replayed", () => {
  const state = FIXTURES.checkResumed(NOW).state;
  assert.ok(state.check);
  // #57 had a step back (4 → 3) before its review; #204's Check came and went; #57 is back with the same 3 marks.
  const memory = { ...NO_CHECK_MEMORY, unrevealed: { claimId: state.check.claimId, index: 3, atMs: state.check.startAtMs - 1 } };
  const view = stageView(state, flowOf(state), SAMPLE_PLAN, CATALOG, { landed: [], spin: null, check: memory });
  if (view.body.scene !== 'check') return assert.fail('not check');
  const check = view.body.check;
  assert.equal(check.steps.length, 3);
  assert.equal(check.replay, null, 'no equaliser: the engine replays no snippet');
  assert.deepEqual(checkReveal(check, NOW), { steps: ['landed', 'landed', 'landed'], playing: null, replaying: null, result: null });
  assert.equal(typeReveal(check, NOW, 900), 'ok');
  assert.deepEqual(check.cells.filter((c) => c.step !== null).map((c) => c.step), [0, 1, 2, 3], 'the whole row, «Elefants» still to reveal');
});

test('a Check discarded from its review fades out while the next card comes', () => {
  const state = FIXTURES.checkReview(NOW).state;
  assert.ok(state.check);
  // The next card is on its way (queued); with none to come the round shows instead (stage/model/check.ts › shownCheck).
  const next = { ...state.claims[0], claimId: 'cl-next', status: 'queued' as const };
  const discarded: FlowState = { ...state, check: null, claims: [...state.claims.map((c) => ({ ...c, status: 'discarded' as const })), next] };
  const view = stageView(discarded, flowOf(discarded), SAMPLE_PLAN, CATALOG, { landed: [], spin: null, check: { ...NO_CHECK_MEMORY, last: state.check } });
  if (view.body.scene !== 'check') return assert.fail('not check');
  assert.equal(view.body.check.discarded, true);
});

test('an odd Check in a snapshot never breaks the projector', () => {
  const { state } = FIXTURES.check(NOW);
  for (const check of [{ claimId: 'x', cardId: 57, kind: 'line', outcome: 'incomplete', row: 2, startAtMs: NOW }, { ...state.check, revealed: undefined, steps: [], endAtMs: NOW }]) {
    const odd = { ...state, check } as unknown as FlowState;
    for (const catalog of [CATALOG, null]) {
      const view = stageView(odd, flowOf(odd), SAMPLE_PLAN, catalog);
      if (view.body.scene !== 'check') return assert.fail('not check');
      assert.deepEqual(view.body.check.steps, []);
    }
  }
});

test('celebration: the shout kind and the round, never the winning card numbers nor the prize (D311)', () => {
  const state = FIXTURES.celebrationBingo(NOW).state;
  const view = stageView(state, flowOf(state), SAMPLE_PLAN, CATALOG);
  assert.deepEqual(view.body, {
    scene: 'celebration',
    key: `3:bingo@${NOW - 1500}`,
    kind: 'bingo',
    round: { number: 3, special: false, desgraciat: false, label: 'Quina 3' },
  });
  assert.ok(!/\b(57|301)\b/.test(JSON.stringify(view)), 'no winning card number');
});

// D311: no prizes on the projector for now, revealed or not, on every screen that had one (and the Line's Celebration,
// which had none since D242).
const NO_PRIZE_SCREENS: [string, string, Partial<FlowState>, string][] = [
  ['a round\'s intro', 'roundStart', {}, 'Quina 4'],
  ['the Especial\'s intro', 'roundStart', { intro: { round: 7, kind: 'special', sinceMs: NOW } }, 'Quina Especial'],
  ['the Desgraciat\'s intro', 'desgraciatIntro', {}, 'Quina del Desgraciat'],
  ['a Line\'s Celebration', 'celebration', {}, 'Quina 3'],
  ['a Quina\'s Celebration', 'celebrationBingo', {}, 'Quina 3'],
  ['«QUINA POTRA!»', 'celebrationStanding', {}, 'Quina del Desgraciat'],
];
for (const [screen, fixture, patch, label] of NO_PRIZE_SCREENS) {
  test(`no prize on ${screen}, even with every round's prizes revealed (D311)`, () => {
    const state = allRevealed(fixture, patch);
    const view = stageView(state, flowOf(state), SAMPLE_PLAN, CATALOG);
    assert.ok(view.body.scene === 'roundStart' || view.body.scene === 'celebration', `${fixture}: ${view.body.scene}`);
    if (view.body.scene !== 'roundStart' && view.body.scene !== 'celebration') return;
    assert.equal(view.body.round?.label, label, 'the screen it is');
    assert.deepEqual(prizesIn(view), []);
  });
}

test("every Celebration names its round for the gold plate (U175 item 7): «Quina 3», «Quina del Desgraciat»", () => {
  for (const [name, label] of [['celebration', 'Quina 3'], ['celebrationStanding', 'Quina del Desgraciat']] as const) {
    const state = FIXTURES[name](NOW).state;
    const view = stageView(state, flowOf(state), SAMPLE_PLAN, CATALOG);
    if (view.body.scene !== 'celebration') return assert.fail(`${name}: not celebration`);
    assert.equal(view.body.round.label, label, name);
  }
});

test('no winning card number on the projector after a win: Celebration, Interval and the end of the night', () => {
  const winning = [12, 188, 77, 140, 123];
  for (const name of ['celebration', 'interval', 'after']) {
    const state = withSecrets(name);
    // Sponsors' placeholder names carry numbers too ("[Patrocinador 12]"): they aren't card numbers.
    const json = JSON.stringify(stageView(state, flowOf(state), SAMPLE_PLAN, CATALOG)).replaceAll(/\[Patrocinador \d+\]/g, '');
    for (const id of winning) assert.ok(!new RegExp(`\\b${id}\\b`).test(json), `${name}: card ${id} shown`);
  }
});

test('no prize reaches the projector in any scene, revealed or not (D311)', () => {
  assert.ok(PRIZE_WORDS.length >= 20, 'the sample plan has prizes to give away');
  for (const name of FIXTURE_NAMES) {
    const state = allRevealed(name);
    assert.deepEqual(prizesIn(stageView(state, flowOf(state), SAMPLE_PLAN, CATALOG)), [], name);
  }
});

test('a Check carries the card\'s printed type, which is public', () => {
  const state = FIXTURES.check(NOW).state;
  const view = stageView(state, flowOf(state), SAMPLE_PLAN, CATALOG);
  if (view.body.scene !== 'check') return assert.fail('not check');
  assert.deepEqual(view.body.check.cardType, { type: 'normal', label: 'Normal 1–5', color: '#cfe8ff', special: false, ok: true }, 'the type and side checked (D163)');
  const unknown: FlowState = { ...state, check: state.check ? { ...state.check, cardType: null } : null };
  const none = stageView(unknown, flowOf(unknown), SAMPLE_PLAN, CATALOG);
  if (none.body.scene !== 'check') return assert.fail('not check');
  assert.equal(none.body.check.cardType, null);
  // A special card claimed in a regular round: nothing is played, and its type fails at the cue.
  const wrong = cued('checkWrongType', 'fail');
  const failed = stageView(wrong, flowOf(wrong), SAMPLE_PLAN, CATALOG);
  if (failed.body.scene !== 'check') return assert.fail('not check');
  assert.deepEqual(failed.body.check.cardType, { type: 'especial', label: 'Desgraciat', color: '#ffd9e8', special: true, ok: false }, 'a side-1 round: side 1 named, as printed (D266)');
  assert.equal(failed.body.check.verdict, 'notValid');
  assert.deepEqual(failed.body.check.cells, []);
});

test("a side-2 round's Check draws the card's side 2 (CheckInfo.side), and its badge says so (D163)", () => {
  const started = FIXTURES.checkStarted(NOW).state;
  const one = stageView(started, flowOf(started), SAMPLE_PLAN, CATALOG);
  if (one.body.scene !== 'check') return assert.fail('not check');
  assert.deepEqual(one.body.check.cells.slice(0, 4).map((c) => c.songId), [5, 14, 64, 75], "side 1's top row");
  const state: FlowState = { ...started, round: { ...started.round, number: 6, side: 2, pool: '2' }, check: started.check && { ...started.check, side: 2 } };
  const two = stageView(state, flowOf(state), SAMPLE_PLAN, CATALOG);
  if (two.body.scene !== 'check') return assert.fail('not check');
  assert.deepEqual(two.body.check.cells.map((c) => c.songId), SIDE_2_OF_57.flat(), "side 2's 12 songs");
  assert.equal(two.body.check.cardType?.label, 'Normal 6–10');
});

test("the Especial round's Check draws the especial card's side 2, and its badge names it (D226)", () => {
  const started = FIXTURES.checkStarted(NOW).state;
  const round = { ...started.round, number: 7, kind: 'special' as const, cardType: 'especial', side: 2, pool: '2' };
  const state: FlowState = { ...started, round, check: started.check && { ...started.check, cardId: 508, cardType: 'especial', side: 2 } };
  const view = stageView(state, flowOf(state), SAMPLE_PLAN, CATALOG);
  if (view.body.scene !== 'check') return assert.fail('not check');
  assert.deepEqual(view.body.check.cells.map((c) => c.songId), SIDE_2_OF_508.flat(), "side 2's 12 songs, never side 1's");
  assert.deepEqual(view.body.check.cardType, { type: 'especial', label: 'Especial', color: '#ffd9e8', special: true, ok: true });
  const desgraciat: FlowState = { ...state, round: { ...round, number: 5, kind: 'desgraciat', side: 1, pool: '1' }, check: state.check && { ...state.check, side: 1 } };
  const one = stageView(desgraciat, flowOf(desgraciat), SAMPLE_PLAN, CATALOG);
  if (one.body.scene !== 'check') return assert.fail('not check');
  assert.deepEqual(one.body.check.cells.slice(0, 4).map((c) => c.songId), [31, 32, 39, 74], "the Desgraciat round: side 1's top row");
  assert.equal(one.body.check.cardType?.label, 'Desgraciat');
});

test('interval: the next round, the count and the countdown guide; no winners, no QR, no prizes', () => {
  const state = withSecrets('interval');
  const view = stageView(state, flowOf(state), SAMPLE_PLAN, CATALOG);
  if (view.body.scene !== 'interval') return assert.fail('not interval');
  assert.deepEqual(view.body, {
    scene: 'interval',
    nextRound: { number: 4, special: false, desgraciat: false, label: 'Quina 4' },
    plate: 'Següent: Quina 4 de 8',
    sinceMs: NOW - 40_000,
    guideEndMs: NOW + 140_000,
    sponsors: SAMPLE_PLAN.sponsors.map((s) => ({ label: s.name, logo: s.logo })),
    price: null,
  });
  // With prices in card-types.json, the coming round's card and its price (U5): round 4 plays the normal card.
  const priced = { ...CATALOG, cardTypes: readPrintedCardTypes([{ type: 'normal', name: 'Cartró normal', shortName: 'Normal', color: '#cfe8ff', title: '', priceCents: 150, priceRule: 'perRegularRound', sides: [{ side: 1, pool: '1', label: '1–5', checkLabel: 'Normal 1–5' }, { side: 2, pool: '2', label: '6–10', checkLabel: 'Normal 6–10' }] }]) };
  const withPrice = stageView(state, flowOf(state), SAMPLE_PLAN, priced);
  if (withPrice.body.scene !== 'interval') return assert.fail('not interval');
  const left = SAMPLE_PLAN.rounds.filter((r) => r.kind === 'normal' && r.number >= 4).length;
  assert.deepEqual(withPrice.body.price, { label: 'Cartró normal', color: '#cfe8ff', cents: 150 * left });
});

test('after: thanks and the sponsors only', () => {
  const state = FIXTURES.after(NOW).state;
  const view = stageView(state, flowOf(state), SAMPLE_PLAN, CATALOG);
  assert.deepEqual(view.body, { scene: 'after', sponsors: SAMPLE_PLAN.sponsors.map((s) => ({ label: s.name, logo: s.logo })) });
});

test('a technical pause shows over any scene', () => {
  const state = FIXTURES.pause(NOW).state;
  assert.equal(stageView(state, flowOf(state), null, null).paused, true);
  const play = FIXTURES.play(NOW).state;
  assert.equal(stageView(play, flowOf(play), null, null).paused, false);
});

test('the special round is labelled from the plan', () => {
  const { state } = FIXTURES.roundStart(NOW);
  const special: FlowState = { ...state, intro: { round: 7, kind: 'special', sinceMs: NOW } };
  const view = stageView(special, flowOf(special), SAMPLE_PLAN, null);
  if (view.body.scene !== 'roundStart') return assert.fail('not roundStart');
  assert.deepEqual(view.body.round, { number: 7, special: true, desgraciat: false, label: 'Quina Especial' }, 'no number');
  const unplanned = stageView(special, flowOf(special), null, null);
  if (unplanned.body.scene !== 'roundStart') return assert.fail('not roundStart');
  assert.deepEqual(unplanned.body.round, { number: 7, special: true, desgraciat: false, label: 'Quina Especial' }, 'without a plan, the intro\'s kind');
});

test('the round start names the round being introduced, before the Shuffle', () => {
  const { state } = FIXTURES.roundStart(NOW);
  const introduced: FlowState = { ...state, round: { ...state.round, number: 3 }, intro: { round: 4, kind: 'normal', sinceMs: NOW } };
  const view = stageView(introduced, flowOf(introduced), SAMPLE_PLAN, null);
  if (view.body.scene !== 'roundStart') return assert.fail('not roundStart');
  assert.equal(view.body.round?.number, 4);
});

test('without any state: the before scene, never a crash', () => {
  const view = stageView(null, flowOf(null), null, null);
  assert.equal(view.body.scene, 'before');
  assert.deepEqual(view.songs, []);
  assert.equal('heat' in view, false, 'the raw Heat never reaches the view: the garland eases the engine samples');
});

// ---- the Desgraciat round (Quina 5 in SAMPLE_PLAN) ----

test('the Desgraciat round is named "Quina del Desgraciat" in play, at its intro and in the Interval before it', () => {
  const play = stageView(FIXTURES.desgraciat(NOW).state, flowOf(FIXTURES.desgraciat(NOW).state), SAMPLE_PLAN, CATALOG);
  assert.equal(play.body.scene, 'play');
  if (play.body.scene !== 'play') return;
  assert.deepEqual(play.body.round, { number: 5, special: false, desgraciat: true, label: 'Quina del Desgraciat' });
  // Without a plan, the state's round kind says it.
  const bare = stageView(FIXTURES.desgraciat(NOW).state, flowOf(FIXTURES.desgraciat(NOW).state), null, null);
  assert.ok(bare.body.scene === 'play' && bare.body.round?.desgraciat);

  const introState = FIXTURES.desgraciatIntro(NOW).state;
  const intro = stageView(introState, flowOf(introState), SAMPLE_PLAN, CATALOG);
  assert.equal(intro.body.scene, 'roundStart');
  if (intro.body.scene !== 'roundStart') return;
  assert.equal(intro.body.round?.desgraciat, true);

  const intervalState = FIXTURES.intervalDesgraciat(NOW).state;
  const interval = stageView(intervalState, flowOf(intervalState), SAMPLE_PLAN, CATALOG);
  assert.ok(interval.body.scene === 'interval' && interval.body.nextRound.desgraciat && interval.body.nextRound.number === 5);
  assert.equal(interval.body.plate, 'Següent: Quina del Desgraciat', 'no number, no total');
});

test('a normal round after a special one is named by its Quina number, everywhere the stage names it', () => {
  // SAMPLE_PLAN: round 5 is the Desgraciat round and round 7 the Especial, so round 6 is Quina 5 and round 8 Quina 6.
  const { state } = FIXTURES.roundStart(NOW);
  const intro: FlowState = { ...state, intro: { round: 6, kind: 'normal', sinceMs: NOW } };
  const start = stageView(intro, flowOf(intro), SAMPLE_PLAN, null);
  assert.ok(start.body.scene === 'roundStart' && start.body.round?.label === 'Quina 5');
  const play = FIXTURES.play(NOW).state;
  const last: FlowState = { ...play, round: { ...play.round, number: 8 } };
  const playing = stageView(last, flowOf(last), SAMPLE_PLAN, null);
  assert.ok(playing.body.scene === 'play' && playing.body.round?.label === 'Quina 6');
  const interval = FIXTURES.interval(NOW).state;
  const before8: FlowState = { ...interval, interval: interval.interval && { ...interval.interval, nextRound: 8 } };
  const next = stageView(before8, flowOf(before8), SAMPLE_PLAN, null);
  assert.ok(next.body.scene === 'interval');
  assert.equal(next.body.plate, 'Següent: Quina 6 de 8', 'the total stays the plan\'s round count (pending U163)');
  // Without the plan the stage can't count the specials: a normal round keeps its plan number.
  const bare = stageView(last, flowOf(last), null, null);
  assert.ok(bare.body.scene === 'play' && bare.body.round?.label === 'Quina 8');
});

test('a standing Check: all 12 songs, no row dimmed; a fallen one names the song that sank it and lands its ✗ away from it', () => {
  const running = FIXTURES.checkStanding(NOW).state;
  const view = stageView(running, flowOf(running), SAMPLE_PLAN, null);
  assert.equal(view.body.scene, 'check');
  if (view.body.scene !== 'check') return;
  assert.equal(view.body.check.kind, 'standing');
  assert.equal(view.body.check.row, null, 'no row dims');
  assert.equal(view.body.check.verdict, null);
  assert.equal(plaqueSpot(view.body.check).over, 'card');

  const fallen = FIXTURES.checkCueFallen(NOW).state;
  const fell = stageView(fallen, flowOf(fallen), SAMPLE_PLAN, null);
  if (fell.body.scene !== 'check') return assert.fail('not check');
  assert.equal(fell.body.check.verdict, 'fallen');
  // Without the catalog only the revealed songs: «Limbo», the 7th, sank it.
  assert.deepEqual(firstMiss(fell.body.check), { step: 6, songId: 41, title: 'Limbo' });

  const valid = cued('checkStandingValid', 'pass');
  const passed = stageView(valid, flowOf(valid), SAMPLE_PLAN, CATALOG);
  assert.ok(passed.body.scene === 'check');
  if (passed.body.scene !== 'check') return;
  assert.equal(passed.body.check.verdict, 'complete');
  assert.equal(passed.body.check.cells.length, 12);
  assert.ok(passed.body.check.cells.every((cell) => cell.step !== null), 'every song can be revealed');
  assert.equal(passed.body.check.steps.length, 12);
  assert.equal(firstMiss(passed.body.check), null);
});

test('the last card standing is celebrated with no prize (D311) and no card number', () => {
  const state = FIXTURES.celebrationStanding(NOW).state;
  const view = stageView(state, flowOf(state), SAMPLE_PLAN, CATALOG);
  assert.equal(view.body.scene, 'celebration');
  if (view.body.scene !== 'celebration') return;
  assert.equal(view.body.kind, 'standing');
  assert.deepEqual(prizesIn(view), []);
  assert.ok(!/\b57\b/.test(JSON.stringify(view.body)), 'no winning card number');
});

test("the finale shows its finalists' numbers and fates on stage (D161), never another standing card or a card's songs", () => {
  // (The secrets are checked in every fixture above; withSecrets also starts a Spin, which would clear the fallen.)
  const fixture = FIXTURES.finaleFallen(NOW).state;
  // A card still standing in the round who isn't on stage (#4321) must never show.
  const state = { ...fixture, standing: { count: 6, cardIds: [...(fixture.standing?.cardIds ?? []), 4321] } };
  const view = stageView(state, flowOf(state), SAMPLE_PLAN, CATALOG);
  assert.equal(view.body.scene, 'play');
  if (view.body.scene !== 'play') return;
  const finale = view.body.finale;
  assert.ok(finale);
  assert.deepEqual(finale.ninos.map((n) => [n.number, n.fate]), [[34, 'up'], [56, 'up'], [57, 'up'], [72, 'up'], [81, 'up'], [99, 'down'], [140, 'down'], [184, 'down']]);
  // Only these facts per finalist: no songs, no card, nothing of the round's other standing cards.
  assert.ok(finale.ninos.every((n) => Object.keys(n).sort().join() === 'fate,hue,number,pose,sinceMs'));
  assert.deepEqual(Object.keys(finale).sort(), ['key', 'ninos', 'savedAtMs']);
  assert.ok(!JSON.stringify(view).includes('4321'), 'a standing card not on stage never shows');
});

test('the Desgraciat Celebration reads «QUINA POTRA!» on the projector (D186), with no card number', () => {
  const state = FIXTURES.finaleCelebration(NOW).state;
  const view = stageView(state, flowOf(state), SAMPLE_PLAN, CATALOG);
  assert.equal(view.body.scene, 'celebration');
  if (view.body.scene !== 'celebration') return;
  assert.equal(STAGE_TEXT.shout[view.body.kind], 'QUINA POTRA!');
  assert.ok(!/\b57\b/.test(JSON.stringify(view.body)), 'no winning card number');
});
