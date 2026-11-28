// `mark-bob` (ANIMATIONS.md, the user, 28 Nov): the beat adapter (the feed's `state.beat`, or a demo's `&bpm=`), the
// swing's period by tempo and bar, and the CSS delay that phase-aligns it to the downbeat on the show clock.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { BOB, beatsPerSide, bobOn, bobStyle, bobTiming, keepTiming, songBeat, type BobClock, type PublicBeat } from '../../../../player/logic/beat.ts';
import type { PublicState } from '../../../../player/feed/public.ts';

const state = (beat: unknown) => ({ scene: 'play', beat }) as unknown as PublicState;
const LANDING = { position: 3, songId: 7, atMs: 1_000_000 };

test('the adapter reads state.beat; absent or null is no bob', () => {
  const beat: PublicBeat = { bpm: 120, beatsPerBar: 4, downbeatAtMs: 5000 };
  assert.deepEqual(songBeat(state(beat), LANDING), beat);
  assert.equal(songBeat(state(undefined), LANDING), null, 'an older feed: no field');
  assert.equal(songBeat(state(null), LANDING), null, 'no song heard');
  assert.equal(songBeat(null, null), null);
  assert.equal(songBeat(state({ bpm: -1, beatsPerBar: 4, downbeatAtMs: 0 }), LANDING), null, 'a bad bpm');
  assert.equal(songBeat(state({ bpm: 120, beatsPerBar: 4 }), LANDING), null, 'no downbeat');
  assert.deepEqual(songBeat(state({ bpm: 120, downbeatAtMs: 9 }), LANDING), { bpm: 120, beatsPerBar: 4, downbeatAtMs: 9 }, 'no bar: 4');
});

test("a demo's &bpm= builds a 4-beat bar from the latest landing; the feed's own beat wins", () => {
  assert.deepEqual(songBeat(state(undefined), LANDING, 120), { bpm: 120, beatsPerBar: BOB.demoBeatsPerBar, downbeatAtMs: LANDING.atMs });
  assert.equal(songBeat(state(undefined), null, 120), null, 'nothing landed yet: no song heard');
  const sent: PublicBeat = { bpm: 98, beatsPerBar: 3, downbeatAtMs: 42 };
  assert.deepEqual(songBeat(state(sent), LANDING, 120), sent);
});

test('one side per beat; a fast pulse takes two beats a side (a bar in 3/4), never off the beat', () => {
  assert.equal(beatsPerSide(120, 4), 1);
  assert.equal(beatsPerSide(135, 4), 1);
  assert.equal(beatsPerSide(171, 4), 2, 'the fast pulse many songs are analysed at: half time');
  assert.equal(beatsPerSide(171, 3), 3, 'a 3/4 bar: one side per bar, never a half bar (off the beat)');
  assert.equal(beatsPerSide(171, 2), 2);
  assert.equal(beatsPerSide(300, 4), 4, 'very fast: a bar a side');
  assert.equal(beatsPerSide(60, 4), 1, 'slow songs: still one side per beat');
});

/** A phone whose clock is 250 ms behind the cloud's, whose page opened 10 s ago (timeline 10 000 at local 2 000 000). */
const clock = (localNowMs: number): BobClock => ({ offsetMs: 250, localNowMs, timelineNowMs: localNowMs - 1_990_000 });

test('period: two sides; delay: the downbeat on the document timeline, one period back at most', () => {
  // The downbeat at cloud 1 999 750 = local 1 999 500 = timeline 9 500 (half a second ago).
  const t = bobTiming({ bpm: 120, beatsPerBar: 4, downbeatAtMs: 1_999_750 }, clock(2_000_000));
  assert.ok(t);
  assert.equal(t.periodMs, 1000, '120 bpm: a side per 500 ms beat, a cycle per two beats');
  assert.equal(t.ahead, false);
  // 9 500 mod 1 000 = 500 → −500 ms: pinned at the timeline's zero, the cycle restarts at 9 500, 10 500…
  assert.equal(t.delayMs, -500);
  assert.equal(mod(9500 - t.delayMs, t.periodMs), 0, 'a cycle starts exactly on the downbeat');
  assert.ok(t.delayMs <= 0 && t.delayMs > -t.periodMs);
  assert.deepEqual(bobStyle(t), { period: '1000ms', delay: '-500ms' });
});

