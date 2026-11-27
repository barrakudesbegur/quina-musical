// What changes on the printed cards from one year to the next, in one place.
//
// The QR on each card opens the player app at a year-tagged link, for example
// https://quina.barrakudesbegur.org/26/123. The edition tag separates this year's cards from last year's
// (`?c=123` links), and the player app keeps each player's cards per edition. Keep EDITION equal to the
// Game plan's `edition` (Admin).
//
// 2026 (the user, 25–27 Nov): the title «QUINA QUINA!» (D254), last year's types and amounts (399 normal, 300 especial:
// a card's first digit tells its type, D264) and prices (1.50 € a regular round for a normal card, 5 € for the especial
// card), printed in colour on last year's coloured paper (blue normal, pink especial, D267), duplex. Cards are sold only
// on the night and print in a few hours (D71). The songs come from a repertoire (repertoire.ts), chosen on the command
// line; each side of a card is drawn from its own pool of it (sides.ts).
import type { PrintedCardTypeSpec } from './card-types';
import type { CardLayoutId } from './print/layouts';

/**
 * The printed layout (D262, U212): the organizers choose between
 * - `'a3-6'`, option A: A3 portrait, 6 cards a sheet (148.5 × 140 mm), each song's cover in colour above its title;
 * - `'a4-3'`, option B: A4 portrait, 3 cards a sheet (210 × 99 mm), no covers, black and white.
 * A until they pick (the user: "assume we do a. and you can code both so i decide the final later"); then the other
 * one is deleted from print/layouts.ts. `--layout <id>` on the command line proofs the other one without changing this.
 */
export const CARD_LAYOUT: CardLayoutId = 'a3-6';

/** The year tag, two digits, as in the cards' links and the Game plan. */
export const EDITION = '26';

/** The player app's public address. */
export const SITE_URL = 'https://quina.barrakudesbegur.org';

/** The link a card's QR encodes: `${SITE_URL}/${edition}/${cardId}`. */
export function cardUrl(cardId: number, edition: string = EDITION): string {
  return new URL(`/${encodeURIComponent(edition)}/${cardId}`, SITE_URL).toString();
}

/** The game's title (D254, no «3»): the branding's first line on layout B, and card-types.json's `title`. */
export const CARD_TITLE = 'QUINA QUINA!';

/** The branding's second line, under the title (layout B). */
export const BRAND_SUBTITLE = `BARRAKUDES · 20${EDITION}`;

/** The page background colour: white, as the cards print on coloured paper (D267). The QR keeps its own white
 * background so it always scans. */
export const PAPER_COLOR = '#ffffff';

/** The year printed faint above the logo stamp on every card, as on last year's card (D263). */
export const VERSION_STAMP = `20${EDITION}`;

/** The word across a sample (D264): a copy of a type's last card on a sheet's spare place, never a card itself. */
export const SAMPLE_WORD = 'MOSTRA';

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
 * Break). Each side has
 * - `heading`: printed big at the top of the side (D252); side 2's is white on a black box;
 * - `checkLabel`: the side's whole label on the screens during the Check (U198 answered (a), D266), as printed:
 *   «Normal 1–5», «Normal 6–10», «Desgraciat», «Especial»;
 * - `label`: the older label the screens join after `shortName` ("Normal 1–5", "Especial · Desgraciat"), kept until
 *   every screen reads `checkLabel`.
 */
export const CARD_TYPES = [
  {
    type: 'normal', name: 'Cartró normal', shortName: 'Normal', color: '#cfe8ff', title: CARD_TITLE, priceCents: 150, priceRule: 'perRegularRound',
    sides: [
      { side: 1, pool: '1', label: '1–5', checkLabel: 'Normal 1–5', heading: 'QUINES 1–5' },
      { side: 2, pool: '2', label: '6–10', checkLabel: 'Normal 6–10', heading: 'QUINES 6–10' },
    ],
  },
  {
    type: 'especial', name: 'Cartró especial', shortName: 'Especial', color: '#ffd9e8', title: CARD_TITLE, priceCents: 500, priceRule: 'fixed',
    sides: [
      { side: 1, pool: '1', label: 'Desgraciat', checkLabel: 'Desgraciat', heading: 'DESGRACIAT' },
      { side: 2, pool: '2', label: 'Quina Especial', checkLabel: 'Especial', heading: 'ESPECIAL' },
    ],
  },
] as const satisfies readonly PrintedCardTypeSpec[];

/** A printed type's id, one of CARD_TYPES. */
export type CardTypeId = (typeof CARD_TYPES)[number]['type'];

/** How many cards of each type to print, numbered in this order from 1 (normal 1–399, then especial 400–699, so a
 * card's first digit tells its type, D264). Any amount: the places it leaves empty on a type's last sheets print
 * «MOSTRA» samples (print/sheets.ts), which aren't cards. */
export const CARD_AMOUNTS = [
  { type: 'normal', amount: 399 },
  { type: 'especial', amount: 300 },
] as const satisfies readonly { type: CardTypeId; amount: number }[];

/** The shuffle's seed: the same seed and pool always give the same cards, so a reprint matches. Change it to
 * draw a different set. */
export const SEED = 'barrakudes-cigronet';
