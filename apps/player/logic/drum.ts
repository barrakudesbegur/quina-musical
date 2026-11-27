// The phone's drum is the projector's (D237; §8 Y1, the user's second production test: "make sure the drum uses the
// same effects as the projector"; ANIMATIONS.md `reel-spin`, `landing`). Pure.
//
// - **The tiles:** the round's songs (printed on that side of its card type: its pool) in `drumOrder(songs, drumSeed)`,
//   the songs still to come plus the last landing, as the engine's `drumReset` gives the projector.
// - **A Spin:** the last landing leaves the ring as it starts (the projector's `removeCard`), and the ring turns by the
//   projector's solver (packages/rules/drum-solver.ts) with the same tile count, start tile, duration, laps and the
//   Spin's public `spinSeed`. The target is private until it lands (U206), so the phone solves towards a stand-in (where
//   that seed's spin rests by itself), and never comes to rest on it: under `creepFromSpeed` it creeps on, slowing
//   towards `creepFloor`, blurred at least `veilPx`, until the landing is public.
// - **The landing** (or a Back, or a cancelled Spin: whenever the last landing's tile changes): the drum glides from
//   its position and speed to that tile by the shortest way round (the solver's `hoverSpin` with no sway).
// Nothing here knows the target before the landing is public: every frame before it depends only on public fields.
import { drumOrder, drumRandom, type PublicLanding, type PublicSpin } from '../feed/public.ts';
import { coastSpin, hoverSpin, positionAt, simulate, solveSpin, velocityAt, type Solution } from '../../../packages/rules/drum-solver.ts';
import type { Catalog } from '../../../packages/ui/data/catalog.ts';

export const DRUM = Object.freeze({
  /** The full drum's tile (player.css `--tile`, 7.5rem), for the motion blur's px per frame. */
  tilePx: 120,
  /** The projector's `CARD_GAP_RATIO`. */
  gap: 0.08,
  /** The perspective, in tiles (the projector's `--card-size × 5`). */
  perspectiveTiles: 5,
  /** The projector's motion blur (wheel/drum.ts): from 6 px per frame, 0.2 of it, at 60 frames a second. */
  blurMinPxPerFrame: 6,
  blurStrength: 0.2,
  /** While a Spin runs and its landing isn't public, the blur never drops under this (px). */
  veilPx: 3,
  /** Under this speed (tiles/s), after its peak, the stand-in Spin stops following the solver and creeps on… */
  creepFromSpeed: 2.5,
  /** …its speed easing (time constant `creepEaseSec`) towards this one, never stopping. */
  creepFloor: 0.6,
  creepEaseSec: 0.8,
  /** The glide to the landed tile: `glideBaseSec + glidePerTileSec × tiles`, within [glideMinSec, glideMaxSec]. */
  glideBaseSec: 0.45,
  glidePerTileSec: 0.03,
  glideMinSec: 0.5,
  glideMaxSec: 1.4,
  /** A Suspense: the projector's coast (SUSPENSE in the engine's config), a bar taken as 2 s (the phone has no bpm). */
  coast: { spinUpSec: 3, wanderTiles: [3, 1.5] as const, wanderSec: [8, 22] as const, lastsSec: 120 },
});

const mod = (value: number, n: number): number => ((value % n) + n) % n;

/** The round's songs: every song printed on side `side` of the cards of type `cardType` (the side's pool), sorted. */
export function roundSongs(catalog: Catalog | null, cardType: string, side: number): number[] {
  const ids = new Set<number>();
  for (const card of catalog?.cards.values() ?? []) {
    if (card.type !== cardType) continue;
    for (const line of card.sides.find((s) => s.side === side)?.lines ?? []) for (const id of line) ids.add(id);
  }
  return [...ids].sort((a, b) => a - b);
}

/** The round's drum order: `drumOrder` from its public `drumSeed`, or from its number when an older engine sent none. */
export function roundOrder(songs: readonly number[], drumSeed: number | undefined, roundNumber: number): number[] {
  return drumOrder(songs, drumSeed ?? roundNumber);
}

/** The latest landing (by Queue position), or null. */
export function lastLanding(landings: readonly PublicLanding[]): PublicLanding | null {
  let last: PublicLanding | null = null;
  for (const l of landings) if (!last || l.position > last.position) last = l;
  return last;
}

