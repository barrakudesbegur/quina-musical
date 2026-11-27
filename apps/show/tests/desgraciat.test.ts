// The Desgraciat round (GLOSSARY): played in reverse, a card falls when one of its songs lands and the last card
// standing wins; a landing that would take out every card left counts for none of them, so there is never a shared win
// (D180). Its pure parts: when each card falls, the standing Check, the 'standing' Phase model, and its place in the
// plan, the journal and resume tokens.
import test from 'node:test';
import assert from 'node:assert/strict';
import { checkCommand, checkGamePlan, defaultCardType, isPassingOutcome, formatResumeToken, parseResumeToken, replayJournal, makeCommand, type JournalEntry } from '@quina/protocol';
import { standingCards, standingCourse, standingRun, validCards, parseCardRanges, type Card } from '../engine/src/game/cards.ts';
import { computeCheck } from '../engine/src/game/check.ts';
import { standingPlan, PHASE_RANK, STANDING_MODEL_DEFAULTS } from '../engine/src/game/phase.ts';
import { tieFreeShuffle } from '../engine/src/game/shuffle.ts';
import { FLOW } from '../engine/src/config.ts';
import { dataTest } from './support/data.ts';
import { allCards } from './support/harness.ts';

// Synthetic cards: song ids are plain numbers.
const card = (id: number, first: number, type = 'normal'): Card => ({ id, type, lines: [0, 4, 8].map((o) => [0, 1, 2, 3].map((i) => first + o + i)) });
const A = card(1, 1); // songs 1–12
const B = card(2, 13); // 13–24
const C = card(3, 25); // 25–36

test('a card falls on its first song to land; the last one standing is known from the Queue', () => {
  const queue = [40, 13, 41, 2, 42, 30, 43];
  const run = standingRun([A, B, C, card(9, 100)], queue);
  assert.deepEqual([...run.fallAt].sort((a, b) => a[0] - b[0]), [[1, 3], [2, 1], [3, 5]], 'card 9: none of its songs is in the Queue');
  assert.deepEqual(standingCards([C, A, B], queue.slice(0, 2)).map((c) => c.id), [1, 3]);
  const course = standingCourse([A, B, C], queue);
  assert.deepEqual(course.standingAfter, [3, 2, 2, 1, 1, 1, 1], "C's song 30 would take out the last one: it doesn't count");
  assert.equal(course.lastStandingAt, 3, 'A falls at index 3, leaving C');
  assert.equal(course.lastCardId, 3);
  assert.equal(standingCourse([A], queue).lastStandingAt, -1, 'alone, it stands from the start');
  assert.equal(standingCourse([], queue).lastStandingAt, null);
});

test('D180: a landing that would take out every card left counts for none of them, so exactly one is always left', () => {
  // A and card 4 share song 2: with B gone, song 2 would take out both, so it counts for neither.
  const both = { id: 4, type: 'normal', lines: [[2, 50, 51, 52], [53, 54, 55, 56], [57, 58, 59, 60]] };
  const run = standingRun([A, B, both], [13, 2]);
  assert.deepEqual(run.standing, [1, 4], 'both still stand: no shared win');
  assert.equal(run.lastStandingAt, null, 'nobody is the last one yet');
  assert.deepEqual(standingCards([A, B, both], [13, 2]).map((c) => c.id), [1, 4]);
  // The round goes on until one of them goes alone: song 50 is only on card 4.
  const on = standingRun([A, B, both], [13, 2, 50]);
  assert.deepEqual([on.standing, on.lastStandingAt, on.lastCardId, [...on.fallAt]], [[1], 2, 1, [[2, 0], [4, 2]]]);
  // Several can fall on one landing, as long as one is left: song 2 takes out A and card 4, C stays.
  const several = standingRun([A, both, C], [2]);
  assert.deepEqual([several.standing, several.lastStandingAt], [[3], 0]);
  // The last one never falls: its songs land and count for nobody.
  assert.deepEqual(standingRun([A, B], [13, 1, 2, 3]).standing, [1]);
});

dataTest('the Desgraciat Shuffle keeps its first draw, and the round always ends with exactly one card standing', () => {
  const pool = [...new Set(allCards.flatMap((c) => c.lines.flat().map((s) => (typeof s === 'number' ? s : s.id))))];
  for (const ranges of ['1-200', '1-60', '1-399']) {
    const cards = validCards(allCards, parseCardRanges(ranges), 'normal');
    for (let seed = 1; seed <= 40; seed++) {
      const r = tieFreeShuffle({ pool, cards, seed: seed * 7919, maxAttempts: FLOW.shuffleMaxAttempts, rule: 'none' });
      assert.deepEqual([r.attempts, r.tied], [0, false], 'nothing to redraw');
      const course = standingCourse(cards, r.queue);
      assert.ok(course.lastStandingAt != null && course.lastStandingAt >= 0);
      assert.equal(course.standingAfter[course.lastStandingAt], 1, 'exactly one card left');
      assert.ok(course.standingAfter.every((n) => n >= 1), 'never none');
    }
  }
});

