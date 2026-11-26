// Hold music: looping waiting-screen tracks that take over during a long Hold, after Back, or when a song
// runs out while the presenters talk. The music never stops unless silence is intended.
//
// The user's tracks go in data/media/hold/ (gitignored). tools/prep/hold.py decodes them to
// cache/hold/<name>.flac (served at /holdaudio/) and picks seamless whole-bar loops (data/hold/<name>.json).
// Moods come from the folder: hold/ is "fail" music (category "error": after Back, and later a failed
// Check), celebration/ is victory music. A synthesized chiptune placeholder covers ordinary Holds.
// Loops always start and end inside the track (never a restart from the top), on checked seams. Hold music is never a pool song, so players can't
// mistake it for one.
import { isRecord } from './loader.ts';
import { loopGrid, type OutgoingMusic } from '../interval/plan.ts';
import type { AudioGraph } from './graph.ts';
import type { Handoff } from './interval.ts';

/** Moods come from the folder: hold/ is fail music ('error'), celebration/ is victory music; 'hold' is an ordinary Hold. */
/** `intro`: a round's intro track (D129), played by this player too: one looping bed at a time. */
export type HoldMusicMood = 'hold' | 'error' | 'celebration' | 'intro';

/**
 * One loop in data/hold/<name>.json (tools/prep/hold.py), the fields read here: whole bars ('bars') or the
 * composer's loop body ('body') between two samples of the decoded track. `preferred` marks the loop to play;
 * `afterIntro`, that it starts after the track's intro; `gainToTargetDb` trims it to the songs' loudness.
 */
interface HoldLoopMeta {
  startSample: number;
  endSample: number;
  kind?: 'body' | 'bars' | null;
  preferred?: boolean | null;
  afterIntro?: boolean | null;
  gainToTargetDb?: number | null;
  bpm?: number | null;
  /** Whole bars between the loop points, and their beats: the loop's grid (an Interval handover's downbeats).
   * Read only when they are whole numbers; a loop without them still plays. */
  bars?: unknown;
  beatsPerBar?: unknown;
}

const isCount = (x: unknown): x is number => typeof x === 'number' && Number.isInteger(x) && x >= 1;

function isHoldLoopMeta(l: unknown): l is HoldLoopMeta {
  if (!isRecord(l)) return false;
  const { startSample, endSample, kind, preferred, afterIntro, gainToTargetDb, bpm } = l;
  return typeof startSample === 'number' && Number.isInteger(startSample) && typeof endSample === 'number' && endSample > startSample &&
    (kind == null || kind === 'body' || kind === 'bars') && (preferred == null || typeof preferred === 'boolean') &&
    (afterIntro == null || typeof afterIntro === 'boolean') && (gainToTargetDb == null || typeof gainToTargetDb === 'number') &&
    (bpm == null || typeof bpm === 'number');
}

/** The placeholder's one loop, rendered up front: the whole buffer loops. */
interface PlaceholderLoop {
  buffer: AudioBuffer;
  startSec: number;
  endSec: number;
  gainDb: number;
  loopStartSec?: number;
  bars: number;
  beatsPerBar: number;
}

/**
 * A loop of a track. load() cuts `buffer` out of the decoded track: from the loop start (or from the top when
 * it keeps the intro, `withIntro`) to the loop end; it loops from `loopStartSec` to its end.
 */
interface TrackLoop {
  startSample: number;
  endSample: number;
  gainDb: number;
  bpm: number | null | undefined;
  kind: 'body' | 'bars';
  withIntro: boolean;
  bars: number | null;
  beatsPerBar: number;
  buffer?: AudioBuffer;
  loopStartSec?: number;
}

interface PlaceholderTrack {
  title: string;
  mood: 'hold';
  placeholder: true;
  preferred?: undefined;
  loops: PlaceholderLoop[];
  next: number;
}

/** One of the user's tracks; `loading` is its decode in flight. */
interface FileTrack {
  title: string;
  name: string;
  mood: HoldMusicMood;
  placeholder?: undefined;
  preferred: 0 | 1;
  loops: TrackLoop[];
  next: number;
  loading?: Promise<FileTrack> | null;
}

