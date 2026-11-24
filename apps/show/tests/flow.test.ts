// The show flow (docs/protocol.md › Scenes): the scene rules, Claims and their Checks, the Celebration, the
// Interval, the technical pause, and how they ride on the show state machine. Fake clock, real analysis data,
// real cards.
import { HAS_DATA, NO_CARD, dataTest as test } from './support/data.ts';
import assert from 'node:assert/strict';
import { COMMAND_NAMES, replayJournal, type CommandName, type EventOf, type JournalEntry, type ShowEvent, type ShowEventType, type ShowScene } from '@quina/protocol';
import { sceneAllows, type SceneContext } from '@quina/protocol';
import { FLOW, HOLD } from '../engine/src/config.ts';
import { cardSongIds, type Card } from '../engine/src/game/cards.ts';
import type { Effect, EffectOf, EffectType } from '../engine/src/show/show.ts';
import { hookLoop, bestHook } from '../engine/src/plan/hookloop.ts';
import { setup, songs, allCards, analyses, type Harness } from './support/harness.ts';

const find = <T extends EffectType>(effects: readonly Effect[], type: T) => effects.find((e): e is EffectOf<T> => e.type === type);
const all = <T extends EffectType>(effects: readonly Effect[], type: T) => effects.filter((e): e is EffectOf<T> => e.type === type);
const rejected = (effects: readonly Effect[]) => effects.filter((e) => e.type === 'reject').map((e) => e.reason);
const isEventOf = <T extends ShowEventType>(event: ShowEvent, type: T): event is EventOf<T> => event.type === type;
const emitted = <T extends ShowEventType>(effects: readonly Effect[], type: T) =>
  effects.flatMap((e) => (e.type === 'emit' && isEventOf(e.message, type) ? [e.message] : []));
const journalOf = (effects: readonly Effect[]): JournalEntry[] => effects.flatMap((e) => (e.type === 'journal' ? [e.entry] : []));
const sfxNames = (effects: readonly Effect[]) => all(effects, 'sfx').map((e) => e.name);

/** A normal card whose 12 songs are all playable, and a Queue that completes its top row first, then the rest. */
const catalog = new Set(songs.map((s) => s.id));
const playable = (c: Card) => cardSongIds(c).flat().every((id) => catalog.has(id));
const card = allCards.find((c) => c.type === 'normal' && c.id <= 200 && playable(c)) ?? (HAS_DATA ? undefined : NO_CARD);
assert.ok(card, 'a card with every song playable');
const rows = cardSongIds(card);
const onCard = new Set(rows.flat());
const fillers = songs.map((s) => s.id).filter((id) => !onCard.has(id));
/** Line after 4 landings (index 3), Bingo after 14 (index 13). */
const QUEUE = [...rows[0], fillers[0], fillers[1], ...rows[1], ...rows[2], ...fillers.slice(2)];
/** Another normal card, with nothing complete after the first few songs of QUEUE. */
const loser = allCards.find((c) => c.type === 'normal' && c.id !== card.id && c.id <= 200 && cardSongIds(c).every((row) => row.some((id) => !QUEUE.slice(0, 14).includes(id)))) ?? (HAS_DATA ? undefined : NO_CARD);
assert.ok(loser);
const specialCard = allCards.find((c) => c.type === 'especial') ?? (HAS_DATA ? undefined : { ...NO_CARD, type: 'especial' });
assert.ok(specialCard);

function flow(seed = 3) {
  const h = setup({ seed, cards: allCards, cardsInPlay: '1-200', fixedQueue: QUEUE, settings: { autoAdvance: false } });
  h.send('unlock');
  return h;
}

/** Land `count` songs, one after the other. */
function landSongs(h: Harness, count: number) {
  for (let i = 0; i < count; i++) {
    const position = h.show.position;
    h.send('next');
    h.until(() => h.show.position === position + 1 && h.show.status === 'playing');
  }
}

/** Let the running Check play to its result. */
function finishCheck(h: Harness) {
  const check = h.show.check;
  assert.ok(check, 'a Check is running');
  h.until(() => h.show.claims.find((c) => c.claimId === check.info.claimId)?.status === 'checked');
}

/** The show, read afresh (an earlier assert must not narrow what a later command changed). */
const live = (h: Harness) => h.show;

const lastClaimId = (h: Harness) => {
  const claim = h.show.claims.at(-1);
  assert.ok(claim);
  return claim.claimId;
};

