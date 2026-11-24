// Phase and Heat for a round: how close a Line or a Bingo is, blurred so it never gives the ending away.
// Pure ES module (no DOM, no Node-only APIs); every random draw comes from a seeded or injected RNG.
//
// The model, in four steps (tunables in PHASE_MODEL_DEFAULTS, calibration in reports/phase-model.md):
// 1. Known future. The queue is fixed at the Shuffle, so for every valid card we know the queue index at
//    which its Line/Bingo completes (cards.ts `completions`). The first of those is the expected win:
//    with each card "live" (sold, and claimed in time) with probability ≈ 0.75, it is the most likely win
//    position. If nobody claims it (an unsold card), the next completion becomes the expected win.
// 2. Public chance. winChance() is the probability that at least one valid card completes within the next
//    few songs, from the songs already landed and the set (not the order) of songs still to come: what a
//    perfect observer in the room could know. It drives early → mid, false-alarm placement and Heat.
//    The chance already counts every card, so its threshold only needs a gentle scaling with the number
//    of cards in play (thresholdScale: fewer cards → higher threshold) to start mid about 8–10 songs before
//    the win whether 50 or 300 cards are in play.
// 3. Blur. late (the pre-final) starts a random 3–8 songs before the expected win; final covers a random
//    1–3 songs ending on it; sometimes a false alarm goes late for 1–2 songs and drops back to mid at least
//    2 songs before the real late. A completion nobody claims keeps the phase at late for a song, then
//    never lower than mid. final is never more than 2 songs before a completion.
// 4. Heat (placeholder, 0..1) sits in a band per phase, nudged by the public chance and seeded noise.
//
// The engine calls phasePlan({ kind: 'line', startPosition: 0, … }) at the start of a round, and again with
// kind 'bingo' and startPosition = the next queue index once a Line is confirmed (the reset). It reads
// plan[position - startPosition] at each landing; presenter overrides stay in the engine. Draw the seed
// secretly at the Shuffle (rng.ts randomSeed()) and keep it with the queue, so the plan can be rebuilt after
// a reload or a change of cards in play; a shared or default seed would make every round blur the same way.
//
// API
//   PHASES, PHASE_RANK, PHASE_MODEL_DEFAULTS, resolvePhaseConfig(overrides)
//   phasePlan({ cards, queue, kind, startPosition, seed, random, cardsInPlayCount, config }) → PhaseStep[]
//   describePlan(steps) → { winAt, midAt, lateAt, finalAt, falseAlarms }
//   winChance({ cards, queue, position, kind, within, live }) → 0..1
//   winChanceSeries({ cards, queue, kind, from, to, within, live }) → number[] (one per position from `from`)
//   cardWinChance(missingByLine, kind, within, remaining) → 0..1 for one card
//   thresholdScale(kind, cardsInPlayCount, config), midThresholdFor(kind, cardsInPlayCount, config)

import { cardSongIds, completions, queuePositions } from './cards.ts';
import { seededRandom } from '../rng.ts';
import type { PhaseName } from '@quina/protocol';
import type { Card, WinKind } from './cards.ts';

export type { WinKind } from './cards.ts';

/** The Phase: how close the round is to a winner. */
export type Phase = PhaseName;
/**
 * Which rule set the phase: 'quiet' (early), 'chance' (mid from the public chance), 'ramp' (mid forced
 * before late), 'false-alarm', 'pre-final' (late before the expected win), 'final', 'unclaimed' (after a
 * completion nobody claimed).
 */
