// What changes on the printed cards from one year to the next, in one place.
//
// The QR on each card opens the player app at a year-tagged link, for example
// https://quina.barrakudesbegur.org/26/123. The edition tag separates this year's cards from last year's
// (`?c=123` links), and the player app keeps each player's cards per edition. Keep EDITION equal to the
// Game plan's `edition` (Admin).
//
// This year's title, paper colour, card types, prices and amounts aren't decided yet: the defaults are last
// year's. The songs come from a pool (pool.ts), chosen on the command line.
import type { CardTypeSpec } from './card-types';

/** The year tag, two digits, as in the cards' links and the Game plan. */
export const EDITION = '26';

/** The player app's public address. */
export const SITE_URL = 'https://quina.barrakudesbegur.org';

/** The link a card's QR encodes: `${SITE_URL}/${edition}/${cardId}`. */
export function cardUrl(cardId: number, edition: string = EDITION): string {
  return new URL(`/${encodeURIComponent(edition)}/${cardId}`, SITE_URL).toString();
}

/** The big title at the top of every card. */
export const CARD_TITLE = 'QUINA QUINA!';

/** The page (paper) background colour. The QR keeps its own white background so it always scans. */
export const PAPER_COLOR = '#ffffff';

/** The faint year stamp printed on every card. */
export const VERSION_STAMP = `20${EDITION}`;

/**
 * The card types, written next to cards.json as card-types.json: the formal list of printed types, which every
 * screen reads (their names, colours and prices) and whose ids the Game plan's rounds name (each round plays one
 * type, picked in Admin). `type` is the id the cards carry in cards.json: lowercase letters and digits
 * (card-types.ts checks it). Price in cents, or null until it's decided.
 */
export const CARD_TYPES = [
  { type: 'normal', name: 'Cartró normal', color: '#cfe8ff', title: CARD_TITLE, priceCents: null },
  { type: 'especial', name: 'Cartró especial', color: '#ffd9e8', title: CARD_TITLE, priceCents: null },
] as const satisfies readonly CardTypeSpec[];

/** A printed type's id, one of CARD_TYPES. */
export type CardTypeId = (typeof CARD_TYPES)[number]['type'];

/** How many cards of each type to print, numbered in this order from 1 (normal 1–399, then especial 400–699).
 * Each amount must be a multiple of 3: the PDF prints 3 cards a page. */
export const CARD_AMOUNTS = [
  { type: 'normal', amount: 399 },
  { type: 'especial', amount: 300 },
] as const satisfies readonly { type: CardTypeId; amount: number }[];

/** The shuffle's seed: the same seed and pool always give the same cards, so a reprint matches. Change it to
 * draw a different set. */
export const SEED = 'barrakudes-cigronet';
