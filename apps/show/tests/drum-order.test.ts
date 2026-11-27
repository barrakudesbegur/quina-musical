// The drum's public order and Spin seeds (D237, packages/protocol/drum.ts): the phones lay out and spin the same drum
// as the projector from the round's songs, its drumSeed and each Spin's spinSeed, and none of it tells the Queue.
import test from 'node:test';
import assert from 'node:assert/strict';
import { drumOrder, replayJournal, type JournalEntry } from '@quina/protocol';
import { dataTest } from './support/data.ts';
import { setup } from './support/harness.ts';
import { FLOW } from '../engine/src/config.ts';
import type { Effect } from '../engine/src/show/show.ts';

const journalOf = (log: readonly Effect[]): JournalEntry[] => log.flatMap((e) => (e.type === 'journal' ? [e.entry] : []));

test('drumOrder: the same songs and seed give the same order, whatever order the songs come in', () => {
  const songs = [5, 3, 9, 1, 7, 2, 8];
  const order = drumOrder(songs, 42);
  assert.deepEqual([...order].sort((a, b) => a - b), [1, 2, 3, 5, 7, 8, 9], 'a permutation');
  assert.deepEqual(drumOrder([...songs].reverse(), 42), order, 'the input order (the secret Queue) changes nothing');
  assert.notDeepEqual(drumOrder(songs, 43), order, 'another seed, another drum');
  assert.deepEqual(drumOrder([], 1), []);
});

dataTest("the round's drum follows its public drumSeed, journaled; each Spin carries its spinSeed, and a restart keeps the order", () => {
  const h = setup({ seed: 7, settings: { autoAdvance: false } });
  h.send('unlock');
  h.send('roundIntro');
  const round = h.send('newRound');
  const started = journalOf(round).find((e) => e.kind === 'round.started');
  assert.ok(started?.kind === 'round.started' && typeof started.drumSeed === 'number');
  const reset = round.find((e): e is Extract<Effect, { type: 'drumReset' }> => e.type === 'drumReset');
  assert.deepEqual(reset?.ids, drumOrder(started.queue, started.drumSeed!), 'the drum in drumOrder');
  h.advance(FLOW.shuffleSec + 0.1);
  const out = h.send('next');
  const start = out.find((e): e is Extract<Effect, { type: 'startTransition' }> => e.type === 'startTransition');
  const event = out.flatMap((e) => (e.type === 'emit' && e.message.type === 'transition.scheduled' ? [e.message] : []))[0];
  assert.ok(start && event && Number.isInteger(event.spinSeed));
  assert.equal(start.drum.seed, event.spinSeed, 'the projector solves with the public seed');
  h.until(() => h.show.status === 'playing');
  // A restarted page keeps the round's drum order: the songs still to play and the last landing, in that order.
  const record = replayJournal(journalOf(h.log));
  assert.equal(record.round?.drumSeed, started.drumSeed);
  const r = setup({ seed: 9, restore: record, startSec: 0.5 });
  const again = r.log.find((e): e is Extract<Effect, { type: 'drumReset' }> => e.type === 'drumReset');
  const last = started.queue[0];
  assert.deepEqual(again?.ids, drumOrder(started.queue, started.drumSeed!).filter((id) => id === last || started.queue.indexOf(id) > 0));
  assert.equal(again?.selectId, last);
});

dataTest("the state's round carries the round's public drumSeed, the journal's, and keeps it across a restart", () => {
  const h = setup({ seed: 5, settings: { autoAdvance: false } });
  h.send('unlock');
  h.send('roundIntro');
  const started = journalOf(h.send('newRound')).find((e) => e.kind === 'round.started');
  assert.ok(started?.kind === 'round.started' && typeof started.drumSeed === 'number');
  assert.equal(h.show.snapshot().round.drumSeed, started.drumSeed);
  h.advance(FLOW.shuffleSec + 0.1);
  h.send('next');
  h.until(() => h.show.status === 'playing');
  const r = setup({ seed: 9, restore: replayJournal(journalOf(h.log)), startSec: 0.5 });
  assert.equal(r.show.snapshot().round.drumSeed, started.drumSeed, 'a restarted page keeps the order');
});

dataTest('Back, a cancelled Spin and a backed-out Suspense put the card back at its own place in the drum order, as the phones have it', () => {
  const h = setup({ seed: 7, settings: { autoAdvance: false, pace: 22 } });
  h.send('unlock');
  h.send('roundIntro');
  const started = journalOf(h.send('newRound')).find((e) => e.kind === 'round.started');
  assert.ok(started?.kind === 'round.started' && started.drumSeed != null);
  const { queue, drumSeed } = { queue: started.queue, drumSeed: started.drumSeed };
  const order = drumOrder(queue, drumSeed);
  // The phones' drum at a position: the songs still to play and the last landing, in drumOrder.
  const shown = (position: number) => order.filter((id) => queue.indexOf(id) >= position);
  // The returned card sits after exactly the shown cards that come before it in drumOrder.
  const placeOf = (ids: number[], id: number) => order.slice(0, order.indexOf(id)).filter((other) => ids.includes(other)).length;
  h.advance(FLOW.shuffleSec + 0.1);
  for (let position = 0; position < 3; position++) {
    h.send('next');
    h.until(() => h.show.position === position && h.show.status === 'playing', 60);
  }
  // Back while the third song plays: the second comes back.
  const back = h.send('back').find((e): e is Extract<Effect, { type: 'drumBack' }> => e.type === 'drumBack');
  assert.equal(back?.insertId, queue[1]);
  assert.deepEqual(back.ids, shown(1), "the drum's order after a Back is drumOrder, filtered to the cards shown");
  assert.equal(back.ids.indexOf(queue[1]), placeOf(back.ids, queue[1]), 'the card at its own place');
  // A Spin cancelled by Back: the second song (off the drum since the Spin started) comes back at its place.
  const spin = h.send('next').find((e): e is Extract<Effect, { type: 'startTransition' }> => e.type === 'startTransition');
  assert.equal(spin?.drum.removeId, queue[1]);
  h.advance(0.5);
  const cancel = h.send('back').find((e): e is Extract<Effect, { type: 'cancelTransition' }> => e.type === 'cancelTransition');
  assert.equal(cancel?.drum.insertId, queue[1]);
  assert.deepEqual(cancel.drum.ids, shown(1));
  // A Suspense backed out (D144): the same.
  const open = h.send('suspense').find((e): e is Extract<Effect, { type: 'startSuspense' }> => e.type === 'startSuspense');
  assert.equal(open?.drum.removeId, queue[1]);
  h.advance(3);
  const backOut = h.send('suspense', { on: false, cancel: true }).find((e): e is Extract<Effect, { type: 'cancelTransition' }> => e.type === 'cancelTransition');
  assert.ok(backOut?.backOut);
  assert.equal(backOut.drum.insertId, queue[1]);
  assert.deepEqual(backOut.drum.ids, shown(1));
  // Back to before the first landing: nothing comes back, the whole round's drum.
  h.send('back');
  const first = h.send('back').find((e): e is Extract<Effect, { type: 'drumBack' }> => e.type === 'drumBack');
  assert.equal(first?.insertId, null);
  assert.deepEqual(first.ids, order);
});
