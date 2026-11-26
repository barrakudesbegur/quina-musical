// The show flow (docs/protocol.md › Scenes): the scene rules, Claims and their presenter-paced Checks, the
// Celebration, the Interval, Pausa, and how they ride on the show state machine. Fake clock, real analysis data,
// real cards.
import { HAS_DATA, NO_CARD, dataTest as test } from './support/data.ts';
import assert from 'node:assert/strict';
import { COMMAND_NAMES, VOLUME_DEFAULTS, checkGamePlan, replayJournal, volumeDb, type CommandName, type EventOf, type JournalEntry, type ShowEvent, type ShowEventType, type ShowScene } from '@quina/protocol';
import { sceneAllows, type SceneContext } from '@quina/protocol';
import { FLOW, THROW } from '../engine/src/config.ts';
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


/** The show, read afresh (an earlier assert must not narrow what a later command changed). */
const live = (h: Harness) => h.show;

const lastClaimId = (h: Harness) => {
  const claim = h.show.claims.at(-1);
  assert.ok(claim);
  return claim.claimId;
};

// ---------------------------------------------------------------------------------------- the scene rules
test('the scene rules: what each scene accepts (the agreed table, plus `before` acting as `play`)', () => {
  const ANY: CommandName[] = ['unlock', 'getState', 'getJournal', 'getUpcoming', 'setPace', 'setGame', 'setVolume', 'setCardsInPlay', 'sfx', 'overrideNextRecipe', 'panic', 'pause', 'endGame', 'winnerInfo', 'revealPrizes'];
  const PLAY: CommandName[] = ['next', 'back', 'hold', 'holdMusic', 'suspense', 'confirmLine', 'newRound'];
  const CHECK: CommandName[] = ['checkStart', 'checkNext', 'checkBack', 'checkAuto', 'checkReview', 'reviewEnd'];
  const cases: [string, Partial<SceneContext> & { scene: ShowScene }, CommandName[]][] = [
    ['before', { scene: 'before' }, [...PLAY, 'roundIntro', 'resumeAt', 'throw']],
    // A round's intro plays its intro track, not a set (D129).
    ['roundStart, introduced', { scene: 'roundStart', introduced: true }, ['newRound']],
    ['roundStart, shuffled', { scene: 'roundStart' }, ['next', 'newRound']],
    ['play', { scene: 'play' }, [...PLAY, 'claim', 'finale', 'finaleCue']],
    // The corn-seed storm in the night's last round too (D155).
    ['play, the last round', { scene: 'play', lastRound: true }, [...PLAY, 'claim', 'finale', 'finaleCue', 'storm']],
    // Parlem on a review's screen (D118); during the reveals the −/+ hold means review.
    ['check, under review', { scene: 'check', reviewing: true }, ['back', 'holdMusic', 'claim', ...CHECK, 'celebrationMusic', 'hold']],
    ['check, the last round', { scene: 'check', lastRound: true }, ['back', 'holdMusic', 'claim', ...CHECK, 'celebrationMusic', 'storm']],
    ['interval after the last round', { scene: 'interval', lastRound: true }, ['newRound', 'roundIntro', 'resumeAt', 'intervalSkip', 'throw']],
    ['check', { scene: 'check' }, ['back', 'holdMusic', 'claim', ...CHECK, 'celebrationMusic']],
    // Parlem in every Celebration (D117).
    ['celebration (Line)', { scene: 'celebration', celebrating: 'line' }, ['next', 'hold', 'confirmLine', 'newRound', 'claim', 'celebrationMusic']],
    ['celebration (Bingo)', { scene: 'celebration', celebrating: 'bingo' }, ['hold', 'confirmLine', 'newRound', 'roundIntro', 'claim', 'celebrationMusic', 'interval']],
    ['interval', { scene: 'interval' }, ['newRound', 'roundIntro', 'resumeAt', 'intervalSkip', 'throw']],
    ['after', { scene: 'after' }, ['newRound', 'roundIntro', 'resumeAt', 'intervalSkip', 'storm']],
    ['roundStart with a set still on', { scene: 'roundStart', intervalMusic: true }, ['next', 'newRound', 'intervalSkip']],
    ['play with the breaks\' set still on', { scene: 'play', intervalMusic: true }, [...PLAY, 'claim', 'finale', 'finaleCue', 'intervalSkip']],
    // Pausa (D128): Next ends it with a transition; the Pausa set can be skipped.
    ['paused in play', { scene: 'play', paused: true }, ['next', 'intervalSkip']],
    ['paused in a Check', { scene: 'check', paused: true }, ['intervalSkip']],
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
  assert.deepEqual(rejected(h.send('checkNext', { claimId: 'cl-1', step: 0 })), ['wrongScene']);
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
test('a whole round: Line claimed, revealed press by press, cued and celebrated; back to play; Bingo; Interval; the next round', () => {
  const h = flow();
  landSongs(h, 4);
  const winningSong = QUEUE[3];
  assert.equal(h.show.current?.songId, winningSong);

  // The Claim: Hold (reason claim), scene check, its Check on screen with nothing revealed (D107).
  const claimOut = h.send('claim', { cardId: card.id });
  assert.equal(h.show.scene, 'check');
  assert.equal(h.show.status, 'hold');
  assert.equal(h.show.hold?.reason, 'claim');
  const [opened] = emitted(claimOut, 'claim.opened');
  assert.deepEqual({ ...opened.claim, atMs: 0, markedCard: [] }, {
    claimId: 'cl-1', round: 1, cardId: card.id, kind: 'line', atMs: 0, position: 3, status: 'queued', outcome: 'complete', completeSince: 3, warnings: [],
    markedCard: [], revealUntil: 3, cueNext: false,
  });
  // The console sees the whole card marked from the claim on (D108): its top row landed.
  assert.deepEqual(opened.claim.markedCard.filter((s) => s.landed).map((s) => s.songId).sort(), [...rows[0]].sort());
  const [started] = emitted(claimOut, 'check.started');
  assert.deepEqual([started.check.outcome, started.check.row, started.check.total, started.check.revealed, started.check.cue, started.check.reviewing], ['complete', 0, 4, [], null, false]);
  assert.ok(!find(claimOut, 'checkReveal') && !find(claimOut, 'checkDuck'), 'nothing sounds before a press: the music stays at the claim\'s level');
  const claim = h.show.claims[0];
  assert.equal(claim.status, 'checking');

  // Each press reveals the next song of the row; the music goes far down from the first one.
  const first = h.send('checkNext', { claimId: 'cl-1', step: 0 });
  assert.deepEqual(find(first, 'checkDuck'), { type: 'checkDuck', on: true });
  const reveal = find(first, 'checkReveal');
  assert.ok(reveal);
  assert.deepEqual([reveal.step.songId, reveal.step.sound, reveal.step.durationSec], [rows[0][0], 'snippet', FLOW.check.stepSec]);
  const [revealed] = emitted(first, 'check.revealed');
  assert.equal(revealed.index, 0);
  assert.equal(revealed.step.atMs, h.env.toEpochMs(reveal.step.at), 'the projector and the audio share the time');
  // Two consoles and the Wii pressing at once reveal once.
  assert.deepEqual(h.send('checkNext', { claimId: 'cl-1', step: 0 }).filter((e) => e.type === 'checkReveal' || e.type === 'reject'), []);
  for (let k = 1; k < 4; k++) h.send('checkNext', { claimId: 'cl-1', step: k });
  assert.equal(h.show.check?.info.revealed.length, 4);
  assert.equal(h.show.claims[0].cueNext, true, 'every song revealed: the next press is the cue');
  assert.equal(h.show.scene, 'check', 'a pass waits for the presenters\' cue');

  // The cue: valid, a Winner, the Line confirmed, the Celebration with the Clear fanfare and the Winning song looped.
  const hookId = h.show.current?.hookId;
  const decided = h.send('checkNext', { claimId: 'cl-1', step: 4 });
  assert.deepEqual(emitted(decided, 'check.cue').map((e) => [e.claimId, e.cue, e.manual ?? false]), [['cl-1', 'pass', false]]);
  assert.deepEqual(emitted(decided, 'claim.decided').map((e) => [e.claimId, e.verdict]), [['cl-1', 'valid']]);
  assert.equal(h.show.round.lineConfirmed, true);
  assert.equal(h.show.phaseModel.kind, 'bingo');
  assert.equal(h.show.scene, 'celebration');
  assert.equal(h.show.check, null);
  assert.deepEqual(h.show.winners.map((w) => [w.claimId, w.kind, w.cardId, w.winningSongId, w.position, w.name]), [['cl-1', 'line', card.id, winningSong, 3, null]]);
  const [celebration] = emitted(decided, 'celebration.started');
  assert.deepEqual({ ...celebration.celebration, sinceMs: 0 }, { kind: 'line', round: 1, cardIds: [card.id], winningSongId: winningSong, sinceMs: 0, music: 'winningSong', parlem: false });
  assert.deepEqual(sfxNames(decided), [FLOW.celebration.fanfare, FLOW.celebration.impact]);
  assert.ok(all(decided, 'sfx').every((e) => e.volume === 'winFx'), 'on the win\'s slider');
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

  // The Bingo: the default kind is now the Bingo; all 12 songs are revealed.
  const bingo = h.send('claim', { cardId: card.id });
  const [bingoCheck] = emitted(bingo, 'check.started');
  assert.deepEqual([bingoCheck.check.kind, bingoCheck.check.row, bingoCheck.check.total], ['bingo', null, 12]);
  assert.equal(h.show.claims[1].completeSince, 13);
  const won = h.pressCue('cl-2');
  assert.equal(h.show.scene, 'celebration');
  assert.equal(live(h).celebration?.kind, 'bingo');
  assert.equal(find(won, 'celebrationMusic')?.choice, 'victory');
  assert.deepEqual(rejected(h.send('next')), ['wrongScene'], 'the round is over');

  // The Interval comes by itself after a while (the victory track flows into the breaks' set).
  h.advance(FLOW.celebration.toIntervalSec - 1);
  assert.equal(h.show.scene, 'celebration');
  const later = h.advance(1.1);
  assert.equal(h.show.scene, 'interval');
  assert.equal(find(later, 'intervalMusic')?.set, 'breaks');
  assert.equal(h.show.interval?.nextRound, 2);
  assert.equal(h.show.interval?.guideEndMs, (h.show.interval?.sinceMs ?? 0) + FLOW.intervalGuideSec * 1000);

  // Rounds start by hand: the intro with its own track (D129), then the Shuffle under it, then play.
  const intro = h.send('roundIntro');
  assert.equal(h.show.scene, 'roundStart');
  assert.deepEqual(h.show.snapshot().intro && [h.show.snapshot().intro?.round, h.show.snapshot().intro?.kind], [2, 'normal']);
  assert.ok(find(intro, 'introMusic') && !find(intro, 'intervalMusic'), 'the intro track takes over');
  assert.equal(h.show.bed, 'intro');
  assert.deepEqual(rejected(h.send('next')), ['wrongScene'], 'no Queue before the Shuffle');
  const shuffle = h.send('newRound');
  assert.equal(h.show.round.number, 2);
  assert.ok(!find(shuffle, 'stopAll') && !find(shuffle, 'introMusic'), 'the intro track keeps playing under the Shuffle');
  assert.equal(emitted(shuffle, 'shuffle.scheduled')[0]?.round, 2);
  assert.deepEqual(h.show.claims, [], 'Claims belong to their round');
  assert.equal(h.show.winners.length, 2, 'Winners belong to the Game');
  assert.equal(h.show.snapshot().intro, null);
  h.send('next');
  h.advance(FLOW.shuffleSec + 0.1);
  assert.equal(h.show.scene, 'play');
  assert.ok(all(h.log, 'startTransition').at(-1)?.fromHoldMusic, 'the first song builds out of the intro track');

  // Every step of it is in the journal, which replays to the show's own record.
  assert.deepEqual(replayJournal(journalOf(h.log)), h.show.record());
  const scenes = journalOf(h.log).flatMap((e) => (e.kind === 'scene.changed' ? [e.scene] : []));
  assert.deepEqual(scenes, ['play', 'check', 'celebration', 'play', 'check', 'celebration', 'interval', 'roundStart', 'play']);
});

test('an invalid Claim: its reveals stop at the first ✗, its cue is the fail moment, back to play in a Hold with the error Hold music', () => {
  const h = flow();
  landSongs(h, 3);
  h.send('claim', { cardId: loser.id });
  const [claim] = h.show.claims;
  assert.equal(claim.outcome, 'incomplete');
  const until = claim.revealUntil;
  assert.ok(until != null && until < 4);
  const out = h.pressCue(claim.claimId);
  assert.equal(emitted(out, 'check.revealed').length, until + 1, 'no reveal after the first ✗');
  assert.equal(all(out, 'checkReveal').at(-1)?.step.sound, 'miss', 'the broken record');
  assert.deepEqual(emitted(out, 'check.cue').map((e) => e.cue), ['fail']);
  assert.deepEqual(sfxNames(out), [FLOW.failureFanfare]);
  assert.equal(all(out, 'sfx')[0]?.volume, 'failFx');
  assert.equal(h.show.scene, 'check', 'its ✗ shows for a moment, as between two cards');
  assert.equal(h.show.check?.info.cue, 'fail');
  const back = h.advance(FLOW.check.nextCardSec + 0.1);
  assert.equal(h.show.scene, 'play');
  assert.equal(h.show.status, 'hold');
  assert.equal(h.show.hold?.reason, 'checkFailed');
  assert.equal(find(back, 'songToHoldMusic')?.mood, 'error', 'the ducked song washes out into the error Hold music');
  assert.equal(h.show.winners.length, 0);
  assert.deepEqual(journalOf(out).filter((e) => e.kind === 'claim.decided').map((e) => e.kind === 'claim.decided' && [e.verdict, e.winningSongId, e.position, e.manual ?? false]), [['invalid', null, 2, false]]);
  // Resume: the next song builds out of the Hold music.
  const resume = h.send('hold', { on: false });
  assert.ok(find(resume, 'startTransition')?.fromHoldMusic);
  assert.equal(h.show.scene, 'play');
});

test('the Check decides: the cue makes a pass valid and a fail invalid; only a Review decides against the card, marked manual', () => {
  const h = flow();
  landSongs(h, 2);
  // Nothing complete yet: the cue fails it.
  h.send('claim', { cardId: card.id });
  h.pressCue(lastClaimId(h));
  assert.equal(h.show.claims.at(-1)?.status, 'invalid');
  assert.equal(h.show.winners.length, 0);
  // A card of another type: nothing to reveal, the first press is its fail cue.
  h.send('claim', { cardId: specialCard.id });
  const wrong = lastClaimId(h);
  assert.deepEqual([h.show.check?.info.total, h.show.claims.at(-1)?.cueNext, h.show.claims.at(-1)?.outcome], [0, true, 'wrongType']);
  assert.deepEqual(emitted(h.send('checkNext', { claimId: wrong, step: 0 }), 'check.cue').map((e) => e.cue), ['fail']);
  // A number that isn't printed is refused privately (D126): no Claim, nothing journaled, the whole claim.
  const seq = h.show.journalSeq;
  assert.deepEqual(rejected(h.send('claim', { cardId: 9999 })), ['unknownCard']);
  const refused = h.send('claim', { cardIds: [card.id, 9999, 1204] }).find((e) => e.type === 'reject');
  assert.ok(refused?.type === 'reject' && refused.reason === 'unknownCard' && refused.detail === '9999,1204', 'the unknown numbers, for the claim pad');
  assert.equal(h.show.claims.length, 2);
  assert.equal(h.show.journalSeq, seq);
  // Complete after 4 landings, but lost by hand from a Review: the PRIVATE warning says it would have passed.
  h.advance(FLOW.check.nextCardSec + 0.1);
  landSongs(h, 2);
  h.send('claim', { cardId: card.id });
  const id = lastClaimId(h);
  const review = h.send('checkReview', { claimId: id });
  assert.deepEqual(journalOf(review).map((e) => e.kind), ['claim.reviewing']);
  assert.deepEqual(emitted(review, 'check.reviewing').map((e) => e.claimId), [id]);
  assert.equal(h.show.check?.info.reviewing, true, 'the projector shows "Revisió manual" (D123)');
  assert.equal(h.show.claims.at(-1)?.status, 'reviewing');
  assert.deepEqual(h.send('checkNext', { claimId: id, step: 0 }).filter((e) => e.type === 'checkReveal'), [], 'presses wait during a review');
  assert.deepEqual(rejected(h.send('endGame')), ['claimOpen'], 'the round waits for the Review');
  const lost = h.send('reviewEnd', { claimId: id, outcome: 'lose' });
  assert.deepEqual(emitted(lost, 'check.cue').map((e) => [e.cue, e.manual]), [['fail', true]]);
  const entry = journalOf(lost).find((e) => e.kind === 'claim.decided');
  assert.ok(entry?.kind === 'claim.decided' && entry.verdict === 'invalid' && entry.manual === true);
  assert.ok(h.show.claims.at(-1)?.warnings.includes('wouldPass'));
  // And one that doesn't pass, won by hand: the plan B (D121).
  h.send('claim', { cardId: loser.id });
  const plan = lastClaimId(h);
  h.send('checkReview', { claimId: plan });
  const forced = h.send('reviewEnd', { claimId: plan, outcome: 'win' });
  assert.deepEqual(emitted(forced, 'check.cue').map((e) => [e.cue, e.manual]), [['pass', true]]);
  assert.ok(h.show.claims.at(-1)?.warnings.includes('notPassing'));
  assert.equal(h.show.scene, 'celebration');
  assert.deepEqual(h.show.winners.map((w) => w.cardId), [loser.id]);
  assert.deepEqual(replayJournal(journalOf(h.log)), h.show.record());
});

test('several cards in one claim: each in turn, the next on screen by itself after a cue, its first reveal waiting for a press', () => {
  const h = flow();
  landSongs(h, 2);
  const out = h.send('claim', { cardIds: [specialCard.id, loser.id] });
  const [first] = emitted(out, 'check.started');
  assert.deepEqual([first.check.claimId, first.check.outcome, first.check.cardType, first.check.total], ['cl-1', 'wrongType', 'especial', 0], 'the card\'s printed type is its first step');
  assert.equal(h.show.claims[1].status, 'queued');
  const cue = h.send('checkNext', { claimId: 'cl-1', step: 0 });
  assert.deepEqual(emitted(cue, 'check.cue').map((e) => e.cue), ['fail']);
  assert.deepEqual(sfxNames(cue), [FLOW.failureFanfare]);
  assert.equal(h.show.scene, 'check');
  assert.equal(h.show.check?.info.claimId, 'cl-1', 'its cue shows for a moment');
  h.advance(FLOW.check.nextCardSec + 0.1);
  assert.equal(h.show.check?.info.claimId, 'cl-2');
  assert.deepEqual(h.show.check?.info.revealed, []);
  // Auto on doesn't make the first reveal of a card that came on screen by itself (D117).
  h.send('checkAuto', { on: true });
  h.send('checkAuto', { on: false });
  h.pressCue('cl-2');
  h.advance(FLOW.check.nextCardSec + 0.1);
  assert.equal(h.show.scene, 'play');
  assert.equal(h.show.hold?.reason, 'checkFailed');
  assert.deepEqual(rejected(h.send('claim', { cardId: 1, kind: 'line' })), [], 'claims go on');
  assert.deepEqual(rejected(h.send('checkReview', { claimId: 'cl-1' })), ['unknownClaim'], 'already decided');
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
  assert.deepEqual(live(k).claims[0].markedCard.filter((s) => s.landed).map((s) => s.songId).sort(), rows[0].slice(0, 2).sort(), 'with the song that just landed');

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
  h.send('claim', { cardIds: [card.id, loser.id, ...(twin ? [twin.id] : [])] });
  assert.deepEqual(h.show.claims.map((c) => c.status), twin ? ['checking', 'queued', 'queued'] : ['checking', 'queued']);
  h.send('checkNext', { claimId: 'cl-1', step: 0 });
  // Check the loser first: the interrupted Check goes back to the queue, its reveals undone.
  h.send('checkStart', { claimId: 'cl-2' });
  assert.deepEqual(h.show.claims.slice(0, 2).map((c) => c.status), ['queued', 'checking'], 'the interrupted Check goes back to the queue');
  assert.ok(find(h.log, 'cancelCheck'));
  h.pressCue('cl-2');
  assert.equal(h.show.claims[1].status, 'invalid');
  h.advance(FLOW.check.nextCardSec + 0.1);
  assert.equal(h.show.check?.info.claimId, 'cl-1', 'the next queued Claim comes on screen by itself');
  assert.deepEqual(h.show.check?.info.revealed, [], 'from the start');
  const pass = h.pressCue('cl-1');
  if (twin) {
    // A pass that isn't the last card: its plaque, no fanfare (D110); every Claim is decided before the round moves on.
    assert.deepEqual(sfxNames(pass), []);
    assert.equal(h.show.scene, 'check');
    h.advance(FLOW.check.nextCardSec + 0.1);
    h.pressCue('cl-3');
    assert.deepEqual(h.show.celebration?.cardIds, [card.id, twin.id], 'claims on the same landing share the prize');
  }
  assert.equal(h.show.scene, 'celebration');
  const before = h.show.celebration;
  // A late Claim during the Celebration that is not valid: the Celebration comes back, music untouched.
  const late = h.send('claim', { cardId: loser.id + 1 });
  assert.equal(h.show.scene, 'check');
  assert.equal(h.show.celebration, null);
  assert.ok(!find(late, 'celebrationMusic'));
  const out = [...h.pressCue(lastClaimId(h)), ...h.advance(FLOW.check.nextCardSec + 0.1)];
  assert.equal(h.show.scene, 'celebration');
  assert.deepEqual(live(h).celebration?.cardIds, before?.cardIds);
  assert.ok(!find(out, 'celebrationMusic') && !find(out, 'holdMusic'));
});

test('the last card fails after an earlier one passed: the shared Celebration waits for one more press (celebrationNext)', () => {
  const h = flow();
  landSongs(h, 4);
  h.send('claim', { cardIds: [card.id, loser.id] });
  h.pressCue('cl-1');
  h.advance(FLOW.check.nextCardSec + 0.1);
  const fail = h.pressCue('cl-2');
  assert.deepEqual(emitted(fail, 'check.cue').map((e) => e.cue), ['fail']);
  assert.equal(h.show.scene, 'check');
  const cn = h.show.celebrationNext;
  assert.deepEqual(cn, { claimId: 'cl-2', step: (h.show.check?.info.revealed.length ?? 0) + 1 });
  assert.deepEqual(h.show.snapshot().celebrationNext, cn);
  assert.ok(cn);
  h.advance(5);
  assert.equal(h.show.scene, 'check', 'never by itself');
  h.send('checkNext', { claimId: 'cl-2', step: cn.step - 1 });
  assert.equal(h.show.scene, 'check', 'only its own press');
  const go = h.send('checkNext', cn);
  assert.equal(h.show.scene, 'celebration');
  assert.deepEqual(sfxNames(go), [FLOW.celebration.fanfare, FLOW.celebration.impact]);
  assert.deepEqual(h.show.celebration?.cardIds, [card.id]);
});

test('the songs still to come (D162, D170): only when the tablet asks, in the Queue\'s order, never in the state', () => {
  const h = flow();
  landSongs(h, 3);
  const [answer] = emitted(h.send('getUpcoming'), 'upcoming');
  assert.ok(answer);
  assert.deepEqual([answer.round, answer.position], [1, 2]);
  assert.deepEqual(answer.songs.map((s) => s.songId), QUEUE.slice(3), 'the Queue after the last landing');
  assert.ok(answer.songs.every((s) => typeof s.title === 'string'));
  assert.ok(!JSON.stringify(h.show.snapshot()).includes(JSON.stringify(QUEUE.slice(3, 8))), 'the order is not in the state');
});

test('Parlem on a review\'s screen (D118): the duck in place, the round still in its Check, nothing lands', () => {
  const h = flow();
  landSongs(h, 4);
  h.send('claim', { cardId: card.id });
  assert.deepEqual(rejected(h.send('hold', { on: false })), ['wrongScene'], 'not while revealing');
  h.send('checkReview', { claimId: 'cl-1' });
  assert.equal(h.show.sceneContext().reviewing, true);
  const off = h.send('hold', { on: false });
  assert.deepEqual(rejected(off), []);
  assert.equal(find(off, 'duck')?.db, 0, 'Parlem off: the song comes back up');
  assert.deepEqual([h.show.scene, h.show.status, h.show.hold?.ducked], ['check', 'hold', false]);
  const position = h.show.position;
  h.advance(30);
  assert.equal(h.show.position, position, 'nothing lands during a review');
  assert.ok((find(h.send('hold', { on: true }), 'duck')?.db ?? 0) < 0, 'and Parlem on again');
  assert.equal(h.show.hold?.ducked, true);
});

test('a discarded Review: no sound, the next card, or the round back in plain Parlem over the music from before the Check', () => {
  const h = flow();
  landSongs(h, 4);
  h.send('claim', { cardIds: [loser.id, card.id] });
  h.send('checkNext', { claimId: 'cl-1', step: 0 });
  h.send('checkReview', { claimId: 'cl-1' });
  const discarded = h.send('reviewEnd', { claimId: 'cl-1', outcome: 'discard' });
  assert.deepEqual(journalOf(discarded).map((e) => e.kind), ['claim.discarded']);
  assert.deepEqual(sfxNames(discarded), []);
  assert.equal(h.show.claims[0].status, 'discarded');
  assert.equal(h.show.check?.info.claimId, 'cl-2', 'the next card at once');
  // The last one discarded too, with nothing valid: Parlem, the song still there.
  h.send('checkReview', { claimId: 'cl-2' });
  const last = h.send('reviewEnd', { claimId: 'cl-2', outcome: 'discard' });
  assert.equal(h.show.scene, 'play');
  assert.deepEqual([h.show.status, h.show.hold?.reason, h.show.hold?.ducked], ['hold', 'discarded', true]);
  assert.ok(h.show.current, 'the music from before the Check');
  assert.ok(!find(last, 'songToHoldMusic') && !find(last, 'holdMusic'), 'no error Hold music');
  assert.deepEqual(find(last, 'cancelCheck')?.type, 'cancelCheck', 'the Check\'s duck lifts');
  const next = h.send('next');
  assert.ok(find(next, 'startTransition'), 'Next ends it (D142)');
  assert.deepEqual(replayJournal(journalOf(h.log)), h.show.record());
});

test('Enrere inside a Check (D127, D134): one step back a press, the previous snippet again, auto off for that Check only', () => {
  const h = flow();
  landSongs(h, 4);
  h.send('claim', { cardId: card.id });
  for (let k = 0; k < 3; k++) h.send('checkNext', { claimId: 'cl-1', step: k });
  h.send('checkAuto', { on: true });
  assert.equal(h.show.snapshot().check?.auto, true);
  const back = h.send('checkBack', { claimId: 'cl-1', step: 2 });
  assert.deepEqual(emitted(back, 'check.unrevealed').map((e) => e.index), [2]);
  assert.equal(find(back, 'checkReveal')?.step.songId, rows[0][1], 'the previous song\'s snippet replays');
  assert.equal(h.show.check?.info.revealed.length, 2);
  assert.equal(h.show.snapshot().check?.auto, false, 'auto off for this Check');
  assert.equal(h.show.checkAutoOn, true, 'the toggle itself stays on');
  h.advance(6);
  assert.equal(h.show.check?.info.revealed.length, 2, 'nothing reveals by itself now');
  assert.deepEqual(h.send('checkBack', { claimId: 'cl-1', step: 2 }).filter((e) => e.type === 'check.unrevealed' as string), [], 'a stale press is ignored');
  h.send('checkBack', { claimId: 'cl-1', step: 1 });
  const none = h.send('checkBack', { claimId: 'cl-1', step: 0 });
  assert.deepEqual(find(none, 'checkDuck'), { type: 'checkDuck', on: false }, 'at none the music from before the Check comes back up');
  assert.ok(!find(none, 'checkReveal'));
  assert.equal(h.show.scene, 'check', 'it never closes the Check');
  assert.deepEqual(rejected(h.send('checkBack', { claimId: 'cl-1', step: 0 })), [], 'nothing left to step back: ignored');
  // Not after the cue.
  h.pressCue('cl-1');
  assert.equal(h.show.scene, 'celebration');
});

test('auto reveals in a row, one snippet after another, through the cue and no further (D117)', () => {
  const h = flow();
  landSongs(h, 4);
  h.send('claim', { cardIds: [card.id, loser.id] });
  h.send('checkAuto', { on: true });
  assert.equal(h.show.check?.info.revealed.length, 1, 'turning it on reveals at once');
  const gap = FLOW.check.stepSec + FLOW.check.gapSec + FLOW.check.revealLeadSec;
  h.advance(gap + 0.05);
  assert.equal(h.show.check?.info.revealed.length, 2);
  h.until(() => h.show.check?.info.cue != null, 30);
  assert.equal(h.show.check?.info.cue, 'pass', 'through the cue');
  h.advance(FLOW.check.nextCardSec + 0.1);
  assert.equal(h.show.check?.info.claimId, 'cl-2');
  h.advance(10);
  assert.deepEqual(h.show.check?.info.revealed, [], 'the next card waits for a press');
  h.send('checkNext', { claimId: 'cl-2', step: 0 });
  h.until(() => h.show.scene !== 'check' || h.show.celebrationNext != null, 30);
  assert.ok(h.show.celebrationNext, 'and goes no further than the cue');
});

test('Back during a Check undoes the landing; undecided Claims survive and wait to be checked again', () => {
  const h = flow();
  landSongs(h, 4);
  h.send('claim', { cardId: card.id });
  assert.equal(h.show.claims[0].outcome, 'complete');
  h.send('checkNext', { claimId: 'cl-1', step: 0 });
  const out = h.send('back');
  assert.equal(h.show.position, 2);
  assert.ok(find(out, 'cancelCheck'));
  assert.equal(h.show.scene, 'check');
  assert.deepEqual(h.show.claims.map((c) => [c.status, c.outcome]), [['queued', 'incomplete']], 'the Claim sees the landings now');
  assert.equal(h.show.check, null);
  h.send('checkStart', { claimId: 'cl-1' });
  assert.deepEqual(live(h).check?.info.revealed, []);
  assert.equal(h.show.claims[0].outcome, 'incomplete');
  assert.deepEqual(rejected(h.send('next')), ['wrongScene']);
  assert.deepEqual(rejected(h.send('hold', { on: false })), ['wrongScene'], 'the Check decides first');
});

test('the Celebration music changes without blocking anything; Hold music in the Celebration is a choice; Parlem ducks it (D117)', () => {
  const h = flow();
  landSongs(h, 4);
  h.send('claim', { cardId: card.id });
  h.pressCue('cl-1');
  const victory = h.send('celebrationMusic', { choice: 'victory' });
  assert.equal(find(victory, 'celebrationMusic')?.choice, 'victory');
  assert.equal(h.show.celebration?.music, 'victory');
  assert.equal(h.show.bed, 'victory');
  // Parlem in a Celebration: the music ducks under the voices, and comes back.
  const parlem = h.send('hold', { on: true });
  assert.ok(find(parlem, 'bedDuck') && (find(parlem, 'bedDuck')?.db ?? 0) < 0);
  assert.equal(h.show.scene, 'celebration');
  const up = h.send('hold', { on: false });
  assert.equal(find(up, 'bedDuck')?.db, 0);
  assert.equal(h.show.scene, 'celebration', 'only the duck went');
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

test('with the plan, the expected end allows for each round\'s kind and the planned Throws; the countdown too', () => {
  const plan = checkGamePlan({
    v: 3, edition: '26', title: 'Quina Quina 3', prizeReveal: 'perRound', sponsors: [],
    rounds: [1, 2, 3].map((number) => ({ number, kind: number === 2 ? 'desgraciat' : 'normal', line: [], bingo: [] })),
    schedule: { startAtMs: null, roundMinutes: 25, intervalMinutes: 4, throws: [{ afterRound: 1, minutes: 5 }] },
    cheatSheet: { claimRules: [], specialRoundRules: [] },
  });
  assert.ok(plan.ok);
  const h = flow();
  landSongs(h, 2);
  const without = h.show.schedule().gameEndMs;
  h.show.setPlan(plan.plan);
  const withPlan = h.show.schedule().gameEndMs;
  const noThrow = { ...plan.plan, schedule: { ...plan.plan.schedule, throws: [] } };
  h.show.setPlan(noThrow);
  assert.equal(withPlan - h.show.schedule().gameEndMs, 5 * 60_000, 'the 5-minute Throw after round 1');
  assert.ok(h.show.schedule().gameEndMs !== without, 'the plan\'s rounds and Interval, not the defaults');
  h.show.setPlan(plan.plan);
  // Round 1's Bingo, then its Interval: the countdown is the planned Interval plus the Throw after round 1.
  landSongs(h, 12);
  h.send('claim', { cardId: card.id, kind: 'bingo' });
  h.pressCue(lastClaimId(h));
  h.send('interval');
  const interval = h.show.snapshot().interval;
  assert.ok(interval);
  assert.equal(interval.guideEndMs - interval.sinceMs, (4 + 5) * 60_000);
  h.show.setPlan(null);
  assert.equal(h.show.snapshot().interval?.guideEndMs, interval.sinceMs + FLOW.intervalGuideSec * 1000, 'without a plan: the default guide');
});

test('Pausa saves what plays and resumes it where it was, under Parlem (D128, D135); the clock stands still meanwhile', () => {
  const h = flow();
  landSongs(h, 2);
  h.send('next');
  const on = h.send('pause');
  assert.ok(h.show.pause);
  assert.deepEqual(find(on, 'pauseOverlay'), { type: 'pauseOverlay', on: true }, 'in a round: "Tornem de seguida"');
  assert.deepEqual(emitted(on, 'transition.cancelled').map((e) => e.reason), ['hold'], 'a Spin in flight is cancelled (U105)');
  assert.ok(find(on, 'pausePlayback') && find(on, 'pausaMusic')?.on, 'what plays is saved, the Pausa set plays');
  assert.ok(!find(on, 'holdMusic') && !find(on, 'songToHoldMusic') && !find(on, 'intervalMusic'));
  assert.deepEqual(h.show.snapshot().intervalMusic, { set: 'pausa', track: null });
  assert.deepEqual(h.show.snapshot().pause, { sinceMs: h.show.pause?.sinceMs, overlay: true });
  const song = h.show.current;
  assert.ok(song);
  const posAt = (t: number) => song.offset + (t - song.startCtx) * song.rate;
  const pos = posAt(h.clock.t);
  assert.deepEqual(rejected(h.send('claim', { cardId: card.id })), ['wrongScene']);
  assert.deepEqual(rejected(h.send('back')), ['wrongScene']);
  assert.deepEqual(rejected(h.send('setPace', { delta: 1 })), []);
  const holdMusicAt = h.show.timers.holdMusicAt;
  h.advance(30);
  assert.equal(h.show.timers.holdMusicAt, holdMusicAt, 'no timer runs during Pausa');
  const off = h.send('pause', { on: false });
  assert.deepEqual(find(off, 'pauseOverlay'), { type: 'pauseOverlay', on: false });
  const resume = find(off, 'resumePlayback');
  assert.ok(resume && !resume.discard && resume.song?.songId === song.songId);
  assert.ok(Math.abs((resume.song?.offset ?? 0) - pos) < 0.05, 'the song resumes exactly where it was');
  assert.ok(Math.abs(posAt(resume.at) - pos) < 0.05, 'and its timeline moved on by the paused time');
  assert.equal(find(off, 'pausaMusic')?.on, false);
  assert.deepEqual([h.show.status, h.show.hold?.reason, h.show.hold?.ducked], ['hold', 'cancel', true], 'Parlem still on: the Hold the cancelled Spin left');
  const next = find(h.send('next'), 'startTransition');
  assert.ok(next, 'Next ends that Parlem');

  // A song playing (no Hold) comes back under Parlem, the Hold Pausa leaves behind.
  const p = flow(6);
  landSongs(p, 2);
  p.send('pause');
  p.send('pause');
  assert.deepEqual([p.show.status, p.show.hold?.reason, p.show.hold?.ducked], ['hold', 'pause', true]);

  // Next during Pausa: it ends Pausa with that song's transition, out of the Pausa music; nothing saved comes back.
  const n = flow(4);
  landSongs(n, 2);
  n.send('pause');
  const out = n.send('next');
  assert.equal(n.show.pause, null);
  assert.equal(find(out, 'resumePlayback')?.discard, true);
  assert.ok(find(out, 'startTransition')?.fromHoldMusic, 'the Spin builds out of the Pausa music');

  // In a Check: its marks stay, auto and the sounds stop, the next reveal waits for a press.
  const c = flow(9);
  landSongs(c, 4);
  c.send('claim', { cardId: card.id });
  c.send('checkNext', { claimId: 'cl-1', step: 0 });
  const paused = c.send('pause', { on: true });
  assert.ok(find(paused, 'cancelCheck'));
  assert.equal(c.show.claims[0].status, 'checking');
  assert.deepEqual(rejected(c.send('checkNext', { claimId: 'cl-1', step: 1 })), ['wrongScene']);
  const resumed = c.send('pause', { on: false });
  assert.deepEqual(find(resumed, 'checkDuck'), { type: 'checkDuck', on: true }, 'the music under the Check goes back down');
  assert.equal(c.show.check?.info.revealed.length, 1);

  // In a Celebration: its music is saved and resumes; the 60 s to the Interval exclude the paused time.
  c.pressCue('cl-1');
  const since = c.show.celebration?.sinceMs ?? 0;
  c.send('pause');
  c.advance(20);
  const back = c.send('pause');
  assert.ok(find(back, 'resumePlayback') && !find(back, 'celebrationMusic'), 'the same music, from where it was');
  assert.ok((c.show.celebration?.sinceMs ?? 0) - since >= 20_000, 'its way to the Interval moved on by the pause');

  // Between rounds the screens stay as they are (D135).
  const i = flow(11);
  i.send('endGame');
  i.send('pause');
  assert.deepEqual(i.show.snapshot().pause?.overlay, false);
  const panic = i.send('panic');
  assert.equal(i.show.pause, null);
  assert.equal(find(panic, 'resumePlayback')?.discard, true, 'Panic clears the saved playback');
});

test('the throw song (D138): a tap starts it from its hook, stops it, resumes it where it stopped; a long press restarts; between rounds only', () => {
  const h = flow();
  assert.deepEqual(rejected(h.send('throw')), [], 'at the doors');
  const first = find(h.log, 'throwSong');
  assert.deepEqual([first?.action, first?.offsetSec], ['play', THROW.songs.throw.hookSec]);
  assert.deepEqual(h.show.snapshot().throwSong && [h.show.snapshot().throwSong?.song, h.show.snapshot().throwSong?.title, h.show.snapshot().throwSong?.playing], ['throw', THROW.songs.throw.title, true]);
  h.advance(5);
  const stop = find(h.send('throw'), 'throwSong');
  assert.equal(stop?.action, 'stop');
  assert.ok(Math.abs((stop?.offsetSec ?? 0) - (THROW.songs.throw.hookSec + 5 - THROW.leadSec)) < 0.05, 'it knows where it stopped');
  assert.equal(h.show.snapshot().throwSong?.playing, false);
  // The buttons' time bar: where it stopped and since when, its drop and its length; each song's track while idle too.
  const shown = h.show.snapshot().throwSong;
  assert.deepEqual(shown && [shown.posSec, shown.sinceMs, shown.startSec, shown.dropSec, shown.durationSec], [
    Math.round((stop?.offsetSec ?? 0) * 100) / 100, h.env.toEpochMs(h.clock.t), THROW.songs.throw.hookSec, THROW.songs.throw.dropSec, THROW.songs.throw.durationSec,
  ]);
  assert.deepEqual(h.show.snapshot().throwSongs.storm, {
    title: THROW.songs.storm.title, artist: THROW.songs.storm.artist, startSec: THROW.songs.storm.hookSec, dropSec: THROW.songs.storm.dropSec, durationSec: THROW.songs.storm.durationSec,
  });
  h.advance(10);
  const resume = find(h.send('throw'), 'throwSong');
  assert.deepEqual([resume?.action, resume?.offsetSec], ['play', stop?.offsetSec], 'it resumes where it stopped');
  const again = find(h.send('throw', { restart: true }), 'throwSong');
  assert.deepEqual([again?.action, again?.offsetSec], ['play', THROW.songs.throw.hookSec], 'a long press: from the hook again');
  // Played to its end: the runtime says so, and it's off.
  h.show.throwEnded();
  assert.equal(h.show.snapshot().throwSong, null);
  // A scene change ends it for good; in a round it's refused.
  h.send('throw');
  const end = h.send('next');
  assert.equal(find(end, 'throwSong')?.action, 'end');
  assert.equal(h.show.snapshot().throwSong, null);
  assert.deepEqual(rejected(h.send('throw')), ['wrongScene'], 'a round is in play');
  assert.deepEqual(rejected(h.send('storm')), ['wrongScene'], 'the storm only after the Game');
});

test('the corn-seed storm in the night\'s last round (D155): the round holds first, so nothing lands unheard under it', () => {
  const h = flow();
  h.send('setGame', { roundsTotal: 1 });
  landSongs(h, 2);
  assert.equal(h.show.snapshot().lastRound, true);
  const position = h.show.position;
  const out = h.send('storm');
  assert.equal(find(out, 'throwSong')?.action, 'play');
  assert.deepEqual([h.show.status, h.show.hold?.ducked], ['hold', true], 'Parlem under the storm');
  h.advance(30);
  assert.equal(h.show.position, position, 'nothing landed');
  // Not in an earlier round.
  const e = flow(5);
  landSongs(e, 1);
  assert.equal(e.show.snapshot().lastRound, false);
  assert.deepEqual(rejected(e.send('storm')), ['wrongScene']);
});

test('the corn-seed storm (D151): after the Game, its song right from the drop over the end music; the same taps; no throw there (D194)', () => {
  const h = flow();
  landSongs(h, 1);
  h.send('endGame');
  assert.deepEqual(rejected(h.send('throw')), ['wrongScene'], 'no "Llançament" on the end screen');
  const storm = find(h.send('storm'), 'throwSong');
  assert.deepEqual([storm?.action, storm?.offsetSec, storm?.track?.name], ['play', THROW.songs.storm.hookSec, THROW.songs.storm.name], 'from its own hook');
  assert.equal(THROW.songs.storm.hookSec, 208.76, 'U132 (a): Flying Free from its drop');
  assert.equal(h.show.snapshot().throwSong?.song, 'storm');
  h.advance(3);
  assert.equal(find(h.send('storm'), 'throwSong')?.action, 'stop');
  assert.equal(find(h.send('storm', { restart: true }), 'throwSong')?.offsetSec, THROW.songs.storm.hookSec);
  assert.equal(h.show.scene, 'after');
});

test('endGame ends anywhere: closing music in `after`; a new round can still be introduced', () => {
  const h = flow();
  landSongs(h, 2);
  h.send('next');
  const out = h.send('endGame');
  assert.equal(h.show.scene, 'after');
  assert.ok(find(out, 'cancelTransition'));
  assert.equal(find(out, 'intervalMusic')?.set, 'end', 'the end\'s music (D137)');
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
    // Head starts on the fixed Queue, so real wins and the scenes after them come up (only a card that completed can
    // be accepted): seed 1 starts in its Bingo's Celebration, seed 3 in the Interval after it, seed 5 one song from
    // the Line.
    if (seed === 1 || seed === 3) {
      landSongs(h, 14);
      h.send('claim', { cardId: card.id, kind: 'bingo' });
      h.pressCue(lastClaimId(h));
      assert.equal(h.show.scene, 'celebration');
      if (seed === 3) h.send('interval');
    } else if (seed === 5) landSongs(h, 3);
    let rnd = seed * 7919;
    const pick = <T>(list: readonly T[]): T => list[(rnd = (rnd * 48271) % 2147483647) % list.length];
    const claimId = () => pick([...h.show.claims.map((c) => c.claimId), 'cl-99']);
    const commands = [
      // Songs land far more often than anything else happens, so rounds get far enough for real wins.
      () => h.send('next'), () => h.send('next'), () => h.send('next'), () => h.send('next'), () => h.send('next'), () => h.send('next'),
      () => h.send('next'), () => h.send('next'), () => h.send('next'), () => h.send('next'), () => h.send('back'), () => h.send('hold'),
      () => h.send('hold', { on: false }), () => h.send('holdMusic'), () => h.send('suspense'), () => h.send('suspense', { on: false, cancel: pick([true, false]) }),
      () => h.send('claim', { cardId: pick([card.id, loser.id, 9999, 410]) }), () => h.send('claim', { cardId: card.id, kind: pick(['line', 'bingo'] as const) }),
      // A presenter pressing the Check on screen: a reveal, or its cue (and the shared Celebration's press).
      ...Array.from({ length: 4 }, () => () => {
        const cn = h.show.celebrationNext;
        if (cn) return h.send('checkNext', cn);
        const run = h.show.check;
        return run ? h.send('checkNext', { claimId: run.info.claimId, step: run.info.revealed.length }) : h.send('next');
      }),
      // A card that really completed (only those can be accepted: the Check's result decides).
      () => h.send('claim', { cardId: pick([...h.show.possibleWinners().line, ...h.show.possibleWinners().bingo].map((w) => w.cardId).concat(card.id)) }),
      () => h.send('checkStart', { claimId: claimId() }), () => h.send('checkAuto', { on: pick([true, false]) }),
      () => h.send('checkBack', { claimId: claimId(), step: Math.max(0, (h.show.check?.info.revealed.length ?? 1) - 1) }),
      () => h.send('checkReview', { claimId: claimId() }),
      () => h.send('reviewEnd', { claimId: claimId(), outcome: pick(['continue', 'win', 'lose', 'discard'] as const) }),
      () => h.send('throw', { restart: pick([true, false]) }), () => h.send('setVolume', { key: 'breaks', percent: pick([40, 100]) }),
      () => h.send('winnerInfo', { claimId: claimId(), name: pick(['', 'Pep']) }),
      () => h.send('celebrationMusic', { choice: pick(['winningSong', 'victory', 'holdMusic'] as const) }),
      () => h.send('interval'), () => h.send('roundIntro'), () => h.send('newRound'), () => h.send('pause'), () => h.send('confirmLine'),
      () => h.send('endGame'),
    ];
    scenes.add(h.show.scene);
    for (let step = 0; step < 150; step++) {
      // endGame is rare, so a Game gets far.
      const command = step % 50 === 49 ? commands[commands.length - 1] : pick(commands.slice(0, -1));
      command();
      h.advance((rnd % 1000) / 100);
      const s = h.show;
      const where = `seed ${seed} step ${step}: ${s.scene} ${s.status}`;
      assert.ok(['idle', 'playing', 'transition', 'hold'].includes(s.status), where);
      if (s.status === 'hold' && !s.pause) assert.ok(s.current || s.holdMusic || s.bed, `${where}: hold in silence`);
      if (s.status === 'playing') assert.ok(s.current && (s.scene === 'play' || s.scene === 'before'), `${where}: a song plays outside the round`);
      if (s.status === 'transition') assert.ok((s.transition || s.suspense) && ['play', 'check'].includes(s.scene), where);
      if (s.scene === 'check') assert.ok(s.claims.some((c) => c.status === 'queued' || c.status === 'checking' || c.status === 'reviewing') || s.celebrationNext || s.check?.info.cue != null || s.status === 'transition' || s.pause, `${where}: a Check with nothing to decide`);
      if (s.scene === 'celebration') assert.ok(s.celebration && s.celebration.cardIds.length > 0, where);
      if (s.check) assert.ok(s.claims.some((c) => c.claimId === s.check?.info.claimId && (c.status === 'checking' || c.status === 'reviewing' || s.check?.info.cue != null)), where);
      assert.deepEqual(replayJournal(journalOf(h.log)), s.record(), `${where}: the journal replays to the show`);
      scenes.add(s.scene);
    }
    for (const entry of journalOf(h.log)) kinds.add(entry.kind);
  }
  assert.deepEqual([...scenes].sort(), ['after', 'before', 'celebration', 'check', 'interval', 'play', 'roundStart'], 'the fuzz reaches every scene');
  for (const kind of ['scene.changed', 'claim.opened', 'claim.decided', 'claim.reviewing', 'winner.noted', 'line.confirmed']) assert.ok(kinds.has(kind), `the fuzz journals ${kind}`);
});

test('the music under a Check goes far down from its first reveal until the cue', () => {
  const h = flow();
  landSongs(h, 4);
  assert.ok(FLOW.check.duckDb <= volumeDb(VOLUME_DEFAULTS.songsParlem) - 15, `${FLOW.check.duckDb} dB under the Check, far below Parlem`);
  const out = h.send('claim', { cardId: card.id });
  assert.ok(!find(out, 'checkDuck'));
  assert.deepEqual(find(h.send('checkNext', { claimId: 'cl-1', step: 0 }), 'checkDuck'), { type: 'checkDuck', on: true });
  const reveal = find(h.log, 'checkReveal');
  assert.ok(reveal && Math.abs(reveal.step.at - (h.clock.t + FLOW.check.revealLeadSec)) < 1e-9, 'just ahead of the press');
  for (let k = 1; k < 4; k++) assert.ok(!find(h.send('checkNext', { claimId: 'cl-1', step: k }), 'checkDuck'), 'once');
  assert.ok(find(h.send('checkNext', { claimId: 'cl-1', step: 4 }), 'cancelCheck'), 'the cue brings it back up');
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
  const decided = h.pressCue('cl-1');
  const [celebration] = emitted(decided, 'celebration.started');
  assert.equal(celebration.celebration.music, 'victory', 'the pick, not the Line default (the winning song)');
  assert.equal(find(decided, 'celebrationMusic')?.choice, 'victory');
  assert.equal(h.show.snapshot().celebrationChoice, null, 'used once');

  // A pick during a Check that fails is dropped.
  const g = flow(5);
  landSongs(g, 2);
  g.send('claim', { cardId: card.id });
  g.send('celebrationMusic', { choice: 'holdMusic' });
  g.pressCue('cl-1');
  g.advance(FLOW.check.nextCardSec + 0.1);
  assert.equal(g.show.snapshot().celebrationChoice, null);
});

test('prizes are revealed as a round is introduced and by the presenters, once each way, in the journal and the state', () => {
  const h = flow();
  landSongs(h, 1);
  h.send('revealPrizes', { round: 3 });
  h.send('revealPrizes', { round: 3 });
  const entries = journalOf(h.log).filter((e) => e.kind === 'prizes.revealed');
  assert.deepEqual(entries.map((e) => e.kind === 'prizes.revealed' && [e.round, e.by]), [[3, 'presenters']], 'once');
  assert.deepEqual(h.show.snapshot().prizes?.revealed, [{ round: 3, by: 'presenters' }]);
  assert.deepEqual(replayJournal(journalOf(h.log)).prizesRevealed, [{ round: 3, by: 'presenters' }]);
  // A round introduced between rounds reveals its prizes (a plan with every prize secret ignores it).
  h.send('endGame');
  h.send('roundIntro', { number: 2 });
  const intro = journalOf(h.log).filter((e) => e.kind === 'prizes.revealed').at(-1);
  assert.ok(intro?.kind === 'prizes.revealed' && intro.round === 2 && intro.by === 'intro');
});