// ---------------------------------------------------------------------------------------- the scene rules
test('the scene rules: what each scene accepts (the agreed table, plus `before` acting as `play`)', () => {
  const ANY: CommandName[] = ['unlock', 'getState', 'getJournal', 'setPace', 'setGame', 'setCardsInPlay', 'sfx', 'overrideNextRecipe', 'panic', 'pause', 'endGame', 'winnerInfo'];
  const PLAY: CommandName[] = ['next', 'back', 'hold', 'holdMusic', 'suspense', 'confirmLine', 'newRound'];
  const cases: [string, Partial<SceneContext> & { scene: ShowScene }, CommandName[]][] = [
    ['before', { scene: 'before' }, [...PLAY, 'roundIntro', 'resumeAt']],
    ['roundStart, introduced', { scene: 'roundStart', introduced: true }, ['newRound', 'intervalSkip']],
    ['roundStart, shuffled', { scene: 'roundStart' }, ['next', 'newRound', 'intervalSkip']],
    ['play', { scene: 'play' }, [...PLAY, 'claim']],
    ['check', { scene: 'check' }, ['back', 'holdMusic', 'claim', 'checkStart', 'decide', 'celebrationMusic']],
    ['celebration (Line)', { scene: 'celebration', celebrating: 'line' }, ['next', 'hold', 'confirmLine', 'newRound', 'claim', 'celebrationMusic']],
    ['celebration (Bingo)', { scene: 'celebration', celebrating: 'bingo' }, ['confirmLine', 'newRound', 'roundIntro', 'claim', 'celebrationMusic', 'interval']],
    ['interval', { scene: 'interval' }, ['newRound', 'roundIntro', 'resumeAt', 'intervalSkip']],
    ['after', { scene: 'after' }, ['newRound', 'roundIntro', 'resumeAt', 'intervalSkip']],
    ['roundStart without Interval music', { scene: 'roundStart', intervalMusic: false }, ['next', 'newRound']],
    ['play with the Interval music still on', { scene: 'play', intervalMusic: true }, [...PLAY, 'claim', 'intervalSkip']],
    ['paused in play', { scene: 'play', paused: true }, []],
    ['paused in a Check', { scene: 'check', paused: true }, []],
  ];
  for (const [name, partial, extra] of cases) {
    const ctx: SceneContext = { celebrating: null, introduced: false, paused: false, ...partial };
    const allowed = COMMAND_NAMES.filter((cmd) => sceneAllows(cmd, ctx)).sort();
    assert.deepEqual(allowed, [...ANY, ...extra].sort(), name);
  }
});

test('a command in the wrong scene is rejected as wrongScene; a fresh Game is `before` and plays as today', () => {
  const h = flow();
  assert.equal(h.show.scene, 'before');
  assert.deepEqual(rejected(h.send('claim', { cardId: card.id })), ['wrongScene'], 'nothing to claim before the first song');
  assert.deepEqual(rejected(h.send('interval')), ['wrongScene']);
  assert.deepEqual(rejected(h.send('decide', { claimId: 'cl-1', valid: true })), ['wrongScene']);
  const out = h.send('next');
  assert.ok(find(out, 'startTransition'), 'Next works in `before`');
  assert.equal(h.show.scene, 'play', 'the first Spin starts the round');
  assert.deepEqual(emitted(out, 'scene.changed').map((e) => [e.previous, e.scene]), [['before', 'play']]);
  assert.deepEqual(journalOf(out).filter((e) => e.kind === 'scene.changed').map((e) => e.kind === 'scene.changed' && e.scene), ['play']);
  assert.deepEqual(rejected(h.send('roundIntro')), ['wrongScene'], 'rounds are introduced between rounds');
  const detail = h.send('checkStart', { claimId: 'cl-1' }).find((e) => e.type === 'reject');
  assert.ok(detail?.type === 'reject' && detail.detail === 'scene play');
});

