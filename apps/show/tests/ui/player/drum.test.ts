// The home screen's drum (board Mobil-B-J2; §8 Y1, D237: the projector's drum), apps/player/logic/drum.ts and
// drum-tug.ts: its motion from public fields only, the Spin onto its public target (D277), the stand-in and the landing's glide, a cancelled Spin, a Back, a Suspense, reduced
// motion and the projector's blur (the tug: drum-tug.test.ts; its sync with the engine: tests/drum-sync.test.ts). And
// where a song row's card icons sit.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { PublicLanding, PublicSpin } from '../../../../player/feed/public.ts';
import { DRUM, PhoneDrum, creepStart, glideSec, lastLanding, motionBlurPx, ringOf, roundOrder, spinSolution, spinStart, standInMotion, wordsLanding, wordsStale, type DrumFrame } from '../../../../player/logic/drum.ts';
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

test('a Spin is solved once; while its solution is on its way (off the main thread) the ring waits on its start tile, veiled, then follows the same curve', () => {
  const before = [landing(0, ORDER[0]!, T - 20_000)];
  const spin: PublicSpin = { startAtMs: T, landAtMs: T + 7000, spinSeed: 31 };
  const input = (nowMs: number) => ({ order: ORDER, landings: before, spin, nowMs, reduced: false });
  const asked: number[] = [];
  let ready = false;
  const drum = new PhoneDrum((inputs) => {
    asked.push(inputs.spinSeed);
    return ready ? spinSolution(inputs) : null;
  });
  const now = new PhoneDrum();
  const { fromIndex } = spinStart(ORDER, before);
  for (let ms = T; ms < T + 120; ms += 16) {
    const f = drum.frame(input(ms));
    assert.deepEqual([f.phase, f.position, f.velocity, f.selectedId, f.blurPx], ['spinning', fromIndex, 0, null, DRUM.veilPx], 'waiting for the solution: still on the start tile, veiled');
  }
  ready = true;
  for (let ms = T + 120; ms <= T + 9000; ms += 16) assert.deepEqual(drum.frame(input(ms)), now.frame(input(ms)), `the same frame at ${ms - T} ms`);
  assert.deepEqual(asked, [31, 31, 31, 31, 31, 31, 31, 31, 31], 'asked on each frame until it came, then never again');
});

test('with its public targetId (D277) a Spin is the projector\'s onto that tile: no stand-in, no creep, no glide; it rests there as the landing goes public', () => {
  const drum = new PhoneDrum();
  const before = [landing(0, ORDER[0]!, T - 20_000)];
  const { ring, fromIndex } = spinStart(ORDER, before);
  const target = ring[30]!;
  const spin: PublicSpin = { startAtMs: T, landAtMs: T + 7000, spinSeed: 5, targetId: target };
  const exact = spinSolution({ cardCount: ring.length, fromIndex, durationSec: 7, spinSeed: 5, targetIndex: 30 });
  drum.frame({ order: ORDER, landings: before, spin: null, nowMs: T - 1000, reduced: false });
  let f!: DrumFrame;
  for (let ms = T; ms <= T + 7000; ms += 16) {
    f = drum.frame({ order: ORDER, landings: before, spin, nowMs: ms, reduced: false });
    assert.equal(f.phase, 'spinning', 'never «waiting»: no creep');
    assert.equal(f.selectedId, null, 'the song is not shown before the landing');
  }
  assert.equal(under(f), target, 'on the target at landAtMs');
  assert.ok(Math.abs(f.position - (fromIndex + exact.traveled)) < 0.05);
  assert.equal(f.blurPx, 0, 'no veil: it is the projector\'s own curve');
  const late = drum.frame({ order: ORDER, landings: before, spin, nowMs: T + 7080, reduced: false });
  assert.equal(late.phase, 'spinning', 'between landAtMs and the public landing it holds, unselected');
  const after = [...before, landing(1, target, T + 7000)];
  const g = drum.frame({ order: ORDER, landings: after, spin: null, nowMs: T + 7120, reduced: false });
  assert.deepEqual([g.phase, g.selectedId, under(g), g.velocity], ['landed', target, target, 0], 'resting at once, no glide');
  // A landing seen a moment before landAtMs (a clock ahead): the Spin finishes, then rests.
  const early = new PhoneDrum();
  early.frame({ order: ORDER, landings: before, spin, nowMs: T + 6000, reduced: false });
  assert.equal(early.frame({ order: ORDER, landings: after, spin: null, nowMs: T + 6900, reduced: false }).phase, 'spinning');
  assert.equal(early.frame({ order: ORDER, landings: after, spin: null, nowMs: T + 7010, reduced: false }).phase, 'landed');
});