export type HoldTrack = PlaceholderTrack | FileTrack;

/** The loop playing now; `mood` is the one asked for (a mood without a track plays the placeholder). */
interface HoldVoice {
  source: AudioBufferSourceNode;
  gain: GainNode;
  lpf: BiquadFilterNode;
  title: string;
  trackGain: number;
  levelDb: number;
  mood: HoldMusicMood;
  /** The loop's downbeats on the audio clock (null without whole bars): the Interval hands over on one. */
  grid: OutgoingMusic | null;
  /** Where it is in its buffer at a time (Pausa saves it, D128): it started at `startAt` from `offsetSec`. */
  startAt: number;
  offsetSec: number;
  bars: number | null;
  beatsPerBar: number;
}

/** A voice Pausa took off (D128): it comes back from where it was. */
export interface SuspendedHold {
  buffer: AudioBuffer;
  posSec: number;
  loopStartSec: number;
  loopEndSec: number;
  title: string;
  trackGain: number;
  levelDb: number;
  mood: HoldMusicMood;
  bars: number | null;
  beatsPerBar: number;
}

/** Where a looping source is in its buffer `elapsed` seconds after it started at `offsetSec`. */
export function loopPosition(offsetSec: number, elapsed: number, loopStartSec: number, loopEndSec: number): number {
  const pos = offsetSec + Math.max(0, elapsed);
  const span = loopEndSec - loopStartSec;
  if (pos < loopEndSec || span <= 0) return pos;
  return loopStartSec + ((pos - loopEndSec) % span);
}

export interface HoldMusicStart {
  at?: number;
  levelDb?: number;
  fadeSec?: number;
  mood?: HoldMusicMood;
}

/** A rendered loop of the placeholder. */
export interface PlaceholderRender {
  buffer: AudioBuffer;
  title: string;
  bpm: number;
  loopSec: number;
}

const PLACEHOLDER = { bpm: 96, bars: 8 };
const TARGET_RMS_DB = -19; // roughly the songs' loudness after LUFS trim
export const HOLD_LEVEL_DB = -12; // under the presenters' voices
const midiHz = (m: number) => 440 * 2 ** ((m - 69) / 12);

// C | Am | F | G | C | Am | Dm | G, a gentle 16th-note arpeggio, a bass, a little melody and soft drums.
const CHORDS: readonly (readonly [root: number, voicing: number])[] = [[48, 0], [45, 1], [41, 2], [43, 3], [48, 0], [45, 1], [38, 4], [43, 3]];
const VOICINGS: readonly (readonly number[])[] = [[60, 64, 67, 72], [57, 60, 64, 69], [53, 57, 60, 65], [55, 59, 62, 67], [50, 53, 57, 62]];
type MelodyNote = readonly [beat: number, midi: number, beats: number];
const MELODY: readonly (readonly MelodyNote[])[] = [
  [[0, 79, 1], [1, 76, 0.5], [1.5, 79, 0.5], [2, 84, 1.5]],
  [[0, 81, 1], [1, 79, 1], [2, 76, 2]],
  [[0, 77, 0.5], [0.5, 76, 0.5], [1, 74, 1], [2, 72, 1], [3, 74, 1]],
  [[0, 79, 2], [2, 74, 1], [3, 71, 1]],
  [[0, 79, 1], [1, 76, 0.5], [1.5, 79, 0.5], [2, 84, 1], [3, 86, 1]],
  [[0, 88, 1.5], [1.5, 84, 0.5], [2, 81, 2]],
  [[0, 77, 1], [1, 81, 1], [2, 79, 1], [3, 77, 1]],
  [[0, 74, 1], [1, 79, 1], [2, 74, 0.5], [2.5, 71, 0.5], [3, 67, 1]],
];

function pulseWave(ctx: BaseAudioContext, duty: number): PeriodicWave {
  const n = 64;
  const real = new Float32Array(n);
  const imag = new Float32Array(n);
  for (let k = 1; k < n; k++) imag[k] = (2 / (k * Math.PI)) * Math.sin(k * Math.PI * duty);
  return ctx.createPeriodicWave(real, imag);
}

