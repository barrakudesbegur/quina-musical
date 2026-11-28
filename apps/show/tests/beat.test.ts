// The pulse of the song heard (`state.beat`, plan/beat.ts): the grid a deck plays, the rule that keeps the published
// value still unless it changed materially (it goes out to every phone), and which song the show says the room hears.
import nodeTest from 'node:test';
import assert from 'node:assert/strict';
import { dataTest } from './support/data.ts';
import type { BeatInfo, EventOf, ShowEvent, ShowEventType } from '@quina/protocol';
import { BEAT, HOLD } from '../engine/src/config.ts';
import { NO_BEAT, beatInfo, deckBeat, localBpm, nextBeat, phaseOffMs, playsSame, sameGrid, type BeatPublication, type BeatSource } from '../engine/src/plan/beat.ts';
import type { Analysis } from '../engine/src/analysis.ts';
import type { Effect } from '../engine/src/show/show.ts';
import { setup, analyses, allCards, songs, type Harness } from './support/harness.ts';

// ---------------------------------------------------------------------------------- the pure module
/** A steady song: a downbeat every 2 s (4 beats a bar: 120 bpm) for 60 bars. */
const steady = { downbeats: Array.from({ length: 60 }, (_, k) => k * 2), tempo: { bpm: 119, beatsPerBar: 4, barSecMedian: 2 }, source: { durationSec: 120 } } as unknown as Analysis;
const withDownbeats = (downbeats: number[], beatsPerBar = 4) => ({ ...steady, downbeats, tempo: { ...steady.tempo, beatsPerBar } }) as Analysis;
const near = (a: number, b: number, eps = 1e-9) => Math.abs(a - b) <= eps;

nodeTest('the local tempo: the median of the next bars, robust to one odd bar; the analysis tempo with no bar after', () => {
  assert.equal(localBpm(steady, 10), 120);
  // One bar 0.5 s long among 2 s ones (a misplaced downbeat) doesn't move the median.
  const odd = withDownbeats([0, 2, 4, 4.5, 6.5, 8.5, 10.5, 12.5, 14.5, 16.5, 18.5]);
  assert.equal(localBpm(odd, 0), 120);
  // Faster from bar 20 on (1.5 s bars = 160 bpm): the anchor's own bars count, not the song's average.
  const faster = withDownbeats(Array.from({ length: 40 }, (_, k) => (k <= 20 ? k * 2 : 40 + (k - 20) * 1.5)));
  assert.equal(localBpm(faster, 5), 120);
  assert.equal(localBpm(faster, 20), 160);
  assert.ok(near(localBpm(faster, 18), 160), 'the median of 2, 2, 1.5 × 6');
  assert.equal(localBpm(steady, 58), 120, 'near the end, the bars left');
  assert.equal(localBpm(steady, 59), 119, 'the last downbeat: the analysis tempo');
  assert.equal(localBpm(withDownbeats([0, 2, 4], 3), 0), 90, 'three beats a bar');
});

nodeTest('the grid a deck plays: the latest downbeat at or before now, its tempo times the rate', () => {
  // Bar 10 (20 s) sounded at context 100.
  const deck = { startCtx: 100, offset: 20 };
  assert.deepEqual(deckBeat(steady, deck, 10, 103.9), { bpm: 120, beatsPerBar: 4, downbeatAt: 102 });
  assert.deepEqual(deckBeat(steady, deck, 10, 104), { bpm: 120, beatsPerBar: 4, downbeatAt: 104 }, 'on a downbeat: that one');
  // At rate 1.04 the song's 2 s bars last 2/1.04 s on the clock.
  const fast = deckBeat(steady, { ...deck, rate: 1.04 }, 10, 103.9);
  assert.ok(fast && near(fast.bpm, 124.8) && near(fast.downbeatAt, 100 + 4 / 1.04), 'at 24.06 s: the downbeat at 24 s');
  assert.equal(deckBeat(withDownbeats([]), deck, null, 103), null, 'no grid');
});

