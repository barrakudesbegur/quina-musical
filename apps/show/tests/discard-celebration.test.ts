// whats-left 2.2, the orchestrator's run of 28 Nov: a Line won by one card, then a Bingo claim whose last card is
// discarded from its Review. The engine's state is fed to what the console and the projector draw from it: the console's
// «Celebrem!» names only the Bingo's winners (never the Line's), and the projector shows the round, never an empty
// screen. Fake clock, real analysis data, real cards.
import { HAS_DATA, NO_CARD, dataTest as test } from './support/data.ts';
import assert from 'node:assert/strict';
import { PROTOCOL_VERSION, type ShowState } from '@quina/protocol';
import { FLOW } from '../engine/src/config.ts';
import { cardSongIds, type Card } from '../engine/src/game/cards.ts';
import { setup, songs, allCards, type Harness } from './support/harness.ts';
import { flowOf } from '../../../packages/ui/flow.ts';
import { batchWinners, checkState } from '../../console/logic/check.ts';
import { stageView } from '../../stage/view.ts';

const catalog = new Set(songs.map((s) => s.id));
const playable = (c: Card) => cardSongIds(c).flat().every((id) => catalog.has(id));
const normal = allCards.filter((c) => c.type === 'normal' && c.id <= 200 && playable(c));
/** The Line's winner (its top row lands first) and the Bingo's (its 12 songs next), two different cards. */
const lineCard = normal[0] ?? (HAS_DATA ? undefined : NO_CARD);
assert.ok(lineCard);
const bingoCard = normal.find((c) => c.id !== lineCard.id) ?? (HAS_DATA ? undefined : { ...NO_CARD, id: 2 });
assert.ok(bingoCard);
const lineRow = cardSongIds(lineCard)[0];
const bingoSongs = cardSongIds(bingoCard).flat().filter((id) => !lineRow.includes(id));
const onEither = new Set([...lineRow, ...bingoSongs]);
const QUEUE = [...lineRow, ...bingoSongs, ...songs.map((s) => s.id).filter((id) => !onEither.has(id))];
/** The landing that completes the Bingo card. */
const BINGO_AT = lineRow.length + bingoSongs.length;
/** A card that claims and is then discarded (its outcome doesn't matter). */
const other = normal.find((c) => c.id !== lineCard.id && c.id !== bingoCard.id) ?? (HAS_DATA ? undefined : { ...NO_CARD, id: 3 });
assert.ok(other);

function land(h: Harness, count: number) {
  for (let i = 0; i < count; i++) {
    const position = h.show.position;
    h.send('next');
    h.until(() => h.show.position === position + 1 && h.show.status === 'playing');
  }
}

/** Round 1 up to the Bingo's landing, with the Line won by `lineCard` and celebrated. */
function afterTheLine(): Harness {
  const h = setup({ seed: 3, cards: allCards, cardsInPlay: '1-200', fixedQueue: QUEUE, settings: { autoAdvance: false } });
  h.send('unlock');
  land(h, lineRow.length);
  h.send('claim', { cardId: lineCard.id, kind: 'line' });
  h.pressCue();
  assert.equal(h.show.scene, 'celebration');
  assert.deepEqual(h.show.celebration?.cardIds, [lineCard.id]);
  land(h, BINGO_AT - lineRow.length);
  return h;
}

/** What the console's Check board and the projector draw from the engine's state now. */
function screens(h: Harness) {
  const state: ShowState = { v: PROTOCOL_VERSION, ...h.show.snapshot() };
  const flow = flowOf(state);
  return { flow, stage: checkState(flow)?.stage ?? null, winners: batchWinners(flow), projector: stageView(state, flow, null, null).body.scene };
}

test('a Bingo whose last card is discarded after one passed: «Celebrem!» names the Bingo winner alone, the projector shows the round', () => {
  const h = afterTheLine();
  h.send('claim', { cardIds: [bingoCard.id, other.id], kind: 'bingo' });
  h.pressCue('cl-2');
  assert.equal(h.show.claims[1].status, 'valid', 'the Bingo card passes');
  h.advance(FLOW.check.nextCardSec + 0.1);
  assert.equal(h.show.check?.info.claimId, 'cl-3');
  h.send('checkReview', { claimId: 'cl-3' });
  h.send('reviewEnd', { claimId: 'cl-3', outcome: 'discard' });

  const s = screens(h);
  assert.deepEqual([s.flow.scene, s.flow.check, s.flow.celebrationNext?.claimId], ['check', null, 'cl-3'], "the engine: the Celebration waits for the presenters' press");
  assert.equal(s.stage, 'celebrateNext');
  assert.deepEqual(s.winners, [bingoCard.id], 'only the Bingo card, not the Line winner');
  assert.equal(s.projector, 'play', 'the round (the drum), not an empty Check screen');

  // The press: the Celebration the engine starts names the same cards as the button did.
  const cn = s.flow.celebrationNext;
  assert.ok(cn);
  h.send('checkNext', cn);
  assert.equal(h.show.scene, 'celebration');
  assert.deepEqual([h.show.celebration?.kind, h.show.celebration?.cardIds], ['bingo', s.winners]);
  assert.equal(screens(h).projector, 'celebration');
});

test("a Bingo's only card discarded after the Line: no Celebration and nobody named, the round back in Parlem", () => {
  const h = afterTheLine();
  h.send('claim', { cardId: bingoCard.id, kind: 'bingo' });
  h.send('checkNext', { claimId: 'cl-2', step: 0 });
  h.send('checkReview', { claimId: 'cl-2' });
  h.send('reviewEnd', { claimId: 'cl-2', outcome: 'discard' });
  const s = screens(h);
  assert.deepEqual([s.flow.scene, s.flow.celebrationNext, s.stage], ['play', null, null]);
  assert.deepEqual([h.show.status, h.show.hold?.reason], ['hold', 'discarded']);
  assert.equal(s.projector, 'play');
});

test('a Line batch whose last card is discarded: the Line winners, as the Line Celebration lists them', () => {
  const h = setup({ seed: 3, cards: allCards, cardsInPlay: '1-200', fixedQueue: QUEUE, settings: { autoAdvance: false } });
  h.send('unlock');
  land(h, lineRow.length);
  h.send('claim', { cardIds: [lineCard.id, other.id], kind: 'line' });
  h.pressCue('cl-1');
  h.advance(FLOW.check.nextCardSec + 0.1);
  h.send('checkReview', { claimId: 'cl-2' });
  h.send('reviewEnd', { claimId: 'cl-2', outcome: 'discard' });
  const s = screens(h);
  assert.equal(s.stage, 'celebrateNext');
  assert.deepEqual(s.winners, [lineCard.id]);
  assert.equal(s.projector, 'play');
  h.send('checkNext', s.flow.celebrationNext!);
  assert.deepEqual(h.show.celebration?.cardIds, s.winners);
});
