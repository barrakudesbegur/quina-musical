// P3, the pre-verb render (D12): a song's first beat at a hook, reversed, convolved through a noise reverb
// (100% wet) and reversed back, so the reverb swells *into* the moment the hook's pickup starts (Kern Audio's
// reverse reverb). Rendered once per hook in an OfflineAudioContext when the song is decoded (about 0.1 s of
// CPU), and played by the incoming deck as a landing layer (Deck.playPreverb).
import { MOVES } from '../config.ts';
import { hookGrid } from '../plan/timeline.ts';
import type { Analysis } from '../analysis.ts';

export interface PreverbOptions {
  /** The excerpt: song seconds from `fromSec`, `durSec` long (the hook's pickup, one beat). */
  fromSec: number;
  durSec: number;
  /** The reverb's decay time (RT60) in seconds. */
  rt60: number;
  /** Fade-in at the swell's start, so it never starts cut off. */
  fadeInSec: number;
}

/** A stereo noise impulse response with an exponential decay (the graph's reverb, AudioGraph.impulseResponse). */
function noiseImpulse(ctx: BaseAudioContext, rt60: number): AudioBuffer {
  const length = Math.floor(ctx.sampleRate * rt60 * 1.2);
  const ir = ctx.createBuffer(2, length, ctx.sampleRate);
  for (let c = 0; c < 2; c++) {
    const data = ir.getChannelData(c);
    for (let i = 0; i < length; i++) {
      const t = i / ctx.sampleRate;
      data[i] = (Math.random() * 2 - 1) * Math.exp((-6.9 * t) / rt60) * (t < 0.01 ? t / 0.01 : 1);
    }
  }
  return ir;
}

/**
 * The swell: the reverb of the reversed excerpt, reversed back. Its last sample is where the excerpt's first
 * sample would sound, so playing it to end at the pickup (minus a breath) inhales into the hook.
 * @returns a buffer of the reverb's length (rt60 × 1.2)
 */
export async function renderPreverb(source: AudioBuffer, { fromSec, durSec, rt60, fadeInSec }: PreverbOptions): Promise<AudioBuffer> {
  const sr = source.sampleRate;
  const channels = Math.min(2, source.numberOfChannels);
  const from = Math.max(0, Math.round(fromSec * sr));
  const length = Math.max(1, Math.min(Math.round(durSec * sr), source.length - from));
  const tail = Math.floor(sr * rt60 * 1.2);
  const offline = new OfflineAudioContext(channels, length + tail, sr);
  // The excerpt reversed, its (reversed) start faded in over 5 ms so the cut does not click.
  const reversed = offline.createBuffer(channels, length, sr);
  const fade = Math.min(length, Math.round(0.005 * sr));
  for (let c = 0; c < channels; c++) {
    const input = source.getChannelData(c);
    const out = reversed.getChannelData(c);
    for (let n = 0; n < length; n++) out[n] = input[from + length - 1 - n] * (n < fade ? n / fade : 1);
  }
  const src = offline.createBufferSource();
  src.buffer = reversed;
  const convolver = offline.createConvolver();
  convolver.buffer = noiseImpulse(offline, rt60);
  src.connect(convolver).connect(offline.destination);
  src.start(0);
  const wet = await offline.startRendering();
  // Reverse it back and keep what comes before the excerpt's first sample: the swell.
  const swell = new AudioBuffer({ numberOfChannels: channels, length: tail, sampleRate: sr });
  const fadeIn = Math.max(1, Math.round(fadeInSec * sr));
  for (let c = 0; c < channels; c++) {
    const y = wet.getChannelData(c);
    const z = swell.getChannelData(c);
    const last = y.length - 1;
    for (let n = 0; n < tail; n++) z[n] = y[last - n] * (n < fadeIn ? n / fadeIn : 1);
  }
  return swell;
}

/** One song's renders: `promise` settles once every hook is rendered (or given up on). */
interface SongPreverbs {
  promise: Promise<void>;
  buffers: Map<string, AudioBuffer>;
}

export class PreverbStore {
  readonly songs = new Map<number, SongPreverbs>();

  /** Render the pre-verb of each valid best/main hook. Never rejects. */
  ensure(songId: number, analysis: Analysis, buffer: AudioBuffer): Promise<void> {
    let entry = this.songs.get(songId);
    if (!entry) {
      const created: SongPreverbs = { buffers: new Map(), promise: Promise.resolve() };
      created.promise = (async () => {
        for (const hook of analysis.hooks.filter((h) => h.valid && (h.tag === 'best' || h.tag === 'main'))) {
          const grid = hookGrid(analysis, hook);
          const pickup = Math.min(hook.pickupSec || 0, hook.downbeatSec);
          created.buffers.set(hook.id, await renderPreverb(buffer, {
            fromSec: hook.downbeatSec - pickup,
            durSec: grid.beat,
            rt60: MOVES.preverb.rt60Bars * grid.bar,
            fadeInSec: MOVES.preverb.fadeInSec,
          }));
        }
      })().catch((error: unknown) => console.warn('preverb', songId, error));
      this.songs.set(songId, created);
      entry = created;
    }
    return entry.promise;
  }

  /** What the planner may use: the hooks whose render is ready. */
  hooksFor(songId: number): string[] {
    return [...(this.songs.get(songId)?.buffers.keys() ?? [])];
  }

  /** The renders by hook id, for a Deck: the live map. */
  buffersFor(songId: number): ReadonlyMap<string, AudioBuffer> | null {
    return this.songs.get(songId)?.buffers ?? null;
  }

  retain(ids: readonly (number | null | undefined)[]): void {
    const keep = new Set(ids.filter((id) => id != null));
    for (const id of [...this.songs.keys()]) if (!keep.has(id)) this.songs.delete(id);
  }
}
