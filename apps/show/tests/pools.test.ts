// Pools and card sides (step A, D178, D193, D226): a repertoire's songs each belong to a pool; a card type's sides each play
// a pool (card-types.json); a round plays one side, so its Queue is a Shuffle of that side's pool and only that side's
// lines count. The plan, the commands, the journal, the record and the resume token carry the side.
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  cardTypeSides, checkGamePlan, formatResumeToken, isPoolId, parseResumeToken, replayJournal, sidePool, sideWarnings,
  type CardTypeSides, type JournalEntry,
} from '@quina/protocol';
import { cardFace, validCards, type PrintedCard } from '../engine/src/game/cards.ts';
import { FLOW, SCHEDULE } from '../engine/src/config.ts';
import { roundSongs } from '../engine/src/plan/pace.ts';
import { seededRandom } from '../engine/src/rng.ts';
import { dataTest } from './support/data.ts';
import { setup, songs, type Harness } from './support/harness.ts';
import type { SongInfo } from '../engine/src/show/show.ts';
import { indexPools } from '../engine/src/analysis.ts';

const TYPES: CardTypeSides[] = [
  { type: 'normal', name: 'Normal', sides: [{ side: 1, pool: '1', label: '1-5' }, { side: 2, pool: '2', label: '6-10' }] },
  // D226: the especial card's side 1 (pool 1) plays the Desgraciat, its side 2 (pool 2) the Especial; card-types.json's labels (D251: «Desgraciat», never «Desgraciada»).
  { type: 'especial', name: 'Especial', sides: [{ side: 1, pool: '1', label: 'Desgraciat' }, { side: 2, pool: '2', label: 'Quina Especial' }] },
];

