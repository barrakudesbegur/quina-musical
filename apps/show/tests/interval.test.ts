// The Interval playlist: the Game's order, the handover plan (echo-out on a downbeat, the next track rising or
// opening up into it), the track contract, and how the show state machine drives it (intervalSkip, the volume,
// the track in the state, the scene rules) plus the "Hold music off" setting.
import { dataTest as test } from './support/data.ts';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { AUTO_SOUNDS_DEFAULT, VOLUME_DEFAULTS, autoSoundsOf, checkGamePlan, replayJournal, sceneAllows, volumeDb, type JournalEntry, type SceneContext } from '@quina/protocol';
import { FLOW, INTERVAL, INTRO } from '../engine/src/config.ts';
import { checkIntervalTrack, intervalSlugs, intervalTrackProblems, type IntervalTrack } from '../engine/src/interval/tracks.ts';
import {
  gameSeed,
  loopGrid,
  naturalHandoverSec,
  orderCycle,
  planHandover,
  temposMatch,
  trackAt,
  trackGrid,
  valueAt,
  type Handover,
  type HandoverRequest,
} from '../engine/src/interval/plan.ts';
import type { Effect, EffectOf, EffectType } from '../engine/src/show/show.ts';
import { setup, type Harness } from './support/harness.ts';
import { OUT } from '../relay/repertoire.ts';

const find = <T extends EffectType>(effects: readonly Effect[], type: T) => effects.find((e): e is EffectOf<T> => e.type === type);
const rejected = (effects: readonly Effect[]) => effects.filter((e) => e.type === 'reject').map((e) => e.reason);
const journalOf = (effects: readonly Effect[]): JournalEntry[] => effects.flatMap((e) => (e.type === 'journal' ? [e.entry] : []));
const EPS = 1e-9;

interface TrackShape {
  first?: number;
  startSec?: number;
  endSec?: number;
  fadeStartSec?: number;
  beatsPerBar?: number;
}

/** A synthetic track: `bpm` in 4/4, downbeats from `first` to its end. */
function track(slug: string, bpm: number, shape: TrackShape = {}): IntervalTrack {
  const { first = 0.5, startSec = 0.2, endSec = 180, beatsPerBar = 4 } = shape;
  const fadeStartSec = shape.fadeStartSec ?? endSec - 2;
  const durationSec = endSec + 1;
  const beat = 60 / bpm;
  const beats: number[] = [];
  for (let t = first; t <= durationSec; t += beat) beats.push(Math.round(t * 1e4) / 1e4);
  const downbeats = beats.filter((_, i) => i % beatsPerBar === 0);
  return {
    slug, title: slug, artist: 'Test', position: null, sampleRate: 48000, durationSec,
    tempo: { bpm, beatsPerBar }, beats, downbeats,
    edges: { startSec, endSec, fadeStartSec, firstDownbeatSec: first }, gainToTargetDb: 0,
  };
}

/** Every automation time is at or after `now`, ramps never touch 0 exponentially, and the music never drops out. */
function assertSound(h: Handover, now: number, { fromSilence = false } = {}) {
  for (const a of h.automation) assert.ok(a.at >= now - EPS, `${a.target} at ${a.at} before now ${now}`);
  for (const a of h.automation.filter((x) => x.curve === 'exp')) {
    const before = h.automation.filter((x) => x.target === a.target && x.at <= a.at && x !== a).at(-1);
    assert.ok(a.value > 0 && (before?.value ?? 1) > 0, `${a.target}: an exponential ramp through 0`);
  }
  if (fromSilence) return;
  // Before the one the outgoing music plays dry; from the one the incoming track is up.
  for (let t = now; t <= h.at + 4; t += 0.005) {
    const out = valueAt(h.automation, 'out.gain', t, 1);
    const inc = t >= h.incoming.startAt ? valueAt(h.automation, 'in.gain', t, 0) : 0;
    assert.ok(out + inc >= 0.99, `silence at ${t.toFixed(3)} (out ${out.toFixed(3)}, in ${inc.toFixed(3)}), the one at ${h.at.toFixed(3)}`);
  }
  assert.equal(valueAt(h.automation, 'out.gain', h.at + INTERVAL.cutSec + 0.001, 1), 0, 'the outgoing music is cut on the one');
  assert.ok(valueAt(h.automation, 'echo.send', h.at - 0.001, 0) > 0.99, 'its last beat goes into the echo');
  assert.equal(valueAt(h.automation, 'echo.send', h.at + INTERVAL.cutSec + 0.001, 1), 0, 'and nothing after it');
}

