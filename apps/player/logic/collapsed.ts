// The collapsed cards (§8 Y2, option A; the user approved it for code on 28 Nov, boards Mobil-Plegats-A-*): with two or
// more cards that play the round, Cartrons shows each as a tile (its header and a 4 × 3 map of its marks) in two
// columns; a tap opens the full card over the home (CardTiles, CardPopover). The rules here are pure and tested
// (apps/show/tests/ui/player/collapsed.test.ts):
// - `showsTiles`: when the cards collapse (2+ playing cards; one card shows in full, as before).
// - `announceWinsOf`: the presenters' setting (`announceWins`, default on): the one place the view model reads it.
// - `bigCardOf`, `quinaUnclaimed`: when a tile shows «LÍNIA!» or «QUINA!» in its map's place, and keeps the Quina's
//   stripes on its header (ANIMATIONS.md `line-card`, `quina-card`).
// - `scribbleSlot`, `teachStep`, `peekTarget`: how the phone shows once that a tile opens (T3: `tile-peek`, then the
//   `tile-scribble` until a tile is tapped).
import type { CardMarks, PlayerCard } from '../../../packages/rules/marks.ts';
import type { PublicRound, PublicState, PublicWinner, RoundKind } from '../feed/public.ts';

/** The fewest cards playing the round that collapse into tiles. With one, the full card shows, as before. */
export const TILES_FROM = 2;

/**
 * Cartrons shows tiles: 2+ of the phone's cards play the round (the cards that don't play rest below, as headers).
 * Not in the Desgraciat round: its cards stand or sit (DEMPEUS / ASSEGUT, `card-fall`), drawn on the full card only;
 * A's boards have no tile for it, so it keeps today's full cards until the user decides (Frontend's open point).
 */
export function showsTiles(playing: number, kind: RoundKind | null): boolean {
  return playing >= TILES_FROM && kind !== 'desgraciat';
}

/**
 * The public state with the presenters' setting (the user, 28 Nov: announcing a Line or a Quina on the tiles is on by
 * default and the presenters can turn it off). Backend's protocol carries it as `PublicState.announceWins` (default
 * true); until that type is on main this optional field reads it, absent meaning on.
 */
export type AnnouncingState = PublicState & { announceWins?: boolean };

/** Whether the tiles announce a Line or a Quina: the one read of the setting (absent: on). */
export const announceWinsOf = (state: PublicState | null): boolean => (state as AnnouncingState | null)?.announceWins ?? true;

/** What a tile shows in its map's place: «LÍNIA!» or «QUINA!». */
export type BigCard = 'line' | 'quina';

/** What the big cards read of the round. */
export type WinRound = Pick<PublicRound, 'number' | 'kind' | 'lineConfirmed' | 'ended'>;

/** The round's Quina has been validated (a Bingo winner), whoever's card won it: the round's card states end. */
export const quinaValidated = (round: WinRound | null, winners: readonly PublicWinner[]): boolean =>
  Boolean(round && (round.ended || winners.some((w) => w.round === round.number && w.kind === 'bingo')));

const isFull = (marks: CardMarks): boolean => marks.marked.every((line) => line.every(Boolean));

/**
 * The big card a tile shows now (the user, 28 Nov), or null:
 * - «QUINA!» when the latest landing completed the whole card, until the next landing or the Quina's validation;
 * - «LÍNIA!» when the latest landing completed a line (a row: GLOSSARY) and no Line has been validated this round,
 *   until the next landing or that validation. After it, a Line is nothing special.
 * Never in the Desgraciat round, after the round, or with the setting off; the expanded card never shows it.
 */
export function bigCardOf(input: {
  card: PlayerCard | null;
  marks: CardMarks | null;
  round: WinRound | null;
  /** The latest counted landing's song, or null. */
  latest: number | null;
  winners: readonly PublicWinner[];
  announce: boolean;
}): BigCard | null {
  const { card, marks, round, latest, winners, announce } = input;
  if (!announce || !card || !marks || !round || latest === null || round.kind === 'desgraciat' || quinaValidated(round, winners)) return null;
  const completed = card.lines.flatMap((line, li) => (line.includes(latest) && marks.marked[li]?.every(Boolean) ? [li] : []));
  if (!completed.length) return null;
  if (isFull(marks)) return 'quina';
  return round.lineConfirmed ? null : 'line';
}

/**
 * A full card whose Quina isn't validated yet keeps its header's stripes, after the winning song has passed too (the
 * user's edit, 28 Nov: "if the user has bingo and didn't claim it, and a song passes, the card should still show the
 * animated header"). Part of the announcing: off with the setting.
 */
export function quinaUnclaimed(input: { marks: CardMarks | null; round: WinRound | null; winners: readonly PublicWinner[]; announce: boolean }): boolean {
  const { marks, round, winners, announce } = input;
  if (!announce || !marks || !round || round.kind === 'desgraciat' || quinaValidated(round, winners)) return false;
  return isFull(marks);
}

// ---- T3: showing once that a tile opens ---------------------------------------------------------------------------

/** Where the scribble sits (Mobil-Plegats-A-Toc v2, the user's edits of 28 Nov):
 * - `cell`: an odd number of tiles leaves the last cell of the grid empty: it fills it, pointing at the tile beside it;
 * - `under`: an even number with room under the grid on the screen: under it, pointing up at the last tile;
 * - `above`: more than 4 tiles (no room), or an even number without room under: above the first row, pointing down at
 *   the second tile. */
export type ScribbleSlot = 'cell' | 'under' | 'above';

/** The most tiles that leave room for the scribble beside or under them (two rows). */
export const SCRIBBLE_MAX_BESIDE = 4;

export function scribbleSlot(tiles: number, roomUnder: number, need: number): ScribbleSlot {
  if (tiles > SCRIBBLE_MAX_BESIDE) return 'above';
  if (tiles % 2 === 1) return 'cell';
  return roomUnder >= need ? 'under' : 'above';
}

/** How far this phone has been shown that a tile opens (kept on the phone, storage.ts `tilesTaught`): null, never;
 * `peeked`, the card opened by itself once; `tapped`, the player has opened a tile (nothing more to show). */
export type TilesTaught = 'peeked' | 'tapped';

export const isTilesTaught = (v: unknown): v is TilesTaught => v === 'peeked' || v === 'tapped';

/**
 * What to show now: `peek` (the card opens by itself, once: `tile-peek`), `scribble` (the note, until a tile is
 * tapped: `tile-scribble`), or nothing. The peek waits while the home is covered (a drawer, a Celebration, a Check);
 * with reduced motion there is no peek, the scribble shows at once.
 */
export function teachStep(input: { taught: TilesTaught | null; tiles: boolean; shown: boolean; busy: boolean; reduced: boolean }): 'peek' | 'scribble' | null {
  const { taught, tiles, shown, busy, reduced } = input;
  if (!tiles || taught === 'tapped') return null;
  if (taught === 'peeked' || reduced) return 'scribble';
  return shown && !busy ? 'peek' : null;
}

/** The card the peek opens: the one just added (ringed, D241) when it is a tile, else the first tile. */
export const peekTarget = (tileIds: readonly number[], highlight: number | null): number | null =>
  highlight !== null && tileIds.includes(highlight) ? highlight : (tileIds[0] ?? null);
