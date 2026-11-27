// The show state machine, driven with a fake clock and seeded randomness over the real analysis data.
import { dataTest as test } from './support/data.ts';
import assert from 'node:assert/strict';
import { Show } from '../engine/src/show/show.ts';
import { planTransition, type PlanRequest, type SignatureSource } from '../engine/src/plan/planner.ts';
import type { Effect, EffectOf, EffectType } from '../engine/src/show/show.ts';
import { VOLUME_DEFAULTS, firstPlaySec, makeCommand, volumeDb } from '@quina/protocol';
import type { Command, EventOf, GameSettings, PhaseName, ShowEvent, ShowEventType, SoundName } from '@quina/protocol';
import { HOLD, ENGINE, FLOW, PACE, LOOP } from '../engine/src/config.ts';
import { LOOKAHEAD_SEC } from '../engine/src/plan/planner.ts';
import { deckTimeline } from '../engine/src/plan/timeline.ts';
import { seededRandom } from '../engine/src/rng.ts';
import { describePlan } from '../engine/src/game/phase.ts';

import { setup, analyses, songs, allCards, type Harness } from './support/harness.ts';

const types = (effects: readonly Effect[]) => effects.map((e) => e.type);
const find = <T extends EffectType>(effects: readonly Effect[], type: T) => effects.find((e): e is EffectOf<T> => e.type === type);
/** `find`, for an effect the test cannot go on without. */
function get<T extends EffectType>(effects: readonly Effect[], type: T): EffectOf<T> {
  const effect = find(effects, type);
  assert.ok(effect, `no ${type} in ${JSON.stringify(types(effects))}`);
  return effect;
}
const rejected = (effects: readonly Effect[]) => effects.filter((e) => e.type === 'reject').map((e) => e.reason);
const isEventOf = <T extends ShowEventType>(event: ShowEvent, type: T): event is EventOf<T> => event.type === type;
/** The emitted events of one type. */
const emitted = <T extends ShowEventType>(effects: readonly Effect[], type: T) =>
  effects.flatMap((e) => (e.type === 'emit' && isEventOf(e.message, type) ? [e.message] : []));
/** The landing time of the last song that landed. */
function lastLandedAt(effects: readonly Effect[]): number {
  const T = effects.filter((e) => e.type === 'landed').map((e) => e.plan.T).at(-1);
  assert.ok(T != null, 'nothing landed');
  return T;
}
/** When the automatic Next will press, which the test expects to be scheduled. */
function autoAt(show: Show): number {
  const at = show.timers.autoAt;
  assert.ok(at != null, 'no automatic Next scheduled');
  return at;
}

/**
 * Where the scheduled automatic Next aims to land, after the last landing at `landedAt`, and how that
 * moment sits in the playing song's phrases (counted from the hook it landed on).
 */
function autoLanding(show: Show, landedAt: number): { offset: number; phrase: string } {
  const cur = show.current;
  assert.ok(cur, 'a song is playing');
  const analysis = analyses.get(cur.songId);
  assert.ok(analysis);
  const landAt = autoAt(show) + LOOKAHEAD_SEC + Math.min(show.spin().dTarget, PACE.alignedSpinMaxSec);
  const tl = deckTimeline(analysis, cur, cur.landedDownbeatIndex);
  const downbeat = tl.downbeatsBetween(landAt - 1e-6, landAt + 1e-6)[0];
  return { offset: landAt - landedAt, phrase: downbeat ? tl.phraseClass(downbeat.index) : 'off the grid' };
}

function startAndLand(h: Harness) {
  h.send('unlock');
  const out = h.send('next');
  const start = find(out, 'startTransition');
  assert.ok(start, `no transition: ${JSON.stringify(rejected(out))}`);
  h.until(() => h.show.status === 'playing');
  return start;
}

test('locked until unlocked; invalid commands are rejected, never thrown', () => {
  const h = setup();
  assert.deepEqual(rejected(h.send('next')), ['locked']);
  h.send('unlock');
  assert.equal(h.show.status, 'idle');
  assert.deepEqual(rejected(h.show.command({ type: 'cmd', cmd: 'next', reqId: 'x' })), ['invalid']); // no version
  assert.deepEqual(rejected(h.show.command({ ...makeCommand('setPace'), pace: 'fast' })), ['invalid']);
  assert.deepEqual(rejected(h.show.command({ ...makeCommand('next'), cmd: 'dance' })), ['invalid']);
  assert.deepEqual(rejected(h.show.command(null)), ['invalid']);
  // The protocol only accepts known sound names, so a made-up one never reaches the engine.
  assert.deepEqual(rejected(h.dispatch({ ...makeCommand('sfx', { name: 'boom' }), name: '../../etc/passwd' })), ['invalid']);
});

