// Solve a drum spin that lands on a chosen card at a chosen time, using shuffle-test's WheelPhysics
// unchanged. Two facts make this cheap:
//  - the detent has a period of exactly one card, so the motion is unchanged under whole-card shifts;
//  - replaying a simulated trajectory with time scaled by s is itself a valid physical motion
//    (forces scaled by 1/s², drag by 1/s), so a moderate s stays plausible.
// We pick a random spin (seeded), bisect the push's top speed until the wheel rests on the wanted
// card count, then time-scale the replay so the wheel locks at exactly durationSec.
import { WheelPhysics, FIXED_STEP } from './physics.ts';
import type { WheelSpin } from './physics.ts';
import { seededRandom, secureRandom, mod } from '../rng.ts';

export type { WheelSpin } from './physics.ts';

const LOCK_POSITION_TOLERANCE = 0.03;
const LOCK_VELOCITY_TOLERANCE = 0.3;
const MAX_SIM_SECONDS = 60;
const REFERENCE_CARD_COUNT = 36; // same as shuffle-physics.ts
const TOP_SPEED_RANGE = [20, 40] as const;
const CALM_TOP_SPEED_RANGE = [8, 16] as const;
export const SCALE_RANGE: readonly [number, number] = [0.85, 1.2];
// How far the solved top speed may leave shuffle-physics.ts's drawn range, as a factor.
const TOP_SPEED_SLACK = [0.6, 1.6] as const;
const BISECT_ITERATIONS = 14;

/** A detent crossing: when (motion seconds), how fast (cards/s), and which way (±1). */
export interface Tick {
  t: number;
  speed: number;
  direction: number;
}

export interface SimParams {
  cardCount: number;
  seed: number;
  isCalm?: boolean;
  topSpeed?: number | null;
  drag?: number | null;
  record?: boolean;
}

/** One simulated spin. Positions are in cards from the start, one sample per FIXED_STEP. */
export interface SimRun {
  traveled: number;
  finalPosition: number;
  stopTime: number;
  direction: number;
  spin: WheelSpin;
  positions: number[] | null;
  velocities: number[] | null;
  ticks: Tick[];
  settled: boolean;
}

/** A run simulated with `record: true`. */
export type RecordedRun = SimRun & { positions: number[]; velocities: number[] };

/** How a Solution was made: a physics spin, the analytic fallback, or a sampled glide or brake. */
export type SolutionMethod = 'physics' | 'analytic' | 'glide' | 'brake' | 'coast' | 'landing';

/**
 * A replayable drum motion, from any of the solvers. `positions` are cards relative to `fromIndex`, sampled
 * every `dt` seconds of motion time; a replay runs at motion time × `scale`, so it locks at `durationSec`.
 */
export interface Solution {
  positions: Float32Array;
  velocities: Float32Array;
  ticks: Tick[];
  dt: number;
  scale: number;
  lockTime: number;
  durationSec: number;
  fromIndex: number;
  traveled: number;
  direction: number;
  cardCount: number;
  seed: number | null;
  topSpeed: number | null;
  drag?: number | null;
  method: SolutionMethod;
  attempts: number;
}

/** A launched wheel and the spin it drew (the same object as `wheel.spin`). */
function createWheel({ cardCount, seed, isCalm, onTick }: {
  cardCount: number; seed: number; isCalm: boolean; onTick?: (speed: number, direction: number) => void;
}): { wheel: WheelPhysics; spin: WheelSpin } {
  const wheel = new WheelPhysics({ cardCount, random: seededRandom(seed), isCalm, onTick });
  wheel.position = 0;
  wheel.launch();
  if (!wheel.spin) throw new Error('WheelPhysics.launch() drew no spin');
  return { wheel, spin: wheel.spin };
}

