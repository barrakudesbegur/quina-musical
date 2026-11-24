// The projector's privacy boundary: stageView must never let a secret out, in any scene, and must draw each
// scene from the right data (fixtures from ui/fixtures).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { flowOf, type FlowState } from '../../../../../packages/ui/flow.ts';
import { FIXTURES, FIXTURE_NAMES } from '../../../../../packages/ui/fixtures/states.ts';
import { SAMPLE_PLAN } from '../../../../../packages/ui/fixtures/plan.ts';
import { parseCards, type Catalog } from '../../../../../packages/ui/data/catalog.ts';
import { stageView, type StageView } from '../../../../stage/view.ts';
import { firstMiss, plaqueSpot } from '../../../../stage/model/check.ts';

const NOW = 1_800_000_000_000;

/** A tiny catalog: card 57 and card 123 as printed (row songs as in the fixtures). */
const song = (id: number) => ({ id, title: `Song ${id}`, artist: `Artist ${id}` });
const CATALOG: Catalog = parseCards([
  { id: 57, type: 'normal', lines: [[5, 14, 64, 75], [15, 18, 60, 69], [2, 62, 16, 20]].map((l) => l.map(song)) },
  { id: 123, type: 'normal', lines: [[2, 17, 41, 69], [11, 15, 31, 64], [3, 55, 66, 68]].map((l) => l.map(song)) },
]);

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
    future: { lineAt: 4242, bingoAt: 4343, toLine: [0, 7], toBingo: [], markCounts: [5, 6] },
    hold: { sinceMs: NOW, reason: 'hold', holdMusic: false, holdMusicAtMs: null, ducked: false },
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
        outcome: null,
        completeSince: 41,
        warnings: ['notSold'],
      },
    ],
    winners: [
      ...(state.winners ?? []),
      { round: 3, kind: 'line', cardId: 123, claimId: SECRET.claimId, winningSongId: 69, position: 3, atMs: NOW, name: SECRET.winnerName, notes: SECRET.winnerNotes },
    ],
  };
}

// Winning card numbers aren't secret, but the projector never shows them: no list of winners or cards comes out.
const FORBIDDEN_KEYS = ['winners', 'lastWinners', 'cardIds', 'next', 'queue', 'possibleWinners', 'future', 'lineAt', 'bingoAt', 'toLine', 'toBingo', 'markCounts', 'ducked', 'claims', 'claimId', 'warnings', 'completeSince', 'otherRows', 'winningSongId', 'name', 'notes', 'phase', 'history', 'to', 'targetId', 'pace', 'schedule', 'game', 'cards', 'hold', 'status'];

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
  for (const id of [SECRET.nextSongId, SECRET.transitionTo, SECRET.possibleWinnerCard, SECRET.queuedClaimCard, 777]) {
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
  assert.deepEqual(view.body.round, { number: 3, special: false });
  assert.deepEqual(view.body.motion, { kind: 'spin', startAtMs: null, landAtMs: NOW + 5000, sinceMs: null, autoReleaseAtMs: null });
});

test('before: start time, the night\'s card types, sponsors and the player app link from the plan', () => {
  const state = FIXTURES.before(NOW).state;
  const plan = { ...SAMPLE_PLAN, schedule: { ...SAMPLE_PLAN.schedule, startAtMs: NOW + 600_000 } };
  const view = stageView(state, flowOf(state), plan, null);
  assert.equal(view.title, 'Quina Quina 3', "the edition's name");
  assert.deepEqual(view.body, {
    scene: 'before',
    startAtMs: NOW + 600_000,
    cardTypes: [
      { type: 'normal', label: 'Cartró normal', color: '#cfe8ff', priceCents: null, regularRounds: [1, 2, 3, 4, 5, 6, 8], special: false },
      { type: 'especial', label: 'Cartró especial', color: '#ffd9e8', priceCents: null, regularRounds: [], special: true },
    ],
    sponsors: SAMPLE_PLAN.sponsors.map((s) => ({ label: s.name, logo: s.logo })),
    link: { href: 'https://quina.barrakudesbegur.org/26', label: 'quina.barrakudesbegur.org/26' },
  });
  const none = stageView(state, flowOf(state), null, null);
  if (none.body.scene !== 'before') return assert.fail('not before');
  assert.deepEqual(none.body.cardTypes, [], 'no plan: no preview');
});

test('roundStart: headline prizes with sponsors and how many more; the Shuffle grid by song id, its window from the engine', () => {
  const state = FIXTURES.shuffle(NOW).state;
  const view = stageView(state, flowOf(state), SAMPLE_PLAN, CATALOG);
  assert.equal(view.body.scene, 'roundStart');
  if (view.body.scene !== 'roundStart') return;
  assert.deepEqual(view.body.round, { number: 4, special: false });
  assert.deepEqual(view.body.prizes, [
    { kind: 'line', title: '[Premi de línia 4]', detail: null, sponsor: '[Patrocinador 2]', more: 2 },
    { kind: 'bingo', title: '[Premi de quina 4]', detail: null, sponsor: '[Patrocinador 1]', more: 4 },
  ]);
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
  assert.equal(view.body.roundsTotal, 8, 'falls back to the engine setting');
});

