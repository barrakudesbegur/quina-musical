// A card type per round: the round plays the printed card type the plan names for it (RoundPlan.cardType, sent
// with roundIntro/newRound), not a fixed rule by its kind. Only that type's cards count (the Shuffle's Tie check,
// the Phase, the Check), and the type survives the journal, a restart and a resume by hand.
import { dataTest as test } from './support/data.ts';
import assert from 'node:assert/strict';
import { makeCommand, parseResumeToken, replayJournal, type JournalEntry, type ShowEvent, type EventOf } from '@quina/protocol';
import { FLOW } from '../engine/src/config.ts';
import { validCards } from '../engine/src/game/cards.ts';
import { hasTie } from '../engine/src/game/shuffle.ts';
import type { Effect } from '../engine/src/show/show.ts';
import { setup, allCards, type Harness } from './support/harness.ts';

const CARDS = '1-150, 400-500';
const journalOf = (effects: readonly Effect[]): JournalEntry[] => effects.flatMap((e) => (e.type === 'journal' ? [e.entry] : []));
const rejected = (effects: readonly Effect[]) => effects.flatMap((e) => (e.type === 'reject' ? [e.reason] : []));
const checks = (effects: readonly Effect[]) =>
  effects.flatMap((e) => (e.type === 'emit' && e.message.type === 'check.started' ? [(e.message as ShowEvent as EventOf<'check.started'>).check] : []));

/** A Game whose first round is introduced as a normal round that plays especial cards, then shuffled and started. */
function especialRound(seed = 4): Harness {
  const h = setup({ seed, cards: allCards, cardsInPlay: CARDS, settings: { autoAdvance: false } });
  h.send('unlock');
  h.send('roundIntro', { number: 1, kind: 'normal', cardType: 'especial' });
  assert.equal(h.show.snapshot().intro?.cardType, 'especial', 'the intro says what it will play');
  h.send('newRound');
  h.advance(FLOW.shuffleSec + 0.1);
  return h;
}

function land(h: Harness, count: number) {
  for (let i = 0; i < count; i++) {
    const position = h.show.position;
    h.send('next');
    h.until(() => h.show.position === position + 1 && h.show.status === 'playing');
  }
}

test('a round plays the card type it was introduced with: only those cards count, others fail as wrongType', () => {
  const h = especialRound();
  const state = h.show.snapshot();
  assert.equal(state.round.kind, 'normal');
  assert.equal(state.round.cardType, 'especial', 'newRound keeps the introduced round\'s type');
  const especial = validCards(allCards, h.show.cardsInPlay, 'especial');
  assert.equal(state.cards.validCount, especial.length);
  assert.deepEqual(h.show.phaseModel.valid.map((c) => c.id), especial.map((c) => c.id), 'the Phase reads the especial cards');
  assert.ok(!hasTie(especial, h.show.queue), 'the Shuffle checked the especial cards for a Tie');

  land(h, 3);
  const normalCard = allCards.find((c) => c.type === 'normal')!;
  const especialCard = especial[0];
  const first = checks(h.send('claim', { cardId: normalCard.id }))[0];
  assert.equal(first?.outcome, 'wrongType');
  assert.equal(first?.cardType, 'normal', 'the Check shows the card\'s own printed type');
  // Its cue, the first press (nothing to reveal), fails it; then an especial card.
  h.send('checkNext', { claimId: 'cl-1', step: 0 });
  assert.equal(h.show.claims[0].status, 'invalid');
  const second = checks(h.send('claim', { cardId: especialCard.id }))[0];
  assert.ok(second);
  assert.notEqual(second.outcome, 'wrongType');
  assert.equal(second.cardType, 'especial');
});