test('Next lands the first song of the Queue; a second Next during the Spin is ignored', () => {
  const h = setup();
  h.send('unlock');
  const out = h.send('next');
  const start = get(out, 'startTransition');
  assert.equal(start.drum.removeId, null);
  assert.equal(start.drum.targetId, h.show.queue[0]);
  assert.equal(h.show.status, 'transition');
  assert.deepEqual(rejected(h.send('next')), ['busy']);
  const landed = h.until(() => h.show.status === 'playing');
  assert.ok(find(landed, 'landed'));
  assert.equal(h.show.position, 0);
  assert.equal(h.show.current?.songId, h.show.queue[0]);
  assert.ok(autoAt(h.show) > h.clock.t);
});

test('a storm of Nexts (double taps, the Wii and the tablet together) lands one song per Spin, each heard for seconds', () => {
  // In 2025 three songs landed within 10 ms and two 0.3 s apart, counted unheard. Here every landing needs its
  // own Spin, and a Next during one is refused `busy`.
  const h = setup({ seed: 5, settings: { autoAdvance: false } });
  h.send('unlock');
  const landings: { at: number; position: number }[] = [];
  let busy = 0;
  for (let step = 0; step < 120 / 0.05; step++) {
    for (let press = 0; press < 2; press++) busy += h.send('next').filter((e) => e.type === 'reject' && e.reason === 'busy').length;
    for (const e of h.advance(0.05)) if (e.type === 'landed') landings.push({ at: h.clock.t, position: h.show.position });
  }
  assert.ok(landings.length >= 8, `${landings.length} landings in 2 minutes`);
  assert.ok(busy > 1000, 'the extra presses were refused');
  for (let i = 1; i < landings.length; i++) {
    assert.equal(landings[i].position, landings[i - 1].position + 1, 'no song skipped');
    assert.ok(landings[i].at - landings[i - 1].at >= 4, `landings ${i - 1} and ${i} only ${(landings[i].at - landings[i - 1].at).toFixed(2)} s apart`);
  }
});

test("auto-advance lands on the phrases near each song's own slot: a first play 22 s, a repeat the Pace, 14 s (D174, D175)", () => {
  // The same Queue every round: round 2 starts with round 1's seven songs, then new ones.
  const h = setup({ seed: 8, fixedQueue: songs.map((s) => s.id) });
  h.send('unlock');
  assert.equal(h.show.game.pace, PACE.defaultSec);
  const roundGaps = (from: number, to: number) => {
    h.send('next');
    for (let k = 1; k <= to; k++) h.until(() => h.show.position === k && h.show.status === 'playing', 80);
    const plans = h.log.flatMap((e) => (e.type === 'landed' ? [e.plan] : [])).slice(from);
    for (const p of plans.slice(1)) assert.notEqual(p.phraseClass, 'bar', `${p.id} lands mid-phrase`);
    return plans.slice(1).map((p, i) => p.T - plans[i].T);
  };
  // Each landing goes on the outgoing song's phrase boundary nearest its slot (×0.75–1.4, a little wider when a slow
  // song's 4 bars straddle it), so a gap is a whole number of phrases rather than the slot itself.
  const near = (gaps: number[], slot: number, what: string) => {
    for (const g of gaps) assert.ok(g > PACE.phraseSlotRangeWide[0] * slot && g < PACE.phraseSlotRangeWide[1] * slot, `${what}: gap ${g.toFixed(2)} vs slot ${slot}`);
    const mean = gaps.reduce((a, b) => a + b, 0) / gaps.length;
    assert.ok(Math.abs(mean - slot) < 0.15 * slot, `${what}: mean gap ${mean.toFixed(2)} vs slot ${slot}`);
  };
  const first = firstPlaySec(PACE.defaultSec);
  assert.equal(first, 22);
  near(roundGaps(0, 6), first, 'round 1, every song new');
  assert.equal(h.show.snapshot().current?.firstPlay, true);
  assert.deepEqual(h.show.snapshot().pace.firstPlaySec, 22);
  h.send('newRound', { number: 2 });
  h.advance(FLOW.shuffleSec + 0.1); // the Shuffle's animation: nothing lands before it ends
  assert.deepEqual(h.show.playedBefore, h.show.queue.slice(0, 7), "round 1's counted songs");
  const gaps = roundGaps(7, 10);
  assert.equal(h.show.snapshot().current?.firstPlay, true, 'song 11 is new');
  near(gaps.slice(0, 7), PACE.defaultSec, 'round 2, the repeats');
  near(gaps.slice(7), first, 'round 2, the new songs');
});