interface NoteOptions {
  at: number;
  hz: number;
  dur: number;
  level: number;
  wave?: PeriodicWave;
  type?: OscillatorType;
  attack?: number;
  release?: number;
}

function note(ctx: BaseAudioContext, out: AudioNode, { at, hz, dur, level, wave, type = 'square', attack = 0.005, release = 0.06 }: NoteOptions): void {
  const osc = ctx.createOscillator();
  if (wave) osc.setPeriodicWave(wave);
  else osc.type = type;
  osc.frequency.value = hz;
  const env = ctx.createGain();
  env.gain.setValueAtTime(0, at);
  env.gain.linearRampToValueAtTime(level, at + attack);
  env.gain.setTargetAtTime(level * 0.6, at + attack, dur * 0.4);
  env.gain.setTargetAtTime(0, at + dur, release / 3);
  osc.connect(env).connect(out);
  osc.start(at);
  osc.stop(at + dur + release + 0.05);
}

interface NoiseOptions {
  at: number;
  dur: number;
  level: number;
  hpf?: number;
  bpf?: number | null;
  noiseBuffer: AudioBuffer;
}

function noise(ctx: BaseAudioContext, out: AudioNode, { at, dur, level, hpf = 6000, bpf = null, noiseBuffer }: NoiseOptions): void {
  const src = ctx.createBufferSource();
  src.buffer = noiseBuffer;
  const filter = ctx.createBiquadFilter();
  filter.type = bpf ? 'bandpass' : 'highpass';
  filter.frequency.value = bpf ?? hpf;
  const env = ctx.createGain();
  env.gain.setValueAtTime(level, at);
  env.gain.exponentialRampToValueAtTime(0.0001, at + dur);
  src.connect(filter).connect(env).connect(out);
  src.start(at, Math.random());
  src.stop(at + dur + 0.02);
}

function kick(ctx: BaseAudioContext, out: AudioNode, at: number, level: number): void {
  const osc = ctx.createOscillator();
  osc.frequency.setValueAtTime(120, at);
  osc.frequency.exponentialRampToValueAtTime(45, at + 0.12);
  const env = ctx.createGain();
  env.gain.setValueAtTime(level, at);
  env.gain.exponentialRampToValueAtTime(0.0001, at + 0.3);
  osc.connect(env).connect(out);
  osc.start(at);
  osc.stop(at + 0.32);
}

// Render one seamless loop. Tails that run past the end are folded back onto the start.
export async function renderPlaceholder(sampleRate = 48000): Promise<PlaceholderRender> {
  const beat = 60 / PLACEHOLDER.bpm;
  const bar = 4 * beat;
  const loopSec = PLACEHOLDER.bars * bar;
  const loopLength = Math.round(loopSec * sampleRate);
  const ctx = new OfflineAudioContext(2, loopLength + sampleRate, sampleRate);
  const master = ctx.createGain();
  master.gain.value = 0.8;
  const lpf = ctx.createBiquadFilter();
  lpf.type = 'lowpass';
  lpf.frequency.value = 7000;
  master.connect(lpf).connect(ctx.destination);
  const left = ctx.createStereoPanner();
  left.pan.value = -0.35;
  left.connect(master);
  const right = ctx.createStereoPanner();
  right.pan.value = 0.3;
  right.connect(master);
  const noiseBuffer = ctx.createBuffer(1, sampleRate * 2, sampleRate);
  const data = noiseBuffer.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  const arpWave = pulseWave(ctx, 0.25);
  const leadWave = pulseWave(ctx, 0.5);

  CHORDS.forEach(([root, voicing], b) => {
    const t0 = b * bar;
    const tones = VOICINGS[voicing];
    for (let s = 0; s < 16; s++) {
      const m = tones[s % 4] + (Math.floor(s / 4) % 2 ? 12 : 0);
      note(ctx, left, { at: t0 + (s * beat) / 4, hz: midiHz(m), dur: beat / 5, level: 0.05, wave: arpWave, release: 0.04 });
    }
    for (let e = 0; e < 8; e++) {
      const m = root - 12 + (e % 2 ? 12 : 0);
      note(ctx, master, { at: t0 + (e * beat) / 2, hz: midiHz(m), dur: beat / 2.4, level: 0.32, type: 'triangle', release: 0.05 });
      noise(ctx, right, { at: t0 + (e * beat) / 2, dur: 0.035, level: e % 2 ? 0.05 : 0.03, hpf: 7000, noiseBuffer });
    }
    for (const k of [0, 2]) kick(ctx, master, t0 + k * beat, 0.55);
    for (const k of [1, 3]) noise(ctx, master, { at: t0 + k * beat, dur: 0.12, level: 0.12, bpf: 1800, noiseBuffer });
    for (const [at, m, dur] of MELODY[b]) note(ctx, right, { at: t0 + at * beat, hz: midiHz(m), dur: dur * beat * 0.9, level: 0.045, wave: leadWave, release: 0.12 });
  });

  const rendered = await ctx.startRendering();
  const loop = new AudioBuffer({ numberOfChannels: 2, length: loopLength, sampleRate });
  for (let c = 0; c < 2; c++) {
    const src = rendered.getChannelData(c);
    const dst = loop.getChannelData(c);
    dst.set(src.subarray(0, loopLength));
    for (let i = loopLength; i < src.length; i++) dst[i - loopLength] += src[i];
  }
  return { buffer: loop, title: 'Placeholder (chiptune)', bpm: PLACEHOLDER.bpm, loopSec };
}

