import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  phasePlan,
  describePlan,
  winChance,
  winChanceSeries,
  cardWinChance,
  thresholdScale,
  midThresholdFor,
  resolvePhaseConfig,
  PHASE_MODEL_DEFAULTS,
  PHASES,
  PHASE_RANK,
} from '../engine/src/game/phase.ts';
import { firstWinAt } from '../engine/src/game/cards.ts';
import { seededRandom, secureShuffle } from '../engine/src/rng.ts';
import { cardFace, type Card, type CompletionKind as WinKind, type PrintedCard } from '../engine/src/game/cards.ts';
import type { Phase, PhaseModelOverrides } from '../engine/src/game/phase.ts';
import { REPO } from '../relay/repertoire.ts';

// The printed cards' side 1 (D178).
const CARDS: Card[] = (JSON.parse(fs.readFileSync(path.join(REPO, 'apps/cards/dist/cards.json'), 'utf8')) as PrintedCard[]).flatMap((c) => cardFace(c, 1) ?? []);
const NORMAL = CARDS.filter((c) => c.type === 'normal');
const POOL = Array.from({ length: 77 }, (_, i) => i + 1);
const ROUNDS = Number(process.env.PHASE_SIM_ROUNDS || 400);

const card = (id: number, lines: number[][]): Card => ({ id, type: 'normal', lines });
const mean = (values: readonly number[]) => values.reduce((a, b) => a + b, 0) / values.length;
const histogram = (values: readonly number[]) => {
  const counts: Record<number, number> = {};
  for (const v of values) counts[v] = (counts[v] ?? 0) + 1;
  return Object.entries(counts)
    .map(([k, n]) => `${k}: ${((100 * n) / values.length).toFixed(0)}%`)
    .join(', ');
};

/** The queue index of the first Line (or Bingo) at or after `from`; the simulated rounds always have one. */
function winIndex(cards: readonly Card[], queue: readonly number[], kind: WinKind, from = 0): number {
  const win = firstWinAt(cards, queue, kind, from);
  assert.ok(win, `no ${kind} in this round`);
  return win.index;
}

function makeRounds(count: number, cardsInPlay: number, seed: number) {
  const random = seededRandom(seed);
  return Array.from({ length: count }, () => ({ cards: secureShuffle(NORMAL, random).slice(0, cardsInPlay), queue: secureShuffle(POOL, random) }));
}

// ------------------------------------------------------------------------------------------- config

test('every tunable lives in one deep-frozen object; overrides merge per key', () => {
  const frozen = (value: unknown) => {
    assert.ok(Object.isFrozen(value));
    if (value && typeof value === 'object') {
      const values: unknown[] = Object.values(value);
      for (const v of values) if (v && typeof v === 'object') frozen(v);
    }
  };
  frozen(PHASE_MODEL_DEFAULTS);
  // The types already forbid these writes; the casts let the test check that the runtime does too.
  assert.throws(() => {
    (PHASE_MODEL_DEFAULTS as { falseAlarmChance: number }).falseAlarmChance = 1;
  }, TypeError);
  assert.throws(() => {
    (PHASE_MODEL_DEFAULTS.lateLeadSongs as [number, number])[0] = 1;
  }, TypeError);

  const cfg = resolvePhaseConfig({ falseAlarmChance: 0, midThreshold: { line: 0.2 }, lateLeadSongs: undefined, heatBands: { final: [0.9, 1] } });
  assert.equal(cfg.falseAlarmChance, 0);
  assert.equal(cfg.midThreshold.line, 0.2);
  assert.equal(cfg.midThreshold.bingo, PHASE_MODEL_DEFAULTS.midThreshold.bingo);
  assert.deepEqual(cfg.lateLeadSongs, [3, 8]);
  assert.deepEqual(cfg.heatBands.final, [0.9, 1]);
  assert.deepEqual(cfg.heatBands.early, PHASE_MODEL_DEFAULTS.heatBands.early);
  assert.deepEqual(PHASES, ['early', 'mid', 'late', 'final']);
  assert.ok(PHASES.every((p, i) => PHASE_RANK[p] === i));
});

// -------------------------------------------------------------------------------------- the chance

test('cardWinChance: exact small cases', () => {
  const close = (a: number, b: number) => assert.ok(Math.abs(a - b) < 1e-12, `${a} ≠ ${b}`);
  close(cardWinChance([1, 4, 4], 'line', 1, 10), 1 / 10);
  close(cardWinChance([2, Infinity, Infinity], 'line', 5, 10), (5 * 4) / (10 * 9));
  close(cardWinChance([0, 0, 1], 'bingo', 5, 10), 5 / 10);
  close(cardWinChance([1, 1, Infinity], 'bingo', 5, 10), 0);
  close(cardWinChance([5, 5, 5], 'line', 4, 30), 0);
  close(cardWinChance([1, 1, 1], 'line', 3, 3), 1);
  // Two disjoint lines of one missing song each, 1 song ahead out of 4: either lands → 2/4.
  close(cardWinChance([1, 1, 4], 'line', 1, 4), 2 / 4);
});