// ---------------------------------------------------------------------------------------- the whole flow
test('a whole round: Line claimed, checked, confirmed and celebrated; back to play; Bingo; Interval; the next round', () => {
  const h = flow();
  landSongs(h, 4);
  const winningSong = QUEUE[3];
  assert.equal(h.show.current?.songId, winningSong);

  // The Claim: Hold (reason claim), scene check, its Check starts at once.
  const claimOut = h.send('claim', { cardId: card.id });
  assert.equal(h.show.scene, 'check');
  assert.equal(h.show.status, 'hold');
  assert.equal(h.show.hold?.reason, 'claim');
  const [opened] = emitted(claimOut, 'claim.opened');
  assert.deepEqual({ ...opened.claim, atMs: 0 }, { claimId: 'cl-1', round: 1, cardId: card.id, kind: 'line', atMs: 0, position: 3, status: 'queued', outcome: null, completeSince: null, warnings: [] });
  const [scheduled] = emitted(claimOut, 'check.scheduled');
  assert.equal(scheduled.check.outcome, 'complete');
  assert.equal(scheduled.check.row, 0);
  assert.deepEqual(scheduled.check.steps.map((s) => [s.songId, s.landed, s.durationMs]), rows[0].map((id) => [id, true, 2500]));
  const snippets = find(claimOut, 'checkSnippets');
  assert.ok(snippets && snippets.duckDb === FLOW.check.duckDb && snippets.steps.length === 4);
  assert.equal(h.env.toEpochMs(snippets.steps[0].at), scheduled.check.steps[0].atMs, 'the projector and the audio share the step times');
  const claim = h.show.claims[0];
  assert.equal(claim.status, 'checking');
  assert.equal(claim.completeSince, 3, 'complete since song 4');
  assert.equal(h.show.snapshot().check?.claimId, 'cl-1');

  finishCheck(h);
  assert.equal(h.show.check?.info.claimId, 'cl-1', 'the result stays on screen until the verdict');

  // Valid: a Winner, the Line confirmed, the Celebration with the Clear fanfare and the Winning song looped.
  const hookId = h.show.current?.hookId;
  const decided = h.send('decide', { claimId: 'cl-1', valid: true });
  assert.deepEqual(emitted(decided, 'claim.decided').map((e) => [e.claimId, e.verdict]), [['cl-1', 'valid']]);
  assert.equal(h.show.round.lineConfirmed, true);
  assert.equal(h.show.phaseModel.kind, 'bingo');
  assert.equal(h.show.scene, 'celebration');
  assert.deepEqual(h.show.winners.map((w) => [w.claimId, w.kind, w.cardId, w.winningSongId, w.position, w.name]), [['cl-1', 'line', card.id, winningSong, 3, null]]);
  const [celebration] = emitted(decided, 'celebration.started');
  assert.deepEqual({ ...celebration.celebration, sinceMs: 0 }, { kind: 'line', round: 1, cardIds: [card.id], winningSongId: winningSong, sinceMs: 0, music: 'winningSong' });
  assert.deepEqual(sfxNames(decided), [FLOW.celebration.fanfare, FLOW.celebration.impact]);
  const music = find(decided, 'celebrationMusic');
  assert.ok(music);
  assert.deepEqual([music.choice, music.songId, music.hookId], ['winningSong', winningSong, hookId], 'the hook it landed on');
  assert.equal(h.show.current, null);
  assert.equal(h.show.bed, 'winningSong');
  assert.ok(journalOf(decided).some((e) => e.kind === 'line.confirmed'));

  // A Winner's name and notes (PRIVATE), journaled.
  const noted = h.send('winnerInfo', { claimId: 'cl-1', name: ' Maria ', notes: 'Fila 3' });
  assert.deepEqual(journalOf(noted).map((e) => e.kind === 'winner.noted' && [e.name, e.notes]), [['Maria', 'Fila 3']]);
  assert.deepEqual(rejected(h.send('winnerInfo', { claimId: 'cl-9', name: 'x' })), ['unknownClaim']);

  // Next: back to the round; the Celebration's music gives way to the build.
  const next = h.send('next');
  assert.equal(h.show.scene, 'play');
  assert.equal(h.show.celebration, null);
  assert.ok(find(next, 'startTransition')?.fromHoldMusic, 'the build comes out of the Celebration music');
  assert.equal(h.show.bed, null);
  h.until(() => h.show.status === 'playing');
  landSongs(h, 9);
  assert.equal(h.show.position, 13);

  // The Bingo: the default kind is now the Bingo; all 12 songs are checked.
  const bingo = h.send('claim', { cardId: card.id });
  const [bingoCheck] = emitted(bingo, 'check.scheduled');
  assert.equal(bingoCheck.check.kind, 'bingo');
  assert.equal(bingoCheck.check.row, null);
  assert.equal(bingoCheck.check.steps.length, 12);
  assert.equal(h.show.claims[1].completeSince, 13);
  finishCheck(h);
  const won = h.send('decide', { claimId: 'cl-2', valid: true });
  assert.equal(h.show.scene, 'celebration');
  assert.equal(live(h).celebration?.kind, 'bingo');
  assert.equal(find(won, 'celebrationMusic')?.choice, 'victory');
  assert.deepEqual(rejected(h.send('next')), ['wrongScene'], 'the round is over');

  // The Interval comes by itself after a while (the victory track flows into it).
  h.advance(FLOW.celebration.toIntervalSec - 1);
  assert.equal(h.show.scene, 'celebration');
  const later = h.advance(1.1);
  assert.equal(h.show.scene, 'interval');
  assert.ok(find(later, 'intervalMusic'));
  assert.equal(h.show.interval?.nextRound, 2);
  assert.equal(h.show.interval?.guideEndMs, (h.show.interval?.sinceMs ?? 0) + FLOW.intervalGuideSec * 1000);

  // Rounds start by hand: the intro, then the Shuffle under the same Interval music, then play.
  const intro = h.send('roundIntro');
  assert.equal(h.show.scene, 'roundStart');
  assert.deepEqual(h.show.snapshot().intro && [h.show.snapshot().intro?.round, h.show.snapshot().intro?.kind], [2, 'normal']);
  assert.ok(!find(intro, 'intervalMusic'), 'the Interval music goes on');
  assert.deepEqual(rejected(h.send('next')), ['wrongScene'], 'no Queue before the Shuffle');
  const shuffle = h.send('newRound');
  assert.equal(h.show.round.number, 2);
  assert.ok(!find(shuffle, 'stopAll'), 'the music keeps playing under the Shuffle');
  assert.equal(emitted(shuffle, 'shuffle.scheduled')[0]?.round, 2);
  assert.deepEqual(h.show.claims, [], 'Claims belong to their round');
  assert.equal(h.show.winners.length, 2, 'Winners belong to the Game');
  assert.equal(h.show.snapshot().intro, null);
  h.send('next');
  h.advance(FLOW.shuffleSec + 0.1);
  assert.equal(h.show.scene, 'play');
  const start = find(h.log, 'startTransition');
  assert.ok(start);
  assert.ok(all(h.log, 'startTransition').at(-1)?.fromHoldMusic, 'the first song builds out of the Interval music');

  // Every step of it is in the journal, which replays to the show's own record.
  assert.deepEqual(replayJournal(journalOf(h.log)), h.show.record());
  const scenes = journalOf(h.log).flatMap((e) => (e.kind === 'scene.changed' ? [e.scene] : []));
  assert.deepEqual(scenes, ['play', 'check', 'celebration', 'play', 'check', 'celebration', 'interval', 'roundStart', 'play']);
});

