// Song repertoires for the relay: which repertoire's files /audio, /analysis, /data, /stems, /covers, /cards ... serve.
// The TypeScript twin of tools/prep/repertoire.py: apps/show/README.md › "Repertoires" documents the manifest format, and
// tools/prep/tests/test_repertoire.py checks that both resolve a manifest to the same paths. It also names the repo's
// layout (where media, outputs and the cloud link's folder live), so the relay, the tests and the cloud agree.
//   node apps/show/relay/repertoire.ts [NAME|PATH]    prints the resolved repertoire as JSON
import fs from 'node:fs';
import path from 'node:path';

/** The repo root: relative manifest paths resolve against it. */
export const REPO = path.resolve(import.meta.dirname, '../../..');
/** apps/show: the engine, the relay and their tests. */
export const SHOW = path.resolve(import.meta.dirname, '..');
/** The repo's data: what the show reads and the preparation writes, outside the apps' code. */
export const DATA = path.join(REPO, 'data');
/** Repertoire manifests, each repertoire's songs list and hand overrides (tracked). */
export const REPERTOIRES_DIR = path.join(DATA, 'repertoires');
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
export const REPERTOIRE_ENV = 'QUINA_REPERTOIRE';
/**
 * The night's repertoire: the one every command uses when none is named. The relay serves it, and the preflight,
 * setup:laptop, the media sync and the edition tool all resolve theirs here, so they agree with the relay the night
 * runs; tools/prep/repertoire.py's NIGHT_REPERTOIRE is its twin (tools/prep/tests/test_repertoire.py checks they match).
 * Last year's 77 songs, `default`, only when named (`--repertoire default`).
 */
export const NIGHT_REPERTOIRE = '2026';

const NAME_RE = /^[a-z0-9][a-z0-9_-]*$/;
const REQUIRED = ['name', 'songsJson', 'audioDir'];
const OPTIONAL = ['description', 'coversDir', 'cardsJson', 'spotifyFeatures', 'dataDir', 'cacheDir', 'overridesDir'];

/** A repertoire manifest with every path made absolute and every default filled in. */
export interface Repertoire {
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

export class RepertoireError extends Error {
  override name = 'RepertoireError';
}

/** `file` relative to the repo root when inside it, else absolute. */
export function display(file: string): string {
  const rel = path.relative(REPO, file);
  return rel && !rel.startsWith('..') && !path.isAbsolute(rel) ? rel.split(path.sep).join('/') : file;
}

/** A repertoire name → data/repertoires/<name>.json; anything with a slash or ending in .json → that file (from the cwd). */
export function manifestPath(spec: string): string {
  if (spec.includes('/') || spec.includes(path.sep) || spec.endsWith('.json')) return path.resolve(spec);
  if (!NAME_RE.test(spec)) throw new RepertoireError(`bad repertoire name ${JSON.stringify(spec)}: use lowercase letters, digits, - and _ (or a path to a manifest)`);
  return path.join(REPERTOIRES_DIR, `${spec}.json`);
}

export function availableRepertoires(): string[] {
  try {
    return fs.readdirSync(REPERTOIRES_DIR).filter((f) => f.endsWith('.json')).map((f) => f.slice(0, -'.json'.length)).sort();
  } catch {
    return [];
  }
}

/** The repertoire named or pointed to by `spec`, else $QUINA_REPERTOIRE, else the night's. Throws RepertoireError. */
export function loadRepertoire(spec?: string): Repertoire {
  const chosen = spec || process.env[REPERTOIRE_ENV] || NIGHT_REPERTOIRE;
  const file = manifestPath(chosen);
  const inRepertoiresDir = path.dirname(file) === REPERTOIRES_DIR;
  let text: string;
  try {
    text = fs.readFileSync(file, 'utf8');
  } catch {
    const byName = inRepertoiresDir && path.basename(file, '.json') === chosen;
    const hint = byName ? `available: ${availableRepertoires().join(', ') || 'none'}` : 'no such file';
    throw new RepertoireError(`no repertoire manifest ${display(file)} (${hint}); see apps/show/README.md › Repertoires`);
  }
  let doc: unknown;
  try {
    doc = JSON.parse(text);
  } catch (error) {
    throw new RepertoireError(`${display(file)} is not valid JSON: ${String(error)}`);
  }
  if (!doc || typeof doc !== 'object' || Array.isArray(doc)) throw new RepertoireError(`${display(file)} must be a JSON object`);
  const fields = doc as Record<string, unknown>;
  const unknown = Object.keys(fields).filter((k) => !REQUIRED.includes(k) && !OPTIONAL.includes(k)).sort();
  if (unknown.length) throw new RepertoireError(`${display(file)}: unknown field(s) ${unknown.join(', ')} (fields: ${[...REQUIRED, ...OPTIONAL].join(', ')})`);
  const missing = REQUIRED.filter((k) => !fields[k]);
  if (missing.length) throw new RepertoireError(`${display(file)}: missing ${missing.join(', ')}`);
  for (const key of [...REQUIRED, ...OPTIONAL]) {
    if (key in fields && typeof fields[key] !== 'string') throw new RepertoireError(`${display(file)}: ${key} must be a string`);
  }
  const str = (key: string): string => (typeof fields[key] === 'string' ? fields[key] : '');
  const name = str('name');
  if (!NAME_RE.test(name)) throw new RepertoireError(`${display(file)}: bad name ${JSON.stringify(name)} (lowercase letters, digits, - and _)`);
  if (inRepertoiresDir && path.basename(file, '.json') !== name) throw new RepertoireError(`${display(file)}: name ${JSON.stringify(name)} must match the file name`);

  // Absolute paths stay; relative ones resolve against the repo root. Outputs default to data/out and data/cache,
  // never to data/repertoires, which holds the tracked inputs.
  const resolve = (value: string) => path.resolve(REPO, value);
  const opt = (key: string, fallback: string) => resolve(str(key) || fallback);
  const dataDir = opt('dataDir', `data/out/repertoires/${name}`);
  const cacheDir = opt('cacheDir', `data/cache/repertoires/${name}`);
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
    overridesDir: opt('overridesDir', `data/repertoires/${name}/overrides`),
  };
}

if (import.meta.main) {
  try {
    console.log(JSON.stringify(loadRepertoire(process.argv[2]), null, 1));
  } catch (error) {
    console.error(`repertoire error: ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  }
}