test('cardWinChance: inclusion–exclusion matches a Monte Carlo draw', () => {
  const random = seededRandom(3);
  const missing = [1, 2, 3];
  const remaining = 12;
  const within = 5;
  // Songs 0 | 1, 2 | 3, 4, 5 are the missing songs of the three lines; 6–11 are on nobody's line.
  const lines = [[0], [1, 2], [3, 4, 5]];
  const songs = Array.from({ length: remaining }, (_, i) => i);
  let hits = 0;
  const draws = 40000;
  for (let n = 0; n < draws; n++) {
    const next = new Set(secureShuffle(songs, random).slice(0, within));
    if (lines.some((line) => line.every((s) => next.has(s)))) hits++;
  }
  const exact = cardWinChance(missing, 'line', within, remaining);
  assert.ok(Math.abs(hits / draws - exact) < 0.01, `MC ${hits / draws} vs ${exact}`);
});

test('winChance: matches the series, ignores the order of songs to come, skips completed cards', () => {
  const [{ cards, queue }] = makeRounds(1, 120, 21);
  const series = winChanceSeries({ cards, queue, kind: 'line', from: 3 });
  assert.equal(series.length, queue.length - 3);
  for (const p of [3, 8, 12, 20]) {
    const at = winChance({ cards, queue, position: p, kind: 'line' });
    assert.ok(Math.abs(at - series[p - 3]) < 1e-12);
    const reordered = [...queue.slice(0, p), ...secureShuffle(queue.slice(p), seededRandom(p))];
    assert.ok(Math.abs(winChance({ cards, queue: reordered, position: p, kind: 'line' }) - at) < 1e-12);
    assert.ok(at >= 0 && at <= 1);
  }
  const A = card(1, [[1, 2, 3, 4], [5, 6, 7, 8], [9, 10, 11, 12]]);
  const q = Array.from({ length: 20 }, (_, i) => i + 1);
  const live = PHASE_MODEL_DEFAULTS.liveCardProbability;
  // 1, 2, 3 landed: song 4 is the next one with probability 1/17.
  assert.ok(Math.abs(winChance({ cards: [A], queue: q, position: 3, kind: 'line', within: 1 }) - live / 17) < 1e-12);
  // 1–4 landed: A already has its Line; nobody claimed it, so it no longer counts.
  assert.equal(winChance({ cards: [A], queue: q, position: 4, kind: 'line' }), 0);
  // Bingo: 8 songs still missing can't all land in the next 7, but can in the next 8.
  assert.equal(winChance({ cards: [A], queue: q, position: 4, kind: 'bingo', within: 7 }), 0);
  assert.ok(winChance({ cards: [A], queue: q, position: 4, kind: 'bingo', within: 8 }) > 0);
});

// --------------------------------------------------------------------------------- thresholds

test('thresholds scale with the number of cards in play', () => {
  for (const kind of ['line', 'bingo'] as const) {
    assert.equal(thresholdScale(kind, PHASE_MODEL_DEFAULTS.thresholdReferenceCards), 1);
    assert.equal(midThresholdFor(kind, PHASE_MODEL_DEFAULTS.thresholdReferenceCards), PHASE_MODEL_DEFAULTS.midThreshold[kind]);
    assert.ok(thresholdScale(kind, 50) > thresholdScale(kind, 120));
    assert.ok(thresholdScale(kind, 120) > 1 && thresholdScale(kind, 300) < 1);
    const [lo, hi] = PHASE_MODEL_DEFAULTS.thresholdScaleLimits;
    assert.ok(thresholdScale(kind, 1) <= hi && thresholdScale(kind, 1e6) >= lo);
  }
  assert.equal(thresholdScale('line', 100, { thresholdExponent: { line: 0 } }), 1);
});

test('mid starts about the same number of songs before the win for 50–300 cards', () => {
  const rows: { kind: WinKind; n: number; lead: number }[] = [];
  for (const kind of ['line', 'bingo'] as const) {
    for (const n of [50, 120, 200, 300]) {
      const leads = makeRounds(Math.ceil(ROUNDS / 3), n, n).map(({ cards, queue }, i) => {
        const start = kind === 'line' ? 0 : winIndex(cards, queue, 'line') + 1;
        const d = describePlan(phasePlan({ cards, queue, kind, startPosition: start, seed: i }));
        assert.ok(d.winAt != null && d.midAt != null);
        return d.winAt - d.midAt;
      });
      rows.push({ kind, n, lead: mean(leads) });
      console.log(`  ${kind.padEnd(5)} ${String(n).padStart(3)} cards: mid threshold ${midThresholdFor(kind, n).toFixed(3)}, mid starts ${mean(leads).toFixed(1)} songs before the win`);
    }
  }
  for (const kind of ['line', 'bingo'] as const) {
    const leads = rows.filter((r) => r.kind === kind).map((r) => r.lead);
    assert.ok(leads.every((l) => l >= 7 && l <= 13), `${kind}: ${leads}`);
    assert.ok(Math.max(...leads) - Math.min(...leads) <= 2.5, `${kind}: ${leads}`);
  }
});