test('Hold ducks the song, a long Hold hands over to Hold music, and releasing moves on', () => {
  const h = setup();
  startAndLand(h);
  const out = h.send('hold');
  assert.equal(h.show.status, 'hold');
  assert.deepEqual(find(out, 'duck'), { type: 'duck', db: volumeDb(VOLUME_DEFAULTS.songsParlem), seconds: HOLD.duckSec }, 'the songsParlem slider');
  assert.equal(h.show.timers.autoAt, null);
  const later = h.advance(h.show.game.holdMusicAfterSec + 0.1);
  assert.equal(get(later, 'songToHoldMusic').mood, 'hold');
  assert.equal(h.show.current, null);
  assert.equal(h.show.holdMusic, true);
  const position = h.show.position;
  const release = h.send('hold', { on: false });
  const start = find(release, 'startTransition');
  assert.ok(start && start.fromHoldMusic, 'release on Hold music starts the next song from it');
  assert.equal(start.plan.a, null);
  h.until(() => h.show.status === 'playing');
  assert.equal(h.show.position, position + 1);
});

test('releasing a short Hold un-ducks the song and auto-advance resumes after a breather', () => {
  const h = setup();
  startAndLand(h);
  h.send('hold');
  h.advance(5);
  const out = h.send('hold', { on: false });
  assert.deepEqual(find(out, 'duck'), { type: 'duck', db: 0, seconds: HOLD.releaseSec });
  assert.equal(h.show.status, 'playing');
  assert.ok(autoAt(h.show) >= h.clock.t + 4 - 1e-9);
  assert.deepEqual(rejected(h.send('hold', { on: false })), ['notHolding']);
});

test('Back undoes the last landing: the song becomes next again, the drum turns back, Hold music plays', () => {
  const h = setup();
  startAndLand(h);
  h.until(() => h.show.position === 1, 60);
  h.until(() => h.show.status === 'playing');
  const [first, second] = h.show.queue;
  const queueBefore = [...h.show.queue];
  const suw = h.show.game.songsUntilWinner;
  const out = h.send('back');
  assert.ok(find(out, 'rewind'));
  assert.deepEqual(find(out, 'drumBack'), { type: 'drumBack', insertId: first, selectId: first });
  assert.equal(get(out, 'holdMusic').mood, 'error', 'Back plays the error Hold music');
  assert.equal(h.show.position, 0);
  assert.equal(h.show.status, 'hold');
  assert.equal(h.show.current, null);
  assert.equal(h.show.game.songsUntilWinner, suw + 1);
  assert.deepEqual(h.show.queue, queueBefore, 'the Queue order never changes');
  assert.ok(h.show.landings.find((l) => l.songId === second)?.undone);
  const [undone] = emitted(h.log, 'landing.undone');
  assert.equal(undone?.songId, second);
  // Back again: further back. Then nothing left to undo.
  h.send('back');
  assert.equal(h.show.position, -1);
  assert.deepEqual(rejected(h.send('back')), ['nothingToUndo']);
  // Next lands the first song again, out of Hold music.
  const start = get(h.send('next'), 'startTransition');
  assert.equal(start.drum.targetId, first);
  assert.ok(start.fromHoldMusic);
});

test('Back during a Spin cancels it; the outgoing song stays if its exit had not started', () => {
  const h = setup({ settings: { pace: 22 } });
  startAndLand(h);
  h.send('next');
  const t = h.show.transition;
  assert.ok(t && t.aExitStart != null && t.aExitStart > h.clock.t + 0.3, 'a long Spin rides the outgoing song first');
  const out = h.send('back');
  const cancel = get(out, 'cancelTransition');
  assert.ok(cancel.keepOutgoing);
  assert.equal(cancel.drum.insertId, h.show.queue[0]);
  assert.equal(h.show.position, 0, 'nothing landed, nothing to undo');
  assert.equal(h.show.status, 'hold');
  assert.equal(h.show.current?.songId, h.show.queue[0]);
  assert.ok(find(out, 'duck'));
  assert.ok(!find(out, 'holdMusic'));
});

test('Back late in a Spin (exit under way) cancels into Hold music; within 0.15 s of the landing it undoes right after', () => {
  const h = setup();
  startAndLand(h);
  h.send('next');
  const t = h.show.transition;
  assert.ok(t && t.aExitStart != null, 'the Spin rides the outgoing song');
  h.advance(t.aExitStart - h.clock.t + 0.1);
  const out = h.send('back');
  assert.equal(get(out, 'cancelTransition').keepOutgoing, false);
  assert.equal(h.show.holdMusic, true);
  assert.equal(h.show.current, null);

  const h2 = setup({ seed: 3 });
  startAndLand(h2);
  h2.send('next');
  const t2 = h2.show.transition;
  assert.ok(t2);
  h2.advance(t2.T - h2.clock.t - 0.1);
  const late = h2.send('back');
  assert.ok(!find(late, 'cancelTransition'));
  assert.equal(h2.show.status, 'transition');
  const after = h2.advance(0.2);
  assert.ok(find(after, 'landed') && find(after, 'rewind'), 'lands, then Back undoes it');
  assert.equal(h2.show.position, 0);
  assert.equal(h2.show.status, 'hold');
});