/** The incoming track's anchor sounds exactly on the one. */
function assertOnTheOne(h: Handover) {
  assert.ok(Math.abs(h.incoming.startAt + (h.incoming.anchorSec - h.incoming.offsetSec) - h.at) < 1e-9);
  assert.ok(h.incoming.offsetSec >= 0);
}

// ---------------------------------------------------------------------------------------------- the order
test('the order: every track once per cycle, no repeat across cycles, the same for the same Game', () => {
  for (const count of [1, 2, 5, 17]) {
    const seed = gameSeed(`g-2026-11-24-${count}`);
    const played = Array.from({ length: count * 4 }, (_, cursor) => trackAt(count, seed, cursor));
    for (let cycle = 0; cycle < 4; cycle++) {
      assert.deepEqual([...played.slice(cycle * count, (cycle + 1) * count)].sort((a, b) => a - b), [...Array(count).keys()], `count ${count}, cycle ${cycle}`);
    }
    if (count > 1) for (let i = 1; i < played.length; i++) assert.notEqual(played[i], played[i - 1], `count ${count}: a repeat at ${i}`);
    assert.deepEqual(orderCycle(count, seed, 2), played.slice(2 * count, 3 * count));
  }
  const a = Array.from({ length: 17 }, (_, i) => trackAt(17, gameSeed('g-a'), i));
  const b = Array.from({ length: 17 }, (_, i) => trackAt(17, gameSeed('g-b'), i));
  assert.notDeepEqual(a, b, 'another Game, another order');
  assert.equal(gameSeed('g-a'), gameSeed('g-a'));
  assert.throws(() => trackAt(0, 1, 0));
});

// ---------------------------------------------------------------------------------------------- grids
test('a looping buffer keeps its downbeats across the wrap; tempos match after folding', () => {
  // 4 bars of 2 s between 10 s and 18 s of the buffer, started at t = 100.
  const grid = loopGrid({ startAt: 100, offsetSec: 0, loopStartSec: 10, loopEndSec: 18, bars: 4, beatsPerBar: 4 });
  assert.ok(grid);
  assert.equal(grid.beatSec, 0.5);
  assert.ok(Math.abs((grid.downbeatAfter(100) ?? 0) - 100) < EPS, 'the intro is on the same bars');
  assert.ok(Math.abs((grid.downbeatAfter(100.1) ?? 0) - 102) < EPS);
  assert.ok(Math.abs((grid.downbeatAfter(117.5) ?? 0) - 118) < EPS, 'the loop end is the loop start, a downbeat');
  assert.ok(Math.abs((grid.downbeatAfter(118.5) ?? 0) - 120) < EPS, 'after the wrap (position 10.5): the next bar at 12');
  assert.ok(Math.abs((grid.downbeatAfter(100 + 8 * 18 + 1) ?? 0) - (100 + 8 * 18 + 2)) < EPS, 'many wraps later');
  // A hook loop that starts at its pickup (the Winning song's): offset 41.6, loop 42–58, 8 bars.
  const hook = loopGrid({ startAt: 5, offsetSec: 41.6, loopStartSec: 42, loopEndSec: 58, bars: 8, beatsPerBar: 4 });
  assert.ok(hook && Math.abs((hook.downbeatAfter(5) ?? 0) - 5.4) < EPS);
  assert.equal(loopGrid({ startAt: 0, offsetSec: 0, loopStartSec: 1, loopEndSec: 1, bars: 4, beatsPerBar: 4 }), null);

  const t = track('a', 120);
  const g = trackGrid(t, 50, 0.5);
  assert.ok(Math.abs((g.downbeatAfter(50.1) ?? 0) - 52) < EPS, 'a track from its first downbeat: bars every 2 s');
  assert.equal(g.downbeatAfter(50 + 200), null, 'none after its sound ends');

  assert.ok(temposMatch(120, 121));
  assert.ok(temposMatch(140, 71), 'double time folds');
  assert.ok(!temposMatch(120, 100));
  assert.ok(!temposMatch(0, 100));
});

// ---------------------------------------------------------------------------------------------- the natural handover
test('a track hands over on a downbeat 8–12 s before its sound ends, preferring a phrase start, never into a long fade', () => {
  const t = track('a', 120, { first: 0.5, endSec: 180, fadeStartSec: 179 });
  const x = naturalHandoverSec(t);
  assert.ok(t.downbeats.includes(x), 'on a downbeat');
  assert.ok(x >= 180 - 12 && x <= 180 - 8, `in the window: ${x}`);
  assert.equal((t.downbeats.indexOf(x) - t.downbeats.indexOf(0.5)) % INTERVAL.phraseBars, 0, 'on a phrase');
  // A long fade: no later than a second into it.
  const fading = track('b', 90, { first: 1, endSec: 200, fadeStartSec: 170 });
  const y = naturalHandoverSec(fading);
  assert.ok(fading.downbeats.includes(y) && y <= 171 + EPS && y >= 167 - EPS, `before the fade: ${y}`);
  // No grid: the latest moment.
  assert.equal(naturalHandoverSec({ ...t, downbeats: [], edges: { ...t.edges, firstDownbeatSec: null } }), 172);
  // A short track still plays its minimum, and hands over on its first downbeat after it.
  const short = track('c', 100, { endSec: 26, fadeStartSec: 25 });
  const z = naturalHandoverSec(short);
  assert.ok(short.downbeats.includes(z) && z >= short.edges.startSec + INTERVAL.minPlaySec && z <= 25, `short: ${z}`);
});

