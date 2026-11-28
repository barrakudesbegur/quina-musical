// The rehearsal test tools (TEST_COMMANDS, never on the night): `testReset` reloads the show page on a new Game, and
// `testJump` jumps to a round's intro or into its play with K songs counted, from any moment of the night, in the same
// Game. Whatever plays stops as with Panic; the jump lands once the audio has let go of it (TEST_JUMP.settleSec); the
// journal gets only what roundIntro or resumeAt write (plus the closing of what an intro leaves open), and replays to the
// show's record.
import { dataTest as test } from './support/data.ts';
import assert from 'node:assert/strict';
import {
  TEST_COMMANDS, checkCommand, checkGamePlan, isTestCommand, makeCommand, replayJournal, sceneAllows,
  type CardTypeSides, type GamePlan, type JournalEntry, type ShowScene,
} from '@quina/protocol';
import { TEST_JUMP } from '../engine/src/config.ts';
import type { Effect, EffectOf, EffectType, SongInfo } from '../engine/src/show/show.ts';
import { setup, songs, allCards, type Harness } from './support/harness.ts';
import { SAMPLE_PLAN } from '../../../packages/ui/fixtures/plan.ts';

const find = <T extends EffectType>(effects: readonly Effect[], type: T) => effects.find((e): e is EffectOf<T> => e.type === type);
const all = <T extends EffectType>(effects: readonly Effect[], type: T) => effects.filter((e): e is EffectOf<T> => e.type === type);
const rejections = (effects: readonly Effect[]) => all(effects, 'reject').map((e) => `${e.reason}${e.detail ? `: ${e.detail}` : ''}`);
const journalOf = (effects: readonly Effect[]): JournalEntry[] => effects.flatMap((e) => (e.type === 'journal' ? [e.entry] : []));
/** Whether an effect starts music or a sound (what the moment a jump lands in may start, never its stop). */
const starts = (e: Effect) =>
  e.type === 'introMusic' || e.type === 'holdMusic' || e.type === 'intervalMusic' || e.type === 'celebrationMusic' ||
  (e.type === 'pausaMusic' && e.on) || (e.type === 'voice' && e.action === 'play') || (e.type === 'throwSong' && e.action === 'play') ||
  e.type === 'startTransition' || e.type === 'sfx';

/** The normal card and the especial one each play two sides (D193, D226), each on its own pool. */
const TYPES: CardTypeSides[] = [
  { type: 'normal', name: 'Normal', sides: [{ side: 1, pool: '1' }, { side: 2, pool: '2' }] },
  { type: 'especial', name: 'Especial', sides: [{ side: 1, pool: '1' }, { side: 2, pool: '2' }] },
];
const TWO_POOLS: SongInfo[] = songs.map((s, i) => ({ ...s, pools: [i < 38 ? '1' : '2'] }));
/** The sample plan (rounds 1–4 and 6 normal on side 1, 5 the Desgraciat, 7 the Especial on side 2, 8 normal on side 2). */
const PLAN: GamePlan = (() => {
  const check = checkGamePlan(SAMPLE_PLAN);
  if (!check.ok) throw new Error(`the sample plan is invalid: ${check.errors.join('; ')}`);
  return check.plan;
})();
/** Normal cards and a few especial ones (the Desgraciat's). */
const CARDS = '1-200, 400-430';

function night({ seed = 7, plan = false }: { seed?: number; plan?: boolean } = {}): Harness {
  const h = setup({ seed, cards: allCards, cardTypes: plan ? TYPES : [], songs: plan ? TWO_POOLS : songs, cardsInPlay: CARDS, settings: { autoAdvance: false } });
  h.send('unlock');
  if (plan) h.log.push(...h.show.setPlan(PLAN));
  return h;
}

/** The show, read afresh (an earlier assert must not narrow what a later command changed). */
const live = (h: Harness) => h.show;

/** Land `count` songs, one after the other. */
function landSongs(h: Harness, count: number) {
  for (let i = 0; i < count; i++) {
    const position = h.show.position;
    h.send('next');
    h.until(() => h.show.position === position + 1 && h.show.status === 'playing');
  }
}

