// «Cartrons venuts» (D234, part 1): the presenters add the cards sold on the night to the cards in play, a range
// («400-450») or single numbers («452, 460»), from the console's menu. `addCardsInPlay { ranges }` carries only the typed
// cards and the engine merges them into its list, so two consoles adding at once keep both. Its answer goes to the
// console that sent it: the state's `cards.lastAdd` (by `reqId`) says which joined and which were in play already, and a
// number that isn't printed refuses the whole add (`invalid`, those numbers as ranges in its `detail`).
// Before sending, the preview says the same from what this console knows; a number that isn't a printed card (when the
// catalogue is known) is refused here already: a sold card is always a printed one, and a slip like 4500 for 450 must
// never reach the Check. Pure.
import { COMMANDS, formatCardRanges, parseCardRanges, type CardsInfo } from '@quina/protocol';

/** The longest ranges `addCardsInPlay` takes (the protocol's limit). */
export const CARDS_ADD_MAX: number = COMMANDS.addCardsInPlay.ranges.maxLength;
/** The longest list of cards in play: the engine refuses an add whose merged list would no longer fit in it. */
export const CARDS_IN_PLAY_MAX: number = COMMANDS.setCardsInPlay.ranges.maxLength;

export type CardsAddError =
  /** A piece that is neither a number nor a range ("12a", "1-"). */
  | { kind: 'token'; token: string }
  /** A range of too many numbers ("1-1000000"). */
  | { kind: 'tooLarge'; token: string }
  /** Numbers that aren't printed cards (or above `max` without the catalogue), as ranges: this console's check, or the
   * engine's refusal. */
  | { kind: 'unknown'; ranges: string; count: number }
  /** Every typed card is in play already. */
  | { kind: 'already' }
  /** The typed cards, or the cards in play with them, would no longer fit in one command. */
  | { kind: 'tooLong' }
  /** The engine refused it for a reason the console can't name. */
  | { kind: 'refused' };

export interface CardsAdd {
  /** Nothing typed yet: no preview, no error. */
  empty: boolean;
  error: CardsAddError | null;
  /** The cards that would join, sorted, and as ranges. */
  added: number[];
  addedRanges: string;
  /** Typed cards that are in play already. */
  already: number;
  /** What to send: every typed card, as ranges (the engine merges them and says which were in); null when it can't be
   * sent. */
  ranges: string | null;
}

export interface CardsAddRules {
  /** Whether a number is a printed card; null when the catalogue isn't loaded. */
  known: (id: number) => boolean | null;
  /** The highest card number (CONSOLE.cardMax), the limit while the catalogue is unknown. */
  max: number;
}

const nothing = { added: [], addedRanges: '', already: 0, ranges: null } as const;

/** What adding `typed` to `inPlay` (the state's `cards.inPlay`) would do. Never throws. */
export function cardsToAdd(inPlay: string, typed: string, rules: CardsAddRules): CardsAdd {
  if (!typed.trim()) return { empty: true, error: null, ...nothing, added: [] };
  let ids: number[];
  try {
    ids = parseCardRanges(typed);
  } catch (e) {
    return { empty: false, error: typedError(e), ...nothing, added: [] };
  }
  const unknown = ids.filter((id) => id < 1 || (rules.known(id) ?? id <= rules.max) === false);
  if (unknown.length) return { empty: false, error: { kind: 'unknown', ranges: formatCardRanges(unknown), count: unknown.length }, ...nothing, added: [] };
  // The engine merges into its own list, so one this console can't read only loses the preview's "already in".
  const current = readable(inPlay);
  const have = new Set(current);
  const added = ids.filter((id) => !have.has(id));
  const already = ids.length - added.length;
  const addedRanges = formatCardRanges(added);
  if (!added.length) return { empty: false, error: { kind: 'already' }, added, addedRanges, already, ranges: null };
  const ranges = formatCardRanges(ids);
  const merged = formatCardRanges([...current, ...added].sort((a, b) => a - b));
  if (ranges.length > CARDS_ADD_MAX || merged.length > CARDS_IN_PLAY_MAX) return { empty: false, error: { kind: 'tooLong' }, added, addedRanges, already, ranges: null };
  return { empty: false, error: null, added, addedRanges, already, ranges };
}

/** The engine's answer to this console's add: what joined and what was in already, or why it was refused. */
export type CardsAddOutcome =
  | { kind: 'added'; added: string; addedCount: number; alreadyIn: string; alreadyCount: number }
  | { kind: 'refused'; error: CardsAddError };

/** The state's `cards.lastAdd` when it answers the add sent as `reqId`, else null. */
export function addAnswer(lastAdd: CardsInfo['lastAdd'], reqId: string | null): Extract<CardsAddOutcome, { kind: 'added' }> | null {
  if (!lastAdd || !reqId || lastAdd.reqId !== reqId) return null;
  return { kind: 'added', added: lastAdd.added, addedCount: countOf(lastAdd.added), alreadyIn: lastAdd.alreadyIn, alreadyCount: countOf(lastAdd.alreadyIn) };
}

/**
 * Why the engine refused an add as `invalid`, from its `detail`: the numbers that aren't printed, as ranges (the usual
 * one), or the cards in play that would no longer fit.
 */
export function refusalError(detail: string | null | undefined): CardsAddError {
  const ids = readable(detail ?? '');
  if (ids.length) return { kind: 'unknown', ranges: formatCardRanges(ids), count: ids.length };
  if (/no longer fit/i.test(detail ?? '')) return { kind: 'tooLong' };
  return { kind: 'refused' };
}

/** Card numbers from ranges, or none when they can't be read. */
function readable(ranges: string): number[] {
  try {
    return parseCardRanges(ranges);
  } catch {
    return [];
  }
}

const countOf = (ranges: string): number => readable(ranges).length;

function typedError(e: unknown): CardsAddError {
  const message = e instanceof Error ? e.message : String(e);
  const token = /"(.*)"/.exec(message)?.[1] ?? '';
  return /too large/i.test(message) ? { kind: 'tooLarge', token } : { kind: 'token', token };
}
