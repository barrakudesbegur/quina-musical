// Song pools for the relay: which pool's files /audio, /analysis, /data, /stems, /covers, /cards ... serve.
// The TypeScript twin of analysis/pool.py: README.md › "Pools" documents the manifest format, and
// analysis/tests/test_pool.py checks that both resolve a manifest to the same paths.
//   node relay/pool.ts [NAME|PATH]    prints the resolved pool as JSON
import fs from 'node:fs';
import path from 'node:path';

/** experiments/mixer-poc: relative manifest paths resolve against it. */
export const POC = path.resolve(import.meta.dirname, '..');
export const POOLS_DIR = path.join(POC, 'analysis', 'pools');
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

/** `file` relative to experiments/mixer-poc when inside it, else absolute. */
export function display(file: string): string {
  const rel = path.relative(POC, file);
  return rel && !rel.startsWith('..') && !path.isAbsolute(rel) ? rel.split(path.sep).join('/') : file;
}

/** A pool name → analysis/pools/<name>.json; anything with a slash or ending in .json → that file (from the cwd). */
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
    throw new PoolError(`no pool manifest ${display(file)} (${hint}); see README.md › Pools`);
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

  // Absolute paths stay; relative ones resolve against experiments/mixer-poc.
  const resolve = (value: string) => path.resolve(POC, value);
  const opt = (key: string, fallback: string) => resolve(str(key) || fallback);
  const dataDir = opt('dataDir', `data/pools/${name}`);
  const cacheDir = opt('cacheDir', `cache/pools/${name}`);
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
    overridesDir: opt('overridesDir', `analysis/overrides/${name}`),
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