/** The ring: the order's songs not landed yet, plus `keep` (the last landing, under the window) where it sits. */
export function ringOf(order: readonly number[], landings: readonly PublicLanding[], keep: number | null): number[] {
  const landed = new Set(landings.map((l) => l.songId));
  return order.filter((id) => !landed.has(id) || id === keep);
}

/** Where a Spin starts: the ring without the last landing, and the tile the drum then rests on (the projector's
 * `removeCard`: the drum stays where it was, which is now the next tile). */
export function spinStart(order: readonly number[], landings: readonly PublicLanding[]): { ring: number[]; fromIndex: number } {
  const last = lastLanding(landings);
  const ring = ringOf(order, landings, null);
  if (!last || !ring.length) return { ring, fromIndex: 0 };
  const before = ringOf(order, landings, last.songId);
  return { ring, fromIndex: mod(before.indexOf(last.songId), ring.length) };
}

/** What the projector solves a Spin from (main.ts › startTransition). */
export interface SpinInputs {
  cardCount: number;
  fromIndex: number;
  durationSec: number;
  spinSeed: number;
}

/**
 * The projector's Spin for `targetIndex` (exactly main.ts's `solveSpin` call: not calm, a lap at least from 3 tiles),
 * or, with no target, the stand-in: the tile where this seed's spin would rest by itself (the solver's first draw).
 */
export function spinSolution({ cardCount, fromIndex, durationSec, spinSeed }: SpinInputs, targetIndex?: number): Solution {
  const target = targetIndex ?? mod(fromIndex + simulate({ cardCount, seed: Math.floor(drumRandom(spinSeed)() * 2 ** 32) >>> 0 }).traveled, cardCount);
  return solveSpin({ cardCount, fromIndex, targetIndex: target, durationSec, minLaps: cardCount < 3 ? 0 : 1, random: drumRandom(spinSeed) });
}

/** When (replay seconds) a stand-in Spin, past its top speed, first turns slower than `creepFromSpeed`. */
export function creepStart(solution: Solution): number {
  const { velocities, dt, scale } = solution;
  let peak = 0;
  for (let i = 1; i < velocities.length; i++) if (Math.abs(velocities[i]) > Math.abs(velocities[peak])) peak = i;
  for (let i = peak; i < velocities.length; i++) if (Math.abs(velocities[i]) / scale < DRUM.creepFromSpeed) return i * dt * scale;
  return solution.durationSec;
}

/** A stand-in Spin at `t` s: the solver's curve until `creepStart`, then the creep that never stops. */
export function standInMotion(solution: Solution, creepAt: number, t: number): { position: number; velocity: number } {
  if (t < creepAt) return { position: positionAt(solution, t), velocity: velocityAt(solution, t) };
  const x0 = positionAt(solution, creepAt);
  const v0 = velocityAt(solution, creepAt);
  const dir = Math.sign(v0) || solution.direction || 1;
  const extra = Math.max(0, Math.abs(v0) - DRUM.creepFloor);
  const k = DRUM.creepEaseSec;
  const u = t - creepAt;
  const fade = Math.exp(-u / k);
  return { position: x0 + dir * (DRUM.creepFloor * u + extra * k * (1 - fade)), velocity: dir * (DRUM.creepFloor + extra * fade) };
}

/** A Suspense's coast (the projector's `coastSpin`), its stop tile and phase drawn from the Spin's start time. */
export function coastSolution(cardCount: number, fromIndex: number, startAtMs: number): Solution {
  const random = drumRandom(startAtMs >>> 0);
  const c = DRUM.coast;
  return coastSpin({
    cardCount, fromIndex, stopIndex: Math.floor(random() * cardCount), durationSec: c.lastsSec, spinUpSec: c.spinUpSec,
    minLaps: cardCount < 3 ? 0 : 1, amp1: Math.min(c.wanderTiles[0], cardCount / 3), period1: c.wanderSec[0],
    amp2: Math.min(c.wanderTiles[1], cardCount / 6), period2: c.wanderSec[1], phase2: random() * 2 * Math.PI,
  });
}

/** The glide's length for a distance of `tiles`. */
export function glideSec(tiles: number): number {
  return Math.min(DRUM.glideMaxSec, Math.max(DRUM.glideMinSec, DRUM.glideBaseSec + DRUM.glidePerTileSec * Math.abs(tiles)));
}

/** The whole position showing tile `index` nearest to `position` (positions count whole turns: no turn is lost). */
export function nearestTurn(index: number, position: number, cardCount: number): number {
  return index + cardCount * Math.round((position - index) / cardCount);
}