test('a card type\'s sides and pools', () => {
  assert.deepEqual(cardTypeSides(TYPES[0]).map((s) => [s.side, s.pool]), [[1, '1'], [2, '2']]);
  assert.deepEqual(cardTypeSides({ type: 'old' }), [{ side: 1, pool: '1' }], 'a type from before sides');
  assert.equal(sidePool(TYPES, 'normal', 2), '2');
  assert.equal(sidePool(TYPES, 'especial', 2), '2', "the especial card's side 2 (D226)");
  assert.equal(sidePool(TYPES, 'especial', 3), null, 'no such side');
  assert.equal(sidePool(TYPES, 'nope', 1), null, 'an unknown type');
  assert.equal(sidePool([], 'normal', 1), '1', 'without card-types.json: side 1 on pool 1');
  assert.equal(sidePool([], 'normal', 2), null);
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

/**
 * The test songs split into two pools (the first 38 and the rest), and two-sided cards drawn from them: normal 1–40,
 * especial 41–60. With `shared`, the first that many songs are in both pools (D268), as 2026's 4 are.
 */
function twoPools(seed = 3, shared = 0): { repertoire: SongInfo[]; cards: PrintedCard[]; pool1: Set<number>; pool2: Set<number> } {
  const repertoire: SongInfo[] = songs.map((s, i) => ({ ...s, pools: i < shared ? ['1', '2'] : [i < 38 ? '1' : '2'] }));
  const pool1 = new Set(repertoire.filter((s) => s.pools?.includes('1')).map((s) => s.id));
  const pool2 = new Set(repertoire.filter((s) => s.pools?.includes('2')).map((s) => s.id));
  const rng = seededRandom(seed);
  const pick = (ids: number[]) => {
    const left = [...ids];
    const out: number[] = [];
    while (out.length < 12) out.push(...left.splice(Math.floor(rng() * left.length), 1));
    return [out.slice(0, 4), out.slice(4, 8), out.slice(8, 12)];
  };
  const cards: PrintedCard[] = Array.from({ length: 60 }, (_, i) => ({
    id: i + 1, type: i < 40 ? 'normal' : 'especial', sides: [{ side: 1, lines: pick([...pool1]) }, { side: 2, lines: pick([...pool2]) }],
  }));
  return { repertoire, cards, pool1, pool2 };
}

function sideTwo(h: Harness) {
  h.send('unlock');
  h.send('roundIntro', { number: 6, kind: 'normal', cardType: 'normal', side: 2 });
  h.send('newRound');
  h.advance(FLOW.shuffleSec + 0.1);
}

const journalOf = (log: readonly { type: string }[]) => log.flatMap((e) => (e.type === 'journal' ? [(e as unknown as { entry: JournalEntry }).entry] : []));

dataTest("a round on side 2 shuffles only pool 2, counts side 2's lines, and journals and resumes its side", () => {
  const { repertoire, cards, pool2 } = twoPools();
  const h = setup({ seed: 9, songs: repertoire, cards, cardTypes: TYPES, cardsInPlay: '1-40', settings: { autoAdvance: false } });
  sideTwo(h);
  const state = h.show.snapshot();
  assert.deepEqual([state.round.number, state.round.side, state.round.pool], [6, 2, '2']);
  assert.equal(h.show.queue.length, pool2.size);
  assert.ok(h.show.queue.every((id) => pool2.has(id)), 'the Queue is a Shuffle of pool 2 only');
  assert.ok(h.show.phaseModel.valid.every((c) => c.lines.flat().every((id) => pool2.has(id as number))), "side 2's lines count");
  const started = journalOf(h.log).find((e) => e.kind === 'round.started' && e.round === 6);
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
  const out = h.send('roundIntro', { number: 2, kind: 'special', cardType: 'especial', side: 3 });
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

test("a song's pools as the analysis index gives them (D268); none is pool 1", () => {
  assert.deepEqual(indexPools({ pools: ['2', '1'] }), ['1', '2'], 'sorted');
  assert.deepEqual(indexPools({ pools: ['2'] }), ['2']);
  assert.deepEqual(indexPools({}), ['1'], 'a repertoire never split into pools');
  assert.deepEqual(indexPools({ pools: [] }), ['1']);
});

dataTest('a song in both pools (D268) is in both rounds\' Queues and counts in each pool', () => {
  const { repertoire, cards, pool1, pool2 } = twoPools(3, 4);
  const shared = repertoire.slice(0, 4).map((s) => s.id);
  assert.equal(pool1.size, 38);
  assert.equal(pool2.size, songs.length - 38 + 4);
  // Side 1 plays pool 1, side 2 pool 2: each Queue is a Shuffle of all its pool's members, the shared songs included.
  const one = setup({ seed: 4, songs: repertoire, cards, cardTypes: TYPES, cardsInPlay: '1-40', settings: { autoAdvance: false } });
  one.send('unlock');
  one.send('roundIntro', { number: 1, kind: 'normal', cardType: 'normal', side: 1 });
  one.send('newRound');
  assert.deepEqual([...one.show.queue].sort((a, b) => a - b), [...pool1].sort((a, b) => a - b));
  const two = setup({ seed: 4, songs: repertoire, cards, cardTypes: TYPES, cardsInPlay: '1-40', settings: { autoAdvance: false } });
  sideTwo(two);
  assert.deepEqual([...two.show.queue].sort((a, b) => a - b), [...pool2].sort((a, b) => a - b));
  assert.ok(shared.every((id) => one.show.queue.includes(id) && two.show.queue.includes(id)));
  assert.ok(two.show.phaseModel.valid.length > 0 && two.show.phaseModel.valid.every((c) => c.lines.flat().every((id) => pool2.has(id as number))));
  // The pool counts: a shared song in each of its pools.
  const left = two.show.poolsLeft();
  assert.deepEqual([left['1'].songs, left['2'].songs], [pool1.size, pool2.size]);
});

dataTest('first plays are the Game\'s (D174, D268): a shared song played in a pool 1 round is no first play on pool 2', () => {
  const { repertoire, cards, pool1, pool2 } = twoPools(3, 4);
  const shared = repertoire.slice(0, 4).map((s) => s.id);
  // Round 1 on pool 1 plays the shared songs first (a fixed Queue), then round 6 on side 2 draws its own Shuffle.
  const fixed = [...shared, ...[...pool1].filter((id) => !shared.includes(id))];
  const h = setup({ seed: 6, songs: repertoire, cards, cardTypes: TYPES, cardsInPlay: '1-40', fixedQueue: fixed });
  h.send('unlock');
  h.send('next');
  for (let k = 1; k <= 5; k++) h.until(() => h.show.position === k && h.show.status === 'playing', 80);
  const playedInRound1 = h.show.queue.slice(0, h.show.position + 1);
  assert.ok(shared.every((id) => playedInRound1.includes(id)));
  // Each pool's unplayed songs: those no round has played or will have by this round's expected end.
  const unplayed = (pool: Set<number>) => {
    const thisRound = new Set(h.show.queue.slice(0, roundSongs(h.show.round.kind, SCHEDULE, h.show.expectedSongs)));
    return [...pool].filter((id) => h.show.isFirstPlay(id) && !thisRound.has(id)).length;
  };
  let left = h.show.poolsLeft();
  assert.deepEqual(left['2'], { songs: pool2.size, unplayed: pool2.size - shared.length }, 'a pool 1 round uses up the shared songs of pool 2 too');
  assert.equal(left['1'].unplayed, unplayed(pool1));
  h.show.fixedQueue = null;
  // Mid-round, newRound names the next round's side itself (roundIntro waits for an Interval).
  h.send('newRound', { number: 6, kind: 'normal', cardType: 'normal', side: 2 });
  assert.equal(h.show.round.pool, '2');
  assert.ok(shared.every((id) => h.show.queue.includes(id) && !h.show.isFirstPlay(id)), 'played on pool 1, so played for the Game');
  assert.ok(h.show.queue.filter((id) => !shared.includes(id)).every((id) => h.show.isFirstPlay(id)), "pool 2's own songs are all new");
  assert.equal(h.show.firstPlaysIn(0, h.show.queue.length), pool2.size - shared.length, 'the round\'s first plays leave out the shared songs');
  left = h.show.poolsLeft();
  assert.deepEqual([left['1'].unplayed, left['2'].unplayed], [unplayed(pool1), unplayed(pool2)]);
});

/** 2026's night (D192, D193, D226): Quines 1–5 on side 1, the Desgraciat on the especial card's side 1, the Descans,
 * Quines 6–10 on side 2, and the Especial on the especial card's side 2. Each pool plays six rounds. */
function night2026() {
  const r = (number: number, kind: string, side: number) => ({ number, kind, side, line: [], bingo: [] });
  const rounds = [
    ...[1, 2, 3, 4, 5].map((n) => r(n, 'normal', 1)),
    r(6, 'desgraciat', 1),
    ...[7, 8, 9, 10, 11].map((n) => r(n, 'normal', 2)),
    r(12, 'special', 2),
  ];
  return checkGamePlan({
    v: 3, edition: '26', title: 'Q', prizeReveal: 'perRound', sponsors: [], rounds,
    schedule: { startAtMs: null, roundMinutes: 25, intervalMinutes: 3 }, cheatSheet: { claimRules: [], specialRoundRules: [] },
  });
}

dataTest("the two-sided especial card (D226): the Desgraciat plays its side 1 on pool 1, the Especial its side 2 on pool 2", () => {
  const { repertoire, cards, pool1, pool2 } = twoPools();
  const checked = night2026();
  assert.ok(checked.ok);
  assert.deepEqual(checked.plan.rounds.map((x) => [x.cardType, x.side]).slice(4, 7), [['normal', 1], ['especial', 1], ['normal', 2]]);
  assert.deepEqual(sideWarnings(checked.plan, TYPES, { 1: pool1.size, 2: pool2.size }), [], 'every side of both cards plays');
  const especialOnSide1 = { rounds: checked.plan.rounds.map((x) => (x.kind === 'special' ? { ...x, side: 1 } : x)) };
  assert.deepEqual(sideWarnings(especialOnSide1, TYPES).map((w) => w.message), ['no round plays side 2 of card type "especial"']);

  const especial = cards.filter((c) => c.type === 'especial').map((c) => c.id);
  // Each special round from the plan alone: the command names neither the card type nor the side.
  const play = (number: number, kind: 'desgraciat' | 'special') => {
    const h = setup({ seed: 8, songs: repertoire, cards, cardTypes: TYPES, cardsInPlay: '1-60', settings: { autoAdvance: false } });
    h.send('unlock');
    h.show.setPlan(checked.plan);
    h.send('roundIntro', { number, kind });
    h.send('newRound');
    h.advance(FLOW.shuffleSec + 0.1);
    return h;
  };
  const faces = (h: Harness, pool: Set<number>) =>
    h.show.phaseModel.valid.every((c) => c.lines.flat().every((id) => pool.has(id as number)));

  const d = play(6, 'desgraciat');
  assert.deepEqual([d.show.round.cardType, d.show.round.side, d.show.round.pool], ['especial', 1, '1']);
  assert.ok(d.show.queue.length === pool1.size && d.show.queue.every((id) => pool1.has(id)), 'the Queue is a Shuffle of pool 1');
  assert.deepEqual(d.show.phaseModel.valid.map((c) => c.id), especial, 'only the especial cards stand');
  assert.ok(faces(d, pool1), "their side 1's songs count");

  const e = play(12, 'special');
  assert.deepEqual([e.show.round.cardType, e.show.round.side, e.show.round.pool], ['especial', 2, '2']);
  assert.ok(e.show.queue.length === pool2.size && e.show.queue.every((id) => pool2.has(id)), 'the Queue is a Shuffle of pool 2');
  assert.deepEqual(e.show.phaseModel.valid.map((c) => c.id), especial);
  assert.ok(faces(e, pool2), "their side 2's songs count");
  e.send('next');
  e.until(() => e.show.status === 'playing');
  e.send('claim', { cardId: especial[0], kind: 'line' });
  const check = e.show.snapshot().check;
  assert.deepEqual([check?.cardId, check?.cardType, check?.side], [especial[0], 'especial', 2], "the Check reads the especial card's side 2");
});