test('an invalid Claim: the Failure fanfare, back to play in a Hold with the error Hold music until Resume', () => {
  const h = flow();
  landSongs(h, 3);
  h.send('claim', { cardId: loser.id });
  const [claim] = h.show.claims;
  assert.equal(claim.outcome, 'incomplete');
  finishCheck(h);
  const out = h.send('decide', { claimId: claim.claimId, valid: false });
  assert.deepEqual(sfxNames(out), [FLOW.failureFanfare]);
  assert.equal(h.show.scene, 'play');
  assert.equal(h.show.status, 'hold');
  assert.equal(h.show.hold?.reason, 'checkFailed');
  assert.equal(find(out, 'songToHoldMusic')?.mood, 'error', 'the ducked song washes out into the error Hold music');
  assert.equal(h.show.winners.length, 0);
  assert.deepEqual(journalOf(out).filter((e) => e.kind === 'claim.decided').map((e) => e.kind === 'claim.decided' && [e.verdict, e.winningSongId, e.position]), [['invalid', null, 2]]);
  // Resume: the next song builds out of the Hold music.
  const resume = h.send('hold', { on: false });
  assert.ok(find(resume, 'startTransition')?.fromHoldMusic);
  assert.equal(h.show.scene, 'play');
});

test('unknown cards and cards of the wrong type: the result at once, no snippets', () => {
  const h = flow();
  landSongs(h, 2);
  const out = h.send('claim', { cardId: 9999 });
  assert.equal(emitted(out, 'check.scheduled')[0]?.check.outcome, 'unknownCard');
  assert.ok(!find(out, 'checkSnippets'));
  assert.equal(h.show.claims[0].status, 'checked');
  // A second Claim waits until the first is decided, then starts by itself.
  h.send('claim', { cardId: specialCard.id });
  assert.equal(h.show.claims[1].status, 'queued');
  const next = h.send('decide', { claimId: 'cl-1', valid: false });
  assert.equal(emitted(next, 'check.scheduled')[0]?.check.outcome, 'wrongType');
  assert.equal(h.show.scene, 'check');
  h.send('decide', { claimId: 'cl-2', valid: false });
  assert.equal(h.show.scene, 'play');
  assert.deepEqual(rejected(h.send('claim', { cardId: 1, kind: 'line' })), [], 'claims go on');
  assert.deepEqual(rejected(h.send('decide', { claimId: 'cl-1', valid: true })), ['unknownClaim'], 'already decided');
  assert.deepEqual(rejected(h.send('decide', { claimId: 'nope', valid: true })), ['unknownClaim']);
});