test('the real sets (data/interval/<set>, when analysed): every natural handover is on a downbeat in its window', (t) => {
  const sets = ['breaks', 'pausa'].map((set) => path.join(OUT, 'interval', set)).filter((dir) => fs.existsSync(path.join(dir, 'index.json')));
  if (!sets.length) return t.skip('no data/interval/<set> (run npm run prep -- --steps interval)');
  for (const dir of sets) checkSet(dir);
});

function checkSet(dir: string) {
  const slugs = intervalSlugs(JSON.parse(fs.readFileSync(path.join(dir, 'index.json'), 'utf8')));
  assert.ok(slugs.length > 0);
  const tracks = slugs.map((slug) => checkIntervalTrack(JSON.parse(fs.readFileSync(path.join(dir, `${slug}.json`), 'utf8')), 48000));
  assert.equal(new Set(tracks.map((x) => `${x.title}|${x.artist}`.toLowerCase())).size, tracks.length, 'a recording once');
  for (const tr of tracks) {
    const x = naturalHandoverSec(tr);
    const latest = Math.min(tr.edges.endSec - INTERVAL.minBeforeEndSec, tr.edges.fadeStartSec + INTERVAL.intoFadeSec);
    assert.ok(tr.downbeats.includes(x), `${tr.slug}: ${x} is a downbeat`);
    assert.ok(x <= latest + EPS && x >= latest - INTERVAL.windowSec - EPS, `${tr.slug}: ${x} in [${latest - INTERVAL.windowSec}, ${latest}]`);
  }
  // Every pair hands over without a gap, both styles.
  for (const [i, a] of tracks.entries()) {
    const b = tracks[(i + 1) % tracks.length];
    for (const style of ['swell', 'filter'] as const) {
      const now = 1000;
      const at = now + 9;
      const h = planHandover({ kind: 'natural', now, at, out: trackGrid(a, at - naturalHandoverSec(a), 0), incoming: b, style });
      assertOnTheOne(h);
      assertSound(h, now);
      assert.ok(b.downbeats.includes(h.incoming.anchorSec) || h.incoming.anchorSec === b.edges.firstDownbeatSec, `${b.slug}: anchored on a downbeat`);
    }
  }
}

// ---------------------------------------------------------------------------------------------- handovers
test('tempos matched: the next track rises under the outgoing one for two of its bars, its downbeat on the one', () => {
  const b = track('b', 121, { first: 0.5, startSec: 0.3 });
  const now = 500;
  const at = 509; // a downbeat of A on the audio clock
  for (const style of ['swell', 'filter'] as const) {
    const h = planHandover({ kind: 'natural', now, at, out: { downbeatAfter: () => at, beatSec: 0.5, beatsPerBar: 4 }, incoming: b, style });
    assert.equal(h.matched, true);
    assert.equal(h.style, style);
    assert.equal(h.at, at);
    assertOnTheOne(h);
    assertSound(h, now);
    assert.ok(Math.abs(h.at - h.incoming.startAt - 2 * 2) < EPS, 'two of the outgoing bars');
    assert.ok(b.downbeats.includes(h.incoming.anchorSec), 'a downbeat of the next track on the one');
    assert.ok(h.incoming.offsetSec >= b.edges.startSec - 0.02, 'from where its sound starts');
    assert.deepEqual(h.echo && [h.echo.delaySec, h.echo.sendFrom], [0.5, at - 0.5], 'the last beat into a one-beat echo');
    if (style === 'swell') {
      assert.ok(Math.abs(valueAt(h.automation, 'in.gain', h.incoming.startAt, 0) - 10 ** (INTERVAL.swellFromDb / 20)) < 1e-9);
      assert.equal(valueAt(h.automation, 'in.hpf', at, 20), 20, 'the bass enters on the one');
    } else {
      assert.equal(valueAt(h.automation, 'in.lpf', h.incoming.startAt, 0), INTERVAL.filterFromHz);
      assert.equal(valueAt(h.automation, 'in.lpf', at, 0), INTERVAL.filterOpenHz, 'fully open on the one');
    }
    assert.equal(valueAt(h.automation, 'out.hpf', at, 20), INTERVAL.outHpfHz, 'the outgoing track thins out');
    assert.equal(valueAt(h.automation, 'echo.return', at + INTERVAL.echoTailSec, 1), 0, 'the echo fades');
    assert.ok(h.releaseAt > at + INTERVAL.echoTailSec);
  }
  // Slow beats echo on half beats.
  const slow = planHandover({ kind: 'natural', now, at, out: { downbeatAfter: () => at, beatSec: 1.2, beatsPerBar: 4 }, incoming: track('c', 50.5), style: 'swell' });
  assert.equal(slow.echo?.delaySec, 0.6);
});

