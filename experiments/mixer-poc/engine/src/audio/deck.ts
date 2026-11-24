// One playing song: AudioBufferSourceNode → source gain → trim → HPF → LPF → fader → music bus, with
// post-fader echo and reverb sends. A deck is created per landing and disposed after its exit.
// At rate 1 the main source starts on a whole sample frame with a whole-frame offset (audio/lanes.ts), so P1
// stem lanes can play sample-locked to it and subtract a part exactly.
import type { Analysis } from '../analysis.ts';
import type {
  BlendEvent, PreverbEvent, SignatureEvent, StemEnvelope, StemLaneEvent, StemName, StemParts, StemsEvent, SlicesEvent,
} from '../plan/recipes.ts';
import type { BlendBuffers } from './blend.ts';
import type { AudioGraph } from './graph.ts';
import type { HookStems, StemSlices } from './stems.ts';
import { frameAligned, laneSources, laneStart, onsetShift, schedulePoints } from './lanes.ts';
import { SIGNATURES } from '../config.ts';

const SIGNATURE_FADE_SEC = SIGNATURES.fadeSec;

/** The decks a plan addresses: A, the outgoing song, and B, the incoming one. */
export type DeckName = 'A' | 'B';

/** A deck parameter the plans automate (`A.hpf`, `B.gain`, …; recipes.ts ParamTarget), plus the loudness trim. */
const DECK_PARAMS = ['gain', 'hpf', 'lpf', 'echoSend', 'reverbSend', 'rate', 'trim'] as const;
export type DeckParam = (typeof DECK_PARAMS)[number];
export const isDeckParam = (name: string): name is DeckParam => (DECK_PARAMS as readonly string[]).includes(name); // widened so any string can be tested

/** Object.entries for stem parts: the keys are stem names, which Object.entries widens to string. */
const stemEntries = (parts: StemParts) => Object.entries(parts) as [StemName, StemEnvelope | undefined][];

export interface DeckOptions {
  songId: number;
  buffer: AudioBuffer;
  analysis: Analysis;
  trimDb?: number;
}

/** A spinback: the `seconds` of the song before `fromPos`, reversed, from `rateFrom`× slowing to a stop over `dur`. */
export interface SpinbackOptions {
  at: number;
  fromPos: number;
  seconds?: number;
  rateFrom?: number;
  dur?: number;
}

export class Deck {
  graph: AudioGraph;
  ctx: BaseAudioContext;
  songId: number;
  buffer: AudioBuffer;
  analysis: Analysis;
  trim: GainNode;
  hpf: BiquadFilterNode;
  lpf: BiquadFilterNode;
  fader: GainNode;
  echoSend: GainNode;
  reverbSend: GainNode;
  extraSources: AudioBufferSourceNode[];
  stems: HookStems | null;
  /** P1: this song's stems around the hook it landed on (StemStore.lanesFor), once decoded. */
  lanes: StemSlices | null;
  /** P3: pre-verb renders of this song's hooks, by hook id (PreverbStore.buffersFor). */
  preverbs: ReadonlyMap<string, AudioBuffer> | null;
  blend: BlendBuffers | null;
  stemOut: GainNode;
  /** Stem lanes' echo and reverb sends (past the fader), at the deck's loudness trim. */
  laneEchoOut: GainNode;
  laneReverbOut: GainNode;
  /** This song's approved Signatures by id (SignatureStore.buffersFor), and their own output. */
  signatures: ReadonlyMap<string, AudioBuffer> | null;
  signatureOut: GainNode;
  source: AudioBufferSourceNode | null;
  sourceGain?: GainNode;
  startCtx: number | null;
  offset: number;
  rate: number;
  /** The main source's start and offset in whole sample frames (rate 1 only), for sample-locked lanes. */
  startFrame: number | null;
  offsetFrame: number | null;
  stopAt: number | null;
  landedDownbeatIndex: number | null;
  hookId: string | null;

