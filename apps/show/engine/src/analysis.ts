// The analysis JSON contract (written by tools/prep/analyze.py, schema v1). The engine checks every file as
// it loads; a song whose analysis fails the check is left out of the round instead of breaking a landing.

export const ANALYSIS_SCHEMA_VERSION = 1;

/** A hook of a song: the downbeat a landing puts at T, and the pickup before it. */
export interface Hook {
  id: string;
  tag: string;
  valid: boolean;
  downbeatSec: number;
  downbeatIndex: number;
  pickupSec: number;
  barSecLocal?: number;
  gainToTargetDb?: number;
  issues?: string[];
}

/** One song's analysis (data/analysis/<id>.json), with the fields the engine reads. */
export interface Analysis {
  schemaVersion: number;
  songId: number;
  title: string;
  artist: string;
  source: { durationSec: number; sampleRate: number };
  /** `isStable`: the bars keep one tempo (not checked; the planner tests read it). */
  tempo: { bpm: number; beatsPerBar: number; barSecMedian: number; isStable?: boolean };
  beats: number[];
  downbeats: number[];
  hooks: Hook[];
  loudness?: { gainToTargetDb?: number };
  volume?: number;
  flags?: string[];
}

/** A song as data/analysis/index.json lists it. */
export interface IndexSong {
  id: number;
  title: string;
  artist: string;
  excluded: boolean;
  hooks: { id: string; valid: boolean }[];
}

/** Untrusted JSON: a plain object whose fields are still to be checked. */
type JsonObject = { readonly [key: string]: unknown };

const isRecord = (x: unknown): x is JsonObject => typeof x === 'object' && x !== null;
const isArray = (x: unknown): x is readonly unknown[] => Array.isArray(x);
const isNum = (x: unknown): x is number => typeof x === 'number' && Number.isFinite(x);
// `every` stops at the first miss, so the previous value is always a checked number.
const sorted = (a: readonly unknown[]) =>
  a.every((x, i) => {
    const previous = a[i - 1];
    return isNum(x) && (i === 0 || (isNum(previous) && x >= previous));
  });

/** @returns problems; empty when the file is usable */
export function analysisProblems(a: unknown): string[] {
  const problems: string[] = [];
  if (!isRecord(a)) return ['not an object'];
  const source: JsonObject = isRecord(a.source) ? a.source : {};
  const tempo: JsonObject = isRecord(a.tempo) ? a.tempo : {};
  if (a.schemaVersion !== ANALYSIS_SCHEMA_VERSION) problems.push(`schemaVersion ${a.schemaVersion}`);
  if (!Number.isInteger(a.songId)) problems.push('songId');
  if (!isNum(source.durationSec) || source.durationSec <= 0) problems.push('source.durationSec');
  if (!isNum(tempo.bpm) || !isNum(tempo.barSecMedian) || !Number.isInteger(tempo.beatsPerBar)) problems.push('tempo');
  if (!isArray(a.beats) || !sorted(a.beats)) problems.push('beats');
  if (!isArray(a.downbeats) || a.downbeats.length < 2 || !sorted(a.downbeats)) problems.push('downbeats');
  if (!isArray(a.hooks)) problems.push('hooks');
  else {
    const usable = a.hooks.filter((h) => isRecord(h) && h.valid && isNum(h.downbeatSec) && Number.isInteger(h.downbeatIndex) && isNum(h.pickupSec ?? 0));
    if (!usable.length) problems.push('no valid hook');
  }
  return problems;
}

/** The analysis, typed, or an Error naming every problem. */
export function checkAnalysis(a: unknown): Analysis {
  const problems = analysisProblems(a);
  if (problems.length) throw new Error(`analysis ${(isRecord(a) ? a.songId : undefined) ?? '?'}: ${problems.join(', ')}`);
  return a as Analysis; // analysisProblems checked every field the engine relies on
}

/** The songs a round may use: in the index, not excluded, with at least one valid hook. */
export function playableSongs(index: unknown): IndexSong[] {
  if (!isRecord(index) || index.schemaVersion !== ANALYSIS_SCHEMA_VERSION || !isArray(index.songs)) throw new Error('analysis index: bad schema');
  // The id and hooks are checked; the rest of each entry is trusted (analyze.py writes the index).
  return index.songs.filter((s): s is IndexSong => isRecord(s) && Number.isInteger(s.id) && !s.excluded && isArray(s.hooks) && s.hooks.some((h) => isRecord(h) && Boolean(h.valid)));
}

/** A stored stem window of a song (cache/<id>/stems/<stem>.<startSample>.flac). */
export interface StemWindow {
  startSample: number;
  lengthSamples: number;
  startSec: number;
  endSec: number;
}

