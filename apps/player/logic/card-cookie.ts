// A copy of the player's card list in a first-party cookie, so an app added to an iPhone's Home Screen keeps the
// cards (D221; docs/research/reports/ios-install-and-app-clip.md): a Home Screen app starts with its own empty
// storage, and iOS copies only the browser's cookies into it, once, when it's added. The app restores the cards
// from this copy when its localStorage holds nothing (PlayerStorage.load), so the icon opens on the player's cards.
//
// It holds only what a card list needs: each card's number, icon and name, for this edition. Its path is the app's
// home (`/26/`, where every player page settles: logic/router.ts settledHref) and it's SameSite=Strict, so it rides
// only on the player's own page loads, never on /api/ or /feed; nothing on the server reads it. Pure: the cookie string in,
// the cookie string out; logic/storage.ts does the document.cookie I/O.
import { PLAYER_CONFIG } from '../config.ts';
import type { SavedCard } from './storage.ts';

export const CARD_COOKIE = 'quina_cards';
/** The format's version, the value's first field. */
const FORMAT = '1';
/** Browsers keep a cookie at most 400 days; long enough for a season. */
const MAX_AGE_S = 400 * 24 * 3600;
/** Under the 4 KB a browser keeps for one cookie, with room for its name and attributes. */
export const CARD_COOKIE_MAX = 3800;

/** A card's fields as a cookie keeps them: number, icon, name. */
export type CookieCard = Pick<SavedCard, 'id' | 'color' | 'name'>;

// The value is `1~26~123.3.%C3%80via~57.1.`: format, edition, then each card as number.icon.name, the name
// URI-encoded with its dots and tildes too, so the separators stay unambiguous.
const encodeName = (name: string | null): string => (name ? encodeURIComponent(name).replace(/\./g, '%2E').replace(/~/g, '%7E') : '');

/** The cookie's value for this card list; names are dropped from the last cards first if it would grow too big. */
export function cardCookieValue(edition: string, cards: readonly CookieCard[]): string {
  const parts = cards.map((c) => [String(c.id), String(c.color), encodeName(c.name)]);
  const value = () => [FORMAT, edition, ...parts.map((p) => p.join('.'))].join('~');
  for (let i = parts.length - 1; value().length > CARD_COOKIE_MAX && i >= 0; i--) parts[i][2] = '';
  while (value().length > CARD_COOKIE_MAX && parts.length) parts.pop();
  return value();
}

/** Where the cookie lives: the app's home path ('/26/'), and `secure` on https (a page on localhost may lack it). */
export interface CookieScope {
  readonly path: string;
  readonly secure: boolean;
}

const attributes = ({ path, secure }: CookieScope): string => `Path=${path}; SameSite=Strict${secure ? '; Secure' : ''}`;

/** The `document.cookie` assignment that keeps this list. */
export function cardCookieWrite(edition: string, cards: readonly CookieCard[], scope: CookieScope): string {
  return `${CARD_COOKIE}=${cardCookieValue(edition, cards)}; Max-Age=${MAX_AGE_S}; ${attributes(scope)}`;
}

/** The `document.cookie` assignment that forgets it ("Esborrar dades"). */
export const cardCookieClear = (scope: CookieScope): string => `${CARD_COOKIE}=; Max-Age=0; ${attributes(scope)}`;

const validId = (id: number): boolean => Number.isInteger(id) && id >= PLAYER_CONFIG.cardIdMin && id <= PLAYER_CONFIG.cardIdMax;

/**
 * The card list kept in `document.cookie` (all the page's cookies, `a=1; b=2`) for this edition: null when there's
 * none, it's another edition's, or it can't be read. Bad cards are skipped; the storage cleans names and icons.
 */
export function readCardCookie(cookies: string, edition: string): CookieCard[] | null {
  const pair = cookies
    .split(';')
    .map((p) => p.trim())
    .find((p) => p.startsWith(`${CARD_COOKIE}=`));
  if (!pair) return null;
  const [format, cookieEdition, ...cards] = pair.slice(CARD_COOKIE.length + 1).split('~');
  if (format !== FORMAT || cookieEdition !== edition) return null;
  const out: CookieCard[] = [];
  for (const card of cards) {
    const [id, color, name = ''] = card.split('.');
    const n = Number(id);
    if (!/^\d+$/.test(id ?? '') || !validId(n) || out.some((c) => c.id === n)) continue;
    let decoded: string | null = null;
    try {
      decoded = name ? decodeURIComponent(name) : null;
    } catch {
      decoded = null;
    }
    out.push({ id: n, color: Number(color) || 0, name: decoded });
    if (out.length >= PLAYER_CONFIG.maxCards) break;
  }
  return out;
}
