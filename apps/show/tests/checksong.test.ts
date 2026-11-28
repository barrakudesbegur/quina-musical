// A Check's revealed song (plan/checksong.ts): where its audio dies, where its loop jumps back to the hook's pickup,
// how a late start joins its pass, and when the snippet hands over to the full song.
import test from 'node:test';
import assert from 'node:assert/strict';
import { atFrame, audibleEndSec, entryOffset, equalPowerCurves, handoverAt, pickupLoop, snippetStartSec, songLoop, songSecAt } from '../engine/src/plan/checksong.ts';
import { lastPhraseLoop } from '../engine/src/plan/loop.ts';
import type { Analysis } from '../engine/src/analysis.ts';
import { FLOW } from '../engine/src/config.ts';

const SR = 1000;

/** A mono "song" of `sec` seconds: a tone at `amp` per second, from `amps` (one value per second). */
const song = (amps: number[]): Float32Array => {
  const out = new Float32Array(amps.length * SR);
  for (let i = 0; i < out.length; i++) out[i] = amps[Math.floor(i / SR)] * Math.sin(i * 0.3);
  return out;
};

const tail = { refStartSec: 2, refSec: 3, windowSec: 0.25, dropDb: -12 };

test('the audio dies where the song falls 12 dB under its hook: trailing silence and a fade-out stay out', () => {
  // A hook at 1.0 from 2 s, the song at 1.0 until 20 s, then a fade 0.5, 0.2, 0.1, 0.02 and 3 s of silence.
  const amps = [...Array(20).fill(1), 0.5, 0.2, 0.1, 0.02, 0, 0, 0];
  // 0.5 is −6 dB (kept), 0.2 is −14 dB (out): the audio dies at 21 s.
  assert.equal(audibleEndSec([song(amps)], SR, tail), 21);
  assert.equal(audibleEndSec([song(amps)], SR, { ...tail, dropDb: -24 }), 23, '0.1 is −20 dB: kept at −24');
  // Stereo: a channel that goes on counts.
  assert.equal(audibleEndSec([song(amps), song([...Array(25).fill(1), 0, 0])], SR, tail), 25);
});

test('a song that ends loud ends at its last sample; one never as loud after its hook ends where the hook does', () => {
  assert.equal(audibleEndSec([song(Array(30).fill(1))], SR, tail), 30);
  assert.equal(audibleEndSec([song([1, 1, 1, 1, 1, ...Array(10).fill(0.05)])], SR, tail), 5);
  assert.equal(audibleEndSec([song(Array(10).fill(0))], SR, tail), 10, 'a silent hook: nothing to measure against');
});

/** A steady song: a downbeat every 2 s for 50 bars (100 s), its hook's downbeat at bar 10 (20 s), a 0.5 s pickup. */
const analysis = { downbeats: Array.from({ length: 51 }, (_, k) => k * 2), source: { durationSec: 100 } } as unknown as Analysis;
const loopArgs = { analysis, startSec: 19.5, hookDownbeatIndex: 10, audibleEndSec: 99, stayTailSec: 8, phraseXfadeSec: 0.005, pickupXfadeSec: 0.15 };

test("near its end the revealed song repeats its last full phrase from the hook, as a song left playing does (D239)", () => {
  // 8-bar phrases from bar 10: 2, 10, ..., 34 (68–84 s) ends by 92 s (100 − 8); 42 (84–100) doesn't.
  assert.deepEqual(songLoop(loopArgs), { startSec: 19.5, fromSec: 68, outSec: 84, xfadeSec: 0.005 });
  // A long fade: the audio dies at 80 s, so the tail is 20 s and the phrase must end by 80: 52–68 is the last 8 bars.
  assert.deepEqual(songLoop({ ...loopArgs, audibleEndSec: 80 }), { startSec: 19.5, fromSec: 52, outSec: 68, xfadeSec: 0.005 });
  // The same phrase as Aguanta's (show.ts tickStay) for the same song.
  const deck = { startCtx: 0, offset: 0, rate: 1 };
  const stay = lastPhraseLoop({ analysis, deck, landedDownbeatIndex: 10 }, 19.5, 8);
  assert.deepEqual([stay?.fromSec, stay?.toSec], [68, 84]);
});

test('without a whole phrase the last 4 bars; without a beat grid the jump back to the pickup', () => {
  // No hook downbeat to count phrases from: the last 4 bars that end by 92 s (84–92).
  assert.deepEqual(songLoop({ ...loopArgs, hookDownbeatIndex: null }), { startSec: 19.5, fromSec: 84, outSec: 92, xfadeSec: 0.005 });
  // No beat grid: the pickup again, the crossfade ending where the audio dies.
  const none = { ...analysis, downbeats: [0, 2] } as unknown as Analysis;
  assert.deepEqual(songLoop({ ...loopArgs, analysis: none, audibleEndSec: 90.3 }), { startSec: 19.5, fromSec: 19.5, outSec: 90.3, xfadeSec: 0.15 });
});

