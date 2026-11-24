// The printed cards and the songs on them, as every screen needs them: card grids, the Check, titles for
// song ids. The source is apps/cards' cards.json (public: it is printed). Each song on a card carries
// its title and artist, so the song index is built from the cards themselves and needs no other file.
import type { PlayerCard } from '../../rules/marks.ts';

export interface SongInfo {
  id: number;
  title: string;
  artist: string;
}

export interface Catalog {
  cards: Map<number, PlayerCard>;
  songs: Map<number, SongInfo>;
}

type Rec = Record<string, unknown>;
const isRec = (v: unknown): v is Rec => typeof v === 'object' && v !== null;

/**
 * Parse cards.json: `[{ id, type, lines: [[{ id, title, artist } × 4] × 3] }]`. Plain song ids are
 * accepted too. Malformed cards are skipped and counted, never thrown.
 */
export function parseCards(json: unknown): Catalog & { skipped: number } {
  const cards = new Map<number, PlayerCard>();
  const songs = new Map<number, SongInfo>();
  let skipped = 0;
  if (!Array.isArray(json)) return { cards, songs, skipped: 1 };
  for (const raw of json) {
    if (!isRec(raw) || typeof raw.id !== 'number' || typeof raw.type !== 'string' || !Array.isArray(raw.lines)) {
      skipped++;
      continue;
    }
    const lines: number[][] = [];
    let ok = raw.lines.length === 3;
    for (const line of raw.lines) {
      if (!Array.isArray(line) || line.length !== 4) {
        ok = false;
        break;
      }
      const ids: number[] = [];
      for (const s of line) {
        const id = typeof s === 'number' ? s : isRec(s) && typeof s.id === 'number' ? s.id : null;
        if (id === null) {
          ok = false;
          break;
        }
        ids.push(id);
        if (isRec(s) && !songs.has(id)) songs.set(id, { id, title: typeof s.title === 'string' ? s.title : `Cançó ${id}`, artist: typeof s.artist === 'string' ? s.artist : '' });
      }
      lines.push(ids);
    }
    if (!ok) {
      skipped++;
      continue;
    }
    cards.set(raw.id, { id: raw.id, type: raw.type, lines });
  }
  return { cards, songs, skipped };
}

/** Load cards.json from `url` (the relay serves it at /cards/cards.json). */
export async function loadCatalog(url = '/cards/cards.json'): Promise<Catalog> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`cards: ${res.status} ${res.statusText}`);
  const { cards, songs } = parseCards(await res.json());
  return { cards, songs };
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