  constructor(graph: AudioGraph, { songId, buffer, analysis, trimDb = 0 }: DeckOptions) {
    const { ctx } = graph;
    this.graph = graph;
    this.ctx = ctx;
    this.songId = songId;
    this.buffer = buffer;
    this.analysis = analysis;
    this.trim = ctx.createGain();
    this.trim.gain.value = 10 ** (trimDb / 20);
    this.hpf = ctx.createBiquadFilter();
    this.hpf.type = 'highpass';
    this.hpf.frequency.value = 20;
    this.hpf.Q.value = 0.707;
    this.lpf = ctx.createBiquadFilter();
    this.lpf.type = 'lowpass';
    this.lpf.frequency.value = 22000;
    this.lpf.Q.value = 0.707;
    this.fader = ctx.createGain();
    this.echoSend = ctx.createGain();
    this.echoSend.gain.value = 0;
    this.reverbSend = ctx.createGain();
    this.reverbSend.gain.value = 0;
    this.trim.connect(this.hpf).connect(this.lpf).connect(this.fader).connect(graph.musicBus);
    this.fader.connect(this.echoSend).connect(graph.echo.input);
    this.fader.connect(this.reverbSend).connect(graph.reverb.input);
    this.extraSources = [];
    // Stems around the hook being landed (StemStore.forHook): { buffers: { drums, bass, … }, startSec, scale }.
    // They play on their own path (past the fader, which keeps the full mix silent during a stem Tease),
    // with the same loudness trim.
    this.stems = null;
    this.blend = null; // BlendStore.forPair: { buffers: { drums, bass }, scale }
    this.stemOut = ctx.createGain();
    this.stemOut.gain.value = 10 ** (trimDb / 20);
    this.stemOut.connect(graph.musicBus);
    this.lanes = null;
    this.preverbs = null;
    this.laneEchoOut = ctx.createGain();
    this.laneEchoOut.gain.value = 10 ** (trimDb / 20);
    this.laneEchoOut.connect(graph.echo.input);
    this.laneReverbOut = ctx.createGain();
    this.laneReverbOut.gain.value = 10 ** (trimDb / 20);
    this.laneReverbOut.connect(graph.reverb.input);
    // Signatures are normalized on their own (their gainDb), so they skip the deck's trim.
    this.signatures = null;
    this.signatureOut = ctx.createGain();
    this.signatureOut.connect(graph.musicBus);
    this.source = null;
    this.startCtx = null;
    this.offset = 0;
    this.rate = 1;
    this.startFrame = null;
    this.offsetFrame = null;
    this.stopAt = null;
    this.landedDownbeatIndex = null;
    this.hookId = null;
  }

  start(when: number, offset: number, rate = 1): AudioBufferSourceNode {
    const source = this.ctx.createBufferSource();
    source.buffer = this.buffer;
    source.playbackRate.value = rate;
    // The main source has its own gain so it can be faded apart from loop rolls and spinbacks.
    this.sourceGain = this.ctx.createGain();
    source.connect(this.sourceGain).connect(this.trim);
    // At rate 1, on whole frames (within 21 µs of the plan), so lanes can lock to it.
    const sr = this.ctx.sampleRate;
    const at = rate === 1 ? frameAligned(when, offset, sr) : { when, offset };
    source.start(at.when, at.offset);
    this.source = source;
    this.startCtx = at.when;
    this.offset = at.offset;
    this.rate = rate;
    this.startFrame = rate === 1 ? Math.round(at.when * sr) : null;
    this.offsetFrame = rate === 1 ? Math.round(at.offset * sr) : null;
    return source;
  }

  stop(when: number): void {
    this.stopAt = when;
    try {
      this.source?.stop(Math.max(when, this.ctx.currentTime));
    } catch {}
  }

  posAt(t: number): number | null {
    if (this.startCtx == null) return null;
    return this.offset + (t - this.startCtx) * this.rate;
  }

  // Read once started (an unstarted deck counts as started at 0).
  get endCtx(): number {
    return (this.startCtx ?? 0) + (this.buffer.duration - this.offset) / this.rate;
  }