/** A Claim on card 1 (`kind`), put under review and won by hand (D121): a Celebration whatever the card says. */
function win(h: Harness, kind: 'line' | 'bingo') {
  h.send('claim', { cardId: 1, kind });
  const claimId = h.show.claims.at(-1)?.claimId;
  assert.ok(claimId);
  h.send('checkReview', { claimId });
  h.send('reviewEnd', { claimId, outcome: 'win' });
  assert.equal(h.show.scene, 'celebration');
}

/** Every moment of the night a jump may come from: how to get there, and what shows it is there. */
const MOMENTS: [name: string, reach: (h: Harness) => void, there: (h: Harness) => boolean][] = [
  ['a fresh Game (before)', () => {}, (h) => h.show.scene === 'before'],
  ['mid-Spin', (h) => { landSongs(h, 2); h.send('next'); h.advance(0.3); }, (h) => h.show.transition != null],
  ['a held Suspense', (h) => { landSongs(h, 2); h.send('suspense', { on: true }); h.advance(1); }, (h) => h.show.suspense != null],
  ['a running Check', (h) => {
    landSongs(h, 3);
    h.send('claim', { cardId: 1 });
    h.send('checkNext', { claimId: h.show.check?.info.claimId ?? '', step: 0 });
  }, (h) => h.show.scene === 'check' && (h.show.check?.info.revealed.length ?? 0) === 1],
  ['a Review', (h) => {
    landSongs(h, 3);
    h.send('claim', { cardIds: [1, 2] });
    h.send('checkReview', { claimId: h.show.check?.info.claimId ?? '' });
  }, (h) => h.show.check?.info.reviewing === true && h.show.claims.some((c) => c.status === 'queued')],
  ['a Celebration under Parlem', (h) => { landSongs(h, 3); win(h, 'line'); h.send('hold', { on: true }); }, (h) => h.show.celebration?.parlem === true],
  ['the Interval', (h) => { landSongs(h, 3); win(h, 'bingo'); h.send('interval'); }, (h) => h.show.scene === 'interval' && h.show.bed === 'interval'],
  ['Pausa', (h) => { landSongs(h, 2); h.send('pause', { on: true }); }, (h) => h.show.pause != null],
  ['after the end, with its goodbye', (h) => { landSongs(h, 2); h.send('endGame'); }, (h) => h.show.scene === 'after' && h.show.voice?.cue === 'goodbye'],
  ['the sound test', (h) => { h.send('soundTest', { kind: 'songs' }); }, (h) => h.show.soundTest != null],
  ['a throw song', (h) => { h.send('throw'); }, (h) => h.show.throwSong?.playing === true],
  ['a round\'s intro and its voice cue', (h) => { h.send('roundIntro'); }, (h) => h.show.scene === 'roundStart' && h.show.intro != null && h.show.voice != null],
  ['a running Shuffle', (h) => { h.send('roundIntro'); h.send('newRound'); h.advance(1); }, (h) => h.show.shuffle != null],
  ['a held drum roll', (h) => { landSongs(h, 2); h.send('padHold', { effect: 'drumroll', on: true }); }, (h) => h.show.padHeld != null],
];

/** Nothing of the moment it left is still going: nothing in flight, no voice, effect, throw or sound test, no flow. */
function assertClean(h: Harness, where: string) {
  const s = h.show;
  assert.equal(s.jump, null, `${where}: landed`);
  for (const [name, value] of Object.entries({
    transition: s.transition, suspense: s.suspense, pending: s.pending, loop: s.loop, check: s.check, batch: s.batch,
    celebrationNext: s.celebrationNext, celebration: s.celebration, interval: s.interval, shuffle: s.shuffle, pause: s.pause,
    padHeld: s.padHeld, throwSong: s.throwSong, soundTest: s.soundTest, finale: s.finale,
  })) assert.equal(value, null, `${where}: no ${name}`);
  assert.ok(s.claims.every((c) => c.status === 'valid' || c.status === 'invalid' || c.status === 'discarded'), `${where}: no Claim left open`);
  assert.deepEqual(replayJournal(journalOf(h.log)), s.record(), `${where}: the journal replays to the show`);
}