nodeTest('before its landing a deck is anchored on the landing downbeat, ahead of now; any other anchor ahead goes back whole bars', () => {
  // A Spin: B's hook (bar 10, 20 s) lands at context 100; B starts at 99.4 from 19.4 s.
  const landing = { startCtx: 99.4, offset: 19.4 };
  for (const now of [95, 99.4, 99.9]) assert.deepEqual(deckBeat(steady, landing, 10, now), { bpm: 120, beatsPerBar: 4, downbeatAt: 100 });
  assert.deepEqual(deckBeat(steady, landing, 10, 101), { bpm: 120, beatsPerBar: 4, downbeatAt: 100 }, 'landed: its own downbeat');
  // A phrase loop's re-cue 0.35 s ahead: bar 40 (80 s) plays again at 200.35. Its anchor is that downbeat, one bar back.
  const recue = deckBeat(steady, { startCtx: 200.35, offset: 80 }, 10, 200);
  assert.ok(recue && near(recue.downbeatAt, 198.35));
  // A Suspense's loop of the phrase it landed on: its re-cue starts on the landed downbeat itself, not a landing.
  const again = deckBeat(steady, { startCtx: 200.35, offset: 20 }, 10, 200);
  assert.ok(again && near(again.downbeatAt, 198.35));
  // A Pausa resume 0.1 s ahead, from 81.3 s: the downbeat at 80 s maps to 198.8, before now.
  const resume = deckBeat(steady, { startCtx: 200.1, offset: 81.3 }, 10, 200);
  assert.ok(resume && near(resume.downbeatAt, 198.8));
});

nodeTest('the state carries whole epoch ms and bpm to a thousandth', () => {
  assert.deepEqual(beatInfo({ bpm: 128.00049, beatsPerBar: 4, downbeatAt: 12.3456789 }, (t) => 1_700_000_000_000 + t * 1000), { bpm: 128, beatsPerBar: 4, downbeatAtMs: 1_700_000_012_346 });
});

const grid = (downbeatAtMs: number, bpm = 120, beatsPerBar = 4): BeatInfo => ({ bpm, beatsPerBar, downbeatAtMs });

nodeTest('the same grid: same metre, bpm within the tolerance, the downbeat on the grid modulo a bar', () => {
  const a = grid(10_000); // a 2000 ms bar
  assert.equal(phaseOffMs(a, 16_000), 0, 'three bars later');
  assert.equal(phaseOffMs(a, 4_000), 0, 'three bars before');
  assert.equal(phaseOffMs(a, 16_020), 20);
  assert.equal(phaseOffMs(a, 15_990), 10, 'early counts too');
  assert.ok(sameGrid(a, grid(16_000 + BEAT.driftMs)));
  assert.ok(!sameGrid(a, grid(16_000 + BEAT.driftMs + 1)));
  assert.ok(!sameGrid(a, grid(17_000)), 'half a bar off');
  assert.ok(sameGrid(a, grid(16_000, 120 * (1 + BEAT.bpmTolerance * 0.9))));
  assert.ok(!sameGrid(a, grid(16_000, 120 * (1 + BEAT.bpmTolerance * 1.5))));
  assert.ok(!sameGrid(a, grid(16_000, 120, 3)), 'another metre');
  // Phones show a value that waits for its downbeat differently from one that moves already.
  assert.ok(playsSame(a, grid(16_000), 20_000));
  assert.ok(!playsSame(grid(22_000), grid(16_000), 20_000), 'one waits for 22 000, the other moves');
  assert.ok(!playsSame(grid(22_000), grid(24_000), 20_000), 'both wait, for different downbeats');
  assert.ok(playsSame(grid(22_000), grid(22_010), 20_000));
});

const deckA: BeatSource = { songId: 1, startCtx: 100, offset: 20, rate: 1 };
const send = (info: BeatInfo, source: BeatSource, sentAtMs: number): BeatPublication => ({ info, source, sentAtMs });

