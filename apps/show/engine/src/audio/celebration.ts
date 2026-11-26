// The Celebration's 'winningSong' music: the Winning song's landed hook looped in whole bars (plan/hookloop.ts
// picks the region), on the Hold music bus (through the win slider) so a Check ducks it like any other bed and a
// Hold never does.
import type { AudioGraph } from './graph.ts';
import type { HookLoop } from '../plan/hookloop.ts';
import { loopGrid, type OutgoingMusic } from '../interval/plan.ts';
import type { Handoff } from './interval.ts';
import { loopPosition } from './holdmusic.ts';

interface LoopVoice {
  source: AudioBufferSourceNode;
  gain: GainNode;
  /** The loop's bars on the audio clock: the Interval hands over on one of its downbeats. */
  grid: OutgoingMusic | null;
  /** What it plays, from when (Pausa saves where it is, D128). */
  buffer: AudioBuffer;
  region: HookLoop;
  levelDb: number;
  beatsPerBar: number;
  startAt: number;
  offsetSec: number;
}

/** The loop Pausa took off: it comes back from `posSec`. */
export interface SuspendedLoop {
  buffer: AudioBuffer;
  region: HookLoop;
  levelDb: number;
  beatsPerBar: number;
  posSec: number;
}

export class WinningLoop {
  readonly graph: AudioGraph;
  voice: LoopVoice | null = null;

  constructor(graph: AudioGraph) {
    this.graph = graph;
  }

  get playing(): boolean {
    return this.voice != null;
  }

  /** Play `region` of `buffer` from `at`: the pickup once, then the bars on a loop, fading in to `levelDb`. */
  start(buffer: AudioBuffer, region: HookLoop, { at, levelDb, fadeSec, beatsPerBar = 4, fromSec = region.startSec }: { at: number; levelDb: number; fadeSec: number; beatsPerBar?: number; fromSec?: number }): void {
    const { ctx } = this.graph;
    this.stop({ fadeSec: 0.3 });
    const when = Math.max(at, ctx.currentTime + 0.02);
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.loop = true;
    source.loopStart = region.loopStartSec;
    source.loopEnd = region.loopEndSec;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0, when);
    gain.gain.linearRampToValueAtTime(10 ** ((levelDb + region.gainDb) / 20), when + Math.max(0.05, fadeSec));
    source.connect(gain).connect(this.graph.vol.win);
    source.start(when, fromSec);
    const grid = loopGrid({ startAt: when, offsetSec: fromSec, loopStartSec: region.loopStartSec, loopEndSec: region.loopEndSec, bars: region.bars, beatsPerBar });
    this.voice = { source, gain, grid, buffer, region, levelDb, beatsPerBar, startAt: when, offsetSec: fromSec };
  }

  /** Pausa (D128): the loop fades out from `at`; what comes back is where it was then. Null when none plays. */
  suspend({ at = this.graph.ctx.currentTime, fadeSec = 1.2 }: { at?: number; fadeSec?: number } = {}): SuspendedLoop | null {
    const voice = this.voice;
    if (!voice) return null;
    const t = Math.max(at, this.graph.ctx.currentTime);
    const posSec = loopPosition(voice.offsetSec, t - voice.startAt, voice.region.loopStartSec, voice.region.loopEndSec);
    this.stop({ at: t, fadeSec });
    return { buffer: voice.buffer, region: voice.region, levelDb: voice.levelDb, beatsPerBar: voice.beatsPerBar, posSec };
  }

  /** After Pausa: the loop plays on from where it was, fading in (D135). */
  resume(saved: SuspendedLoop, { at, fadeSec }: { at: number; fadeSec: number }): void {
    this.start(saved.buffer, saved.region, { at, levelDb: saved.levelDb, fadeSec, beatsPerBar: saved.beatsPerBar, fromSec: saved.posSec });
  }

  /** Hand the loop over to the Interval playlist, which echoes it out on one of its downbeats (see HoldMusic.handoff). */
  handoff(): Handoff | null {
    const voice = this.voice;
    if (!voice) return null;
    this.voice = null;
    voice.gain.disconnect();
    const { ctx } = this.graph;
    return {
      title: 'Winning song',
      grid: voice.grid,
      output: voice.gain,
      bus: this.graph.vol.win,
      release: (at) => {
        try {
          voice.source.stop(Math.max(at, ctx.currentTime));
        } catch {}
        setTimeout(() => {
          voice.source.disconnect();
          voice.gain.disconnect();
        }, Math.max(0, at - ctx.currentTime) * 1000 + 300);
      },
    };
  }

  stop({ at = this.graph.ctx.currentTime, fadeSec = 1 }: { at?: number; fadeSec?: number } = {}): void {
    const voice = this.voice;
    if (!voice) return;
    this.voice = null;
    const { ctx } = this.graph;
    const t = Math.max(at, ctx.currentTime);
    voice.gain.gain.cancelScheduledValues(t);
    voice.gain.gain.setValueAtTime(voice.gain.gain.value, t);
    voice.gain.gain.linearRampToValueAtTime(0, t + fadeSec);
    voice.source.stop(t + fadeSec + 0.05);
    setTimeout(() => voice.gain.disconnect(), (t - ctx.currentTime + fadeSec) * 1000 + 300);
  }
}
