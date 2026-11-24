// Short synthesized sounds scheduled on the audio clock: metronome clicks and bells (audition page),
// the drum's border ticks (ported from shuffle-test/sound.js playTick), thunks and a whoosh.

const noiseCache = new WeakMap<BaseAudioContext, Record<string, AudioBuffer>>(); // per context: seconds → buffer

export function noiseBuffer(ctx: BaseAudioContext, seconds = 1): AudioBuffer {
  let buffers = noiseCache.get(ctx);
  if (!buffers) noiseCache.set(ctx, (buffers = {}));
  const key = String(seconds);
  if (!buffers[key]) {
    const length = Math.floor(ctx.sampleRate * seconds);
    const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i++) data[i] = Math.random() * 2 - 1;
    buffers[key] = buffer;
  }
  return buffers[key];
}

function envelope(ctx: BaseAudioContext, destination: AudioNode, time: number, peak: number, decay: number, attack = 0.002): GainNode {
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.0001, time);
  gain.gain.exponentialRampToValueAtTime(Math.max(peak, 0.0002), time + attack);
  gain.gain.exponentialRampToValueAtTime(0.0001, time + attack + decay);
  gain.connect(destination);
  return gain;
}

export interface ToneOptions {
  time: number;
  type?: OscillatorType;
  frequency: number;
  endFrequency?: number;
  peak: number;
  decay: number;
  attack?: number;
}

export function tone(
  ctx: BaseAudioContext,
  destination: AudioNode,
  { time, type = 'sine', frequency, endFrequency = frequency, peak, decay, attack }: ToneOptions,
): void {
  const osc = ctx.createOscillator();
  osc.type = type;
  osc.frequency.setValueAtTime(frequency, time);
  if (endFrequency !== frequency) osc.frequency.exponentialRampToValueAtTime(endFrequency, time + decay);
  osc.connect(envelope(ctx, destination, time, peak, decay, attack));
  osc.start(time);
  osc.stop(time + (attack || 0.002) + decay + 0.02);
}

export interface NoiseHitOptions {
  time: number;
  frequency: number;
  q?: number;
  peak: number;
  decay: number;
  type?: BiquadFilterType;
}

export function noiseHit(
  ctx: BaseAudioContext,
  destination: AudioNode,
  { time, frequency, q = 1.4, peak, decay, type = 'bandpass' }: NoiseHitOptions,
): void {
  const src = ctx.createBufferSource();
  src.buffer = noiseBuffer(ctx);
  src.loopStart = 0;
  const filter = ctx.createBiquadFilter();
  filter.type = type;
  filter.frequency.value = frequency;
  filter.Q.value = q;
  src.connect(filter).connect(envelope(ctx, destination, time, peak, decay));
  src.start(time, Math.random() * 0.5);
  src.stop(time + decay + 0.03);
}

// Metronome: accented downbeat, plain beat.
export function metronomeClick(
  ctx: BaseAudioContext,
  destination: AudioNode,
  time: number,
  { accent = false, level = 1 }: { accent?: boolean; level?: number } = {},
): void {
  tone(ctx, destination, { time, type: 'square', frequency: accent ? 1760 : 1180, peak: (accent ? 0.35 : 0.2) * level, decay: 0.03 });
}

// Bell every 4 bars from the hook (two partials, longer ring).
export function bell(
  ctx: BaseAudioContext,
  destination: AudioNode,
  time: number,
  { level = 1, strong = false }: { level?: number; strong?: boolean } = {},
): void {
  const base = strong ? 1318.5 : 987.8;
  tone(ctx, destination, { time, frequency: base, peak: 0.22 * level, decay: 1.1 });
  tone(ctx, destination, { time, frequency: base * 2.76, peak: 0.07 * level, decay: 0.5 });
}

// shuffle-test/sound.js playTick, moved onto a scheduled time: slow clicks ring longer and fuller.
const SPEED_OF_FULL_LOUDNESS = 14;
const vary = (amount: number) => 1 + (Math.random() - 0.5) * 2 * amount;
export function drumTick(ctx: BaseAudioContext, destination: AudioNode, time: number, cardsPerSecond: number, level = 1): void {
  const speedRatio = Math.min(1, cardsPerSecond / SPEED_OF_FULL_LOUDNESS);
  const loudness = (0.45 + 0.55 * speedRatio) * vary(0.2) * level;
  const decay = 0.03 + 0.05 * (1 - speedRatio);
  noiseHit(ctx, destination, { time, frequency: (2200 + cardsPerSecond * 25) * vary(0.08), peak: 0.5 * loudness, decay });
  tone(ctx, destination, { time, type: 'triangle', frequency: 380 * vary(0.06), peak: 0.25 * loudness, decay: decay * 1.4 });
}

export function thunk(ctx: BaseAudioContext, destination: AudioNode, time: number, level = 1): void {
  tone(ctx, destination, { time, frequency: 150, endFrequency: 55, peak: 0.55 * level, decay: 0.22 });
  noiseHit(ctx, destination, { time, frequency: 900, peak: 0.3 * level, decay: 0.05 });
}

// Soft filtered-noise whoosh (spin start): band-pass sweeping up then down.
export function whoosh(
  ctx: BaseAudioContext,
  destination: AudioNode,
  time: number,
  { seconds = 0.9, level = 1, from = 400, to = 3000 }: { seconds?: number; level?: number; from?: number; to?: number } = {},
): void {
  const src = ctx.createBufferSource();
  src.buffer = noiseBuffer(ctx, 2);
  const filter = ctx.createBiquadFilter();
  filter.type = 'bandpass';
  filter.Q.value = 0.9;
  filter.frequency.setValueAtTime(from, time);
  filter.frequency.exponentialRampToValueAtTime(to, time + seconds * 0.45);
  filter.frequency.exponentialRampToValueAtTime(from * 1.5, time + seconds);
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.0001, time);
  gain.gain.exponentialRampToValueAtTime(0.25 * level, time + seconds * 0.4);
  gain.gain.exponentialRampToValueAtTime(0.0001, time + seconds);
  src.connect(filter).connect(gain).connect(destination);
  src.start(time);
  src.stop(time + seconds + 0.05);
}