nodeTest('publishing: null and back at once; the same deck re-anchors only past the drift, at most once per minReanchorSec', () => {
  const first = nextBeat(NO_BEAT, { info: grid(10_000), source: deckA }, 10_100);
  assert.deepEqual(first, send(grid(10_000), deckA, 10_100));
  assert.equal(nextBeat(NO_BEAT, null, 10_000), NO_BEAT, 'nothing heard, nothing published: unchanged');
  assert.deepEqual(nextBeat(first, null, 11_000), { info: null, source: null, sentAtMs: 11_000 });
  // The same deck, its downbeats a little off the published grid: kept (the very same value).
  const later = 10_100 + BEAT.minReanchorSec * 1000;
  assert.equal(nextBeat(first, { info: grid(30_000 + BEAT.driftMs), source: deckA }, later), first);
  // Past the drift: re-anchored, but not sooner than minReanchorSec after the last value went out.
  const drifted = { info: grid(30_040, 119.8), source: deckA };
  assert.equal(nextBeat(first, drifted, later - 1), first);
  assert.deepEqual(nextBeat(first, drifted, later), send(drifted.info, deckA, later));
});

nodeTest("publishing: a new deck goes out at once unless phones would show it the same; a landing's anchor stays until it passes", () => {
  const published = send(grid(10_000), deckA, 10_000);
  // A loop's re-cue: another clock, the same grid. The value stays; only its source moves on (no re-send).
  const recued: BeatSource = { ...deckA, startCtx: 140, offset: 60 };
  const kept = nextBeat(published, { info: grid(40_000), source: recued }, 40_100);
  assert.equal(kept.info, published.info);
  assert.deepEqual(kept.source, recued);
  assert.equal(kept.sentAtMs, 10_000);
  // Another song, or a clock that moved the grid: at once, even right after the last value (no rate limit).
  const deckB: BeatSource = { songId: 2, startCtx: 120, offset: 30, rate: 1 };
  assert.deepEqual(nextBeat(published, { info: grid(10_900, 98), source: deckB }, 10_001), send(grid(10_900, 98), deckB, 10_001));
  assert.deepEqual(nextBeat(published, { info: grid(40_500), source: recued }, 40_600), send(grid(40_500), recued, 40_600));
  // B's landing at 50 000 published from A's exit start: its own deck keeps it until the landing passes, whatever its
  // anchor says meanwhile; after it, the drift rule.
  const landing = send(grid(50_000, 98), deckB, 47_000);
  assert.equal(nextBeat(landing, { info: grid(49_000, 98), source: deckB }, 52_000 - 2_001), landing);
  assert.equal(nextBeat(landing, { info: grid(50_000, 98), source: deckB }, 50_000), landing);
  // A cancelled Spin back to A, whose grid happens to match B's: A moves now, the landing would wait. Sent.
  const backToA = nextBeat(landing, { info: grid(42_000, 98), source: deckA }, 48_000);
  assert.deepEqual(backToA, send(grid(42_000, 98), deckA, 48_000));
});

// ---------------------------------------------------------------------------------- the show
const isEventOf = <T extends ShowEventType>(event: ShowEvent, type: T): event is EventOf<T> => event.type === type;
const emitted = <T extends ShowEventType>(effects: readonly Effect[], type: T) =>
  effects.flatMap((e) => (e.type === 'emit' && isEventOf(e.message, type) ? [e.message] : []));
const states = (effects: readonly Effect[]) => emitted(effects, 'state');
const lastState = (effects: readonly Effect[]) => {
  const s = states(effects).at(-1);
  assert.ok(s, 'a state was sent');
  return s;
};
/** The beat the show would publish from scratch now: the grid heard, as the state carries it. */
function heardNow(h: Harness): BeatInfo | null {
  const c = h.show.beatCandidate(h.clock.t);
  return c && beatInfo(c.grid, h.env.toEpochMs);
}
/** The song's own beat at `songId`'s landing on `hookIndex` at T (B's from its hook, at rate 1). */
const landingBpm = (songId: number, hookIndex: number) => {
  const analysis = analyses.get(songId);
  assert.ok(analysis);
  return localBpm(analysis, hookIndex);
};
function land(h: Harness) {
  const position = h.show.position;
  const out = h.send('next');
  h.until(() => h.show.position === position + 1 && h.show.status === 'playing', 200);
  return out;
}
/**
 * The hard rule (Backend): a phone learns the landing song from `transition.scheduled`, so no state carries a landing's
 * beat (anchored ahead of now) before that Spin's `transition.scheduled` went out.
 */