test('Hold during a Spin cancels it too (no new song lands)', () => {
  const h = setup({ settings: { pace: 22 } });
  startAndLand(h);
  h.send('next');
  const out = h.send('hold');
  assert.ok(find(out, 'cancelTransition'));
  assert.equal(h.show.status, 'hold');
  assert.equal(h.show.position, 0);
});

test('final phase: auto-advance is off by default; a song left playing loops instead of handing over (D239)', () => {
  const h = setup({ settings: { songsUntilWinner: 1 } });
  startAndLand(h);
  assert.equal(h.show.phaseName(), 'final');
  assert.equal(h.show.timers.autoAt, null);
  const endAt = h.show.current!.endCtx;
  const out = h.until(() => h.clock.t > endAt + 30, 600);
  assert.equal(find(out, 'songToHoldMusic'), undefined, JSON.stringify(types(out)));
  assert.deepEqual([h.show.status, h.show.holdMusic, h.show.loop?.purpose], ['playing', false, 'stay']);
  // Keeping auto-advance on in final: the slot stretches (late/final timing) and the landing goes on a phrase
  // boundary near it.
  const k = setup({ seed: 5, settings: { songsUntilWinner: 1, autoAdvanceFinal: true, pace: 14 } });
  startAndLand(k);
  // A first play: 22 s, stretched ×1.25.
  const { offset, phrase } = autoLanding(k.show, lastLandedAt(k.log));
  assert.ok(offset >= PACE.phraseSlotRange[0] * 27.5 && offset <= PACE.phraseSlotRange[1] * 27.5, `lands ${offset.toFixed(2)} s after`);
  assert.notEqual(phrase, 'bar');
});

test('cards in play drive the Phase; the landing that completes a card stretches its slot by 50%; Line confirmed resets', () => {
  const h = setup({ seed: 21, cards: allCards, cardsInPlay: '1-200', settings: { pace: 14, autoAdvanceFinal: true } });
  h.send('unlock');
  const snap0 = h.show.snapshot();
  assert.equal(snap0.cards.phaseSource, 'cards');
  assert.equal(snap0.cards.validCount, 200);
  const plan = h.show.phaseModel.plan;
  assert.ok(plan, 'a Phase plan from the cards in play');
  const { winAt } = describePlan(plan);
  assert.ok(winAt != null && winAt > 5 && winAt < 40, `first Line at ${winAt}`);
  h.send('next');
  h.until(() => h.show.position === winAt && h.show.status === 'playing', 60 * 30);
  const step = h.show.phaseStep(winAt);
  assert.ok(step, 'a Phase step for the winning song');
  assert.equal(step.phase, 'final', 'the winning song always lands in final');
  assert.ok(step.completes > 0);
  const winners = h.show.snapshot().possibleWinners.line;
  assert.ok(winners.length >= step.completes && winners.every((w) => w.completedBy === h.show.queue[winAt]));
  // The stretched slot is a minimum: the landing goes on the first phrase boundary at or after it that fits (a first
  // play's 22 s × 1.5).
  const { offset, phrase } = autoLanding(h.show, lastLandedAt(h.log));
  assert.ok(offset >= 33 - 1e-6 && offset <= PACE.phraseSlotRangeWide[1] * 33, `slot ${offset.toFixed(2)}`);
  assert.notEqual(phrase, 'bar');
  // The presenters check the claim and confirm the Line: the Phase starts again towards the Bingo.
  h.send('hold');
  h.send('confirmLine');
  assert.equal(h.show.phaseModel.kind, 'bingo');
  assert.equal(h.show.phaseName(), 'early');
  assert.equal(h.show.snapshot().cards.climbingTo, 'bingo');
  // Bad ranges are rejected; an empty list falls back to the placeholder.
  assert.deepEqual(rejected(h.send('setCardsInPlay', { ranges: 'lots of cards' })), ['invalid']);
  h.send('setCardsInPlay', { ranges: '' });
  assert.equal(h.show.snapshot().cards.phaseSource, 'placeholder');
});

test('the special round only counts special cards in play', () => {
  const h = setup({ seed: 4, cards: allCards, cardsInPlay: '1-150, 400-450' });
  h.send('unlock');
  assert.equal(h.show.snapshot().cards.validCount, 150);
  h.send('newRound', { number: 3, kind: 'special' });
  assert.equal(h.show.snapshot().cards.validCount, 51);
  assert.ok(h.show.phaseModel.valid.every((c) => c.type === 'especial'));
});