  param(name: DeckParam): AudioParam | null {
    switch (name) {
      case 'gain':
        return this.fader.gain;
      case 'hpf':
        return this.hpf.frequency;
      case 'lpf':
        return this.lpf.frequency;
      case 'echoSend':
        return this.echoSend.gain;
      case 'reverbSend':
        return this.reverbSend.gain;
      case 'rate':
        return this.source?.playbackRate ?? null;
      case 'trim':
        return this.trim.gain;
      default:
        return null;
    }
  }

  cancelAutomation(from: number): void {
    for (const p of [this.fader.gain, this.hpf.frequency, this.lpf.frequency, this.echoSend.gain, this.reverbSend.gain]) p.cancelScheduledValues(from);
  }

  // A cancelled Spin keeps this deck: drop its scheduled exit move (filters, sends, rate, rolls, the
  // stop) and bring it back to normal from wherever it is now.
  restore(seconds = 0.3): void {
    const now = this.ctx.currentTime;
    const params: [AudioParam, number][] = [
      [this.fader.gain, 1],
      [this.hpf.frequency, 20],
      [this.lpf.frequency, 22000],
      [this.echoSend.gain, 0],
      [this.reverbSend.gain, 0],
    ];
    for (const [p, to] of params) {
      p.cancelScheduledValues(now);
      p.setValueAtTime(p.value, now);
      p.linearRampToValueAtTime(to, now + seconds);
    }
    if (this.source) {
      const rate = this.source.playbackRate;
      rate.cancelScheduledValues(now);
      rate.setValueAtTime(this.rate, now);
      try {
        this.source.stop(this.endCtx + 1); // replaces the exit's stop time
      } catch {}
    }
    this.stopAt = null;
    for (const src of this.extraSources) {
      try {
        src.stop();
      } catch {}
    }
    this.extraSources = [];
  }

  // Fade the whole deck out and dispose it.
  fadeOut(seconds = 0.08, at: number = this.ctx.currentTime): void {
    const t = Math.max(at, this.ctx.currentTime);
    for (const g of [this.fader.gain, this.stemOut.gain, this.signatureOut.gain, this.laneEchoOut.gain, this.laneReverbOut.gain]) {
      g.cancelScheduledValues(t);
      g.setValueAtTime(g.value, t);
      g.linearRampToValueAtTime(0, t + seconds);
    }
    try {
      this.source?.stop(t + seconds + 0.02);
    } catch {}
    setTimeout(() => this.dispose(), (t - this.ctx.currentTime + seconds) * 1000 + 200);
  }

  // Back: the song rewinds out (a reversed, slowing spinback) and stops.
  rewindOut(at: number = this.ctx.currentTime + 0.02, dur = 1.1): void {
    const pos = this.posAt(at);
    this.cancelAutomation(at);
    this.fader.gain.setValueAtTime(Math.max(this.fader.gain.value, 0.7), at);
    if (this.sourceGain) {
      this.sourceGain.gain.setValueAtTime(1, at);
      this.sourceGain.gain.linearRampToValueAtTime(0, at + 0.012);
    }
    try {
      this.source?.stop(at + 0.02);
    } catch {}
    this.spinback({ at, fromPos: pos ?? 0, seconds: 2, rateFrom: 3, dur }); // unstarted: nothing to rewind (spinback skips it)
    setTimeout(() => this.dispose(), (at - this.ctx.currentTime + dur) * 1000 + 300);
  }

