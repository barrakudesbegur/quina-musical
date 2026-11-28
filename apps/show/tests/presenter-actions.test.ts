// The presenters' actions Sound engine found wrong after the 28 Nov realistic test (whats-left 2.4; apps/show/docs/HANDOFF.md
// › What's left, §2), each reproduced first: Back after a Check's cue, Pausa from Aguanta, the two-level lock, Aguanta
// in a Spin's last moment. Fake clock, real analysis data, real cards.
import { HAS_DATA, NO_CARD, dataTest as test } from './support/data.ts';
import assert from 'node:assert/strict';
import { makeCommand, type CommandFields } from '@quina/protocol';
import { FLOW, HOLD } from '../engine/src/config.ts';
import { cardSongIds, type Card } from '../engine/src/game/cards.ts';
import type { Effect, EffectOf, EffectType } from '../engine/src/show/show.ts';
import { setup, songs, allCards, type Harness } from './support/harness.ts';

const find = <T extends EffectType>(effects: readonly Effect[], type: T) => effects.find((e): e is EffectOf<T> => e.type === type);
const rejected = (effects: readonly Effect[]) => effects.filter((e) => e.type === 'reject').map((e) => e.reason);

/** A normal card whose 12 songs are all playable, and a Queue that completes its top row first (flow.test.ts's). */
const catalog = new Set(songs.map((s) => s.id));
const playable = (c: Card) => cardSongIds(c).flat().every((id) => catalog.has(id));
const card = allCards.find((c) => c.type === 'normal' && c.id <= 200 && playable(c)) ?? (HAS_DATA ? undefined : NO_CARD);
assert.ok(card);
const rows = cardSongIds(card);
const onCard = new Set(rows.flat());
const fillers = songs.map((s) => s.id).filter((id) => !onCard.has(id));
const QUEUE = [...rows[0], fillers[0], fillers[1], ...rows[1], ...rows[2], ...fillers.slice(2)];
const loser = allCards.find((c) => c.type === 'normal' && c.id !== card.id && c.id <= 200 && cardSongIds(c).every((row) => row.some((id) => !QUEUE.slice(0, 14).includes(id)))) ?? (HAS_DATA ? undefined : NO_CARD);
assert.ok(loser);

function flow(seed = 3) {
  const h = setup({ seed, cards: allCards, cardsInPlay: '1-200', fixedQueue: QUEUE, settings: { autoAdvance: false } });
  h.send('unlock');
  return h;
}

function landSongs(h: Harness, count: number) {
  for (let i = 0; i < count; i++) {
    const position = h.show.position;
    h.send('next');
    h.until(() => h.show.position === position + 1 && h.show.status === 'playing');
  }
}

// ---------------------------------------------------------------------------------------- Back after a Check's cue
test("Back after a Check's cue is refused (D127, D134: only while revealing): a failed last card still goes back to the round", () => {
  const h = flow();
  landSongs(h, 3);
  h.send('claim', { cardId: loser.id });
  h.pressCue();
  assert.equal(h.show.check?.info.cue, 'fail');
  const position = h.show.position;
  assert.deepEqual(rejected(h.send('back')), ['invalid'], 'its ✗ is on screen: nothing to step back');
  assert.equal(h.show.position, position, 'no landing undone');
  h.advance(FLOW.check.nextCardSec + 0.1);
  assert.deepEqual([h.show.scene, h.show.hold?.reason], ['play', 'checkFailed'], 'the round goes on, not stuck in an empty Check');
  // Back works again once the Check is over.
  assert.deepEqual(rejected(h.send('back')), []);
  assert.equal(h.show.position, position - 1);
});

test("Back while a shared Celebration waits for its press (one card passed, the last failed) is refused: the Winner's Celebration still comes", () => {
  const h = flow();
  landSongs(h, 4);
  h.send('claim', { cardIds: [card.id, loser.id] });
  h.pressCue('cl-1');
  h.advance(FLOW.check.nextCardSec + 0.1);
  h.pressCue('cl-2');
  const cn = h.show.celebrationNext;
  assert.ok(cn);
  assert.deepEqual(rejected(h.send('back')), ['invalid']);
  assert.deepEqual(h.show.celebrationNext, cn, 'still waiting for its press');
  h.send('checkNext', cn);
  assert.equal(h.show.scene, 'celebration');
  assert.deepEqual(h.show.celebration?.cardIds, [card.id]);
});

