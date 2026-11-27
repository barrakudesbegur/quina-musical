// The drum's public order and Spin seeds (D237, packages/protocol/drum.ts): the phones lay out and spin the same drum
// as the projector from the round's songs, its drumSeed and each Spin's spinSeed, and none of it tells the Queue.
import test from 'node:test';
import assert from 'node:assert/strict';
import { drumOrder, replayJournal, type JournalEntry } from '@quina/protocol';
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

test("the round's drum follows its public drumSeed, journaled; each Spin carries its spinSeed, and a restart keeps the order", () => {
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