  // Slices (a loop roll, P2 chops): short pieces of this song's mix, one of its stems or one of its
  // Signatures, each with its own rate, faded in and out. Through the deck's chain (filters and fader apply),
  // or `direct` past the fader; `hpfHz` high-passes them all; `snap` moves them onto the source's onset.
  playSlices({ slices, source = { from: 'mix' }, direct = false, fadeMs = 3, hpfHz, snap }: Omit<SlicesEvent, 'kind' | 'deck'>): void {
    const first = slices[0];
    if (!first) return;
    let buffer: AudioBuffer | null = null;
    let base = 0; // song (or file) seconds → buffer seconds
    let scale = 1;
    let out: AudioNode = direct ? this.stemOut : this.trim;
    if (source.from === 'mix') buffer = this.buffer;
    else if (source.from === 'signature') {
      buffer = this.signatures?.get(source.id) ?? null;
      if (direct) out = this.signatureOut;
    } else {
      const reach = Math.max(...slices.map((s) => s.offset + s.dur * (s.rate ?? 1)));
      const store = [this.lanes, this.stems].find((x) => x?.buffers[source.part] && first.offset >= x.startSec && reach <= x.startSec + (x.buffers[source.part]?.duration ?? 0));
      buffer = store?.buffers[source.part] ?? null;
      base = store?.startSec ?? 0;
      scale = store?.scale ?? 1;
    }
    if (!buffer) return;
    if (hpfHz) {
      const hpf = this.ctx.createBiquadFilter();
      hpf.type = 'highpass';
      hpf.frequency.value = hpfHz;
      hpf.connect(out);
      out = hpf;
    }
    const channels = Array.from({ length: buffer.numberOfChannels }, (_, c) => buffer.getChannelData(c));
    const shift = snap ? onsetShift(channels, buffer.sampleRate, first.offset - base, snap.searchSec, snap.consonantSec) : 0;
    for (const { at, offset, dur, gain = 1, rate = 1 } of slices) {
      if (at < this.ctx.currentTime - 0.005 || dur <= 0.004) continue;
      const src = this.ctx.createBufferSource();
      src.buffer = buffer;
      src.playbackRate.value = rate;
      const env = this.ctx.createGain();
      const fade = Math.min(fadeMs / 1000, dur / 3);
      const level = gain * scale;
      env.gain.setValueAtTime(0, at);
      env.gain.linearRampToValueAtTime(level, at + fade);
      env.gain.setValueAtTime(level, at + dur - fade);
      env.gain.linearRampToValueAtTime(0, at + dur);
      src.connect(env).connect(out);
      // `duration` counts buffer seconds, which a rate other than 1 plays faster or slower.
      src.start(at, Math.max(0, offset - base + shift), dur * rate + 0.002);
      this.extraSources.push(src);
    }
  }

  // P1, a stem lane: one part of this song, sample-locked to the main source (whole frames, rate 1 only), into
  // the deck's chain (`direct`, −1 removes the part) and/or alone into the echo or reverb. A lane its decoded
  // stems do not cover entirely is not played at all (half a subtraction would be worse than none).
  playLane({ part, at, until, direct, echo, reverb }: Omit<StemLaneEvent, 'kind' | 'deck'>): boolean {
    if (this.startFrame == null || this.offsetFrame == null || !this.source) return false;
    const { startFrame, offsetFrame } = this;
    const sr = this.ctx.sampleRate;
    const first = Math.max(at, this.ctx.currentTime + 0.005);
    const when = laneStart(startFrame, offsetFrame, first, sr, 0).when;
    const frames = Math.ceil((until - when) * sr) + 1;
    if (frames < sr * 0.01) return false;
    for (const store of [this.lanes, this.stems]) {
      if (!store) continue;
      const storeFrame = Math.round(store.startSec * sr);
      const sources = laneSources(part, store.scale).map(({ from, gain }) => {
        const buffer = from === 'mix' ? this.buffer : store.buffers[from];
        const { offsetFrames } = laneStart(startFrame, offsetFrame, first, sr, from === 'mix' ? 0 : storeFrame);
        return buffer && offsetFrames >= 0 && offsetFrames + frames <= buffer.length ? { buffer, gain, offsetFrames } : null;
      });
      if (sources.some((x) => !x)) continue;
      const sum = this.ctx.createGain();
      for (const x of sources) {
        if (!x) continue;
        const src = this.ctx.createBufferSource();
        src.buffer = x.buffer;
        const g = this.ctx.createGain();
        g.gain.value = x.gain;
        src.connect(g).connect(sum);
        src.start(when, x.offsetFrames / sr, frames / sr);
        this.extraSources.push(src);
      }
      const routes: [typeof direct | undefined, AudioNode][] = [[direct, this.trim], [echo, this.laneEchoOut], [reverb, this.laneReverbOut]];
      for (const [points, destination] of routes) {
        if (!points?.length) continue;
        const g = this.ctx.createGain();
        schedulePoints(g.gain, points, when, until);
        sum.connect(g).connect(destination);
      }
      return true;
    }
    return false;
  }

