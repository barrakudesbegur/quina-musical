// The Interval playlist on the audio graph: the break music between rounds, on its own bus under the music
// (graph.intervalBus, so the Hold duck, a Check and a build's high-pass treat it like the songs). It plays the
// Game's shuffled order (interval/plan.ts) and carries out every handover the plan describes:
//   - from the music playing when it starts (the victory track, Hold music, the Winning song's loop: a Handoff),
//     which echoes out on its own downbeat while the first track comes in on that downbeat, so the end of a round
//     flows into the Interval without a gap; from silence, the first track fades in;
//   - between tracks, ~8–12 s before the outgoing one's sound ends, on a downbeat;
//   - on a skip, on the playing track's next downbeat.
// A voice's chain: source → trim → hpf → lpf → fader → level → intervalBus, and fader → send → echo (delay ⟲
// hpf · feedback) → return → level. A bed handed over keeps its own bus. Only the playing track and the next one
// stay decoded.
import { INTERVAL } from '../config.ts';
import { checkIntervalTrack, intervalSlugs, type IntervalTrack } from '../interval/tracks.ts';
import {
  gameSeed,
  naturalHandoverSec,
  planHandover,
  trackAt,
  trackGrid,
  type Automation,
  type AutomationTarget,
  type EntryStyle,
  type Handover,
  type HandoverKind,
  type OutgoingMusic,
} from '../interval/plan.ts';
import type { AudioGraph } from './graph.ts';

/**
 * Music handed over to the playlist (HoldMusic.handoff, WinningLoop.handoff): it has left its player and is
 * unplugged; the playlist routes it on at once (nothing drops out) and echoes it out on one of its downbeats.
 */
export interface Handoff {
  title: string;
  /** Its downbeats on the audio clock, or null: the playlist then takes over as soon as it is ready. */
  grid: OutgoingMusic | null;
  /** Its output, after its own level. */
  output: AudioNode;
  /** Where it played: it goes on there, and its echo returns there. */
  bus: AudioNode;
  /** Stop its source at `at` and free its nodes. */
  release(at: number): void;
}

/** What the show state shows of the track playing (IntervalTrackInfo without its time). */
export interface IntervalTrackNow {
  title: string;
  artist: string;
  index: number;
  count: number;
}

/** Somewhere to keep how far this Game's order has got, so a reload doesn't play the same tracks again. */
export interface CursorStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

/** One piece of music the player controls: a track, or a bed handed over. */
interface Voice {
  track: IntervalTrack | null;
  /** The track's place in the Game's order (cursor), or −1 for a bed. */
  cursor: number;
  title: string;
  source: AudioBufferSourceNode | null;
  startAt: number;
  offsetSec: number;
  /** When its sound ends (a track), or null (a bed loops). */
  endsAt: number | null;
  grid: OutgoingMusic | null;
  hpf: BiquadFilterNode;
  lpf: BiquadFilterNode | null;
  fader: GainNode;
  send: GainNode;
  delay: DelayNode;
  echoHpf: BiquadFilterNode;
  feedback: GainNode;
  ret: GainNode;
  nodes: AudioNode[];
  /** A bed's own release (its source belongs to the player it came from). */
  release: ((at: number) => void) | null;
}

interface Pending {
  handover: Handover;
  incoming: Voice;
  outgoing: Voice | null;
}

const dbToGain = (db: number) => 10 ** (db / 20);

export class IntervalPlayer {
  readonly graph: AudioGraph;
  readonly ctx: BaseAudioContext;
  readonly level: GainNode;
  /** Called on a handover's downbeat: the track that now plays, and that downbeat (audio clock). */
  onTrack: ((track: IntervalTrackNow, at: number) => void) | null = null;
  tracks: IntervalTrack[] = [];
  private ready: Promise<void> | null = null;
  private readonly buffers = new Map<string, Promise<AudioBuffer>>();
  private readonly decoded = new Map<string, AudioBuffer>();
  private readonly failed = new Set<string>();
  private readonly storage: CursorStorage | null;
  private readonly storageKey: () => string;
  private gameId = '';
  private seed = 0;
  /** Tracks started in this Game (the next one is trackAt(cursor)). */
  private cursor = 0;
  private active = false;
  /** Bumped by stop(): an asynchronous start that finds it changed gives up. */
  private generation = 0;
  private current: Voice | null = null;
  private pending: Pending | null = null;
  private skipWanted = false;
  private styleTurn = 0;
  private readonly dying: { voice: Voice; at: number }[] = [];

