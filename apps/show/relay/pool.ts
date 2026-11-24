// Song pools for the relay: which pool's files /audio, /analysis, /data, /stems, /covers, /cards ... serve.
// The TypeScript twin of tools/prep/pool.py: apps/show/README.md › "Pools" documents the manifest format, and
// tools/prep/tests/test_pool.py checks that both resolve a manifest to the same paths. It also names the repo's
// layout (where media, outputs and the cloud link's folder live), so the relay, the tests and the cloud agree.
//   node apps/show/relay/pool.ts [NAME|PATH]    prints the resolved pool as JSON
import fs from 'node:fs';
import path from 'node:path';

/** The repo root: relative manifest paths resolve against it. */
export const REPO = path.resolve(import.meta.dirname, '../../..');
/** apps/show: the engine, the relay and their tests. */
export const SHOW = path.resolve(import.meta.dirname, '..');
/** The repo's data: what the show reads and the preparation writes, outside the apps' code. */
export const DATA = path.join(REPO, 'data');
/** Pool manifests, each pool's songs list and hand overrides (tracked). */
export const POOLS_DIR = path.join(DATA, 'pools');
/** Audio and covers: songs, effects (tracked), stingers, Hold music, celebration, Interval, covers. */
export const MEDIA = path.join(DATA, 'media');
/** What the preparation writes: analysis, stems and keys metadata, Signatures, Hold and Interval indexes, reports.
 * QUINA_OUT_DIR points it elsewhere (the tests' "no prepared data" run). */
export const OUT = process.env.QUINA_OUT_DIR ? path.resolve(process.env.QUINA_OUT_DIR) : path.join(DATA, 'out');
/** Decoded audio, stems, Signatures, Blend renders, Hold and Interval audio, the relay token. */
export const CACHE = path.join(DATA, 'cache');
/**
 * The laptop's cloud link folder (journal copy, cloud-plan.json and local-plan.json, resume.json, status.json),
 * served at /cloud/. QUINA_LINK_DIR moves it (the relay audit uses a scratch folder).
 */
export const LINK = process.env.QUINA_LINK_DIR ? path.resolve(process.env.QUINA_LINK_DIR) : path.join(DATA, 'link');
/** tools/prep: the preparation pipeline (Python), which the relay also runs during the show. */
export const PREP = path.join(REPO, 'tools', 'prep');
export const POOL_ENV = 'QUINA_POOL';
export const DEFAULT_POOL = 'default';

const NAME_RE = /^[a-z0-9][a-z0-9_-]*$/;
const REQUIRED = ['name', 'songsJson', 'audioDir'];
const OPTIONAL = ['description', 'coversDir', 'cardsJson', 'spotifyFeatures', 'dataDir', 'cacheDir', 'overridesDir'];

/** A pool manifest with every path made absolute and every default filled in. */
export interface Pool {
  name: string;
  manifest: string;
  songsJson: string;
  audioDir: string;
  coversDir: string;
  cardsJson: string | null;
  spotifyFeatures: string;
  dataDir: string;
  cacheDir: string;
  overridesDir: string;
}

export class PoolError extends Error {
  override name = 'PoolError';
}

/** `file` relative to the repo root when inside it, else absolute. */
export function display(file: string): string {
  const rel = path.relative(REPO, file);
  return rel && !rel.startsWith('..') && !path.isAbsolute(rel) ? rel.split(path.sep).join('/') : file;
}

/** A pool name → data/pools/<name>.json; anything with a slash or ending in .json → that file (from the cwd). */
export function manifestPath(spec: string): string {
  if (spec.includes('/') || spec.includes(path.sep) || spec.endsWith('.json')) return path.resolve(spec);
  if (!NAME_RE.test(spec)) throw new PoolError(`bad pool name ${JSON.stringify(spec)}: use lowercase letters, digits, - and _ (or a path to a manifest)`);
  return path.join(POOLS_DIR, `${spec}.json`);
}

export function availablePools(): string[] {
  try {
    return fs.readdirSync(POOLS_DIR).filter((f) => f.endsWith('.json')).map((f) => f.slice(0, -'.json'.length)).sort();
  } catch {
    return [];
  }
}

/** The pool named or pointed to by `spec`, else $QUINA_POOL, else "default". Throws PoolError. */
export function loadPool(spec?: string): Pool {
  const chosen = spec || process.env[POOL_ENV] || DEFAULT_POOL;
  const file = manifestPath(chosen);
  const inPoolsDir = path.dirname(file) === POOLS_DIR;
  let text: string;
  try {
    text = fs.readFileSync(file, 'utf8');
  } catch {
    const byName = inPoolsDir && path.basename(file, '.json') === chosen;
    const hint = byName ? `available: ${availablePools().join(', ') || 'none'}` : 'no such file';
    throw new PoolError(`no pool manifest ${display(file)} (${hint}); see apps/show/README.md › Pools`);
  }
  let doc: unknown;
  try {
    doc = JSON.parse(text);
  } catch (error) {
    throw new PoolError(`${display(file)} is not valid JSON: ${String(error)}`);
  }
  if (!doc || typeof doc !== 'object' || Array.isArray(doc)) throw new PoolError(`${display(file)} must be a JSON object`);
  const fields = doc as Record<string, unknown>;
  const unknown = Object.keys(fields).filter((k) => !REQUIRED.includes(k) && !OPTIONAL.includes(k)).sort();
  if (unknown.length) throw new PoolError(`${display(file)}: unknown field(s) ${unknown.join(', ')} (fields: ${[...REQUIRED, ...OPTIONAL].join(', ')})`);
  const missing = REQUIRED.filter((k) => !fields[k]);
  if (missing.length) throw new PoolError(`${display(file)}: missing ${missing.join(', ')}`);
  for (const key of [...REQUIRED, ...OPTIONAL]) {
    if (key in fields && typeof fields[key] !== 'string') throw new PoolError(`${display(file)}: ${key} must be a string`);
  }
  const str = (key: string): string => (typeof fields[key] === 'string' ? fields[key] : '');
  const name = str('name');
  if (!NAME_RE.test(name)) throw new PoolError(`${display(file)}: bad name ${JSON.stringify(name)} (lowercase letters, digits, - and _)`);
  if (inPoolsDir && path.basename(file, '.json') !== name) throw new PoolError(`${display(file)}: name ${JSON.stringify(name)} must match the file name`);

  // Absolute paths stay; relative ones resolve against the repo root. Outputs default to data/out and data/cache,
  // never to data/pools, which holds the tracked inputs.
  const resolve = (value: string) => path.resolve(REPO, value);
  const opt = (key: string, fallback: string) => resolve(str(key) || fallback);
  const dataDir = opt('dataDir', `data/out/pools/${name}`);
  const cacheDir = opt('cacheDir', `data/cache/pools/${name}`);
  return {
    name,
    manifest: file,
    songsJson: resolve(str('songsJson')),
    audioDir: resolve(str('audioDir')),
    coversDir: opt('coversDir', path.join(cacheDir, 'covers')),
    cardsJson: str('cardsJson') ? resolve(str('cardsJson')) : null,
    spotifyFeatures: opt('spotifyFeatures', path.join(dataDir, 'spotify_features.json')),
    dataDir,
    cacheDir,
    overridesDir: opt('overridesDir', `data/pools/${name}/overrides`),
  };
}

if (import.meta.main) {
  try {
    console.log(JSON.stringify(loadPool(process.argv[2]), null, 1));
  } catch (error) {
    console.error(`pool error: ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  }
}
