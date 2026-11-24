// A Check's sound (show.ts CheckSnippetsEffect): each landed song's hook snippet (tools/prep/snippets.py cuts
// 3 s from its best hook's pickup, /snippets/<id>.flac, its loudness trim in data/snippets/index.json), or
// the "broken record" for a song that has not landed (in a standing Check, where not landing is the point, a
// short knock instead), at the step times the machine scheduled. Everything
// else (the songs, Hold music, the Celebration's loop) is ducked far down from the Check's start to its end.
import { brokenRecord } from './synth/broken.ts';
import { stillKnock } from './synth/still.ts';
import type { AudioGraph } from './graph.ts';
import type { TimedStep } from '../game/check.ts';

/** data/snippets/index.json (tools/prep/snippets.py): the fields read here. */
interface SnippetIndexEntry {
  id: number;
  gainDb: number;
}

const isRecord = (x: unknown): x is Record<string, unknown> => typeof x === 'object' && x !== null;
const isEntry = (x: unknown): x is SnippetIndexEntry => isRecord(x) && Number.isInteger(x.id) && typeof x.gainDb === 'number' && Number.isFinite(x.gainDb);

/** The snippets, decoded on demand (a Bingo's Check needs 12; a few dozen stay decoded). */
export class SnippetStore {
  readonly ctx: BaseAudioContext;
  readonly gains = new Map<number, number>();
  readonly buffers = new Map<number, Promise<AudioBuffer | null>>();
  private index: Promise<void> | null = null;
  static readonly KEEP = 36;

  constructor(ctx: BaseAudioContext) {
    this.ctx = ctx;
  }

  /** The loudness trims. Never rejects: without the index every snippet plays untrimmed. */
  loadIndex(): Promise<void> {
    this.index ??= (async () => {
      try {
        const response = await fetch('/data/snippets/index.json', { cache: 'no-store' });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const json: unknown = await response.json();
        const songs: unknown[] = isRecord(json) && Array.isArray(json.songs) ? json.songs : [];
        for (const s of songs) if (isEntry(s)) this.gains.set(s.id, s.gainDb);
      } catch (error) {
        console.warn('snippets index (run `npm run prep -- --steps snippets`)', error);
      }
    })();
    return this.index;
  }

  /** The decoded snippet, or null when the song has none. */
  get(songId: number): Promise<AudioBuffer | null> {
    let entry = this.buffers.get(songId);
    if (!entry) {
      entry = fetch(`/snippets/${songId}.flac`)
        .then(async (r) => (r.ok ? this.ctx.decodeAudioData(await r.arrayBuffer()) : null))
        .catch((error: unknown) => {
          console.warn('snippet', songId, error);
          return null;
        });
      this.buffers.set(songId, entry);
      // Oldest first: forget the oldest beyond KEEP.
      for (const id of [...this.buffers.keys()].slice(0, Math.max(0, this.buffers.size - SnippetStore.KEEP))) this.buffers.delete(id);
    }
    return entry;
  }
}

export interface CheckSound {
  claimId: string;
  steps: readonly TimedStep[];
  startAt: number;
  endAt: number;
  duckDb: number;
}

export interface CheckLevels {
  snippetDb: number;
  snippetFadeSec: number;
  brokenDb: number;
  stillDb: number;
  duckFadeSec: number;
}

/** Plays one Check at a time; a new one, or cancel(), stops the one before. */
export class CheckPlayer {
  readonly graph: AudioGraph;
  readonly snippets: SnippetStore;
  readonly levels: CheckLevels;
  private out: GainNode | null = null;
  private sources: AudioBufferSourceNode[] = [];
  claimId: string | null = null;

  constructor(graph: AudioGraph, snippets: SnippetStore, levels: CheckLevels) {
    this.graph = graph;
    this.snippets = snippets;
    this.levels = levels;
  }

  play({ claimId, steps, startAt, endAt, duckDb }: CheckSound): void {
    this.cancel();
    const { ctx } = this.graph;
    const out = ctx.createGain();
    out.connect(this.graph.checkBus);
    this.out = out;
    this.claimId = claimId;
    const fade = this.levels.duckFadeSec;
    const firstAt = steps[0]?.at ?? startAt;
    for (const node of [this.graph.checkDuck.music, this.graph.checkDuck.hold]) {
      this.graph.glide(node.gain, duckDb, fade, Math.max(startAt, firstAt - fade));
      node.gain.setValueAtTime(10 ** (duckDb / 20), Math.max(endAt - fade, firstAt));
      node.gain.linearRampToValueAtTime(1, endAt + fade);
    }
    void this.snippets.loadIndex();
    for (const step of steps) {
      if (step.sound === 'snippet') void this.playSnippet(out, step);
      else if (step.sound === 'still') stillKnock(ctx, out, { t0: step.at, levelDb: this.levels.stillDb });
      else brokenRecord(ctx, out, { t0: step.at, durationSec: step.durationSec, levelDb: this.levels.brokenDb });
    }
  }

  private async playSnippet(out: GainNode, { songId, at, durationSec }: TimedStep): Promise<void> {
    const [buffer] = await Promise.all([this.snippets.get(songId), this.snippets.loadIndex()]);
    const { ctx } = this.graph;
    // Too late (a slow decode) or cancelled meanwhile: the projector still reveals the mark.
    if (!buffer || this.out !== out || ctx.currentTime > at + durationSec * 0.5) return;
    const start = Math.max(at, ctx.currentTime + 0.01);
    const offset = start - at;
    const stopAt = at + Math.min(durationSec, buffer.duration);
    const fade = Math.min(this.levels.snippetFadeSec, (stopAt - start) / 2);
    const level = 10 ** (((this.snippets.gains.get(songId) ?? 0) + this.levels.snippetDb) / 20);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0, start);
    gain.gain.linearRampToValueAtTime(level, start + 0.01);
    gain.gain.setValueAtTime(level, stopAt - fade);
    gain.gain.linearRampToValueAtTime(0, stopAt);
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.connect(gain).connect(out);
    source.start(start, offset);
    source.stop(stopAt + 0.02);
    this.sources.push(source);
  }

  /** Stop the Check's sounds now and bring everything else back up. */
  cancel(): void {
    const out = this.out;
    if (!out) return;
    const { ctx } = this.graph;
    const now = ctx.currentTime;
    out.gain.setValueAtTime(out.gain.value, now);
    out.gain.linearRampToValueAtTime(0, now + 0.08);
    for (const s of this.sources) {
      try {
        s.stop(now + 0.1);
      } catch {}
    }
    setTimeout(() => out.disconnect(), 400);
    for (const node of [this.graph.checkDuck.music, this.graph.checkDuck.hold]) this.graph.glide(node.gain, 0, this.levels.duckFadeSec);
    this.out = null;
    this.sources = [];
    this.claimId = null;
  }
}