/** Jump, check the stop and the wait, then let it land. Returns what the jump wrote to the journal and did on landing. */
function jump(h: Harness, fields: { round: number; songs?: number }, where: string) {
  const game = structuredClone(h.show.game);
  const volumes = { ...h.show.volumes };
  const cards = h.show.cardsInPlayText;
  const from = h.log.length;
  const stop = h.send('testJump', fields);
  assert.deepEqual(rejections(stop), [], where);
  // Panic first: everything stops silently, nothing starts.
  assert.deepEqual(find(stop, 'stopAll'), { type: 'stopAll', fadeSec: 0.3 }, `${where}: stopped as with Panic`);
  assert.deepEqual(stop.filter(starts).map((e) => e.type), [], `${where}: nothing starts with the stop`);
  assert.equal(h.show.status, 'idle', where);
  assert.ok(h.show.jump, `${where}: the jump waits for the audio to let go`);
  // While it lands, the show waits; what only reads still answers.
  assert.deepEqual(rejections(h.send('next')), ['busy: a test jump is landing'], where);
  assert.deepEqual(rejections(h.send('getState')), [], where);
  h.advance(TEST_JUMP.settleSec - 0.05);
  assert.ok(h.show.jump, `${where}: not before TEST_JUMP.settleSec`);
  const landed = h.advance(0.1);
  assert.ok(!landed.some((e) => e.type === 'stopAll'), `${where}: the moment's music is never stopped with the rest`);
  assert.deepEqual(h.show.game, game, `${where}: the settings stay`);
  assert.deepEqual(h.show.volumes, volumes, `${where}: the volumes stay`);
  assert.equal(h.show.cardsInPlayText, cards, `${where}: the cards in play stay`);
  return { written: journalOf(h.log.slice(from)), landed };
}

test('the test tools are commands of their own, allowed in every scene and during Pausa', () => {
  assert.deepEqual([...TEST_COMMANDS], ['testReset', 'testJump']);
  assert.ok(isTestCommand('testJump') && isTestCommand('testReset') && !isTestCommand('panic') && !isTestCommand(undefined));
  const scenes: ShowScene[] = ['before', 'roundStart', 'play', 'check', 'celebration', 'interval', 'after'];
  for (const scene of scenes) {
    for (const paused of [false, true]) {
      for (const cmd of TEST_COMMANDS) assert.ok(sceneAllows(cmd, { scene, celebrating: null, introduced: false, paused }), `${cmd} in ${scene}${paused ? ', paused' : ''}`);
    }
  }
  assert.ok(checkCommand(makeCommand('testReset')).ok);
  assert.ok(checkCommand(makeCommand('testJump', { round: 3 })).ok);
  assert.ok(checkCommand(makeCommand('testJump', { round: 20, songs: 0 })).ok);
  for (const bad of [{ round: 0 }, { round: 21 }, { round: 2.5 }, { round: 3, songs: -1 }, { round: 3, songs: 1000 }, { round: 3, songs: 1.5 }, {}, { round: 3, extra: 1 }]) {
    assert.equal(checkCommand({ ...makeCommand('testReset'), cmd: 'testJump', ...bad }).ok, false, JSON.stringify(bad));
  }
});