test('claims during a Spin: cancelled like Hold; too close to its landing, the Check comes right after it', () => {
  const h = flow();
  landSongs(h, 1);
  h.send('next');
  const t = h.show.transition;
  assert.ok(t && t.T - h.clock.t > 1);
  const out = h.send('claim', { cardId: card.id });
  assert.deepEqual(emitted(out, 'transition.cancelled').map((e) => e.reason), ['hold']);
  assert.equal(h.show.hold?.reason, 'claim');
  assert.equal(h.show.position, 0);
  assert.equal(h.show.scene, 'check');
  assert.ok(h.show.check, 'its Check starts at once');

  const k = flow(5);
  landSongs(k, 1);
  k.send('next');
  const t2 = k.show.transition;
  assert.ok(t2);
  k.advance(t2.T - k.clock.t - 0.1);
  const late = k.send('claim', { cardId: card.id });
  assert.ok(!find(late, 'cancelTransition'), 'too close: it lands');
  assert.equal(k.show.scene, 'check');
  assert.equal(k.show.check, null, 'the Check waits for the landing');
  k.advance(0.2);
  assert.equal(k.show.position, 1);
  assert.equal(k.show.status, 'hold');
  assert.equal(k.show.hold?.reason, 'claim');
  assert.deepEqual(live(k).check?.info.steps.filter((s) => s.landed).map((s) => s.songId), rows[0].slice(0, 2), 'with the song that just landed');

  // A Suspense too.
  const s = flow(7);
  landSongs(s, 1);
  s.send('suspense');
  assert.ok(s.show.suspense);
  const held = s.send('claim', { cardId: card.id });
  assert.deepEqual(emitted(held, 'transition.cancelled').map((e) => e.reason), ['hold']);
  assert.equal(s.show.suspense, null);
  assert.equal(s.show.scene, 'check');
});

test('several Claims: queued in order, re-ordered by checkStart, sharing the prize; a late invalid one keeps the Celebration', () => {
  const h = flow();
  landSongs(h, 4);
  // Another card in play with the same top row completes on the same landing.
  const twin = allCards.find((c) => c.type === 'normal' && c.id !== card.id && c.id <= 200 && cardSongIds(c).some((row) => row.every((id) => QUEUE.slice(0, 4).includes(id))));
  h.send('claim', { cardId: card.id });
  h.send('claim', { cardId: loser.id });
  if (twin) h.send('claim', { cardId: twin.id });
  assert.deepEqual(h.show.claims.map((c) => c.status), twin ? ['checking', 'queued', 'queued'] : ['checking', 'queued']);
  // Check the loser first.
  h.send('checkStart', { claimId: 'cl-2' });
  assert.deepEqual(h.show.claims.slice(0, 2).map((c) => c.status), ['queued', 'checking'], 'the interrupted Check goes back to the queue');
  assert.ok(find(h.log, 'cancelCheck'));
  h.send('decide', { claimId: 'cl-2', valid: false });
  assert.equal(h.show.check?.info.claimId, 'cl-1', 'the next queued Claim starts by itself');
  h.send('decide', { claimId: 'cl-1', valid: true });
  if (twin) {
    assert.equal(h.show.scene, 'check', 'every Claim is decided before the round moves on');
    h.send('decide', { claimId: 'cl-3', valid: true });
    assert.deepEqual(h.show.celebration?.cardIds, [card.id, twin.id], 'claims on the same landing share the prize');
  }
  assert.equal(h.show.scene, 'celebration');
  const before = h.show.celebration;
  // A late Claim during the Celebration that is not valid: the Celebration comes back, music untouched.
  const late = h.send('claim', { cardId: loser.id + 1 });
  assert.equal(h.show.scene, 'check');
  assert.equal(h.show.celebration, null);
  assert.ok(!find(late, 'celebrationMusic'));
  const out = h.send('decide', { claimId: lastClaimId(h), valid: false });
  assert.equal(h.show.scene, 'celebration');
  assert.deepEqual(live(h).celebration?.cardIds, before?.cardIds);
  assert.ok(!find(out, 'celebrationMusic') && !find(out, 'holdMusic'));
});

