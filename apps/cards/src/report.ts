// The pool-size report (R1-Q31, docs/requirements/songs-and-cards.md): for a pool of songs and the cards sold, how many
// songs a round takes to its first Line, its Bingo, and the Desgraciat's last card standing. It helps choose the
// playlist's size: more songs mean longer rounds. The engine's Queue is a random order of the whole pool, so this
// simulates many random orders against the cards and reports the spread. Pure: the cards and a seed come in.

/** A card as cards.json holds it, reduced to its song ids: 3 lines of 4. */
export interface ReportCard {
  lines: number[][];
}

export interface Spread {
  /** Songs played (1 = the first landing), over all the simulated rounds. */
  p10: number;
  median: number;
  p90: number;
}

export interface PoolReport {
  songs: number;
  cards: number;
  runs: number;
  /** Songs until some card completes a Line. */
  firstLine: Spread;
  /** Songs until some card completes all 12 (the Quina). */
  bingo: Spread;
  /** The Desgraciat: songs until one card is left standing (every other card has had a song land). */
  lastStanding: Spread;
}

/** A small seeded random generator (mulberry32), so a report repeats. */
export function seededRandom(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function spread(values: number[]): Spread {
  const sorted = [...values].sort((a, b) => a - b);
  const at = (q: number) => sorted[Math.min(sorted.length - 1, Math.floor(q * sorted.length))];
  return { p10: at(0.1), median: at(0.5), p90: at(0.9) };
}

/**
 * Simulate `runs` rounds over the pool's songs (every song once, in a random order) against `cards`. Each result is a
 * count of songs played: the landing that completes the first Line, the first full card, and the one that leaves a
 * single card standing.
 */
export function poolReport(songIds: readonly number[], cards: readonly ReportCard[], runs: number, seed = 1): PoolReport {
  if (cards.length < 2) throw new Error('the report needs at least 2 cards');
  const random = seededRandom(seed);
  const order = [...songIds];
  const at = new Map<number, number>();
  const firstLine: number[] = [];
  const bingo: number[] = [];
  const lastStanding: number[] = [];
  for (let run = 0; run < runs; run++) {
    // A fresh Fisher–Yates shuffle: the Queue.
    for (let i = order.length - 1; i > 0; i--) {
      const j = Math.floor(random() * (i + 1));
      [order[i], order[j]] = [order[j], order[i]];
    }
    order.forEach((id, i) => at.set(id, i));
    let line = Infinity;
    let full = Infinity;
    // The two latest falls: the last card standing is left once the second-latest has fallen.
    let latest = -1;
    let second = -1;
    for (const card of cards) {
      let fall = Infinity;
      let cardFull = -1;
      for (const songs of card.lines) {
        let lineDone = -1;
        for (const id of songs) {
          const p = at.get(id) ?? Infinity;
          if (p > lineDone) lineDone = p;
          if (p < fall) fall = p;
        }
        if (lineDone < line) line = lineDone;
        if (lineDone > cardFull) cardFull = lineDone;
      }
      if (cardFull < full) full = cardFull;
      if (fall > latest) {
        second = latest;
        latest = fall;
      } else if (fall > second) second = fall;
    }
    firstLine.push(line + 1);
    bingo.push(full + 1);
    lastStanding.push(second + 1);
  }
  return { songs: songIds.length, cards: cards.length, runs, firstLine: spread(firstLine), bingo: spread(bingo), lastStanding: spread(lastStanding) };
}

/** One line of the report, in plain words: "80 songs, 250 cards: first Line at 12 songs (9–15)…". */
export function describeReport(r: PoolReport, secondsPerSong: number | null): string {
  const s = (x: Spread) => `${x.median} (${x.p10}–${x.p90})`;
  const minutes = (songs: number) => (secondsPerSong ? ` ≈ ${Math.round((songs * secondsPerSong) / 60)} min` : '');
  return (
    `${r.songs} songs, ${r.cards} cards sold: first Line after ${s(r.firstLine)} songs${minutes(r.firstLine.median)}; ` +
    `Quina after ${s(r.bingo)}${minutes(r.bingo.median)}; Desgraciat's last card after ${s(r.lastStanding)}${minutes(r.lastStanding.median)}`
  );
}
