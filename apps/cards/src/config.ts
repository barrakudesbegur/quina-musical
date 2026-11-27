// What changes on the printed cards from one year to the next, in one place.
//
// The QR on each card opens the player app at a year-tagged link, for example
// https://quina.barrakudesbegur.org/26/123. The edition tag separates this year's cards from last year's
// (`?c=123` links), and the player app keeps each player's cards per edition. Keep EDITION equal to the
// Game plan's `edition` (Admin).
//
// This year's values are provisional (the user, 25 Nov: D67, D68, D69) and may change at print time: the title
// "QUINA QUINA! 3" with last year's colours, last year's types and amounts (399 normal, 300 especial) and last year's
// prices (1.50 € a regular round for a normal card, 5 € for the especial card). Cards are sold only on the night and
// print in a few hours (D71); the print date is open (U28). The songs come from a repertoire (repertoire.ts), chosen on
// the command line; each side of a card is drawn from its own pool of it (sides.ts).
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
export const CARD_TITLE = 'QUINA QUINA! 3';

/** The page (paper) background colour. The QR keeps its own white background so it always scans. */
export const PAPER_COLOR = '#ffffff';

/** The faint year stamp printed on every card. */
export const VERSION_STAMP = `20${EDITION}`;

/**
 * The card types, written next to cards.json as card-types.json: the formal list of printed types, which every
 * screen reads (their names, colours and prices) and whose ids the Game plan's rounds name (each round plays one
 * type, picked in Admin). `type` is the id the cards carry in cards.json: lowercase letters and digits
 * (card-types.ts checks it). Price in cents, or null; prices aren't printed (docs/event.md). `priceRule` says how the
 * projector counts the price it shows before each round (U5): 'perRegularRound' is the price × the regular rounds still
 * to play (a normal card, 1.50 € a round in 2025), 'fixed' the price itself (the especial card).
 *
 * `sides` (D101, D102, D171, D193, D226): the normal card's side 1 plays Quines 1–5 from pool 1 and its side 2
 * Quines 6–10 from pool 2, under the same number and QR; the especial card's side 1 plays the Quina del Desgraciat
 * from pool 1 and its side 2 the Quina Especial from pool 2 (one card for both rounds, D81; the pool changes in the
 * Break). The labels are what the Check shows after `shortName`: a range joins with a space ("Normal 1–5", "Normal
 * 6–10", an en dash as on the design boards), a round's name with « · » ("Especial · Desgraciat", the round's short
 * name by D251; "Especial · Quina Especial": U198's option (a) until the user picks).
 */
export const CARD_TYPES = [
  {
    type: 'normal', name: 'Cartró normal', shortName: 'Normal', color: '#cfe8ff', title: CARD_TITLE, priceCents: 150, priceRule: 'perRegularRound',
    sides: [{ side: 1, pool: '1', label: '1–5' }, { side: 2, pool: '2', label: '6–10' }],
  },
  {
    type: 'especial', name: 'Cartró especial', shortName: 'Especial', color: '#ffd9e8', title: CARD_TITLE, priceCents: 500, priceRule: 'fixed',
    sides: [{ side: 1, pool: '1', label: 'Desgraciat' }, { side: 2, pool: '2', label: 'Quina Especial' }],
  },
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
