// A sprite of touch sounds on the platform's Web Audio (D207: our own player, not howler): the surface's one MP3 is
// fetched when the page is idle, decoded once the first touch has unlocked the audio context, and each play starts
// a slice of the decoded buffer. A tap's handler only starts that slice: no fetch, no decode, so the tap stays
// quick (INP). Nothing here decides *whether* to play, except the voices: logic.ts `mayPlay` does, through `gate`.
import { admitVoice, bendRates, pickSample, playedMs, rateFor, type Voice } from './logic.ts';
import type { SpriteMap, TouchClass, TouchVariant } from './types.ts';

export interface SpritePlayerOptions {
  /** The sprite's URL (a bundled asset, served by the page's own host: no CDN). */
  url: string;
  map: SpriteMap;
  /** Whether a touch sound may play now (the switch, the hidden page, the show laptop, a cue playing). */
  gate: () => boolean;
  random?: () => number;
}

export class SpritePlayer {
  private bytes: Promise<ArrayBuffer | null> | null = null;
  private buffer: AudioBuffer | null = null;
  private decoding: Promise<void> | null = null;
  private voices: (Voice & { node: AudioBufferSourceNode })[] = [];
  private readonly last = new Map<string, number>();
  private readonly random: () => number;
  private readonly options: SpritePlayerOptions;

  constructor(options: SpritePlayerOptions) {
    this.options = options;
    this.random = options.random ?? Math.random;
  }

  /** Whether the sprite is decoded and ready to play. */
  get ready(): boolean {
    return this.buffer !== null;
  }

  /** Fetch the file's bytes, at low priority, once the page is idle (call after the first paint). */
  prefetch(): void {
    this.bytes ??= fetch(this.options.url, { priority: 'low' })
      .then((r) => (r.ok ? r.arrayBuffer() : null))
      .catch(() => null);
  }

  /** Decode the sprite into the context (once the first touch unlocked it). A failure leaves the page silent. */
  attach(ctx: AudioContext): Promise<void> {
    this.prefetch();
    this.decoding ??= (this.bytes ?? Promise.resolve(null))
      .then((bytes) => (bytes ? ctx.decodeAudioData(bytes) : null))
      .then((buffer) => {
        this.buffer = buffer;
      })
      .catch(() => {
        this.buffer = null;
      });
    return this.decoding;
  }

  /** Play one of the class's samples for the variant, if it has one and the gate allows. */
  play(ctx: AudioContext | null, cls: TouchClass, variant: TouchVariant): boolean {
    const sprite = this.options.map.classes[cls];
    const samples = sprite?.[variant]?.at;
    const buffer = this.buffer;
    if (!ctx || !buffer || !sprite || !samples?.length || ctx.state !== 'running' || !this.options.gate()) return false;
    const now = ctx.currentTime;
    const key = `${cls}:${variant}`;
    const decision = admitVoice(this.voices, key, now * 1000);
    if (!decision.play) return false;
    for (const i of decision.stop) {
      try {
        this.voices[i].node.stop();
      } catch {
        // Already ended.
      }
    }
    this.voices = this.voices.filter((v, i) => !decision.stop.includes(i) && v.endMs > now * 1000);

    const index = pickSample(samples.length, this.last.get(key) ?? null, this.random);
    this.last.set(key, index);
    const [startMs, lengthMs] = samples[index];
    const [from, to] = bendRates(rateFor(sprite.rate, this.random), sprite.bend);
    const playMs = playedMs(lengthMs, from, to);

    const node = ctx.createBufferSource();
    node.buffer = buffer;
    node.playbackRate.setValueAtTime(from, now);
    if (to !== from) node.playbackRate.linearRampToValueAtTime(to, now + playMs / 1000);
    const gain = ctx.createGain();
    gain.gain.value = this.options.map.gain;
    node.connect(gain).connect(ctx.destination);
    // `duration` counts the buffer's own time, whatever the rate.
    node.start(now, startMs / 1000, lengthMs / 1000);
    const voice = { key, startMs: now * 1000, endMs: now * 1000 + playMs, node };
    this.voices.push(voice);
    node.onended = () => {
      node.disconnect();
      gain.disconnect();
      this.voices = this.voices.filter((v) => v !== voice);
    };
    return true;
  }
}

/**
 * Safari's Audio Session API, where it exists: "ambient" makes the iPhone's silent switch mute these sounds, and lets
 * them mix with the player's own music instead of pausing it.
 */
export function useAmbientAudioSession(): void {
  try {
    const session = (navigator as Navigator & { audioSession?: { type: string } }).audioSession;
    if (session) session.type = 'ambient';
  } catch {
    // Not supported: the default session.
  }
}