test('Back during a Check undoes the landing; undecided Claims survive and wait to be checked again', () => {
  const h = flow();
  landSongs(h, 4);
  h.send('claim', { cardId: card.id });
  assert.equal(h.show.claims[0].outcome, 'complete');
  const out = h.send('back');
  assert.equal(h.show.position, 2);
  assert.ok(find(out, 'cancelCheck'));
  assert.equal(h.show.scene, 'check');
  assert.deepEqual(h.show.claims.map((c) => [c.status, c.outcome]), [['queued', null]]);
  assert.equal(h.show.check, null);
  h.send('checkStart', { claimId: 'cl-1' });
  assert.equal(h.show.claims[0].outcome, 'incomplete', 'the Check sees the landings now');
  assert.deepEqual(rejected(h.send('next')), ['wrongScene']);
  assert.deepEqual(rejected(h.send('hold', { on: false })), ['wrongScene'], 'Resume comes after the verdict');
});

test('the Celebration music changes without blocking anything; Hold music in the Celebration is a choice', () => {
  const h = flow();
  landSongs(h, 4);
  h.send('claim', { cardId: card.id });
  h.send('decide', { claimId: 'cl-1', valid: true });
  const victory = h.send('celebrationMusic', { choice: 'victory' });
  assert.equal(find(victory, 'celebrationMusic')?.choice, 'victory');
  assert.equal(h.show.celebration?.music, 'victory');
  assert.equal(h.show.bed, 'victory');
  h.send('celebrationMusic', { choice: 'holdMusic' });
  assert.equal(h.show.holdMusic, true);
  assert.equal(h.show.bed, null);
  assert.deepEqual(rejected(h.send('holdMusic')), ['wrongScene']);
  assert.deepEqual(rejected(h.send('interval')), ['wrongScene'], 'only after a Bingo');
  // Releasing the Hold of a Line's Celebration goes back to the round, like Next.
  const back = h.send('hold', { on: false });
  assert.ok(find(back, 'startTransition')?.fromHoldMusic);
  assert.equal(h.show.scene, 'play');
});

test('the technical pause: Hold music, a running Check queued again, only safe commands; off brings the scene back', () => {
  const h = flow();
  landSongs(h, 2);
  h.send('next');
  const on = h.send('pause');
  assert.ok(h.show.pause);
  assert.deepEqual(find(on, 'pauseOverlay'), { type: 'pauseOverlay', on: true });
  assert.deepEqual(emitted(on, 'transition.cancelled').map((e) => e.reason), ['hold']);
  assert.equal(h.show.status, 'hold');
  assert.ok(find(on, 'songToHoldMusic') || find(on, 'holdMusic'), 'Hold music while paused');
  assert.deepEqual(rejected(h.send('next')), ['wrongScene']);
  assert.deepEqual(rejected(h.send('claim', { cardId: card.id })), ['wrongScene']);
  assert.deepEqual(rejected(h.send('setPace', { delta: 1 })), []);
  const off = h.send('pause', { on: false });
  assert.deepEqual(find(off, 'pauseOverlay'), { type: 'pauseOverlay', on: false });
  assert.equal(h.show.status, 'hold', 'in play, the Hold stays until Resume');
  assert.ok(find(h.send('next'), 'startTransition'));

  // In a Check: the running Check stops; after the pause it starts again by itself.
  const c = flow(9);
  landSongs(c, 4);
  c.send('claim', { cardId: card.id });
  const paused = c.send('pause', { on: true });
  assert.ok(find(paused, 'cancelCheck'));
  assert.equal(c.show.claims[0].status, 'queued');
  assert.deepEqual(rejected(c.send('decide', { claimId: 'cl-1', valid: true })), ['wrongScene']);
  const resumed = c.send('pause', { on: false });
  assert.ok(find(resumed, 'checkSnippets'));
  assert.equal(c.show.claims[0].status, 'checking');

  // In a Celebration: Hold music meanwhile, then its own music again; the auto Interval waits.
  c.send('decide', { claimId: 'cl-1', valid: true });
  const celebrationPause = c.send('pause');
  assert.equal(find(celebrationPause, 'holdMusic')?.switch, true, 'the Celebration music gives way to Hold music');
  const back = c.send('pause');
  assert.equal(find(back, 'celebrationMusic')?.choice, 'winningSong');
});

