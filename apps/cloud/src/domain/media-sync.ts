// Media sync (C3): the show laptop pushes its prepared repertoire (decoded songs, stems, Signatures, analysis, covers,
// Hold and Interval music, effects) to a private R2 bucket, and a takeover laptop pulls it, so playback never depends on the
// internet on the night and a second laptop doesn't re-run the 30-minute pipeline. Pure rules shared by the
// Worker and the laptop: which folders, which paths, the manifest, the bucket's keys. Copyrighted audio only ever goes
// to the private bucket, through the laptop's Access service token; never to git, never public.
//
// The bucket is content-addressed (D248): each distinct file once, as `blobs/<sha256>`, and one manifest per repertoire,
// `manifests/<repertoire>.json`, mapping each readable path to its size and hash. Laptops keep their readable folders;
// a pull rebuilds them from the manifest. The shared music (Hold, Interval, voices, fx, stingers) and a track two pools
// share are stored once, whatever their ids: dedup comes from the hashes, never from song ids (they are per repertoire).

/** The folders synced, by name (laptop/repertoire-roots.ts maps them to the repertoire's folders on disk). */
export const SYNC_ROOTS = ['cache', 'data', 'covers', 'overrides', 'cards', 'hold-cache', 'hold-data', 'interval-cache', 'interval-data', 'voice-cache', 'voice-data', 'fx', 'stingers'] as const;
export type SyncRoot = (typeof SYNC_ROOTS)[number];

/** One file as the manifest lists it: its content is the blob `blobs/<sha256>`. */
export interface ManifestFile {
  size: number;
  /** Lowercase hex SHA-256 of the content. */
  sha256: string;
}

/** What a repertoire's media is, in the bucket: `manifests/<repertoire>.json`. */
export interface MediaManifest {
  v: 3;
  repertoire: string;
  /** By sync path (`<root>/<relative path>`); several paths may name one blob. */
  files: Record<string, ManifestFile>;
  updatedAtMs: number;
}

/** One blob in the bucket, as GET /api/sync/blobs lists it. */
export interface BlobEntry {
  sha256: string;
  size: number;
}

/** GET /api/sync/blobs[?cursor=…]: one page of the bucket's blobs (at most BLOB_PAGE), and the cursor to the next, or null. */
export interface BlobPage {
  blobs: BlobEntry[];
  cursor: string | null;
}

/** GET /api/sync: each repertoire from its manifest, and what the bucket really holds (each blob once). */
export interface SyncOverview {
  repertoires: { name: string; files: number; bytes: number; blobs: number; updatedAtMs: number }[];
  blobs: { count: number; bytes: number };
  /** Blobs no manifest names: what `npm run media -- prune --yes` would delete. */
  unnamed: { count: number; bytes: number };
  /** The bucket's real size: every blob once (manifests are a few hundred KB). */
  totalBytes: number;
  freeTierBytes: number;
}

/** The largest file the Worker can take in one request on the Free plan (100 MB request bodies). */
export const MAX_SYNC_FILE_BYTES = 100 * 1000 * 1000;

/** The largest manifest PUT (2026's 2,796 files are about 400 KB). */
export const MAX_MANIFEST_BYTES = 4 << 20;

/** R2 lists and deletes at most 1,000 keys per call; a page of blobs and a prune request are one call each. */
export const BLOB_PAGE = 1000;
export const MAX_PRUNE_BLOBS = 1000;

/** R2's free tier (D113: going past it is fine, a few cents a month). */
export const FREE_TIER_BYTES = 10e9;

const SEGMENT = /^[A-Za-z0-9._@+ -]{1,120}$/;

/** A sync path: `<root>/<segments>`, a known root, no `.`/`..` segments, plain file names only. */
export function isSyncPath(value: unknown): value is string {
  if (typeof value !== 'string' || value.length > 300) return false;
  const [root, ...rest] = value.split('/');
  if (!(SYNC_ROOTS as readonly string[]).includes(root ?? '') || rest.length === 0) return false;
  return rest.every((segment) => SEGMENT.test(segment) && segment !== '.' && segment !== '..' && !segment.startsWith('.'));
}

export const isSha256 = (value: unknown): value is string => typeof value === 'string' && /^[0-9a-f]{64}$/.test(value);

