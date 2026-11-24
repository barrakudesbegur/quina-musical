// The Game journal: every fact the show writes replays to the show's own record, a restarted show resumes
// the Game from it, and a broken journal is refused instead of resuming from a wrong state.
import test from 'node:test';
import assert from 'node:assert/strict';
import { replayJournal, JournalError, type Command, type JournalEntry } from '@quina/protocol';
import { makeCommand } from '@quina/protocol';
import { LocalJournal, type KeyValueStorage } from '../engine/src/journal-store.ts';
import { seededRandom } from '../engine/src/rng.ts';
import type { Effect } from '../engine/src/show/show.ts';
import { setup, allCards, type Harness } from './support/harness.ts';

const journalOf = (effects: readonly Effect[]): JournalEntry[] => effects.flatMap((e) => (e.type === 'journal' ? [e.entry] : []));

/** Land `count` songs, one after the other. */
function landSongs(h: Harness, count: number) {
  for (let i = 0; i < count; i++) {
    const position = h.show.position;
    h.send('next');
    h.until(() => h.show.position === position + 1 && h.show.status === 'playing');
  }
}

test('every journal entry keeps the replayed record equal to the show (random commands, several seeds)', () => {
  const seen = new Set<string>();
  for (const seed of [3, 8, 13, 21]) {
    const h = setup({ seed, cards: allCards, cardsInPlay: '1-120', settings: { autoAdvance: false } });
    h.send('unlock');
    const rnd = seededRandom(seed * 7);
    const commands: (() => Command)[] = [
      () => makeCommand('next'),
      () => makeCommand('next'),
      () => makeCommand('next'),
      () => makeCommand('back'),
      () => makeCommand('hold', { on: rnd() < 0.5 }),
      () => makeCommand('holdMusic'),
      () => makeCommand('setPace', { delta: rnd() < 0.5 ? -2 : 2 }),
      () => makeCommand('setPace', { locked: rnd() < 0.5 }),
      () => makeCommand('setGame', { songsUntilWinner: Math.floor(rnd() * 10) }),
      () => makeCommand('setGame', { phaseOverride: rnd() < 0.7 ? null : 'late' }),
      () => makeCommand('confirmLine'),
      () => makeCommand('setCardsInPlay', { ranges: rnd() < 0.5 ? '1-80' : '1-200, 400-450' }),
      () => makeCommand('newRound', { kind: rnd() < 0.8 ? 'normal' : 'special' }),
    ];
    for (let step = 0; step < 120; step++) {
      // newRound is rare, so a round gets many landings.
      const pick = commands[Math.floor(rnd() * (rnd() < 0.97 ? commands.length - 1 : commands.length))];
      h.dispatch(pick());
      h.advance(rnd() * 12);
      const entries = journalOf(h.log);
      assert.deepEqual(replayJournal(entries), h.show.record(), `seed ${seed}, step ${step}`);
      assert.ok(entries.every((e, i) => e.seq === i + 1 && e.gameId === h.show.gameId), 'numbered 1, 2, 3… within one Game');
    }
    for (const entry of journalOf(h.log)) seen.add(entry.kind);
  }
  assert.deepEqual([...seen].sort(), ['cards.set', 'landing.undone', 'line.confirmed', 'round.started', 'settings.changed', 'song.landed']);
});

