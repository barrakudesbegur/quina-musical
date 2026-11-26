// Pools and card sides (step A, D178, D171): a repertoire's songs each belong to a pool; a card type's sides each play
// a pool (card-types.json); a round plays one side, so its Queue is a Shuffle of that side's pool and only that side's
// lines count. The plan, the commands, the journal, the record and the resume token carry the side.
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  cardTypeSides, checkGamePlan, formatResumeToken, isPoolId, parseResumeToken, replayJournal, sidePool, sideLabel, sideWarnings,
  type CardTypeSides, type JournalEntry,
} from '@quina/protocol';
import { cardFace, validCards, type PrintedCard } from '../engine/src/game/cards.ts';
import { FLOW } from '../engine/src/config.ts';
import { seededRandom } from '../engine/src/rng.ts';
import { dataTest } from './support/data.ts';
import { setup, songs, type Harness } from './support/harness.ts';

const TYPES: CardTypeSides[] = [
  { type: 'normal', name: 'Normal', sides: [{ side: 1, pool: '1', label: '1-4' }, { side: 2, pool: '2', label: '5-10' }] },
  { type: 'especial', name: 'Especial', sides: [{ side: 1, pool: '1' }] },
];

test('a card type\'s sides and pools, and the label the Check shows (D163)', () => {
  assert.deepEqual(cardTypeSides(TYPES[0]).map((s) => [s.side, s.pool]), [[1, '1'], [2, '2']]);
  assert.deepEqual(cardTypeSides({ type: 'old' }), [{ side: 1, pool: '1' }], 'a type from before sides');
  assert.equal(sidePool(TYPES, 'normal', 2), '2');
  assert.equal(sidePool(TYPES, 'especial', 2), null, 'no such side');
  assert.equal(sidePool(TYPES, 'nope', 1), null, 'an unknown type');
  assert.equal(sidePool([], 'normal', 1), '1', 'without card-types.json: side 1 on pool 1');
  assert.equal(sidePool([], 'normal', 2), null);
  assert.deepEqual([sideLabel(TYPES, 'normal', 1), sideLabel(TYPES, 'normal', 2), sideLabel(TYPES, 'especial', 1)], ['Normal 1-4', 'Normal 5-10', 'Especial']);
  assert.ok(isPoolId('1') && isPoolId('2') && !isPoolId('') && !isPoolId('Pool 1'));
});

test('a printed card\'s face on a side; an old card is its own side 1', () => {
  const twoSided: PrintedCard = { id: 7, type: 'normal', sides: [{ side: 1, lines: [[1, 2, 3, 4]] }, { side: 2, lines: [[101, 102, 103, 104]] }] };
  assert.deepEqual(cardFace(twoSided, 2), { id: 7, type: 'normal', lines: [[101, 102, 103, 104]] });
  assert.equal(cardFace(twoSided, 3), null);
  const old: PrintedCard = { id: 8, type: 'normal', lines: [[1, 2, 3, 4]] };
  assert.equal(cardFace(old, 1), old, 'itself');
  assert.equal(cardFace(old, 2), null);
  assert.deepEqual(validCards([twoSided, old], [7, 8], 'normal', 2).map((c) => [c.id, c.lines[0][0]]), [[7, 101]], 'only cards printed with that side');
});