test('the standing Check plays the card\'s songs in card order and stops at the one that took it out', () => {
  const cards = [A, B, C, card(400, 1, 'especial')];
  const base = { allCards: cards, kind: 'standing' as const, cardType: 'normal', cardsInPlay: new Set([1, 2, 3, 400]) };
  const queue = [13, 40, 7, 41, 30, 42];
  // After 3 landings (13, 40, 7): B fell on 13, A on 7, C still stands.
  const standing = computeCheck({ ...base, cardId: 3, queue, position: 2 });
  assert.equal(standing.outcome, 'complete');
  assert.equal(standing.steps.length, 12);
  assert.ok(standing.steps.every((s) => !s.landed));
  assert.deepEqual(standing.steps.map((s) => s.songId), C.lines.flat(), 'row by row');
  assert.equal(standing.row, null);
  assert.equal(standing.completeSince, 2, 'the last one standing since A fell (index 2)');
  const fallen = computeCheck({ ...base, cardId: 1, queue, position: 3 });
  assert.equal(fallen.outcome, 'fallen', 'A fell on song 7');
  assert.deepEqual(fallen.steps.map((s) => [s.songId, s.landed]), [[1, false], [2, false], [3, false], [4, false], [5, false], [6, false], [7, true]]);
  assert.equal(fallen.completeSince, null);
  // Still two standing: the claim's Check passes, but it isn't the last one yet.
  const early = computeCheck({ ...base, cardId: 3, queue, position: 0 });
  assert.equal(early.outcome, 'complete');
  assert.equal(early.completeSince, null);
  // Song 30 lands later: it's C's, but C is the last one, so it doesn't count (D180). Its step shows as not landed.
  const late = computeCheck({ ...base, cardId: 3, queue, position: 4 });
  assert.equal(late.outcome, 'complete');
  assert.equal(late.completeSince, 2);
  assert.ok(late.steps.every((s) => !s.landed), 'a landing that didn\'t count is not against it');
  assert.ok(late.markedCard.every((s) => !s.landed));
  // On the landing of song 7 (index 2), A fell: no shared win any more.
  assert.equal(computeCheck({ ...base, cardId: 1, queue, position: 2 }).outcome, 'fallen');
  assert.equal(computeCheck({ ...base, cardId: 2, queue, position: 2 }).outcome, 'fallen');
  assert.ok(isPassingOutcome('complete', 'standing') && isPassingOutcome('complete', 'line'));
  assert.ok(!isPassingOutcome('fellLast', 'line') && !isPassingOutcome('fallen', 'standing') && !isPassingOutcome(null, 'bingo'));
  assert.equal(computeCheck({ ...base, cardId: 400, queue, position: 2 }).outcome, 'wrongType');
  assert.equal(computeCheck({ ...base, cardId: 999, queue, position: 2 }).outcome, 'unknownCard');
  assert.deepEqual(computeCheck({ ...base, cardId: 3, queue, position: 2, cardsInPlay: new Set([1, 2]) }).warnings, ['notSold']);
});

test('the standing Phase follows the count: early, then mid, late and final at the thresholds, never back down', () => {
  // 40 cards on disjoint songs, falling one per song in card order: the count is 40 − position before each song.
  const cards = Array.from({ length: 40 }, (_, i) => card(i + 1, 1 + 12 * i));
  const queue = cards.map((c) => c.lines[0][0] as number);
  const plan = standingPlan({ cards, queue, seed: 7 });
  assert.equal(plan.length, 40);
  const { mid, late, final } = STANDING_MODEL_DEFAULTS;
  for (const step of plan) {
    const before = 40 - step.position;
    const want = before <= final ? 'final' : before <= late ? 'late' : before <= mid ? 'mid' : 'early';
    assert.equal(step.phase, want, `${before} standing`);
    assert.equal(step.expectedWinAt, 38, 'card 39 falls at index 38, leaving card 40');
    assert.equal(step.completes, step.position < 39 ? 1 : 0, "the last card's song counts for nobody (D180)");
    assert.equal(step.reason, 'standing');
    assert.ok(step.heat >= 0 && step.heat <= 1);
  }
  for (let i = 1; i < plan.length; i++) {
    assert.ok(PHASE_RANK[plan[i].phase] >= PHASE_RANK[plan[i - 1].phase], 'the count only falls');
    if (plan[i].phase === plan[i - 1].phase) assert.ok(plan[i].heat >= plan[i - 1].heat - 0.1, 'the Heat rises within a Phase (give or take its jitter)');
  }
  assert.deepEqual(standingPlan({ cards, queue, seed: 7 }), plan, 'the same seed, the same plan');
  assert.equal(standingPlan({ cards, queue, startPosition: 30, seed: 7 })[0].position, 30);
  // Few cards: mid never at the start.
  const few = standingPlan({ cards: cards.slice(0, 10), queue, seed: 1 });
  assert.equal(few[0].phase, 'early');
});

