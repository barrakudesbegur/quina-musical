// The Game journal: every fact the show writes replays to the show's own record, a restarted show resumes
// the Game from it, and a broken journal is refused instead of resuming from a wrong state.
import { HAS_DATA, NO_CARD, dataTest as test } from './support/data.ts';
import assert from 'node:assert/strict';
import { replayJournal, extendJournal, emptyRecord, checkCommand, isEvent, JournalError, type Command, type JournalEntry } from '@quina/protocol';
import { makeCommand } from '@quina/protocol';
import { LocalJournal, type KeyValueStorage } from '../engine/src/journal-store.ts';
import { seededRandom } from '../engine/src/rng.ts';
import type { Effect } from '../engine/src/show/show.ts';
import { cardSongIds } from '../engine/src/game/cards.ts';
import { FLOW } from '../engine/src/config.ts';
import { setup, allCards, songs, type Harness } from './support/harness.ts';

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
      // The show flow: Claims and verdicts by number (claim ids are cl-1, cl-2… in the Game), Winners, scenes.
      () => makeCommand('claim', { cardId: 1 + Math.floor(rnd() * 130) }),
      () => makeCommand('decide', { claimId: `cl-${1 + Math.floor(rnd() * 4)}`, valid: rnd() < 0.7 }),
      () => makeCommand('winnerInfo', { claimId: `cl-${1 + Math.floor(rnd() * 4)}`, notes: 'fila 2' }),
      () => makeCommand('interval'),
      () => makeCommand('roundIntro'),
      () => makeCommand('pause'),
      () => makeCommand('newRound', { kind: rnd() < 0.6 ? 'normal' : rnd() < 0.5 ? 'special' : 'desgraciat' }),
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
  assert.deepEqual([...seen].sort(), [
    'cards.set', 'claim.decided', 'claim.opened', 'landing.undone', 'line.confirmed', 'prizes.revealed', 'round.started', 'scene.changed', 'settings.changed', 'song.landed', 'winner.noted',
  ]);
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
  assert.deepEqual(replayJournal([]), emptyRecord(''));
  assert.deepEqual(emptyRecord('g'), {
    gameId: 'g', seq: 0, cardsInPlay: '', settings: null, round: null,
    scene: 'before', sceneSinceMs: 0, intro: null, claims: [], claimCount: 0, winners: [], prizesRevealed: [],
  });
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

test('extendJournal continues a replayed record at any point, and never changes the record it is given', () => {
  const h = setup({ seed: 11, cards: allCards, cardsInPlay: '1-150', settings: { autoAdvance: false } });
  h.send('unlock');
  landSongs(h, 4);
  h.send('back');
  h.until(() => h.show.status === 'hold');
  h.send('confirmLine');
  h.send('setPace', { pace: 18 });
  landSongs(h, 2);
  h.send('newRound', { kind: 'special' });
  landSongs(h, 3);
  const entries = journalOf(h.log);
  const whole = replayJournal(entries);
  assert.ok(entries.length > 10);
  for (let i = 0; i <= entries.length; i++) {
    const head = replayJournal(entries.slice(0, i), whole.gameId);
    const before = structuredClone(head);
    assert.deepEqual(extendJournal(head, entries.slice(i)), whole, `split at ${i}`);
    assert.deepEqual(head, before, 'the record passed in is unchanged');
  }
  const head = replayJournal(entries.slice(0, 5));
  assert.throws(() => extendJournal(head, entries.slice(6)), JournalError, 'a gap');
  assert.throws(() => extendJournal(head, entries.slice(4)), JournalError, 'a repeat');
  assert.throws(() => extendJournal(head, [{ ...entries[5], gameId: 'other' }]), JournalError, 'another Game');
});

// ---- the show flow in the journal ----------------------------------------------------------------------
const catalog = new Set(songs.map((s) => s.id));
const card = (() => {
  const found = allCards.find((c) => c.type === 'normal' && c.id <= 150 && cardSongIds(c).flat().every((id) => catalog.has(id))) ?? (HAS_DATA ? undefined : NO_CARD);
  assert.ok(found, 'a card with every song playable');
  return found;
})();
const rows = cardSongIds(card);
const fillers = songs.map((s) => s.id).filter((id) => !rows.flat().includes(id));
/** The card's Line after 4 landings, its Bingo after 12. */
const QUEUE = [...rows[0], ...rows[1], ...rows[2], ...fillers];