function assertBeatNeverAhead(log: readonly Effect[]) {
  const scheduled: number[] = [];
  let checked = 0;
  for (const e of log) {
    if (e.type !== 'emit') continue;
    if (e.message.type === 'transition.scheduled') scheduled.push(e.message.landAtMs);
    if (e.message.type !== 'state' || !e.message.beat) continue;
    const { beat, atMs } = e.message;
    if (beat.downbeatAtMs <= atMs) continue;
    checked++;
    assert.ok(scheduled.some((T) => Math.abs(T - beat.downbeatAtMs) <= 1), `a landing's beat (${beat.downbeatAtMs}) before its transition.scheduled`);
  }
  return checked;
}

dataTest("a Spin: the outgoing song's beat until its exit starts, then the incoming one's anchored on the landing; the landing sends nothing new", () => {
  const h = setup({ seed: 6, settings: { autoAdvance: false } });
  h.send('unlock');
  // The first Spin has no outgoing song: its beat is B's at once, after its transition.scheduled in the same output.
  const first = h.send('next');
  const firstSpin = emitted(first, 'transition.scheduled')[0];
  assert.ok(firstSpin);
  const firstBeat = lastState(first).beat;
  assert.ok(firstBeat && Math.abs(firstBeat.downbeatAtMs - firstSpin.landAtMs) <= 0.5, 'anchored on the landing');
  const order = first.filter((e) => e.type === 'emit').map((e) => (e.type === 'emit' ? e.message.type : ''));
  assert.ok(order.indexOf('transition.scheduled') < order.indexOf('state'), 'scheduled before the state');
  const published = h.show.beat.info;
  assert.deepEqual(published, firstBeat);
  h.until(() => h.show.status === 'playing');
  assert.equal(h.show.beat.info, published, 'landed: the same value, not sent again');
  h.advance(5);
  const aBeat = h.show.beat.info;
  assert.ok(aBeat && aBeat.downbeatAtMs <= h.env.nowMs());
  // The second Spin: A plays on until its exit move starts.
  const out = h.send('next');
  const t = h.show.transition;
  assert.ok(t && t.aExitStart != null && t.aExitStart > h.clock.t + 0.1, 'A has a while before its exit');
  const spin = emitted(out, 'transition.scheduled')[0];
  assert.ok(spin);
  const atCommand = lastState(out).beat;
  assert.ok(atCommand && atCommand.downbeatAtMs < h.env.nowMs(), "still A's");
  const exitStart = t.aExitStart;
  const before = h.log.length;
  h.until(() => h.clock.t >= exitStart);
  const switched = states(h.log.slice(before));
  assert.equal(switched.length, 1, 'one state, at the exit start');
  const bBeat = h.show.beat.info;
  assert.ok(bBeat);
  assert.deepEqual(switched[0].beat, bBeat);
  assert.ok(Math.abs(bBeat.downbeatAtMs - spin.landAtMs) <= 0.5, 'anchored on the landing');
  const b = analyses.get(t.songId);
  assert.ok(b);
  assert.equal(bBeat.beatsPerBar, b.tempo.beatsPerBar);
  assert.ok(Math.abs(bBeat.bpm - landingBpm(t.songId, t.plan.hook.downbeatIndex) * t.plan.b.rate) < 0.001, "B's own tempo from its hook");
  assert.equal(t.plan.b.rate, 1, 'B lands at its own speed');
  h.until(() => h.show.status === 'playing');
  assert.equal(h.show.beat.info, bBeat, 'the landing plays the published grid: nothing new to send');
  const heard = heardNow(h);
  assert.ok(heard && playsSame(bBeat, heard, h.env.nowMs()), "B's grid as it plays");
  assert.ok(assertBeatNeverAhead(h.log) >= 2);
});