function rmsDb(buffer: AudioBuffer): number {
  let sum = 0;
  let n = 0;
  for (let c = 0; c < buffer.numberOfChannels; c++) {
    const data = buffer.getChannelData(c);
    for (let i = 0; i < data.length; i += 4) {
      sum += data[i] * data[i];
      n++;
    }
  }
  return 10 * Math.log10(sum / Math.max(1, n) + 1e-12);
}

export class HoldMusic {
  graph: AudioGraph;
  ctx: BaseAudioContext;
  tracks: HoldTrack[];
  voice: HoldVoice | null;
  starting: Promise<void> | null;
  turns?: Map<HoldMusicMood, number>; // per mood, how many times a track was picked

  constructor(graph: AudioGraph) {
    this.graph = graph;
    this.ctx = graph.ctx;
    this.tracks = []; // the placeholder, then the user's tracks
    this.voice = null; // the loop playing now
    this.starting = null; // a start() still loading its track
  }

  // The user's tracks (data/media/hold, analysed by tools/prep/hold.py into seamless bar loops) plus
  // the synthesized placeholder, which covers any mood without a track.
  async prepare(): Promise<void> {
    const placeholder = await renderPlaceholder(this.ctx.sampleRate);
    this.tracks.push({
      title: placeholder.title,
      mood: 'hold',
      placeholder: true,
      loops: [{
        buffer: placeholder.buffer, startSec: 0, endSec: placeholder.loopSec, gainDb: TARGET_RMS_DB - rmsDb(placeholder.buffer),
        bars: PLACEHOLDER.bars, beatsPerBar: 4,
      }],
      next: 0,
    });
    try {
      // data/hold/index.json (tools/prep/hold.py) lists the analysed tracks by `name`.
      const index: unknown = await (await fetch('/data/hold/index.json', { cache: 'no-store' })).json();
      if (!isRecord(index)) throw new Error('data/hold/index.json: not an object');
      const files: unknown[] = Array.isArray(index.files) ? index.files : [];
      for (const file of files) {
        const name = isRecord(file) ? file.name : undefined;
        if (typeof name !== 'string') continue;
        // data/hold/<name>.json: `sampleRate` of the decoded track, `category` (its folder's mood) and `loops`.
        // One unreadable track must not cost the others, so each file is read on its own.
        let meta: unknown;
        try {
          meta = await (await fetch(`/data/hold/${encodeURIComponent(name)}.json`, { cache: 'no-store' })).json();
        } catch (error) {
          console.warn('hold music', name, error);
          continue;
        }
        if (!isRecord(meta)) continue;
        const loops = (Array.isArray(meta.loops) ? meta.loops : []).filter(isHoldLoopMeta);
        if (!loops.length || meta.sampleRate !== this.ctx.sampleRate) continue;
        const { category } = meta;
        // The throw song (D138) isn't a loop: audio/throw.ts plays it.
        if (category === 'throw') continue;
        // The composer's loop body (analysis `preferred`) plays first; bar loops are fallbacks.
        const ordered = [...loops].sort((a, b) => Number(Boolean(b.preferred)) - Number(Boolean(a.preferred)));
        this.tracks.push({
          title: name,
          name,
          mood: category === 'error' || category === 'celebration' || category === 'intro' ? category : 'hold',
          preferred: ordered[0]?.preferred ? 1 : 0,
          loops: ordered.map((l) => ({ startSample: l.startSample, endSample: l.endSample, gainDb: l.gainToTargetDb ?? 0, bpm: l.bpm,
            kind: l.kind ?? 'bars', withIntro: Boolean(l.kind === 'body' && l.preferred && l.afterIntro !== false),
            bars: isCount(l.bars) ? l.bars : null, beatsPerBar: isCount(l.beatsPerBar) ? l.beatsPerBar : 4 })),
          next: 0,
        });
      }
    } catch (error) {
      console.warn('hold music index', error);
    }
    // Decode the tracks now, so a Hold never waits for a 7-minute file.
    for (const track of this.tracks) this.load(track).catch((error) => console.warn('hold music', track.title, error));
  }

