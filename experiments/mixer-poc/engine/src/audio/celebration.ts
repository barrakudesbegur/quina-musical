// The Celebration's 'winningSong' music: the Winning song's landed hook looped in whole bars (plan/hookloop.ts
// picks the region), on the Hold music bus so a Check ducks it like any other bed and a Hold never does.
import type { AudioGraph } from './graph.ts';
import type { HookLoop } from '../plan/hookloop.ts';

interface LoopVoice {
  source: AudioBufferSourceNode;
  gain: GainNode;
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
  start(buffer: AudioBuffer, region: HookLoop, { at, levelDb, fadeSec }: { at: number; levelDb: number; fadeSec: number }): void {
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
    this.voice = { source, gain };
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
