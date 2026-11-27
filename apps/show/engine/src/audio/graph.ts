// The show's Web Audio graph (each [slider] is a volume of D139, `vol`):
//   decks (trim → HPF → LPF → fader) → musicBus → [songs] → holdDuck → checkDuck.music → busHPF ┐
//   the breaks' and the end's sets (tracks, their echo-outs) → [breaks] [end] → intervalBus → holdDuck ┘ (under the music)
//   Hold music → [holdMusic], the error Hold music → [fail], the victory track and the Celebration's loop → [win],
//     the intro track → [intros] → holdBus → bedDuck (Parlem in a Celebration) → checkDuck.hold ┤
//   a Check's snippets and "broken record" sounds → checkBus → [check] ┤
//   deck fader → echo send → echo (delay ⟲ HPF · feedback) → echo return → [djFx] ┤
//   deck fader → reverb send → convolver → HPF → reverb return → [djFx] ┤
//   synth layers (riser, snare roll, swell, impact) → synthBus → [djFx] ┤
//   samples (boom, orchestra-hit) + whoosh → fxBus → [djFx] ┤
//   the presenters' effects [padFx], the fanfares [win] [fail] [finalLap] ┤
//   drum ticks → drumBus → [ticks] ┤
//   the Pausa set → [pausa] ┤
//   everything above but fx, the Check and Pausa → throwDuck (a throw song's music under it) ┘
//   throwDuck, the throw song [throws], the doors' music [doors], the Pausa set [pausa] → voiceDuck (the music under a voice cue) ┤
//   the voice cues (chime, fanfare, voice) → [voices] ┤→ master → [master] → headroom (MIX.headroomDb) → limiter → destination

import { AUTO_SOUNDS, AUTO_SOUNDS_DEFAULT, VOLUME_KEYS, type AutoSound, type AutoSounds, type VolumeKey } from '@quina/protocol';
import { MIX } from '../config.ts';

/** A shared parameter the plans automate (recipes.ts ParamTarget), plus the master gain and the Hold duck. */
const GRAPH_PARAMS = ['echo.time', 'echo.feedback', 'echo.hpf', 'echo.return', 'reverb.return', 'reverb.hpf', 'bus.hpf', 'master', 'duck'] as const;
export type GraphParam = (typeof GRAPH_PARAMS)[number];
export const isGraphParam = (name: string): name is GraphParam => (GRAPH_PARAMS as readonly string[]).includes(name); // widened so any string can be tested

/** The tempo-synced echo shared by all decks: input → delay ⟲ HPF · feedback → return. */
export interface EchoBus {
  input: GainNode;
  delay: DelayNode;
  hpf: BiquadFilterNode;
  feedback: GainNode;
  ret: GainNode;
}

/** The reverb wash: input → convolver → HPF → return. */
export interface ReverbBus {
  input: GainNode;
  convolver: ConvolverNode;
  hpf: BiquadFilterNode;
  ret: GainNode;
}

/** A slider's node: one per key, and a second for the ones that reach two places (win, fail: music and fanfares). */
export type VolumeNode = VolumeKey | 'winFx' | 'failFx';
const VOLUME_NODES: readonly VolumeNode[] = [...VOLUME_KEYS, 'winFx', 'failFx'];
/** The node each automatic sound plays through (D237): switched off, it's silent whatever its slider says. The voices
 * are the engine's (it schedules none), so they have no node here. */
const AUTO_SOUND_NODES: Readonly<Record<AutoSound, readonly VolumeNode[]>> = Object.freeze({
  drumTicks: ['ticks'], djFx: ['djFx'], finalLap: ['finalLap'], winFanfare: ['winFx'], failFanfare: ['failFx'], voices: [],
});
/** Which nodes each slider moves. `songsParlem` is the engine's Parlem duck (show.ts parlemDb), not a node here. */
const SLIDER_NODES: Readonly<Record<VolumeKey, readonly VolumeNode[]>> = Object.freeze({
  ...Object.fromEntries(VOLUME_KEYS.map((k) => [k, [k]])) as Record<VolumeKey, VolumeNode[]>,
  songsParlem: [],
  win: ['win', 'winFx'],
  fail: ['fail', 'failFx'],
});

