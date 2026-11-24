// Fetch + decode songs (FLAC, decoded once by the browser) and their analysis, with a sliding window
// so only a handful of decoded songs (≈92 MB each for 4 minutes at 48 kHz stereo float32) stay in memory.
// Every analysis is checked against the contract in analysis.ts before it is used.
import { checkAnalysis } from '../analysis.ts';
import type { Analysis } from '../analysis.ts';

/** JSON fetched at run time: unknown until a checker has looked at it. */
export async function fetchJson(url: string): Promise<unknown> {
  const response = await fetch(url, { cache: 'no-store' });
  if (!response.ok) throw new Error(`${url}: HTTP ${response.status}`);
  return response.json();
}

/** A JSON object (not null); its fields are still unknown. */
export const isRecord = (x: unknown): x is Record<string, unknown> => typeof x === 'object' && x !== null;

/** A decoded song with its checked analysis. */
export interface DecodedSong {
  buffer: AudioBuffer;
  analysis: Analysis;
}

/** A song in the window: `song` is null until it is decoded; `promise` settles then (or fails). */
interface SongEntry {
  promise: Promise<DecodedSong>;
  song: DecodedSong | null;
}

export interface SongUrls {
  audioUrl?: (id: number) => string;
  analysisUrl?: (id: number) => string;
}

export class SongLoader {
  ctx: BaseAudioContext;
  audioUrl: (id: number) => string;
  analysisUrl: (id: number) => string;
  entries: Map<number, SongEntry>;

  constructor(ctx: BaseAudioContext, { audioUrl = (id) => `/audio/${id}.flac`, analysisUrl = (id) => `/analysis/${id}.json` }: SongUrls = {}) {
    this.ctx = ctx;
    this.audioUrl = audioUrl;
    this.analysisUrl = analysisUrl;
    this.entries = new Map(); // id → { promise, song }
  }

  // Resolves to { buffer, analysis } once decoded; repeated calls share the same promise.
  ensure(id: number): Promise<DecodedSong> {
    let entry = this.entries.get(id);
    if (!entry) {
      const created: SongEntry = {
        song: null,
        promise: Promise.all([
          fetch(this.audioUrl(id)).then((r) => {
            if (!r.ok) throw new Error(`audio ${id}: HTTP ${r.status}`);
            return r.arrayBuffer();
          }),
          fetchJson(this.analysisUrl(id)),
        ]).then(async ([bytes, json]) => {
          const analysis = checkAnalysis(json);
          const song = { buffer: await this.ctx.decodeAudioData(bytes), analysis };
          created.song = song;
          return song;
        }),
      };
      created.promise.catch(() => this.entries.delete(id));
      this.entries.set(id, created);
      entry = created;
    }
    return entry.promise;
  }

  isReady(id: number): boolean {
    return Boolean(this.entries.get(id)?.song);
  }

  get(id: number): DecodedSong | null {
    return this.entries.get(id)?.song ?? null;
  }

  // Keep only the given ids decoded.
  retain(ids: readonly (number | null | undefined)[]): void {
    const keep = new Set(ids.filter((id) => id != null));
    for (const id of [...this.entries.keys()]) if (!keep.has(id)) this.entries.delete(id);
  }

  decodedMB(): number {
    let bytes = 0;
    for (const { song } of this.entries.values()) if (song) bytes += song.buffer.length * song.buffer.numberOfChannels * 4;
    return Math.round(bytes / 1e6);
  }
}
