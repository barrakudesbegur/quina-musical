// «Afegeix cartrons venuts» (D234, part 1): the presenters add the cards sold on the night to the cards in play, a range
// («400-450») or single numbers («452, 460»), from the console's menu. The engine has one command for them,
// `setCardsInPlay { ranges }`, which replaces the whole list, so the console sends what it has now plus the typed ones.
// A number that isn't a printed card (when the catalogue is known) is refused: a sold card is always a printed one, and
// a slip like 4500 for 450 must never reach the Check. Pure.
import { COMMANDS, parseCardRanges } from '@quina/protocol';
import { formatCardRanges } from '../../../packages/ui/data/card-ranges.ts';

/** `setCardsInPlay.ranges`' longest text (the protocol's limit). */
export const CARDS_RANGES_MAX: number = COMMANDS.setCardsInPlay.ranges.maxLength;

export type CardsAddError =
  /** A piece that is neither a number nor a range ("12a", "1-"). */
  | { kind: 'token'; token: string }
  /** A range of too many numbers ("1-1000000"). */
  | { kind: 'tooLarge'; token: string }
  /** Numbers that aren't printed cards (or above `max` without the catalogue), as ranges. */
  | { kind: 'unknown'; ranges: string; count: number }
  /** Every typed card is in play already. */
  | { kind: 'already' }
  /** The cards in play would no longer fit in one command. */
  | { kind: 'tooLong' }
  /** The engine's list can't be read, so adding to it would lose cards. */
  | { kind: 'inPlay' };

export interface CardsAdd {
  /** Nothing typed yet: no preview, no error. */
  empty: boolean;
  error: CardsAddError | null;
  /** The new cards, sorted, and as ranges. */
  added: number[];
  addedRanges: string;
  /** Typed cards that were in play already. */
  already: number;
  /** What to send: the cards in play with the new ones, as ranges; null when it can't be sent. */
  ranges: string | null;
  /** Cards in play once added. */
  total: number;
}

export interface CardsAddRules {
  /** Whether a number is a printed card; null when the catalogue isn't loaded. */
  known: (id: number) => boolean | null;
  /** The highest card number (CONSOLE.cardMax), the limit while the catalogue is unknown. */
  max: number;
}

const nothing = { added: [], addedRanges: '', already: 0, ranges: null, total: 0 } as const;

/** What adding `typed` to `inPlay` (the state's `cards.inPlay`) would do. Never throws. */
export function cardsToAdd(inPlay: string, typed: string, rules: CardsAddRules): CardsAdd {
  if (!typed.trim()) return { empty: true, error: null, ...nothing, added: [] };
  let current: number[];
  try {
    current = parseCardRanges(inPlay);
  } catch {
    return { empty: false, error: { kind: 'inPlay' }, ...nothing, added: [] };
  }
  let ids: number[];
  try {
    ids = parseCardRanges(typed);
  } catch (e) {
    return { empty: false, error: typedError(e), ...nothing, added: [] };
  }
  const unknown = ids.filter((id) => id < 1 || (rules.known(id) ?? id <= rules.max) === false);
  if (unknown.length) return { empty: false, error: { kind: 'unknown', ranges: formatCardRanges(unknown), count: unknown.length }, ...nothing, added: [] };
  const have = new Set(current);
  const added = ids.filter((id) => !have.has(id));
  const already = ids.length - added.length;
  const addedRanges = formatCardRanges(added);
  if (!added.length) return { empty: false, error: { kind: 'already' }, added, addedRanges, already, ranges: null, total: current.length };
  const all = [...current, ...added].sort((a, b) => a - b);
  const ranges = formatCardRanges(all);
  if (ranges.length > CARDS_RANGES_MAX) return { empty: false, error: { kind: 'tooLong' }, added, addedRanges, already, ranges: null, total: all.length };
  return { empty: false, error: null, added, addedRanges, already, ranges, total: all.length };
}

/** Whether every card of `ids` is in `inPlay` now: the engine took an addition. */
export function allInPlay(inPlay: string, ids: readonly number[]): boolean {
  try {
    const have = new Set(parseCardRanges(inPlay));
    return ids.every((id) => have.has(id));
  } catch {
    return false;
  }
}

function typedError(e: unknown): CardsAddError {
  const message = e instanceof Error ? e.message : String(e);
  const token = /"(.*)"/.exec(message)?.[1] ?? '';
  return /too large/i.test(message) ? { kind: 'tooLarge', token } : { kind: 'token', token };
}
