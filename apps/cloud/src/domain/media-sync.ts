// Media sync (C3): the show laptop pushes its prepared repertoire (decoded songs, stems, Signatures, analysis, covers,
// Hold and Interval music, effects) to a private R2 bucket, and a takeover laptop pulls it, so playback never depends on the
// internet on the night and a second laptop doesn't re-run the 30-minute pipeline. Pure rules shared by the
// Worker and the laptop: which folders, which paths, the manifest. Copyrighted audio only ever goes to the
// private bucket, through the laptop's Access service token; never to git, never public.

/** The folders synced, by name (laptop/media-sync.ts maps them to the repertoire's folders on disk). */
export const SYNC_ROOTS = ['cache', 'data', 'covers', 'overrides', 'cards', 'hold-cache', 'hold-data', 'interval-cache', 'interval-data', 'fx', 'stingers'] as const;
export type SyncRoot = (typeof SYNC_ROOTS)[number];

/** One file as the manifest lists it. */
export interface ManifestFile {
  size: number;
  /** Lowercase hex SHA-256 of the content. */
  sha256: string;
}

/** What a repertoire's media is, in the bucket: `repertoires/<repertoire>/manifest.json`. */
export interface MediaManifest {
  v: 2;
  repertoire: string;
  /** By sync path (`<root>/<relative path>`). */
  files: Record<string, ManifestFile>;
  updatedAtMs: number;
}

/** The largest file the Worker can take in one request on the Free plan (100 MB request bodies). */
export const MAX_SYNC_FILE_BYTES = 100 * 1000 * 1000;

const SEGMENT = /^[A-Za-z0-9._@+ -]{1,120}$/;

/** A sync path: `<root>/<segments>`, a known root, no `.`/`..` segments, plain file names only. */
export function isSyncPath(value: unknown): value is string {
  if (typeof value !== 'string' || value.length > 300) return false;
  const [root, ...rest] = value.split('/');
  if (!(SYNC_ROOTS as readonly string[]).includes(root ?? '') || rest.length === 0) return false;
  return rest.every((segment) => SEGMENT.test(segment) && segment !== '.' && segment !== '..' && !segment.startsWith('.'));
}

export const isSha256 = (value: unknown): value is string => typeof value === 'string' && /^[0-9a-f]{64}$/.test(value);

/** Check a manifest as it arrives. Never throws. */
export function checkManifest(value: unknown, repertoire: string): MediaManifest | null {
  if (!value || typeof value !== 'object') return null;
  const m = value as Record<string, unknown>;
  if (m.v !== 2 || m.repertoire !== repertoire || typeof m.updatedAtMs !== 'number' || !m.files || typeof m.files !== 'object') return null;
  const files = m.files as Record<string, unknown>;
  for (const [path, file] of Object.entries(files)) {
    const f = file as Partial<ManifestFile> | null;
    if (!isSyncPath(path) || !f || !Number.isInteger(f.size) || (f.size as number) < 0 || !isSha256(f.sha256)) return null;
  }
  return value as MediaManifest;
}

/** Each repertoire's folder in the bucket (D178: before, `pools/`, whose keys stay until deploy-plan step 6). */
export const REPERTOIRES_PREFIX = 'repertoires/';
export const manifestKey = (repertoire: string): string => `${REPERTOIRES_PREFIX}${repertoire}/manifest.json`;
export const fileKey = (repertoire: string, path: string): string => `${REPERTOIRES_PREFIX}${repertoire}/files/${path}`;

/** What has to move: files whose content differs, by sync path. */
export function changedFiles(from: MediaManifest['files'], to: MediaManifest['files']): string[] {
  return Object.keys(from)
    .filter((path) => to[path]?.sha256 !== from[path]?.sha256 || to[path]?.size !== from[path]?.size)
    .sort();
}
