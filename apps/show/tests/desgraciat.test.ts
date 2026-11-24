// The Desgraciat round (GLOSSARY): played in reverse, a card falls as soon as any of its songs lands and the last
// card standing wins. Its pure parts: when each card falls, the tie-free rule (one card is always the last
// standing), the standing Check, the 'standing' Phase model, and its place in the plan, the journal and resume tokens.
import test from 'node:test';
import assert from 'node:assert/strict';
import { checkCommand, checkGamePlan, defaultCardType, formatResumeToken, parseResumeToken, replayJournal, makeCommand, type JournalEntry } from '@quina/protocol';
import { fallIndex, queuePositions, standingCards, standingCourse, validCards, parseCardRanges, type Card } from '../engine/src/game/cards.ts';
import { computeCheck } from '../engine/src/game/check.ts';
import { standingPlan, PHASE_RANK, STANDING_MODEL_DEFAULTS } from '../engine/src/game/phase.ts';
import { hasStandingTie, tieFreeShuffle } from '../engine/src/game/shuffle.ts';
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
  const pos = queuePositions(queue);
  assert.equal(fallIndex(A, pos), 3);
  assert.equal(fallIndex(B, pos), 1);
  assert.equal(fallIndex(C, pos), 5);
  assert.equal(fallIndex(card(9, 100), pos), Infinity, 'none of its songs is in the Queue');
  assert.deepEqual(standingCards([C, A, B], queue.slice(0, 2)).map((c) => c.id), [1, 3]);
  assert.deepEqual(standingCards([A, B], [2, 13]), []);

  const course = standingCourse([A, B, C], queue);
  assert.deepEqual(course.standingAfter, [3, 2, 2, 1, 1, 0, 0]);
  assert.equal(course.lastStandingAt, 3, 'A falls at index 3, leaving C');
  assert.equal(course.lastCardId, 3);
  assert.equal(course.tied, false);
  assert.equal(standingCourse([A], queue).lastStandingAt, -1, 'alone, it stands from the start');
  assert.equal(standingCourse([], queue).lastStandingAt, null);
  // A and C fall together on the last song that matters: nobody is ever the last one standing.
  const tie = standingCourse([A, B, C], [13, 2, 30]);
  assert.equal(tie.tied, false, 'A at 1, C at 2: C is last');
  const both = { id: 4, type: 'normal', lines: [[2, 50, 51, 52], [53, 54, 55, 56], [57, 58, 59, 60]] };
  assert.equal(standingCourse([A, B, both], [13, 2]).tied, true, 'A and card 4 both fall on song 2');
  assert.equal(hasStandingTie([A, B, both], [13, 2]), true);
});

dataTest('the Desgraciat Shuffle always leaves exactly one card standing last, redrawing when two would fall together', () => {
  const pool = [...new Set(allCards.flatMap((c) => c.lines.flat().map((s) => (typeof s === 'number' ? s : s.id))))];
  let redrawn = 0;
  for (const ranges of ['1-200', '1-60', '1-399']) {
    const cards = validCards(allCards, parseCardRanges(ranges), 'normal');
    for (let seed = 1; seed <= 40; seed++) {
      const r = tieFreeShuffle({ pool, cards, seed: seed * 7919, maxAttempts: FLOW.shuffleMaxAttempts, rule: 'lastStanding' });
      assert.equal(r.tied, false);
      const course = standingCourse(cards, r.queue);
      assert.equal(course.tied, false);
      assert.ok(course.lastStandingAt != null && course.lastStandingAt >= 0);
      assert.equal(course.standingAfter[course.lastStandingAt], 1, 'exactly one card left');
      if (r.attempts) redrawn++;
      assert.deepEqual(tieFreeShuffle({ pool, cards, seed: seed * 7919, maxAttempts: FLOW.shuffleMaxAttempts, rule: 'lastStanding' }), r, 'deterministic');
    }
  }
  assert.ok(redrawn > 0 && redrawn < 40, `some draws are redrawn (${redrawn} of 120)`);
});

