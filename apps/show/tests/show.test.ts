// The show state machine, driven with a fake clock and seeded randomness over the real analysis data.
import test from 'node:test';
import assert from 'node:assert/strict';
import { Show } from '../engine/src/show/show.ts';
import { planTransition, type PlanRequest, type SignatureSource } from '../engine/src/plan/planner.ts';
import type { Effect, EffectOf, EffectType } from '../engine/src/show/show.ts';
import { makeCommand } from '@quina/protocol';
import type { Command, EventOf, GameSettings, PhaseName, ShowEvent, ShowEventType, SoundName } from '@quina/protocol';
import { HOLD, ENGINE, FLOW, PACE } from '../engine/src/config.ts';
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

test('auto-advance lands on the phrases near the Pace (round 1: 22 s; later rounds 14 s)', () => {
  for (const round of [1, 2]) {
    const h = setup({ seed: 7 + round });
    h.send('unlock');
    if (round === 2) {
      h.send('newRound', { number: 2 });
      h.advance(FLOW.shuffleSec + 0.1); // the Shuffle's animation: nothing lands before it ends
    }
    assert.equal(h.show.game.pace, round === 1 ? 22 : 14);
    startAndLand(h);
    for (let k = 1; k <= 6; k++) h.until(() => h.show.position === k && h.show.status === 'playing', 80);
    const plans = h.log.flatMap((e) => (e.type === 'landed' ? [e.plan] : []));
    const Ts = plans.map((p) => p.T);
    const gaps = Ts.slice(1).map((t, i) => t - Ts[i]);
    const pace = h.show.game.pace;
    // Each landing goes on the outgoing song's phrase boundary nearest its slot (×0.75–1.4, a little wider
    // when a slow song's 4 bars straddle it), so a gap is a whole number of phrases rather than the Pace.
    for (const g of gaps) assert.ok(g > PACE.phraseSlotRangeWide[0] * pace && g < PACE.phraseSlotRangeWide[1] * pace, `gap ${g.toFixed(2)} vs pace ${pace}`);
    for (const p of plans.slice(1)) assert.notEqual(p.phraseClass, 'bar', `${p.id} lands mid-phrase`);
    const mean = gaps.reduce((a, b) => a + b, 0) / gaps.length;
    assert.ok(Math.abs(mean - pace) < 0.15 * pace, `mean gap ${mean.toFixed(2)} vs pace ${pace}`);
  }
});

test('Hold ducks the song, a long Hold hands over to Hold music, and releasing moves on', () => {
  const h = setup();
  startAndLand(h);
  const out = h.send('hold');
  assert.equal(h.show.status, 'hold');
  assert.deepEqual(find(out, 'duck'), { type: 'duck', db: HOLD.duckDb, seconds: HOLD.duckSec });
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

test('final phase: auto-advance is off by default; a song running out hands over to Hold music', () => {
  const h = setup({ settings: { songsUntilWinner: 1 } });
  startAndLand(h);
  assert.equal(h.show.phaseName(), 'final');
  assert.equal(h.show.timers.autoAt, null);
  const out = h.until(() => h.show.status === 'hold', 600);
  assert.ok(find(out, 'songToHoldMusic'), JSON.stringify(types(out)) + ' ' + JSON.stringify(h.show.hold) + ' cur ' + JSON.stringify(h.show.current) + ' t ' + h.clock.t);
  assert.equal(h.show.holdMusic, true);
  // Keeping auto-advance on in final: the slot stretches (late/final timing) and the landing goes on a phrase
  // boundary near it.
  const k = setup({ seed: 5, settings: { songsUntilWinner: 1, autoAdvanceFinal: true, pace: 14 } });
  startAndLand(k);
  const { offset, phrase } = autoLanding(k.show, lastLandedAt(k.log));
  assert.ok(offset >= PACE.phraseSlotRange[0] * 17.5 && offset <= PACE.phraseSlotRange[1] * 17.5, `lands ${offset.toFixed(2)} s after`);
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
  // The stretched slot is a minimum: the landing goes on the first phrase boundary at or after it that fits.
  const { offset, phrase } = autoLanding(h.show, lastLandedAt(h.log));
  assert.ok(offset >= 21 - 1e-6 && offset <= PACE.phraseSlotRangeWide[1] * 21, `slot ${offset.toFixed(2)}`);
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