dataTest('Hold music, Pausa and a cancelled Spin: null when no song is heard; Parlem still counts', () => {
  const h = setup({ seed: 6, settings: { autoAdvance: false } });
  h.send('unlock');
  land(h);
  h.advance(3);
  const playing = h.show.beat.info;
  assert.ok(playing);
  // Parlem: the song ducked under the voices, still heard.
  assert.equal(lastState(h.send('hold', { on: true })).beat?.downbeatAtMs, playing.downbeatAtMs);
  assert.equal(lastState(h.send('hold', { on: false })).beat?.downbeatAtMs, playing.downbeatAtMs);
  // Pausa: null at once; its end resumes the song on a moved timeline, and the beat is that timeline's.
  assert.equal(lastState(h.send('pause', { on: true })).beat, null);
  h.advance(7.77);
  assert.equal(h.show.beat.info, null);
  const resumed = lastState(h.send('pause', { on: false })).beat;
  assert.ok(resumed);
  const cur = h.show.current;
  const analysis = cur && analyses.get(cur.songId);
  assert.ok(cur && analysis);
  const onDownbeat = analysis.downbeats.some((d) => Math.abs(h.env.toEpochMs(cur.startCtx + (d - cur.offset) / cur.rate) - resumed.downbeatAtMs) <= 1);
  assert.ok(onDownbeat, "anchored on one of the song's downbeats where the resumed clock plays it");
  assert.deepEqual(resumed, heardNow(h));
  assert.ok(phaseOffMs(playing, resumed.downbeatAtMs) > BEAT.driftMs, 'moved by the paused time (7.77 s is no whole bar here)');
  // Hold music takes over: null.
  assert.equal(lastState(h.send('holdMusic')).beat, null);
  // From Hold music, a Spin has no outgoing song: B's beat at once. Cancelled after that: back to Hold music, null.
  const spin = h.send('next');
  assert.ok(lastState(spin).beat);
  h.advance(0.5);
  assert.equal(lastState(h.send('back')).beat, null);
  // A Spin cancelled before A's exit starts keeps A playing, and its beat never changed.
  h.send('next');
  h.until(() => h.show.status === 'playing', 200);
  h.advance(3);
  const a = h.show.beat.info;
  assert.ok(a);
  h.send('next');
  const t = h.show.transition;
  assert.ok(t?.aExitStart != null && t.aExitStart > h.clock.t + HOLD.cancelMinSec);
  const cancelled = h.send('back');
  assert.equal(emitted(cancelled, 'transition.cancelled')[0]?.keptOutgoing, true);
  assert.equal(h.show.beat.info, a, "A's, never changed");
  assert.deepEqual(lastState(cancelled).beat, a);
  assertBeatNeverAhead(h.log);
});

dataTest("a held Suspense: the outgoing song's beat over its loop, never the incoming one's before the release's transition.scheduled", () => {
  const h = setup({ seed: 4, settings: { autoAdvance: false } });
  h.send('unlock');
  land(h);
  h.advance(4);
  const opened = h.send('suspense');
  const s = h.show.suspense;
  assert.ok(s?.open.loop, "over A's phrase loop");
  const aBeat = lastState(opened).beat;
  assert.ok(aBeat && aBeat.downbeatAtMs <= h.env.nowMs(), "A's");
  const from = h.log.length;
  h.advance(2.5 * s.open.loop.passSec);
  assert.ok(h.log.slice(from).some((e) => e.type === 'cue'), 'its phrase repeated');
  for (const state of states(h.log.slice(from))) assert.ok(state.beat == null || state.beat.downbeatAtMs <= state.atMs, 'never a landing');
  const heard = heardNow(h);
  assert.ok(heard && h.show.beat.info && playsSame(h.show.beat.info, heard, h.env.nowMs()), "A's grid as its loop plays");
  // The release: its Spin is scheduled first; B's beat comes from A's exit start on.
  const release = h.send('suspense', { on: false });
  const spin = emitted(release, 'transition.scheduled')[0];
  assert.ok(spin);
  const exitStart = h.show.transition?.aExitStart;
  assert.ok(exitStart != null);
  h.until(() => h.clock.t >= exitStart);
  assert.ok(Math.abs((h.show.beat.info?.downbeatAtMs ?? 0) - spin.landAtMs) <= 0.5);
  h.until(() => h.show.status === 'playing');
  // A Spin turned into a Suspense after A's exit started (D177): A is gone and B not landing yet: null.
  h.advance(3);
  h.send('next');
  const t = h.show.transition;
  assert.ok(t?.aExitStart != null);
  const exit = t.aExitStart;
  h.until(() => h.clock.t >= exit + 0.05);
  assert.ok(h.show.beat.info && h.show.beat.info.downbeatAtMs > h.env.nowMs(), "B's landing, already public");
  assert.ok(t.T - h.clock.t > HOLD.cancelMinSec);
  assert.equal(lastState(h.send('suspense')).beat, null);
  assert.ok(h.show.suspense && !h.show.suspense.open.loop);
  h.advance(3);
  assert.equal(h.show.beat.info, null);
  const second = h.send('suspense', { on: false });
  const secondSpin = emitted(second, 'transition.scheduled')[0];
  assert.ok(secondSpin);
  assert.ok(Math.abs((lastState(second).beat?.downbeatAtMs ?? 0) - secondSpin.landAtMs) <= 0.5, "B's again, after its Spin");
  assert.ok(assertBeatNeverAhead(h.log) >= 2);
});