  // P3, a pre-verb swell: the end of this hook's render (PreverbStore), so it ends at `until`, faded in.
  playPreverb({ hookId, at, until, gainDb, hpfHz }: Omit<PreverbEvent, 'kind' | 'deck'>): void {
    const buffer = this.preverbs?.get(hookId);
    if (!buffer) return;
    const start = Math.max(at, until - buffer.duration, this.ctx.currentTime + 0.005);
    if (until - start < 0.05) return;
    const src = this.ctx.createBufferSource();
    src.buffer = buffer;
    const hpf = this.ctx.createBiquadFilter();
    hpf.type = 'highpass';
    hpf.frequency.value = hpfHz;
    const g = this.ctx.createGain();
    const level = 10 ** (gainDb / 20);
    g.gain.setValueAtTime(0, start);
    g.gain.linearRampToValueAtTime(level, start + 0.02);
    g.gain.setValueAtTime(level, until - 0.005);
    g.gain.linearRampToValueAtTime(0, until);
    src.connect(hpf).connect(g).connect(this.stemOut);
    src.start(start, buffer.duration - (until - start), until - start + 0.01);
    this.extraSources.push(src);
  }

  // The Blend: this song's bars before its hook, stretched to the outgoing song's tempo (BlendStore.forPair),
  // played so the render's time `fileAt` sounds at `at`. Parts ramp in like playStems and are cut at `until`.
  playBlend({ at, until, fileAt, parts }: Pick<BlendEvent, 'at' | 'until' | 'fileAt' | 'parts'>): void {
    const blend = this.blend;
    if (!blend) return;
    const now = this.ctx.currentTime;
    for (const [name, env] of stemEntries(parts)) {
      const buffer = blend.buffers[name];
      if (!buffer || !env) continue;
      const start = Math.max(at, now + 0.005);
      const offset = fileAt + (start - at);
      if (offset < 0 || offset >= buffer.duration || until <= start) continue;
      const src = this.ctx.createBufferSource();
      src.buffer = buffer;
      const gain = this.ctx.createGain();
      const g = gain.gain;
      g.setValueAtTime(env.from * blend.scale, start);
      g.setValueAtTime(env.from * blend.scale, Math.max(start, env.t0));
      g.linearRampToValueAtTime(env.to * blend.scale, Math.max(start + 0.001, env.t1));
      g.setValueAtTime(env.to * blend.scale, Math.max(start + 0.002, until - 0.008));
      g.linearRampToValueAtTime(0, until);
      src.connect(gain).connect(this.stemOut);
      src.start(start, offset, until - start + 0.02);
      this.extraSources.push(src);
    }
  }

  // One of this song's Signatures: its anchor sounds at `at`, resampled by `rate`, faded out at `until`;
  // `echo` also sends it into the shared echo. Skipped when its audio is not decoded (or already too late).
  playSignature({ id, at, anchorSec, rate, gainDb, until, echo }: Omit<SignatureEvent, 'kind' | 'deck'>): void {
    const buffer = this.signatures?.get(id);
    if (!buffer) return;
    const now = this.ctx.currentTime;
    const startAt = at - anchorSec / rate;
    const start = Math.max(startAt, now + 0.005);
    const offset = (start - startAt) * rate;
    if (offset >= buffer.duration || until <= start + 0.02) return;
    const src = this.ctx.createBufferSource();
    src.buffer = buffer;
    src.playbackRate.value = rate;
    const gain = this.ctx.createGain();
    const level = 10 ** (gainDb / 20);
    const fade = SIGNATURE_FADE_SEC;
    gain.gain.setValueAtTime(0, start);
    gain.gain.linearRampToValueAtTime(level, start + Math.min(fade, 0.004));
    gain.gain.setValueAtTime(level, Math.max(start + 0.005, until - fade));
    gain.gain.linearRampToValueAtTime(0, until);
    src.connect(gain).connect(this.signatureOut);
    if (echo > 0) {
      const send = this.ctx.createGain();
      send.gain.value = echo;
      gain.connect(send).connect(this.graph.echo.input);
    }
    src.start(start, offset, until - start + 0.02);
    this.extraSources.push(src);
  }

