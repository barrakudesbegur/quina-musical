// P3, the pre-verb render (D12): a song's first beat at a hook, reversed, convolved through a noise reverb
// (100% wet) and reversed back, so the reverb swells *into* the moment the hook's pickup starts (Kern Audio's
// reverse reverb). Rendered once per hook in an OfflineAudioContext when the song is decoded (about 0.1 s of
// CPU), and played by the incoming deck as a landing layer (Deck.playPreverb). Once the song's stems are decoded,
// a second render per hook comes from its vocal stem (its first word, not the chord).
import { MOVES } from '../config.ts';
import { hookGrid } from '../plan/timeline.ts';
import type { Analysis, Hook } from '../analysis.ts';
import type { PreverbSource } from '../plan/events.ts';
import type { StemSlices } from './stems.ts';

/** The key of a hook's render in a song's map (Deck.preverbs): the mix's is the hook id itself. */
export const preverbKey = (hookId: string, source: PreverbSource = 'mix'): string => (source === 'mix' ? hookId : `${hookId}:${source}`);

export interface PreverbOptions {
  /** The excerpt: song seconds from `fromSec`, `durSec` long (the hook's pickup, one beat). */
  fromSec: number;
  durSec: number;
  /** The reverb's decay time (RT60) in seconds. */
  rt60: number;
  /** Fade-in at the swell's start, so it never starts cut off. */
  fadeInSec: number;
  /** Gain on the excerpt (a stem stored at half scale renders at full scale with 2). */
  gain?: number;
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
export async function renderPreverb(source: AudioBuffer, { fromSec, durSec, rt60, fadeInSec, gain = 1 }: PreverbOptions): Promise<AudioBuffer> {
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
    for (let n = 0; n < length; n++) out[n] = gain * input[from + length - 1 - n] * (n < fade ? n / fade : 1);
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

/** One song's renders, by preverbKey: `promise` settles once every hook is rendered (or given up on); `vocals` once
 * the vocal renders are. */
interface SongPreverbs {
  promise: Promise<void>;
  vocals: Promise<void> | null;
  buffers: Map<string, AudioBuffer>;
}

/** The hooks a pre-verb is rendered for: the valid best and main ones. */
const renderedHooks = (analysis: Analysis): Hook[] => analysis.hooks.filter((h) => h.valid && (h.tag === 'best' || h.tag === 'main'));

/** The excerpt for a hook: its pickup, one beat, and the reverb's length. */
function excerpt(analysis: Analysis, hook: Hook): { fromSec: number; durSec: number; rt60: number } {
  const grid = hookGrid(analysis, hook);
  const pickup = Math.min(hook.pickupSec || 0, hook.downbeatSec);
  return { fromSec: hook.downbeatSec - pickup, durSec: grid.beat, rt60: MOVES.preverb.rt60Bars * grid.bar };
}

export class PreverbStore {
  readonly songs = new Map<number, SongPreverbs>();

  /** Render the pre-verb of each valid best/main hook. Never rejects. */
  ensure(songId: number, analysis: Analysis, buffer: AudioBuffer): Promise<void> {
    let entry = this.songs.get(songId);
    if (!entry) {
      const created: SongPreverbs = { buffers: new Map(), promise: Promise.resolve(), vocals: null };
      created.promise = (async () => {
        for (const hook of renderedHooks(analysis)) {
          created.buffers.set(preverbKey(hook.id), await renderPreverb(buffer, { ...excerpt(analysis, hook), fadeInSec: MOVES.preverb.fadeInSec }));
        }
      })().catch((error: unknown) => console.warn('preverb', songId, error));
      this.songs.set(songId, created);
      entry = created;
    }
    return entry.promise;
  }

  /**
   * D12 from B's voice: render each hook's pre-verb from its vocal stem too, once the stems around it are decoded
   * (`stemsFor`, StemStore.forHook). Hooks whose stems do not cover the excerpt are skipped. Never rejects.
   */
  ensureVocals(songId: number, analysis: Analysis, stemsFor: (hookId: string) => StemSlices | null): Promise<void> {
    const entry = this.songs.get(songId);
    if (!entry) return Promise.resolve();
    entry.vocals ??= (async () => {
      await entry.promise;
      for (const hook of renderedHooks(analysis)) {
        const stems = stemsFor(hook.id);
        const vocals = stems?.buffers.vocals;
        if (!stems || !vocals) continue;
        const cut = excerpt(analysis, hook);
        const fromSec = cut.fromSec - stems.startSec;
        if (fromSec < 0 || fromSec + cut.durSec > vocals.duration) continue;
        entry.buffers.set(preverbKey(hook.id, 'vocals'), await renderPreverb(vocals, { ...cut, fromSec, gain: stems.scale, fadeInSec: MOVES.preverb.fadeInSec }));
      }
    })().catch((error: unknown) => console.warn('preverb vocals', songId, error));
    return entry.vocals;
  }

  /** What the planner may use: the hooks whose render of the mix is ready. */
  hooksFor(songId: number): string[] {
    return [...(this.songs.get(songId)?.buffers.keys() ?? [])].filter((key) => !key.includes(':'));
  }

  /** The hooks whose render of the vocals is ready (D12 from B's voice). */
  vocalHooksFor(songId: number): string[] {
    const suffix = preverbKey('', 'vocals');
    return [...(this.songs.get(songId)?.buffers.keys() ?? [])].filter((key) => key.endsWith(suffix)).map((key) => key.slice(0, -suffix.length));
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
