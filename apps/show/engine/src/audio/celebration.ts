// The Celebration's 'winningSong' music: the Winning song's landed hook looped in whole bars (plan/hookloop.ts
// picks the region), on the Hold music bus so a Check ducks it like any other bed and a Hold never does.
import type { AudioGraph } from './graph.ts';
import type { HookLoop } from '../plan/hookloop.ts';
import { loopGrid, type OutgoingMusic } from '../interval/plan.ts';
import type { Handoff } from './interval.ts';

interface LoopVoice {
  source: AudioBufferSourceNode;
  gain: GainNode;
  /** The loop's bars on the audio clock: the Interval hands over on one of its downbeats. */
  grid: OutgoingMusic | null;
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
  start(buffer: AudioBuffer, region: HookLoop, { at, levelDb, fadeSec, beatsPerBar = 4 }: { at: number; levelDb: number; fadeSec: number; beatsPerBar?: number }): void {
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
    source.connect(gain).connect(this.graph.holdBus);
    source.start(when, region.startSec);
    const grid = loopGrid({ startAt: when, offsetSec: region.startSec, loopStartSec: region.loopStartSec, loopEndSec: region.loopEndSec, bars: region.bars, beatsPerBar });
    this.voice = { source, gain, grid };
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
      bus: this.graph.holdBus,
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