  // A Tease from this song's own stems, in sync with its timeline: each part ramps in, holds, and is cut
  // (10 ms) at `until`. Parts without a decoded stem are skipped.
  playStems({ at, until, parts }: Pick<StemsEvent, 'at' | 'until' | 'parts'>): void {
    const stems = this.stems;
    if (!stems || this.startCtx == null) return;
    const now = this.ctx.currentTime;
    for (const [name, env] of stemEntries(parts)) {
      const buffer = stems.buffers[name];
      if (!buffer || !env) continue;
      const start = Math.max(at, now + 0.005);
      const pos = this.posAt(start);
      if (pos == null) continue; // never: the deck has started (checked above)
      const offset = pos - stems.startSec;
      if (offset < 0 || offset >= buffer.duration || until <= start) continue;
      const src = this.ctx.createBufferSource();
      src.buffer = buffer;
      const gain = this.ctx.createGain();
      const g = gain.gain;
      g.setValueAtTime(env.from * stems.scale, start);
      g.setValueAtTime(env.from * stems.scale, Math.max(start, env.t0));
      g.linearRampToValueAtTime(env.to * stems.scale, Math.max(start + 0.001, env.t1));
      g.setValueAtTime(env.to * stems.scale, Math.max(start + 0.002, until - 0.01));
      g.linearRampToValueAtTime(0, until);
      src.connect(gain).connect(this.stemOut);
      src.start(start, offset, until - start + 0.02);
      this.extraSources.push(src);
    }
  }

  // Spinback: the last `seconds` before `fromPos`, reversed, played fast and slowing to a stop.
  spinback({ at, fromPos, seconds = 1.5, rateFrom = 3, dur = 1 }: SpinbackOptions): void {
    const { buffer, ctx } = this;
    const sr = buffer.sampleRate;
    const end = Math.min(buffer.length, Math.max(0, Math.round(fromPos * sr)));
    const start = Math.max(0, end - Math.round(seconds * sr));
    const length = end - start;
    if (length < sr * 0.1) return;
    const rev = ctx.createBuffer(buffer.numberOfChannels, length, sr);
    for (let c = 0; c < buffer.numberOfChannels; c++) {
      const from = buffer.getChannelData(c);
      const to = rev.getChannelData(c);
      for (let i = 0; i < length; i++) to[i] = from[end - 1 - i];
    }
    const src = ctx.createBufferSource();
    src.buffer = rev;
    src.playbackRate.setValueAtTime(rateFrom, at);
    src.playbackRate.linearRampToValueAtTime(0.05, at + dur);
    const env = ctx.createGain();
    env.gain.setValueAtTime(0, at);
    env.gain.linearRampToValueAtTime(1, at + 0.01);
    env.gain.setValueAtTime(1, at + dur * 0.7);
    env.gain.linearRampToValueAtTime(0, at + dur);
    src.connect(env).connect(this.trim);
    src.start(at);
    src.stop(at + dur + 0.05);
    this.extraSources.push(src);
  }

  dispose(): void {
    for (const src of [this.source, ...this.extraSources]) {
      try {
        src?.stop();
      } catch {}
    }
    this.extraSources = [];
    for (const node of [this.source, this.sourceGain, this.trim, this.hpf, this.lpf, this.fader, this.echoSend, this.reverbSend, this.stemOut, this.laneEchoOut, this.laneReverbOut]) {
      try {
        node?.disconnect();
      } catch {}
    }
    this.source = null;
  }
}
