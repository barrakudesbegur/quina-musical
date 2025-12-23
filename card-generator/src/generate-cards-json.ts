import { pick, sortBy } from 'lodash';
import { shuffleArrayWithSeed } from './utils/arrays';

const LINES = 3;
const COLUMNS = 4;
const ATEMPTS_BINGO = 30;
const ATEMPTS_LINE = 30;

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

function cardToUniqueKey(card: Card) {
  return JSON.stringify(
    card.lines
      .flat()
      .map((song) => song.id)
      .toSorted()
  );
}

export function generateCardsJson(
  type: string,
  startId: number,
  amount: number,
  songs: Song[],
  seed: string
) {
  const ids = Array.from({ length: amount }, (_, i) => startId + i);

  const bingosSoFar = new Set<string>();
  const linesSoFar = new Set<string>();
  const duplicateCards = [];

  function saveToSoFar(card: Card) {
    bingosSoFar.add(cardToUniqueKey(card));

    const lines = card.lines.map((line) =>
      line.map((song) => song.id).toSorted()
    );

    const allLineCombinations = getPermutations(lines);
    for (const line of allLineCombinations) {
      linesSoFar.add(JSON.stringify(line));
    }
  }

  const cards = ids.map((id) => {
    let card: Card | null = null;

    for (let i = 0; i < ATEMPTS_BINGO; i++) {
      card = makeCard(id, type, songs, `${seed}-${id}-bingo-${i}`);
      if (bingosSoFar.has(cardToUniqueKey(card))) continue;
      saveToSoFar(card);
      return card;
    }

    for (let i = 0; i < ATEMPTS_LINE; i++) {
      card = makeCard(id, type, songs, `${seed}-${id}-line-${i}`);
      if (linesSoFar.has(cardToUniqueKey(card))) continue;
      saveToSoFar(card);
      return card;
    }

    card ??= makeCard(id, type, songs, `${seed}-${id}-final`);
    duplicateCards.push(card);
    return card;
  });

  if (duplicateCards.length) {
    console.warn(`WARNING: ${duplicateCards.length} cards are duplicated`);
  }

  return cards;
}

function getPermutations<T>(arr: T[]) {
  if (arr.length <= 1) return [arr];
  const result = [] as T[][];
  for (let i = 0; i < arr.length; i++) {
    const rest = [...arr.slice(0, i), ...arr.slice(i + 1)];
    const perms = getPermutations(rest);
    for (const perm of perms) {
      result.push([arr[i], ...perm]);
    }
  }
  return result;
}
