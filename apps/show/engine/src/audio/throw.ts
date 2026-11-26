// The throw songs (D138, D151): their tracks (data/media/throw/, decoded by tools/prep/hold.py into
// /holdaudio/<name>.flac) played from a given point at full volume on the throws slider, while the scene's music (the
// breaks' or the end's set) fades out under them, and back when they stop or end. A stop keeps nothing: the machine
// knows where it stopped and plays it again from there.
import { THROW } from '../config.ts';
import type { AudioGraph } from './graph.ts';

/** Which track, and its loudness trim (config.ts THROW.songs). */
export interface ThrowTrackRef {
  name: string;
  trimDb: number;
}

interface ThrowVoice {
  source: AudioBufferSourceNode;
  gain: GainNode;
  startAt: number;
  offsetSec: number;
  track: ThrowTrackRef;
}

export class ThrowPlayer {
  readonly graph: AudioGraph;
  /** The scene's music under it (graph.throwDuck: the songs, the sets, Hold music, the Celebration's). */
  readonly under: AudioParam;
  /** The song played to its end (not stopped). */
  onEnded: (() => void) | null = null;
  private readonly buffers = new Map<string, Promise<AudioBuffer | null>>();
  private voice: ThrowVoice | null = null;

  constructor(graph: AudioGraph) {
    this.graph = graph;
    this.under = graph.throwDuck.gain;
  }

  /** Decode a track once (a slow first tap would start late). Null when it can't be had. */
  load(name: string): Promise<AudioBuffer | null> {
    let entry = this.buffers.get(name);
    if (!entry) {
      entry = fetch(`/holdaudio/${encodeURIComponent(name)}.flac`)
        .then(async (r) => (r.ok ? this.graph.ctx.decodeAudioData(await r.arrayBuffer()) : null))
        .catch((error: unknown) => {
          console.warn('throw song', name, error);
          this.buffers.delete(name);
          return null;
        });
      this.buffers.set(name, entry);
    }
    return entry;
  }

  get playing(): boolean {
    return this.voice != null;
  }

  /** Play `track` from `offsetSec` at `at`, at full volume; the scene's music fades out under it. */
  async play(at: number, offsetSec: number, track: ThrowTrackRef): Promise<void> {
    const buffer = await this.load(track.name);
    const { ctx } = this.graph;
    if (!buffer) return;
    this.stopVoice(ctx.currentTime, 0.05);
    const when = Math.max(at, ctx.currentTime + 0.02);
    const offset = Math.min(Math.max(0, offsetSec + (when - at)), buffer.duration);
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0, when);
    gain.gain.linearRampToValueAtTime(10 ** (track.trimDb / 20), when + THROW.fadeSec);
    source.connect(gain).connect(this.graph.vol.throws);
    source.start(when, offset);
    const voice: ThrowVoice = { source, gain, startAt: when, offsetSec: offset, track };
    source.onended = () => {
      if (this.voice !== voice) return;
      this.voice = null;
      this.breakBack();
      this.onEnded?.();
    };
    this.voice = voice;
    this.graph.glide(this.under, -80, THROW.breakFadeOutSec, when);
  }

  /** Pausa (D128): it fades out from `at`; returns where it was then, or null when it isn't playing. The break music
   * stays down: it's saved by Pausa too. */
  suspend(at: number, fadeSec: number): { posSec: number; track: ThrowTrackRef } | null {
    const voice = this.voice;
    if (!voice) return null;
    const t = Math.max(at, this.graph.ctx.currentTime);
    const posSec = voice.offsetSec + (t - voice.startAt);
    this.stopVoice(t, fadeSec);
    return { posSec, track: voice.track };
  }

  /** Stop it (a tap, or Pausa): the break music fades back. */
  stop(at: number = this.graph.ctx.currentTime, fadeSec: number = THROW.fadeSec): void {
    if (!this.voice) return;
    this.stopVoice(at, fadeSec);
    this.breakBack(at);
  }

  private stopVoice(at: number, fadeSec: number): void {
    const voice = this.voice;
    if (!voice) return;
    this.voice = null;
    const t = Math.max(at, this.graph.ctx.currentTime);
    voice.gain.gain.cancelScheduledValues(t);
    voice.gain.gain.setValueAtTime(voice.gain.gain.value, t);
    voice.gain.gain.linearRampToValueAtTime(0, t + fadeSec);
    try {
      voice.source.stop(t + fadeSec + 0.02);
    } catch {}
    setTimeout(() => voice.gain.disconnect(), (t - this.graph.ctx.currentTime + fadeSec) * 1000 + 300);
  }

  private breakBack(at: number = this.graph.ctx.currentTime): void {
    this.graph.glide(this.under, 0, THROW.breakFadeInSec, at);
  }
}