test('tempos apart: only the pickup before the one, and a filter that keeps opening for two of its bars after it', () => {
  const b = track('b', 85, { first: 1.2, startSec: 0.1 });
  const now = 100;
  const at = 110;
  const h = planHandover({ kind: 'natural', now, at, out: { downbeatAfter: () => at, beatSec: 0.5, beatsPerBar: 4 }, incoming: b, style: 'swell' });
  assert.equal(h.matched, false);
  assert.equal(h.style, 'filter', 'tempos apart always open a filter');
  assert.equal(h.incoming.anchorSec, 1.2, 'its first downbeat on the one');
  assertOnTheOne(h);
  assert.ok(Math.abs(h.at - h.incoming.startAt - 60 / 85) < 1e-9, 'one of its beats of pickup');
  assertSound(h, now);
  const bar = (60 / 85) * 4;
  assert.ok(valueAt(h.automation, 'in.lpf', at, 0) < 2000, 'still opening on the one');
  assert.equal(valueAt(h.automation, 'in.lpf', at + 2 * bar, 0), INTERVAL.filterOpenHz);
  // No pickup at all (its sound starts on its first downbeat): it drops on the one.
  const drop = planHandover({ kind: 'natural', now, at, out: { downbeatAfter: () => at, beatSec: 0.5, beatsPerBar: 4 }, incoming: track('d', 85, { first: 0.1, startSec: 0.1 }), style: 'filter' });
  assert.equal(drop.incoming.startAt, at);
  assertSound(drop, now);
});

test('a skip hands over on the playing track’s next downbeat; a start takes over from a bed on its downbeat, or fades in from silence', () => {
  const a = track('a', 120);
  const b = track('b', 120.5);
  const grid = trackGrid(a, 0, 0.5); // A's downbeats at 0, 2, 4… on the audio clock
  for (const now of [60.1, 61.3, 61.5, 61.9]) {
    const h = planHandover({ kind: 'skip', now, out: grid, incoming: b, style: 'swell' });
    assert.equal(h.at, grid.downbeatAfter(now + INTERVAL.skipLeadSec), `now ${now}: the next downbeat at least ${INTERVAL.skipLeadSec} s ahead`);
    assert.ok(h.at - now <= 2 + INTERVAL.skipLeadSec + EPS, 'never more than a bar away');
    assert.ok(h.incoming.startAt >= now + 0.05 - EPS);
    assertOnTheOne(h);
    assertSound(h, now);
  }
  // From the victory track (a looping bed, 4 bars of 1.24 s): its downbeat, after room for the overlap.
  const bed = loopGrid({ startAt: 3, offsetSec: 0, loopStartSec: 0.4, loopEndSec: 0.4 + 4 * 1.24, bars: 4, beatsPerBar: 4 });
  assert.ok(bed);
  const now = 64.2;
  const start = planHandover({ kind: 'start', now, out: bed, incoming: track('c', 96.8), style: 'filter' });
  assert.ok(Math.abs(start.at - (bed.downbeatAfter(start.at - 1e-6) ?? NaN)) < 1e-9, 'on one of its downbeats');
  assert.ok(start.at >= now + INTERVAL.overlapSec.min, 'room for the whole overlap');
  assertOnTheOne(start);
  assertSound(start, now);
  // A bed without a grid: soon, with the fallback beat's echo.
  const gridless = planHandover({ kind: 'start', now, out: { downbeatAfter: () => null, beatSec: null, beatsPerBar: 4 }, incoming: b, style: 'swell' });
  assert.equal(gridless.echo?.delaySec, INTERVAL.fallbackBeatSec);
  assert.equal(gridless.style, 'filter');
  assertSound(gridless, now);
  // From silence: the first track fades in from where its sound starts.
  const silence = planHandover({ kind: 'start', now, out: null, incoming: b, style: 'swell' });
  assert.equal(silence.echo, null);
  assert.equal(silence.incoming.offsetSec, b.edges.startSec);
  assert.equal(valueAt(silence.automation, 'in.gain', silence.at, 1), 0);
  assert.equal(valueAt(silence.automation, 'in.gain', silence.at + INTERVAL.fadeInSec, 0), 1);
  assertSound(silence, now, { fromSilence: true });
});

