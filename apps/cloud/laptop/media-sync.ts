// The laptop's side of the media sync (src/domain/media-sync.ts): push this laptop's prepared repertoire to the cloud's
// private R2 bucket, pull it onto a takeover laptop, or prune the bucket. The bucket is content-addressed (D248): each
// distinct file once, as a blob named by its SHA-256, and a manifest per repertoire mapping each readable path to its
// blob. Laptops keep their readable folders as they are; a pull rebuilds them from the manifest.
// - Push: hash every file (cached by size and mtime in <dataDir>/media-index.json, so 6 GB isn't hashed again every
//   time), list the bucket's blobs, upload only the hashes it lacks (two paths with the same content go up once, and
//   what another repertoire already put there isn't sent again), then PUT the manifest last, so a pull never sees a
//   hash that isn't there. A push that stopped resumes by itself: the bucket's list says what already went up.
// - Pull: read the manifest and, for each path missing or different here, fetch its blob into `<file>.part`, check
//   its size and SHA-256, then rename it into place; a blob several paths share is fetched once (or copied from an
//   identical file already here). It never deletes anything local, and a pull run again resumes where it stopped.
// - Prune: the blobs no manifest names (a replaced voice, an old hook, a dropped repertoire), deleted only with --yes.
// Every request is tried again on a failure that may pass (a network error, HTTP 5xx or 429, a download cut off),
// up to MEDIA_SYNC.attempts times with full-jitter backoff; any other answer (401/403: the token; 400, 409, 413) stops
// at once.
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { setTimeout as sleep } from 'node:timers/promises';
import { reconnectDelayMs } from '@quina/protocol';
import { MEDIA_SYNC } from '../src/config.ts';
import {
  changedFiles,
  isSyncPath,
  MAX_PRUNE_BLOBS,
  MAX_SYNC_FILE_BYTES,
  missingBlobs,
  namedBlobs,
  sameFiles,
  unnamedBlobs,
  type BlobEntry,
  type BlobPage,
  type MediaManifest,
  type SyncOverview,
  type SyncRoot,
} from '../src/domain/media-sync.ts';

/** A synced folder on this laptop. */
export interface RootDir {
  root: SyncRoot;
  dir: string;
  /** Files (relative, `/`-separated) to leave out. */
  exclude?: (rel: string) => boolean;
}

/** Where the cloud is, and how hard to try. */
export interface CloudOptions {
  /** The cloud's https origin, for example https://quina-dev.barrakudesbegur.org. */
  cloud: string;
  /** The Access service token headers (none for wrangler dev). */
  headers: Record<string, string>;
  log?: (line: string) => void;
  /** Tries per request on a failure that may pass (MEDIA_SYNC.attempts; tests shorten the waits). */
  attempts?: number;
  /** The backoff before retry n: a random wait up to min(retryCapMs, retryFirstMs × 2^(n-1)). */
  retryFirstMs?: number;
  retryCapMs?: number;
  random?: () => number;
}

export interface SyncOptions extends CloudOptions {
  repertoire: string;
  roots: RootDir[];
  /** Where the hash index lives (the link's data folder). */
  dataDir: string;
  /** Push only: say what would be uploaded, by root, and upload nothing (the manifest stays as it is). */
  dryRun?: boolean;
  concurrency?: number;
}

