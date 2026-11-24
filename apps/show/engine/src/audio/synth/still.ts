// The standing Check's ✓ (the Desgraciat round: "no ha sonat", this song hasn't landed): a short, dry wood-block
// knock, two quick partials, so a run of them reads as a calm count while the room waits for a ✗.
import { noiseHit, tone } from './clicks.ts';

export interface StillKnockOptions {
  t0: number;
  levelDb?: number;
}

export function stillKnock(ctx: BaseAudioContext, destination: AudioNode, { t0, levelDb = -12 }: StillKnockOptions): void {
  const out = ctx.createGain();
  out.gain.value = 10 ** (levelDb / 20);
  out.connect(destination);
  tone(ctx, out, { time: t0, type: 'sine', frequency: 880, endFrequency: 760, peak: 0.8, decay: 0.09 });
  tone(ctx, out, { time: t0, type: 'triangle', frequency: 2240, peak: 0.25, decay: 0.04 });
  noiseHit(ctx, out, { time: t0, frequency: 3200, q: 2, peak: 0.2, decay: 0.02 });
}