export type PhaseReason = 'quiet' | 'chance' | 'ramp' | 'false-alarm' | 'pre-final' | 'final' | 'unclaimed';
/** The Phase and Heat at one queue position. */
export interface PhaseStep {
  position: number;
  phase: Phase;
  heat: number;
  expectedWinAt: number | null;
  chance: number;
  completes: number;
  reason: PhaseReason;
}
/** Every tunable number of the Phase model (see PHASE_MODEL_DEFAULTS). */
export interface PhaseModelConfig {
  liveCardProbability: number;
  chanceWindowSongs: number;
  midThreshold: Readonly<Record<WinKind, number>>;
  thresholdReferenceCards: number;
  thresholdExponent: Readonly<Record<WinKind, number>>;
  thresholdScaleLimits: readonly [number, number];
  midMinSongs: number;
  lateLeadSongs: readonly [number, number];
  finalSongWeights: readonly number[];
  falseAlarmChance: number;
  falseAlarmSongWeights: readonly number[];
  falseAlarmGapSongs: number;
  unclaimedGraceSongs: number;
  heatBands: Readonly<Record<Phase, readonly [number, number]>>;
  heatChanceWeight: number;
  heatJitter: number;
  heatSmoothing: number;
}
/** Overrides of the defaults; midThreshold, thresholdExponent and heatBands merge per key. */
export type PhaseModelOverrides = Partial<Omit<PhaseModelConfig, 'midThreshold' | 'thresholdExponent' | 'heatBands'>> & {
  midThreshold?: Partial<Record<WinKind, number>>;
  thresholdExponent?: Partial<Record<WinKind, number>>;
  heatBands?: Partial<Record<Phase, readonly [number, number]>>;
};
export interface PhasePlanOptions {
  cards: ReadonlyArray<Card>;
  queue: ReadonlyArray<number>;
  kind: WinKind;
  startPosition?: number;
  seed?: number;
  random?: () => number;
  cardsInPlayCount?: number;
  config?: PhaseModelOverrides;
}
/** Where a plan's phases change (describePlan). */
export interface PlanSummary {
  winAt: number | null;
  midAt: number | null;
  lateAt: number | null;
  finalAt: number | null;
  falseAlarms: { from: number; to: number }[];
}

export const PHASES: readonly Phase[] = Object.freeze(['early', 'mid', 'late', 'final']);
export const PHASE_RANK: Readonly<Record<Phase, number>> = Object.freeze({ early: 0, mid: 1, late: 2, final: 3 });

const pair = (a: number, b: number): readonly [number, number] => Object.freeze<[number, number]>([a, b]);

/** Every tunable number of the Phase model. Calibrated in reports/phase-model.md (77 songs, 50–300 cards). */
export const PHASE_MODEL_DEFAULTS: Readonly<PhaseModelConfig> = Object.freeze({
  liveCardProbability: 0.75,
  chanceWindowSongs: 5,
  midThreshold: Object.freeze({ line: 0.1, bingo: 0.05 }),
  thresholdReferenceCards: 200,
  thresholdExponent: Object.freeze({ line: -0.2, bingo: -0.2 }), // fitted: line −0.23, bingo −0.18
  thresholdScaleLimits: pair(0.5, 2),
  midMinSongs: 2,
  lateLeadSongs: pair(3, 8),
  finalSongWeights: Object.freeze([0.3, 0.4, 0.3]),
  falseAlarmChance: 0.35,
  falseAlarmSongWeights: Object.freeze([0.6, 0.4]),
  falseAlarmGapSongs: 2,
  unclaimedGraceSongs: 1,
  heatBands: Object.freeze({
    early: pair(0.05, 0.3),
    mid: pair(0.3, 0.55),
    late: pair(0.55, 0.8),
    final: pair(0.8, 1),
  }),
  heatChanceWeight: 0.5,
  heatJitter: 0.06,
  heatSmoothing: 0.6,
});

/** `o` without its undefined fields, so they do not hide the defaults when spread over them. */
const defined = <T extends object>(o: T | undefined): Partial<T> =>
  // fromEntries loses the key types; the entries are `o`'s own.
  Object.fromEntries(Object.entries(o ?? {}).filter(([, v]) => v !== undefined)) as Partial<T>;

/** The defaults with overrides applied (midThreshold, thresholdExponent and heatBands merge per key). */
export function resolvePhaseConfig(overrides: PhaseModelOverrides = {}): Readonly<PhaseModelConfig> {
  const d = PHASE_MODEL_DEFAULTS;
  return Object.freeze({
    ...d,
    ...defined(overrides),
    midThreshold: Object.freeze({ ...d.midThreshold, ...defined(overrides.midThreshold) }),
    thresholdExponent: Object.freeze({ ...d.thresholdExponent, ...defined(overrides.thresholdExponent) }),
    heatBands: Object.freeze({ ...d.heatBands, ...defined(overrides.heatBands) }),
  });
}

// ---------------------------------------------------------------------------------------- random

