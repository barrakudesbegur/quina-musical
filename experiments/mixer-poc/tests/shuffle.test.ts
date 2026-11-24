// The tie-free Shuffle (game/shuffle.ts) on the real cards (card-generator/dist/cards.json), and how the show
// uses it: deterministic from its seed, never a Tie on the first Line or Bingo among the valid cards in play.
import test from 'node:test';
import assert from 'node:assert/strict';
import { tieFreeShuffle, seededQueue, hasTie } from '../engine/src/game/shuffle.ts';
import { firstWinAt, parseCardRanges, validCards } from '../engine/src/game/cards.ts';
import { mixSeed } from '../engine/src/rng.ts';
import { FLOW } from '../engine/src/config.ts';
import type { JournalEntry } from '@quina/protocol';
import type { Effect } from '../engine/src/show/show.ts';
import { setup, songs, allCards } from './support/harness.ts';

const pool = songs.map((s) => s.id);
const valid = (ranges: string, kind: 'normal' | 'special' = 'normal') => validCards(allCards, parseCardRanges(ranges), kind);
const roundsStarted = (effects: readonly Effect[]) =>
  effects.flatMap((e) => (e.type === 'journal' && e.entry.kind === 'round.started' ? [e.entry] : []));
const seeds = (n: number, from = 1) => Array.from({ length: n }, (_, i) => mixSeed(0xc0ffee, from + i));

test('the same seed always gives the same Queue; draws of one seed differ', () => {
  const cards = valid('1-200');
  for (const seed of seeds(5)) {
    const a = tieFreeShuffle({ pool, cards, seed, maxAttempts: 500 });
    const b = tieFreeShuffle({ pool, cards, seed, maxAttempts: 500 });
    assert.deepEqual(a, b);
    assert.deepEqual(a.queue, seededQueue(pool, seed, a.attempts), 'the Queue is draw number `attempts` of the seed');
    assert.deepEqual([...a.queue].sort((x, y) => x - y), [...pool].sort((x, y) => x - y), 'a permutation of the Pool');
  }
  assert.notDeepEqual(seededQueue(pool, 7, 0), seededQueue(pool, 7, 1));
  assert.notDeepEqual(seededQueue(pool, 7, 0), seededQueue(pool, 8, 0));
});

test('with cards in play, neither the first Line nor the first Bingo is a Tie (normal and special rounds)', () => {
  let reshuffled = 0;
  for (const [ranges, kind] of [['1-200', 'normal'], ['1-60', 'normal'], ['1-150, 400-450', 'special']] as const) {
    const cards = valid(ranges, kind);
    assert.ok(cards.length > 10, `${ranges} ${kind}: ${cards.length} valid cards`);
    for (const seed of seeds(20)) {
      const r = tieFreeShuffle({ pool, cards, seed, maxAttempts: FLOW.shuffleMaxAttempts });
      assert.equal(r.tied, false, `${ranges}, seed ${seed}`);
      for (const kindWon of ['line', 'bingo'] as const) {
        const win = firstWinAt(cards, r.queue, kindWon);
        assert.ok(win && win.cardIds.length === 1, `${ranges}, seed ${seed}: first ${kindWon} ${JSON.stringify(win)}`);
      }
      if (r.attempts > 0) {
        reshuffled++;
        assert.ok(hasTie(cards, seededQueue(pool, seed, r.attempts - 1)), 'the draw before the kept one had a Tie');
      }
    }
  }
  assert.ok(reshuffled > 0, 'ties do happen with real cards, so the rule is exercised');
});

test('no cards in play: nothing to check, the first draw is kept', () => {
  const r = tieFreeShuffle({ pool, cards: [], seed: 42, maxAttempts: 500 });
  assert.deepEqual(r, { queue: seededQueue(pool, 42, 0), seed: 42, attempts: 0, tied: false });
});

test('when every draw ties up to the limit, the last one is kept and flagged', () => {
  // Two copies of the same card always tie.
  const card = valid('1-200')[0];
  const twins = [card, { ...card, id: 99_999 }];
  const r = tieFreeShuffle({ pool, cards: twins, seed: 5, maxAttempts: 7 });
  assert.equal(r.tied, true);
  assert.equal(r.attempts, 6);
  assert.deepEqual(r.queue, seededQueue(pool, 5, 6));
});

test('the show draws a secret seed per round, journals it with the attempts, and never ties', () => {
  const h = setup({ seed: 31, cards: allCards, cardsInPlay: '1-200' });
  h.send('unlock');
  h.send('newRound', { number: 2 });
  const started: JournalEntry[] = roundsStarted(h.log);
  assert.equal(started.length, 2);
  for (const entry of started) {
    assert.ok(entry.kind === 'round.started');
    assert.ok(entry.shuffleSeed > 0 && Number.isInteger(entry.shuffleSeed));
    assert.deepEqual(entry.queue, seededQueue([...h.show.catalog.keys()], entry.shuffleSeed, entry.shuffleAttempts));
    const cards = valid('1-200');
    for (const kind of ['line', 'bingo'] as const) assert.equal(firstWinAt(cards, entry.queue, kind)?.cardIds.length, 1);
  }
  assert.notEqual(started[0].kind === 'round.started' && started[0].shuffleSeed, started[1].kind === 'round.started' && started[1].shuffleSeed);
  assert.equal(h.show.record().round?.shuffleSeed, h.show.shuffleSeed);
});

test('a fixed Queue bypasses the Shuffle: seed 0, attempts 0', () => {
  const queue = pool.slice(0, 20).reverse();
  const h = setup({ cards: allCards, cardsInPlay: '1-200', fixedQueue: queue });
  const [entry] = roundsStarted(h.log);
  assert.ok(entry?.kind === 'round.started');
  assert.deepEqual(entry.queue, queue);
  assert.equal(entry.shuffleSeed, 0);
  assert.equal(entry.shuffleAttempts, 0);
});

test('the Shuffle in the show: roundStart, `shuffle.scheduled` without the Queue, nothing lands before it ends', () => {
  const h = setup({ seed: 4, cards: allCards, cardsInPlay: '1-200', settings: { autoAdvance: false } });
  h.send('unlock');
  const out = h.send('newRound');
  assert.equal(h.show.round.number, 1, 'in `before`, newRound starts round 1 again');
  const scheduled = out.flatMap((e) => (e.type === 'emit' && e.message.type === 'shuffle.scheduled' ? [e.message] : []));
  assert.equal(scheduled.length, 1);
  const s = scheduled[0];
  assert.equal(s.endAtMs - s.startAtMs, FLOW.shuffleSec * 1000);
  assert.equal(s.songCount, pool.length);
  assert.ok(!('queue' in s), 'never the Queue');
  assert.equal(h.show.scene, 'roundStart');
  // Next waits for the animation; its Spin starts when it ends.
  const next = h.send('next');
  assert.ok(!next.some((e) => e.type === 'startTransition'));
  assert.ok(h.show.pending);
  const during = h.advance(FLOW.shuffleSec - 0.2);
  assert.ok(!during.some((e) => e.type === 'startTransition'));
  const after = h.advance(0.3);
  assert.equal(h.show.scene, 'play');
  const start = after.find((e) => e.type === 'startTransition');
  assert.ok(start && start.type === 'startTransition' && start.plan.T > h.show.env.now(), 'the first landing comes after the Shuffle');
});