/** A loaded sound effect and the gain that peak-normalizes it. */
export interface FxSample {
  buffer: AudioBuffer;
  normGain: number;
}

export class AudioGraph {
  ctx: BaseAudioContext;
  master: GainNode;
  limiter: DynamicsCompressorNode;
  processingLatencySec: number;
  busHpf: BiquadFilterNode;
  holdDuck: GainNode;
  /** Everything but a Check's own sounds goes far down under it (the songs, and the Hold music bus). */
  checkDuck: { music: GainNode; hold: GainNode };
  musicBus: GainNode;
  /** The Interval playlist (audio/interval.ts): under the music, so the Hold duck, a Check and a build's
   * high-pass treat it like the songs. */
  intervalBus: GainNode;
  holdBus: GainNode;
  /** A Check's snippets: never ducked. */
  checkBus: GainNode;
  /** Parlem in a Celebration (D117): the Hold music bus (its victory track or loop) ducks under the voices. */
  bedDuck: GainNode;
  /** The volume sliders (D139): one gain each, set by `setVolumes`. */
  vol: Record<VolumeNode, GainNode>;
  /** The scene's music (songs, sets, Hold music, the Celebration's) fades under a throw song (D138, D151). */
  throwDuck: GainNode;
  /** The music under a voice cue (D204): everything a cue's voice must be heard over. */
  voiceDuck: GainNode;
  /** The internal trim in front of the limiter (D157: room for sliders above 100%). */
  headroom: GainNode;
  fxBus: GainNode;
  synthBus: GainNode;
  drumBus: GainNode;
  echo: EchoBus;
  reverb: ReverbBus;
  samples: Map<string, FxSample>;

  constructor(ctx: BaseAudioContext) {
    this.ctx = ctx;
    this.master = ctx.createGain();
    this.limiter = ctx.createDynamicsCompressor();
    this.limiter.threshold.value = -6;
    this.limiter.knee.value = 0;
    this.limiter.ratio.value = 20;
    this.limiter.attack.value = 0.003;
    this.limiter.release.value = 0.2;
    // The sliders first, each in front of where its sounds go (wired below).
    this.vol = Object.fromEntries(VOLUME_NODES.map((n) => [n, ctx.createGain()])) as Record<VolumeNode, GainNode>;
    this.headroom = ctx.createGain();
    this.headroom.gain.value = 10 ** (MIX.headroomDb / 20);
    this.master.connect(this.vol.master).connect(this.headroom).connect(this.limiter).connect(ctx.destination);
    this.voiceDuck = ctx.createGain();
    this.voiceDuck.connect(this.master);
    this.throwDuck = ctx.createGain();
    this.throwDuck.connect(this.voiceDuck);
    // Chrome's compressor delays its output by a fixed 6 ms pre-delay (measured on test.html).
    this.processingLatencySec = 0.006;

    // Music bus with a high-pass the builds sweep up (off instantly at the landing), and the Hold duck
    // that keeps the songs under the presenters' voices.
    this.busHpf = ctx.createBiquadFilter();
    this.busHpf.type = 'highpass';
    this.busHpf.frequency.value = 10;
    this.busHpf.Q.value = 0.9;
    this.busHpf.connect(this.throwDuck);
    this.checkDuck = { music: ctx.createGain(), hold: ctx.createGain() };
    this.checkDuck.music.connect(this.busHpf);
    this.checkDuck.hold.connect(this.throwDuck);
    this.holdDuck = ctx.createGain();
    this.holdDuck.connect(this.checkDuck.music);
    this.musicBus = ctx.createGain();
    this.musicBus.connect(this.vol.songs).connect(this.holdDuck);
    this.intervalBus = ctx.createGain();
    this.intervalBus.connect(this.holdDuck);
    this.vol.breaks.connect(this.intervalBus);
    this.vol.end.connect(this.intervalBus);
    // Hold music has its own bus: it is never ducked by the Hold, it is set to its own level.
    this.holdBus = ctx.createGain();
    this.bedDuck = ctx.createGain();
    this.holdBus.connect(this.bedDuck).connect(this.checkDuck.hold);
    for (const n of ['holdMusic', 'fail', 'win', 'intros'] as const) this.vol[n].connect(this.holdBus);
    this.checkBus = ctx.createGain();
    this.checkBus.connect(this.vol.check).connect(this.master);
    for (const n of ['djFx', 'padFx', 'winFx', 'failFx', 'finalLap', 'ticks', 'voices'] as const) this.vol[n].connect(this.master);
    for (const n of ['pausa', 'throws', 'doors'] as const) this.vol[n].connect(this.voiceDuck);

    this.fxBus = this.bus(-2, this.vol.djFx);
    this.synthBus = this.bus(-3, this.vol.djFx);
    this.drumBus = this.bus(-6, this.vol.ticks);

    // Tempo-synced echo shared by all decks (one transition at a time).
    const echo: EchoBus = {
      input: ctx.createGain(),
      delay: ctx.createDelay(3),
      hpf: ctx.createBiquadFilter(),
      feedback: ctx.createGain(),
      ret: ctx.createGain(),
    };
    echo.hpf.type = 'highpass';
    echo.hpf.frequency.value = 200;
    echo.delay.delayTime.value = 0.25;
    echo.feedback.gain.value = 0.4;
    echo.ret.gain.value = 1;
    echo.input.connect(echo.delay);
    echo.delay.connect(echo.hpf);
    echo.hpf.connect(echo.feedback).connect(echo.delay);
    echo.hpf.connect(echo.ret).connect(this.vol.djFx);
    this.echo = echo;

    // Reverb wash: stereo noise impulse response with an exponential decay (RT60 ≈ 2.5 s).
    const reverb: ReverbBus = {
      input: ctx.createGain(),
      convolver: ctx.createConvolver(),
      hpf: ctx.createBiquadFilter(),
      ret: ctx.createGain(),
    };
    reverb.convolver.buffer = this.impulseResponse(2.5);
    reverb.hpf.type = 'highpass';
    reverb.hpf.frequency.value = 400;
    reverb.ret.gain.value = 1;
    reverb.input.connect(reverb.convolver).connect(reverb.hpf).connect(reverb.ret).connect(this.vol.djFx);
    this.reverb = reverb;
    this.samples = new Map();
  }