/** A Game up to its first Line's Celebration (Winner noted), plus whatever `then` does. */
function gameWithLine(then: (h: Harness) => void = () => {}) {
  const h = setup({ seed: 6, cards: allCards, cardsInPlay: '1-150', fixedQueue: QUEUE, settings: { autoAdvance: false } });
  h.send('unlock');
  landSongs(h, 4);
  h.send('claim', { cardId: card.id });
  h.send('decide', { claimId: 'cl-1', valid: true });
  h.send('winnerInfo', { claimId: 'cl-1', name: 'Joana', notes: 'taula 4' });
  then(h);
  const record = replayJournal(journalOf(h.log));
  assert.deepEqual(record, h.show.record(), 'the journal replays to the show');
  // A new page, an hour later.
  const r = setup({ seed: 99, cards: allCards, restore: record, startSec: 0.5, epochMs: 1_700_000_000_000 + 3_600_000 });
  assert.deepEqual(r.show.record(), record, 'nothing changes by resuming');
  assert.equal(journalOf(r.log).length, 0, 'resuming writes no journal entry');
  return { h, r, record };
}

test('every show-flow fact is journaled and replayed: scenes, Claims, verdicts, Winners and the Shuffle seed', () => {
  const { record } = gameWithLine();
  assert.equal(record.scene, 'celebration');
  assert.deepEqual(record.claims.map((c) => [c.claimId, c.cardId, c.kind, c.position, c.verdict]), [['cl-1', card.id, 'line', 3, 'valid']]);
  assert.equal(record.claimCount, 1);
  assert.deepEqual(record.winners.map((w) => [w.claimId, w.kind, w.winningSongId, w.position, w.name, w.notes]), [['cl-1', 'line', QUEUE[3], 3, 'Joana', 'taula 4']]);
  assert.equal(record.round?.climbingTo, 'bingo');
  assert.equal(record.round?.shuffleSeed, 0, 'a fixed Queue');
  const entries = replayable();
  // extendJournal agrees with replayJournal at every split point, the new kinds included.
  const whole = replayJournal(entries);
  for (let i = 0; i <= entries.length; i++) assert.deepEqual(extendJournal(replayJournal(entries.slice(0, i), whole.gameId), entries.slice(i)), whole, `split at ${i}`);
  // A broken flow is refused: a verdict on an unknown Claim, a Winner without a Claim.
  const decided = entries.findIndex((e) => e.kind === 'claim.decided');
  const bad = entries.map((e, i) => (i === decided && e.kind === 'claim.decided' ? { ...e, claimId: 'cl-9' } : e));
  assert.throws(() => replayJournal(bad), JournalError);
  const noted = entries.findIndex((e) => e.kind === 'winner.noted');
  assert.throws(() => replayJournal(entries.map((e, i) => (i === noted && e.kind === 'winner.noted' ? { ...e, claimId: 'cl-7' } : e))), JournalError);
});

function replayable(): JournalEntry[] {
  const h = setup({ seed: 6, cards: allCards, cardsInPlay: '1-150', fixedQueue: QUEUE, settings: { autoAdvance: false } });
  h.send('unlock');
  landSongs(h, 4);
  h.send('claim', { cardId: card.id });
  h.send('decide', { claimId: 'cl-1', valid: true });
  h.send('winnerInfo', { claimId: 'cl-1', name: 'Joana' });
  return journalOf(h.log);
}

test('a resumed Game comes back in its Celebration, with its Winners, and its music once unlocked', () => {
  const { r } = gameWithLine();
  assert.equal(r.show.scene, 'celebration');
  assert.equal(r.show.status, 'locked');
  assert.deepEqual(r.show.celebration && [r.show.celebration.kind, r.show.celebration.cardIds, r.show.celebration.winningSongId], ['line', [card.id], QUEUE[3]]);
  assert.equal(r.show.winners[0]?.name, 'Joana');
  const out = r.send('unlock');
  assert.equal(r.show.status, 'hold');
  assert.equal(out.find((e) => e.type === 'celebrationMusic')?.type, 'celebrationMusic');
  // Next goes back to the round, climbing towards the Bingo.
  r.send('next');
  assert.equal(r.show.scene, 'play');
  assert.equal(r.show.phaseModel.kind, 'bingo');
});