  get playing(): boolean {
    return Boolean(this.voice || this.starting);
  }

  get title(): string | null {
    return this.voice?.title ?? null;
  }

  // Decode a track once and keep only its loops (a 7-minute file would hold 165 MB as one buffer).
  load(track: HoldTrack): Promise<HoldTrack> {
    if (track.placeholder || track.loops.every((l) => l.buffer)) return Promise.resolve(track);
    track.loading ??= this.decodeLoops(track).catch((error: unknown) => {
      track.loading = null;
      throw error;
    });
    return track.loading;
  }

  async decodeLoops(track: FileTrack): Promise<FileTrack> {
    const data = await (await fetch(`/holdaudio/${encodeURIComponent(track.name)}.flac`)).arrayBuffer();
    const full = await this.ctx.decodeAudioData(data);
    for (const loop of track.loops) {
      // A composer's loop keeps the track's intro: it plays once, then the body loops (like the game).
      const from = loop.withIntro ? 0 : loop.startSample;
      const buffer = this.ctx.createBuffer(full.numberOfChannels, loop.endSample - from, full.sampleRate);
      for (let c = 0; c < full.numberOfChannels; c++) buffer.copyToChannel(full.getChannelData(c).subarray(from, loop.endSample), c);
      loop.buffer = buffer;
      loop.loopStartSec = (loop.startSample - from) / full.sampleRate;
    }
    return track;
  }

  // Tracks of a mood take turns, so the same fail music doesn't come back twice in a row.
  pick(mood: HoldMusicMood): HoldTrack {
    const fitting = this.tracks.filter((t) => t.mood === mood && !t.placeholder);
    if (!fitting.length) return this.tracks.find((t) => t.placeholder) ?? this.tracks[0];
    this.turns ??= new Map();
    const turn = this.turns.get(mood) ?? 0;
    this.turns.set(mood, turn + 1);
    return fitting[turn % fitting.length];
  }

  // Start a loop of a track that fits the mood at `at`, fading in to `levelDb`. Loops rotate per track.
  start(options: HoldMusicStart = {}): Promise<void> {
    if (this.voice) return Promise.resolve(this.setLevel(options.levelDb ?? HOLD_LEVEL_DB, 0.5));
    if (this.starting) return this.starting;
    this.starting = this.startNow(options).finally(() => (this.starting = null));
    return this.starting;
  }

