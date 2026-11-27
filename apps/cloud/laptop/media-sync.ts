// The laptop's side of the media sync (src/domain/media-sync.ts): push this laptop's prepared repertoire to the cloud's
// private R2 bucket, or pull it onto a takeover laptop. Only changed files move (by SHA-256; hashes are cached
// by size and mtime in <dataDir>/media-index.json, so 6 GB isn't hashed again every time). A pull writes each
// file to `<file>.part`, checks its size and SHA-256, then renames it, so a cut-off download never leaves a
// broken file behind; it never deletes anything local.
// Every request is tried again on a failure that may pass (a network error, HTTP 5xx or 429, a download cut off),
// up to MEDIA_SYNC.attempts times with full-jitter backoff; any other answer (401/403: the token; 400, 409, 413) stops
// at once. A push keeps a journal of the files it has put in the bucket (<dataDir>/media-push-<repertoire>.jsonl)
// until its manifest is up, so a push that stopped resumes: a file the journal names is skipped only when the bucket
// still holds it with that SHA-256, so the manifest never lists a file that isn't there.
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { setTimeout as sleep } from 'node:timers/promises';
import { reconnectDelayMs } from '@quina/protocol';
import { MEDIA_SYNC } from '../src/config.ts';
import { changedFiles, isSha256, isSyncPath, MAX_SYNC_FILE_BYTES, type ManifestFile, type MediaManifest, type SyncRoot } from '../src/domain/media-sync.ts';

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
  repertoire: string;
  roots: RootDir[];
  /** Where the hash index lives (the link's data folder). */
  dataDir: string;
  /** Push only: say what would be uploaded, by root, and upload nothing (the manifest stays as it is). */
  dryRun?: boolean;
  log?: (line: string) => void;
  concurrency?: number;
  /** Tries per request on a failure that may pass (MEDIA_SYNC.attempts; tests shorten the waits). */
  attempts?: number;
  /** The backoff before retry n: a random wait up to min(retryCapMs, retryFirstMs × 2^(n-1)). */
  retryFirstMs?: number;
  retryCapMs?: number;
  random?: () => number;
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
  mtimeMs: number;
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
      files.set(syncPath, { abs, size: stat.size, mtimeMs: stat.mtimeMs, sha256 });
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

/** A failure that may pass: worth another try. */
class Transient extends Error {}

/** A failure in a few words: `fetch failed (ERR_HTTP2_STREAM_ERROR)`, `HTTP 503 …`. */
function describe(error: unknown): string {
  if (!(error instanceof Error)) return String(error);
  const cause = error.cause as { code?: unknown; message?: unknown } | undefined;
  const detail = cause && (typeof cause.code === 'string' ? cause.code : typeof cause.message === 'string' ? cause.message : '');
  return detail ? `${error.message} (${detail})` : error.message;
}

/**
 * One request. A thrown fetch error, HTTP 5xx or 429 is Transient; any other answer but `accept`ed ones throws
 * `<what>: HTTP <status> <body>`, which no retry can fix (401/403 a bad token, 400/409/413 a real problem).
 */
async function send(url: string, init: RequestInit, what: string, accept: readonly number[] = []): Promise<Response> {
  let response: Response;
  try {
    response = await fetch(url, init);
  } catch (error) {
    throw new Transient(describe(error), { cause: error });
  }
  if (response.ok || accept.includes(response.status)) return response;
  const body = (await response.text().catch(() => '')).trim().slice(0, 300);
  const message = `HTTP ${response.status}${body ? ` ${body}` : ''}`;
  if (response.status >= 500 || response.status === 429) throw new Transient(message);
  throw new Error(`${what}: ${message}`);
}

/** Run `attempt` until it succeeds, a failure that won't pass, or the last try; one log line per retry. */
async function withRetry<T>(o: SyncOptions, what: string, attempt: () => Promise<T>): Promise<T> {
  const attempts = o.attempts ?? MEDIA_SYNC.attempts;
  for (let n = 1; ; n += 1) {
    try {
      return await attempt();
    } catch (error) {
      if (!(error instanceof Transient)) throw error;
      if (n >= attempts) throw new Error(`${what}: ${error.message} (gave up after ${n} attempts)`, { cause: error });
      const waitMs = reconnectDelayMs(n - 1, o.random ?? Math.random, o.retryFirstMs ?? MEDIA_SYNC.retryFirstMs, o.retryCapMs ?? MEDIA_SYNC.retryCapMs);
      (o.log ?? console.log)(`  retry ${what}: attempt ${n + 1}/${attempts} in ${(waitMs / 1000).toFixed(1)} s, after ${error.message}`);
      await sleep(waitMs);
    }
  }
}