// Run one spin. With record=true also keep positions, velocities and ticks for replay.
export function simulate(params: SimParams & { record: true }): RecordedRun;
export function simulate(params: SimParams): SimRun;
export function simulate({ cardCount, seed, isCalm = false, topSpeed = null, drag = null, record = false }: SimParams): SimRun {
  let time = 0;
  const ticks: Tick[] = [];
  const { wheel, spin } = createWheel({
    cardCount,
    seed,
    isCalm,
    onTick: record ? (speed, direction) => ticks.push({ t: time, speed, direction }) : undefined,
  });
  if (topSpeed != null) spin.topSpeed = topSpeed;
  if (drag != null) spin.drag = drag;
  // Both arrays exist exactly when `record` is set.
  const positions = record ? [0] : null;
  const velocities = record ? [0] : null;
  while (wheel.isSpinning && time < MAX_SIM_SECONDS) {
    time += FIXED_STEP;
    wheel.step(FIXED_STEP);
    if (positions && velocities) {
      positions.push(wheel.position);
      velocities.push(wheel.velocity);
    }
  }
  return {
    traveled: Math.round(wheel.position),
    finalPosition: wheel.position,
    stopTime: time,
    direction: spin.direction,
    spin: { ...spin },
    positions,
    velocities,
    ticks,
    settled: !wheel.isSpinning,
  };
}

/**
 * When a recorded run first sits on its final card, after its last detent crossing.
 * @returns simulation seconds
 */
function lockTimeOf(run: RecordedRun): number {
  const { positions, velocities, ticks, finalPosition } = run;
  const lastCrossing = ticks.length ? ticks[ticks.length - 1].t : 0;
  const startIndex = Math.ceil(lastCrossing / FIXED_STEP);
  for (let i = startIndex; i < positions.length; i++) {
    if (Math.abs(positions[i] - finalPosition) < LOCK_POSITION_TOLERANCE && Math.abs(velocities[i]) < LOCK_VELOCITY_TOLERANCE) {
      return i * FIXED_STEP;
    }
  }
  return (positions.length - 1) * FIXED_STEP;
}

/** @returns the top speeds the solver may use */
function speedRange(cardCount: number, isCalm: boolean): [number, number] {
  const speedScale = Math.max(1, cardCount / REFERENCE_CARD_COUNT);
  const [min, max] = isCalm ? CALM_TOP_SPEED_RANGE : TOP_SPEED_RANGE;
  return [min * speedScale * TOP_SPEED_SLACK[0], max * speedScale * TOP_SPEED_SLACK[1]];
}

// Smallest top speed whose spin travels at least `cards` cards (|traveled| ≥ cards).
/** @returns null when even `hi` falls short */
function lowestSpeedFor(params: SimParams, cards: number, lo: number, hi: number): number | null {
  const travel = (speed: number) => Math.abs(simulate({ ...params, topSpeed: speed }).traveled);
  if (travel(hi) < cards) return null;
  if (travel(lo) >= cards) return lo;
  for (let i = 0; i < BISECT_ITERATIONS; i++) {
    const mid = (lo + hi) / 2;
    if (travel(mid) >= cards) hi = mid;
    else lo = mid;
  }
  return hi;
}

// Top speed in the middle of the plateau that rests exactly on `cards`.
function fitTopSpeed(params: SimParams, cards: number, range: readonly [number, number]): { speed: number; run: RecordedRun } | null {
  const [lo, hi] = range;
  const start = lowestSpeedFor(params, cards, lo, hi);
  if (start == null) return null;
  const end = lowestSpeedFor(params, cards + 1, start, hi) ?? hi;
  for (const fraction of [0.5, 0.35, 0.65, 0.2, 0.8]) {
    const speed = start + (end - start) * fraction;
    const run = simulate({ ...params, topSpeed: speed, record: true });
    if (Math.abs(run.traveled) === cards && run.settled) return { speed, run };
  }
  return null;
}

// Drag is one of the per-spin random parameters; we steer it (within a wider plausible band) so the
// spin's natural duration approaches the wanted one, then the time scale absorbs the rest.
const DRAG_LIMITS = [0.08, 1.6] as const;
const DRAG_ITERATIONS = 4;

/** What solveSpin needs: where the drum is, where it must rest, and when it must lock. */
export interface SpinRequest {
  cardCount: number;
  fromIndex: number;
  targetIndex: number;
  durationSec: number;
  isCalm?: boolean;
  /** With 1 or more, always strictly more than one lap. */
  minLaps?: number;
  /** Default: enough laps for about 240 cards of travel. */
  maxLaps?: number | null;
  /** Draws the seeds. */
  random?: () => number;
  maxAttempts?: number;
}

/**
 * A physics spin from card `fromIndex` that rests on `targetIndex` and locks at exactly `durationSec`,
 * or the analytic fallback when no physics spin fits.
 */