/** @returns The index picked. */
function pickWeighted(weights: readonly number[], random: () => number): number {
  const total = weights.reduce((sum, w) => sum + Math.max(0, w), 0);
  let r = random() * total;
  for (let i = 0; i < weights.length; i++) {
    r -= Math.max(0, weights[i]);
    if (r < 0) return i;
  }
  return weights.length - 1;
}

/** @param range  Inclusive integer range. */
const randomInt = ([lo, hi]: readonly [number, number], random: () => number) => lo + Math.floor(random() * (hi - lo + 1));

const clamp01 = (x: number) => Math.min(1, Math.max(0, x));

// ---------------------------------------------------------------------------------- public chance

/** Probability that m given songs all land within the next k of R remaining songs (hypergeometric). */
function allWithin(m: number, k: number, R: number): number {
  if (m > k || m > R) return 0;
  let p = 1;
  for (let i = 0; i < m; i++) p *= (k - i) / (R - i);
  return p;
}

/**
 * Line: inclusion–exclusion over the card's lines, exact because lines share no songs. Bingo: all at once.
 * @param within  Probability that m given songs all land in the window.
 */
function chanceFromMissing(missingByLine: ReadonlyArray<number>, kind: WinKind, within: (m: number) => number): number {
  if (kind === 'bingo') return within(missingByLine.reduce((a, b) => a + b, 0));
  let p = 0;
  const n = missingByLine.length;
  for (let mask = 1; mask < 1 << n; mask++) {
    let m = 0;
    let bits = 0;
    for (let i = 0; i < n; i++) {
      if (mask & (1 << i)) {
        m += missingByLine[i];
        bits++;
      }
    }
    p += (bits % 2 ? 1 : -1) * within(m);
  }
  return clamp01(p);
}

/**
 * Probability that one card completes a Line (any of its lines) or its Bingo within the next `within`
 * songs, when the order of the `remaining` songs is unknown.
 * @param missingByLine  Songs still missing per line; Infinity for a line that can never complete.
 * @param remaining  Songs still to land in the queue.
 */
export function cardWinChance(missingByLine: ReadonlyArray<number>, kind: WinKind, within: number, remaining: number): number {
  const k = Math.min(within, remaining);
  return chanceFromMissing(missingByLine, kind, (m) => allWithin(m, k, remaining));
}

/** What the public chance is computed from. */
export interface WinChanceOptions {
  cards: ReadonlyArray<Card>;
  queue: ReadonlyArray<number>;
  kind: WinKind;
  /** Songs in the window. */
  within?: number;
  /** Chance that a card in play is live (sold and claimed in time). */
  live?: number;
}

/**
 * The public chance of a win within the next `within` songs at every position from `from` to the end of
 * the queue: songs before the position have landed, and only the set of the others is used, not their
 * order. Cards that already completed (nobody claimed them) are left out.
 * @returns One value per position, from `from`.
 */
export function winChanceSeries({
  cards,
  queue,
  kind,
  from = 0,
  to = queue.length,
  within = PHASE_MODEL_DEFAULTS.chanceWindowSongs,
  live = PHASE_MODEL_DEFAULTS.liveCardProbability,
}: WinChanceOptions & {
  from?: number;
  /** Last position (exclusive); defaults to the end of the queue. */
  to?: number;
}): number[] {
  const first = Math.max(0, from);
  const last = Math.min(queue.length, to);
  const pos = queuePositions(queue);
  // Songs still missing per card and line, counted at `first`; Infinity when a song never lands.
  const missing: number[][] = [];
  // queue index → the [card, line] slots its landing fills
  const slotsAt = new Map<number, [number, number][]>();
  cards.forEach((card, c) => {
    missing.push(
      cardSongIds(card).map((line, l) => {
        let m = 0;
        for (const id of line) {
          const i = pos.get(id);
          if (i === undefined) return Infinity;
          if (i < first) continue;
          m++;
          const slots = slotsAt.get(i);
          if (slots) slots.push([c, l]);
          else slotsAt.set(i, [[c, l]]);
        }
        return m;
      }),
    );
  });
  const out: number[] = [];
  for (let p = first; p < last; p++) {
    const remaining = queue.length - p;
    const k = Math.min(within, remaining);
    const table: number[] = [];
    const inWindow = (m: number) => (m <= k ? (table[m] ??= allWithin(m, k, remaining)) : 0);
    let logNone = 0;
    for (const lines of missing) {
      const done = kind === 'bingo' ? lines.every((m) => m === 0) : lines.some((m) => m === 0);
      if (done) continue;
      logNone += Math.log1p(-live * chanceFromMissing(lines, kind, inWindow));
    }
    out.push(clamp01(1 - Math.exp(logNone)));
    for (const [c, l] of slotsAt.get(p) ?? []) missing[c][l]--;
  }
  return out;
}