test('handovers fuzz: random tracks, tempos, styles and moments always land on the one without a gap', () => {
  let seed = 7;
  const rnd = () => ((seed = (seed * 48271) % 2147483647) / 2147483647);
  for (let n = 0; n < 400; n++) {
    const a = track('a', 60 + rnd() * 100, { first: rnd() * 2 });
    const b = track('b', 60 + rnd() * 100, { first: 0.1 + rnd() * 6, startSec: rnd() * 0.5 });
    const kind = (['natural', 'skip', 'start'] as const)[n % 3];
    const startAt = rnd() * 50;
    const grid = trackGrid(a, startAt, 0);
    const now = startAt + 20 + rnd() * 100;
    const req: HandoverRequest = { kind, now, out: grid, incoming: b, style: rnd() < 0.5 ? 'swell' : 'filter' };
    if (kind === 'natural') req.at = grid.downbeatAfter(now + rnd() * 12) ?? undefined;
    const h = planHandover(req);
    assertOnTheOne(h);
    assertSound(h, now);
    assert.ok(h.incoming.startAt >= now + 0.05 - EPS, `${kind}: the next track starts in the future`);
  }
});

// ---------------------------------------------------------------------------------------------- the contract
test('the track contract: a written track passes, a broken one names its problems', () => {
  const good = {
    schemaVersion: 1, slug: 'cupcake-carpe', title: 'cupcake.', artist: 'Carpe', position: 17, sampleRate: 48000, durationSec: 107.4,
    tempo: { bpm: 74.2, beatsPerBar: 4 }, beats: [0.4, 1.2], downbeats: [0.4], edges: { startSec: 0, endSec: 107.4, fadeStartSec: 106, firstDownbeatSec: 0.4 },
    loudness: { gainToTargetDb: -1.1 }, flags: [],
  };
  assert.deepEqual(intervalTrackProblems(good, 48000), []);
  assert.equal(checkIntervalTrack(good).gainToTargetDb, -1.1);
  assert.deepEqual(intervalTrackProblems({ ...good, slug: '../x', beats: [2, 1], sampleRate: 44100 }, 48000), ['slug', 'sampleRate 44100', 'beats']);
  assert.throws(() => checkIntervalTrack({ ...good, edges: { startSec: 5, endSec: 1, fadeStartSec: 0 } }), /edges/);
  assert.deepEqual(intervalSlugs({ tracks: [{ slug: 'a' }, { slug: 'A b' }, { slug: 'a' }, { slug: 'b-2' }] }), ['a', 'b-2']);
  assert.throws(() => intervalSlugs({}));
});

// ---------------------------------------------------------------------------------------------- the show
const skipRejected = (h: Harness) => rejected(h.send('intervalSkip'));