export function solveSpin({ cardCount, fromIndex, targetIndex, durationSec, isCalm = false, minLaps = 1, maxLaps = null,
  random = secureRandom, maxAttempts = 12 }: SpinRequest): Solution {
  const range = speedRange(cardCount, isCalm);
  const lapsCap = maxLaps ?? Math.max(3, Math.ceil(240 / cardCount));
  let attempts = 0;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const seed = Math.floor(random() * 2 ** 32) >>> 0;
    const natural = simulate({ cardCount, seed, isCalm });
    const direction = natural.direction;
    const base = mod(direction * (targetIndex - fromIndex), cardCount);
    const options: number[] = [];
    for (let laps = minLaps; laps <= lapsCap; laps++) {
      const cards = base + laps * cardCount;
      if (cards === 0) continue;
      if (minLaps >= 1 && cards <= cardCount) continue; // always strictly more than one lap
      options.push(cards);
    }
    if (!options.length) options.push(base + cardCount);
    let drag = natural.spin.drag;
    for (let iteration = 0; iteration < DRAG_ITERATIONS; iteration++) {
      attempts++;
      const params: SimParams = { cardCount, seed, isCalm, drag };
      const traveled = iteration === 0 ? Math.abs(natural.traveled) : Math.abs(simulate(params).traveled);
      const cards = options.reduce((best, c) => (Math.abs(c - traveled) < Math.abs(best - traveled) ? c : best), options[0]);
      const fit = fitTopSpeed(params, cards, range);
      if (!fit) break;
      const lockTime = lockTimeOf(fit.run);
      const scale = durationSec / lockTime;
      if (scale >= SCALE_RANGE[0] && scale <= SCALE_RANGE[1]) {
        return {
          positions: Float32Array.from(fit.run.positions),
          velocities: Float32Array.from(fit.run.velocities),
          ticks: fit.run.ticks,
          dt: FIXED_STEP,
          scale,
          lockTime,
          durationSec,
          fromIndex,
          traveled: fit.run.traveled,
          direction,
          cardCount,
          seed,
          topSpeed: fit.speed,
          drag,
          method: 'physics',
          attempts,
        };
      }
      const next = Math.min(DRAG_LIMITS[1], Math.max(DRAG_LIMITS[0], drag * (lockTime / durationSec)));
      if (Math.abs(next - drag) < 1e-4) break;
      drag = next;
    }
  }
  return analyticSpin({ cardCount, fromIndex, targetIndex, durationSec, minLaps, attempts });
}

// Fallback: constant deceleration from ω0 = 2Θ/T, with a small settle after the lock.
export function analyticSpin({ cardCount, fromIndex, targetIndex, durationSec, minLaps = 1, attempts = 0, direction = 1 }: {
  cardCount: number; fromIndex: number; targetIndex: number; durationSec: number; minLaps?: number;
  attempts?: number; direction?: number;
}): Solution {
  const base = mod(direction * (targetIndex - fromIndex), cardCount);
  const cards = base + Math.max(minLaps, base === 0 ? 1 : minLaps) * cardCount;
  const omega0 = (2 * cards) / durationSec;
  const steps = Math.ceil((durationSec + 0.5) / FIXED_STEP);
  const positions = new Float32Array(steps + 1);
  const velocities = new Float32Array(steps + 1);
  const ticks: Tick[] = [];
  let previousSlot = 0;
  for (let i = 0; i <= steps; i++) {
    const t = Math.min(i * FIXED_STEP, durationSec);
    const x = omega0 * t - 0.5 * (omega0 / durationSec) * t * t;
    positions[i] = direction * x;
    velocities[i] = direction * Math.max(0, omega0 - (omega0 / durationSec) * t);
    const slot = Math.floor(positions[i] + 0.5);
    if (slot !== previousSlot) {
      ticks.push({ t: i * FIXED_STEP, speed: Math.abs(velocities[i]), direction: Math.sign(slot - previousSlot) });
      previousSlot = slot;
    }
  }
  return {
    positions, velocities, ticks, dt: FIXED_STEP, scale: 1, lockTime: durationSec, durationSec, fromIndex,
    traveled: direction * cards, direction, cardCount, seed: null, topSpeed: omega0, method: 'analytic', attempts,
  };
}

