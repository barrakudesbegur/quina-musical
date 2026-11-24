// How a Desgraciat round unfolds with the printed cards: how many cards stand after each song, when the count
// reaches each Phase threshold, how many songs separate those moments from the win, and how often a Shuffle
// has to be redrawn so that one card is the last standing. It is the measure the 'standing' thresholds were
// tuned with (game/phase.ts).
//
//   node apps/show/tests/support/desgraciat.ts [rounds per size = 2000] [card type = normal]
import fs from 'node:fs';
import path from 'node:path';
import { REPO } from '../../relay/pool.ts';
import { seededQueue } from '../../engine/src/game/shuffle.ts';
import { cardSongIds, type Card } from '../../engine/src/game/cards.ts';
import { mixSeed, seededRandom } from '../../engine/src/rng.ts';

const ROUNDS = Number(process.argv[2] ?? 2000);
const TYPE = process.argv[3] ?? 'normal';
const all: Card[] = JSON.parse(fs.readFileSync(path.join(REPO, 'apps/cards/dist/cards.json'), 'utf8'));
const ofType = all.filter((c) => c.type === TYPE);
const pool = [...new Set(all.flatMap((c) => cardSongIds(c).flat()))].sort((a, b) => a - b);
const THRESHOLDS = (process.env.T ?? "30,15,10,8,6,5,4,3,2").split(",").map(Number);

/** Each card's elimination index: the first Queue index of any of its songs. */
function eliminations(cards: readonly Card[], queue: readonly number[]): number[] {
  const pos = new Map(queue.map((id, i) => [id, i]));
  return cards.map((c) => Math.min(...cardSongIds(c).flat().map((id) => pos.get(id) ?? Infinity)));
}

const pct = (xs: number[], p: number) => {
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.floor(p * s.length))];
};
const fmt = (xs: number[]) => (xs.length ? `${pct(xs, 0.1)}/${pct(xs, 0.5)}/${pct(xs, 0.9)}` : '-');

console.log(`${ofType.length} '${TYPE}' cards, pool ${pool.length} songs, ${ROUNDS} rounds per size; p10/p50/p90 songs`);
console.log('cards  ties%  winAt     ' + THRESHOLDS.map((t) => `≤${t} before win`.padEnd(14)).join(''));
for (const n of [30, 60, 100, 150, 200, 250, 300, 399]) {
  if (n > ofType.length) continue;
  let ties = 0;
  const winAt: number[] = [];
  const lead: number[][] = THRESHOLDS.map(() => []);
  for (let r = 0; r < ROUNDS; r++) {
    const rand = seededRandom(mixSeed(n, r));
    // n cards in play: a random contiguous range, as sold.
    const from = Math.floor(rand() * (ofType.length - n + 1));
    const cards = ofType.slice(from, from + n);
    const queue = seededQueue(pool, mixSeed(r, n), 0);
    const elim = eliminations(cards, queue).sort((a, b) => a - b);
    const last = elim[elim.length - 1];
    if (elim.length > 1 && elim[elim.length - 2] === last) {
      ties++;
      continue;
    }
    // The win: the landing after which one card stands (the second-last card falls).
    const win = elim.length > 1 ? elim[elim.length - 2] : 0;
    winAt.push(win + 1);
    THRESHOLDS.forEach((t, i) => {
      // The first landing after which at most t cards stand.
      const at = elim.length - t - 1 >= 0 ? elim[elim.length - t - 1] : -1;
      lead[i].push(win - at);
    });
  }
  console.log(`${String(n).padStart(5)}  ${(100 * ties / ROUNDS).toFixed(1).padStart(5)}  ${fmt(winAt).padEnd(10)}` + lead.map((l) => fmt(l).padEnd(14)).join(''));
}

// The count standing just before the winning landing (how many fall with the winner's last rival).
const before: Record<string, number> = {};
let rounds = 0;
for (let r = 0; r < ROUNDS; r++) {
  const n = 200;
  const rand = seededRandom(mixSeed(n, r));
  const from = Math.floor(rand() * (ofType.length - n + 1));
  const elim = eliminations(ofType.slice(from, from + n), seededQueue(pool, mixSeed(r, n), 0)).sort((a, b) => a - b);
  if (elim[elim.length - 2] === elim[elim.length - 1]) continue;
  const win = elim[elim.length - 2];
  const standing = elim.filter((e) => e >= win).length;
  const key = standing >= 6 ? '6+' : String(standing);
  before[key] = (before[key] ?? 0) + 1;
  rounds++;
}
console.log('200 cards, standing as the winning song lands:', Object.entries(before).sort().map(([k, v]) => `${k}: ${(100 * v / rounds).toFixed(1)}%`).join(', '));