test('the clock offset moves the phase by itself; a downbeat on the beat grid gives the same delay', () => {
  const beat: PublicBeat = { bpm: 100, beatsPerBar: 4, downbeatAtMs: 1_999_750 };
  const a = bobTiming(beat, clock(2_000_000));
  const b = bobTiming(beat, { ...clock(2_000_000), offsetMs: 300 });
  assert.ok(a && b);
  assert.equal(a.periodMs, 1200);
  assert.equal(mod(a.delayMs - b.delayMs, a.periodMs), 50, 'a cloud 50 ms further ahead: the downbeat 50 ms earlier locally');
  const later = bobTiming({ ...beat, downbeatAtMs: beat.downbeatAtMs - 4 * a.periodMs }, clock(2_000_000));
  assert.equal(later?.delayMs, a.delayMs, 'a downbeat whole cycles earlier: the same phase');
});

test("a downbeat still ahead (a Spin's landing): a positive delay, so nothing moves before it", () => {
  // landAtMs at cloud 2 003 250 = local 2 003 000 = timeline 13 000: 3 s from now.
  const t = bobTiming({ bpm: 120, beatsPerBar: 4, downbeatAtMs: 2_003_250 }, clock(2_000_000));
  assert.deepEqual(t, { periodMs: 1000, delayMs: 13_000, ahead: true });
  const after = bobTiming({ bpm: 120, beatsPerBar: 4, downbeatAtMs: 2_003_250 }, clock(2_003_100));
  assert.equal(after?.ahead, false, 'once it has passed');
  assert.equal(mod(13_000 - (after?.delayMs ?? NaN), 1000), 0, 'the same phase as while it was ahead');
});

test('no beat: no timing', () => {
  assert.equal(bobTiming(null, clock(0)), null);
});

test('the timing on screen stays through a millisecond of wobble, changes past the tolerance or with the period', () => {
  const shown = { periodMs: 1000, delayMs: -500, ahead: false };
  assert.equal(keepTiming(shown, { ...shown, delayMs: -499 }), shown);
  assert.equal(keepTiming(shown, { ...shown, delayMs: -504 }), shown, 'within 4 ms');
  assert.equal(keepTiming({ ...shown, delayMs: -998 }, { ...shown, delayMs: -1 }).delayMs, -998, 'across the cycle end: 3 ms apart');
  const moved = { ...shown, delayMs: -490 };
  assert.equal(keepTiming(shown, moved), moved);
  const tempo = { ...shown, periodMs: 1100 };
  assert.equal(keepTiming(shown, tempo), tempo);
  const landed = { ...shown, ahead: true };
  assert.equal(keepTiming(shown, landed), landed);
  assert.equal(keepTiming(shown, null), null);
  assert.equal(keepTiming(null, shown), shown);
});

test('the marks bob only while a song is heard in play: never a Check, a Celebration, the Pausa, offline or with the link lost', () => {
  const timing = { periodMs: 1000, delayMs: 0, ahead: false };
  const on = { scene: 'play', paused: false, offline: false, linkOnline: true, celebrationOpen: false, timing };
  assert.equal(bobOn(on), true);
  assert.equal(bobOn({ ...on, timing: null }), false, 'no beat');
  for (const scene of ['check', 'celebration', 'interval', 'roundStart', 'before', 'after']) assert.equal(bobOn({ ...on, scene }), false, scene);
  assert.equal(bobOn({ ...on, paused: true }), false);
  assert.equal(bobOn({ ...on, offline: true }), false);
  assert.equal(bobOn({ ...on, linkOnline: false }), false, "the laptop's link lost: the cloud's last beat may be stale");
  assert.equal(bobOn({ ...on, celebrationOpen: true }), false);
});

function mod(a: number, n: number): number {
  return ((a % n) + n) % n;
}
