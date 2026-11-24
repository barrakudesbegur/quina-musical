// P7, the scratch render (audio/scratch.ts): the hand's position curve and the buffer read along it. test.html
// renders D19 through the real graph too.
import test from 'node:test';
import assert from 'node:assert/strict';
import { renderScratch, scratchPosition } from '../engine/src/audio/scratch.ts';
import type { ScratchStroke } from '../engine/src/plan/events.ts';

const SR = 48000;

test('the hand: eased strokes are still at both ends and continuous; a steady stroke moves at a constant speed', () => {
  const strokes: ScratchStroke[] = [
    { t0: 1, t1: 1.1, p0: 0, p1: 0.1, ease: true },
    { t0: 1.1, t1: 1.2, p0: 0.1, p1: 0, ease: true },
    { t0: 1.2, t1: 1.5, p0: 0, p1: 0.3, ease: false },
  ];
  assert.equal(scratchPosition(strokes, 0.5), 0);
  assert.ok(Math.abs(scratchPosition(strokes, 1.05) - 0.05) < 1e-12, 'halfway through the push');
  assert.equal(scratchPosition(strokes, 1.1), 0.1);
  assert.ok(Math.abs(scratchPosition(strokes, 1.35) - 0.15) < 1e-12, 'the release at full speed');
  assert.equal(scratchPosition(strokes, 2), 0.3, 'held after the last stroke');
  // Eased: the speed is near zero at a turn and highest mid-stroke.
  const speed = (t: number) => (scratchPosition(strokes, t + 1e-5) - scratchPosition(strokes, t)) / 1e-5;
  assert.ok(Math.abs(speed(1.1 + 1e-4)) < 0.05 && Math.abs(speed(1.15)) > 1.4);
  assert.ok(Math.abs(speed(1.3) - 1) < 1e-6);
});

test('the render reads the source along the hand: forward plays it, backward plays it reversed, a closed crossfader is silent', () => {
  // A ramp source, so the read position shows in the sample values.
  const source = new Float32Array(SR);
  for (let k = 0; k < source.length; k++) source[k] = k / source.length;
  const origin = 0.25 * SR;
  const frames = Math.round(0.2 * SR);
  const at = 3;
  const forward: ScratchStroke[] = [{ t0: at, t1: at + 0.2, p0: 0, p1: 0.2, ease: false }];
  const open = [[at, 1], [at + 0.2, 1]] as const;
  const [fw] = renderScratch({ channels: [source], sampleRate: SR, originFrame: origin, strokes: forward, gate: open, at, frames, gain: 1, noise: 0, rng: Math.random });
  for (const n of [0, 1000, 9000]) assert.ok(Math.abs(fw[n] - (origin + n) / SR) < 1e-6, 'forward at rate 1 copies the source');
  const backward: ScratchStroke[] = [{ t0: at, t1: at + 0.2, p0: 0.2, p1: 0, ease: false }];
  const [bw] = renderScratch({ channels: [source], sampleRate: SR, originFrame: origin, strokes: backward, gate: open, at, frames, gain: 1, noise: 0, rng: Math.random });
  for (const n of [0, 1000, 9000]) assert.ok(Math.abs(bw[n] - (origin + 0.2 * SR - n) / SR) < 1e-6, 'backward reverses it');
  const shut = [[at, 0]] as const;
  const [silent] = renderScratch({ channels: [source], sampleRate: SR, originFrame: origin, strokes: forward, gate: shut, at, frames, gain: 1, noise: 0.1, rng: Math.random });
  assert.ok(silent.every((v) => v === 0));
  // Needle noise follows the hand: none while it is still.
  const still: ScratchStroke[] = [{ t0: at, t1: at + 0.2, p0: 0.05, p1: 0.05, ease: false }];
  const zero = new Float32Array(SR);
  const [quiet] = renderScratch({ channels: [zero], sampleRate: SR, originFrame: origin, strokes: still, gate: open, at, frames, gain: 1, noise: 0.1, rng: Math.random });
  assert.ok(quiet.every((v) => v === 0));
  const [hiss] = renderScratch({ channels: [zero], sampleRate: SR, originFrame: origin, strokes: forward, gate: open, at, frames, gain: 1, noise: 0.1, rng: Math.random });
  assert.ok(hiss.some((v) => Math.abs(v) > 0.01) && hiss.every((v) => Math.abs(v) <= 0.1 + 1e-6));
  // Outside the source: silence, never a read past its ends.
  const [outside] = renderScratch({ channels: [source], sampleRate: SR, originFrame: -SR, strokes: forward, gate: open, at, frames, gain: 1, noise: 0, rng: Math.random });
  assert.ok(outside.every((v) => v === 0 && Number.isFinite(v)));
});