for (const [name, reach, there] of MOMENTS) {
  test(`testJump from ${name}: round 3's intro, as roundIntro, and the flow it left closed`, () => {
    const h = night();
    reach(h);
    assert.ok(there(h), `reached ${name}`);
    const fromCelebration = h.show.scene === 'celebration';
    const { written, landed } = jump(h, { round: 3 }, name);
    const s = h.show;
    assert.equal(s.scene, 'roundStart');
    assert.deepEqual(s.intro && [s.intro.round, s.intro.kind, s.intro.cardType, s.intro.side], [3, 'normal', 'normal', 1], 'no plan: a normal round');
    assert.equal(s.status, 'hold');
    assert.equal(s.bed, 'intro', 'its intro track');
    assert.ok(find(landed, 'introMusic'), 'the intro track starts on landing');
    assert.equal(s.voice?.cue, s.roundCue(3, 'normal'), 'its voice cue, as roundIntro plays it');
    assert.ok(find(landed, 'drumReset'), 'the drum at rest');
    if (fromCelebration) assert.ok(all(landed, 'bedDuck').some((e) => e.db === 0), "Parlem's duck of the Celebration's music lets go");
    // Only what roundIntro writes (the scene, the prizes), and the closing of what was left open.
    const kinds = new Set(written.map((e) => e.kind));
    for (const kind of kinds) assert.ok(['scene.changed', 'prizes.revealed', 'claim.reviewing', 'claim.discarded'].includes(kind), `${name}: ${kind}`);
    assert.equal(written.filter((e) => e.kind === 'scene.changed').length, 1, 'one scene change, straight to the intro (no end screen)');
    assertClean(h, name);
    // The night goes on from there: its Shuffle, then play.
    h.send('newRound');
    assert.equal(h.show.round.number, 3);
    h.advance(10);
    assert.equal(h.show.scene, 'play');
    assert.deepEqual(replayJournal(journalOf(h.log)), h.show.record(), `${name}: then the Shuffle`);
  });

  test(`testJump from ${name}: round 4 in play with 5 songs counted, as resumeAt, in Hold music`, () => {
    const h = night();
    reach(h);
    assert.ok(there(h), `reached ${name}`);
    const fromCelebration = h.show.scene === 'celebration';
    const { written, landed } = jump(h, { round: 4, songs: 5 }, name);
    const s = h.show;
    assert.equal(s.scene, 'play');
    assert.deepEqual([s.round.number, s.round.kind, s.round.cardType, s.round.side], [4, 'normal', 'normal', 1]);
    assert.equal(s.position, 4, 'the last counted song is the fifth');
    assert.deepEqual(s.landings.map((l) => [l.songId, l.position, l.undone]), s.queue.slice(0, 5).map((id, p) => [id, p, false]));
    assert.notEqual(s.shuffleSeed, 0, 'a fresh Shuffle, from env.random');
    assert.deepEqual(s.claims, [], 'the round starts with no Claims');
    assert.equal(s.status, 'hold');
    assert.equal(s.hold?.reason, 'music');
    assert.equal(s.holdMusic, true, 'Hold music until Next');
    assert.ok(find(landed, 'holdMusic'), 'Hold music starts on landing');
    assert.equal(s.voice, null, 'no voice cue');
    if (fromCelebration) assert.ok(all(landed, 'bedDuck').some((e) => e.db === 0), "Parlem's duck of the Celebration's music lets go");
    assert.deepEqual(written.map((e) => e.kind), ['round.resumed'], 'only what resumeAt writes');
    assertClean(h, name);
    // Next lands the sixth song.
    const sixth = s.queue[5];
    h.send('next');
    h.until(() => h.show.position === 5 && h.show.status === 'playing');
    assert.equal(h.show.landings.at(-1)?.songId, sixth);
    assert.deepEqual(replayJournal(journalOf(h.log)), h.show.record(), `${name}: then a landing`);
  });
}

test('testJump with 0 songs: the round in play with nothing landed yet; with its whole Queue, every song counted', () => {
  const h = night();
  landSongs(h, 2);
  jump(h, { round: 2, songs: 0 }, 'no songs');
  assert.equal(h.show.position, -1);
  assert.deepEqual(h.show.landings, []);
  assert.equal(h.show.snapshot().next?.songId, h.show.queue[0], 'the Queue\'s first song is next');
  assertClean(h, 'no songs');
  const length = h.show.queue.length;
  jump(h, { round: 2, songs: length }, 'the whole Queue');
  assert.equal(h.show.position, length - 1);
  assert.equal(h.show.snapshot().next, null);
  assertClean(h, 'the whole Queue');
});

