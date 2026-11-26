// The pool-size report on the command line (R1-Q31): how long rounds would run for a pool and the cards sold, to help
// choose the playlist's size before the cards are printed. Nothing is written.
//
//   npx ts-node src/pool-report.ts --repertoire <name> --sold 250       each pool a normal card's side is printed from,
//                                                                      against that side of the first 250 normal cards
//   npx ts-node src/pool-report.ts --sizes 60,70,80,90 --sold 250       hypothetical pools of those sizes
//
// Options: --runs N (simulated rounds, default 2000); --plan <file> (a Game plan JSON, e.g. Admin's export: adds a
// whole-night estimate from its rounds, Intervals and Throws). Minutes use the Pace (22 s a song in round 1, 14 s after)
// plus the Checks (report.ts DEFAULT_TIMING).
import { readFileSync } from 'fs';
import { generateCardsJson } from './generate-cards-json';
import { CARD_AMOUNTS, CARD_TYPES, SEED } from './config';
import { loadRepertoire, repertoireNameFrom, type RepertoireSong } from './repertoire';
import { describeReport, poolReport, type NightShape } from './report';
import { sideSources, sourceWarnings, type SideSource } from './sides';

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
const normal = CARD_AMOUNTS.find((a) => a.type === 'normal')?.amount ?? sold;
const synthetic = (n: number): RepertoireSong[] => Array.from({ length: n }, (_, i) => ({ id: i + 1, title: `Song ${i + 1}`, artist: '', cover: '', spotifyId: '' }));

/** The night's shape from a Game plan file, read loosely (this package can't use the protocol's checker). */
function nightFrom(file: string | null): NightShape | null {
  if (!file) return null;
  const plan = JSON.parse(readFileSync(file, 'utf-8')) as { rounds?: { kind?: string }[]; schedule?: { intervalMinutes?: number; throws?: { minutes?: number }[] } };
  const kinds = (plan.rounds ?? []).map((r) => r.kind ?? 'normal');
  if (!kinds.length) throw new Error(`--plan: ${file} has no rounds`);
  const throwMinutes = (plan.schedule?.throws ?? []).reduce((sum, b) => sum + (b.minutes ?? 0), 0);
  return { kinds, intervalMinutes: plan.schedule?.intervalMinutes ?? 3, throwMinutes };
}
const night = nightFrom(opt('plan'));

/** One report per side: its pool's songs against that side of the normal cards, drawn the way the generator draws
 * them (the first `sold` stand for the ones sold). */
function reportsFor(sources: readonly SideSource<RepertoireSong>[]): string[] {
  const cards = generateCardsJson('normal', 1, Math.max(sold, Math.min(normal, sold * 2)), sources, SEED).slice(0, sold);
  return sources.map(({ side, songs }) => {
    const faces = cards.map((c) => ({ lines: (c.sides.find((s) => s.side === side)?.lines ?? []).map((l) => l.map((s) => s.id)) }));
    return describeReport(poolReport(songs.map((s) => s.id), faces, runs), night);
  });
}

const sizes = opt('sizes');
if (sizes) {
  for (const n of sizes.split(',').map(Number)) {
    if (!Number.isInteger(n) || n < 12) throw new Error(`--sizes: "${n}" isn't a pool size (at least 12 songs)`);
    console.log(reportsFor([{ side: 1, pool: '1', songs: synthetic(n), wholeRepertoire: false }])[0]);
  }
} else {
  const repertoire = loadRepertoire(repertoireNameFrom(argv));
  const songs = JSON.parse(readFileSync(repertoire.songsJson, 'utf-8')) as RepertoireSong[];
  const sources = sideSources(CARD_TYPES.find((t) => t.type === 'normal')?.sides ?? [{ side: 1, pool: '1' }], songs);
  console.log(`Repertoire "${repertoire.name}":`);
  for (const warning of sourceWarnings('normal', sources)) console.warn(`⚠️  ${warning}`);
  reportsFor(sources).forEach((report, i) => console.log(`Pool ${sources[i].pool} (side ${sources[i].side} of the normal card): ${report}`));
}
console.log(`(${runs} simulated rounds each; songs as the median and the 10th–90th percentile; minutes at the Pace, 22 s a song in round 1 and 14 s after, plus the Checks)`);