  /**
   * Hold music of `mood`: the loop playing goes on (at the new level) if it is of that mood; otherwise it
   * fades out while one of that mood fades in. The Celebration and the Interval use it to change moods.
   */
  async switchTo(options: HoldMusicStart = {}): Promise<void> {
    const mood = options.mood ?? 'hold';
    if (this.starting) await this.starting.catch(() => {});
    if (this.voice?.mood === mood) return this.setLevel(options.levelDb ?? HOLD_LEVEL_DB, Math.max(0.3, options.fadeSec ?? 0.6));
    if (this.voice) this.stop({ at: options.at, fadeSec: options.fadeSec ?? 1.2 });
    return this.start(options);
  }

  async startNow({ at = this.ctx.currentTime, levelDb = HOLD_LEVEL_DB, fadeSec = 1.5, mood = 'hold' }: HoldMusicStart = {}, asked: HoldMusicMood = mood): Promise<void> {
    if (!this.tracks.length) await this.prepare();
    let track = this.pick(mood);
    try {
      track = await this.load(track);
    } catch (error) {
      console.warn('hold music', track.title, error);
      this.tracks = this.tracks.filter((t) => t !== track);
      return this.startNow({ at, levelDb, fadeSec, mood: 'hold' }, asked);
    }
    if (this.voice) return this.setLevel(levelDb, 0.5); // started meanwhile
    // Always the preferred body loop when there is one; otherwise the bar loops take turns.
    const loop = track.preferred ? track.loops[0] : track.loops[track.next % track.loops.length];
    track.next++;
    const { buffer } = loop;
    if (!buffer) throw new Error(`hold music ${track.title}: loop not decoded`); // never: load() decodes every loop
    const { ctx } = this;
    const when = Math.max(at, ctx.currentTime + 0.02);
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    // Loop points inside the track (tools/prep/hold.py): never a restart from the very start or end.
    source.loop = true;
    source.loopStart = loop.loopStartSec ?? 0;
    source.loopEnd = buffer.duration;
    const lpf = ctx.createBiquadFilter();
    lpf.type = 'lowpass';
    lpf.frequency.value = 22000;
    const gain = ctx.createGain();
    const trackGain = 10 ** (loop.gainDb / 20);
    gain.gain.setValueAtTime(0, when);
    gain.gain.linearRampToValueAtTime(trackGain * 10 ** (levelDb / 20), when + fadeSec);
    source.connect(lpf).connect(gain).connect(this.out(asked));
    source.start(when);
    const grid = loop.bars ? loopGrid({ startAt: when, offsetSec: 0, loopStartSec: source.loopStart, loopEndSec: source.loopEnd, bars: loop.bars, beatsPerBar: loop.beatsPerBar }) : null;
    this.voice = {
      source, gain, lpf, title: `${track.title}${track.loops.length > 1 ? ` · loop ${(track.next - 1) % track.loops.length + 1}` : ''}`, trackGain, levelDb, mood: asked, grid,
      startAt: when, offsetSec: 0, bars: loop.bars, beatsPerBar: loop.beatsPerBar,
    };
  }

  /** A mood's slider (D139): Hold music, the fail's, the win's (the victory track), the intros'. */
  out(mood: HoldMusicMood): AudioNode {
    const vol = this.graph.vol;
    return mood === 'error' ? vol.fail : mood === 'celebration' ? vol.win : mood === 'intro' ? vol.intros : vol.holdMusic;
  }

  /** Pausa (D128): the voice fades out from `at` and stops; what comes back is where it was then. Null when none plays. */
  suspend({ at = this.ctx.currentTime, fadeSec = 1.2 }: { at?: number; fadeSec?: number } = {}): SuspendedHold | null {
    const voice = this.voice;
    const buffer = voice?.source.buffer;
    if (!voice || !buffer) return null;
    const t = Math.max(at, this.ctx.currentTime);
    const posSec = loopPosition(voice.offsetSec, t - voice.startAt, voice.source.loopStart, voice.source.loopEnd);
    const saved: SuspendedHold = {
      buffer, posSec, loopStartSec: voice.source.loopStart, loopEndSec: voice.source.loopEnd, title: voice.title, trackGain: voice.trackGain,
      levelDb: voice.levelDb, mood: voice.mood, bars: voice.bars, beatsPerBar: voice.beatsPerBar,
    };
    this.stop({ at: t, fadeSec });
    return saved;
  }