test('the plan: a round may name its side (absent: 1); sideWarnings checks it against the card types', () => {
  const plan = (rounds: unknown[]) => ({
    v: 3, edition: '26', title: 'Quina Quina 3', prizeReveal: 'perRound', sponsors: [], rounds,
    schedule: { startAtMs: null, roundMinutes: 25, intervalMinutes: 3 }, cheatSheet: { claimRules: [], specialRoundRules: [] },
  });
  const r = (number: number, extra: object = {}) => ({ number, kind: 'normal', line: [], bingo: [], ...extra });
  const ok = checkGamePlan(plan([r(1), r(2, { side: 2 })]));
  assert.ok(ok.ok);
  assert.deepEqual(ok.plan.rounds.map((x) => x.side), [undefined, 2], 'a plan without sides reads back unchanged');
  const bad = checkGamePlan(plan([r(1, { side: 0 })]));
  assert.ok(!bad.ok && bad.errors.some((e) => e.startsWith('plan.rounds[0].side')));
  assert.deepEqual(sideWarnings(ok.plan, TYPES), [], 'both sides of the normal card play');
  assert.deepEqual(sideWarnings({ rounds: [ok.plan.rounds[0]] }, TYPES).map((w) => w.message), ['no round plays side 2 of card type "normal"']);
  const third = checkGamePlan(plan([r(1), r(2, { side: 3 })]));
  assert.ok(third.ok);
  assert.deepEqual(sideWarnings(third.plan, TYPES).map((w) => w.path), ['plan.rounds[1].side', 'plan.rounds']);
  assert.deepEqual(sideWarnings(ok.plan, TYPES, { 1: 70 }).map((w) => w.message), ['side 2 plays pool 2, which has no songs']);
});

test('the resume token carries a side other than 1 as C<n>', () => {
  const point = { round: 6, kind: 'normal' as const, cardType: 'normal', side: 2, shuffleSeed: 123456, shuffleAttempts: 0, position: 9, lastSongId: 40, lineConfirmedFrom: null };
  const text = formatResumeToken(point);
  assert.match(text, /-C2$/);
  assert.deepEqual(parseResumeToken(text), point);
  assert.doesNotMatch(formatResumeToken({ ...point, side: 1 }), /-C/);
  assert.equal(parseResumeToken(`${text.slice(0, -1)}0`), null, 'side 0 is not a side');
});

/** The test songs split into two pools (the first 38 and the rest), and two-sided cards drawn from them. */
function twoPools(seed = 3): { repertoire: typeof songs; cards: PrintedCard[]; pool1: Set<number>; pool2: Set<number> } {
  const repertoire = songs.map((s, i) => ({ ...s, pool: i < 38 ? '1' : '2' }));
  const pool1 = new Set(repertoire.filter((s) => s.pool === '1').map((s) => s.id));
  const pool2 = new Set(repertoire.filter((s) => s.pool === '2').map((s) => s.id));
  const rng = seededRandom(seed);
  const pick = (ids: number[]) => {
    const left = [...ids];
    const out: number[] = [];
    while (out.length < 12) out.push(...left.splice(Math.floor(rng() * left.length), 1));
    return [out.slice(0, 4), out.slice(4, 8), out.slice(8, 12)];
  };
  const cards: PrintedCard[] = Array.from({ length: 40 }, (_, i) => ({
    id: i + 1, type: 'normal', sides: [{ side: 1, lines: pick([...pool1]) }, { side: 2, lines: pick([...pool2]) }],
  }));
  return { repertoire, cards, pool1, pool2 };
}

function sideTwo(h: Harness) {
  h.send('unlock');
  h.send('roundIntro', { number: 5, kind: 'normal', cardType: 'normal', side: 2 });
  h.send('newRound');
  h.advance(FLOW.shuffleSec + 0.1);
}

const journalOf = (log: readonly { type: string }[]) => log.flatMap((e) => (e.type === 'journal' ? [(e as unknown as { entry: JournalEntry }).entry] : []));

