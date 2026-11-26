// "Afegir cartró"'s smart keypad (boards "App · calaix per afegir un cartró" and "afegir cartró: casos especials"):
// what typing a key does, which keys can still lead to a printed card's number, when "Desar" saves, when the number
// is already one of the player's cards, and when leaving asks first. Pure.
import { PLAYER_CONFIG } from '../config.ts';

export const DIGITS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'] as const;
export type Digit = (typeof DIGITS)[number];

/** The longest number a card can have (cardIdMax's digits). */
const MAX_DIGITS = String(PLAYER_CONFIG.cardIdMax).length;

/** A number typed on the pad: digits only, no leading zero, at most as many digits as the highest card number. */
export function padValue(current: string, key: string): string {
  if (key === 'back') return current.slice(0, -1);
  if (key === 'clear') return '';
  if (!/^\d$/.test(key)) return current;
  const next = (current + key).replace(/^0+/, '');
  return next.length > MAX_DIGITS ? current : next;
}

/** Leaving "Afegir cartró" (close, back, a drag) asks first when a number has been typed; with nothing typed it just closes. */
export const leaveNeedsConfirm = (typed: string): boolean => typed.length > 0;

/** The printed cards' numbers, and every start of one ("4", "41", "412"), so each key is one lookup. */
export interface PadCatalog {
  ids: ReadonlySet<number>;
  starts: ReadonlySet<string>;
}

export function padCatalog(ids: Iterable<number>): PadCatalog {
  const all = new Set<number>();
  const starts = new Set<string>();
  for (const id of ids) {
    all.add(id);
    const s = String(id);
    for (let i = 1; i <= s.length; i++) starts.add(s.slice(0, i));
  }
  return { ids: all, starts };
}

export interface PadRules {
  /** The digit keys that can still lead to a card number (the others take the dashed, disabled look). */
  digits: ReadonlySet<Digit>;
  /** Something is typed, so the delete key works. */
  canDelete: boolean;
  /** "Desar" lights up: the number is a printed card that isn't one of the player's cards yet. */
  canSave: boolean;
  /** The number typed is already one of the player's cards (the "Ja el tens" note). */
  owned: number | null;
}

const inRange = (n: number): boolean => Number.isInteger(n) && n >= PLAYER_CONFIG.cardIdMin && n <= PLAYER_CONFIG.cardIdMax;

/**
 * The keypad for what is typed. With the catalogue, a digit works only if the number it makes is the start of a
 * printed card's number; before the catalogue has loaded, any digit that keeps the number a possible card number
 * (no leading zero, not too long) works, and "Desar" trusts the number. A number the player already has never
 * saves, but its digits keep working, so a longer number that starts with it can still be typed (owning #1 must not
 * block #12).
 */
export function padRules(typed: string, ownIds: readonly number[], catalog: PadCatalog | null): PadRules {
  const digits = new Set<Digit>();
  for (const d of DIGITS) {
    const next = padValue(typed, d);
    if (next === typed) continue;
    if (catalog ? catalog.starts.has(next) : inRange(Number(next))) digits.add(d);
  }
  const n = typed ? Number(typed) : null;
  const owned = n !== null && ownIds.includes(n) ? n : null;
  const real = n !== null && (catalog ? catalog.ids.has(n) : inRange(n));
  return { digits, canDelete: typed !== '', canSave: real && owned === null, owned };
}