/** A repertoire's name, as data/repertoires/<name>.json and the routes take it. */
export const isRepertoireName = (value: unknown): value is string => typeof value === 'string' && /^[a-z0-9_-]{1,40}$/.test(value);

/**
 * Check a manifest's format as it arrives: v3, this repertoire, sync paths, sizes, hashes, and one size per hash
 * (two sizes for one hash can't both be true). Whether its blobs are in the bucket is the Worker's check. Never throws.
 */
export function checkManifest(value: unknown, repertoire: string): MediaManifest | null {
  if (!value || typeof value !== 'object') return null;
  const m = value as Record<string, unknown>;
  if (m.v !== 3 || m.repertoire !== repertoire || typeof m.updatedAtMs !== 'number' || !m.files || typeof m.files !== 'object' || Array.isArray(m.files)) return null;
  const sizes = new Map<string, number>();
  for (const [path, file] of Object.entries(m.files as Record<string, unknown>)) {
    const f = file as Partial<ManifestFile> | null;
    if (!isSyncPath(path) || !f || typeof f !== 'object' || !Number.isInteger(f.size) || (f.size as number) < 0 || (f.size as number) > MAX_SYNC_FILE_BYTES || !isSha256(f.sha256)) return null;
    if ((sizes.get(f.sha256) ?? f.size) !== f.size) return null;
    sizes.set(f.sha256, f.size as number);
  }
  return value as MediaManifest;
}

export const BLOBS_PREFIX = 'blobs/';
export const MANIFESTS_PREFIX = 'manifests/';
export const blobKey = (sha256: string): string => `${BLOBS_PREFIX}${sha256}`;
export const manifestKey = (repertoire: string): string => `${MANIFESTS_PREFIX}${repertoire}.json`;

/** The hash in a blob's key, or null for anything else. */
export function blobOfKey(key: string): string | null {
  const sha256 = key.startsWith(BLOBS_PREFIX) ? key.slice(BLOBS_PREFIX.length) : '';
  return isSha256(sha256) ? sha256 : null;
}

/** The repertoire in a manifest's key, or null for anything else. */
export function repertoireOfKey(key: string): string | null {
  const name = key.startsWith(MANIFESTS_PREFIX) && key.endsWith('.json') ? key.slice(MANIFESTS_PREFIX.length, -'.json'.length) : '';
  return isRepertoireName(name) ? name : null;
}

/** The blobs a manifest's files name, each once, by hash → size. */
export function namedBlobs(files: MediaManifest['files']): Map<string, number> {
  return new Map(Object.values(files).map((f) => [f.sha256, f.size]));
}

/** What has to move: files whose content differs, by sync path. */
export function changedFiles(from: MediaManifest['files'], to: MediaManifest['files']): string[] {
  return Object.keys(from)
    .filter((path) => to[path]?.sha256 !== from[path]?.sha256 || to[path]?.size !== from[path]?.size)
    .sort();
}

/** Whether two manifests list the same paths with the same contents. */
export function sameFiles(a: MediaManifest['files'], b: MediaManifest['files']): boolean {
  return Object.keys(a).length === Object.keys(b).length && changedFiles(a, b).length === 0;
}

/** The blobs `files` names that `have` lacks (or holds with another size), each once, sorted by hash. */
export function missingBlobs(files: MediaManifest['files'], have: ReadonlyMap<string, number>): BlobEntry[] {
  return [...namedBlobs(files)]
    .filter(([sha256, size]) => have.get(sha256) !== size)
    .map(([sha256, size]) => ({ sha256, size }))
    .sort((a, b) => (a.sha256 < b.sha256 ? -1 : 1));
}

/** The blobs no manifest names: what a prune deletes. Sorted by hash. */
export function unnamedBlobs(blobs: ReadonlyMap<string, number>, manifests: readonly Pick<MediaManifest, 'files'>[]): BlobEntry[] {
  const named = new Set(manifests.flatMap((m) => Object.values(m.files).map((f) => f.sha256)));
  return [...blobs]
    .filter(([sha256]) => !named.has(sha256))
    .map(([sha256, size]) => ({ sha256, size }))
    .sort((a, b) => (a.sha256 < b.sha256 ? -1 : 1));
}