  constructor(graph: AudioGraph, { storage = null, storageKey = () => 'mixer.interval' }: { storage?: CursorStorage | null; storageKey?: () => string } = {}) {
    this.graph = graph;
    this.ctx = graph.ctx;
    this.level = this.ctx.createGain();
    this.level.gain.value = dbToGain(INTERVAL.volumeDb);
    this.level.connect(graph.intervalBus);
    this.storage = storage;
    this.storageKey = storageKey;
  }

  /** Read data/interval/index.json and every track's JSON (analysis/interval.py); a track that fails its check is left out. */
  prepare(): Promise<void> {
    this.ready ??= (async () => {
      try {
        const index: unknown = await (await fetch('/data/interval/index.json', { cache: 'no-store' })).json();
        for (const slug of intervalSlugs(index)) {
          try {
            const json: unknown = await (await fetch(`/data/interval/${slug}.json`, { cache: 'no-store' })).json();
            this.tracks.push(checkIntervalTrack(json, this.ctx.sampleRate));
          } catch (error) {
            console.warn('interval track', slug, error);
          }
        }
      } catch (error) {
        console.warn('interval playlist', error);
      }
    })();
    return this.ready;
  }

  /** Something plays, or is about to (the first track is loading, a bed plays meanwhile). */
  get playing(): boolean {
    if (!this.active) return false;
    if (this.pending) return true;
    const cur = this.current;
    return cur == null || cur.endsAt == null || this.ctx.currentTime < cur.endsAt;
  }

  get title(): string | null {
    return this.active ? (this.current?.track ? this.current.title : null) : null;
  }

  // ---------------------------------------------------------------------------------------------- control
  /**
   * Start the playlist. `from`: the music playing now, handed over (it goes on until the first track comes in on
   * its downbeat); without it the first track fades in. Already playing: only the level changes.
   */
  start({ levelDb = INTERVAL.volumeDb, gameId = '', from = null }: { levelDb?: number; gameId?: string; from?: Handoff | null } = {}): void {
    if (this.active) {
      this.setVolume(levelDb);
      if (from) this.releaseBed(from, INTERVAL.fadeInSec);
      return;
    }
    this.active = true;
    this.skipWanted = false;
    const generation = ++this.generation;
    this.useGame(gameId);
    const now = this.ctx.currentTime;
    this.level.gain.cancelScheduledValues(now);
    this.level.gain.setValueAtTime(dbToGain(levelDb), now);
    this.current = from ? this.bedVoice(from) : null;
    void this.startFirst(generation);
  }

  /** Move on to the next track on the playing track's next downbeat. False when there is nothing to skip. */
  skip(): boolean {
    if (!this.active || this.pending || !this.current?.track) return false;
    this.skipWanted = true;
    this.tick();
    return true;
  }

  setVolume(db: number, seconds: number = INTERVAL.volumeGlideSec): void {
    const now = this.ctx.currentTime;
    const p = this.level.gain;
    p.cancelScheduledValues(now);
    p.setValueAtTime(p.value, now);
    p.linearRampToValueAtTime(dbToGain(db), now + Math.max(0.01, seconds));
  }

  /** Leave: everything fades out from `at` while its low-pass closes, so a build or other music comes out of it. */
  stop({ at = this.ctx.currentTime, fadeSec = 1.2 }: { at?: number; fadeSec?: number } = {}): void {
    if (!this.active) return;
    this.active = false;
    this.generation++;
    this.skipWanted = false;
    const t = Math.max(at, this.ctx.currentTime);
    const voices = [this.current, this.pending?.incoming, this.pending?.outgoing].filter((v): v is Voice => v != null);
    this.current = null;
    this.pending = null;
    for (const voice of new Set(voices)) this.fadeOut(voice, t, fadeSec);
    // Until the next Interval only its first track stays decoded, so it starts at once.
    this.keepDecoded();
  }