/** From a motion (position, speed) to rest exactly on `targetIndex` by the shortest way round. */
export function glideSolution(cardCount: number, position: number, velocity: number, targetIndex: number): Solution {
  const sec = glideSec(nearestTurn(targetIndex, position, cardCount) - position);
  return hoverSpin({ cardCount, fromPosition: position, velocity, targetIndex, arriveSec: sec, durationSec: sec, sway: 0 });
}

/** The projector's motion blur for a speed (tiles/s): its px at the phone's tile. */
export function motionBlurPx(velocity: number, tilePx: number = DRUM.tilePx): number {
  const perFrame = (Math.abs(velocity) * tilePx) / 60;
  return perFrame >= DRUM.blurMinPxPerFrame ? Math.round(perFrame * DRUM.blurStrength) : 0;
}

/** What the drum is doing: still with nothing landed, turning (a Spin or a Suspense), creeping while it waits for the
 * landing, gliding to the landed tile, or resting on it. */
export type DrumPhase = 'idle' | 'spinning' | 'waiting' | 'gliding' | 'landed';

export interface DrumInput {
  /** The round's drum order (roundOrder). */
  order: readonly number[];
  /** The round's public landings. */
  landings: readonly PublicLanding[];
  spin: PublicSpin | null;
  /** The cloud's clock. */
  nowMs: number;
  /** Reduced motion: the ring jumps, never turns. */
  reduced: boolean;
}

export interface DrumFrame {
  ring: readonly number[];
  /** Tiles turned (the window shows tile `position mod ring.length`). */
  position: number;
  /** Tiles per second. */
  velocity: number;
  phase: DrumPhase;
  /** The landed song, selected (the projector's `is-selected`), once the drum rests on it. */
  selectedId: number | null;
  /** The motion blur's width (px at the full drum's tile). */
  blurPx: number;
}

interface Motion {
  kind: 'spin' | 'coast' | 'glide';
  /** The Spin it belongs to (its start time), or the landing it glides to. */
  key: string;
  ring: readonly number[];
  solution: Solution;
  startMs: number;
  /** A stand-in Spin's creep start (replay seconds). */
  creepAt: number;
}

/**
 * The landing the drum's words show (ANIMATIONS.md `landing`, §13): the latest once the drum rests on its tile, else the
 * one they showed, so the title changes as the drum comes to rest, never while it still turns or glides to the landed
 * tile (a Back or a cancelled Spin the same). With reduced motion the drum rests on the tile at once. No landing: none.
 */
export function wordsLanding(frame: Pick<DrumFrame, 'phase' | 'selectedId'>, latest: PublicLanding | null, shown: PublicLanding | null): PublicLanding | null {
  if (!latest) return null;
  const resting = frame.phase === 'landed' || frame.phase === 'idle';
  return resting && (frame.selectedId === null || frame.selectedId === latest.songId) ? latest : shown;
}

/** The words are the drum's last ones, faded, while it turns or glides (`reel-spin`, `landing`). */
export function wordsStale(phase: DrumPhase): boolean {
  return phase === 'spinning' || phase === 'waiting' || phase === 'gliding';
}

/**
 * Solves a Spin's stand-in (spinSolution), or answers null while its solution is still being worked out elsewhere
 * (the app solves off the main thread: device/drum-solver.ts); the drum asks again on its next frame.
 */
export type SpinSolver = (inputs: SpinInputs) => Solution | null;

/**
 * The drum's motion over time. Stateful only in what the phone has seen: the motion running (a Spin's stand-in curve
 * or coast, a glide) and the last frame, so a landing, a Back or a cancelled Spin glides on from where the drum is.
 * A Spin is solved once (`solve`, spinSolution here and now by default); every frame only samples the solved curve.
 * Until the solution is there, the ring waits on its start tile, veiled, as a Spin's first instant looks anyway.
 */
export class PhoneDrum {
  private motion: Motion | null = null;
  private last: DrumFrame | null = null;
  private readonly solve: SpinSolver;

  constructor(solve: SpinSolver = (inputs) => spinSolution(inputs)) {
    this.solve = solve;
  }

  frame(input: DrumInput): DrumFrame {
    const frame = this.compute(input);
    this.last = frame;
    return frame;
  }