export interface SyncReport {
  /** The files here (push) or in the manifest (pull). */
  files: number;
  /** Push: the blobs uploaded. Pull: the files written into place. */
  moved: number;
  /** The bytes sent or downloaded. */
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

const manifestFiles = (files: Map<string, LocalFile>): MediaManifest['files'] => Object.fromEntries([...files].sort(([a], [b]) => (a < b ? -1 : 1)).map(([p, f]) => [p, { size: f.size, sha256: f.sha256 }]));

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
async function withRetry<T>(o: CloudOptions, what: string, attempt: () => Promise<T>): Promise<T> {
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

/** A JSON answer, tried again on a failure that may pass (a body cut off too). null on an accepted 404. */
function getJson<T>(o: CloudOptions, url: string, what: string, missingOk = false): Promise<T | null> {
  return withRetry(o, what, async () => {
    const response = await send(url, { headers: o.headers }, what, missingOk ? [404] : []);
    if (response.status === 404) {
      await response.body?.cancel().catch(() => {});
      return null;
    }
    try {
      return (await response.json()) as T;
    } catch (error) {
      throw new Transient(`its body: ${describe(error)}`, { cause: error });
    }
  });
}

const blobUrl = (o: CloudOptions, sha256: string): string => `${o.cloud}/api/sync/blobs/${sha256}`;
const manifestUrl = (o: CloudOptions, repertoire: string): string => `${o.cloud}/api/sync/manifests/${repertoire}`;

/** A repertoire's manifest in the bucket, or null when it has none. */
function remoteManifest(o: CloudOptions, repertoire: string): Promise<MediaManifest | null> {
  return getJson<MediaManifest>(o, manifestUrl(o, repertoire), `the cloud's manifest of ${repertoire}`, true);
}

/** Every blob in the bucket, hash → size: one request per 1,000 (3 for 2026). */
async function bucketBlobs(o: CloudOptions): Promise<Map<string, number>> {
  const blobs = new Map<string, number>();
  let cursor: string | null = null;
  do {
    const page: BlobPage = (await getJson<BlobPage>(o, `${o.cloud}/api/sync/blobs${cursor ? `?cursor=${encodeURIComponent(cursor)}` : ''}`, "the bucket's blobs")) as BlobPage;
    for (const b of page.blobs) blobs.set(b.sha256, b.size);
    cursor = page.cursor;
  } while (cursor);
  return blobs;
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

/** The manifest this laptop last pushed or pulled: what the preflight checks the files against offline. */
export const referenceFile = (dataDir: string, repertoire: string): string => path.join(dataDir, `media-manifest-${repertoire}.json`);

function writeReference(o: SyncOptions, manifest: MediaManifest): void {
  fs.mkdirSync(o.dataDir, { recursive: true });
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
    log(`  ${verb} ${files}/${totalFiles}, ${mb(bytes)} of ${mb(totalBytes)} MB`);
  };
}

const megabytes = (bytes: number): string => (bytes / 1e6).toFixed(1);
const sum = (sizes: Iterable<number>): number => [...sizes].reduce((total, size) => total + size, 0);

/**
 * Upload the blobs the bucket lacks, then the manifest (last, so a pull never sees a hash that isn't there; the
 * Worker refuses one that names a missing blob). A push that stops uploads no manifest, so pulls keep seeing the last
 * whole push; run again, it lists the bucket and sends only what is still missing.
 */
export async function push(o: SyncOptions): Promise<SyncReport> {
  const log = o.log ?? console.log;
  const skipped: string[] = [];
  const local = await scan(o.roots, o.dataDir, skipped);
  const files = manifestFiles(local);
  const remote = await remoteManifest(o, o.repertoire);
  const changed = changedFiles(files, remote?.files ?? {});
  const removed = Object.keys(remote?.files ?? {}).filter((p) => !Object.hasOwn(files, p));
  const inBucket = await bucketBlobs(o);
  // Each blob goes up from the first path that holds it, in the order of those paths.
  const sourceOf = new Map<string, { syncPath: string; file: LocalFile }>();
  for (const [syncPath, file] of [...local].sort(([a], [b]) => (a < b ? -1 : 1))) if (!sourceOf.has(file.sha256)) sourceOf.set(file.sha256, { syncPath, file });
  const pathOf = (sha256: string) => sourceOf.get(sha256)?.syncPath ?? '';
  const uploads = missingBlobs(files, inBucket).sort((a, b) => (pathOf(a.sha256) < pathOf(b.sha256) ? -1 : 1));
  const total = sum(uploads.map((b) => b.size));
  log(
    `media push: ${local.size} files here (${sourceOf.size} distinct), ${changed.length} new or changed and ${removed.length} gone since the cloud's manifest; ` +
      `${uploads.length} blobs to upload (${megabytes(total)} MB), ${sourceOf.size - uploads.length} already in the bucket`,
  );
  if (o.dryRun) {
    const byRoot = new Map<string, { blobs: number; bytes: number }>();
    for (const blob of uploads) {
      const root = sourceOf.get(blob.sha256)?.syncPath.split('/')[0] ?? '?';
      const entry = byRoot.get(root) ?? { blobs: 0, bytes: 0 };
      entry.blobs += 1;
      entry.bytes += blob.size;
      byRoot.set(root, entry);
    }
    for (const [root, { blobs, bytes }] of [...byRoot].sort((a, b) => b[1].bytes - a[1].bytes)) log(`  ${root}: ${blobs} blobs, ${megabytes(bytes)} MB`);
    for (const line of skipped) log(`  skipped ${line}`);
    log(`media push (dry run): would upload ${uploads.length} blobs, ${megabytes(total)} MB, then manifests/${o.repertoire}.json; nothing was sent`);
    return { files: local.size, moved: 0, bytes: 0, skipped };
  }
  let bytes = 0;
  const moved = progress('uploaded', uploads.length, total, log);
  await inParallel(uploads, o.concurrency ?? MEDIA_SYNC.concurrency, async ({ sha256 }) => {
    const { syncPath, file } = sourceOf.get(sha256) as { syncPath: string; file: LocalFile };
    await withRetry(o, `upload ${syncPath}`, async () => {
      // A file rewritten since the scan would go up under a stale SHA-256 (R2 refuses it), or with more bytes than its
      // content-length (one way an HTTP/2 upload fails with PROTOCOL_ERROR). Each try opens a new read stream.
      const now = fs.statSync(file.abs, { throwIfNoEntry: false });
      if (!now || now.size !== file.size || now.mtimeMs !== file.mtimeMs) throw new Error(`${syncPath} changed during the push; run it again`);
      const stream = fs.createReadStream(file.abs, file.size > 0 ? { end: file.size - 1 } : {});
      try {
        const response = await send(
          blobUrl(o, sha256),
          {
            method: 'PUT',
            headers: { ...o.headers, 'content-length': String(file.size), 'content-type': 'application/octet-stream' },
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
    bytes += file.size;
    moved(file.size);
  });
  for (const line of skipped) log(`  skipped ${line}`);
  if (remote && sameFiles(files, remote.files)) {
    writeReference(o, remote);
    log(`media push: ${uploads.length} uploaded (${megabytes(bytes)} MB); the manifest is unchanged`);
    return { files: local.size, moved: uploads.length, bytes, skipped };
  }
  const manifest: MediaManifest = { v: 3, repertoire: o.repertoire, files, updatedAtMs: Date.now() };
  await withRetry(o, 'the manifest', async () => {
    const saved = await send(manifestUrl(o, o.repertoire), { method: 'PUT', headers: { ...o.headers, 'content-type': 'application/json' }, body: JSON.stringify(manifest) }, 'the manifest');
    await saved.body?.cancel().catch(() => {});
  });
  writeReference(o, manifest);
  log(`media push: ${uploads.length} uploaded (${megabytes(bytes)} MB), then manifests/${o.repertoire}.json (${local.size} files)`);
  return { files: local.size, moved: uploads.length, bytes, skipped };
}

/** Write `source` (a whole file with the right content) to `target` through `<target>.part`, a copy-on-write clone where the disk can. */
function copyInto(source: string, target: string, size: number): void {
  const part = `${target}.part`;
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.copyFileSync(source, part, fs.constants.COPYFILE_FICLONE);
  if (fs.statSync(part).size !== size) {
    fs.rmSync(part, { force: true });
    throw new Error(`copy ${source} → ${target}: not ${size} bytes`);
  }
  fs.renameSync(part, target);
}

/**
 * Write every path the manifest names that this laptop lacks or has differently, each into its readable place. A blob
 * several paths share is downloaded once; one an unchanged file here already holds is copied from it. Never deletes.
 */
export async function pull(o: SyncOptions): Promise<SyncReport> {
  const log = o.log ?? console.log;
  const remote = await remoteManifest(o, o.repertoire);
  if (!remote) throw new Error(`no repertoire ${o.repertoire} in the bucket (manifests/${o.repertoire}.json): push it from the main laptop first`);
  const local = await scan(o.roots, o.dataDir);
  const todo = changedFiles(remote.files, manifestFiles(local));
  const dirs = new Map(o.roots.map((r) => [r.root, r.dir]));
  const skipped: string[] = [];
  // Where each path goes, grouped by blob.
  const byBlob = new Map<string, { syncPath: string; target: string }[]>();
  for (const syncPath of todo) {
    const [root, ...rest] = syncPath.split('/');
    const dir = dirs.get(root as SyncRoot);
    if (!dir) {
      skipped.push(`${syncPath}: no folder for ${root} on this laptop`);
      continue;
    }
    const target = path.join(dir, ...rest);
    if (!target.startsWith(path.resolve(dir) + path.sep)) throw new Error(`refusing to write outside ${dir}: ${syncPath}`);
    const sha256 = (remote.files[syncPath] as MediaManifest['files'][string]).sha256;
    byBlob.set(sha256, [...(byBlob.get(sha256) ?? []), { syncPath, target }]);
  }
  // Files here that stay as they are and already hold a blob some path needs.
  const writing = new Set(todo);
  const here = new Map<string, string>();
  for (const [syncPath, file] of local) if (!writing.has(syncPath) && !here.has(file.sha256)) here.set(file.sha256, file.abs);
  const downloads = [...byBlob.keys()].filter((sha256) => !here.has(sha256));
  const sizeOf = namedBlobs(remote.files);
  const downloadBytes = sum(downloads.map((sha256) => sizeOf.get(sha256) ?? 0));
  log(`media pull: ${Object.keys(remote.files).length} files in the cloud's manifest, ${todo.length - skipped.length} to write here: ${downloads.length} blobs to download (${megabytes(downloadBytes)} MB), the rest copied from identical files (a pull cut off resumes where it stopped)`);
  const moved = progress('downloaded', downloads.length, downloadBytes, log);
  let bytes = 0;
  let written = 0;
  await inParallel([...byBlob], o.concurrency ?? MEDIA_SYNC.concurrency, async ([sha256, targets]) => {
    const size = sizeOf.get(sha256) as number;
    let source = here.get(sha256);
    let rest = targets;
    if (!source) {
      const [first, ...others] = targets as [{ syncPath: string; target: string }, ...{ syncPath: string; target: string }[]];
      await download(o, sha256, size, first.target, first.syncPath);
      bytes += size;
      moved(size);
      written += 1;
      source = first.target;
      rest = others;
    }
    for (const { target } of rest) {
      copyInto(source, target, size);
      written += 1;
    }
  });
  await scan(o.roots, o.dataDir); // refresh the index with the new files
  if (skipped.length === 0) writeReference(o, remote);
  for (const line of skipped) log(`  skipped ${line}`);
  log(`media pull: ${written} files written, ${downloads.length} blobs downloaded (${megabytes(bytes)} MB)`);
  return { files: Object.keys(remote.files).length, moved: written, bytes, skipped };
}

/** One blob into `target`: through `<target>.part`, renamed only when its size and SHA-256 are right. */
async function download(o: SyncOptions, sha256: string, expectedSize: number, target: string, syncPath: string): Promise<void> {
  const what = `download ${syncPath}`;
  await withRetry(o, what, async () => {
    const response = await send(blobUrl(o, sha256), { headers: o.headers }, what);
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
      if (failed === 'body') throw new Transient(`cut off after ${size} of ${expectedSize} bytes: ${describe(error)}`, { cause: error });
      throw error;
    }
    const got = hash.digest('hex');
    if (size !== expectedSize || got !== sha256) {
      fs.rmSync(part, { force: true });
      throw new Error(`${what}: got ${size} bytes ${got.slice(0, 12)}…, expected ${expectedSize} ${sha256.slice(0, 12)}…`);
    }
    fs.renameSync(part, target);
  });
}

export interface PruneOptions extends CloudOptions {
  /** Drop this repertoire's manifest first (with `yes`), so the blobs only it named go too. */
  drop?: string;
  /** Delete; without it, a dry run. */
  yes?: boolean;
}

export interface PruneReport {
  overview: SyncOverview;
  /** The blobs no manifest names (once `drop` is dropped): what was, or would be, deleted. */
  unnamed: BlobEntry[];
  deleted: number;
}

/**
 * The bucket's repertoires and size, and the blobs no manifest names; with `yes`, they go (after `drop`'s manifest).
 * The Worker deletes a blob only while no manifest names it, so a push at the same time can't lose one it needs.
 */
export async function prune(o: PruneOptions): Promise<PruneReport> {
  const log = o.log ?? console.log;
  const gb = (bytes: number) => `${(bytes / 1e9).toFixed(2)} GB`;
  const overview = (await getJson<SyncOverview>(o, `${o.cloud}/api/sync`, "the bucket's overview")) as SyncOverview;
  log(`R2 bucket: ${gb(overview.totalBytes)} of the free tier's ${gb(overview.freeTierBytes)}, in ${overview.blobs.count} blobs (each distinct file once)`);
  for (const r of overview.repertoires) {
    const pushed = r.updatedAtMs ? new Date(r.updatedAtMs).toISOString().slice(0, 16).replace('T', ' ') : '?';
    log(`  ${r.name.padEnd(12)} ${String(r.files).padStart(5)} files  ${gb(r.bytes).padStart(9)}  ${String(r.blobs).padStart(5)} blobs  pushed ${pushed} UTC`);
  }
  if (o.drop && !overview.repertoires.some((r) => r.name === o.drop)) throw new Error(`no repertoire "${o.drop}" in the bucket`);
  const kept = await Promise.all(overview.repertoires.filter((r) => r.name !== o.drop).map((r) => remoteManifest(o, r.name)));
  const unnamed = unnamedBlobs(await bucketBlobs(o), kept.filter((m): m is MediaManifest => m !== null));
  const bytes = sum(unnamed.map((b) => b.size));
  const what = o.drop ? `Dropping repertoire ${o.drop} leaves ${unnamed.length} blobs no manifest names` : `${unnamed.length} blobs no manifest names`;
  log(`${what}, ${gb(bytes)}, leaving ${gb(overview.totalBytes - bytes)}${unnamed.length ? ':' : '.'}`);
  for (const b of unnamed.slice(0, 20)) log(`  ${b.sha256}  ${megabytes(b.size).padStart(8)} MB`);
  if (unnamed.length > 20) log(`  (+${unnamed.length - 20} more)`);
  if (!o.yes) {
    log(`Dry run: nothing deleted. Laptops keep their own copies. Run again with --yes to ${o.drop ? `drop ${o.drop}'s manifest and ` : ''}delete them.`);
    return { overview, unnamed, deleted: 0 };
  }
  if (o.drop) {
    const name = o.drop;
    await withRetry(o, `drop ${name}`, async () => {
      const dropped = await send(manifestUrl(o, name), { method: 'DELETE', headers: { ...o.headers, 'x-confirm-repertoire': name } }, `drop ${name}`);
      await dropped.body?.cancel().catch(() => {});
    });
    log(`dropped repertoire ${name}'s manifest`);
  }
  let deleted = 0;
  for (let i = 0; i < unnamed.length; i += MAX_PRUNE_BLOBS) {
    const batch = unnamed.slice(i, i + MAX_PRUNE_BLOBS).map((b) => b.sha256);
    await withRetry(o, 'prune', async () => {
      const response = await send(`${o.cloud}/api/sync/prune`, { method: 'POST', headers: { ...o.headers, 'content-type': 'application/json' }, body: JSON.stringify({ sha256: batch }) }, 'prune');
      await response.body?.cancel().catch(() => {});
    });
    deleted += batch.length;
  }
  log(`deleted ${deleted} blobs, ${gb(bytes)} freed`);
  return { overview, unnamed, deleted };
}