test('endGame ends anywhere: closing music in `after`; a new round can still be introduced', () => {
  const h = flow();
  landSongs(h, 2);
  h.send('next');
  const out = h.send('endGame');
  assert.equal(h.show.scene, 'after');
  assert.ok(find(out, 'cancelTransition'));
  assert.ok(find(out, 'intervalMusic'));
  assert.equal(h.show.status, 'hold');
  assert.deepEqual(rejected(h.send('next')), ['wrongScene']);
  assert.deepEqual(rejected(h.send('roundIntro', { number: 4, kind: 'special' })), []);
  assert.equal(h.show.scene, 'roundStart');
  assert.deepEqual(h.show.intro && [h.show.intro.round, h.show.intro.kind], [4, 'special']);
  h.send('newRound');
  assert.equal(h.show.round.number, 4);
  assert.equal(h.show.round.kind, 'special');
});

test('fuzz: random show-flow commands never break the invariants, and the journal always replays to the show', () => {
  const scenes = new Set<ShowScene>();
  const kinds = new Set<string>();
  for (let seed = 1; seed <= 6; seed++) {
    const h = setup({ seed, cards: allCards, cardsInPlay: '1-200, 400-450', fixedQueue: seed % 2 ? QUEUE : null, settings: { autoAdvance: seed % 3 !== 0 } });
    h.send('unlock');
    let rnd = seed * 7919;
    const pick = <T>(list: readonly T[]): T => list[(rnd = (rnd * 48271) % 2147483647) % list.length];
    const claimId = () => pick([...h.show.claims.map((c) => c.claimId), 'cl-99']);
    const commands = [
      () => h.send('next'), () => h.send('next'), () => h.send('next'), () => h.send('back'), () => h.send('hold'),
      () => h.send('hold', { on: false }), () => h.send('holdMusic'), () => h.send('suspense'),
      () => h.send('claim', { cardId: pick([card.id, loser.id, 9999, 410]) }), () => h.send('claim', { cardId: card.id, kind: pick(['line', 'bingo'] as const) }),
      () => h.send('checkStart', { claimId: claimId() }), () => h.send('decide', { claimId: claimId(), valid: pick([true, false]) }),
      () => h.send('decide', { claimId: claimId(), valid: true }),
      () => h.send('winnerInfo', { claimId: claimId(), name: pick(['', 'Pep']) }),
      () => h.send('celebrationMusic', { choice: pick(['winningSong', 'victory', 'holdMusic'] as const) }),
      () => h.send('interval'), () => h.send('roundIntro'), () => h.send('newRound'), () => h.send('pause'), () => h.send('confirmLine'),
      () => h.send('endGame'),
    ];
    for (let step = 0; step < 150; step++) {
      // endGame is rare, so a Game gets far.
      const command = step % 50 === 49 ? commands[commands.length - 1] : pick(commands.slice(0, -1));
      command();
      h.advance((rnd % 1000) / 100);
      const s = h.show;
      const where = `seed ${seed} step ${step}: ${s.scene} ${s.status}`;
      assert.ok(['idle', 'playing', 'transition', 'hold'].includes(s.status), where);
      if (s.status === 'hold') assert.ok(s.current || s.holdMusic || s.bed, `${where}: hold in silence`);
      if (s.status === 'playing') assert.ok(s.current && (s.scene === 'play' || s.scene === 'before'), `${where}: a song plays outside the round`);
      if (s.status === 'transition') assert.ok((s.transition || s.suspense) && ['play', 'check'].includes(s.scene), where);
      if (s.scene === 'check') assert.ok(s.claims.some((c) => c.status !== 'valid' && c.status !== 'invalid') || s.status === 'transition' || s.pause, `${where}: a Check with nothing to decide`);
      if (s.scene === 'celebration') assert.ok(s.celebration && s.celebration.cardIds.length > 0, where);
      if (s.check) assert.ok(s.claims.some((c) => c.claimId === s.check?.info.claimId && (c.status === 'checking' || c.status === 'checked')), where);
      assert.deepEqual(replayJournal(journalOf(h.log)), s.record(), `${where}: the journal replays to the show`);
      scenes.add(s.scene);
    }
    for (const entry of journalOf(h.log)) kinds.add(entry.kind);
  }
  assert.deepEqual([...scenes].sort(), ['after', 'before', 'celebration', 'check', 'interval', 'play', 'roundStart'], 'the fuzz reaches every scene');
  for (const kind of ['scene.changed', 'claim.opened', 'claim.decided', 'winner.noted', 'line.confirmed']) assert.ok(kinds.has(kind), `the fuzz journals ${kind}`);
});