// ------------------------------------------------------------------------------------------ plan

test('one card: final lands on the win, then late for a song, then mid', () => {
  const A = card(1, [[1, 2, 3, 4], [5, 6, 7, 8], [9, 10, 11, 12]]);
  // A's first line completes when song 4 lands, at queue index 14.
  const queue = [20, 21, 22, 23, 24, 25, 26, 1, 27, 28, 2, 29, 3, 30, 4, 31, 32, 33, 34, 35, 36, 37, 38, 39, 40];
  const plan = phasePlan({ cards: [A], queue, kind: 'line', seed: 1 });
  assert.equal(plan.length, queue.length);
  assert.deepEqual(plan.map((s) => s.position), queue.map((_, i) => i));
  assert.equal(plan[14].phase, 'final');
  assert.equal(plan[14].completes, 1);
  assert.equal(plan.filter((s) => s.completes).length, 1);
  assert.ok(plan.slice(0, 15).every((s) => s.expectedWinAt === 14));
  assert.equal(plan[15].phase, 'late');
  assert.equal(plan[15].reason, 'unclaimed');
  assert.equal(plan[15].expectedWinAt, null);
  assert.ok(plan.slice(16).every((s) => s.phase === 'mid' && s.reason === 'unclaimed'));
  const d = describePlan(plan);
  assert.equal(d.winAt, 14);
  assert.ok(d.lateAt != null && d.finalAt != null);
  assert.ok(14 - d.lateAt >= 3 && 14 - d.lateAt <= 8);
  assert.ok(14 - d.finalAt <= 2);

  // Planning from later on only covers the rest of the queue.
  const tail = phasePlan({ cards: [A], queue, kind: 'line', startPosition: 10, seed: 1 });
  assert.equal(tail.length, queue.length - 10);
  assert.equal(tail[0].position, 10);
});

test('no possible win: the plan stays quiet', () => {
  const never = card(1, [[1, 2, 3, 99], [5, 6, 7, 98], [9, 10, 11, 97]]); // 97–99 are not in the queue
  for (const cards of [[], [never]]) {
    const plan = phasePlan({ cards, queue: POOL, kind: 'line', seed: 4 });
    assert.equal(plan.length, POOL.length);
    assert.ok(plan.every((s) => s.phase === 'early' && s.expectedWinAt === null && s.completes === 0));
    assert.ok(plan.every((s) => s.heat >= 0 && s.heat <= 0.4));
  }
});

test('the same seed gives the same plan; seeds change the blur; an injected RNG works', () => {
  const [{ cards, queue }] = makeRounds(1, 200, 5);
  const a = phasePlan({ cards, queue, kind: 'line', seed: 5 });
  assert.deepEqual(phasePlan({ cards, queue, kind: 'line', seed: 5 }), a);
  assert.deepEqual(phasePlan({ cards, queue, kind: 'line', random: seededRandom(5) }), a, 'same generator as rng.ts');
  const shapes = new Set<string>();
  for (let seed = 0; seed < 30; seed++) shapes.add(phasePlan({ cards, queue, kind: 'line', seed }).map((s) => s.phase[0]).join(''));
  assert.ok(shapes.size >= 5, `only ${shapes.size} different plans from 30 seeds`);
  // The plan doesn't depend on anything else: no Math.random.
  const original = Math.random;
  Math.random = () => {
    throw new Error('Math.random used');
  };
  try {
    phasePlan({ cards, queue, kind: 'bingo', startPosition: 20, seed: 9 });
  } finally {
    Math.random = original;
  }
});

