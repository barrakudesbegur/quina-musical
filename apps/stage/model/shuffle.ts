// The Shuffle on the projector (ANIMATIONS.md `shuffle`): every cover appears in a grid, the grid jiggles,
// the covers fly into the drum one by one, and the drum settles. The order they fly in is a VISUAL order
// drawn from a random source the caller injects (a secure one in the page). It has nothing to do with the
// Queue, which the stage never knows. Everything is timed from the engine's `startAtMs`/`endAtMs`. Pure.

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** The steps of the Shuffle. `before`: scheduled, not started; `done`: over. */
export type ShufflePhase = 'before' | 'appear' | 'jiggle' | 'fly' | 'settle' | 'done';

export interface ShuffleSplit {
  appear: number;
  jiggle: number;
  fly: number;
  settle: number;
}

export interface ShuffleTimeline {
  startAtMs: number;
  jiggleAtMs: number;
  flyAtMs: number;
  settleAtMs: number;
  endAtMs: number;
}

/**
 * A random launch sequence for `count` tiles (Fisher–Yates): `sequence[k]` is the tile that flies k-th.
 * `random` returns [0, 1); the page passes a crypto-backed one.
 */
export function shuffleSequence(count: number, random: () => number): number[] {
  const seq = Array.from({ length: Math.max(0, count) }, (_, i) => i);
  for (let i = seq.length - 1; i > 0; i--) {
    const j = Math.min(i, Math.floor(random() * (i + 1)));
    [seq[i], seq[j]] = [seq[j], seq[i]];
  }
  return seq;
}

/** Columns and rows that give `count` square tiles the biggest size inside `width` × `height`. */
export function gridShape(count: number, width: number, height: number): { cols: number; rows: number; tile: number } {
  if (count <= 0 || width <= 0 || height <= 0) return { cols: 0, rows: 0, tile: 0 };
  let best = { cols: 1, rows: count, tile: Math.min(width, height / count) };
  for (let cols = 2; cols <= count; cols++) {
    const rows = Math.ceil(count / cols);
    const tile = Math.min(width / cols, height / rows);
    if (tile > best.tile) best = { cols, rows, tile };
  }
  return best;
}

export interface TileLayout {
  /** Top-left corner and size in the box (px). */
  x: number;
  y: number;
  size: number;
  /** The move that takes the tile's centre to the drum's centre. */
  dx: number;
  dy: number;
}

/** Tiles in a centred grid (in the given order of covers, for example by song id) and their flight to `target`. */
export function shuffleLayout(count: number, area: Rect, target: { x: number; y: number }, gapRatio = 0.1): TileLayout[] {
  const { cols, rows, tile } = gridShape(count, area.width, area.height);
  if (tile <= 0) return [];
  const size = tile * (1 - gapRatio);
  const x0 = area.x + (area.width - cols * tile) / 2;
  const y0 = area.y + (area.height - rows * tile) / 2;
  return Array.from({ length: count }, (_, i) => {
    const x = x0 + (i % cols) * tile + (tile - size) / 2;
    const y = y0 + Math.floor(i / cols) * tile + (tile - size) / 2;
    return { x, y, size, dx: target.x - (x + size / 2), dy: target.y - (y + size / 2) };
  });
}

/** The engine's Shuffle window split into its steps, in proportion to `split`. */
export function shuffleTimeline(startAtMs: number, endAtMs: number, split: ShuffleSplit): ShuffleTimeline {
  const span = Math.max(0, endAtMs - startAtMs);
  const total = split.appear + split.jiggle + split.fly + split.settle || 1;
  const at = (parts: number) => startAtMs + (span * parts) / total;
  return {
    startAtMs,
    jiggleAtMs: at(split.appear),
    flyAtMs: at(split.appear + split.jiggle),
    settleAtMs: at(split.appear + split.jiggle + split.fly),
    endAtMs: startAtMs + span,
  };
}

export function shufflePhaseAt(t: ShuffleTimeline, nowMs: number): ShufflePhase {
  if (nowMs < t.startAtMs) return 'before';
  if (nowMs < t.jiggleAtMs) return 'appear';
  if (nowMs < t.flyAtMs) return 'jiggle';
  if (nowMs < t.settleAtMs) return 'fly';
  if (nowMs < t.endAtMs) return 'settle';
  return 'done';
}

export interface Flight {
  startMs: number;
  durationMs: number;
}

/**
 * When each tile flies (indexed by tile): one after another in `sequence` order, staggered evenly so the last
 * one arrives as the fly step ends. A flight never runs longer than the fly step.
 */
export function coverFlights(t: ShuffleTimeline, sequence: readonly number[], perCoverMs: number): Flight[] {
  const window = Math.max(0, t.settleAtMs - t.flyAtMs);
  const durationMs = Math.min(perCoverMs, window);
  const n = sequence.length;
  const stagger = n > 1 ? (window - durationMs) / (n - 1) : 0;
  const flights: Flight[] = new Array<Flight>(n);
  sequence.forEach((tile, k) => {
    flights[tile] = { startMs: t.flyAtMs + k * stagger, durationMs };
  });
  return flights;
}