// ---------------------------------------------------------------------------------------- Pausa from Aguanta
test('Pausa from Aguanta: Next still plays the transition into the next song (D128)', () => {
  const h = flow();
  landSongs(h, 1);
  h.send('hold', { on: true, duck: false });
  assert.equal(h.show.hold?.ducked, false, 'Aguanta');
  assert.deepEqual(rejected(h.send('next')), ['nextBlocked'], 'Aguanta blocks Next (D133)');
  h.send('pause', { on: true });
  const out = h.send('next');
  assert.deepEqual(rejected(out), [], 'Pausa: the tablet\'s Següent plays the transition');
  assert.equal(h.show.pause, null, 'Next ends Pausa');
  assert.ok(h.show.transition || h.show.pending, 'the next song is on its way');
  h.until(() => h.show.position === 1 && h.show.status === 'playing');
});

// ---------------------------------------------------------------------------------------- the two-level lock
const TABLET = 'tauleta-a1b2c';
const LAPTOP = 'portatil-x9y8z';
const from = <C extends 'hold' | 'pause' | 'suspense' | 'twoLevelHold'>(h: Harness, sender: string, cmd: C, fields: CommandFields[C]) =>
  h.dispatch({ ...makeCommand(cmd, fields as never), from: sender });

test("D234's lock covers only the held button: another console's other two-level button works as usual (screens.md)", () => {
  const h = flow();
  landSongs(h, 1);
  // The tablet holds Parlem (on its way to Pausa).
  from(h, TABLET, 'twoLevelHold', { button: 'hold', on: true });
  from(h, TABLET, 'hold', { on: true, duck: true });
  assert.equal(h.show.hold?.ducked, true);
  // The laptop's Parlem and Pausa are the held button's: refused.
  assert.deepEqual(rejected(from(h, LAPTOP, 'hold', { on: false })), ['busy'], "Parlem's tap off is Parlem's");
  assert.deepEqual(rejected(from(h, LAPTOP, 'pause', { on: true })), ['busy']);
  // Its Aguanta works: the Hold switches to Aguanta in place.
  assert.deepEqual(rejected(from(h, LAPTOP, 'hold', { on: true, duck: false })), []);
  assert.equal(h.show.hold?.ducked, false);
  from(h, TABLET, 'twoLevelHold', { button: 'hold', on: false });

  // The other way round: the tablet holds Aguanta; the laptop's Parlem works, its Suspens doesn't.
  from(h, TABLET, 'twoLevelHold', { button: 'stay', on: true });
  assert.deepEqual(rejected(from(h, LAPTOP, 'suspense', { on: true })), ['busy']);
  assert.deepEqual(rejected(from(h, LAPTOP, 'hold', { on: false })), ['busy'], "Aguanta's tap off is Aguanta's");
  assert.deepEqual(rejected(from(h, LAPTOP, 'hold', { on: true, duck: true })), []);
  assert.equal(h.show.hold?.ducked, true, 'Parlem');
  // The holder's own presses always act.
  assert.deepEqual(rejected(from(h, TABLET, 'hold', { on: false })), []);
  assert.equal(h.show.status, 'playing');
});

// ---------------------------------------------------------------------------------------- Aguanta in a Spin's last moment
test("Aguanta in a Spin's last 0.15 s holds the song that lands at full volume: Aguanta, not Parlem, and Next is blocked", () => {
  const h = flow();
  landSongs(h, 1);
  h.send('next');
  const t = h.show.transition;
  assert.ok(t);
  h.until(() => h.show.transition != null && h.show.transition.T - h.env.now() < HOLD.cancelMinSec * 0.6);
  assert.deepEqual(rejected(h.send('hold', { on: true, duck: false })), []);
  h.until(() => h.show.transition == null);
  assert.equal(h.show.position, 1, 'it landed');
  assert.deepEqual([h.show.status, h.show.hold?.ducked], ['hold', false], 'Aguanta');
  assert.ok(!h.log.slice(-40).some((e) => e.type === 'duck' && e.db < 0), 'never ducked');
  assert.deepEqual(rejected(h.send('next')), ['nextBlocked']);
  void find;
});