  impulseResponse(rt60: number): AudioBuffer {
    const { ctx } = this;
    const length = Math.floor(ctx.sampleRate * rt60 * 1.2);
    const ir = ctx.createBuffer(2, length, ctx.sampleRate);
    for (let c = 0; c < 2; c++) {
      const data = ir.getChannelData(c);
      for (let i = 0; i < length; i++) {
        const t = i / ctx.sampleRate;
        data[i] = (Math.random() * 2 - 1) * Math.exp((-6.9 * t) / rt60) * (t < 0.01 ? t / 0.01 : 1);
      }
    }
    return ir;
  }

  // Panic, or a cancelled Spin: silence everything already scheduled (impacts, builds, ticks, tails) by
  // swapping the buses. The old buses fade over `fadeSec` so a cancel does not click.
  resetTransient(fadeSec = 0): void {
    const now = this.ctx.currentTime;
    for (const [name, out] of [['fxBus', this.vol.djFx], ['synthBus', this.vol.djFx], ['drumBus', this.vol.ticks]] as const) {
      const old = this[name];
      const gain = old.gain.value;
      if (fadeSec > 0) {
        old.gain.cancelScheduledValues(now);
        old.gain.setValueAtTime(gain, now);
        old.gain.linearRampToValueAtTime(0, now + fadeSec);
        setTimeout(() => old.disconnect(), fadeSec * 1000 + 100);
      } else old.disconnect();
      this[name] = this.bus(20 * Math.log10(gain), out);
    }
    for (const p of [this.echo.ret.gain, this.echo.delay.delayTime, this.echo.hpf.frequency, this.echo.feedback.gain, this.reverb.ret.gain, this.busHpf.frequency]) {
      p.cancelScheduledValues(now);
    }
    const end = now + Math.max(fadeSec, 0.005);
    this.busHpf.frequency.setValueAtTime(this.busHpf.frequency.value, now);
    this.busHpf.frequency.exponentialRampToValueAtTime(10, end);
    for (const p of [this.echo.feedback.gain, this.echo.ret.gain, this.reverb.ret.gain]) {
      p.setValueAtTime(p.value, now);
      p.linearRampToValueAtTime(0, end);
    }
    this.echo.feedback.gain.setValueAtTime(0.4, now + 3);
    this.echo.ret.gain.setValueAtTime(1, now + 3);
    this.reverb.ret.gain.setValueAtTime(1, now + 3);
  }