  /** After Pausa: the voice it saved plays on from where it was, fading in from `at` (D135). */
  resume(saved: SuspendedHold, { at = this.ctx.currentTime, fadeSec = 1.5 }: { at?: number; fadeSec?: number } = {}): void {
    if (this.voice) this.stop({ fadeSec: 0.3 });
    const { ctx } = this;
    const when = Math.max(at, ctx.currentTime + 0.02);
    const source = ctx.createBufferSource();
    source.buffer = saved.buffer;
    source.loop = true;
    source.loopStart = saved.loopStartSec;
    source.loopEnd = saved.loopEndSec;
    const lpf = ctx.createBiquadFilter();
    lpf.type = 'lowpass';
    lpf.frequency.value = 22000;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0, when);
    gain.gain.linearRampToValueAtTime(saved.trackGain * 10 ** (saved.levelDb / 20), when + Math.max(0.05, fadeSec));
    source.connect(lpf).connect(gain).connect(this.out(saved.mood));
    source.start(when, saved.posSec);
    const grid = saved.bars ? loopGrid({ startAt: when, offsetSec: saved.posSec, loopStartSec: saved.loopStartSec, loopEndSec: saved.loopEndSec, bars: saved.bars, beatsPerBar: saved.beatsPerBar }) : null;
    this.voice = { source, gain, lpf, title: saved.title, trackGain: saved.trackGain, levelDb: saved.levelDb, mood: saved.mood, grid, startAt: when, offsetSec: saved.posSec, bars: saved.bars, beatsPerBar: saved.beatsPerBar };
  }

  /**
   * Hand the loop playing over to the Interval playlist (audio/interval.ts): it leaves this player, unplugged from
   * the Hold bus, and the playlist routes it on and echoes it out on one of its downbeats. Null when nothing plays.
   */
  handoff(): Handoff | null {
    const voice = this.voice;
    if (!voice) return null;
    this.voice = null;
    voice.gain.disconnect();
    return {
      title: voice.title,
      grid: voice.grid,
      output: voice.gain,
      bus: this.out(voice.mood),
      release: (at) => {
        try {
          voice.source.stop(Math.max(at, this.ctx.currentTime));
        } catch {}
        setTimeout(() => {
          for (const node of [voice.source, voice.lpf, voice.gain]) node.disconnect();
        }, Math.max(0, at - this.ctx.currentTime) * 1000 + 300);
      },
    };
  }

  setLevel(levelDb: number, seconds = 0.6): void {
    if (!this.voice) return;
    const { gain, trackGain } = this.voice;
    const now = this.ctx.currentTime;
    gain.gain.cancelScheduledValues(now);
    gain.gain.setValueAtTime(gain.gain.value, now);
    gain.gain.linearRampToValueAtTime(trackGain * 10 ** (levelDb / 20), now + seconds);
    this.voice.levelDb = levelDb;
  }

  // Leave: the low-pass closes while it fades, so the next song's build comes out of it.
  stop({ at = this.ctx.currentTime, fadeSec = 1.2 }: { at?: number; fadeSec?: number } = {}): void {
    const voice = this.voice;
    if (!voice) return;
    this.voice = null;
    const t = Math.max(at, this.ctx.currentTime);
    voice.gain.gain.cancelScheduledValues(t);
    voice.gain.gain.setValueAtTime(voice.gain.gain.value, t);
    voice.gain.gain.linearRampToValueAtTime(0, t + fadeSec);
    voice.lpf.frequency.setValueAtTime(voice.lpf.frequency.value, t);
    voice.lpf.frequency.exponentialRampToValueAtTime(250, t + fadeSec);
    voice.source.stop(t + fadeSec + 0.05);
    setTimeout(() => {
      for (const node of [voice.source, voice.lpf, voice.gain]) node.disconnect();
    }, (t - this.ctx.currentTime + fadeSec) * 1000 + 300);
  }

  kill(): void {
    if (!this.voice) return;
    try {
      this.voice.source.stop();
    } catch {}
    this.voice.gain.disconnect();
    this.voice = null;
  }
}