/** The public chance of a win within the next `within` songs, at one position. See winChanceSeries. */
export function winChance({ cards, queue, position, kind, within, live }: WinChanceOptions & {
  /** Songs before this queue index have landed. */
  position: number;
}): number {
  return winChanceSeries({ cards, queue, kind, from: position, to: position + 1, within, live })[0] ?? 0;
}

/**
 * How much the thresholds move for the number of cards in play: (cards / reference) ^ exponent, clamped.
 * The public chance already counts every card, so this is a gentle correction: with few cards the chance
 * rises earlier relative to the win, so the threshold goes up a little.
 * @returns 1 at the reference number of cards.
 */
export function thresholdScale(kind: WinKind, cardsInPlayCount: number, config?: PhaseModelOverrides): number {
  const cfg = resolvePhaseConfig(config);
  const [lo, hi] = cfg.thresholdScaleLimits;
  const n = Math.max(1, cardsInPlayCount);
  return Math.min(hi, Math.max(lo, (n / cfg.thresholdReferenceCards) ** cfg.thresholdExponent[kind]));
}

/** The public chance at which mid starts, for this kind of win and number of cards in play. */
export function midThresholdFor(kind: WinKind, cardsInPlayCount: number, config?: PhaseModelOverrides): number {
  return resolvePhaseConfig(config).midThreshold[kind] * thresholdScale(kind, cardsInPlayCount, config);
}

// ------------------------------------------------------------------------------------------ plan

/**
 * The Phase and Heat for every queue position from `startPosition` to the end of the queue. plan[i] is
 * for queue index startPosition + i. The same options and seed always give the same plan.
 */