test('the standing Check plays the card\'s songs in card order and stops at the first one that landed', () => {
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
  const fallen = computeCheck({ ...base, cardId: 1, queue, position: 2 });
  assert.equal(fallen.outcome, 'fallen');
  assert.deepEqual(fallen.steps.map((s) => [s.songId, s.landed]), [[1, false], [2, false], [3, false], [4, false], [5, false], [6, false], [7, true]]);
  assert.equal(fallen.completeSince, null);
  // Still two standing: the claim's Check passes, but it isn't the last one yet.
  const early = computeCheck({ ...base, cardId: 3, queue, position: 0 });
  assert.equal(early.outcome, 'complete');
  assert.equal(early.completeSince, null);
  // Song 30 lands later: C falls too, on its 6th song.
  const late = computeCheck({ ...base, cardId: 3, queue, position: 4 });
  assert.equal(late.outcome, 'fallen');
  assert.equal(late.steps.length, 6);
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
    assert.equal(step.completes, 1);
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
    const { queue } = tieFreeShuffle({ pool, cards, seed: seed * 104729, maxAttempts: FLOW.shuffleMaxAttempts, rule: 'lastStanding' });
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

test('the plan: one Desgraciat round at most, no Line prizes in it, and it plays normal cards unless it says otherwise', () => {
  const prize = { title: 'Pernil', detail: null, sponsorId: null, image: null, headline: true };
  const plan = (rounds: unknown[]) => ({
    v: 3, edition: '26', title: 'Quina Quina 3', prizeReveal: 'perRound', sponsors: [], rounds,
    schedule: { startAtMs: null, roundMinutes: 25, intervalMinutes: 3 }, cheatSheet: { claimRules: [], specialRoundRules: [] },
  });
  const ok = checkGamePlan(plan([{ number: 1, kind: 'normal', line: [], bingo: [] }, { number: 2, kind: 'desgraciat', line: [], bingo: [prize] }]));
  assert.ok(ok.ok);
  assert.equal(ok.plan.rounds[1].kind, 'desgraciat');
  assert.equal(ok.plan.rounds[1].cardType, 'normal');
  assert.equal(defaultCardType('desgraciat'), 'normal');
  const two = checkGamePlan(plan([{ number: 1, kind: 'desgraciat', line: [], bingo: [] }, { number: 2, kind: 'desgraciat', line: [], bingo: [] }]));
  assert.ok(!two.ok && two.errors.some((e) => /only one Desgraciat/.test(e)));
  const line = checkGamePlan(plan([{ number: 1, kind: 'desgraciat', line: [prize], bingo: [] }]));
  assert.ok(!line.ok && line.errors.some((e) => e.startsWith('plan.rounds[0].line')));
  const bad = checkGamePlan(plan([{ number: 1, kind: 'reverse', line: [], bingo: [] }]));
  assert.ok(!bad.ok && bad.errors.some((e) => /"desgraciat"/.test(e)));
});

test('a Desgraciat round climbs to the last card standing in the journal, and its resume token reads D', () => {
  const settings = { pace: 14, paceLocked: false, autoAdvance: true, autoAdvanceFinal: false, songsUntilWinner: 30, phaseOverride: null, roundsTotal: 3, holdMusicAfterSec: 20, finalLapStinger: true };
  const entry: JournalEntry = {
    gameId: 'g', seq: 1, atMs: 1, kind: 'round.started', round: 4, roundKind: 'desgraciat', cardType: 'normal', queue: [1, 2, 3],
    phaseSeed: 1, startedAtMs: 1, targetEndMs: 2, settings, shuffleSeed: 5, shuffleAttempts: 0,
  };
  assert.equal(replayJournal([entry]).round?.climbingTo, 'standing');
  const point = { round: 4, kind: 'desgraciat' as const, cardType: 'normal', shuffleSeed: 5, shuffleAttempts: 2, position: 7, lastSongId: 3, lineConfirmedFrom: null };
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
