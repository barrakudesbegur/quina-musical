// The home screen's drum (board Mobil-B-J2; §8 Y1, D237: the projector's drum), apps/player/logic/drum.ts and
// drum-tug.ts: its motion from public fields only, the landing's glide, a cancelled Spin, a Back, a Suspense, reduced
// motion and the projector's blur (the tug: drum-tug.test.ts; its sync with the engine: tests/drum-sync.test.ts). And
// where a song row's card icons sit.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { PublicLanding, PublicSpin } from '../../../../player/feed/public.ts';
import { DRUM, PhoneDrum, creepStart, glideSec, lastLanding, motionBlurPx, ringOf, roundOrder, spinSolution, spinStart, standInMotion, type DrumFrame } from '../../../../player/logic/drum.ts';
import { markerLayout } from '../../../../player/logic/markers.ts';

const SONGS = Array.from({ length: 70 }, (_, i) => i + 1);
const ORDER = roundOrder(SONGS, 123_456, 3);
const T = 1_800_000_000_000;
const landing = (position: number, songId: number, atMs: number): PublicLanding => ({ position, songId, atMs });
const mod = (v: number, n: number) => ((v % n) + n) % n;
const under = (f: DrumFrame) => f.ring[mod(Math.round(f.position), f.ring.length)];

/** Frames every `stepMs` from `fromMs` to `toMs`, asserting no jump between two of them (the same ring). */
function run(drum: PhoneDrum, input: (ms: number) => Omit<Parameters<PhoneDrum['frame']>[0], 'nowMs'>, fromMs: number, toMs: number, stepMs = 16): DrumFrame {
  let prev: DrumFrame | null = null;
  let f!: DrumFrame;
  for (let ms = fromMs; ms <= toMs; ms += stepMs) {
    f = drum.frame({ ...input(ms), nowMs: ms });
    if (prev && prev.ring.length === f.ring.length) assert.ok(Math.abs(f.position - prev.position) < 1.5, `no jump at ${ms - fromMs} ms`);
    prev = f;
  }
  return f;
}

test("the drum's order is the round's drumOrder; without a drumSeed (an older engine), the round's number seeds it", () => {
  assert.deepEqual([...ORDER].sort((a, b) => a - b), SONGS);
  assert.deepEqual(roundOrder([...SONGS].reverse(), 123_456, 3), ORDER, 'the songs\' order changes nothing');
  assert.deepEqual(roundOrder(SONGS, undefined, 3), roundOrder(SONGS, 3, 99));
});

test('the ring: the songs still to come plus the last landing; a Spin starts on the tile after it', () => {
  const landings = [landing(0, ORDER[5]!, T), landing(1, ORDER[9]!, T + 1)];
  assert.equal(lastLanding(landings)?.songId, ORDER[9]);
  const ring = ringOf(ORDER, landings, ORDER[9]!);
  assert.equal(ring.length, 69);
  assert.ok(!ring.includes(ORDER[5]!) && ring.includes(ORDER[9]!));
  const start = spinStart(ORDER, landings);
  assert.equal(start.ring.length, 68);
  assert.equal(start.ring[start.fromIndex], ORDER[10], 'the drum stays where it was: the next tile slides in');
  assert.deepEqual(spinStart(ORDER, []), { ring: ORDER, fromIndex: 0 });
});

test("the projector's motion blur: 0.2 of the px per frame from 6 px a frame, at the phone's 120 px tile", () => {
  assert.equal(motionBlurPx(2.9), 0, 'under 6 px a frame: sharp');
  assert.equal(motionBlurPx(3), 1);
  assert.equal(motionBlurPx(40), 16);
  assert.equal(motionBlurPx(-40), 16, 'either way round');
});

test('a Spin: the solver\'s curve from the public seed, then a creep that never stops, blurred at least the veil', () => {
  const sol = spinSolution({ cardCount: 69, fromIndex: 9, durationSec: 7, spinSeed: 77 });
  assert.equal(sol.method, 'physics');
  const at = creepStart(sol);
  assert.ok(at > 2 && at < 7, `the creep starts late in the Spin (${at.toFixed(2)} s)`);
  const before = standInMotion(sol, at, at - 1e-6);
  const after = standInMotion(sol, at, at + 1e-6);
  assert.ok(Math.abs(after.position - before.position) < 1e-3 && Math.abs(after.velocity - before.velocity) < 0.1, 'continuous into the creep (within one of the solver\'s samples)');
  const late = standInMotion(sol, at, at + 30);
  assert.ok(Math.abs(Math.abs(late.velocity) - DRUM.creepFloor) < 0.01, 'it creeps on at the floor speed, never stopping');
  assert.equal(spinSolution({ cardCount: 69, fromIndex: 9, durationSec: 7, spinSeed: 77 }).traveled, sol.traveled, 'the same seed, the same Spin');
});

