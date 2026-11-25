import { pick, sortBy } from 'lodash';
import { shuffleArrayWithSeed } from './utils/arrays';
import { Drawn, drawUnique } from './uniqueness';

const LINES = 3;
const COLUMNS = 4;

type Song = {
  id: number;
  title: string;
  artist: string;
  cover: string;
  spotifyId: string;
};

export type Card = {
  id: number;
  type: string;
  lines: {
    id: number;
    title: string;
    artist: string;
  }[][];
};

function makeCard(id: number, type: string, allSongs: Song[], seed: string) {
  const songsPerCard = LINES * COLUMNS;
  if (allSongs.length < songsPerCard) {
    throw new Error(
      `Not enough songs to generate a card - need at least ${songsPerCard} songs`
    );
  }

  const shuffledSongs = shuffleArrayWithSeed(allSongs, seed);

  const card: Card = {
    id: id,
    type: type,
    lines: Array.from({ length: LINES }, (_, i) => {
      const start = i * COLUMNS;
      const end = start + COLUMNS;
      return sortBy(
        shuffledSongs
          .slice(start, end)
          .map((song) => pick(song, ['id', 'title', 'artist'])),
        'title'
      );
    }),
  };

  return card;
}

/**
 * `amount` cards of one type, numbered from `startId`. Each card is drawn again (the next seed) until it repeats no
 * card and no line drawn so far (uniqueness.ts), and the run fails if one can't be: pass the same `drawn` to every
 * type, so lines are unique across the whole print run. A card's first draw keeps its old seed
 * (`<seed>-<id>-bingo-0`), so the same pool and seed give the same cards as before, except those that repeated a line.
 */
export function generateCardsJson(type: string, startId: number, amount: number, songs: Song[], seed: string, drawn: Drawn = new Drawn()): Card[] {
  const ids = Array.from({ length: amount }, (_, i) => startId + i);
  return ids.map((id) => drawUnique((attempt) => makeCard(id, type, songs, `${seed}-${id}-bingo-${attempt}`), drawn));
}
