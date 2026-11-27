// Each printed side of a card is drawn from its own pool (D101, D102, D178): the card types say which pool each of their
// sides is printed from (the normal card's side 1 from pool 1, its side 2 from pool 2, D171), and a repertoire's songs
// say which pools they are in. Since D268 a song may be in several pools under one id: `pools: ["1", "2"]`. Before it,
// a song had one, `pool: "1"`, and none was pool 1; during the change a song may carry both, and `pools` wins. So a
// side 1 and a side 2 may share a song; within one pool, no card or line repeats (uniqueness.ts). Pure and
// self-contained (type imports only), so the tests run it as it is.
import type { CardTypeSideSpec } from './card-types';
import type { DrawnByPool } from './uniqueness';

/** The pool of a song that names none: a copy of the protocol's `DEFAULT_POOL` (this package builds on its own). */
export const DEFAULT_POOL = '1';

/** A song as far as pools go. */
export interface PooledSong {
  id: number;
  /** The pools it is in (D268). */
  pools?: readonly string[];
  /** Its one pool, from before D268; read only when `pools` is absent. */
  pool?: string;
}

/** The pools a song is in: `pools ?? [pool ?? "1"]`. */
export const songPools = (song: PooledSong): readonly string[] => song.pools ?? [song.pool ?? DEFAULT_POOL];

/** Whether a song is in a pool. */
export const inPool = (song: PooledSong, pool: string): boolean => songPools(song).includes(pool);

/** Each pool's number of songs, in pool order (a song in two pools counts in both). */
export function poolCounts(songs: readonly PooledSong[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const song of songs) for (const pool of songPools(song)) counts.set(pool, (counts.get(pool) ?? 0) + 1);
  return new Map([...counts].sort(([a], [b]) => a.localeCompare(b, 'en', { numeric: true })));
}

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
    const own = songs.filter((s) => inPool(s, pool));
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
 * Every problem with the songs' pools for these card types (empty when they're fine): a `pool` that isn't a string,
 * `pools` that isn't a list of distinct pool ids, a `pool` its `pools` leaves out, a pool no side is printed from (a
 * typo, since its songs would be on no card), and a pool too small for a side. A pool with no songs at all isn't a
 * problem: sideSources draws it from the whole repertoire, with a warning.
 */
export function poolProblems(json: unknown, types: readonly { type: string; sides: readonly CardTypeSideSpec[] }[], songsPerSide: number): string[] {
  if (!Array.isArray(json)) return [];
  const printed = new Set(types.flatMap((t) => t.sides.map((s) => s.pool)));
  const counts = new Map<string, number>();
  const problems: string[] = [];
  json.forEach((raw, i) => {
    if (!raw || typeof raw !== 'object') return;
    const where = `song ${i + 1}`;
    const { pool, pools } = raw as { pool?: unknown; pools?: unknown };
    if (pool !== undefined && typeof pool !== 'string') return problems.push(`${where}: the pool must be text ("1", "2")`);
    if (pools !== undefined) {
      if (!Array.isArray(pools) || !pools.length || pools.some((p) => typeof p !== 'string')) return problems.push(`${where}: the pools must be a list of pool ids (["1", "2"])`);
      if (new Set(pools).size !== pools.length) problems.push(`${where}: a pool is listed twice in its pools (${pools.join(', ')})`);
      if (pool !== undefined && !pools.includes(pool)) problems.push(`${where}: its pool "${pool}" is not in its pools (${pools.join(', ')})`);
    }
    for (const p of new Set(songPools({ id: 0, pool: pool as string | undefined, pools: pools as string[] | undefined }))) {
      if (!printed.has(p)) problems.push(`${where}: pool "${p}" is not one any card side is printed from (${[...printed].join(', ')})`);
      counts.set(p, (counts.get(p) ?? 0) + 1);
    }
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