dataTest('with the printed cards, the winning song comes in final nearly always, and never before late', () => {
  const pool = [...new Set(allCards.flatMap((c) => c.lines.flat().map((s) => (typeof s === 'number' ? s : s.id))))];
  const cards = validCards(allCards, parseCardRanges('1-250'), 'normal');
  let inFinal = 0;
  const rounds = 60;
  for (let seed = 1; seed <= rounds; seed++) {
    const { queue } = tieFreeShuffle({ pool, cards, seed: seed * 104729, maxAttempts: FLOW.shuffleMaxAttempts, rule: 'none' });
    const plan = standingPlan({ cards, queue, seed });
    const win = plan[0].expectedWinAt;
    assert.ok(win != null && win > 10, `the win at ${win}`);
    const phase = plan[win].phase;
    assert.ok(PHASE_RANK[phase] >= PHASE_RANK.late, `the winning song in ${phase}`);
    if (phase === 'final') inFinal++;
    assert.equal(plan[0].phase, 'early');
  }
  assert.ok(inFinal / rounds >= 0.85, `in final ${inFinal} of ${rounds}`);
});

test('the plan: one Desgraciat round at most, no Line prizes in it, and it plays especial cards unless it says otherwise (D70)', () => {
  const prize = { title: 'Pernil', detail: null, sponsorId: null, image: null, headline: true };
  const plan = (rounds: unknown[]) => ({
    v: 3, edition: '26', title: 'Quina Quina 3', prizeReveal: 'perRound', sponsors: [], rounds,
    schedule: { startAtMs: null, roundMinutes: 25, intervalMinutes: 3 }, cheatSheet: { claimRules: [], specialRoundRules: [] },
  });
  const ok = checkGamePlan(plan([{ number: 1, kind: 'normal', line: [], bingo: [] }, { number: 2, kind: 'desgraciat', line: [], bingo: [prize] }]));
  assert.ok(ok.ok);
  assert.equal(ok.plan.rounds[1].kind, 'desgraciat');
  assert.equal(ok.plan.rounds[1].cardType, 'especial');
  assert.equal(defaultCardType('desgraciat'), 'especial');
  const two = checkGamePlan(plan([{ number: 1, kind: 'desgraciat', line: [], bingo: [] }, { number: 2, kind: 'desgraciat', line: [], bingo: [] }]));
  assert.ok(!two.ok && two.errors.some((e) => /only one Desgraciat/.test(e)));
  const line = checkGamePlan(plan([{ number: 1, kind: 'desgraciat', line: [prize], bingo: [] }]));
  assert.ok(!line.ok && line.errors.some((e) => e.startsWith('plan.rounds[0].line')));
  const bad = checkGamePlan(plan([{ number: 1, kind: 'reverse', line: [], bingo: [] }]));
  assert.ok(!bad.ok && bad.errors.some((e) => /"desgraciat"/.test(e)));
});

test('a Desgraciat round climbs to the last card standing in the journal, and its resume token reads D', () => {
  const settings = { pace: 14, paceLocked: false, autoAdvance: true, autoAdvanceFinal: false, songsUntilWinner: 30, phaseOverride: null, roundsTotal: 3, holdMusicAfterSec: 20 };
  const entry: JournalEntry = {
    gameId: 'g', seq: 1, atMs: 1, kind: 'round.started', round: 4, roundKind: 'desgraciat', cardType: 'especial', queue: [1, 2, 3],
    phaseSeed: 1, startedAtMs: 1, targetEndMs: 2, settings, shuffleSeed: 5, shuffleAttempts: 0,
  };
  assert.equal(replayJournal([entry]).round?.climbingTo, 'standing');
  const point = { round: 4, kind: 'desgraciat' as const, cardType: 'especial', shuffleSeed: 5, shuffleAttempts: 2, position: 7, lastSongId: 3, lineConfirmedFrom: null };
  const text = formatResumeToken(point);
  assert.match(text, /^Q4D-/);
  assert.deepEqual(parseResumeToken(text), point);
});

test('commands take the Desgraciat round and standing claims', () => {
  assert.ok(checkCommand({ ...makeCommand('newRound', {}), kind: 'desgraciat' }).ok);
  assert.ok(checkCommand({ ...makeCommand('roundIntro', {}), kind: 'desgraciat' }).ok);
  assert.ok(checkCommand({ ...makeCommand('claim', { cardId: 3 }), kind: 'standing' }).ok);
  assert.equal(checkCommand({ ...makeCommand('newRound', {}), kind: 'reverse' }).ok, false);
});