test('Hold music under a Check is far down; the duck covers the Check from its first step to its result', () => {
  const h = flow();
  landSongs(h, 4);
  const out = h.send('claim', { cardId: card.id });
  const snippets = find(out, 'checkSnippets');
  assert.ok(snippets);
  assert.ok(snippets.duckDb <= HOLD.duckDb - 15, `${snippets.duckDb} dB under the Check`);
  assert.equal(snippets.steps[0].at, snippets.startAt + FLOW.check.leadSec);
  assert.equal(h.show.check?.endAt, snippets.endAt);
});

test("the Celebration's Winning-song loop: whole bars from the hook it landed on (else its best), on its own grid", () => {
  for (const analysis of analyses.values()) {
    const best = bestHook(analysis);
    assert.ok(best && best.valid, `song ${analysis.songId} has a valid hook`);
    for (const hook of analysis.hooks.filter((h) => h.valid)) {
      const loop = hookLoop(analysis, hook.id, { bars: FLOW.celebration.loopBars, minBars: FLOW.celebration.loopMinBars });
      if (!loop) {
        assert.ok(analysis.downbeats.length - 1 - hook.downbeatIndex < FLOW.celebration.loopMinBars, 'only too near the end');
        continue;
      }
      assert.equal(loop.hookId, hook.id);
      assert.equal(loop.loopStartSec, analysis.downbeats[hook.downbeatIndex]);
      assert.equal(loop.loopEndSec, analysis.downbeats[hook.downbeatIndex + loop.bars], 'it ends on a downbeat: whole bars');
      assert.ok(loop.bars >= FLOW.celebration.loopMinBars && loop.bars <= FLOW.celebration.loopBars);
      assert.equal(loop.startSec, Math.max(0, loop.loopStartSec - (hook.pickupSec || 0)), 'it starts on the pickup');
    }
    assert.equal(hookLoop(analysis, 'no-such-hook', { bars: 4, minBars: 2 })?.hookId ?? best.id, best.id, 'an unknown hook falls back to the best one');
  }
});

test('the Celebration music can be picked during the Check; the pick is in the state, used once, and dropped by a failed Check', () => {
  const h = flow();
  landSongs(h, 4);
  h.send('claim', { cardId: card.id });
  assert.equal(h.show.scene, 'check');
  assert.deepEqual(rejected(h.send('celebrationMusic', { choice: 'victory' })), []);
  assert.equal(h.show.snapshot().celebrationChoice, 'victory');
  finishCheck(h);
  const decided = h.send('decide', { claimId: 'cl-1', valid: true });
  const [celebration] = emitted(decided, 'celebration.started');
  assert.equal(celebration.celebration.music, 'victory', 'the pick, not the Line default (the winning song)');
  assert.equal(find(decided, 'celebrationMusic')?.choice, 'victory');
  assert.equal(h.show.snapshot().celebrationChoice, null, 'used once');

  // A pick during a Check that fails is dropped.
  const g = flow(5);
  landSongs(g, 2);
  g.send('claim', { cardId: card.id });
  g.send('celebrationMusic', { choice: 'holdMusic' });
  finishCheck(g);
  g.send('decide', { claimId: 'cl-1', valid: false });
  assert.equal(g.show.snapshot().celebrationChoice, null);
});
