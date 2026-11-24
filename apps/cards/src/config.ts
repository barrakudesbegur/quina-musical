// What changes on the printed cards from one year to the next, in one place.
//
// The QR on each card opens the player app at a year-tagged link, for example
// https://quina.barrakudesbegur.org/26/123. The edition tag separates this year's cards from last year's
// (`?c=123` links), and the player app keeps each player's cards per edition. Keep EDITION equal to the
// Game plan's `edition` (Admin).
//
// This year's title and paper colour aren't decided yet; the defaults are last year's.

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
 * The card types, the source of truth for every screen (the before-the-Game preview on the projector and on
 * phones, and Admin, which shows them read-only). `type` matches the cards' `type` in cards.json. Price in
 * cents, or null until it's decided. Generated next to cards.json as card-types.json.
 */
export const CARD_TYPES = [
  { type: 'normal', name: 'Cartró normal', color: '#cfe8ff', title: CARD_TITLE, priceCents: null },
  { type: 'especial', name: 'Cartró especial', color: '#ffd9e8', title: CARD_TITLE, priceCents: null },
] as const satisfies readonly { type: 'normal' | 'especial'; name: string; color: string; title: string; priceCents: number | null }[];
