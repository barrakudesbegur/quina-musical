// The printed cards and the songs on them, as every screen needs them: card grids, the Check, titles for
// song ids. The source is apps/cards' cards.json (public: it is printed). Each song on a card carries
// its title and artist, so the song index is built from the cards themselves and needs no other file. The
// card types' names, colours, prices and sides come from card-types.json next to it.
//
// A card has sides (D101, D102, D178): the normal card's side 1 plays Quines 1–4 and its side 2 Quines 5–10, under one
// number. A round plays one side (its `side`), so a screen reads a card's songs only through cardFace(card, side).
import { DEFAULT_SIDE, isSide } from '@quina/protocol';
import type { PlayerCard } from '../../rules/marks.ts';
import { readPrintedCardTypes, type PrintedCardType } from './card-types.ts';

export interface SongInfo {
  id: number;
  title: string;
  artist: string;
}

/** One printed side of a card: its number and its 3 lines of 4 song ids. */
export interface CatalogSide {
  side: number;
  lines: readonly (readonly number[])[];
}

/** A printed card: its number, its type, and its sides in order (one for a card printed on one side). */
export interface CatalogCard {
  id: number;
  type: string;
  sides: readonly CatalogSide[];
}

export interface Catalog {
  cards: Map<number, CatalogCard>;
  songs: Map<number, SongInfo>;
  /** card-types.json, or null when it is missing or broken (screens then fall back: card-types.ts knownCardTypes). */
  cardTypes: readonly PrintedCardType[] | null;
}

/** What a round of side `side` plays of a card: that side's lines, as `{ id, type, lines }`; null when the card has
 * no such side (an especial card in a side-2 round). */
export function cardFace(card: CatalogCard, side: number = DEFAULT_SIDE): PlayerCard | null {
  const lines = card.sides.find((s) => s.side === side)?.lines;
  return lines ? { id: card.id, type: card.type, lines } : null;
}

/** Card `id`'s face on side `side`, or null when it isn't printed or has no such side. */
export const catalogFace = (catalog: Catalog | null | undefined, id: number, side: number = DEFAULT_SIDE): PlayerCard | null => {
  const card = catalog?.cards.get(id);
  return card ? cardFace(card, side) : null;
};

type Rec = Record<string, unknown>;
const isRec = (v: unknown): v is Rec => typeof v === 'object' && v !== null;

/** 3 lines of 4 song ids (or songs with an id, whose titles go into `songs`), else null. */
function parseLines(raw: unknown, songs: Map<number, SongInfo>): number[][] | null {
  if (!Array.isArray(raw) || raw.length !== 3) return null;
  const lines: number[][] = [];
  for (const line of raw) {
    if (!Array.isArray(line) || line.length !== 4) return null;
    const ids: number[] = [];
    for (const s of line) {
      const id = typeof s === 'number' ? s : isRec(s) && typeof s.id === 'number' ? s.id : null;
      if (id === null) return null;
      ids.push(id);
      if (isRec(s) && !songs.has(id)) songs.set(id, { id, title: typeof s.title === 'string' ? s.title : `Cançó ${id}`, artist: typeof s.artist === 'string' ? s.artist : '' });
    }
    lines.push(ids);
  }
  return lines;
}

/** A card's sides: `sides: [{ side, lines }]`, each side once, or (a card from before sides) its `lines` as side 1. */
function parseSides(raw: Rec, songs: Map<number, SongInfo>): CatalogSide[] | null {
  if (raw.sides === undefined) {
    const lines = parseLines(raw.lines, songs);
    return lines && [{ side: DEFAULT_SIDE, lines }];
  }
  if (!Array.isArray(raw.sides)) return null;
  const sides: CatalogSide[] = [];
  for (const s of raw.sides) {
    if (!isRec(s) || !isSide(s.side) || sides.some((o) => o.side === s.side)) return null;
    const lines = parseLines(s.lines, songs);
    if (!lines) return null;
    sides.push({ side: s.side, lines });
  }
  return sides.length ? sides : null;
}

/**
 * Parse cards.json: `[{ id, type, sides: [{ side, lines: [[{ id, title, artist } × 4] × 3] }] }]`, or a card from
 * before sides, `{ id, type, lines }` (its side 1). Plain song ids are accepted too. Malformed cards are skipped and
 * counted, never thrown.
 */
export function parseCards(json: unknown, cardTypes: readonly PrintedCardType[] | null = null): Catalog & { skipped: number } {
  const cards = new Map<number, CatalogCard>();
  const songs = new Map<number, SongInfo>();
  let skipped = 0;
  if (!Array.isArray(json)) return { cards, songs, cardTypes, skipped: 1 };
  for (const raw of json) {
    const sides = isRec(raw) && typeof raw.id === 'number' && typeof raw.type === 'string' ? parseSides(raw, songs) : null;
    if (!sides) {
      skipped++;
      continue;
    }
    const card = raw as Rec & { id: number; type: string };
    cards.set(card.id, { id: card.id, type: card.type, sides });
  }
  return { cards, songs, cardTypes, skipped };
}

/** Where card-types.json lives: next to cards.json ("/cards/cards.json" → "/cards/card-types.json"). */
export function cardTypesUrlFor(cardsUrl: string): string {
  const path = cardsUrl.replace(/[?#].*$/, '');
  return `${path.slice(0, path.lastIndexOf('/') + 1)}card-types.json`;
}

/** Load card-types.json. Never rejects: a missing or broken file is null, and the screen carries on without it. */
export async function loadCardTypes(url: string, init?: RequestInit): Promise<PrintedCardType[] | null> {
  try {
    const res = await fetch(url, init);
    return res.ok ? readPrintedCardTypes(await res.json()) : null;
  } catch {
    return null;
  }
}

/** Load cards.json from `url` (the relay serves it at /cards/cards.json), and card-types.json next to it. Rejects
 * only when cards.json fails. */
export async function loadCatalog(url = '/cards/cards.json'): Promise<Catalog> {
  const types = loadCardTypes(cardTypesUrlFor(url));
  const res = await fetch(url);
  if (!res.ok) throw new Error(`cards: ${res.status} ${res.statusText}`);
  const { cards, songs } = parseCards(await res.json());
  return { cards, songs, cardTypes: await types };
}

/** Where a song's cover lives. The relay serves `/covers/<id>.jpg`; the player app may pass its own base. */
export function coverUrl(songId: number, base = '/covers/', ext = 'jpg'): string {
  return `${base}${songId}.${ext}`;
}

/** A song's title (or "Cançó N" when unknown). */
export function songTitle(catalog: Catalog | null, songId: number | null | undefined): string {
  if (songId === null || songId === undefined) return '';
  return catalog?.songs.get(songId)?.title ?? `Cançó ${songId}`;
}
