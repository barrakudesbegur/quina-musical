// The laptop's side of the media sync (src/domain/media-sync.ts): push this laptop's prepared pool to the cloud's
// private R2 bucket, or pull it onto a takeover laptop. Only changed files move (by SHA-256; hashes are cached
// by size and mtime in <dataDir>/media-index.json, so 6 GB isn't hashed again every time). A pull writes each
// file to `<file>.part`, checks its size and SHA-256, then renames it, so a cut-off download never leaves a
// broken file behind; it never deletes anything local.
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { changedFiles, isSyncPath, MAX_SYNC_FILE_BYTES, type MediaManifest, type SyncRoot } from '../src/domain/media-sync.ts';

/** A synced folder on this laptop. */
export interface RootDir {
  root: SyncRoot;
  dir: string;
  /** Files (relative, `/`-separated) to leave out. */
  exclude?: (rel: string) => boolean;
}

export interface SyncOptions {
  /** The cloud's https origin, for example https://quina-dev.barrakudesbegur.org. */
  cloud: string;
  /** The Access service token headers (none for wrangler dev). */
  headers: Record<string, string>;
  pool: string;
  roots: RootDir[];
  /** Where the hash index lives (the link's data folder). */
  dataDir: string;
  log?: (line: string) => void;
  concurrency?: number;
}

export interface SyncReport {
  files: number;
  moved: number;
  bytes: number;
  /** Paths left out, with why. */
  skipped: string[];
}

interface Indexed {
  size: number;
  mtimeMs: number;
  sha256: string;
}

interface LocalFile {
  abs: string;
  size: number;
  sha256: string;
}

/** Every syncable file under the roots, hashed (cached by size and mtime). */
export async function scan(roots: readonly RootDir[], dataDir: string, skipped: string[] = []): Promise<Map<string, LocalFile>> {
  const indexFile = path.join(dataDir, 'media-index.json');
  let index: Record<string, Indexed> = {};
  try {
    index = JSON.parse(fs.readFileSync(indexFile, 'utf8')) as Record<string, Indexed>;
  } catch {
    // first run
  }
  const files = new Map<string, LocalFile>();
  for (const { root, dir, exclude } of roots) {
    if (!fs.existsSync(dir)) continue;
    for (const entry of fs.readdirSync(dir, { recursive: true, withFileTypes: true })) {
      if (!entry.isFile()) continue;
      const abs = path.join(entry.parentPath, entry.name);
      const rel = path.relative(dir, abs).split(path.sep).join('/');
      if (rel.split('/').some((s) => s.startsWith('.')) || rel.endsWith('.part') || rel.endsWith('.tmp') || exclude?.(rel)) continue;
      const syncPath = `${root}/${rel}`;
      if (!isSyncPath(syncPath)) {
        skipped.push(`${syncPath}: not a plain file name`);
        continue;
      }
      const stat = fs.statSync(abs);
      if (stat.size > MAX_SYNC_FILE_BYTES) {
        skipped.push(`${syncPath}: ${(stat.size / 1e6).toFixed(0)} MB, more than one request takes`);
        continue;
      }
      const known = index[abs];
      const sha256 = known && known.size === stat.size && known.mtimeMs === stat.mtimeMs ? known.sha256 : await hashFile(abs);
      index[abs] = { size: stat.size, mtimeMs: stat.mtimeMs, sha256 };
      files.set(syncPath, { abs, size: stat.size, sha256 });
    }
  }
  fs.mkdirSync(dataDir, { recursive: true });
  fs.writeFileSync(indexFile, JSON.stringify(index));
  return files;
}

async function hashFile(file: string): Promise<string> {
  const hash = createHash('sha256');
  await pipeline(fs.createReadStream(file), hash);
  return hash.digest('hex');
}

const manifestFiles = (files: Map<string, LocalFile>): MediaManifest['files'] => Object.fromEntries([...files].map(([p, f]) => [p, { size: f.size, sha256: f.sha256 }]));

async function remoteManifest(o: SyncOptions): Promise<MediaManifest> {
  const response = await fetch(`${o.cloud}/api/sync/${o.pool}/manifest`, { headers: o.headers });
  if (!response.ok) throw new Error(`the cloud's manifest: HTTP ${response.status} ${await response.text()}`);
  return (await response.json()) as MediaManifest;
}

/** Run `work` over `items`, `limit` at a time. */
async function inParallel<T>(items: readonly T[], limit: number, work: (item: T) => Promise<void>): Promise<void> {
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (next < items.length) await work(items[next++] as T);
    }),
  );
}