  /** Panic: silence at once. */
  kill(): void {
    this.stop({ fadeSec: 0.03 });
    for (const { voice } of this.dying.splice(0)) this.free(voice, this.ctx.currentTime);
  }

  /** Called every few tens of milliseconds: handovers come due, get planned, and old voices are freed. */
  tick(): void {
    const now = this.ctx.currentTime;
    for (let i = this.dying.length - 1; i >= 0; i--) {
      if (now >= this.dying[i].at) this.free(this.dying.splice(i, 1)[0].voice, now);
    }
    if (!this.active) return;
    const p = this.pending;
    if (p) {
      if (now < p.handover.at) return;
      this.pending = null;
      this.current = p.incoming;
      if (p.outgoing) this.retire(p.outgoing, p.handover.releaseAt);
      this.announce(p.incoming, p.handover.at);
      this.keepDecoded();
      return;
    }
    const cur = this.current;
    if (!cur?.track) return;
    const next = this.nextTrack();
    if (!next) return;
    const buffer = this.decoded.get(next.track.slug);
    if (!buffer) {
      void this.load(next.track).catch(() => {});
      return;
    }
    if (this.skipWanted) {
      this.skipWanted = false;
      return this.commit('skip', now, next.track, next.cursor, buffer, cur);
    }
    const naturalAt = cur.startAt + (naturalHandoverSec(cur.track) - cur.offsetSec);
    if (now < naturalAt - INTERVAL.overlapSec.max - INTERVAL.armLeadSec) return;
    // Late (the next track was slow to load): the next downbeat, like a skip.
    if (naturalAt < now + INTERVAL.skipLeadSec) this.commit('skip', now, next.track, next.cursor, buffer, cur);
    else this.commit('natural', now, next.track, next.cursor, buffer, cur, naturalAt);
  }

  // ---------------------------------------------------------------------------------------------- the order
  private useGame(gameId: string): void {
    if (gameId === this.gameId && this.seed) return;
    this.gameId = gameId;
    this.seed = gameSeed(gameId || String(Date.now()));
    this.cursor = 0;
    try {
      const saved = this.storage?.getItem(this.storageKey());
      const [savedGame, savedCursor] = saved?.split('|') ?? [];
      if (gameId && savedGame === gameId && Number.isInteger(Number(savedCursor))) this.cursor = Math.max(0, Number(savedCursor));
    } catch {}
  }

  private saveCursor(): void {
    if (!this.gameId) return;
    try {
      this.storage?.setItem(this.storageKey(), `${this.gameId}|${this.cursor}`);
    } catch {}
  }

  /** The next track of the order that can play (a track whose audio failed to load is passed over). */
  private nextTrack(): { track: IntervalTrack; cursor: number } | null {
    const count = this.tracks.length;
    for (let k = 0; k < count; k++) {
      const cursor = this.cursor + k;
      const track = this.tracks[trackAt(count, this.seed, cursor)];
      if (!this.failed.has(track.slug)) {
        this.cursor = cursor; // the failed ones count as played
        return { track, cursor };
      }
    }
    return null;
  }

  private async startFirst(generation: number): Promise<void> {
    await this.prepare();
    for (let attempt = 0; attempt <= this.tracks.length; attempt++) {
      if (generation !== this.generation) return;
      const next = this.nextTrack();
      if (!next) break;
      try {
        const buffer = await this.load(next.track);
        if (generation !== this.generation) return;
        return this.commit('start', this.ctx.currentTime, next.track, next.cursor, buffer, this.current);
      } catch (error) {
        console.warn('interval track', next.track.slug, error);
      }
    }
    // No playable track: the music handed over goes on as it is (the watchdog covers silence).
    console.warn('interval: no playable track');
  }