test(`phase plan properties over ${ROUNDS} rounds (200 cards from cards.json)`, () => {
  const gap = PHASE_MODEL_DEFAULTS.falseAlarmGapSongs;
  const lateLeads: number[] = [];
  const finalSongs: number[] = [];
  const heatByPhase: Record<Phase, number[]> = { early: [], mid: [], late: [], final: [] };
  let withFalseAlarm = 0;
  let worstFinalAhead = 0;
  for (const [i, { cards, queue }] of makeRounds(ROUNDS, 200, 1).entries()) {
    const plan = phasePlan({ cards, queue, kind: 'line', seed: i });
    const win = winIndex(cards, queue, 'line');
    const d = describePlan(plan);
    assert.equal(d.winAt, win);
    assert.ok(d.midAt != null && d.lateAt != null && d.finalAt != null);
    assert.equal(plan[win].phase, 'final', 'the winning song lands in final');
    for (const s of plan.slice(0, win + 1)) {
      if (s.phase === 'final') worstFinalAhead = Math.max(worstFinalAhead, win - s.position);
      heatByPhase[s.phase].push(s.heat);
      assert.ok(s.heat >= 0 && s.heat <= 1);
      if (s.position >= d.midAt) assert.notEqual(s.phase, 'early', 'never back to early once mid');
    }
    lateLeads.push(win - d.lateAt);
    finalSongs.push(win - d.finalAt + 1);
    if (d.falseAlarms.length) {
      withFalseAlarm++;
      for (const fa of d.falseAlarms) {
        assert.ok(fa.from >= d.midAt);
        const after = plan.slice(fa.to + 1, d.lateAt);
        assert.ok(after.length >= gap && after.every((s) => s.phase === 'mid'), 'a false alarm drops back to mid before the real late');
      }
    }
  }
  const falseAlarmRate = withFalseAlarm / ROUNDS;
  const lateInRange = lateLeads.filter((l) => l >= 3 && l <= 8).length / ROUNDS;
  const heat = Object.fromEntries(Object.entries(heatByPhase).map(([k, v]) => [k, mean(v)]));
  console.log(`  late starts N songs before the win: ${histogram(lateLeads)}`);
  console.log(`  final covers N songs: ${histogram(finalSongs)}; final at most ${worstFinalAhead} songs before the win`);
  console.log(`  false alarms in ${(100 * falseAlarmRate).toFixed(0)}% of rounds`);
  console.log(`  mean Heat: ${PHASES.map((p) => `${p} ${heat[p].toFixed(2)}`).join(', ')}`);
  assert.ok(worstFinalAhead <= 3, 'final never more than ~3 songs before the win');
  assert.ok(lateInRange >= 0.9, `late 3–8 songs before the win in ${lateInRange}`);
  assert.ok(falseAlarmRate >= 0.05 && falseAlarmRate <= 0.5, `false alarms in ${falseAlarmRate}`);
  assert.ok(heat.early < heat.mid && heat.mid < heat.late && heat.late < heat.final);
});

test('the phase resets after the Line, then climbs to the Bingo', () => {
  let startsEarly = 0;
  const rounds = makeRounds(Math.ceil(ROUNDS / 2), 200, 2);
  for (const [i, { cards, queue }] of rounds.entries()) {
    const line = winIndex(cards, queue, 'line');
    const linePlan = phasePlan({ cards, queue, kind: 'line', seed: i });
    // Without a confirmed Line the round stays hot: possible winners are out there.
    assert.ok(PHASE_RANK[linePlan[line + 1].phase] >= PHASE_RANK.late);

    const bingoPlan = phasePlan({ cards, queue, kind: 'bingo', startPosition: line + 1, seed: i });
    assert.equal(bingoPlan[0].position, line + 1);
    if (bingoPlan[0].phase === 'early') startsEarly++;
    const bingo = winIndex(cards, queue, 'bingo', line + 1);
    const d = describePlan(bingoPlan);
    assert.equal(d.winAt, bingo);
    assert.ok(d.finalAt != null);
    assert.equal(bingoPlan[bingo - line - 1].phase, 'final');
    assert.ok(bingo - d.finalAt <= 2);
  }
  assert.ok(startsEarly / rounds.length >= 0.95, `bingo plan starts early in ${startsEarly}/${rounds.length}`);
});

test('config overrides change the blur', () => {
  const rounds = makeRounds(120, 200, 3);
  const falseAlarms = (config: PhaseModelOverrides) =>
    rounds.filter(({ cards, queue }, i) => describePlan(phasePlan({ cards, queue, kind: 'line', seed: i, config })).falseAlarms.length).length;
  assert.equal(falseAlarms({ falseAlarmChance: 0 }), 0);
  assert.ok(falseAlarms({ falseAlarmChance: 1 }) > falseAlarms({}));

  const fixed: PhaseModelOverrides = { lateLeadSongs: [5, 5], finalSongWeights: [0, 0, 1] };
  for (const [i, { cards, queue }] of rounds.entries()) {
    const d = describePlan(phasePlan({ cards, queue, kind: 'line', seed: i, config: fixed }));
    if (d.winAt == null || d.winAt < 7) continue;
    assert.ok(d.lateAt != null && d.finalAt != null);
    assert.equal(d.winAt - d.lateAt, 5);
    assert.equal(d.winAt - d.finalAt, 2);
  }
});
