// The throw song (D138): its own track (data/media/throw/, decoded by tools/prep/hold.py into /holdaudio/<name>.flac)
// played from a given point at full volume on the throws slider, while the break music fades out under it, and back
// when it stops or ends. A stop keeps nothing: the machine knows where it stopped and plays it again from there.
import { THROW } from '../config.ts';
import type { AudioGraph } from './graph.ts';

interface ThrowVoice {
  source: AudioBufferSourceNode;
  gain: GainNode;
  startAt: number;
  offsetSec: number;
}

export class ThrowPlayer {
  readonly graph: AudioGraph;
  /** The break music's level under it (the breaks' and the end's sets, graph.intervalBus). */
  readonly under: AudioParam;
  /** The song played to its end (not stopped). */
  onEnded: (() => void) | null = null;
  private buffer: Promise<AudioBuffer | null> | null = null;
  private voice: ThrowVoice | null = null;

  constructor(graph: AudioGraph) {
    this.graph = graph;
    this.under = graph.intervalBus.gain;
  }

  /** Decode the track once (a slow first tap would start late). Null when it can't be had. */
  load(): Promise<AudioBuffer | null> {
    this.buffer ??= fetch(`/holdaudio/${encodeURIComponent(THROW.name)}.flac`)
      .then(async (r) => (r.ok ? this.graph.ctx.decodeAudioData(await r.arrayBuffer()) : null))
      .catch((error: unknown) => {
        console.warn('throw song', error);
        this.buffer = null;
        return null;
      });
    return this.buffer;
  }

  get playing(): boolean {
    return this.voice != null;
  }

  /** Play from `offsetSec` at `at`, at full volume; the break music fades out under it. */
  async play(at: number, offsetSec: number): Promise<void> {
    const buffer = await this.load();
    const { ctx } = this.graph;
    if (!buffer) return;
    this.stopVoice(ctx.currentTime, 0.05);
    const when = Math.max(at, ctx.currentTime + 0.02);
    const offset = Math.min(Math.max(0, offsetSec + (when - at)), buffer.duration);
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0, when);
    gain.gain.linearRampToValueAtTime(10 ** (THROW.trimDb / 20), when + THROW.fadeSec);
    source.connect(gain).connect(this.graph.vol.throws);
    source.start(when, offset);
    const voice: ThrowVoice = { source, gain, startAt: when, offsetSec: offset };
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
  suspend(at: number, fadeSec: number): number | null {
    const voice = this.voice;
    if (!voice) return null;
    const t = Math.max(at, this.graph.ctx.currentTime);
    const pos = voice.offsetSec + (t - voice.startAt);
    this.stopVoice(t, fadeSec);
    return pos;
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