test('a song still decoding waits; a decode failure is rejected and covered by Hold music', () => {
  let ready = false;
  const h = setup({ decoded: () => ready });
  h.send('unlock');
  const out = h.send('next');
  assert.ok(!find(out, 'startTransition'));
  assert.ok(h.show.pending);
  assert.deepEqual(rejected(h.send('next')), ['busy']);
  ready = true;
  const go = h.show.decoded(h.show.queue[0]);
  assert.ok(find(go, 'startTransition'));

  const f = setup({ decoded: () => false });
  f.send('unlock');
  f.send('next');
  const failed = f.show.decodeFailed(f.show.queue[0], 'boom');
  assert.deepEqual(rejected(failed), ['decodeFailed']);
  assert.ok(find(failed, 'holdMusic'));
  assert.equal(f.show.status, 'hold');
});

test('Pace changes the Spin; locking it stops Drift nudges', () => {
  const h = setup({ settings: { pace: 11 } });
  startAndLand(h);
  h.send('setPace', { pace: 30 });
  assert.equal(h.show.game.pace, 30);
  h.send('setPace', { delta: -2, locked: true });
  assert.equal(h.show.game.pace, 28);
  assert.equal(h.show.nudge, 1);
  // A manual Next: the Spin aims at the Pace's length, unless a phrase boundary is in reach elsewhere.
  const start = get(h.send('next'), 'startTransition');
  assert.ok(start.plan.window.dTarget > 8, `target ${start.plan.window.dTarget}`);
  assert.ok(start.plan.D > 8 || start.plan.phraseClass !== 'bar', `D ${start.plan.D} on a ${start.plan.phraseClass}`);
  h.send('setPace', { pace: 1 });
  assert.equal(h.show.game.pace, 8, 'clamped to the limits');
});

test('Panic stops everything; the same seed gives the same show', () => {
  const run = (seed: number) => {
    const h = setup({ seed });
    startAndLand(h);
    h.until(() => h.show.position === 3, 200);
    return h.log.filter((e) => e.type === 'startTransition').map((e) => [e.plan.recipe, e.plan.hook.id, e.plan.T.toFixed(4)]);
  };
  assert.deepEqual(run(11), run(11));
  const h = setup();
  startAndLand(h);
  const out = h.send('panic');
  assert.ok(find(out, 'stopAll'));
  assert.equal(h.show.status, 'idle');
});

test('fuzz: random commands at random times never break the invariants (the music never stops by accident)', () => {
  const cmds: (() => Command)[] = [
    () => makeCommand('next'), () => makeCommand('next'), () => makeCommand('next'), () => makeCommand('back'), () => makeCommand('hold'),
    () => makeCommand('hold', { on: false }), () => makeCommand('holdMusic'), () => makeCommand('setPace', { delta: 3 }),
    () => makeCommand('setPace', { delta: -3 }), () => makeCommand('setGame', { autoAdvance: false }), () => makeCommand('setGame', { autoAdvance: true }),
    () => makeCommand('setGame', { songsUntilWinner: 1 }), () => makeCommand('setGame', { songsUntilWinner: 30 }),
  ];
  for (let seed = 1; seed <= 12; seed++) {
    const rnd = seededRandom(1000 + seed);
    const h = setup({ seed });
    h.send('unlock');
    for (let step = 0; step < 250; step++) {
      const command = cmds[Math.floor(rnd() * cmds.length)]();
      h.dispatch(command);
      h.advance(rnd() * 6);
      const s = h.show;
      const where = `seed ${seed} step ${step} after ${command.cmd}: ${s.status}`;
      assert.ok(['idle', 'playing', 'transition', 'hold'].includes(s.status), where);
      assert.ok(s.position >= -1 && s.position < s.queue.length, where);
      if (s.status === 'playing') assert.ok(s.current, `${where}: playing without a song`);
      if (s.status === 'hold') assert.ok(s.current || s.holdMusic, `${where}: hold in silence`);
      if (s.status === 'transition') assert.ok(s.transition, where);
      else assert.equal(s.transition, null, where);
      const live = s.landings.filter((l) => !l.undone).map((l) => l.position);
      assert.deepEqual(live, [...Array(s.position + 1).keys()], `${where}: counted landings ≠ queue prefix`);
    }
  }
});