  private compute({ order, landings, spin, nowMs, reduced }: DrumInput): DrumFrame {
    const last = lastLanding(landings);
    const spinning = spin !== null && !(last && last.atMs >= spin.startAtMs);
    if (spinning) return this.spinFrame(order, landings, spin, nowMs, reduced);
    const ring = ringOf(order, landings, last?.songId ?? null);
    const target = last ? Math.max(0, ring.indexOf(last.songId)) : 0;
    const key = `${last?.position ?? -1}:${last?.songId ?? ''}:${ring.length}`;
    const rest = (): DrumFrame => {
      this.motion = null;
      const position = this.last?.ring.length === ring.length ? nearestTurn(target, this.last.position, ring.length) : target;
      return { ring, position, velocity: 0, phase: last ? 'landed' : 'idle', selectedId: last?.songId ?? null, blurPx: 0 };
    };
    if (reduced || !ring.length) return rest();
    if (this.motion?.kind !== 'glide' || this.motion.key !== key) {
      // Where the drum is now, in this ring: the tile under the window keeps its place (a cancelled Spin or a Back puts
      // a song back), and the drum glides on to the last landing's tile.
      const from = this.last ? this.positionIn(ring, this.last) : null;
      if (from === null) return rest();
      const settled = this.last?.phase === 'landed' || this.last?.phase === 'idle';
      if (settled && Math.abs(from - nearestTurn(target, from, ring.length)) < 1e-6) return rest();
      this.motion = { kind: 'glide', key, ring, solution: glideSolution(ring.length, from, this.last?.velocity ?? 0, target), startMs: nowMs, creepAt: Infinity };
    }
    const m = this.motion;
    const t = (nowMs - m.startMs) / 1000;
    if (t >= m.solution.durationSec) return rest();
    const velocity = velocityAt(m.solution, t);
    return { ring, position: positionAt(m.solution, t), velocity, phase: 'gliding', selectedId: null, blurPx: motionBlurPx(velocity) };
  }

  private spinFrame(order: readonly number[], landings: readonly PublicLanding[], spin: PublicSpin, nowMs: number, reduced: boolean): DrumFrame {
    const { ring, fromIndex } = spinStart(order, landings);
    const still: DrumFrame = { ring, position: fromIndex, velocity: 0, phase: 'spinning', selectedId: null, blurPx: DRUM.veilPx };
    if (!ring.length) return still;
    const key = `${spin.startAtMs}:${ring.length}`;
    if (this.motion?.key !== key) {
      if (reduced) {
        this.motion = null;
        return still;
      }
      // A Suspense (landAtMs null) coasts; a released one keeps its coast (same start). A Spin turns by the solver.
      if (spin.landAtMs === null) {
        this.motion = { kind: 'coast', key, ring, solution: coastSolution(ring.length, fromIndex, spin.startAtMs), startMs: spin.startAtMs, creepAt: Infinity };
      } else {
        const solution = this.solve({ cardCount: ring.length, fromIndex, durationSec: Math.max(0.5, (spin.landAtMs - spin.startAtMs) / 1000), spinSeed: spin.spinSeed ?? spin.startAtMs >>> 0 });
        if (!solution) {
          this.motion = null;
          return still;
        }
        this.motion = { kind: 'spin', key, ring, solution, startMs: spin.startAtMs, creepAt: creepStart(solution) };
      }
    }
    if (reduced) return still;
    const m = this.motion;
    const t = Math.max(0, (nowMs - m.startMs) / 1000);
    const { position, velocity } = m.kind === 'spin' ? standInMotion(m.solution, m.creepAt, t) : { position: positionAt(m.solution, t), velocity: velocityAt(m.solution, t) };
    const phase: DrumPhase = m.kind === 'spin' && t >= m.creepAt ? 'waiting' : 'spinning';
    return { ring, position, velocity, phase, selectedId: null, blurPx: Math.max(DRUM.veilPx, motionBlurPx(velocity)) };
  }

  /** The last frame's position in `ring`: the song under the window keeps its place (its fraction of a tile and its
   * whole turns too). */
  private positionIn(ring: readonly number[], frame: DrumFrame): number | null {
    const n = frame.ring.length;
    if (!n || !ring.length) return null;
    const whole = Math.round(frame.position);
    const id = frame.ring[mod(whole, n)];
    const index = id === undefined ? -1 : ring.indexOf(id);
    return index < 0 ? null : index + ring.length * Math.floor(whole / n) + (frame.position - whole);
  }
}