test('a resumed Game comes back in a Check: undecided Claims queued, the Check starting again once unlocked', () => {
  const { r } = gameWithLine((h) => {
    h.send('next');
    h.until(() => h.show.status === 'playing');
    h.send('claim', { cardId: card.id, kind: 'bingo' }); // its Check is running when the page dies
    assert.equal(h.show.claims[1].status, 'checking');
  });
  assert.equal(r.show.scene, 'check');
  assert.deepEqual(r.show.claims.map((c) => c.status), ['valid', 'queued']);
  const out = r.send('unlock');
  assert.ok(out.some((e) => e.type === 'checkSnippets'));
  assert.equal(r.show.claims[1].status, 'checking');
  assert.ok(r.show.holdMusic, 'Hold music under it');
  r.send('decide', { claimId: 'cl-2', valid: false });
  assert.equal(r.show.scene, 'play');
  assert.equal(r.show.hold?.reason, 'checkFailed');
});

test('a resumed Game comes back in the Interval, or in a round being introduced, and gets its music back', () => {
  const interval = gameWithLine((h) => {
    h.send('next');
    h.until(() => h.show.status === 'playing');
    landSongs(h, 7);
    h.send('claim', { cardId: card.id });
    h.send('decide', { claimId: 'cl-2', valid: true });
    h.send('interval');
  });
  const r = interval.r;
  assert.equal(r.show.scene, 'interval');
  assert.equal(r.show.interval?.nextRound, 2);
  assert.equal(r.show.interval?.sinceMs, interval.record.sceneSinceMs);
  assert.deepEqual(r.show.winners.map((w) => w.kind), ['line', 'bingo']);
  assert.ok(r.send('unlock').some((e) => e.type === 'intervalMusic'));
  assert.deepEqual(r.send('next').filter((e) => e.type === 'reject').map((e) => e.type === 'reject' && e.reason), ['wrongScene']);

  const intro = gameWithLine((h) => {
    h.send('next');
    h.until(() => h.show.status === 'playing');
    landSongs(h, 7);
    h.send('claim', { cardId: card.id });
    h.send('decide', { claimId: 'cl-2', valid: true });
    h.send('roundIntro', { number: 3, kind: 'special' });
  });
  assert.equal(intro.r.show.scene, 'roundStart');
  assert.deepEqual(intro.r.show.intro && [intro.r.show.intro.round, intro.r.show.intro.kind], [3, 'special']);
  intro.r.send('unlock');
  intro.r.send('newRound');
  assert.deepEqual([intro.r.show.round.number, intro.r.show.round.kind], [3, 'special'], 'the introduced round, kind included');
  intro.r.advance(FLOW.shuffleSec + 0.1);
  assert.equal(intro.r.show.scene, 'play');
  assert.equal(intro.r.show.winners.length, 2, 'the Game keeps its Winners');
  assert.equal(intro.r.show.claims.length, 0);
  assert.equal(intro.r.show.claimCount, 2, 'claim ids go on: the next is cl-3');
});

test('getJournal: the show asks its runtime for the entries, even while locked, and the answer is a known event', () => {
  const h = setup({ seed: 2 });
  h.send('getJournal', { fromSeq: 3 });
  assert.equal(h.show.status, 'locked');
  h.send('getJournal');
  const asked = h.log.flatMap((e) => (e.type === 'journalRequest' ? [e.fromSeq] : []));
  assert.deepEqual(asked, [3, 1], 'without fromSeq: the whole journal');
  assert.equal(h.log.some((e) => e.type === 'reject'), false, 'not rejected as locked');
  assert.equal(checkCommand({ v: 1, type: 'cmd', cmd: 'getJournal', reqId: 'r', fromSeq: 0 }).ok, false, 'fromSeq starts at 1');
  assert.ok(isEvent({ v: 1, type: 'journal.entries', reqId: 'r', gameId: null, entries: [] }));
});

test('the relay\'s own messages are events a remote accepts: the client list and the Game plan', () => {
  assert.ok(isEvent({ v: 1, type: 'relay.clients', clients: [] }));
  assert.ok(isEvent({ v: 1, type: 'relay.plan', plan: null, savedAtMs: null }));
  assert.equal(isEvent({ v: 2, type: 'relay.plan', plan: null, savedAtMs: null }), false, 'another protocol version');
  assert.equal(isEvent({ v: 1, type: 'relay.secrets' }), false);
});