test('a "final lap" stinger plays once per climb, as the Phase first reaches the configured phase; it can be switched off', () => {
  // Phase per transition with the placeholder from 4 songs to a winner: mid, late, late, final.
  const run = (settings: Partial<GameSettings>) => {
    const h = setup({ seed: 8, settings: { songsUntilWinner: 4, autoAdvanceFinal: true, ...settings } });
    startAndLand(h);
    for (let k = 0; k < 3; k++) {
      h.send('next');
      h.until(() => h.show.status === 'playing', 60);
    }
    // Group the effects by transition: its phase and the stingers sent with it.
    const steps: [PhaseName, SoundName[]][] = [];
    for (const e of h.log) {
      if (e.type === 'startTransition') steps.push([e.plan.phase, []]);
      else if (e.type === 'sfx' && steps.length) steps[steps.length - 1][1].push(e.name);
    }
    return steps;
  };
  const on = run({});
  assert.deepEqual(on.map(([phase]) => phase), ['mid', 'late', 'late', 'final']);
  const at = ['mid', 'late', 'late', 'final'].indexOf(ENGINE.finalLapStingerPhase);
  assert.deepEqual(on.map(([, s]) => s), on.map((_, i) => (i === at ? ['mkwii-final-lap'] : [])));
  assert.deepEqual(run({ finalLapStinger: false }).map(([, s]) => s), [[], [], [], []]);
});

test('the next hook is chosen early; a Blend render is requested for tempo-matchable pairs and used when ready', () => {
  // A pair whose tempos are within ±4%, and one that cannot be matched.
  const list = [...analyses.values()].filter((a) => a.tempo.isStable);
  let tight: [number, number] | null = null;
  let far: [number, number] | null = null;
  for (const a of list) for (const b of list) {
    if (a === b) continue;
    const r = a.tempo.bpm / b.tempo.bpm;
    if (!tight && Math.abs(r - 1) < 0.03) tight = [a.songId, b.songId];
    if (!far && Math.abs(r - 1) > 0.2) far = [a.songId, b.songId];
  }
  assert.ok(tight && far, 'the analysis data has a tempo-matchable pair and one that is not');
  const requests: [number, string][] = [];
  const run = (pair: [number, number]) => {
    const h = setup({ seed: 2 });
    h.show.fixedQueue = [...pair, ...songs.map((s) => s.id).filter((id) => !pair.includes(id))];
    h.send('unlock');
    h.send('newRound', { number: 1 });
    h.advance(FLOW.shuffleSec + 0.1);
    h.show.env.blend = (aSongId, hookId) => {
      requests.push([aSongId, hookId]);
      // Like the runtime: a render exists only if it was asked for.
      if (!h.log.some((e) => e.type === 'prepareBlend' && e.aSongId === aSongId && e.hookId === hookId)) return null;
      const A = analyses.get(aSongId);
      assert.ok(A);
      const barSec = (60 / A.tempo.bpm) * 4;
      return { aSongId, hookId, toBpm: A.tempo.bpm, firstDownbeatSec: 0.1, hookSec: 0.1 + 8 * barSec, barSec, bass: true };
    };
    startAndLand(h);
    h.advance(0.5);
    const prepare = h.log.find((e) => e.type === 'prepareBlend');
    const hookId = h.show.nextHook?.hook.id;
    h.send('overrideNextRecipe', { recipe: 'R8' });
    const start = get(h.send('next'), 'startTransition');
    return { prepare, hookId, plan: start.plan, h };
  };
  const t = run(tight);
  assert.ok(t.prepare && t.prepare.tight && t.prepare.bSongId === tight[1] && t.prepare.hookId === t.hookId);
  assert.equal(t.plan.hook.id, t.hookId, 'the early hook is the one that lands');
  assert.equal(t.plan.recipe, 'R8');
  assert.ok(t.plan.blend && t.plan.blend.bars >= 2);
  // Back during a Blend's Spin is as safe as during any other.
  t.h.send('back');
  assert.equal(t.h.show.status, 'hold');
  const f = run(far);
  assert.equal(f.prepare, undefined, 'no render for a pair that cannot be beat-matched');
  assert.notEqual(f.plan.recipe, 'R8');
});

test('approved Signatures reach the planner for both songs, and a planned one is in the transition', () => {
  const requests: PlanRequest[] = [];
  const fake = (id: number): SignatureSource[] => [{ id: `${id}-riff-0`, kind: 'riff', durationSec: 4.03, anchorSec: 0, beats: 8, bpm: 120, gainDb: -3 }];
  const h = setup({
    seed: 3,
    settings: { autoAdvance: false },
    env: {
      signatures: fake,
      plan: (request) => {
        requests.push(request);
        return planTransition(request);
      },
    },
  });
  h.send('unlock');
  h.send('next');
  h.until(() => h.show.status === 'playing');
  h.send('next');
  h.until(() => h.show.position === 1 && h.show.status === 'playing');
  assert.equal(requests.length, 2);
  assert.deepEqual(requests[0].B.signatures, fake(h.show.queue[0]));
  assert.equal(requests[0].A, null, 'nothing played before the first song');
  assert.deepEqual(requests[1].A?.signatures, fake(h.show.queue[0]));
  assert.deepEqual(requests[1].B.signatures, fake(h.show.queue[1]));
  for (const effect of h.log) {
    if (effect.type !== 'startTransition' || !effect.plan.signature) continue;
    const events = effect.plan.events.filter((e) => e.kind === 'signature');
    assert.equal(events.length, 1);
    assert.equal(events[0].id, effect.plan.signature.id);
  }
});