// Replay helpers: t is seconds since spin start, in audio-clock time.
/** @returns absolute drum position in cards */
export function positionAt(solution: Solution, t: number): number {
  const { positions, dt, scale, fromIndex } = solution;
  if (t <= 0) return fromIndex;
  const u = t / scale / dt;
  const i = Math.floor(u);
  if (i >= positions.length - 1) return fromIndex + solution.traveled; // rest exactly centered
  const f = u - i;
  return fromIndex + positions[i] + (positions[i + 1] - positions[i]) * f;
}

/** @returns cards per second of audio-clock time */
export function velocityAt(solution: Solution, t: number): number {
  const { velocities, dt, scale } = solution;
  if (t <= 0) return 0;
  const i = Math.floor(t / scale / dt);
  if (i >= velocities.length) return 0;
  return velocities[i] / scale;
}

// Tick times relative to spin start, already time-scaled.
export function tickTimes(solution: Solution): Tick[] {
  return solution.ticks.map((tick) => ({ t: tick.t * solution.scale, speed: tick.speed / solution.scale, direction: tick.direction }));
}

/** @returns the card index the solution rests on */
export function landedIndex(solution: Solution): number {
  return mod(solution.fromIndex + solution.traveled, solution.cardCount);
}

// Build a replayable solution from a sampled motion x(t) (cards, relative to fromIndex) over durationSec.
function sampledSolution({ cardCount, fromIndex, durationSec, x, v, method }: {
  cardCount: number; fromIndex: number; durationSec: number; x: (t: number) => number;
  v: (t: number) => number; method: 'glide' | 'brake' | 'coast' | 'landing';
}): Solution {
  const steps = Math.max(1, Math.ceil(durationSec / FIXED_STEP));
  const positions = new Float32Array(steps + 1);
  const velocities = new Float32Array(steps + 1);
  const ticks: Tick[] = [];
  let previousSlot = Math.floor(fromIndex + 0.5);
  for (let i = 0; i <= steps; i++) {
    const t = Math.min(i * FIXED_STEP, durationSec);
    positions[i] = x(t);
    velocities[i] = v(t);
    const slot = Math.floor(fromIndex + positions[i] + 0.5);
    if (slot !== previousSlot) {
      ticks.push({ t, speed: Math.max(1, Math.abs(velocities[i])), direction: Math.sign(slot - previousSlot) });
      previousSlot = slot;
    }
  }
  const traveled = positions[steps];
  return { positions, velocities, ticks, dt: FIXED_STEP, scale: 1, lockTime: durationSec, durationSec, fromIndex, traveled,
    direction: Math.sign(traveled) || 1, cardCount, seed: null, topSpeed: null, method, attempts: 0 };
}

// A short, eased move of a whole number of cards (Back turns the drum back one card).
export function glideSpin({ cardCount, fromIndex, delta, durationSec = 0.9 }: { cardCount: number; fromIndex: number; delta: number; durationSec?: number }): Solution {
  const ease = (u: number) => 1 - (1 - u) ** 3;
  const dEase = (u: number) => 3 * (1 - u) ** 2;
  return sampledSolution({
    cardCount, fromIndex, durationSec, method: 'glide',
    x: (t) => delta * ease(Math.min(1, t / durationSec)),
    v: (t) => (delta * dEase(Math.min(1, t / durationSec))) / durationSec,
  });
}

// Constant deceleration from the drum's current motion to rest exactly on `restPosition` (an integer):
// a cancelled Spin brakes to a stop instead of jumping. Velocity is continuous at the start.
export function brakeSpin({ cardCount, fromPosition, velocity, restPosition }: { cardCount: number; fromPosition: number; velocity: number; restPosition: number }): Solution {
  const distance = restPosition - fromPosition;
  if (Math.abs(distance) < 1e-6) {
    // Already resting on that card (e.g. cancelled before the Spin moved): hold still for a moment.
    return sampledSolution({ cardCount, fromIndex: restPosition, durationSec: 0.35, method: 'brake', x: () => 0, v: () => 0 });
  }
  const v0 = Math.sign(distance) === Math.sign(velocity) && Math.abs(velocity) > 0.5 ? velocity : Math.sign(distance) * 2;
  const durationSec = Math.min(4, Math.max(0.35, (2 * distance) / v0));
  const a = (2 * (distance - v0 * durationSec)) / durationSec ** 2; // x(T) = distance exactly
  return sampledSolution({
    cardCount, fromIndex: fromPosition, durationSec, method: 'brake',
    x: (t) => v0 * t + 0.5 * a * t * t,
    v: (t) => v0 + a * t,
  });
}

