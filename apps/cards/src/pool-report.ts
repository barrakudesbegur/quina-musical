// The pool-size report on the command line (R1-Q31): how long rounds would run for a pool and the cards sold, to help
// choose the playlist's size before the cards are printed. Nothing is written.
//
//   npx ts-node src/pool-report.ts --pool <name> --sold 250             this pool, the first 250 normal cards drawn
//   npx ts-node src/pool-report.ts --sizes 60,70,80,90 --sold 250       hypothetical pools of those sizes
//
// Options: --runs N (simulated rounds, default 2000), --pace S (seconds per song, for minutes; default 30).
import { readFileSync } from 'fs';
import { generateCardsJson } from './generate-cards-json';
import { CARD_AMOUNTS, SEED } from './config';
import { loadPool, poolNameFrom, type PoolSong } from './pool';
import { describeReport, poolReport } from './report';

const argv = process.argv.slice(2);
const opt = (name: string): string | null => {
  const i = argv.findIndex((a) => a === `--${name}` || a.startsWith(`--${name}=`));
  if (i < 0) return null;
  return argv[i].includes('=') ? argv[i].split('=')[1] : (argv[i + 1] ?? null);
};
const num = (name: string, fallback: number): number => {
  const v = opt(name);
  const n = v === null ? fallback : Number(v);
  if (!Number.isInteger(n) || n <= 0) throw new Error(`--${name} needs a whole number (got "${v}")`);
  return n;
};

const sold = num('sold', 250);
const runs = num('runs', 2000);
const pace = num('pace', 30);
const normal = CARD_AMOUNTS.find((a) => a.type === 'normal')?.amount ?? sold;
const synthetic = (n: number): PoolSong[] => Array.from({ length: n }, (_, i) => ({ id: i + 1, title: `Song ${i + 1}`, artist: '', cover: '', spotifyId: '' }));

function reportFor(songs: PoolSong[]): string {
  // The cards drawn from this pool the way the generator draws them; the first `sold` stand for the ones sold.
  const cards = generateCardsJson('normal', 1, Math.max(sold, Math.min(normal, sold * 2)), songs, SEED).slice(0, sold);
  return describeReport(poolReport(songs.map((s) => s.id), cards.map((c) => ({ lines: c.lines.map((l) => l.map((s) => s.id)) })), runs), pace);
}

const sizes = opt('sizes');
if (sizes) {
  for (const n of sizes.split(',').map(Number)) {
    if (!Number.isInteger(n) || n < 12) throw new Error(`--sizes: "${n}" isn't a pool size (at least 12 songs)`);
    console.log(reportFor(synthetic(n)));
  }
} else {
  const pool = loadPool(poolNameFrom(argv));
  console.log(`Pool "${pool.name}":`);
  console.log(reportFor(JSON.parse(readFileSync(pool.songsJson, 'utf-8')) as PoolSong[]));
}
console.log(`(${runs} simulated rounds each; median and 10th–90th percentile; minutes at ${pace} s a song)`);