  // ---------------------------------------------------------------------------------------------- a handover
  private commit(kind: HandoverKind, now: number, track: IntervalTrack, cursor: number, buffer: AudioBuffer, outgoing: Voice | null, at?: number): void {
    const style: EntryStyle = this.styleTurn++ % 2 ? 'filter' : 'swell';
    const handover = planHandover({ kind, now, out: outgoing ? outgoing.grid ?? NO_GRID : null, incoming: track, style, at });
    const incoming = this.trackVoice(track, cursor, buffer, handover.incoming.startAt, handover.incoming.offsetSec);
    this.automate(handover.automation, incoming, outgoing);
    this.cursor = cursor + 1;
    this.saveCursor();
    this.pending = { handover, incoming, outgoing };
    // The one after it starts decoding now; it is needed in a couple of minutes, or at the next skip.
    const after = this.nextTrack();
    if (after) void this.load(after.track).catch(() => {});
  }

  private automate(automation: readonly Automation[], incoming: Voice, outgoing: Voice | null): void {
    const params = new Map<AutomationTarget, AudioParam | null>([
      ['in.gain', incoming.fader.gain],
      ['in.hpf', incoming.hpf.frequency],
      ['in.lpf', incoming.lpf?.frequency ?? null],
      ['out.gain', outgoing?.fader.gain ?? null],
      ['out.hpf', outgoing?.hpf.frequency ?? null],
      ['echo.send', outgoing?.send.gain ?? null],
      ['echo.time', outgoing?.delay.delayTime ?? null],
      ['echo.feedback', outgoing?.feedback.gain ?? null],
      ['echo.hpf', outgoing?.echoHpf.frequency ?? null],
      ['echo.return', outgoing?.ret.gain ?? null],
    ]);
    const started = new Set<AutomationTarget>();
    for (const a of automation) {
      const param = params.get(a.target);
      if (!param) continue;
      if (!started.has(a.target)) {
        // A voice that hands over again (it came in through earlier automation) starts this one afresh.
        started.add(a.target);
        param.cancelScheduledValues(a.at);
      }
      if (a.curve === 'set') param.setValueAtTime(a.value, a.at);
      else if (a.curve === 'linear') param.linearRampToValueAtTime(a.value, a.at);
      else param.exponentialRampToValueAtTime(Math.max(1e-4, a.value), a.at);
    }
  }

  private announce(voice: Voice, at: number): void {
    const { track } = voice;
    if (!track || !this.onTrack) return;
    const count = this.tracks.length;
    this.onTrack({ title: track.title, artist: track.artist, index: (voice.cursor % count) + 1, count }, at);
  }

  // ---------------------------------------------------------------------------------------------- voices
  private chain(voice: Omit<Voice, 'hpf' | 'lpf' | 'fader' | 'send' | 'delay' | 'echoHpf' | 'feedback' | 'ret' | 'nodes'>, input: AudioNode, dest: AudioNode, withLpf: boolean): Voice {
    const { ctx } = this;
    const hpf = ctx.createBiquadFilter();
    hpf.type = 'highpass';
    hpf.frequency.value = 20;
    const lpf = withLpf ? ctx.createBiquadFilter() : null;
    if (lpf) {
      lpf.type = 'lowpass';
      lpf.frequency.value = INTERVAL.filterOpenHz;
    }
    const fader = ctx.createGain();
    const send = ctx.createGain();
    send.gain.value = 0;
    const delay = ctx.createDelay(3);
    delay.delayTime.value = INTERVAL.fallbackBeatSec;
    const echoHpf = ctx.createBiquadFilter();
    echoHpf.type = 'highpass';
    echoHpf.frequency.value = INTERVAL.echoHpfHz.from;
    const feedback = ctx.createGain();
    feedback.gain.value = INTERVAL.echoFeedback;
    const ret = ctx.createGain();
    input.connect(hpf);
    (lpf ? hpf.connect(lpf) : hpf).connect(fader).connect(dest);
    fader.connect(send).connect(delay).connect(echoHpf).connect(ret).connect(dest);
    echoHpf.connect(feedback).connect(delay);
    return { ...voice, hpf, lpf, fader, send, delay, echoHpf, feedback, ret, nodes: [input, hpf, ...(lpf ? [lpf] : []), fader, send, delay, echoHpf, feedback, ret] };
  }