test('the show: each moment\'s music (D129), the intro track, the breaks\' and the end\'s sets, their track in the state, the skip only while a set plays', () => {
  const h = setup({ seed: 4, settings: { autoAdvance: false } });
  h.send('unlock');
  assert.equal(h.show.snapshot().intervalMusic, null);
  assert.deepEqual(skipRejected(h), ['wrongScene'], 'no set before the Game');

  // A round's intro plays its intro track, low as if in Parlem, not a set.
  const intro = h.send('roundIntro');
  assert.equal(find(intro, 'introMusic')?.levelDb, INTRO.levelDb);
  assert.ok(!find(intro, 'intervalMusic'));
  assert.equal(h.show.snapshot().intervalMusic, null);
  assert.deepEqual(skipRejected(h), ['wrongScene']);

  // The Shuffle runs over it; once it has run (scene play) it still plays until the first Spin, which builds out of it.
  const shuffle = h.send('newRound');
  assert.ok(!find(shuffle, 'stopAll') && !find(shuffle, 'introMusic'), 'the intro track goes on under the Shuffle');
  h.advance(9);
  assert.equal(h.show.scene, 'play');
  assert.equal(h.show.bed, 'intro');
  const spin = h.send('next');
  assert.ok(find(spin, 'startTransition')?.fromHoldMusic, 'the first Spin builds out of it');
  assert.equal(h.show.bed, null);

  // The end of the Game: the end's set (D129, D137), which the skip and the reports follow.
  h.until(() => h.show.status === 'playing');
  const end = h.send('endGame');
  const music = find(end, 'intervalMusic');
  assert.deepEqual([music?.set, music?.levelDb], ['end', INTERVAL.volumeDb]);
  assert.deepEqual(h.show.snapshot().intervalMusic, { set: 'end', track: null }, 'loading: the music before it goes on');
  const skip = h.send('intervalSkip');
  assert.deepEqual(rejected(skip), []);
  assert.deepEqual(find(skip, 'intervalSkip'), { type: 'intervalSkip', set: 'end' });
  assert.ok(!skip.some((e) => e.type === 'emit'), 'nothing changes until the next track takes over');
  const at = h.clock.t + 0.4;
  const reported = h.show.intervalTrack({ title: 'cupcake.', artist: 'Carpe', index: 3, count: 17 }, at, 'end');
  assert.deepEqual(h.show.snapshot().intervalMusic, { set: 'end', track: { title: 'cupcake.', artist: 'Carpe', index: 3, count: 17, sinceMs: Math.round(h.env.toEpochMs(at)) } });
  assert.ok(reported.some((e) => e.type === 'emit' && e.message.type === 'state'));
  h.show.intervalTrack({ title: 'stale', artist: '', index: 1, count: 9 }, at, 'breaks');
  assert.equal(h.show.snapshot().intervalMusic?.track?.title, 'cupcake.', 'another set\'s report is ignored');

  // A new round from the round in play stops everything; its intro track comes in under that Shuffle.
  h.send('roundIntro');
  h.send('newRound');
  h.until(() => h.show.scene === 'play');
  h.send('next');
  h.until(() => h.show.status === 'playing');
  const again = h.send('newRound');
  assert.ok(find(again, 'stopAll') && find(again, 'introMusic'));
  assert.equal(h.show.scene, 'roundStart');
  assert.equal(h.show.snapshot().intervalMusic, null);
  assert.deepEqual(skipRejected(h), ['wrongScene']);
  assert.deepEqual(replayJournal(journalOf(h.log)), h.show.record());
});

test('the volumes (D139): live, every slider in the state, journaled once still; the plan\'s only for a Game that set none', () => {
  const h = setup({ seed: 4, settings: { autoAdvance: false } });
  h.send('unlock');
  assert.deepEqual(h.show.snapshot().game.volumes, VOLUME_DEFAULTS);
  assert.equal(h.show.journalSettings().volumes, undefined, 'absent from the journal until set');
  const volume = h.send('setVolume', { key: 'breaks', percent: 40 });
  assert.deepEqual(find(volume, 'volumes')?.volumes, { ...VOLUME_DEFAULTS, breaks: 40 });
  assert.equal(h.show.snapshot().game.volumes?.breaks, 40);
  assert.equal(journalOf(volume).length, 0, 'not on every move');
  h.advance(0.3);
  h.send('setVolume', { key: 'breaks', percent: 35 });
  const still = h.advance(FLOW.volumesJournalSec + 0.1);
  const entries = journalOf(still).filter((e) => e.kind === 'settings.changed');
  assert.equal(entries.length, 1, 'one entry for the drag');
  assert.ok(entries[0].kind === 'settings.changed' && entries[0].settings.volumes?.breaks === 35);
  assert.deepEqual(rejected(h.send('setVolume', { key: 'doors', percent: 150 })), [], 'every slider goes to 150% (D157)');
  assert.deepEqual(rejected(h.send('setVolume', { key: 'doors', percent: 151 })), ['invalid']);
  assert.equal(VOLUME_DEFAULTS.throws, 141, 'the chaotic moments start +6 dB (D158)');
  assert.ok(Math.abs(volumeDb(141) - 6) < 0.05 && Math.abs(volumeDb(150) - 7.04) < 0.05);
  assert.deepEqual(rejected(h.dispatch({ v: 1, type: 'cmd', cmd: 'setVolume', reqId: 'r', key: 'loud', percent: 50 })), ['invalid']);
  // A plan's volumes now are ignored: this Game set its own.
  const plan = checkGamePlan({ v: 3, edition: '26', title: 'Q', prizeReveal: 'perRound', sponsors: [], rounds: [{ number: 1, kind: 'normal', line: [], bingo: [] }], schedule: { startAtMs: null, roundMinutes: 25, intervalMinutes: 3 }, volumes: { breaks: 90 }, cheatSheet: { claimRules: [], specialRoundRules: [] } });
  assert.ok(plan.ok);
  h.show.setPlan(plan.plan);
  assert.equal(h.show.volumes.breaks, 35);
  // A fresh Game takes them, once, and journals them; the journal brings them back after a restart.
  const f = setup({ seed: 5 });
  const applied = f.show.setPlan(plan.plan);
  assert.equal(f.show.volumes.breaks, 90);
  assert.ok(applied.some((e) => e.type === 'volumes'));
  assert.ok(journalOf(applied).some((e) => e.kind === 'settings.changed' && e.settings.volumes?.breaks === 90));
  const record = replayJournal(journalOf([...f.log, ...applied]));
  const r = setup({ seed: 6, restore: record });
  assert.equal(r.show.volumes.breaks, 90);
  assert.equal(r.show.volumesSet, true);
  // Songs in Parlem: the Parlem duck itself, live.
  h.send('roundIntro');
  h.send('newRound');
  h.advance(9);
  h.send('next');
  h.until(() => h.show.status === 'playing');
  assert.equal(find(h.send('hold'), 'duck')?.db, volumeDb(VOLUME_DEFAULTS.songsParlem));
  assert.deepEqual(find(h.send('setVolume', { key: 'songsParlem', percent: 20 }), 'duck')?.db, volumeDb(20));
  assert.ok(Math.abs(volumeDb(VOLUME_DEFAULTS.songsParlem) - -14) < 0.2, 'the default is the tuned Parlem duck (−14 dB)');
});