test('a landing: from the creep, a glide to the landed tile by the shortest way, then at rest, selected', () => {
  const drum = new PhoneDrum();
  const before = [landing(0, ORDER[0]!, T - 20_000)];
  const spin: PublicSpin = { startAtMs: T, landAtMs: T + 7000, spinSeed: 5 };
  drum.frame({ order: ORDER, landings: before, spin: null, nowMs: T - 1000, reduced: false });
  const waiting = run(drum, () => ({ order: ORDER, landings: before, spin, reduced: false }), T, T + 7400);
  assert.equal(waiting.phase, 'waiting');
  assert.equal(waiting.selectedId, null);
  const target = ORDER[40]!;
  const after = [...before, landing(1, target, T + 7000)];
  const f = run(drum, () => ({ order: ORDER, landings: after, spin: null, reduced: false }), T + 7416, T + 7416 + glideSec(35) * 1000 + 100);
  assert.equal(f.phase, 'landed');
  assert.equal(under(f), target);
  assert.equal(f.selectedId, target);
  assert.equal(f.blurPx, 0, 'the blur lifts at rest');
  assert.ok(glideSec(0) >= DRUM.glideMinSec && glideSec(1000) === DRUM.glideMaxSec);
});

test('a Spin opened late (the page loads mid-Spin) starts mid-curve; opened after the landing, the drum is simply there', () => {
  const spin: PublicSpin = { startAtMs: T, landAtMs: T + 7000, spinSeed: 9 };
  const mid = new PhoneDrum().frame({ order: ORDER, landings: [], spin, nowMs: T + 3000, reduced: false });
  assert.equal(mid.phase, 'spinning');
  assert.ok(Math.abs(mid.velocity) > 3);
  const there = new PhoneDrum().frame({ order: ORDER, landings: [landing(0, ORDER[12]!, T + 7000)], spin: null, nowMs: T + 8000, reduced: false });
  assert.equal(there.phase, 'landed');
  assert.equal(under(there), ORDER[12]);
});

test('a cancelled Spin (no landing) glides back to the last landing, its tile back in its place; a Back glides to the one before', () => {
  const drum = new PhoneDrum();
  const landings = [landing(0, ORDER[3]!, T - 30_000), landing(1, ORDER[20]!, T - 15_000)];
  drum.frame({ order: ORDER, landings, spin: null, nowMs: T - 1000, reduced: false });
  run(drum, () => ({ order: ORDER, landings, spin: { startAtMs: T, landAtMs: T + 7000, spinSeed: 3 }, reduced: false }), T, T + 2500);
  let f = run(drum, () => ({ order: ORDER, landings, spin: null, reduced: false }), T + 2516, T + 4500);
  assert.equal(f.phase, 'landed');
  assert.equal(under(f), ORDER[20]);
  assert.equal(f.ring.length, 69, 'the last landing back on the ring');
  const back = landings.slice(0, 1);
  f = run(drum, () => ({ order: ORDER, landings: back, spin: null, reduced: false }), T + 5000, T + 7000);
  assert.equal(under(f), ORDER[3]);
  assert.equal(f.ring.length, 70);
});

test('a Suspense coasts by its start time; released, it keeps coasting (no jump) until the landing is public', () => {
  const drum = new PhoneDrum();
  const held: PublicSpin = { startAtMs: T, landAtMs: null };
  drum.frame({ order: ORDER, landings: [], spin: null, nowMs: T - 1000, reduced: false });
  let f = run(drum, () => ({ order: ORDER, landings: [], spin: held, reduced: false }), T, T + 10_000);
  assert.equal(f.phase, 'spinning');
  assert.ok(f.blurPx >= DRUM.veilPx);
  f = run(drum, (ms) => ({ order: ORDER, landings: [], spin: ms < T + 12_000 ? held : { startAtMs: T, landAtMs: T + 15_000, spinSeed: 4 }, reduced: false }), T + 10_016, T + 16_000);
  assert.equal(f.selectedId, null);
  f = run(drum, () => ({ order: ORDER, landings: [landing(0, ORDER[33]!, T + 15_000)], spin: null, reduced: false }), T + 16_016, T + 18_000);
  assert.equal(under(f), ORDER[33]);
});

test('reduced motion: the ring never turns; it rests on the start tile, blurred, then jumps to the landed tile', () => {
  const drum = new PhoneDrum();
  const spin: PublicSpin = { startAtMs: T, landAtMs: T + 7000, spinSeed: 1 };
  const f = drum.frame({ order: ORDER, landings: [], spin, nowMs: T + 3000, reduced: true });
  assert.deepEqual([f.position, f.velocity, f.blurPx], [0, 0, DRUM.veilPx]);
  const g = drum.frame({ order: ORDER, landings: [landing(0, ORDER[50]!, T + 7000)], spin: null, nowMs: T + 7200, reduced: true });
  assert.equal(g.phase, 'landed');
  assert.equal(under(g), ORDER[50]);
});

test("a song row's card icons pack zig-zag: one, a pair, a triangle, a rhombus", () => {
  assert.deepEqual(markerLayout(0), { width: 0, height: 50, spots: [] });
  assert.deepEqual(markerLayout(1), { width: 28, height: 50, spots: [{ left: 0, top: 11 }] });
  assert.deepEqual(markerLayout(2).spots, [{ left: 0, top: 11 }, { left: 25, top: 11 }]);
  const three = markerLayout(3);
  assert.equal(three.width, 53);
  assert.deepEqual(three.spots, [{ left: 0, top: 21 }, { left: 25, top: 21 }, { left: 12.5, top: 1 }]);
  const five = markerLayout(5);
  assert.equal(five.spots.filter((s) => s.top === 21).length, 3, 'three below');
  assert.equal(five.spots.filter((s) => s.top === 1).length, 2, 'two above');
});