const fileUrl = (o: SyncOptions, syncPath: string): string => `${o.cloud}/api/sync/${o.repertoire}/file?path=${encodeURIComponent(syncPath)}`;
const manifestUrl = (o: SyncOptions): string => `${o.cloud}/api/sync/${o.repertoire}/manifest`;

function remoteManifest(o: SyncOptions): Promise<MediaManifest> {
  return withRetry(o, "the cloud's manifest", async () => {
    const response = await send(manifestUrl(o), { headers: o.headers }, "the cloud's manifest");
    try {
      return (await response.json()) as MediaManifest;
    } catch (error) {
      throw new Transient(`its body: ${describe(error)}`, { cause: error });
    }
  });
}

/** Run `work` over `items`, `limit` at a time. After a failure no new item starts; the ones under way finish, then it throws the first. */
async function inParallel<T>(items: readonly T[], limit: number, work: (item: T) => Promise<void>): Promise<void> {
  let next = 0;
  let failure: { error: unknown } | null = null;
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (!failure && next < items.length) {
        try {
          await work(items[next++] as T);
        } catch (error) {
          failure ??= { error };
        }
      }
    }),
  );
  if (failure) throw (failure as { error: unknown }).error;
}

/** The files a push has put in the bucket since the last manifest it PUT: one JSON line each, removed with the manifest. */
export const pushJournalFile = (dataDir: string, repertoire: string): string => path.join(dataDir, `media-push-${repertoire}.jsonl`);

/** The journal's files for this cloud, by sync path. A line cut off by a crash is left out. */
function readPushJournal(o: SyncOptions): Map<string, ManifestFile> {
  const files = new Map<string, ManifestFile>();
  let text = '';
  try {
    text = fs.readFileSync(pushJournalFile(o.dataDir, o.repertoire), 'utf8');
  } catch {
    return files;
  }
  for (const line of text.split('\n')) {
    try {
      const entry = JSON.parse(line) as { cloud?: unknown; path?: unknown; size?: unknown; sha256?: unknown };
      if (entry.cloud === o.cloud && isSyncPath(entry.path) && Number.isInteger(entry.size) && isSha256(entry.sha256)) files.set(entry.path, { size: entry.size as number, sha256: entry.sha256 });
    } catch {
      // an empty or cut-off line
    }
  }
  return files;
}

/** Whether the bucket holds `syncPath` with this SHA-256 (R2 checked it on the way in; the Worker answers it as x-sha256). */
function inBucket(o: SyncOptions, syncPath: string, sha256: string): Promise<boolean> {
  return withRetry(o, `check ${syncPath}`, async () => {
    const response = await send(fileUrl(o, syncPath), { headers: o.headers }, `check ${syncPath}`, [404]);
    await response.body?.cancel().catch(() => {});
    return response.ok && response.headers.get('x-sha256') === sha256;
  });
}

/** The manifest this laptop last pushed or pulled: what the preflight checks the files against offline. */
export const referenceFile = (dataDir: string, repertoire: string): string => path.join(dataDir, `media-manifest-${repertoire}.json`);

function writeReference(o: SyncOptions, manifest: MediaManifest): void {
  fs.writeFileSync(referenceFile(o.dataDir, o.repertoire), JSON.stringify(manifest));
}

/** A line every few seconds while files move: how many and how much, of the total. */
function progress(verb: string, totalFiles: number, totalBytes: number, log: (line: string) => void, everyMs = 5000) {
  let files = 0;
  let bytes = 0;
  let lastMs = Date.now();
  const mb = (n: number) => (n / 1e6).toFixed(0);
  return (size: number) => {
    files += 1;
    bytes += size;
    if (Date.now() - lastMs < everyMs && files < totalFiles) return;
    lastMs = Date.now();
    log(`  ${verb} ${files}/${totalFiles} files, ${mb(bytes)} of ${mb(totalBytes)} MB`);
  };
}