test('Panic or a new round during a Spin or a Suspense tells the remotes it was cancelled (nothing lands)', () => {
  for (const [stop, reason] of [['panic', 'panic'], ['newRound', 'newRound']] as const) {
    for (const open of ['next', 'suspense'] as const) {
      const h = setup({ seed: 2, settings: { autoAdvance: false } });
      h.send('unlock');
      h.send('next');
      h.until(() => h.show.status === 'playing');
      h.send(open);
      const id = h.show.transition?.id ?? h.show.suspense?.id;
      assert.ok(id, open);
      const position = h.show.position;
      const out = stop === 'panic' ? h.send('panic') : h.send('newRound', { number: 2 });
      const cancelled = emitted(out, 'transition.cancelled');
      assert.equal(cancelled.length, 1, `${stop} during ${open}`);
      assert.equal(cancelled[0].id, id);
      assert.equal(cancelled[0].reason, reason);
      if (stop === 'panic') assert.equal(h.show.position, position, 'nothing landed');
    }
  }
});

test('Aguanta (hold without ducking): the song stays at full volume, nothing advances, no Hold music; it switches with Parlem in place', () => {
  const h = setup({ seed: 6 });
  startAndLand(h);
  assert.ok(autoAt(h.show));
  const stay = h.send('hold', { on: true, duck: false });
  assert.equal(h.show.status, 'hold');
  assert.equal(find(stay, 'duck'), undefined, 'not ducked');
  assert.equal(h.show.snapshot().hold?.ducked, false);
  assert.equal(h.show.timers.autoAt, null, 'auto-advance waits');
  assert.equal(h.show.timers.holdMusicAt, null, 'no timed switch to Hold music');
  // Parlem in place: ducked, and Hold music may take over after its delay.
  const talk = h.send('hold', { duck: true });
  assert.equal(get(talk, 'duck').db, volumeDb(VOLUME_DEFAULTS.songsParlem));
  assert.equal(h.show.snapshot().hold?.ducked, true);
  assert.ok(h.show.timers.holdMusicAt != null);
  // Back to Aguanta: full volume again, the timer gone.
  assert.equal(get(h.send('hold', { duck: false }), 'duck').db, 0);
  assert.equal(h.show.timers.holdMusicAt, null);
  assert.equal(h.show.status, 'hold', 'switching never releases');
  // Releasing moves on as after any Hold.
  h.send('hold', { on: false });
  assert.equal(h.show.status, 'playing');
  assert.ok(autoAt(h.show) > h.clock.t);
});

test('Futur (private): where the known Queue first completes a Line and a Bingo, and the cards by songs missing and marked', () => {
  const h = setup({ seed: 21, cards: allCards, cardsInPlay: '1-200', settings: { autoAdvance: false } });
  h.send('unlock');
  const sum = (list: number[]) => list.reduce((a, b) => a + b, 0);
  const before = h.show.snapshot().future;
  assert.ok(before);
  const valid = h.show.snapshot().cards.validCount;
  assert.equal(sum(before.toLine), valid);
  assert.equal(sum(before.toBingo), valid);
  assert.deepEqual(before.markCounts, [valid], 'nothing marked yet');
  assert.ok(before.lineAt != null && before.bingoAt != null && before.lineAt < before.bingoAt);
  for (let k = 0; k < 3; k++) {
    h.send('next');
    h.until(() => h.show.position === k && h.show.status === 'playing');
  }
  const after = h.show.snapshot().future;
  assert.ok(after);
  assert.equal(sum(after.markCounts), valid);
  assert.ok(after.markCounts.length > 1, 'some cards have marks');
  assert.ok(after.lineAt == null || after.lineAt > h.show.position, 'from the next song on');
  assert.equal(h.show.snapshot().future === null, false);
  assert.equal(setup().show.snapshot().future, null, 'none without cards in play');
});