test('the scene rules: the skip whenever a set plays, and the console’s fallback without the flag', () => {
  const ctx = (scene: SceneContext['scene'], extra: Partial<SceneContext> = {}): SceneContext => ({ scene, celebrating: null, introduced: false, paused: false, ...extra });
  for (const scene of ['interval', 'after'] as const) assert.ok(sceneAllows('intervalSkip', ctx(scene)), scene);
  for (const scene of ['before', 'roundStart', 'play', 'check', 'celebration'] as const) assert.ok(!sceneAllows('intervalSkip', ctx(scene)), scene);
  assert.ok(sceneAllows('intervalSkip', ctx('play', { intervalMusic: true })));
  assert.ok(!sceneAllows('intervalSkip', ctx('interval', { intervalMusic: false })));
  assert.ok(sceneAllows('intervalSkip', ctx('check', { paused: true })), 'during Pausa: the Pausa set');
});

test('Hold music off: a Hold keeps the song ducked; switched back on, Hold music takes over; silence is still covered', () => {
  const h = setup({ seed: 6, settings: { autoAdvance: false, holdMusicOn: false } });
  h.send('unlock');
  assert.equal(h.show.snapshot().game.holdMusicOn, false);
  h.send('next');
  h.until(() => h.show.status === 'playing');
  h.send('hold');
  assert.equal(h.show.timers.holdMusicAt, null, 'no timed switch');
  const long = h.advance(h.show.game.holdMusicAfterSec + 2);
  assert.ok(!find(long, 'songToHoldMusic') && h.show.current, 'the song stays, ducked');
  const on = h.send('setGame', { holdMusicOn: true });
  assert.ok(h.show.timers.holdMusicAt != null && h.show.timers.holdMusicAt >= h.clock.t, 'the switch comes back');
  assert.equal(journalOf(on).at(-1)?.kind, 'settings.changed');
  const later = h.advance(1.1);
  assert.ok(find(later, 'songToHoldMusic'), 'already past holdMusicAfterSec: at once');
  // Off again while the song still plays: Back still brings Hold music (never silence).
  h.send('hold', { on: false });
  h.send('next');
  h.until(() => h.show.status === 'playing');
  h.send('setGame', { holdMusicOn: false });
  const back = h.send('back');
  assert.equal(find(back, 'holdMusic')?.mood, 'error', 'Back still covers with Hold music');
  assert.ok(h.show.holdMusic);
  // A fresh Game and an older journal without the newer settings: the defaults.
  const fresh = setup({ seed: 6 });
  assert.equal(fresh.show.game.holdMusicOn, true);
  assert.deepEqual(fresh.show.snapshot().game.volumes, VOLUME_DEFAULTS);
  const record = replayJournal(journalOf(fresh.log));
  const { holdMusicOn: _on, ...older } = record.settings ?? fresh.show.journalSettings();
  const resumed = setup({ seed: 6, restore: { ...record, settings: older } });
  assert.equal(resumed.show.game.holdMusicOn, true);
  assert.deepEqual(resumed.show.snapshot().game.volumes, VOLUME_DEFAULTS);
});