dataTest("a Check's reveals: null while its snippets play over the music far down; back with the music", () => {
  const h = setup({ seed: 3, cards: allCards, cardsInPlay: '1-200', settings: { autoAdvance: false } });
  h.send('unlock');
  for (let k = 0; k < 3; k++) land(h);
  h.send('claim', { cardId: 17 });
  const run = h.show.check;
  assert.ok(run && run.songs.length > 0, 'a Check with songs to reveal');
  assert.ok(h.show.beat.info, 'the music from before the Check plays on until the first reveal');
  assert.equal(lastState(h.send('checkNext', { claimId: run.info.claimId, step: 0 })).beat, null);
  h.advance(2);
  assert.equal(h.show.beat.info, null);
  // Its step back to no reveal brings the music back up.
  assert.ok(lastState(h.send('checkBack', { claimId: run.info.claimId, step: 0 })).beat);
});

/** A test-repertoire song whose drift never re-anchors it, and whose last phrase loops back on its own grid. */
const STEADY = 10;

dataTest('a steady song sends no state for a whole minute; its Aguanta loop re-cues without a new beat', () => {
  const ids = songs.map((s) => s.id);
  assert.ok(ids.includes(STEADY), 'the steady song is in the test repertoire');
  const h = setup({ seed: 6, fixedQueue: [STEADY, ...ids.filter((id) => id !== STEADY)], settings: { autoAdvance: false } });
  h.send('unlock');
  land(h);
  h.advance(1);
  const beat = h.show.beat.info;
  const from = h.log.length;
  h.advance(60);
  assert.equal(states(h.log.slice(from)).length, 0, 'not a single state in a minute');
  assert.equal(h.show.beat.info, beat);
  // Aguanta until well past the song's end: its last phrase repeats, and the beat stays the same value.
  h.send('hold', { on: true, duck: false });
  const end = h.show.current?.endCtx ?? 0;
  const looping = h.log.length;
  const values = new Set<BeatInfo | null>();
  h.until(() => {
    values.add(h.show.beat.info);
    return h.clock.t > end + 60;
  }, 400);
  const cues = h.log.slice(looping).filter((e) => e.type === 'cue').length;
  assert.ok(cues >= 5, `${cues} re-cues`);
  assert.equal(values.size, 1, 'no new beat at any re-cue');
  const heard = heardNow(h);
  assert.ok(heard && playsSame([...values][0]!, heard, h.env.nowMs()), 'the published grid is still what plays');
});

dataTest('over a whole round of Spins, Holds and Suspense, a landing\'s beat never goes out before its transition.scheduled', () => {
  const h = setup({ seed: 11, settings: { autoAdvance: true } });
  h.send('unlock');
  for (let k = 0; k < 6; k++) {
    h.advance(12);
    if (k === 2) h.send('suspense');
    if (k === 3) h.send('suspense', { on: false });
    if (k === 4) h.send('hold', { on: true });
    if (k === 5) h.send('hold', { on: false });
  }
  h.advance(120);
  assert.ok(emitted(h.log, 'transition.landed').length >= 5);
  assert.ok(assertBeatNeverAhead(h.log) >= 5);
});