const megabytes = (bytes: number): string => (bytes / 1e6).toFixed(1);

/**
 * Upload what changed, then the manifest (last, so a pull never sees files that aren't there yet). Each file that
 * goes up is written to the push journal; a push that stops (a failure, a crash) leaves it, and the next one skips
 * what it names that the bucket still holds unchanged. The journal goes once the manifest is up.
 */
export async function push(o: SyncOptions): Promise<SyncReport> {
  const log = o.log ?? console.log;
  const skipped: string[] = [];
  const local = await scan(o.roots, o.dataDir, skipped);
  const remote = await remoteManifest(o);
  const todo = changedFiles(manifestFiles(local), remote.files);
  let bytes = 0;
  log(`media push: ${local.size} files here, ${todo.length} to upload`);
  if (o.dryRun) {
    const byRoot = new Map<string, { files: number; bytes: number }>();
    for (const syncPath of todo) {
      const root = syncPath.split('/')[0] ?? syncPath;
      const entry = byRoot.get(root) ?? { files: 0, bytes: 0 };
      entry.files += 1;
      entry.bytes += local.get(syncPath)?.size ?? 0;
      byRoot.set(root, entry);
    }
    for (const [root, { files, bytes: size }] of [...byRoot].sort((a, b) => b[1].bytes - a[1].bytes)) log(`  ${root}: ${files} files, ${megabytes(size)} MB`);
    const total = todo.reduce((sum, p) => sum + (local.get(p)?.size ?? 0), 0);
    const journalled = readPushJournal(o);
    const resumable = todo.filter((p) => journalled.get(p)?.sha256 === local.get(p)?.sha256 && journalled.get(p)?.size === local.get(p)?.size).length;
    if (resumable) log(`  ${resumable} of them went up in a push that stopped: the push checks they are still in the bucket and skips them`);
    for (const line of skipped) log(`  skipped ${line}`);
    log(`media push (dry run): would upload ${todo.length} files, ${megabytes(total)} MB, to repertoires/${o.repertoire}/; nothing was sent`);
    return { files: local.size, moved: 0, bytes: 0, skipped };
  }
  const concurrency = o.concurrency ?? MEDIA_SYNC.concurrency;
  // A push that stopped before its manifest: what its journal names, the bucket still holds and hasn't changed here is up.
  const journal = pushJournalFile(o.dataDir, o.repertoire);
  const journalled = readPushJournal(o);
  const resumable = todo.filter((p) => journalled.get(p)?.sha256 === local.get(p)?.sha256 && journalled.get(p)?.size === local.get(p)?.size);
  const kept = new Set<string>();
  await inParallel(resumable, concurrency, async (syncPath) => {
    if (await inBucket(o, syncPath, (local.get(syncPath) as LocalFile).sha256)) kept.add(syncPath);
  });
  if (resumable.length) log(`  ${kept.size} of them already in the bucket from a push that stopped`);
  const uploads = todo.filter((p) => !kept.has(p));
  const moved = progress('uploaded', uploads.length, uploads.reduce((sum, p) => sum + (local.get(p)?.size ?? 0), 0), log);
  await inParallel(uploads, concurrency, async (syncPath) => {
    const file = local.get(syncPath) as LocalFile;
    await withRetry(o, `upload ${syncPath}`, async () => {
      // A file rewritten since the scan would go up under a stale SHA-256 (R2 refuses it), or with more bytes than its
      // content-length (one way an HTTP/2 upload fails with PROTOCOL_ERROR). Each try opens a new read stream.
      const now = fs.statSync(file.abs, { throwIfNoEntry: false });
      if (!now || now.size !== file.size || now.mtimeMs !== file.mtimeMs) throw new Error(`${syncPath} changed during the push; run it again`);
      const stream = fs.createReadStream(file.abs, file.size > 0 ? { end: file.size - 1 } : {});
      try {
        const response = await send(
          fileUrl(o, syncPath),
          {
            method: 'PUT',
            headers: { ...o.headers, 'x-sha256': file.sha256, 'content-length': String(file.size), 'content-type': 'application/octet-stream' },
            body: Readable.toWeb(stream) as ReadableStream,
            duplex: 'half',
          } as RequestInit,
          `upload ${syncPath}`,
        );
        await response.body?.cancel().catch(() => {});
      } finally {
        stream.destroy();
      }
    });
    fs.appendFileSync(journal, `${JSON.stringify({ cloud: o.cloud, path: syncPath, size: file.size, sha256: file.sha256 })}\n`);
    bytes += file.size;
    moved(file.size);
  });
  const manifest: MediaManifest = { v: 2, repertoire: o.repertoire, files: manifestFiles(local), updatedAtMs: Date.now() };
  await withRetry(o, 'the manifest', async () => {
    const saved = await send(manifestUrl(o), { method: 'PUT', headers: { ...o.headers, 'content-type': 'application/json' }, body: JSON.stringify(manifest) }, 'the manifest');
    await saved.body?.cancel().catch(() => {});
  });
  fs.rmSync(journal, { force: true });
  writeReference(o, manifest);
  for (const line of skipped) log(`  skipped ${line}`);
  log(`media push: ${uploads.length} uploaded (${(bytes / 1e6).toFixed(1)} MB)${kept.size ? `, ${kept.size} already there` : ''}`);
  return { files: local.size, moved: uploads.length, bytes, skipped };
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
  log(`media pull: ${Object.keys(remote.files).length} files in the cloud, ${todo.length} to download (a pull cut off resumes where it stopped)`);
  const moved = progress('downloaded', todo.length, todo.reduce((sum, p) => sum + (remote.files[p]?.size ?? 0), 0), log);
  await inParallel(todo, o.concurrency ?? MEDIA_SYNC.concurrency, async (syncPath) => {
    const expected = remote.files[syncPath] as MediaManifest['files'][string];
    const [root, ...rest] = syncPath.split('/');
    const dir = dirs.get(root as SyncRoot);
    if (!dir) {
      skipped.push(`${syncPath}: no folder for ${root} on this laptop`);
      return;
    }
    const target = path.join(dir, ...rest);
    if (!target.startsWith(path.resolve(dir) + path.sep)) throw new Error(`refusing to write outside ${dir}: ${syncPath}`);
    const size = await withRetry(o, `download ${syncPath}`, async () => {
      const response = await send(fileUrl(o, syncPath), { headers: o.headers }, `download ${syncPath}`);
      if (!response.body) throw new Transient('no body');
      fs.mkdirSync(path.dirname(target), { recursive: true });
      // Every try starts the .part again; only a whole file with the right hash is renamed into place.
      const part = `${target}.part`;
      const hash = createHash('sha256');
      let size = 0;
      const body = Readable.fromWeb(response.body as import('node:stream/web').ReadableStream);
      const file = fs.createWriteStream(part);
      // pipeline passes the first error on to the other stream, so whichever reports first is where it came from.
      let failed: 'body' | 'file' | undefined;
      body.on('error', () => (failed ??= 'body'));
      file.on('error', () => (failed ??= 'file'));
      body.on('data', (chunk: Buffer) => {
        hash.update(chunk);
        size += chunk.length;
      });
      try {
        await pipeline(body, file);
      } catch (error) {
        fs.rmSync(part, { force: true });
        if (failed === 'body') throw new Transient(`cut off after ${size} of ${expected.size} bytes: ${describe(error)}`, { cause: error });
        throw error;
      }
      const sha256 = hash.digest('hex');
      if (size !== expected.size || sha256 !== expected.sha256) {
        fs.rmSync(part, { force: true });
        throw new Error(`download ${syncPath}: got ${size} bytes ${sha256.slice(0, 12)}…, expected ${expected.size} ${expected.sha256.slice(0, 12)}…`);
      }
      fs.renameSync(part, target);
      return size;
    });
    bytes += size;
    moved(size);
  });
  await scan(o.roots, o.dataDir); // refresh the index with the new files
  if (skipped.length === 0) writeReference(o, remote);
  for (const line of skipped) log(`  skipped ${line}`);
  log(`media pull: ${todo.length - skipped.length} downloaded (${(bytes / 1e6).toFixed(1)} MB)`);
  return { files: Object.keys(remote.files).length, moved: todo.length - skipped.length, bytes, skipped };
}
