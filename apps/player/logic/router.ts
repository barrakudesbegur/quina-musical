// Opening the app: which card a link names. Pure: it reads only the URL parts passed in.
// - Production links: quina.barrakudesbegur.org/<edition>/<cardId>, for example /26/123 (the printed QR).
// - Development: the app lives at /player/, so the same route also works as a hash: /player/#/26/123.
// - Last year's links: /?c=123 (several c= allowed). They get "Aquest cartró és de l'any passat".
// - Development hints, for reviewing screens: &view=historial|cartrons (the home screen's switch),
//   &open=premis|horari|ajustos|pad (a drawer), &cards=123,57 (demo cards).
import { LEGACY, PLAYER_CONFIG } from '../config.ts';
import { isOpenable, type OpenableDrawer } from './drawers.ts';
import { isAraView, type AraView } from './tabs.ts';

export type Route =
  /** No card in the link. */
  | { kind: 'home' }
  /** This year's card link: add the card. */
  | { kind: 'card'; edition: string; cardId: number }
  /** A card link of another edition (`older`: last year's or before). */
  | { kind: 'otherEdition'; edition: string; cardId: number | null; older: boolean }
  /** Last year's `?c=` link. */
  | { kind: 'legacy'; cardIds: number[] };

export interface UrlParts {
  pathname: string;
  search: string;
  hash: string;
}

export interface RouterOptions {
  /** This year's tag ('26'). */
  edition: string;
  /** Where the development pages serve the app ('/player/'). */
  base?: string;
}

const EDITION_RE = /^\d{2}$/;
const CARD_RE = /^\d{1,4}$/;

const cardId = (text: string | undefined): number | null => {
  if (!text || !CARD_RE.test(text)) return null;
  const id = Number(text);
  return id >= PLAYER_CONFIG.cardIdMin && id <= PLAYER_CONFIG.cardIdMax ? id : null;
};

/** The route's path segments: from the hash when it holds a route (#/26/123), else the path minus the base. */
function segments({ pathname, hash }: UrlParts, base: string): string[] {
  let path = hash.startsWith('#/') ? hash.slice(1) : pathname;
  if (!hash.startsWith('#/') && base !== '/' && (path === base.replace(/\/$/, '') || path.startsWith(base))) path = path.slice(base.length);
  return path
    .split('/')
    .map((s) => s.trim())
    .filter((s) => s && s !== 'index.html');
}

/** Last year's `?c=` card numbers (each `c` may also hold a comma list). */
export function legacyCardIds(search: string): number[] {
  const ids: number[] = [];
  for (const value of new URLSearchParams(search).getAll(LEGACY.cardParam)) {
    for (const part of value.split(/\D+/)) {
      const id = cardId(part);
      if (id !== null && !ids.includes(id)) ids.push(id);
    }
  }
  return ids;
}

/** What the link asks for. */
export function parseRoute(url: UrlParts, { edition, base = PLAYER_CONFIG.devBase }: RouterOptions): Route {
  const [first, second] = segments(url, base);
  if (first && EDITION_RE.test(first)) {
    const id = cardId(second);
    if (first === edition) return id === null ? { kind: 'home' } : { kind: 'card', edition: first, cardId: id };
    return { kind: 'otherEdition', edition: first, cardId: id, older: Number(first) < Number(edition) };
  }
  const legacy = legacyCardIds(url.search);
  if (legacy.length) return { kind: 'legacy', cardIds: legacy };
  return { kind: 'home' };
}

/**
 * The address to show once a card link has been taken in, so reloading doesn't add a removed card again:
 * the card and `c=` are dropped, everything else (dev hints such as ?demo=) stays.
 */
export function homeHref(url: UrlParts, { edition, base = PLAYER_CONFIG.devBase }: RouterOptions): string {
  const params = new URLSearchParams(url.search);
  params.delete(LEGACY.cardParam);
  const query = params.toString() ? `?${params.toString()}` : '';
  const devPath = url.pathname === base.replace(/\/$/, '') || url.pathname.startsWith(base);
  const path = devPath ? base : url.hash.startsWith('#/') ? url.pathname : `/${edition}/`;
  return `${path}${query}`;
}

export interface DevHints {
  /** The home screen's view (the switch under the drum). */
  view: AraView | null;
  /** A drawer to open. */
  open: OpenableDrawer | null;
  /** Demo cards: null to use the demo's own, [] for none. */
  cards: number[] | null;
}

/** Review hints in the query (development and demos). */
export function devHints(search: string): DevHints {
  const params = new URLSearchParams(search);
  const view = params.get('view');
  const open = params.get('open');
  const cards = params.get('cards');
  return {
    view: isAraView(view) ? view : null,
    open: isOpenable(open) ? open : null,
    cards: cards === null ? null : cards.split(/\D+/).map(cardId).filter((id): id is number => id !== null),
  };
}
