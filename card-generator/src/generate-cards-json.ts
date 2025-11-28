import { sortBy } from 'lodash';
import type { Song } from './data/songs';
import { shuffleArrayWithSeed } from './utils/arrays';

const ATEMPTS_BINGO = 30;
const ATEMPTS_LINE = 30;

export type Card = {
  id: string;
  lines: [
    [Song, Song, Song, Song],
    [Song, Song, Song, Song],
    [Song, Song, Song, Song],
  ];
};

function makeCard(id: string, allSongs: Song[], seed: string) {
  if (allSongs.length < 12) {
    throw new Error(
      'Not enough songs to generate a card - need at least 12 songs'
    );
  }

  const shuffledSongs = shuffleArrayWithSeed(allSongs, seed);

  const card: Card = {
    id: id,
    lines: [
      sortBy(shuffledSongs.slice(0, 4), 'title'),
      sortBy(shuffledSongs.slice(4, 8), 'title'),
      sortBy(shuffledSongs.slice(8, 12), 'title'),
    ] as Card['lines'],
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

export function generateCardsJson(amount: number, songs: Song[], seed: string) {
  const ids = Array.from({ length: amount }, (_, i) =>
    (i + 1).toLocaleString()
  );

  const bingosSoFar = new Set<string>();
  const linesSoFar = new Set<string>();
  const duplicateCards = [];

  function saveToSoFar(card: Card) {
    bingosSoFar.add(cardToUniqueKey(card));

    const lines = card.lines.map((line) =>
      line.map((song) => song.id).toSorted()
    );
    const allLineCombinations = [
      [lines[0], lines[1], lines[2]],
      [lines[0], lines[2], lines[1]],
      [lines[1], lines[0], lines[2]],
      [lines[1], lines[2], lines[0]],
      [lines[2], lines[0], lines[1]],
      [lines[2], lines[1], lines[0]],
    ];
    for (const line of allLineCombinations) {
      linesSoFar.add(JSON.stringify(line));
    }
  }

  const cards = ids.map((id) => {
    let card: Card | null = null;

    for (let i = 0; i < ATEMPTS_BINGO; i++) {
      card = makeCard(id, songs, `${seed}-${id}`);
      if (bingosSoFar.has(cardToUniqueKey(card))) continue;
      saveToSoFar(card);
      return card;
    }

    for (let i = 0; i < ATEMPTS_LINE; i++) {
      card = makeCard(id, songs, `${seed}-${id}`);
      if (linesSoFar.has(cardToUniqueKey(card))) continue;
      saveToSoFar(card);
      return card;
    }

    card ??= makeCard(id, songs, `${seed}-${id}`);
    duplicateCards.push(card);
    return card;
  });

  if (duplicateCards.length) {
    console.warn(`WARNING: ${duplicateCards.length} cards are duplicated`);
  }

  return cards;
}
