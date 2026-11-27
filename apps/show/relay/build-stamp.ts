// The dist build's stamp: which sources a build was made from, so `--dist` never serves a stale build. On 27 Nov
// the user's production test ran a dist two days older than the code, without Pausa or the new Check.
//
// `vite build` (vite.config.ts) hashes every source file the build reads when it starts and writes the hashes to
// dist/build.json when it ends; the relay with --dist hashes them again at start and refuses to serve when any
// differs. Content hashes, not times: a checkout that rewrites a file with the same content is still fresh.
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

export const STAMP_FILE = 'build.json';
export const STAMP_SCHEMA = 1;

/** Apps under apps/ that are not pages of the build (vite.config.ts): `show` has its own pages (engine, remote);
 *  `ds`, the design system's gallery, is served in development only. */
export const NOT_PAGES: ReadonlySet<string> = new Set(['show', 'cloud', 'cards', 'ds', 'node_modules', 'dist']);
/** Folders inside a source root that the build never bundles. */
const SKIP_DIRS = new Set(['node_modules', 'dist', 'tests']);

export interface BuildStamp {
  schemaVersion: number;
  builtAtMs: number;
  /** Repo-relative path → SHA-1 of its content, for every source file. */
  files: Record<string, string>;
}

/** The page apps: apps/<name>/ with an index.html, not in NOT_PAGES. */
export function pageApps(apps: string): string[] {
  return fs.readdirSync(apps, { withFileTypes: true })
    .filter((d) => d.isDirectory() && !d.name.startsWith('.') && !NOT_PAGES.has(d.name) && fs.existsSync(path.join(apps, d.name, 'index.html')))
    .map((d) => d.name)
    .sort();
}

/** What the build reads: the engine's and the remote's pages, every page app, packages/, and the lockfile (a
 *  dependency's version). Markdown is left out: docs never change a build. */
export function sourceRoots(repo: string): string[] {
  const apps = path.join(repo, 'apps');
  return [
    path.join(apps, 'show', 'engine'),
    path.join(apps, 'show', 'remote'),
    ...pageApps(apps).map((name) => path.join(apps, name)),
    path.join(repo, 'packages'),
    path.join(repo, 'package-lock.json'),
  ];
}

export function sourceHashes(repo: string): Record<string, string> {
  const out: Record<string, string> = {};
  const add = (file: string) => {
    out[path.relative(repo, file).split(path.sep).join('/')] = crypto.createHash('sha1').update(fs.readFileSync(file)).digest('hex');
  };
  const walk = (dir: string) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (entry.name.startsWith('.')) continue;
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (!SKIP_DIRS.has(entry.name)) walk(full);
      } else if (entry.isFile() && !entry.name.endsWith('.md')) add(full);
    }
  };
  for (const root of sourceRoots(repo)) {
    if (!fs.existsSync(root)) continue;
    if (fs.statSync(root).isDirectory()) walk(root);
    else add(root);
  }
  return Object.fromEntries(Object.entries(out).sort(([a], [b]) => (a < b ? -1 : 1)));
}

/** The files that differ between a stamp and the sources now: changed, added or removed. */
export function staleFiles(built: Record<string, string>, now: Record<string, string>): string[] {
  const names = new Set([...Object.keys(built), ...Object.keys(now)]);
  return [...names].filter((name) => built[name] !== now[name]).sort();
}

export function writeStamp(dist: string, files: Record<string, string>, builtAtMs = Date.now()): void {
  const stamp: BuildStamp = { schemaVersion: STAMP_SCHEMA, builtAtMs, files };
  fs.writeFileSync(path.join(dist, STAMP_FILE), `${JSON.stringify(stamp)}\n`);
}

/** Why dist/ can't be served as it is, or null when it was built from exactly these sources. */
export function distProblem(dist: string, repo: string): string | null {
  const file = path.join(dist, STAMP_FILE);
  let stamp: BuildStamp;
  try {
    stamp = JSON.parse(fs.readFileSync(file, 'utf8')) as BuildStamp;
  } catch {
    return 'dist/ has no build stamp (dist/build.json): it was built before stamps or by hand';
  }
  if (stamp?.schemaVersion !== STAMP_SCHEMA || typeof stamp.files !== 'object' || stamp.files == null) return 'dist/build.json is not a build stamp';
  const stale = staleFiles(stamp.files, sourceHashes(repo));
  if (!stale.length) return null;
  const when = new Date(stamp.builtAtMs).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' });
  const shown = stale.slice(0, 5).join(', ') + (stale.length > 5 ? ` and ${stale.length - 5} more` : '');
  return `dist/ was built on ${when} from other sources: ${stale.length} file(s) changed since (${shown})`;
}
