// Each printed side of a card is drawn from its own pool (D101, D102, D178): a repertoire's songs carry `pool` ("1",
// "2"; a song without one is in pool 1), and the card types say which pool each of their sides is printed from (the
// normal card's side 1 from pool 1, its side 2 from pool 2, D171). Pure and self-contained (type imports only), so
// the tests run it as it is.
import type { CardTypeSideSpec } from './card-types';
import type { DrawnByPool } from './uniqueness';

/** The pool of a song that names none: a copy of the protocol's `DEFAULT_POOL` (this package builds on its own). */
export const DEFAULT_POOL = '1';

/** A song as far as pools go. */
export interface PooledSong {
  id: number;
  pool?: string;
}

export const songPool = (song: PooledSong): string => song.pool ?? DEFAULT_POOL;

/** What one side is drawn from: its pool's songs, or the whole repertoire when the pool has none. */
export interface SideSource<S> {
  side: number;
  pool: string;
  songs: readonly S[];
  /** The pool has no songs (a repertoire not split into pools yet), so the side is drawn from the whole repertoire,
   * as the engine plays a round on an empty pool. Always reported (sourceWarnings), never silent. */
  wholeRepertoire: boolean;
}

/** Each side of a type with the songs it is drawn from. */
export function sideSources<S extends PooledSong>(sides: readonly CardTypeSideSpec[], songs: readonly S[]): SideSource<S>[] {
  return sides.map(({ side, pool }) => {
    const own = songs.filter((s) => songPool(s) === pool);
    return { side, pool, songs: own.length ? own : songs, wholeRepertoire: !own.length };
  });
}

/** The warning for every side drawn from the whole repertoire. */
export function sourceWarnings(type: string, sources: readonly SideSource<unknown>[]): string[] {
  return sources
    .filter((s) => s.wholeRepertoire)
    .map((s) => `card type "${type}", side ${s.side}: pool ${s.pool} has no songs, so this side is drawn from the whole repertoire (${s.songs.length} songs)`);
}

/**
 * Every problem with the songs' pools for these card types (empty when they're fine): a `pool` that isn't a string, a
 * pool no side is printed from (a typo, since its songs would be on no card), and a pool too small for a side. A pool
 * with no songs at all isn't a problem: sideSources draws it from the whole repertoire, with a warning.
 */
export function poolProblems(json: unknown, types: readonly { type: string; sides: readonly CardTypeSideSpec[] }[], songsPerSide: number): string[] {
  if (!Array.isArray(json)) return [];
  const printed = new Set(types.flatMap((t) => t.sides.map((s) => s.pool)));
  const counts = new Map<string, number>();
  const problems: string[] = [];
  json.forEach((raw, i) => {
    if (!raw || typeof raw !== 'object') return;
    const pool = (raw as { pool?: unknown }).pool ?? DEFAULT_POOL;
    if (typeof pool !== 'string') return problems.push(`song ${i + 1}: the pool must be text ("1", "2")`);
    if (!printed.has(pool)) problems.push(`song ${i + 1}: pool "${pool}" is not one any card side is printed from (${[...printed].join(', ')})`);
    counts.set(pool, (counts.get(pool) ?? 0) + 1);
  });
  for (const t of types)
    for (const s of t.sides) {
      const n = counts.get(s.pool) ?? 0;
      if (n > 0 && n < songsPerSide) problems.push(`card type "${t.type}", side ${s.side}: pool ${s.pool} has ${n} songs; a side needs ${songsPerSide}`);
    }
  return problems;
}

/** The seed of a side's draw. Side 1 keeps the seed cards had before sides (`<seed>-<id>-bingo-<attempt>`), so the
 * same repertoire and seed still give the same side 1. */
export const sideSeed = (seed: string, cardId: number, side: number, attempt: number): string =>
  side === 1 ? `${seed}-${cardId}-bingo-${attempt}` : `${seed}-${cardId}-side${side}-${attempt}`;

/** A drawn card: its number, its type, and its sides in order. */
export interface DrawnCard<L> {
  id: number;
  type: string;
  sides: { side: number; lines: L[][] }[];
}

/**
 * Card `id` with every side of its type: each side's lines from its source's songs (`makeLines`: 3 lines of 4 from a
 * seeded draw), drawn again (the next seed) until it repeats no card or line drawn so far from the same pool. Throws
 * when a side can't be drawn (the pool is too small for that many cards).
 */
export function drawCard<S, L extends { id: number }>(
  id: number,
  type: string,
  sources: readonly SideSource<S>[],
  makeLines: (songs: readonly S[], seed: string) => L[][],
  seed: string,
  drawn: DrawnByPool,
): DrawnCard<L> {
  return {
    id,
    type,
    sides: sources.map(({ side, pool, songs }) => {
      try {
        return { side, lines: drawn.draw(pool, (attempt) => ({ id, lines: makeLines(songs, sideSeed(seed, id, side, attempt)) })).lines };
      } catch (error) {
        throw new Error(`side ${side} (pool ${pool}): ${error instanceof Error ? error.message : String(error)}`);
      }
    }),
  };
}

/** Each pool's printed sides, as cards of their own (by card number), for the final uniqueness check. A side the
 * types don't list is left out (unlistedCardTypes reports its card). */
export function sidesByPool<L extends { id: number }>(
  cards: readonly DrawnCard<L>[],
  types: readonly { type: string; sides: readonly CardTypeSideSpec[] }[],
): Map<string, { id: number; lines: L[][] }[]> {
  const out = new Map<string, { id: number; lines: L[][] }[]>();
  for (const card of cards) {
    const sides = types.find((t) => t.type === card.type)?.sides ?? [];
    for (const { side, lines } of card.sides) {
      const pool = sides.find((s) => s.side === side)?.pool;
      if (pool === undefined) continue;
      const faces = out.get(pool) ?? [];
      faces.push({ id: card.id, lines });
      out.set(pool, faces);
    }
  }
  return out;
}