/** Upload what changed, then the manifest (last, so a pull never sees files that aren't there yet). */
export async function push(o: SyncOptions): Promise<SyncReport> {
  const log = o.log ?? console.log;
  const skipped: string[] = [];
  const local = await scan(o.roots, o.dataDir, skipped);
  const remote = await remoteManifest(o);
  const todo = changedFiles(manifestFiles(local), remote.files);
  let bytes = 0;
  log(`media push: ${local.size} files here, ${todo.length} to upload`);
  await inParallel(todo, o.concurrency ?? 4, async (syncPath) => {
    const file = local.get(syncPath) as LocalFile;
    const response = await fetch(`${o.cloud}/api/sync/${o.pool}/file?path=${encodeURIComponent(syncPath)}`, {
      method: 'PUT',
      headers: { ...o.headers, 'x-sha256': file.sha256, 'content-length': String(file.size), 'content-type': 'application/octet-stream' },
      body: Readable.toWeb(fs.createReadStream(file.abs)) as ReadableStream,
      duplex: 'half',
    } as RequestInit);
    if (!response.ok) throw new Error(`upload ${syncPath}: HTTP ${response.status} ${await response.text()}`);
    bytes += file.size;
  });
  const manifest: MediaManifest = { v: 1, pool: o.pool, files: manifestFiles(local), updatedAtMs: Date.now() };
  const saved = await fetch(`${o.cloud}/api/sync/${o.pool}/manifest`, { method: 'PUT', headers: { ...o.headers, 'content-type': 'application/json' }, body: JSON.stringify(manifest) });
  if (!saved.ok) throw new Error(`the manifest: HTTP ${saved.status} ${await saved.text()}`);
  for (const line of skipped) log(`  skipped ${line}`);
  log(`media push: ${todo.length} uploaded (${(bytes / 1e6).toFixed(1)} MB)`);
  return { files: local.size, moved: todo.length, bytes, skipped };
}

/** Download what this laptop lacks or has differently. Never deletes local files. */
export async function pull(o: SyncOptions): Promise<SyncReport> {
  const log = o.log ?? console.log;
  const remote = await remoteManifest(o);
  const local = await scan(o.roots, o.dataDir);
  const todo = changedFiles(remote.files, manifestFiles(local));
  const dirs = new Map(o.roots.map((r) => [r.root, r.dir]));
  const skipped: string[] = [];
  let bytes = 0;
  log(`media pull: ${Object.keys(remote.files).length} files in the cloud, ${todo.length} to download`);
  await inParallel(todo, o.concurrency ?? 4, async (syncPath) => {
    const expected = remote.files[syncPath] as MediaManifest['files'][string];
    const [root, ...rest] = syncPath.split('/');
    const dir = dirs.get(root as SyncRoot);
    if (!dir) {
      skipped.push(`${syncPath}: no folder for ${root} on this laptop`);
      return;
    }
    const target = path.join(dir, ...rest);
    if (!target.startsWith(path.resolve(dir) + path.sep)) throw new Error(`refusing to write outside ${dir}: ${syncPath}`);
    const response = await fetch(`${o.cloud}/api/sync/${o.pool}/file?path=${encodeURIComponent(syncPath)}`, { headers: o.headers });
    if (!response.ok || !response.body) throw new Error(`download ${syncPath}: HTTP ${response.status}`);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    const part = `${target}.part`;
    const hash = createHash('sha256');
    let size = 0;
    const body = Readable.fromWeb(response.body as import('node:stream/web').ReadableStream);
    body.on('data', (chunk: Buffer) => {
      hash.update(chunk);
      size += chunk.length;
    });
    await pipeline(body, fs.createWriteStream(part));
    const sha256 = hash.digest('hex');
    if (size !== expected.size || sha256 !== expected.sha256) {
      fs.rmSync(part, { force: true });
      throw new Error(`download ${syncPath}: got ${size} bytes ${sha256.slice(0, 12)}…, expected ${expected.size} ${expected.sha256.slice(0, 12)}…`);
    }
    fs.renameSync(part, target);
    bytes += size;
  });
  await scan(o.roots, o.dataDir); // refresh the index with the new files
  for (const line of skipped) log(`  skipped ${line}`);
  log(`media pull: ${todo.length - skipped.length} downloaded (${(bytes / 1e6).toFixed(1)} MB)`);
  return { files: Object.keys(remote.files).length, moved: todo.length - skipped.length, bytes, skipped };
}