export function phasePlan({ cards, queue, kind, startPosition = 0, seed = 0, random, cardsInPlayCount, config }: PhasePlanOptions): PhaseStep[] {
  const cfg = resolvePhaseConfig(config);
  const rand = random ?? seededRandom(seed);
  const start = Math.max(0, Math.min(queue.length, Math.floor(startPosition)));
  const end = queue.length;
  const cardCount = cardsInPlayCount ?? cards.length;

  // 1. The known future: every completion, and the distinct positions where a win is possible.
  const all = completions(cards, queue, kind, 0);
  const completesAt = new Map<number, number>();
  for (const c of all) completesAt.set(c.index, (completesAt.get(c.index) ?? 0) + 1);
  const targetPositions = [...completesAt.keys()].filter((i) => i >= start).sort((a, b) => a - b);
  const passedBeforeStart = [...completesAt.keys()].filter((i) => i < start);

  // 2. The public chance and the mid threshold.
  const chance = winChanceSeries({ cards, queue, kind, from: start, within: cfg.chanceWindowSongs, live: cfg.liveCardProbability });
  const threshold = midThresholdFor(kind, cardCount, cfg);
  const crossingOffset = chance.findIndex((p) => p >= threshold);
  const crossing = crossingOffset < 0 ? Infinity : start + crossingOffset;

  // 3. The blur, drawn in a fixed order: per target its late lead and final length, then the false alarm.
  const targets = targetPositions.map((t) => {
    const lead = randomInt(cfg.lateLeadSongs, rand);
    const finalSongs = 1 + pickWeighted(cfg.finalSongWeights, rand);
    return { t, lateAt: Math.max(start, t - lead), finalAt: Math.max(start, t - finalSongs + 1) };
  });
  const first = targets[0];
  const midAt = first ? Math.max(start, Math.min(crossing, first.lateAt - cfg.midMinSongs)) : crossing;
  let falseAlarm: { from: number; to: number } | null = null;
  if (first && rand() < cfg.falseAlarmChance) {
    const songs = 1 + pickWeighted(cfg.falseAlarmSongWeights, rand);
    const lo = Math.max(start, midAt);
    const hi = first.lateAt - cfg.falseAlarmGapSongs - songs;
    if (hi >= lo) {
      // Weighted toward moments the room would also find tense: a higher public chance.
      const weights: number[] = [];
      for (let p = lo; p <= hi; p++) weights.push(0.5 + chance[p - start]);
      const from = lo + pickWeighted(weights, rand);
      falseAlarm = { from, to: from + songs - 1 };
    }
  }

  // 4. Phase per position: the highest rule wins.
  const steps: PhaseStep[] = [];
  let lastPassed = passedBeforeStart.length ? Math.max(...passedBeforeStart) : -Infinity;
  let targetIndex = 0;
  for (let p = start; p < end; p++) {
    while (targetIndex < targets.length && targets[targetIndex].t < p) lastPassed = targets[targetIndex++].t;
    const next = targets[targetIndex];
    let phase: Phase = 'early';
    let reason: PhaseReason = 'quiet';
    const raise = (candidate: Phase, why: PhaseReason) => {
      if (PHASE_RANK[candidate] > PHASE_RANK[phase]) {
        phase = candidate;
        reason = why;
      }
    };
    if (Number.isFinite(lastPassed)) raise(p - lastPassed <= cfg.unclaimedGraceSongs ? 'late' : 'mid', 'unclaimed');
    if (p >= midAt) raise('mid', p >= crossing ? 'chance' : 'ramp');
    if (falseAlarm && p >= falseAlarm.from && p <= falseAlarm.to) raise('late', 'false-alarm');
    if (next && p >= next.lateAt) raise('late', 'pre-final');
    if (next && p >= next.finalAt) raise('final', 'final');
    steps.push({ position: p, phase, heat: 0, expectedWinAt: next ? next.t : null, chance: chance[p - start] ?? 0, completes: completesAt.get(p) ?? 0, reason });
  }

  // 5. Heat: a band per phase, nudged by the public chance and seeded noise, smoothed within a phase.
  let prevPhase: Phase | null = null;
  let prevHeat = 0;
  for (const step of steps) {
    const [lo, hi] = cfg.heatBands[step.phase];
    const w = clamp01(cfg.heatChanceWeight);
    const u = clamp01(w * Math.sqrt(step.chance) + (1 - w) * rand());
    const raw = lo + (hi - lo) * u + (rand() * 2 - 1) * cfg.heatJitter;
    const heat = step.phase === prevPhase ? prevHeat + cfg.heatSmoothing * (raw - prevHeat) : raw;
    step.heat = Math.round(clamp01(heat) * 1000) / 1000;
    prevPhase = step.phase;
    prevHeat = step.heat;
  }
  return steps;
}

/**
 * Where a plan's phases change, measured against its first expected win. Handy for tests, reports and
 * a debug HUD.
 */
export function describePlan(steps: ReadonlyArray<PhaseStep>): PlanSummary {
  const out: PlanSummary = { winAt: null, midAt: null, lateAt: null, finalAt: null, falseAlarms: [] };
  if (!steps.length) return out;
  const start = steps[0].position;
  const rankAt = (position: number) => PHASE_RANK[steps[position - start].phase];
  const mid = steps.find((s) => PHASE_RANK[s.phase] >= PHASE_RANK.mid);
  out.midAt = mid ? mid.position : null;
  const winAt = steps[0].expectedWinAt;
  out.winAt = winAt;
  if (winAt != null && rankAt(winAt) >= PHASE_RANK.late) {
    let p = winAt;
    while (p > start && rankAt(p - 1) >= PHASE_RANK.late) p--;
    out.lateAt = p;
    if (rankAt(winAt) === PHASE_RANK.final) {
      let f = winAt;
      while (f > start && rankAt(f - 1) === PHASE_RANK.final) f--;
      out.finalAt = f;
    }
  }
  // late runs before the real one (or anywhere up to the win, if it has none) are false alarms.
  const before = out.lateAt ?? (winAt != null ? winAt + 1 : start + steps.length);
  for (let p = start; p < before; p++) {
    if (rankAt(p) < PHASE_RANK.late) continue;
    const from = p;
    while (p + 1 < before && rankAt(p + 1) >= PHASE_RANK.late) p++;
    out.falseAlarms.push({ from, to: p });
  }
  return out;
}