test('check: the card grid from the catalog, the Line row, the steps', () => {
  const state = FIXTURES.check(NOW).state;
  const view = stageView(state, flowOf(state), SAMPLE_PLAN, CATALOG);
  assert.equal(view.body.scene, 'check');
  if (view.body.scene !== 'check') return;
  const c = view.body.check;
  assert.equal(c.cardId, 57);
  assert.equal(c.verdict, 'incomplete');
  assert.equal(c.row, 2);
  assert.equal(c.cells.length, 12);
  assert.deepEqual(c.cells.filter((cell) => cell.step !== null).map((cell) => cell.row), [2, 2, 2, 2]);
  assert.deepEqual(c.steps.map((s) => s.landed), [true, true, true, false]);
});

test('check without the catalog: only the played songs', () => {
  const state = FIXTURES.check(NOW).state;
  const view = stageView(state, flowOf(state), SAMPLE_PLAN, null);
  if (view.body.scene !== 'check') return assert.fail('not check');
  assert.deepEqual(view.body.check.cells.map((c) => [c.songId, c.row, c.col]), [[2, 2, 0], [62, 2, 1], [16, 2, 2], [20, 2, 3]]);
});

test('a failed check: the first song that didn\'t sound is named from the catalog, its tile is on the Line\'s row', () => {
  const state = FIXTURES.check(NOW).state;
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

test('check of an unknown or wrong-type card: not valid, no steps, no grid', () => {
  const { state } = FIXTURES.check(NOW);
  const bad: FlowState = { ...state, check: state.check ? { ...state.check, outcome: 'unknownCard', steps: [] } : null };
  const view = stageView(bad, flowOf(bad), SAMPLE_PLAN, CATALOG);
  if (view.body.scene !== 'check') return assert.fail('not check');
  assert.equal(view.body.check.verdict, 'notValid');
  assert.deepEqual(view.body.check.cells, []);
});

test('celebration: the shout kind and the round prize, never the winning card numbers', () => {
  const state = FIXTURES.celebrationBingo(NOW).state;
  const view = stageView(state, flowOf(state), SAMPLE_PLAN, CATALOG);
  assert.deepEqual(view.body, {
    scene: 'celebration',
    key: `3:bingo@${NOW - 1500}`,
    kind: 'bingo',
    prize: { kind: 'bingo', title: '[Premi de quina 3]', detail: null, sponsor: '[Patrocinador 1]', more: 3 },
  });
  assert.ok(!/\b(57|301)\b/.test(JSON.stringify(view)), 'no winning card number');
});

test('no winning card number on the projector after a win: Celebration, Interval and the end of the night', () => {
  const winning = [12, 188, 77, 140, 123];
  for (const name of ['celebration', 'interval', 'after']) {
    const state = withSecrets(name);
    const json = JSON.stringify(stageView(state, flowOf(state), SAMPLE_PLAN, CATALOG));
    for (const id of winning) assert.ok(!new RegExp(`\\b${id}\\b`).test(json), `${name}: card ${id} shown`);
  }
});

test('two headline prizes share one block: titles and sponsors joined, no single detail', () => {
  const { state } = FIXTURES.roundStart(NOW);
  const last: FlowState = { ...state, intro: { round: 8, kind: 'normal', sinceMs: NOW }, prizes: { revealed: [{ round: 8, by: 'intro' }] } };
  const view = stageView(last, flowOf(last), SAMPLE_PLAN, null);
  if (view.body.scene !== 'roundStart') return assert.fail('not roundStart');
  assert.deepEqual(view.body.prizes[1], { kind: 'bingo', title: '[Premi de quina 8] i [Gran premi final]', detail: null, sponsor: 'Barrakudes i [Patrocinador 2]', more: 4 });
});

test('secret prizes never reach the projector: only revealed rounds show theirs, and never in the Interval', () => {
  // The Interval before round 4 is introduced: its prizes are still secret.
  const interval = FIXTURES.interval(NOW).state;
  const view = stageView(interval, flowOf(interval), SAMPLE_PLAN, null);
  if (view.body.scene !== 'interval') return assert.fail('not interval');
  assert.ok(!JSON.stringify(view).includes('Premi de'));
  // Even revealed early from the console, the Interval shows none: they show at the round's intro.
  const revealed: FlowState = { ...interval, prizes: { revealed: [{ round: 4, by: 'presenters' }] } };
  const shown = stageView(revealed, flowOf(revealed), SAMPLE_PLAN, null);
  assert.ok(!JSON.stringify(shown).includes('Premi de'));
  const introduced: FlowState = { ...FIXTURES.roundStart(NOW).state, prizes: { revealed: [{ round: 4, by: 'presenters' }] } };
  const atIntro4 = stageView(introduced, flowOf(introduced), SAMPLE_PLAN, null);
  if (atIntro4.body.scene !== 'roundStart') return assert.fail('not roundStart');
  assert.equal(atIntro4.body.prizes[0]?.title, '[Premi de línia 4]');
  // All secret: introducing a round doesn't reveal it, and the Celebration shows no prize either.
  const secret = { ...SAMPLE_PLAN, prizeReveal: 'allSecret' as const };
  const intro = FIXTURES.roundStart(NOW).state;
  const atIntro = stageView(intro, flowOf(intro), secret, null);
  if (atIntro.body.scene !== 'roundStart') return assert.fail('not roundStart');
  assert.deepEqual(atIntro.body.prizes, []);
  const celebration = FIXTURES.celebrationBingo(NOW).state;
  const won = stageView(celebration, flowOf(celebration), secret, null);
  if (won.body.scene !== 'celebration') return assert.fail('not celebration');
  assert.equal(won.body.prize, null);
  // An engine that doesn't report reveals: every round, as before.
  const old: FlowState = { ...FIXTURES.roundStart(NOW).state, prizes: undefined };
  const fromOld = stageView(old, flowOf(old), SAMPLE_PLAN, null);
  if (fromOld.body.scene !== 'roundStart') return assert.fail('not roundStart');
  assert.equal(fromOld.body.prizes.length, 2);
});

test('a Check carries the card\'s printed type, which is public', () => {
  const state = FIXTURES.check(NOW).state;
  const view = stageView(state, flowOf(state), SAMPLE_PLAN, CATALOG);
  if (view.body.scene !== 'check') return assert.fail('not check');
  assert.deepEqual(view.body.check.cardType, { type: 'normal', label: 'Cartró normal', color: '#cfe8ff', special: false, ok: true });
  const unknown: FlowState = { ...state, check: state.check ? { ...state.check, outcome: 'unknownCard', cardType: null, steps: [] } : null };
  const none = stageView(unknown, flowOf(unknown), SAMPLE_PLAN, CATALOG);
  if (none.body.scene !== 'check') return assert.fail('not check');
  assert.equal(none.body.check.cardType, null);
  // A special card claimed in a regular round: its type fails, and nothing is played.
  const wrong = FIXTURES.checkWrongType(NOW).state;
  const failed = stageView(wrong, flowOf(wrong), SAMPLE_PLAN, CATALOG);
  if (failed.body.scene !== 'check') return assert.fail('not check');
  assert.deepEqual(failed.body.check.cardType, { type: 'especial', label: 'Cartró especial', color: '#ffd9e8', special: true, ok: false });
  assert.equal(failed.body.check.verdict, 'notValid');
  assert.deepEqual(failed.body.check.cells, []);
});

test('interval: the next round, the count and the countdown guide; no winners, no QR, no prizes', () => {
  const state = withSecrets('interval');
  const view = stageView(state, flowOf(state), SAMPLE_PLAN, CATALOG);
  if (view.body.scene !== 'interval') return assert.fail('not interval');
  assert.deepEqual(view.body, {
    scene: 'interval',
    nextRound: { number: 4, special: false },
    roundsTotal: 8,
    sinceMs: NOW - 40_000,
    guideEndMs: NOW + 140_000,
    sponsors: SAMPLE_PLAN.sponsors.map((s) => ({ label: s.name, logo: s.logo })),
  });
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
  assert.deepEqual(view.body.round, { number: 7, special: true });
  const unplanned = stageView(special, flowOf(special), null, null);
  if (unplanned.body.scene !== 'roundStart') return assert.fail('not roundStart');
  assert.deepEqual(unplanned.body.round, { number: 7, special: true }, 'without a plan, the intro\'s kind');
});

test('the round start names the round being introduced, before the Shuffle', () => {
  const { state } = FIXTURES.roundStart(NOW);
  const introduced: FlowState = { ...state, round: { ...state.round, number: 3 }, intro: { round: 4, kind: 'normal', sinceMs: NOW } };
  const view = stageView(introduced, flowOf(introduced), SAMPLE_PLAN, null);
  if (view.body.scene !== 'roundStart') return assert.fail('not roundStart');
  assert.equal(view.body.round?.number, 4);
  assert.equal(view.body.prizes[0]?.title, '[Premi de línia 4]');
});

test('without any state: the before scene, never a crash', () => {
  const view = stageView(null, flowOf(null), null, null);
  assert.equal(view.body.scene, 'before');
  assert.deepEqual(view.songs, []);
  assert.equal('heat' in view, false, 'the raw Heat never reaches the view: the garland eases the engine samples');
});