  // Move a gain to a level in dB, smoothly, from whatever it is doing now.
  glide(param: AudioParam, db: number, seconds: number, at: number = this.ctx.currentTime): void {
    const t = Math.max(at, this.ctx.currentTime);
    param.cancelScheduledValues(t);
    param.setValueAtTime(param.value, t);
    param.linearRampToValueAtTime(10 ** (db / 20), t + Math.max(0.01, seconds));
  }

  bus(db: number, out: AudioNode = this.master): GainNode {
    const gain = this.ctx.createGain();
    gain.gain.value = 10 ** (db / 20);
    gain.connect(out);
    return gain;
  }

  /** Every slider to its percent (D139), gliding: gain = (percent / 100)², protocol volumeDb. */
  setVolumes(volumes: Readonly<Record<VolumeKey, number>>, autoSounds: Readonly<AutoSounds> = AUTO_SOUNDS_DEFAULT, seconds = 0.15): void {
    const muted = new Set(AUTO_SOUNDS.filter((k) => !autoSounds[k]).flatMap((k) => AUTO_SOUND_NODES[k]));
    for (const key of VOLUME_KEYS) {
      const slider = Math.max(0, volumes[key] / 100) ** 2;
      for (const node of SLIDER_NODES[key]) {
        const gain = muted.has(node) ? 0 : slider;
        const p = this.vol[node].gain;
        const now = this.ctx.currentTime;
        p.cancelScheduledValues(now);
        p.setValueAtTime(p.value, now);
        p.linearRampToValueAtTime(gain, now + seconds);
      }
    }
  }

  param(target: GraphParam): AudioParam | null {
    switch (target) {
      case 'echo.time':
        return this.echo.delay.delayTime;
      case 'echo.feedback':
        return this.echo.feedback.gain;
      case 'echo.hpf':
        return this.echo.hpf.frequency;
      case 'echo.return':
        return this.echo.ret.gain;
      case 'reverb.return':
        return this.reverb.ret.gain;
      case 'reverb.hpf':
        return this.reverb.hpf.frequency;
      case 'bus.hpf':
        return this.busHpf.frequency;
      case 'master':
        return this.master.gain;
      case 'duck':
        return this.holdDuck.gain;
      default:
        return null;
    }
  }

  // Load the repo's sound effects (/fx/<name>.mp3, or another folder) once, peak-normalized to −1 dBFS.
  async loadSamples(names: readonly string[], base = '/fx/'): Promise<void> {
    await Promise.all(
      names.map(async (name) => {
        if (this.samples.has(name)) return;
        try {
          const response = await fetch(`${base}${name}.mp3`);
          const buffer = await this.ctx.decodeAudioData(await response.arrayBuffer());
          let peak = 0;
          for (let c = 0; c < buffer.numberOfChannels; c++) {
            const data = buffer.getChannelData(c);
            for (let i = 0; i < data.length; i++) peak = Math.max(peak, Math.abs(data[i]));
          }
          this.samples.set(name, { buffer, normGain: peak > 0 ? 0.89 / peak : 1 });
        } catch (error) {
          console.warn('fx sample', name, error);
        }
      }),
    );
  }

  /** `out`: where it plays (the DJ moves' samples default to fxBus; the presenters' and the fanfares pass their slider). */
  playSample(name: string, when: number, gainDb = 0, out: AudioNode = this.fxBus): AudioBufferSourceNode | null {
    const sample = this.samples.get(name);
    if (!sample) return null;
    const source = this.ctx.createBufferSource();
    source.buffer = sample.buffer;
    const gain = this.ctx.createGain();
    gain.gain.value = sample.normGain * 10 ** (gainDb / 20);
    source.connect(gain).connect(out);
    source.start(Math.max(when, this.ctx.currentTime));
    return source;
  }
}