test('the card type is journaled, replayed and restored; an older journal plays the kind\'s default', () => {
  const h = especialRound();
  const entries = journalOf(h.log);
  const started = entries.find((e) => e.kind === 'round.started' && e.round === 1 && e.cardType === 'especial');
  assert.ok(started, 'round.started carries it');
  assert.ok(entries.some((e) => e.kind === 'scene.changed' && e.scene === 'roundStart' && e.cardType === 'especial'), 'and the intro\'s scene change');
  const record = replayJournal(entries);
  assert.equal(record.round?.cardType, 'especial');
  assert.deepEqual(record, h.show.record());
  const r = setup({ seed: 99, cards: allCards, restore: record, startSec: 0.5 });
  assert.equal(r.show.round.cardType, 'especial', 'a restarted page plays the same type');
  assert.deepEqual(r.show.phaseModel.valid.map((c) => c.id), h.show.phaseModel.valid.map((c) => c.id));

  // A journal from before card types per round: no cardType anywhere.
  const old = entries.map((e) => {
    if (!('cardType' in e)) return e;
    const { cardType: _cardType, ...rest } = e;
    return rest as JournalEntry;
  });
  assert.equal(replayJournal(old).round?.cardType, 'normal', 'a normal round plays normal cards');
  const special = old.map((e) => (e.kind === 'round.started' ? { ...e, roundKind: 'special' as const } : e));
  assert.equal(replayJournal(special).round?.cardType, 'especial', 'the special round plays especial cards');
});

test('a restart during the intro keeps the introduced type for the Shuffle', () => {
  const h = setup({ seed: 2, cards: allCards, cardsInPlay: CARDS, settings: { autoAdvance: false } });
  h.send('unlock');
  h.send('roundIntro', { number: 1, kind: 'normal', cardType: 'especial' });
  const record = replayJournal(journalOf(h.log));
  assert.deepEqual(record.intro, { round: 1, kind: 'normal', cardType: 'especial', side: 1 });
  const r = setup({ seed: 3, cards: allCards, restore: record, startSec: 0.5 });
  r.send('unlock');
  r.send('newRound');
  assert.equal(r.show.round.cardType, 'especial');
  // The console may still say otherwise.
  r.send('newRound', { number: 1, kind: 'normal', cardType: 'normal' });
  assert.equal(r.show.round.cardType, 'normal');
  // Another round than the one introduced plays its kind's default.
  const s = setup({ seed: 3, cards: allCards, restore: record, startSec: 0.5 });
  s.send('unlock');
  assert.deepEqual(rejected(s.send('newRound', { number: 2, kind: 'special' })), []);
  assert.equal(s.show.round.cardType, 'especial');
});

test('resume by hand: the token carries a non-default type, and the fresh page rebuilds the same round', () => {
  const a = especialRound(5);
  land(a, 4);
  const token = a.show.snapshot().resume;
  assert.ok(token);
  assert.equal(token.cardType, 'especial');
  assert.match(token.text, /-TESPECIAL$/);
  const { text: _text, ...fields } = token;
  assert.deepEqual(parseResumeToken(token.text), fields);

  const b = setup({ seed: 77, cards: allCards, cardsInPlay: CARDS, settings: { autoAdvance: false } });
  assert.deepEqual(rejected(b.dispatch(makeCommand('resumeAt', fields))), []);
  assert.deepEqual(b.show.queue, a.show.queue);
  assert.equal(b.show.round.cardType, 'especial');
  assert.equal(b.show.snapshot().resume?.text, token.text);
  const resumed = journalOf(b.log).find((e) => e.kind === 'round.resumed');
  assert.ok(resumed?.kind === 'round.resumed' && resumed.cardType === 'especial');
});

test('a card type that isn\'t an id is refused as invalid', () => {
  const h = setup({ seed: 1, cards: allCards, cardsInPlay: CARDS });
  for (const cardType of ['Especial', 'es-pecial', '', 'x'.repeat(25)]) {
    assert.deepEqual(rejected(h.send('roundIntro', { number: 1, kind: 'normal', cardType })), ['invalid'], cardType);
    assert.deepEqual(rejected(h.send('newRound', { cardType })), ['invalid'], cardType);
  }
});