dataTest("a round on side 2 shuffles only pool 2, counts side 2's lines, and journals and resumes its side", () => {
  const { repertoire, cards, pool2 } = twoPools();
  const h = setup({ seed: 9, songs: repertoire, cards, cardTypes: TYPES, cardsInPlay: '1-40', settings: { autoAdvance: false } });
  sideTwo(h);
  const state = h.show.snapshot();
  assert.deepEqual([state.round.number, state.round.side, state.round.pool], [5, 2, '2']);
  assert.equal(h.show.queue.length, pool2.size);
  assert.ok(h.show.queue.every((id) => pool2.has(id)), 'the Queue is a Shuffle of pool 2 only');
  assert.ok(h.show.phaseModel.valid.every((c) => c.lines.flat().every((id) => pool2.has(id as number))), "side 2's lines count");
  const started = journalOf(h.log).find((e) => e.kind === 'round.started' && e.round === 5);
  assert.equal(started?.kind === 'round.started' && started.side, 2);
  // A claim's Check reads side 2.
  h.send('next');
  h.until(() => h.show.status === 'playing');
  h.send('claim', { cardId: 3, kind: 'line' });
  assert.equal(h.show.snapshot().check?.side, 2);
  // The record and the resume token carry the side; a fresh page rebuilds the same Queue from the token.
  const record = replayJournal(journalOf(h.log));
  assert.deepEqual(record, h.show.record());
  assert.equal(record.round?.side, 2);
  const token = h.show.snapshot().resume;
  assert.ok(token && token.side === 2 && /-C2/.test(token.text));
  const { text: _text, ...fields } = token;
  const b = setup({ seed: 77, songs: repertoire, cards, cardTypes: TYPES, cardsInPlay: '1-40', settings: { autoAdvance: false } });
  assert.deepEqual(b.dispatch({ v: 1, type: 'cmd', cmd: 'resumeAt', reqId: 'r', ...fields }).filter((e) => e.type === 'reject'), []);
  assert.deepEqual(b.show.queue, h.show.queue);
  assert.deepEqual([b.show.round.side, b.show.round.pool], [2, '2']);
  // A restarted page resumes the side from the journal.
  const r = setup({ seed: 5, songs: repertoire, cards, cardTypes: TYPES, restore: record, startSec: 0.5 });
  assert.deepEqual([r.show.round.side, r.show.round.pool], [2, '2']);
});

dataTest('a side its card type lacks is refused; the plan gives a round its side when the command names none', () => {
  const { repertoire, cards, pool1 } = twoPools();
  const h = setup({ seed: 4, songs: repertoire, cards, cardTypes: TYPES, cardsInPlay: '1-40', settings: { autoAdvance: false } });
  h.send('unlock');
  const out = h.send('roundIntro', { number: 2, kind: 'special', cardType: 'especial', side: 2 });
  assert.deepEqual(out.flatMap((e) => (e.type === 'reject' ? [e.reason] : [])), ['invalid']);
  // Side 1 plays pool 1.
  h.send('roundIntro', { number: 2, kind: 'normal', cardType: 'normal' });
  h.send('newRound');
  assert.ok(h.show.queue.every((id) => pool1.has(id)));
  // The plan's round 6 is on side 2.
  const plan = {
    v: 3, edition: '26', title: 'Q', prizeReveal: 'perRound', sponsors: [],
    rounds: Array.from({ length: 6 }, (_, i) => ({ number: i + 1, kind: 'normal', line: [], bingo: [], ...(i === 5 ? { side: 2 } : {}) })),
    schedule: { startAtMs: null, roundMinutes: 25, intervalMinutes: 3 }, cheatSheet: { claimRules: [], specialRoundRules: [] },
  };
  const checked = checkGamePlan(plan);
  assert.ok(checked.ok);
  const p = setup({ seed: 4, songs: repertoire, cards, cardTypes: TYPES, cardsInPlay: '1-40', settings: { autoAdvance: false } });
  p.send('unlock');
  p.show.setPlan(checked.plan);
  p.send('roundIntro', { number: 6, kind: 'normal', cardType: 'normal' });
  assert.equal(p.show.snapshot().intro?.side, 2);
  p.send('newRound');
  assert.deepEqual([p.show.round.side, p.show.round.pool], [2, '2']);
});

dataTest('first plays per pool (D174, D178): a round on a new pool starts with all its songs new', () => {
  const { repertoire, cards } = twoPools();
  const h = setup({ seed: 6, songs: repertoire, cards, cardTypes: TYPES, cardsInPlay: '1-40', settings: { autoAdvance: false } });
  h.send('unlock');
  const left = h.show.poolsLeft();
  assert.deepEqual(Object.keys(left).sort(), ['1', '2']);
  assert.equal(left['2'].unplayed, left['2'].songs, 'nothing of pool 2 is played in a pool 1 round');
  assert.ok(left['1'].unplayed < left['1'].songs);
});
