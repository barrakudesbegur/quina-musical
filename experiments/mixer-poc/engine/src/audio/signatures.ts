// Approved Signatures of the songs around the current position, decoded ahead of time so a transition can
// layer them (planner signatureLayer). Only `approved: true` candidates (audition page) are loaded.
import { checkSignaturesMeta } from '../analysis.ts';
import type { SignatureSource } from '../plan/planner.ts';

/** One song's Signatures: `promise` settles once they are decoded (or given up on). */
interface SongSignatures {
  promise: Promise<void>;
  sources: SignatureSource[];
  buffers: Map<string, AudioBuffer>;
}

export class SignatureStore {
  readonly ctx: BaseAudioContext;
  readonly songs = new Map<number, SongSignatures>();

  constructor(ctx: BaseAudioContext) {
    this.ctx = ctx;
  }

  /** Decode the song's approved Signatures. Never rejects: a song without any just gets none. */
  ensure(songId: number): Promise<void> {
    let entry = this.songs.get(songId);
    if (!entry) {
      const created: SongSignatures = { sources: [], buffers: new Map(), promise: Promise.resolve() };
      created.promise = this.load(songId, created).catch((error: unknown) => console.warn('signatures', songId, error));
      this.songs.set(songId, created);
      entry = created;
    }
    return entry.promise;
  }

  private async load(songId: number, entry: SongSignatures): Promise<void> {
    const response = await fetch(`/data/signatures/${songId}.json`, { cache: 'no-store' });
    if (!response.ok) return; // no Signatures prepared for this song
    const meta = checkSignaturesMeta(await response.json());
    if (!meta || meta.songId !== songId) return;
    for (const s of meta.signatures) {
      if (s.approved !== true) continue;
      const file = await fetch(`/signatures/${songId}/${s.id}.flac`);
      if (!file.ok) continue;
      entry.buffers.set(s.id, await this.ctx.decodeAudioData(await file.arrayBuffer()));
      entry.sources.push({ id: s.id, kind: s.kind, durationSec: s.durationSec, anchorSec: s.anchorSec, beats: s.beats, bpm: s.bpm, gainDb: s.gainDb });
    }
  }

  /** What the planner may use: the decoded, approved ones (empty until they are decoded). */
  summary(songId: number): SignatureSource[] {
    return [...(this.songs.get(songId)?.sources ?? [])];
  }

  /** The decoded audio by id, for a Deck: the live map, so ones decoded after the deck started still play. */
  buffersFor(songId: number): ReadonlyMap<string, AudioBuffer> | null {
    return this.songs.get(songId)?.buffers ?? null;
  }

  retain(ids: readonly (number | null | undefined)[]): void {
    const keep = new Set(ids.filter((id) => id != null));
    for (const id of [...this.songs.keys()]) if (!keep.has(id)) this.songs.delete(id);
  }
}
