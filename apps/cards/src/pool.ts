// Which song pool the cards are made from: data/pools/<name>.json, the same file the song preparation
// (tools/prep) and the relay read. Its `songsJson` is the playlist the cards draw from, and its `cardsJson` is
// where cards.json goes (card-types.json and the PDFs go next to it, which is the folder the relay serves at
// /cards/). So this year's cards come from this year's pool, the same way the audio does: `npm start -- --pool
// <name>`. Paths in a pool file are relative to the repo root. Pure apart from reading the pool file.
import { readFileSync } from 'fs';
import path from 'path';

/** The repo root: apps/cards/src (ts-node) or apps/cards/build (the compiled run) is three levels down. A function,
 * so importing this file outside CommonJS (the UI tests) doesn't need `__dirname`. */
export const repoRoot = (): string => path.resolve(__dirname, '..', '..', '..');

export interface Pool {
  name: string;
  /** Absolute path of the pool's songs.json. */
  songsJson: string;
  /** Absolute path where cards.json is written; card-types.json and the PDFs go in the same folder. */
  cardsJson: string;
}

/** A pool's song, as the playlist fetcher writes it (extra fields are ignored). */
export interface PoolSong {
  id: number;
  title: string;
  artist: string;
  cover: string;
  spotifyId: string;
}

export const DEFAULT_POOL = 'default';
const NAME_RE = /^[a-z0-9][a-z0-9_-]*$/i;

/** `--pool <name>` or `--pool=<name>` from the command line, else the default pool. */
export function poolNameFrom(argv: readonly string[]): string {
  const i = argv.findIndex((a) => a === '--pool' || a.startsWith('--pool='));
  if (i < 0) return DEFAULT_POOL;
  const name = argv[i].includes('=') ? argv[i].slice('--pool='.length) : argv[i + 1];
  if (!name || !NAME_RE.test(name)) throw new Error(`--pool needs a pool name, as in data/pools/<name>.json (got "${name ?? ''}")`);
  return name;
}

/** The pool's file, with its paths made absolute. Throws with a clear message when the file isn't a pool. */
export function parsePool(name: string, json: unknown, repo: string): Pool {
  const p = json as Record<string, unknown> | null;
  if (!p || typeof p.songsJson !== 'string' || typeof p.cardsJson !== 'string') {
    throw new Error(`data/pools/${name}.json needs "songsJson" and "cardsJson" paths`);
  }
  return { name, songsJson: path.resolve(repo, p.songsJson), cardsJson: path.resolve(repo, p.cardsJson) };
}

export function loadPool(name: string, repo: string = repoRoot()): Pool {
  return parsePool(name, JSON.parse(readFileSync(path.join(repo, 'data', 'pools', `${name}.json`), 'utf-8')), repo);
}

/** Every problem with a pool's songs for printing cards (empty when they're fine). */
export function songProblems(json: unknown, songsPerCard: number): string[] {
  if (!Array.isArray(json)) return ['the songs file must be a list of songs'];
  const problems: string[] = [];
  const ids = new Set<number>();
  json.forEach((raw, i) => {
    const s = raw as Partial<PoolSong> | null;
    const where = `song ${i + 1}`;
    if (!s || typeof s !== 'object') return problems.push(`${where}: not an object`);
    if (!Number.isInteger(s.id) || (s.id as number) < 1) problems.push(`${where}: the id must be a whole number from 1`);
    else if (ids.has(s.id as number)) problems.push(`${where}: id ${s.id} is used twice`);
    else ids.add(s.id as number);
    if (typeof s.title !== 'string' || !s.title.trim()) problems.push(`${where}: no title`);
    if (typeof s.artist !== 'string' || !s.artist.trim()) problems.push(`${where}: no artist`);
  });
  if (json.length < songsPerCard) problems.push(`a card needs ${songsPerCard} songs; the pool has ${json.length}`);
  return problems;
}
