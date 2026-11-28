// A Check's sound, paced by the presenters (D107; show.ts CheckRevealEffect, CheckDuckEffect): each revealed landed
// song plays from its best hook's pickup until the next reveal, a step back or the Check's end; near its end it repeats
// its last phrase, as a song left playing does anywhere else (D239, plan/checksong.ts), before its audio dies. A song
// that has not landed gets the "broken record" (in a standing Check, where not landing is the point, a short knock
// instead), at the time the machine set for each press. A press cuts the sound before it. Everything else (the songs, Hold music, the Celebration's loop) is ducked far down from the
// first reveal until the cue, or a step back to none.
//
// A ✓ starts at once on the song's snippet (tools/prep/snippets.py cuts 3 s from that pickup, /snippets/<id>.flac, its
// loudness trim and pickup in data/snippets/index.json), while the full song is fetched and decoded on the side (its
// own small window, so the round's decoded songs stay where they are). As soon as the song is decoded the snippet hands
// over to it, sample-aligned at the same level, so the switch can't be heard. Until then, or when the song can't be
// loaded, the snippet itself loops back to its start, so a ✓ is never silent.
import { brokenRecord } from './synth/broken.ts';
import { stillKnock } from './synth/still.ts';
import { audibleEndSec, atFrame, entryOffset, equalPowerCurves, handoverAt, pickupLoop, snippetStartSec, songLoop, songSecAt, type CheckLoop, type VoiceClock } from '../plan/checksong.ts';
import { LOOP } from '../config.ts';
import { bestHook } from '../plan/hookloop.ts';
import type { AudioGraph } from './graph.ts';
import type { DecodedSong } from './loader.ts';
import type { TimedStep } from '../game/check.ts';

/** data/snippets/index.json (tools/prep/snippets.py): the fields read here. */
interface SnippetIndexEntry {
  id: number;
  gainDb: number;
  hookId?: unknown;
  startSec?: unknown;
}

/** Where a song's snippet starts in the song: its hook's pickup. */
export interface SnippetPick {
  hookId: string | null;
  startSec: number;
}

const isRecord = (x: unknown): x is Record<string, unknown> => typeof x === 'object' && x !== null;
const isEntry = (x: unknown): x is SnippetIndexEntry => isRecord(x) && Number.isInteger(x.id) && typeof x.gainDb === 'number' && Number.isFinite(x.gainDb);

/** The snippets, decoded on demand (a Bingo's Check needs 12; a few dozen stay decoded). */
export class SnippetStore {
  readonly ctx: BaseAudioContext;
  readonly gains = new Map<number, number>();
  readonly picks = new Map<number, SnippetPick>();
  readonly buffers = new Map<number, Promise<AudioBuffer | null>>();
  private index: Promise<void> | null = null;
  static readonly KEEP = 36;

  constructor(ctx: BaseAudioContext) {
    this.ctx = ctx;
  }

