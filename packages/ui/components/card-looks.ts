// D2 · CardGrid's looks table (components-v2.md § 5 and § 11.5; the user's comments #70, #74–#78, comments-27nov.md
// D-q): the one place that says which state of a card's song looks like what, on the phone, the console and the
// projector. A state names the game on purpose (CardGrid is a recipe); the look it maps to is CardCell's generic
// props (card-cell.ts), palette names only. Pure: no DOM, no CSS.
import type { CellLook } from './card-cell.ts';

/**
 * A song's state on a card.
 * - The phone: `empty`, `marked` (it landed: the card's mark, the cover and title a little faded, #70), `crossed` (the
 *   Desgraciat round: the landing that sank the card). (No `near` any more: 27 Nov, §8 Y1.)
 * - The Check (console and projector): `idle` (a Line's other rows), `pending` (no hint: still to reveal, as the room
 *   sees it), `upcomingOk` / `upcomingFail` (the console only: still to reveal, its private mark known, D108),
 *   `playing` (its snippet plays now), `landed` ✓, `missed` ✗, `skipped` (after the reveals stop).
 */
export type CellState =
  | 'empty'
  | 'marked'
  | 'crossed'
  | 'idle'
  | 'pending'
  | 'upcomingOk'
  | 'upcomingFail'
  | 'playing'
  | 'landed'
  | 'missed'
  | 'skipped';

export const CELL_LOOKS = {
  empty: {},
  marked: { cover: 'played' },
  crossed: { cover: 'played' },
  // The surface fades the whole cell or row that doesn't count (the console's cell, the projector's row): nothing more.
  idle: {},
  pending: {},
  // #78: quick to spot, clearly not played, the cover still recognisable: desaturated and dimmed, a dashed grey
  // ring, the private mark dashed in the centre.
  upcomingOk: { cover: 'upcoming', ring: 'grey', ringStyle: 'dashed', badge: 'check', badgeColor: 'green', badgeStyle: 'dashed' },
  upcomingFail: { cover: 'upcoming', ring: 'grey', ringStyle: 'dashed', badge: 'close', badgeColor: 'red', badgeStyle: 'dashed' },
  // #74, #76: the dashed orange ring runs round it; a centred disc with a play icon.
  playing: { ring: 'orange', ringStyle: 'running', badge: 'play', badgeColor: 'orange' },
  landed: { ring: 'green', badge: 'check', badgeColor: 'green' },
  missed: { cover: 'grey', ring: 'red', badge: 'close', badgeColor: 'red' },
  skipped: { cover: 'faded' },
} as const satisfies Record<CellState, CellLook>;

/** What changes on top of a state while the cell's song is playing on the phone (27 Nov, §8 Y1: very clearly): the
 * running ring as in the design system, slightly see-through, with its orange glow, and the cover at full strength
 * (it's the song of the moment). The card's mark keeps the centre, so there is no play badge. */
const PLAYING_ON_CARD: CellLook = { cover: 'plain', ring: 'orange', ringStyle: 'running', glow: true, ringTranslucent: true };

/** The next cell to reveal on the console: the orange ring and its glow, the «SEGÜENT» tag. */
const NEXT: CellLook = { ring: 'orange', ringStyle: 'solid', glow: true, tagColor: 'orange' };

export interface CellExtras {
  /** The phone: this cell's song is the one playing now (the latest landing). */
  playing?: boolean;
  /** The console: presses until its reveal (1 = next); null when not upcoming. */
  ahead?: number | null;
  /** The tag's words for the next one («Següent»); later ones read «+N». */
  nextTag?: string;
}

/** A cell's look from its state, plus the phone's playing song and the console's count to the reveal (#78). */
export function cellLook(state: CellState, extras: CellExtras = {}): CellLook {
  const base: CellLook = CELL_LOOKS[state];
  if (extras.playing && (state === 'marked' || state === 'crossed')) return { ...base, ...PLAYING_ON_CARD };
  const ahead = extras.ahead ?? null;
  if ((state === 'upcomingOk' || state === 'upcomingFail' || state === 'pending') && ahead !== null) {
    if (ahead === 1) return { ...base, ...NEXT, cover: 'plain', tag: extras.nextTag ?? null };
    return { ...base, tag: `+${ahead}`, tagColor: 'grey' };
  }
  return base;
}
