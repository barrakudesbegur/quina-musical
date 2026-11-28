// Opening the app: which card a link names. Pure: it reads only the URL parts passed in.
// - Production links: quina.barrakudesbegur.org/<edition>/<cardId>, for example /26/123 (the printed QR).
// - Development: the app lives at /player/, so the same route also works as a hash: /player/#/26/123.
// - Last year's links: /?c=123 (several c= allowed). They get "Aquest cartró és de l'any passat".
// - Development hints, for reviewing screens: &view=historial|cartrons (the home screen's switch),
//   &open=premis|horari|ajustos|pad|install (a drawer), &cards=123,57 (demo cards), &install=prompt|steps|installed
//   (what installing the app offers, D221; development and demos only).
import { LEGACY, PLAYER_CONFIG } from '../config.ts';
import { isOpenable, type OpenableDrawer } from './drawers.ts';
import { isInstallOffer, type InstallOffer } from './install.ts';
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

/**
 * The address the app settles on as it opens: this year's home (`/26/`, or `/player/` in development) whatever link
 * opened it, the root (`/`) and last year's `/?c=` included. So an iPhone adds `/26/` to its Home Screen, the path of
 * the cards' cookie (logic/card-cookie.ts), and the Home Screen app, loaded there, can read it. (The browser keeps the
 * load's own path for document.cookie: a page loaded at `/` writes the cookie but can't read it.) Null when the
 * address is already it.
 */
export function settledHref(url: UrlParts, options: RouterOptions): string | null {
  const href = homeHref(url, options);
  return href === `${url.pathname}${url.search}${url.hash}` ? null : href;
}

/** The cookie path the app's home lives under ('/26/', or '/player/' in development). */
export const homePath = (url: UrlParts, options: RouterOptions): string => homeHref(url, options).replace(/\?.*$/, '');

export interface DevHints {
  /** The home screen's view (the switch under the drum). */
  view: AraView | null;
  /** A drawer to open. */
  open: OpenableDrawer | null;
  /** Demo cards: null to use the demo's own, [] for none. */
  cards: number[] | null;
  /** What installing the app offers, whatever the browser says (main.ts honours it only in development and demos). */
  install: InstallOffer | null;
  /** `&mask=under`: the home's content runs on under the drum's strip, the 27 Nov look, to compare with `strip-fade`
   *  on a phone (main.ts honours it only in development and demos). */
  mask: 'under' | null;
  /** `&bpm=120`: a beat for `mark-bob` while the feed has none (a 4-beat bar from the latest landing; main.ts honours it
   *  only in development and demos). 40–240, else null. */
  bpm: number | null;
  /** `&teach=peek|scribble`: a demo phone that hasn't been shown yet that a tile opens (T3, D289): `peek` opens the card
   *  by itself, `scribble` shows the note at once. Without it a demo phone has been shown (no peek, no scribble). */
  teach: 'peek' | 'scribble' | null;
}

/** Review hints in the query (development and demos). */
export function devHints(search: string): DevHints {
  const params = new URLSearchParams(search);
  const view = params.get('view');
  const open = params.get('open');
  const cards = params.get('cards');
  const install = params.get('install');
  const bpm = Number(params.get('bpm') ?? NaN);
  return {
    bpm: Number.isFinite(bpm) && bpm >= 40 && bpm <= 240 ? bpm : null,
    install: isInstallOffer(install) ? install : null,
    mask: params.get('mask') === 'under' ? 'under' : null,
    teach: params.get('teach') === 'peek' ? 'peek' : params.get('teach') === 'scribble' ? 'scribble' : null,
    view: isAraView(view) ? view : null,
    open: isOpenable(open) ? open : null,
    cards: cards === null ? null : cards.split(/\D+/).map(cardId).filter((id): id is number => id !== null),
  };
}