test('the snippet loops back to its start before its own fade-out, never shorter than two crossfades', () => {
  const c = FLOW.check;
  const loop = pickupLoop({ startSec: 0, endSec: 3 - c.snippetTailSec, xfadeSec: c.pickupXfadeSec });
  assert.deepEqual(loop, { startSec: 0, fromSec: 0, outSec: 3 - c.snippetTailSec, xfadeSec: c.pickupXfadeSec });
  assert.ok(loop.outSec <= 3 - 0.15, "its crossfade ends before snippets.py's 0.15 s fade-out");
  assert.deepEqual(pickupLoop({ startSec: 0, endSec: 0.1, xfadeSec: 0.15 }).outSec, 0.3);
});

test('a late start joins its pass as far in as the reveal is old, else from the pickup', () => {
  const loop = { startSec: 19.5, fromSec: 68, outSec: 84, xfadeSec: 0.005 };
  assert.equal(entryOffset(loop, 0, 0.5), 19.5);
  assert.equal(entryOffset(loop, -0.2, 0.5), 19.5, 'early: at the pickup');
  assert.equal(entryOffset(loop, 1.25, 0.5), 20.75);
  assert.equal(entryOffset({ startSec: 0, fromSec: 0, outSec: 2.8, xfadeSec: 0.15 }, 2.4, 0.5), 0, 'too close to the jump: from the pickup');
});

test('the handover starts on a frame once the snippet is at its level and ends before the snippet jumps', () => {
  const sr = 48000;
  const at = handoverAt({ now: 10.0001, voiceAt: 10.01, outAt: 12.6, leadSec: 0.05, xfadeSec: 0.05, sampleRate: sr });
  assert.ok(at != null && at >= 10.0501 && at - 10.0501 < 1 / sr);
  assert.equal(at, atFrame(10.0501, sr));
  assert.ok(Math.abs(at * sr - Math.round(at * sr)) < 1e-6, 'on a whole frame');
  assert.equal(handoverAt({ now: 9, voiceAt: 10.01, outAt: 12.6, leadSec: 0.05, xfadeSec: 0.05, sampleRate: sr }), atFrame(10.01, sr), 'not before the fade-in ends');
  assert.equal(handoverAt({ now: 12.52, voiceAt: 10.01, outAt: 12.6, leadSec: 0.05, xfadeSec: 0.05, sampleRate: sr }), null, 'too late in this pass');
  assert.equal(atFrame(1.5, sr), 1.5);
  assert.ok(Math.abs(atFrame(1 + 0.4 / sr, sr) - (1 + 1 / sr)) < 1e-12);
});

test('the song second a voice plays: its origin, its offset and the time since it started', () => {
  // The snippet (its 0 is the pickup at 52.3711 s) from 0.2 s into it at context 5: at 6.5 it plays 52.3711 + 1.7.
  assert.ok(Math.abs(songSecAt({ at: 5, offsetSec: 0.2, originSec: 52.3711 }, 6.5) - 54.0711) < 1e-9);
  assert.equal(songSecAt({ at: 5, offsetSec: 30, originSec: 0 }, 5), 30);
});

test("the snippet's exact start: the lag where its samples match the song's", () => {
  const sr = 48000;
  const full = new Float32Array(sr * 4);
  let seed = 7;
  for (let i = 0; i < full.length; i++) {
    seed = (seed * 16807) % 2147483647;
    full[i] = seed / 2147483647 - 0.5;
  }
  const trueStart = 48003; // the index says 1.0000 s: 3 frames off
  const snippet = full.slice(trueStart, trueStart + sr);
  assert.equal(snippetStartSec(snippet, full, sr, 1.0), trueStart / sr);
  assert.equal(snippetStartSec(snippet, full, sr, trueStart / sr), trueStart / sr);
});

test('the equal-power curves keep the power constant through the crossfade', () => {
  const { out, in: inc } = equalPowerCurves(0.5, 64);
  assert.equal(out[0], 0.5);
  assert.ok(Math.abs(inc[63] - 0.5) < 1e-6 && Math.abs(out[63]) < 1e-6 && inc[0] === 0);
  for (let i = 0; i < 64; i++) assert.ok(Math.abs(out[i] ** 2 + inc[i] ** 2 - 0.25) < 1e-6);
});

test('the Check tunables: the handover and the loop crossfades fit inside a snippet', () => {
  const c = FLOW.check;
  assert.ok(c.handoverSec < c.pickupXfadeSec && c.pickupXfadeSec < c.endFadeSec);
  assert.ok(c.cutFadeSec < c.endFadeSec);
  assert.ok(3 - c.snippetTailSec - c.pickupXfadeSec > c.handoverLeadSec + c.handoverSec + 1, 'a second of the first pass for the song to arrive in');
  assert.ok(c.loopAheadSec > 0.1 && c.loopAheadSec < 3 - c.snippetTailSec - c.pickupXfadeSec);
});