  private trackVoice(track: IntervalTrack, cursor: number, buffer: AudioBuffer, startAt: number, offsetSec: number): Voice {
    const { ctx } = this;
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    const trim = ctx.createGain();
    trim.gain.value = dbToGain(track.gainToTargetDb);
    source.connect(trim);
    const when = Math.max(startAt, ctx.currentTime);
    source.start(when, offsetSec + (when - startAt));
    const voice = this.chain(
      { track, cursor, title: track.title, source, startAt, offsetSec, endsAt: startAt + (buffer.duration - offsetSec), grid: trackGrid(track, startAt, offsetSec), release: null },
      trim, this.level, true,
    );
    voice.nodes.unshift(source);
    return voice;
  }

  /** The music handed over, routed on at once: through the player's chain to its own bus, unchanged until the handover. */
  private bedVoice(bed: Handoff): Voice {
    return this.chain(
      { track: null, cursor: -1, title: bed.title, source: null, startAt: this.ctx.currentTime, offsetSec: 0, endsAt: null, grid: bed.grid, release: (at) => bed.release(at) },
      bed.output, bed.bus, false,
    );
  }

  /** A bed that arrives while the playlist already plays: it fades out on its own bus. */
  private releaseBed(bed: Handoff, fadeSec: number): void {
    const voice = this.bedVoice(bed);
    this.fadeOut(voice, this.ctx.currentTime, fadeSec);
  }

  private fadeOut(voice: Voice, t: number, fadeSec: number): void {
    // A track that has not come in yet never sounds.
    if (voice.source && voice.startAt >= t) return this.retire(voice, Math.max(this.ctx.currentTime, t));
    for (const p of [voice.fader.gain, voice.ret.gain, voice.send.gain]) p.cancelAndHoldAtTime(t);
    voice.fader.gain.linearRampToValueAtTime(0, t + fadeSec);
    voice.ret.gain.linearRampToValueAtTime(0, t + fadeSec);
    if (voice.lpf) {
      voice.lpf.frequency.cancelAndHoldAtTime(t);
      voice.lpf.frequency.exponentialRampToValueAtTime(250, t + fadeSec);
    }
    this.retire(voice, t + fadeSec + 0.05);
  }

  /** It is silent from `at`: stop it then, free its nodes a moment later. */
  private retire(voice: Voice, at: number): void {
    if (voice.source) {
      try {
        voice.source.stop(Math.max(at, this.ctx.currentTime));
      } catch {}
    }
    voice.release?.(at);
    voice.release = null;
    this.dying.push({ voice, at: at + 0.3 });
  }

  private free(voice: Voice, now: number): void {
    if (voice.source) {
      try {
        voice.source.stop(now);
      } catch {}
    }
    voice.release?.(now);
    for (const node of voice.nodes) node.disconnect();
  }

  // ---------------------------------------------------------------------------------------------- audio
  private load(track: IntervalTrack): Promise<AudioBuffer> {
    let promise = this.buffers.get(track.slug);
    if (!promise) {
      promise = (async () => {
        const response = await fetch(`/intervalaudio/${encodeURIComponent(track.slug)}.flac`);
        if (!response.ok) throw new Error(`interval audio ${track.slug}: HTTP ${response.status}`);
        const buffer = await this.ctx.decodeAudioData(await response.arrayBuffer());
        this.decoded.set(track.slug, buffer);
        return buffer;
      })();
      promise.catch((error: unknown) => {
        console.warn('interval audio', track.slug, error);
        this.buffers.delete(track.slug);
        this.failed.add(track.slug);
      });
      this.buffers.set(track.slug, promise);
    }
    return promise;
  }

  /** Keep only the playing track (if any) and the next one decoded (a 3-minute track is ~70 MB as float32). */
  private keepDecoded(): void {
    const keep = new Set([this.current?.track?.slug, this.tracks.length ? this.nextTrack()?.track.slug : null].filter((s) => s != null));
    for (const slug of [...this.buffers.keys()]) {
      if (keep.has(slug)) continue;
      this.buffers.delete(slug);
      this.decoded.delete(slug);
    }
  }
}

/** A bed without a grid: the handover takes the first free moment, with the fallback beat for its echo. */
const NO_GRID: OutgoingMusic = { downbeatAfter: () => null, beatSec: null, beatsPerBar: 4 };