  /** The loudness trims and pickups. Never rejects: without the index every snippet plays untrimmed. */
  loadIndex(): Promise<void> {
    this.index ??= (async () => {
      try {
        const response = await fetch('/data/snippets/index.json', { cache: 'no-store' });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const json: unknown = await response.json();
        const songs: unknown[] = isRecord(json) && Array.isArray(json.songs) ? json.songs : [];
        for (const s of songs) {
          if (!isEntry(s)) continue;
          this.gains.set(s.id, s.gainDb);
          if (typeof s.startSec === 'number' && Number.isFinite(s.startSec) && s.startSec >= 0) {
            this.picks.set(s.id, { hookId: typeof s.hookId === 'string' ? s.hookId : null, startSec: s.startSec });
          }
        }
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

/** Where a Check's full songs come from (main.ts): one the round has decoded already, else the Check's own window. */
export interface CheckSongSource {
  /** The decoded song, decoding it if needed. */
  ensure(songId: number): Promise<DecodedSong>;
  /** Keep only these in the Check's own window (the round's songs are never touched). */
  retain(songIds: readonly number[]): void;
}

/** FLOW.check: the levels and timings read here. */
export interface CheckTuning {
  duckDb: number;
  duckFadeSec: number;
  snippetDb: number;
  brokenDb: number;
  stillDb: number;
  cutFadeSec: number;
  endFadeSec: number;
  handoverSec: number;
  handoverLeadSec: number;
  pickupXfadeSec: number;
  loopAheadSec: number;
  tailWindowSec: number;
  tailDropDb: number;
  tailRefSec: number;
  snippetTailSec: number;
  lateMinAheadSec: number;
}

/** One pass of the snippet or the song on the audio clock: it jumps back to the pickup at `outAt`. */
interface Voice extends VoiceClock {
  kind: 'snippet' | 'song';
  source: AudioBufferSourceNode;
  gain: GainNode;
  loop: CheckLoop;
  outAt: number;
  /** From here on the voice is at its level, its fade-in over (a handover's ramps may start). */
  fullAt: number;
}

/** A ✓ reveal's song: what it can play, and the pass sounding. */
interface SongSound {
  songId: number;
  at: number;
  out: GainNode;
  level: number;
  pick: SnippetPick | null;
  snippet: { buffer: AudioBuffer; loop: CheckLoop } | null;
  song: { buffer: AudioBuffer; loop: CheckLoop } | null;
  /** The pass sounding, or the next one once it is scheduled. */
  voice: Voice | null;
  /** The snippet's exact start in the song (snippetStartSec), found at the handover. */
  originSec: number | null;
  sources: Set<AudioBufferSourceNode>;
}

/** What a ✓ reveal is playing now, for the debug view and the audio checks. */
export interface CheckPlaying {
  songId: number;
  kind: 'snippet' | 'song';
  /** The song second playing (the snippet's in song seconds too). */
  songSec: number;
  /** Where this pass jumps back to the pickup (context time). */
  outAt: number;
}

/** Plays one Check's reveals; a new reveal cuts the one before, and cancel() stops them all. */
export class CheckPlayer {
  readonly graph: AudioGraph;
  readonly snippets: SnippetStore;
  readonly songs: CheckSongSource;
  readonly tuning: CheckTuning;
  /** The reveal sounding now: its own gain, so the next press can cut it. */
  private out: GainNode | null = null;
  private sound: SongSound | null = null;
  /** Each decoded song's audible end, measured once. */
  private ends = new WeakMap<AudioBuffer, number>();
  claimId: string | null = null;

  constructor(graph: AudioGraph, snippets: SnippetStore, songs: CheckSongSource, tuning: CheckTuning) {
    this.graph = graph;
    this.snippets = snippets;
    this.songs = songs;
    this.tuning = tuning;
  }

  /** The music under the Check goes far down (from the first reveal), or comes back up: then the revealed song gives
   * way (a step back to none, the Check's end). */
  duck(on: boolean): void {
    for (const node of [this.graph.checkDuck.music, this.graph.checkDuck.hold]) this.graph.glide(node.gain, on ? this.tuning.duckDb : 0, this.tuning.duckFadeSec);
    if (!on) this.stopSounds(this.graph.ctx.currentTime, this.tuning.endFadeSec);
  }

  /**
   * One revealed song at `step.at`: its song (from the snippet on), the broken record or the knock. The sound before it
   * stops. `nextSongId`: the next ✓'s song, decoded meanwhile so its reveal goes straight to it.
   */
  reveal(claimId: string, step: TimedStep, nextSongId: number | null = null): void {
    const previous = this.sound?.songId;
    this.stopSounds(Math.max(this.graph.ctx.currentTime, step.at - 0.02), this.tuning.cutFadeSec);
    const { ctx } = this.graph;
    const out = ctx.createGain();
    out.connect(this.graph.checkBus);
    this.out = out;
    this.claimId = claimId;
    void this.snippets.loadIndex();
    if (step.sound === 'snippet') {
      // The one before stays decoded for a step back; the next is decoded once this one is.
      this.songs.retain([previous, step.songId, nextSongId].filter((id) => id != null));
      this.playSong(out, step, nextSongId);
    } else if (step.sound === 'still') stillKnock(ctx, out, { t0: step.at, levelDb: this.tuning.stillDb });
    else brokenRecord(ctx, out, { t0: step.at, durationSec: step.durationSec, levelDb: this.tuning.brokenDb });
  }

  /** What the ✓ reveal plays now, or null. */
  playing(): CheckPlaying | null {
    const voice = this.sound?.voice;
    if (!this.sound || !voice) return null;
    return { songId: this.sound.songId, kind: voice.kind, songSec: songSecAt(voice, Math.max(voice.at, this.graph.ctx.currentTime)), outAt: voice.outAt };
  }

  /** The runtime's tick: the next pass is scheduled ahead of its jump, and a snippet waiting for its song hands over. */
  tick(): void {
    const sound = this.sound;
    const voice = sound?.voice;
    if (!sound || !voice) return;
    if (voice.kind === 'snippet' && sound.song) this.handover(sound, voice, sound.song);
    const current = sound.voice;
    if (current && this.graph.ctx.currentTime >= current.outAt - this.tuning.loopAheadSec) this.nextPass(sound, current);
  }

  private playSong(out: GainNode, step: TimedStep, nextSongId: number | null): void {
    const { songId, at } = step;
    const sound: SongSound = { songId, at, out, level: 0, pick: null, snippet: null, song: null, voice: null, originSec: null, sources: new Set() };
    this.sound = sound;
    const live = () => this.sound === sound;
    const index = this.snippets.loadIndex().then(() => {
      sound.pick = this.snippets.picks.get(songId) ?? null;
      sound.level = 10 ** (((this.snippets.gains.get(songId) ?? 0) + this.tuning.snippetDb) / 20);
    });
    void Promise.all([this.snippets.get(songId), index]).then(([buffer]) => {
      if (!buffer || !live()) return;
      const loop = pickupLoop({ startSec: 0, endSec: buffer.duration - this.tuning.snippetTailSec, xfadeSec: this.tuning.pickupXfadeSec });
      sound.snippet = { buffer, loop };
      // The song got here first (it was decoded already): it plays, the snippet is not needed.
      if (!sound.voice) this.begin(sound, 'snippet');
    });
    const decoded = this.songs.ensure(songId);
    void Promise.all([decoded, index])
      .then(([song]) => {
        if (!live()) return;
        sound.song = { buffer: song.buffer, loop: this.songLoop(sound, song) };
        if (!sound.voice) this.begin(sound, 'song');
        else if (sound.voice.kind === 'snippet') this.handover(sound, sound.voice, sound.song);
      })
      .catch((error: unknown) => console.warn('check: the full song is not available, its snippet loops', songId, error));
    if (nextSongId != null && nextSongId !== songId) {
      void decoded
        .catch(() => undefined)
        .then(() => (live() ? this.songs.ensure(nextSongId) : undefined))
        .catch((error: unknown) => console.warn('check: prefetch', nextSongId, error));
    }
  }

  /** The song's loop: from the snippet's pickup (else its best hook's) into its last phrase, before its audio dies. */
  private songLoop(sound: SongSound, { buffer, analysis }: DecodedSong): CheckLoop {
    const hook = analysis.hooks.find((h) => h.valid && h.id === sound.pick?.hookId) ?? bestHook(analysis);
    const startSec = sound.pick?.startSec ?? (hook ? Math.max(0, hook.downbeatSec - (hook.pickupSec || 0)) : 0);
    let endSec = this.ends.get(buffer);
    if (endSec == null) {
      const channels = Array.from({ length: buffer.numberOfChannels }, (_, c) => buffer.getChannelData(c));
      endSec = audibleEndSec(channels, buffer.sampleRate, { refStartSec: startSec, refSec: this.tuning.tailRefSec, windowSec: this.tuning.tailWindowSec, dropDb: this.tuning.tailDropDb });
      this.ends.set(buffer, endSec);
    }
    const hookDownbeatIndex = hook && hook.downbeatSec >= startSec - 1e-3 ? hook.downbeatIndex : null;
    return songLoop({ analysis, startSec, hookDownbeatIndex, audibleEndSec: endSec, stayTailSec: LOOP.stayTailSec, phraseXfadeSec: LOOP.fadeSec, pickupXfadeSec: this.tuning.pickupXfadeSec });
  }

  /** The reveal's first pass: at `at` (or as soon as it can, as far in as the reveal is old), fading in over 10 ms. */
  private begin(sound: SongSound, kind: Voice['kind']): void {
    const { ctx } = this.graph;
    const material = kind === 'song' ? sound.song : sound.snippet;
    if (!material) return;
    const start = atFrame(Math.max(sound.at, ctx.currentTime + 0.01), ctx.sampleRate);
    const offsetSec = entryOffset(material.loop, start - sound.at, this.tuning.lateMinAheadSec);
    const voice = this.voice(sound, kind, start, offsetSec);
    voice.gain.gain.setValueAtTime(0, start);
    voice.gain.gain.linearRampToValueAtTime(sound.level, start + 0.01);
    voice.fullAt = this.after(start + 0.01);
    sound.voice = voice;
  }

  /** The snippet hands over to the song at the same song second, sample-aligned: a linear crossfade (both play the
   * same samples, so their gains add up to one). Too late in this pass (or no pickup known to align on): the next pass
   * is the song's. */
  private handover(sound: SongSound, snippet: Voice, song: NonNullable<SongSound['song']>): void {
    const { ctx } = this.graph;
    const t = this.tuning;
    if (!sound.pick || !sound.snippet) return;
    const at = handoverAt({ now: ctx.currentTime, voiceAt: snippet.fullAt, outAt: snippet.outAt - snippet.loop.xfadeSec, leadSec: t.handoverLeadSec, xfadeSec: t.handoverSec, sampleRate: ctx.sampleRate });
    if (at == null) return;
    sound.originSec ??= snippetStartSec(sound.snippet.buffer.getChannelData(0), song.buffer.getChannelData(0), ctx.sampleRate, sound.pick.startSec);
    const offsetSec = songSecAt({ ...snippet, originSec: sound.originSec }, at);
    if (offsetSec + t.lateMinAheadSec > song.loop.outSec) return;
    const voice = this.voice(sound, 'song', at, offsetSec);
    voice.gain.gain.setValueAtTime(0, at);
    voice.gain.gain.linearRampToValueAtTime(sound.level, at + t.handoverSec);
    voice.fullAt = this.after(at + t.handoverSec);
    snippet.gain.gain.setValueAtTime(sound.level, at);
    snippet.gain.gain.linearRampToValueAtTime(0, at + t.handoverSec);
    snippet.source.stop(at + t.handoverSec + 0.01);
    sound.voice = voice;
  }

  /** The next pass at the jump: the song's when it is decoded (from its loop's start, or from its pickup after the
   * snippet), else the snippet's again. It fades in over the outgoing pass's last crossfade, equal power, so the loop's
   * start sounds exactly at the jump. */
  private nextPass(sound: SongSound, voice: Voice): void {
    const kind = sound.song ? 'song' : 'snippet';
    const material = sound.song ?? sound.snippet;
    if (!material) return;
    const fromSec = kind === voice.kind ? material.loop.fromSec : material.loop.startSec;
    const jump = voice.outAt;
    const x = voice.loop.xfadeSec;
    const t0 = jump - x;
    const next = this.voice(sound, kind, t0, Math.max(0, fromSec - x));
    const curves = equalPowerCurves(sound.level, 64);
    next.gain.gain.setValueAtTime(0, t0);
    next.gain.gain.setValueCurveAtTime(curves.in, t0, x);
    next.fullAt = this.after(jump);
    voice.gain.gain.setValueAtTime(sound.level, t0);
    voice.gain.gain.setValueCurveAtTime(curves.out, t0, x);
    voice.source.stop(jump + 0.01);
    sound.voice = next;
  }

  /** A frame past `t`: the next automation on a gain never lands on the end of the one before. */
  private after(t: number): number {
    return atFrame(t, this.graph.ctx.sampleRate) + 2 / this.graph.ctx.sampleRate;
  }

  /** A pass of the snippet or the song from `offsetSec` (in its buffer) at `at`, into the reveal's gain. */
  private voice(sound: SongSound, kind: Voice['kind'], at: number, offsetSec: number): Voice {
    const { ctx } = this.graph;
    const material = kind === 'song' ? sound.song! : sound.snippet!;
    const source = ctx.createBufferSource();
    source.buffer = material.buffer;
    const gain = ctx.createGain();
    gain.gain.value = 0;
    source.connect(gain).connect(sound.out);
    source.start(at, offsetSec);
    sound.sources.add(source);
    source.onended = () => {
      sound.sources.delete(source);
      source.disconnect();
      gain.disconnect();
    };
    const originSec = kind === 'song' ? 0 : (sound.pick?.startSec ?? 0);
    return { kind, source, gain, loop: material.loop, at, offsetSec, originSec, outAt: at + (material.loop.outSec - offsetSec), fullAt: at };
  }

  /** The reveal sounding now fades out from `at` over `fadeSec`. */
  private stopSounds(at: number, fadeSec: number): void {
    const out = this.out;
    const sound = this.sound;
    this.out = null;
    this.sound = null;
    if (!out) return;
    out.gain.cancelScheduledValues(at);
    out.gain.setValueAtTime(out.gain.value, at);
    out.gain.linearRampToValueAtTime(0, at + fadeSec);
    for (const s of sound?.sources ?? []) {
      try {
        s.stop(at + fadeSec + 0.02);
      } catch {}
    }
    setTimeout(() => out.disconnect(), (Math.max(0, at - this.graph.ctx.currentTime) + fadeSec) * 1000 + 400);
  }

  /** Stop the Check's sounds and bring everything else back up; the Check's own decoded songs are let go. */
  cancel(): void {
    this.duck(false);
    this.songs.retain([]);
    this.claimId = null;
  }
}