test('Aguanta near the song\'s end: its last full phrase repeats on its downbeats until the Hold is released', () => {
  const h = setup({ seed: 6 });
  startAndLand(h);
  h.send('hold', { on: true, duck: false });
  const cur = h.show.current;
  assert.ok(cur);
  const analysis = analyses.get(cur.songId);
  assert.ok(analysis);
  const endAt = cur.endCtx;
  // Well past the song's own end: it never runs out, never hands over to Hold music.
  const out = h.until(() => h.clock.t > endAt + 60, 400);
  assert.equal(h.show.holdMusic, false);
  assert.equal(find(out, 'songToHoldMusic'), undefined);
  const cues = h.log.filter((e) => e.type === 'cue');
  assert.ok(cues.length >= 3, `${cues.length} repeats`);
  const loop = h.show.loop;
  assert.ok(loop && loop.purpose === 'stay');
  const { phrase } = loop;
  assert.ok(phrase.bars === 8 || phrase.bars === 4);
  assert.ok((phrase.fromIndex - (cur.landedDownbeatIndex ?? 0)) % phrase.bars === 0, 'a phrase counted from the landed hook');
  assert.ok(phrase.toSec <= analysis.source.durationSec - LOOP.stayTailSec + 1e-9, 'before the outro');
  for (const [k, c] of cues.entries()) {
    assert.ok(c.type === 'cue' && c.offset === phrase.fromSec && c.songId === cur.songId);
    if (k > 0) {
      const prev = cues[k - 1];
      assert.ok(prev.type === 'cue' && Math.abs(c.at - prev.at - (phrase.toSec - phrase.fromSec) / cur.rate) < 1e-6, 'one phrase apart');
    }
  }
  // Released: no more repeats, the song plays on into its end, and auto-advance takes over.
  h.send('hold', { on: false });
  assert.equal(h.show.loop, null);
  assert.equal(h.show.status, 'playing');
  const count = h.log.filter((e) => e.type === 'cue').length;
  h.advance(30);
  assert.equal(h.log.filter((e) => e.type === 'cue').length, count);
});

test("a song left playing with auto-advance off loops its last phrase and never hands over to Hold music (D239); Next goes on from the loop", () => {
  const h = setup({ seed: 6, settings: { autoAdvance: false } });
  startAndLand(h);
  const cur = h.show.current;
  assert.ok(cur);
  const endAt = cur.endCtx;
  const out = h.until(() => h.clock.t > endAt + 60, 400);
  assert.equal(h.show.status, 'playing', 'no Hold of its own');
  assert.equal(h.show.holdMusic, false);
  assert.equal(find(out, 'songToHoldMusic'), undefined);
  assert.equal(find(out, 'holdMusic'), undefined);
  assert.ok(h.show.loop?.purpose === 'stay');
  assert.ok(h.log.filter((e) => e.type === 'cue').length >= 3, 'it repeats');
  // Next from the loop: the loop ends, and the next song comes in as usual.
  const next = h.send('next');
  assert.ok(find(next, 'startTransition'), `no transition: ${JSON.stringify(rejected(next))}`);
  assert.equal(h.show.loop, null);
  h.until(() => h.show.status === 'playing' && h.show.current?.songId !== cur.songId, 400);
  assert.equal(h.show.position, 1);
});

test('the drum only ever shows songs still to play (and the last landing under the pointer): Next, Back, Hold, Aguanta and Suspense', () => {
  const cmds: (() => Command)[] = [
    () => makeCommand('next'), () => makeCommand('next'), () => makeCommand('next'), () => makeCommand('back'), () => makeCommand('hold'),
    () => makeCommand('hold', { on: true, duck: false }), () => makeCommand('hold', { on: false }), () => makeCommand('holdMusic'),
    () => makeCommand('suspense'), () => makeCommand('suspense', { on: false }),
  ];
  for (let seed = 1; seed <= 8; seed++) {
    const rnd = seededRandom(2000 + seed);
    const h = setup({ seed, settings: { autoAdvance: false } });
    h.send('unlock');
    // The runtime's drum, as its effects build it (main.ts: drumReset, a Spin's removeId, Back's and a cancel's insertId).
    const drum = new Set<number>();
    let seen = 0;
    const replay = () => {
      for (const e of h.log.slice(seen)) {
        if (e.type === 'drumReset') {
          drum.clear();
          for (const id of e.ids) drum.add(id);
        } else if ((e.type === 'startTransition' || e.type === 'startSuspense') && e.drum.removeId != null) drum.delete(e.drum.removeId);
        else if (e.type === 'cancelTransition' && e.drum.insertId != null) drum.add(e.drum.insertId);
        else if (e.type === 'drumBack' && e.insertId != null) drum.add(e.insertId);
      }
      seen = h.log.length;
    };
    for (let step = 0; step < 200; step++) {
      h.dispatch(cmds[Math.floor(rnd() * cmds.length)]());
      h.advance(rnd() * 8);
      replay();
      const s = h.show;
      const pending = s.queue.slice(s.position + 1);
      const where = `seed ${seed} step ${step} (${s.status}, position ${s.position})`;
      for (const id of pending) assert.ok(drum.has(id), `${where}: pending song ${id} missing from the drum`);
      const allowed = new Set([...pending, ...(s.position >= 0 ? [s.queue[s.position]] : [])]);
      for (const id of drum) assert.ok(allowed.has(id), `${where}: song ${id} on the drum has already played`);
    }
  }
});
