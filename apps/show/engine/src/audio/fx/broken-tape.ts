// The Check's ✗ (the user, 28 Nov: "the normal song and after a couple of seconds sounds broken or bad or sad … and it
// keeps in a loop with that effect, no volume down"): the revealed song goes through a worn-out tape. At its onset the
// tape groans down a couple of semitones and comes back to speed, then it stays warbling (a slow wow and a little
// flutter), muffled (low-passed) and a little saturated, at the same loudness (a trim
// gain). Speed-neutral: only a modulated delay line bends the pitch, so the song's clock, its loop and Pausa's saved
// position are the source's. Tunables: FLOW.check.brokenTape.
import { breakOnset, equalPowerCurves, groanDelaySec } from '../../plan/checksong.ts';

export interface BrokenTapeOptions {
  /** When it breaks (audio clock); before now: broken from the start. */
  breakAt: number;
  onsetSec: number;
  groanSemitones: number;
  baseDelaySec: number;
  wowHz: number;
  wowDepthSec: number;
  flutterHz: number;
  flutterDepthSec: number;
  highpassHz: number;
  lowpassHz: number;
  lowpassQ: number;
  drive: number;
  makeupDb: number;
}

/** What plays into `input` comes out of `destination`, breaking at `breakAt`; `stop` ends its LFOs. */
export interface BrokenTape {
  input: GainNode;
  stop(at: number): void;
}

/** A soft saturation curve (tanh at `drive`, normalised to ±1). */
function saturation(drive: number, points = 2048): Float32Array<ArrayBuffer> {
  const curve = new Float32Array(points);
  const norm = Math.tanh(drive);
  for (let i = 0; i < points; i++) {
    const x = (i / (points - 1)) * 2 - 1;
    curve[i] = Math.tanh(drive * x) / norm;
  }
  return curve;
}

export function brokenTape(ctx: BaseAudioContext, destination: AudioNode, o: BrokenTapeOptions): BrokenTape {
  const input = ctx.createGain();
  const dry = ctx.createGain();
  const wet = ctx.createGain();
  input.connect(dry).connect(destination);

  const groan = groanDelaySec(o.groanSemitones, o.onsetSec);
  const delay = ctx.createDelay(1);
  const hpf = ctx.createBiquadFilter();
  hpf.type = 'highpass';
  hpf.frequency.value = o.highpassHz;
  const lpf = ctx.createBiquadFilter();
  lpf.type = 'lowpass';
  lpf.frequency.value = o.lowpassHz;
  lpf.Q.value = o.lowpassQ;
  const shaper = ctx.createWaveShaper();
  shaper.curve = saturation(o.drive);
  shaper.oversample = '2x';
  const makeup = ctx.createGain();
  makeup.gain.value = 10 ** (o.makeupDb / 20);
  input.connect(delay).connect(hpf).connect(lpf).connect(shaper).connect(makeup).connect(wet).connect(destination);

  // The wow and the flutter swing the delay around its base (which the groan raises at the onset).
  const lfos = [[o.wowHz, o.wowDepthSec], [o.flutterHz, o.flutterDepthSec]].map(([hz, depth]) => {
    const lfo = ctx.createOscillator();
    lfo.frequency.value = hz;
    const amount = ctx.createGain();
    amount.gain.value = depth;
    lfo.connect(amount).connect(delay.delayTime);
    lfo.start();
    return lfo;
  });

  const onset = breakOnset(o.breakAt, ctx.currentTime, o.onsetSec);
  if (onset.on) {
    dry.gain.value = 0;
    wet.gain.value = 1;
    delay.delayTime.value = o.baseDelaySec + groan;
  } else {
    const curves = equalPowerCurves(1, 64);
    wet.gain.value = 0;
    delay.delayTime.value = o.baseDelaySec;
    dry.gain.setValueAtTime(1, onset.from);
    dry.gain.setValueCurveAtTime(curves.out, onset.from, o.onsetSec);
    wet.gain.setValueAtTime(0, onset.from);
    wet.gain.setValueCurveAtTime(curves.in, onset.from, o.onsetSec);
    delay.delayTime.setValueAtTime(o.baseDelaySec, onset.from);
    delay.delayTime.linearRampToValueAtTime(o.baseDelaySec + groan, onset.to);
  }
  return {
    input,
    stop(at: number) {
      for (const lfo of lfos) {
        try {
          lfo.stop(at);
        } catch {}
      }
      setTimeout(() => {
        input.disconnect();
        wet.disconnect();
        dry.disconnect();
      }, Math.max(0, at - ctx.currentTime) * 1000 + 400);
    },
  };
}