test('testJump past the Queue is refused as invalid, and stops nothing', () => {
  const h = night();
  landSongs(h, 2);
  const length = h.show.queue.length;
  const current = h.show.current;
  const out = h.send('testJump', { round: 4, songs: length + 1 });
  assert.deepEqual(rejections(out), [`invalid: round 4's Queue has ${length} songs, fewer than ${length + 1}`]);
  assert.ok(!find(out, 'stopAll'), 'nothing stops');
  assert.equal(h.show.jump, null);
  assert.equal(h.show.current, current, 'the song plays on');
  assert.equal(h.show.round.number, 1);
  assert.deepEqual(journalOf(out), []);
});

test('testJump follows the Game plan: each round\'s kind, card type and side; a round not in it is a normal one', () => {
  const h = night({ plan: true });
  const cases: [round: number, songs: number | undefined, kind: string, cardType: string, side: number][] = [
    [5, undefined, 'desgraciat', 'especial', 1],
    [7, undefined, 'special', 'especial', 2],
    [8, 3, 'normal', 'normal', 2],
    [5, 4, 'desgraciat', 'especial', 1],
    [7, 2, 'special', 'especial', 2],
    [12, 1, 'normal', 'normal', 1],
    [12, undefined, 'normal', 'normal', 1],
  ];
  for (const [round, songs, kind, cardType, side] of cases) {
    const where = `round ${round}${songs == null ? "'s intro" : ` with ${songs} songs`}`;
    jump(h, songs == null ? { round } : { round, songs }, where);
    if (songs == null) {
      assert.equal(h.show.scene, 'roundStart', where);
      assert.deepEqual(h.show.intro && [h.show.intro.round, h.show.intro.kind, h.show.intro.cardType, h.show.intro.side], [round, kind, cardType, side], where);
      assertClean(h, where);
      // Its Shuffle plays the intro's round (as newRound does after roundIntro).
      h.send('newRound');
      assert.deepEqual([h.show.round.number, h.show.round.kind, h.show.round.cardType, h.show.round.side], [round, kind, cardType, side], `${where}, then its Shuffle`);
      assert.deepEqual(replayJournal(journalOf(h.log)), h.show.record(), `${where}, then its Shuffle`);
      continue;
    }
    assert.equal(h.show.scene, 'play', where);
    assert.deepEqual([h.show.round.number, h.show.round.kind, h.show.round.cardType, h.show.round.side], [round, kind, cardType, side], where);
    assert.equal(h.show.round.pool, side === 2 ? '2' : '1', `${where}: its side's pool`);
    assert.ok(h.show.queue.every((id) => TWO_POOLS.find((s) => s.id === id)?.pools?.includes(h.show.round.pool)), `${where}: a Shuffle of that pool`);
    assert.equal(h.show.position, songs - 1, where);
    assertClean(h, where);
  }
});

test('testJump refuses a planned side the card types lack, and stops nothing', () => {
  const h = setup({ seed: 3, cards: allCards, cardsInPlay: CARDS, settings: { autoAdvance: false } });
  h.send('unlock');
  h.log.push(...h.show.setPlan(PLAN)); // round 8 plays side 2, and this show knows no card types
  landSongs(h, 1);
  const out = h.send('testJump', { round: 8 });
  assert.deepEqual(rejections(out), ['invalid: card type normal has no side 2']);
  assert.ok(!find(out, 'stopAll'));
  assert.equal(h.show.scene, 'play');
});

test('an intro jump from a Desgraciat finale calls the finale off (one already cued stays, as at a round\'s end)', () => {
  const h = night({ plan: true });
  jump(h, { round: 5, songs: 3 }, 'into the Desgraciat');
  const standing = h.show.standing()?.cardIds ?? [];
  assert.ok(standing.length >= 2, 'cards standing');
  assert.deepEqual(rejections(h.send('finale', { cardIds: standing.slice(0, 2) })), []);
  assert.ok(h.show.finale);
  const { written } = jump(h, { round: 6 }, 'to the next intro');
  assert.equal(h.show.finale, null);
  assert.deepEqual(written.filter((e) => e.kind === 'finale.set').map((e) => e.kind === 'finale.set' && e.cardIds), [[]], 'called off in the journal');
  assert.equal(replayJournal(journalOf(h.log)).round?.finale, undefined);
  assertClean(h, 'the finale called off');

  // A finale already cued (its winner celebrated) is the round's history: it stays, as it does at a round's end.
  jump(h, { round: 5, songs: 3 }, 'into the Desgraciat again');
  const [a, b] = h.show.standing()?.cardIds ?? [];
  h.send('finale', { cardIds: [a, b] });
  h.send('finale', { cardIds: [a] }); // removed by hand: the one left wins
  assert.deepEqual(rejections(h.send('finaleCue')), []);
  assert.equal(h.show.scene, 'celebration');
  const after = jump(h, { round: 6 }, 'from its Celebration');
  const s = live(h); // read afresh: the asserts above narrowed h.show.finale to null
  assert.deepEqual(s.finale?.cardIds, [a], 'the cued finale stays');
  assert.equal(s.finaleCued, true);
  assert.ok(!after.written.some((e) => e.kind === 'finale.set'));
  assert.equal(h.show.scene, 'roundStart');
  assert.deepEqual(replayJournal(journalOf(h.log)), h.show.record());
});