test('a restarted show resumes the Game: round, Queue, position, landings, confirmed Line, cards and settings', () => {
  const h = setup({ seed: 5, cards: allCards, cardsInPlay: '1-150', settings: { pace: 14, autoAdvance: false } });
  h.send('unlock');
  landSongs(h, 4);
  h.send('back'); // undo the 4th landing
  h.until(() => h.show.status === 'hold');
  h.send('confirmLine');
  h.send('setPace', { pace: 18, locked: true });
  landSongs(h, 2);
  const before = h.show.snapshot();
  const record = replayJournal(journalOf(h.log));

  // A new page: a new audio clock starting near 0, an hour later on the wall clock.
  const r = setup({ seed: 99, cards: allCards, restore: record, startSec: 0.5, epochMs: 1_700_000_000_000 + 3_600_000 });
  assert.deepEqual(r.show.record(), record, 'nothing changes by resuming');
  assert.equal(journalOf(r.log).length, 0, 'resuming writes no journal entry');
  const after = r.show.snapshot();
  assert.equal(after.status, 'locked');
  assert.deepEqual(after.queue, before.queue);
  assert.deepEqual(after.round, before.round);
  assert.deepEqual(after.cards, before.cards);
  assert.equal(after.phase, before.phase);
  assert.deepEqual(after.possibleWinners, before.possibleWinners);
  assert.deepEqual(after.landings, before.landings);
  assert.deepEqual({ ...after.game, nextRecipe: null }, { ...before.game, nextRecipe: null });
  // The drum keeps the songs not yet played, with the last landing under the pointer.
  const reset = r.log.find((e) => e.type === 'drumReset');
  assert.ok(reset && reset.type === 'drumReset');
  assert.equal(reset.selectId, record.round?.queue[record.round.position]);
  assert.deepEqual(new Set(reset.ids), new Set(record.round?.queue.slice(record.round.position)));

  // Play goes on with the next song in the Queue, and the journal goes on numbering.
  r.send('unlock');
  landSongs(r, 1);
  const next = journalOf(r.log);
  assert.equal(next.length, 1);
  assert.equal(next[0].kind, 'song.landed');
  assert.equal(next[0].seq, record.seq + 1);
  assert.equal(next[0].gameId, record.gameId);
  assert.deepEqual(replayJournal([...journalOf(h.log), ...next]), r.show.record());
});

test('a journal without its round, or out of order, or for another Game is refused', () => {
  const h = setup({ seed: 2, settings: { autoAdvance: false } });
  h.send('unlock');
  landSongs(h, 2);
  const entries = journalOf(h.log);
  assert.throws(() => replayJournal(entries.slice(1)), JournalError, 'missing first entry');
  assert.throws(() => replayJournal([entries[0], entries[2]]), JournalError, 'gap');
  assert.throws(() => replayJournal([...entries, entries.at(-1)!]), JournalError, 'repeated entry');
  assert.throws(() => replayJournal(entries.map((e, i) => (i === 1 ? { ...e, gameId: 'other' } : e))), JournalError, 'another Game');
  const landed = entries.findIndex((e) => e.kind === 'song.landed');
  const wrongSong = entries.map((e, i) => (i === landed && e.kind === 'song.landed' ? { ...e, songId: -1 } : e));
  assert.throws(() => replayJournal(wrongSong), JournalError, 'a song that is not at that Queue index');
  assert.deepEqual(replayJournal([]), { gameId: '', seq: 0, cardsInPlay: '', settings: null, round: null });
});

test('the local journal keeps entries per Game, resumes recent ones and refuses stale or broken ones', () => {
  const data = new Map<string, string>();
  const storage: KeyValueStorage = { getItem: (k) => data.get(k) ?? null, setItem: (k, v) => void data.set(k, v) };
  const h = setup({ seed: 7, settings: { autoAdvance: false } });
  h.send('unlock');
  landSongs(h, 3);
  const journal = new LocalJournal(storage);
  for (const entry of journalOf(h.log)) journal.append(entry);
  const lastMs = journalOf(h.log).at(-1)!.atMs;

  const page = new LocalJournal(storage); // a reloaded page
  const resumed = page.resume(lastMs + 60_000, 3_600_000);
  assert.ok(resumed.ok);
  assert.deepEqual(resumed.record, h.show.record());
  assert.deepEqual(page.resume(lastMs + 7_200_000, 3_600_000), { ok: false, reason: 'stale', detail: 'last entry 120 min ago' });
  const empty: KeyValueStorage = { getItem: () => null, setItem: () => {} };
  assert.deepEqual(new LocalJournal(empty).resume(0, 1), { ok: false, reason: 'none' });

  // A new Game moves the "current" pointer; the old journal stays stored.
  const other = setup({ seed: 8, epochMs: 1_800_000_000_000 });
  for (const entry of journalOf(other.log)) page.append(entry);
  assert.equal(data.get('mixer.journal.current'), other.show.gameId);
  assert.ok(data.has(`mixer.journal.${h.show.gameId}`));
  assert.notEqual(other.show.gameId, h.show.gameId);

  data.set(`mixer.journal.${other.show.gameId}`, '{"not": "a list"}');
  const broken = new LocalJournal(storage).resume(1_800_000_100_000, 3_600_000);
  assert.equal(broken.ok, false);
  assert.equal(!broken.ok && broken.reason, 'broken');
});
