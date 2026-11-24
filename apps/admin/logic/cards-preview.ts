// Cards in play, as Admin previews them before sending `setCardsInPlay`: how many cards the ranges name, how
// many of each printed type, which numbers are not among the generated cards, and the compact ranges that will
// be sent. Pure: the generated cards' types come in as a map (from cards.json).
import { COMMANDS } from '@quina/protocol';
// parseCardRanges is still the engine's: it belongs in @quina/protocol, so Admin needn't reach into the engine.
import { parseCardRanges } from '../../show/engine/src/game/cards.ts';

/** `setCardsInPlay.ranges` may not be longer than this (the protocol's limit). */
export const RANGES_MAX_LENGTH: number = COMMANDS.setCardsInPlay.ranges.maxLength;

/** Card id → its printed type's id ('normal', 'especial'…), from cards.json. */
export type CardTypes = ReadonlyMap<number, string>;

export type RangesError =
  /** A piece that is neither a number nor a range ("12a", "1-"). */
  | { kind: 'token'; token: string }
  /** A range that names too many cards. */
  | { kind: 'tooLarge'; token: string }
  /** The normalised ranges are longer than the protocol allows. */
  | { kind: 'tooLong'; length: number }
  /** Anything else parseCardRanges reported. */
  | { kind: 'other'; message: string };

export interface CardsPreview {
  /** False when the text can't be sent as it is. */
  ok: boolean;
  error: RangesError | null;
  ids: number[];
  count: number;
  /** The compact, sorted ranges that will be sent ("1-180, 200-215, 400"). */
  ranges: string;
  /** null when the generated cards are unknown (cards.json didn't load). */
  types: {
    /** How many cards of each printed type, in the order the lowest numbered card of each comes. */
    byType: { type: string; count: number }[];
    /** Numbers that aren't generated cards, as compact ranges (invalid if claimed). */
    unknownRanges: string;
    unknownCount: number;
  } | null;
}

/** [1, 2, 3, 7, 9, 10] → "1-3, 7, 9-10". Expects sorted unique ids (parseCardRanges gives those). */
export function formatRanges(ids: readonly number[]): string {
  const parts: string[] = [];
  let i = 0;
  while (i < ids.length) {
    let j = i;
    while (j + 1 < ids.length && ids[j + 1] === ids[j] + 1) j++;
    parts.push(i === j ? String(ids[i]) : `${ids[i]}-${ids[j]}`);
    i = j + 1;
  }
  return parts.join(', ');
}

/** parseCardRanges' thrown message, as a typed error (it quotes the bad piece). */
function rangesError(e: unknown): RangesError {
  const message = e instanceof Error ? e.message : String(e);
  const token = /"(.*)"/.exec(message)?.[1];
  if (token !== undefined && /too large/i.test(message)) return { kind: 'tooLarge', token };
  if (token !== undefined) return { kind: 'token', token };
  return { kind: 'other', message };
}

/** Preview cards in play as typed. Never throws. */
export function previewCardRanges(text: string, cardTypes: CardTypes | null): CardsPreview {
  let ids: number[];
  try {
    ids = parseCardRanges(text);
  } catch (e) {
    return { ok: false, error: rangesError(e), ids: [], count: 0, ranges: '', types: null };
  }
  const ranges = formatRanges(ids);
  const tooLong = ranges.length > RANGES_MAX_LENGTH;
  let types: CardsPreview['types'] = null;
  if (cardTypes) {
    const counts = new Map<string, number>();
    const unknown: number[] = [];
    for (const id of ids) {
      const type = cardTypes.get(id);
      if (type === undefined) unknown.push(id);
      else counts.set(type, (counts.get(type) ?? 0) + 1);
    }
    types = { byType: [...counts].map(([type, count]) => ({ type, count })), unknownRanges: formatRanges(unknown), unknownCount: unknown.length };
  }
  return {
    ok: !tooLong,
    error: tooLong ? { kind: 'tooLong', length: ranges.length } : null,
    ids,
    count: ids.length,
    ranges,
    types,
  };
}

/** Whether two range texts name the same cards ("1-3" and "3, 1, 2" do). Junk never matches. */
export function sameCards(a: string, b: string): boolean {
  try {
    const x = parseCardRanges(a);
    const y = parseCardRanges(b);
    return x.length === y.length && x.every((id, i) => id === y[i]);
  } catch {
    return false;
  }
}