// Suspense: a real spin up to `gap` cards before the target (at least `minLaps` laps, `spinUpSec`), then a
// crawl with near-stops: the speed swings smoothly between `minSpeed` and `maxSpeed` once every `periodSec`.
// The crawl is slowed when needed so it never reaches the target within `durationSec`; a release then only
// needs a short brake (landingBrake) onto it.
export function coastSpin({ cardCount, fromIndex, targetIndex, durationSec, spinUpSec, gap, minLaps, minSpeed, maxSpeed, periodSec }: {
  cardCount: number; fromIndex: number; targetIndex: number; durationSec: number; spinUpSec: number; gap: number;
  minLaps: number; minSpeed: number; maxSpeed: number; periodSec: number;
}): Solution {
  const n = cardCount;
  const ahead = Math.max(1, Math.min(gap, n - 1));
  // Spin up: from rest to `ahead` cards before the target, whole laps on top, arriving at the crawl speed.
  const stop = (((targetIndex - ahead - fromIndex) % n) + n) % n;
  const L = stop + n * Math.max(0, minLaps) || n; // never a standstill spin-up
  // The crawl may cover at most `ahead - 0.5` cards over the rest of the coast.
  const crawlSec = Math.max(0.1, durationSec - spinUpSec);
  const mean = (minSpeed + maxSpeed) / 2;
  const k = Math.min(1, (ahead - 0.5) / (mean * crawlSec + (maxSpeed - minSpeed) * periodSec / (2 * Math.PI)));
  const lo = minSpeed * k;
  const swing = (maxSpeed - minSpeed) * k;
  const t1 = spinUpSec;
  const b = (3 * L) / t1 ** 2 - lo / t1;
  const c = lo / t1 ** 2 - (2 * L) / t1 ** 3;
  const w = (2 * Math.PI) / periodSec;
  return sampledSolution({
    cardCount, fromIndex, durationSec, method: 'coast',
    x: (t) => (t <= t1 ? b * t * t + c * t ** 3 : L + lo * (t - t1) + swing * ((t - t1) / 2 - Math.sin(w * (t - t1)) / (2 * w))),
    v: (t) => (t <= t1 ? 2 * b * t + 3 * c * t * t : lo + swing * (0.5 - 0.5 * Math.cos(w * (t - t1)))),
  });
}

// From the drum's current motion to rest exactly on card `targetIndex` exactly `durationSec` later (a
// released Suspense lands on the beat). A cubic keeps the speed continuous at the start and ends at rest. The
// card is the first one ahead at least v·D/3 away, which keeps the drum from ever turning back.
export function landingBrake({ cardCount, fromPosition, velocity, targetIndex, durationSec }: {
  cardCount: number; fromPosition: number; velocity: number; targetIndex: number; durationSec: number;
}): Solution {
  const D = Math.max(0.05, durationSec);
  const v0 = Math.max(0, velocity);
  const minAhead = Math.max((v0 * D) / 3, 0.05);
  let target = targetIndex + cardCount * Math.ceil((fromPosition + minAhead - targetIndex) / cardCount);
  if (target - fromPosition < minAhead - 1e-9) target += cardCount;
  const d = target - fromPosition;
  const b = (3 * d) / D ** 2 - (2 * v0) / D;
  const c = v0 / D ** 2 - (2 * d) / D ** 3;
  return sampledSolution({
    cardCount, fromIndex: fromPosition, durationSec: D, method: 'landing',
    x: (t) => v0 * t + b * t * t + c * t ** 3,
    v: (t) => v0 + 2 * b * t + 3 * c * t * t,
  });
}

// Where a brake from (position, velocity) should naturally stop: about 1.2–2.5 s of deceleration, at least
// half a card ahead, rounded to a card.
/** @returns a whole card position */
export function brakeRest(position: number, velocity: number): number {
  const speed = Math.abs(velocity);
  if (speed < 0.5) return Math.round(position);
  const seconds = Math.min(2.5, 1.2 + speed / 30);
  const dir = Math.sign(velocity);
  const ahead = Math.max(0.6, (speed * seconds) / 2);
  return dir > 0 ? Math.ceil(position + ahead - 0.5) : Math.floor(position - ahead + 0.5);
}
