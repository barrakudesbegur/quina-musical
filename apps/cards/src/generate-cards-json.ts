import { sortBy } from 'lodash';
import { shuffleArrayWithSeed } from './utils/arrays';
import { DrawnByPool } from './uniqueness';
import { drawCard, type DrawnCard, type SideSource } from './sides';
import { printName, type RepertoireSong } from './repertoire';

const LINES = 3;
const COLUMNS = 4;

/** A song as a card prints it: its print name (D260), the same in cards.json, so the phones show what the card shows. */
export type CardSong = {
  id: number;
  title: string;
  artist: string;
};

/** A printed card as cards.json holds it: `{ id, type, sides: [{ side, lines: [[song × 4] × 3] }] }` (D178). */
export type Card = DrawnCard<CardSong>;

/** 12 songs from a seeded shuffle of `songs`, in 3 lines of 4, with their print names, each line sorted by title. */
function makeLines(songs: readonly RepertoireSong[], seed: string): CardSong[][] {
  const songsPerCard = LINES * COLUMNS;
  if (songs.length < songsPerCard) {
    throw new Error(`Not enough songs to generate a card - need at least ${songsPerCard} songs`);
  }
  const shuffledSongs = shuffleArrayWithSeed(songs, seed);
  return Array.from({ length: LINES }, (_, i) => {
    const start = i * COLUMNS;
    return sortBy(
      shuffledSongs.slice(start, start + COLUMNS).map((song): CardSong => ({ id: song.id, ...printName(song) })),
      'title'
    );
  });
}

/**
 * `amount` cards of one type, numbered from `startId`, each with the sides `sources` give (sides.ts: each from its
 * pool's songs). Each side is drawn again (the next seed) until it repeats no card and no line drawn so far from its
 * pool (uniqueness.ts), and the run fails if one can't be: pass the same `drawn` to every type, so lines are unique
 * across the whole print run. Side 1's first draw keeps its old seed (`<seed>-<id>-bingo-0`), so the same repertoire
 * and seed give the same side 1 as before sides.
 */
export function generateCardsJson(
  type: string,
  startId: number,
  amount: number,
  sources: readonly SideSource<RepertoireSong>[],
  seed: string,
  drawn: DrawnByPool = new DrawnByPool()
): Card[] {
  const ids = Array.from({ length: amount }, (_, i) => startId + i);
  return ids.map((id) => drawCard(id, type, sources, makeLines, seed, drawn));
}
