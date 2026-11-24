// The Interval playlist's JSON contract (written by tools/prep/interval.py, schema v1): data/interval/index.json
// lists the tracks in playlist order (a recording once), data/interval/<slug>.json holds each one's beat grid,
// loudness and edges. Every time is in the decoded FLAC's timeline (/intervalaudio/<slug>.flac). The engine
// checks every file as it loads; a track whose file fails the check is left out of the playlist. Pure.

export const INTERVAL_SCHEMA_VERSION = 1;

/** One track of the playlist, with the fields the engine reads. */
export interface IntervalTrack {
  slug: string;
  title: string;
  artist: string;
  /** Its place in the source playlist (spotDL's NN), or null. */
  position: number | null;
  sampleRate: number;
  durationSec: number;
  tempo: { bpm: number; beatsPerBar: number };
  beats: number[];
  downbeats: number[];
  /** Where the sound starts and ends, where its closing fade starts, and its first downbeat (null without a grid). */
  edges: { startSec: number; endSec: number; fadeStartSec: number; firstDownbeatSec: number | null };
  /** To the songs' loudness (−14 LUFS). */
  gainToTargetDb: number;
}

type JsonObject = { readonly [key: string]: unknown };
const isRecord = (x: unknown): x is JsonObject => typeof x === 'object' && x !== null && !Array.isArray(x);
const isNum = (x: unknown): x is number => typeof x === 'number' && Number.isFinite(x);
const isText = (x: unknown): x is string => typeof x === 'string' && x.length > 0;
const SLUG = /^[a-z0-9][a-z0-9-]{0,79}$/;

/** Ascending finite numbers. */
function sortedNumbers(x: unknown): x is number[] {
  if (!Array.isArray(x)) return false;
  let previous = -Infinity;
  for (const value of x) {
    if (!isNum(value) || value < previous) return false;
    previous = value;
  }
  return true;
}

/** @returns the slugs data/interval/index.json lists, in playlist order (an unreadable entry is skipped) */
export function intervalSlugs(index: unknown): string[] {
  if (!isRecord(index) || !Array.isArray(index.tracks)) throw new Error('data/interval/index.json: no tracks');
  const slugs = index.tracks.flatMap((t: unknown) => (isRecord(t) && typeof t.slug === 'string' && SLUG.test(t.slug) ? [t.slug] : []));
  return [...new Set(slugs)];
}

/** @returns problems; empty when the file is usable */
export function intervalTrackProblems(json: unknown, sampleRate?: number): string[] {
  if (!isRecord(json)) return ['not an object'];
  const problems: string[] = [];
  const { schemaVersion, slug, title, artist, position, durationSec, tempo, beats, downbeats, edges, loudness } = json;
  if (schemaVersion !== INTERVAL_SCHEMA_VERSION) problems.push(`schemaVersion ${String(schemaVersion)}`);
  if (typeof slug !== 'string' || !SLUG.test(slug)) problems.push('slug');
  if (!isText(title)) problems.push('title');
  if (typeof artist !== 'string') problems.push('artist');
  if (position != null && !Number.isInteger(position)) problems.push('position');
  if (!isNum(json.sampleRate) || (sampleRate != null && json.sampleRate !== sampleRate)) problems.push(`sampleRate ${String(json.sampleRate)}`);
  if (!isNum(durationSec) || durationSec <= 0) problems.push('durationSec');
  if (!isRecord(tempo) || !isNum(tempo.bpm) || tempo.bpm <= 0 || !Number.isInteger(tempo.beatsPerBar) || Number(tempo.beatsPerBar) < 1) problems.push('tempo');
  if (!sortedNumbers(beats)) problems.push('beats');
  if (!sortedNumbers(downbeats)) problems.push('downbeats');
  if (
    !isRecord(edges) || !isNum(edges.startSec) || !isNum(edges.endSec) || !isNum(edges.fadeStartSec) ||
    edges.endSec <= edges.startSec || (edges.firstDownbeatSec != null && !isNum(edges.firstDownbeatSec))
  ) problems.push('edges');
  if (!isRecord(loudness) || (loudness.gainToTargetDb != null && !isNum(loudness.gainToTargetDb))) problems.push('loudness');
  return problems;
}

/** The checked track; throws with its problems. `sampleRate`: the audio context's, which the grid must share. */
export function checkIntervalTrack(json: unknown, sampleRate?: number): IntervalTrack {
  const problems = intervalTrackProblems(json, sampleRate);
  if (problems.length || !isRecord(json)) throw new Error(`interval track: ${problems.join(', ')}`);
  // Checked field by field above.
  const t = json as unknown as {
    slug: string; title: string; artist: string; position?: number | null; sampleRate: number; durationSec: number;
    tempo: { bpm: number; beatsPerBar: number }; beats: number[]; downbeats: number[];
    edges: { startSec: number; endSec: number; fadeStartSec: number; firstDownbeatSec?: number | null };
    loudness: { gainToTargetDb?: number | null };
  };
  return {
    slug: t.slug,
    title: t.title,
    artist: t.artist,
    position: t.position ?? null,
    sampleRate: t.sampleRate,
    durationSec: t.durationSec,
    tempo: { bpm: t.tempo.bpm, beatsPerBar: t.tempo.beatsPerBar },
    beats: t.beats,
    downbeats: t.downbeats,
    edges: { startSec: t.edges.startSec, endSec: t.edges.endSec, fadeStartSec: t.edges.fadeStartSec, firstDownbeatSec: t.edges.firstDownbeatSec ?? null },
    gainToTargetDb: t.loudness.gainToTargetDb ?? 0,
  };
}