test("D228: in a break the presenters pick the breaks' set or Pausa's; each break starts on the breaks'; Pausa leaves Pausa's set playing", () => {
  const h = setup({ seed: 4, settings: { autoAdvance: false } });
  h.send('unlock');
  assert.deepEqual(rejected(h.send('intervalSet', { set: 'pausa' })), ['wrongScene'], 'only in a break');
  // A break (as after a Bingo's Celebration).
  h.show.startInterval();
  assert.equal(find(h.advance(0.05), 'intervalMusic')?.set, 'breaks');
  assert.equal(h.show.scene, 'interval');
  const pick = h.send('intervalSet', { set: 'pausa' });
  assert.deepEqual([find(pick, 'intervalMusic')?.set, h.show.snapshot().intervalMusic?.set], ['pausa', 'pausa']);
  assert.equal(find(h.send('intervalSet', { set: 'pausa' }), 'intervalMusic'), undefined, 'already playing it');
  assert.deepEqual(rejected(h.dispatch({ v: 1, type: 'cmd', cmd: 'intervalSet', reqId: 'r', set: 'end' })), ['invalid'], 'not a break set');
  // Pausa over it: Pausa's music is already playing, so ending Pausa doesn't stop it.
  h.send('pause', { on: true });
  const resume = h.send('pause', { on: false });
  assert.equal(resume.find((e) => e.type === 'pausaMusic' && !e.on), undefined);
  assert.equal(h.show.snapshot().intervalMusic?.set, 'pausa');
  assert.equal(find(h.send('intervalSet', { set: 'breaks' }), 'intervalMusic')?.set, 'breaks');
  // The next break starts on the breaks' set again.
  h.send('intervalSet', { set: 'pausa' });
  h.show.startInterval();
  assert.equal(find(h.advance(0.05), 'intervalMusic')?.set, 'breaks');
});

test('D237: each automatic sound on or off; the runtime mutes its node; journaled and restored; the old switches still work for one deploy', () => {
  const h = setup({ seed: 4 });
  h.send('unlock');
  assert.deepEqual(h.show.snapshot().game.autoSounds, AUTO_SOUNDS_DEFAULT);
  const off = h.send('setAutoSound', { key: 'drumTicks', on: false });
  const effect = find(off, 'volumes');
  assert.equal(effect?.autoSounds.drumTicks, false, 'the runtime gets it with the sliders');
  const entry = journalOf(off).find((e) => e.kind === 'settings.changed');
  assert.equal(entry?.kind === 'settings.changed' && entry.settings.autoSounds?.drumTicks, false, 'journaled');
  assert.deepEqual(rejected(h.dispatch({ v: 1, type: 'cmd', cmd: 'setAutoSound', reqId: 'r', key: 'shuffle', on: false })), ['invalid']);
  // The mirrors, both ways.
  h.send('setAutoSound', { key: 'voices', on: false });
  assert.equal(h.show.snapshot().game.voicesOn, false);
  h.send('setGame', { finalLapStinger: false });
  assert.deepEqual([h.show.snapshot().game.autoSounds?.finalLap, h.show.snapshot().game.finalLapStinger], [false, false]);
  // A restarted page takes them from the journal; a journal from before them reads the old fields.
  const r = setup({ seed: 5, restore: h.show.record() });
  assert.deepEqual(r.show.snapshot().game.autoSounds, { ...AUTO_SOUNDS_DEFAULT, drumTicks: false, voices: false, finalLap: false });
  assert.deepEqual(autoSoundsOf({ finalLapStinger: false }), { ...AUTO_SOUNDS_DEFAULT, finalLap: false });
});

test('D229: the sound test plays one kind at a time before the Game, stops on null, a scene change or Panic, and refuses while music plays', () => {
  const h = setup({ seed: 4 });
  h.send('unlock');
  const on = h.send('soundTest', { kind: 'songs' });
  const effect = find(on, 'soundTest');
  assert.equal(effect?.kind, 'songs');
  assert.ok(effect && effect.songIds.length > 0, 'songs whose snippets stand in');
  assert.equal(h.show.snapshot().soundTest?.kind, 'songs');
  assert.equal(find(h.send('soundTest', { kind: 'songs' }), 'soundTest'), undefined, 'already playing it');
  assert.equal(find(h.send('soundTest', { kind: 'breaks' }), 'soundTest')?.kind, 'breaks', 'the next kind');
  assert.equal(find(h.send('soundTest', { kind: null }), 'soundTest')?.kind, null);
  assert.equal(h.show.snapshot().soundTest, null);
  assert.deepEqual(rejected(h.dispatch({ v: 1, type: 'cmd', cmd: 'soundTest', reqId: 'r', kind: 'master' })), ['invalid'], 'no sound of its own');
  h.send('soundTest', { kind: 'win' });
  assert.equal(find(h.send('panic'), 'soundTest')?.kind, null, 'Panic ends it');
  // A round's intro (a scene change) ends it; once the Game has a round, it's refused.
  h.send('soundTest', { kind: 'ticks' });
  assert.equal(find(h.send('roundIntro'), 'soundTest')?.kind, null);
  assert.deepEqual(rejected(h.send('soundTest', { kind: 'ticks' })), ['wrongScene']);
});