test('an intro jump discards the Claims left open in the journal; the decided ones and the Winners stay', () => {
  const h = night();
  landSongs(h, 3);
  win(h, 'line'); // cl-1, valid: a Winner
  h.send('next');
  h.until(() => h.show.status === 'playing');
  h.send('claim', { cardIds: [2, 3, 4] }); // cl-2 checking, cl-3 and cl-4 queued
  h.send('checkReview', { claimId: 'cl-3' }); // under review
  const { written } = jump(h, { round: 2 }, 'with open Claims');
  assert.deepEqual(h.show.claims.map((c) => [c.claimId, c.status]), [['cl-1', 'valid'], ['cl-2', 'discarded'], ['cl-3', 'discarded'], ['cl-4', 'discarded']]);
  assert.deepEqual(h.show.winners.map((w) => w.claimId), ['cl-1'], 'the Winners belong to the Game');
  const closing = written.filter((e) => e.kind === 'claim.reviewing' || e.kind === 'claim.discarded').map((e) => `${e.kind} ${'claimId' in e ? e.claimId : ''}`);
  assert.deepEqual(closing, ['claim.reviewing cl-2', 'claim.discarded cl-2', 'claim.discarded cl-3', 'claim.reviewing cl-4', 'claim.discarded cl-4']);
  assertClean(h, 'with open Claims');
  assert.deepEqual(rejections(h.send('endGame')), [], 'no Review holds the Game any more');
});

test('a second testJump while one lands replaces it; testJump waits for the click like every command', () => {
  const h = night();
  landSongs(h, 2);
  h.send('testJump', { round: 3 });
  h.advance(0.2);
  const again = h.send('testJump', { round: 6, songs: 2 });
  assert.deepEqual(rejections(again), []);
  h.advance(TEST_JUMP.settleSec - 0.05);
  assert.ok(h.show.jump, 'the wait starts again');
  h.advance(0.1);
  assert.deepEqual([h.show.scene, h.show.round.number, h.show.position], ['play', 6, 1], 'only the last one lands');
  assertClean(h, 'replaced');

  const locked = setup({ seed: 2, cards: allCards, cardsInPlay: CARDS });
  assert.deepEqual(rejections(locked.send('testJump', { round: 2 })), ['locked']);
});

test('testReset: the runtime reloads the page on a new Game; nothing else happens, and a page waiting for its click may too', () => {
  for (const unlocked of [true, false]) {
    const h = setup({ seed: 4, cards: allCards, cardsInPlay: CARDS, settings: { autoAdvance: false } });
    if (unlocked) {
      h.send('unlock');
      landSongs(h, 1);
    }
    const record = h.show.record();
    const out = h.send('testReset');
    assert.deepEqual(rejections(out), [], unlocked ? 'unlocked' : 'locked');
    assert.deepEqual(out.map((e) => e.type), ['reloadFresh'], 'only the reload: no stop, no journal entry');
    assert.deepEqual(h.show.record(), record);
  }
  // During a jump's wait too.
  const h = night();
  h.send('testJump', { round: 2 });
  assert.deepEqual(h.send('testReset').map((e) => e.type), ['reloadFresh']);
});