/**
 * Stems written by tools/prep/stems.py (data/stems/<id>.json): drums, bass and vocals, stored at `stemGain`
 * scale in windows of the song (cache/<id>/stems/<stem>.<startSample>.flac); "other" = mix − the rest.
 */
export interface StemsMeta {
  schemaVersion: number;
  songId: number;
  sampleRate: number;
  stems: string[];
  stemGain: number;
  windows: StemWindow[];
  bars?: Record<string, number[]>;
}

/** The fields the engine reads are there and sane (the rest is trusted: stems.py writes the file). */
function isStemsMeta(m: unknown): m is StemsMeta {
  if (!isRecord(m) || m.schemaVersion !== 1 || !Number.isInteger(m.songId) || m.sampleRate !== 48000) return false;
  if (!isArray(m.stems) || !isNum(m.stemGain) || m.stemGain <= 0 || !isArray(m.windows)) return false;
  return m.windows.every((w) => isRecord(w) && Number.isInteger(w.startSample) && isNum(w.startSec) && isNum(w.endSec) && w.endSec > w.startSec);
}

/** @returns the metadata when it is usable, else null */
export function checkStemsMeta(m: unknown): StemsMeta | null {
  return isStemsMeta(m) ? m : null;
}

/** The stored window that covers [fromSec, toSec] of the song, if any. */
export function stemWindowFor(meta: StemsMeta, fromSec: number, toSec: number): StemWindow | null {
  return meta.windows.find((w) => w.startSec <= fromSec + 1e-6 && w.endSec >= toSec - 1e-6) ?? null;
}

// ---- Signatures (data/signatures/<id>.json, written by tools/prep/signatures.py) ---------------------------
export type SignatureKind = 'call' | 'riff' | 'shout';

/**
 * One Signature candidate: a short, iconic, isolated piece of the song, cut to its own file
 * (`/signatures/<songId>/<id>.flac`). `anchorSec` is where its first downbeat (or its attack, for a shout)
 * falls inside that file: the engine lines that moment up with a beat. Only `approved: true` ones play.
 */
export interface SignatureMeta {
  id: string;
  kind: SignatureKind;
  /** Which part it was cut from. */
  stem: 'vocals' | 'other' | 'drums' | 'bass' | 'mix';
  /** Where it was cut from the song (for the audition page). */
  startSec: number;
  endSec: number;
  /** Length of its file. */
  durationSec: number;
  anchorSec: number;
  beats: number;
  bpm: number;
  /** Brings it to the loudness target. */
  gainDb: number;
  score: number;
  /** null until someone decides on the audition page. */
  approved: boolean | null;
}

export interface SignaturesMeta {
  schemaVersion: 1;
  songId: number;
  sampleRate: number;
  signatures: SignatureMeta[];
}

const SIGNATURE_KINDS: readonly string[] = ['call', 'riff', 'shout'];
const SIGNATURE_STEMS: readonly string[] = ['vocals', 'other', 'drums', 'bass', 'mix'];
const finite = (x: unknown): x is number => typeof x === 'number' && Number.isFinite(x);

function isSignatureMeta(s: unknown): s is SignatureMeta {
  if (!s || typeof s !== 'object') return false;
  const r = s as Record<string, unknown>;
  return typeof r.id === 'string' && /^\d+-[a-z]+-\d+$/.test(r.id) && typeof r.kind === 'string' && SIGNATURE_KINDS.includes(r.kind) &&
    typeof r.stem === 'string' && SIGNATURE_STEMS.includes(r.stem) && finite(r.startSec) && finite(r.endSec) &&
    finite(r.durationSec) && r.durationSec > 0 && finite(r.anchorSec) && r.anchorSec >= 0 && r.anchorSec < r.durationSec &&
    finite(r.beats) && r.beats > 0 && finite(r.bpm) && r.bpm > 0 && finite(r.gainDb) && finite(r.score) &&
    (r.approved === null || typeof r.approved === 'boolean');
}

/** The file's Signatures, or null when it is not a schema-1 Signatures file. Malformed entries are dropped. */
export function checkSignaturesMeta(m: unknown): SignaturesMeta | null {
  if (!m || typeof m !== 'object') return null;
  const r = m as Record<string, unknown>;
  if (r.schemaVersion !== 1 || !Number.isInteger(r.songId) || !finite(r.sampleRate) || !Array.isArray(r.signatures)) return null;
  return { schemaVersion: 1, songId: r.songId as number, sampleRate: r.sampleRate, signatures: r.signatures.filter(isSignatureMeta) };
}