test('a released Suspense with its targetId brakes from its coast onto the tile exactly at landAtMs; a target dropped by a held Suspense creeps on', () => {
  const drum = new PhoneDrum();
  const held: PublicSpin = { startAtMs: T, landAtMs: null };
  drum.frame({ order: ORDER, landings: [], spin: null, nowMs: T - 1000, reduced: false });
  run(drum, () => ({ order: ORDER, landings: [], spin: held, reduced: false }), T, T + 9000);
  const target = ORDER[44]!;
  const released: PublicSpin = { startAtMs: T, landAtMs: T + 13_000, spinSeed: 2, targetId: target };
  const f = run(drum, () => ({ order: ORDER, landings: [], spin: released, reduced: false }), T + 9016, T + 13_000);
  assert.equal(under(f), target, 'on the target at landAtMs');
  assert.ok(Math.abs(f.position - Math.round(f.position)) < 1e-3 && Math.abs(f.velocity) < 0.05, `at rest (within a sample): ${f.position} ${f.velocity}`);
  const g = drum.frame({ order: ORDER, landings: [landing(0, target, T + 13_000)], spin: null, nowMs: T + 13_100, reduced: false });
  assert.deepEqual([g.phase, g.selectedId], ['landed', target]);
  // A Spin that becomes a held Suspense loses its target: it never rests on it, it creeps on, veiled.
  const turned = new PhoneDrum();
  const spin: PublicSpin = { startAtMs: T, landAtMs: T + 7000, spinSeed: 8, targetId: ORDER[20]! };
  turned.frame({ order: ORDER, landings: [], spin: null, nowMs: T - 1000, reduced: false });
  run(turned, () => ({ order: ORDER, landings: [], spin, reduced: false }), T, T + 3000);
  const h = run(turned, () => ({ order: ORDER, landings: [], spin: { startAtMs: T, landAtMs: null }, reduced: false }), T + 3016, T + 15_000);
  assert.ok(Math.abs(h.velocity) >= DRUM.creepFloor - 1e-9 && h.blurPx >= DRUM.veilPx && h.selectedId === null);
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

test('the words wait for the drum (§13): the last ones, faded, while it turns and glides; the new title as it comes to rest', () => {
  const drum = new PhoneDrum();
  const first = landing(0, ORDER[0]!, T - 20_000);
  const spin: PublicSpin = { startAtMs: T, landAtMs: T + 7000, spinSeed: 5 };
  // What the drum's words show, frame by frame, as Reel.svelte keeps it.
  let shown: PublicLanding | null = null;
  const show = (f: DrumFrame, latest: PublicLanding | null) => (shown = wordsLanding(f, latest, shown));
  let f = drum.frame({ order: ORDER, landings: [first], spin: null, nowMs: T - 1000, reduced: false });
  assert.equal(show(f, first), first);
  for (let ms = T; ms <= T + 7400; ms += 16) {
    f = drum.frame({ order: ORDER, landings: [first], spin, nowMs: ms, reduced: false });
    assert.equal(show(f, first), first, 'the last song while it turns');
    assert.ok(wordsStale(f.phase), 'faded');
  }
  const next = landing(1, ORDER[40]!, T + 7000);
  // The landing is public before the drum's next frame: still the last words.
  assert.equal(show(f, next), first);
  let rested = 0;
  for (let ms = T + 7416; ms <= T + 7416 + glideSec(35) * 1000 + 100; ms += 16) {
    f = drum.frame({ order: ORDER, landings: [first, next], spin: null, nowMs: ms, reduced: false });
    const words = show(f, next);
    if (f.phase === 'gliding') {
      assert.equal(words, first, 'the last song while it glides');
      assert.ok(wordsStale(f.phase));
    } else {
      assert.equal(words, next, 'the new song as it rests on its tile');
      assert.ok(!wordsStale(f.phase));
      rested++;
    }
  }
  assert.ok(rested > 0);
  // A Back: the words go back when the drum rests on the last landing's tile again.
  let back = 0;
  for (let ms = T + 10_000; ms <= T + 12_000; ms += 16) {
    f = drum.frame({ order: ORDER, landings: [first], spin: null, nowMs: ms, reduced: false });
    const words = show(f, first);
    if (f.phase === 'gliding') assert.equal(words, next);
    else (assert.equal(words, first), back++);
  }
  assert.ok(back > 0);
  // Reduced motion: the drum rests on the tile at once, and the words change with it.
  const still = new PhoneDrum();
  shown = null;
  still.frame({ order: ORDER, landings: [first], spin, nowMs: T + 3000, reduced: true });
  assert.equal(show(still.frame({ order: ORDER, landings: [first, next], spin: null, nowMs: T + 7100, reduced: true }), next), next);
  // A new round: no landing, no words (the waiting line).
  assert.equal(show(f, null), null);
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
