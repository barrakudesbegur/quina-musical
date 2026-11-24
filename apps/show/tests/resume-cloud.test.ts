// A show page booting with the cloud link's copy (relay /cloud/): which Game it resumes, and that a cloud
// journal becomes its own, so it numbers on. Admin's manual resume wins when newer than the local journal.
import test from 'node:test';
import assert from 'node:assert/strict';
import { replayJournal, type JournalEntry } from '@quina/protocol';
import { LocalJournal, chooseResume, parseJournalLines, type CloudCopy, type KeyValueStorage } from '../engine/src/journal-store.ts';
import type { Effect } from '../engine/src/show/show.ts';
import { setup, type Harness } from './support/harness.ts';

const HOUR = 3_600_000;
const journalOf = (effects: readonly Effect[]): JournalEntry[] => effects.flatMap((e) => (e.type === 'journal' ? [e.entry] : []));

function storage() {
  const data = new Map<string, string>();
  const kv: KeyValueStorage = { getItem: (k) => data.get(k) ?? null, setItem: (k, v) => void data.set(k, v) };
  return { data, kv };
}
/** A Game that landed `songs` songs. */
function game(songs: number, seed: number, epochMs = 1_700_000_000_000): Harness {
  const h = setup({ seed, epochMs, settings: { autoAdvance: false } });
  h.send('unlock');
  for (let i = 0; i < songs; i++) {
    const p = h.show.position;
    h.send('next');
    h.until(() => h.show.position === p + 1 && h.show.status === 'playing');
  }
  return h;
}
function cloudOf(journals: Record<string, JournalEntry[]>, extra: { resume?: { gameId: string; seq: number; atMs: number }; current?: string } = {}): CloudCopy {
  return {
    resume: async () => extra.resume ?? null,
    current: async () => extra.current ?? null,
    journal: async (gameId) => journals[gameId] ?? null,
  };
}

test('the cloud copy is read as the link writes it: JSON lines in any order, sorted by seq; a bad line is refused', () => {
  const entries = journalOf(game(2, 3).log);
  const text = [...entries].reverse().map((e) => JSON.stringify(e)).join('\n') + '\n';
  assert.deepEqual(parseJournalLines(text), entries);
  assert.throws(() => parseJournalLines(text + '{oops\n'), /line/);
  assert.throws(() => parseJournalLines('{"hello": 1}\n'), /not an entry/);
});

test('Admin\'s manual resume wins over an older local journal, up to its entry; the local one is archived, never lost', async () => {
  const cloudGame = game(5, 7);
  const cloudEntries = journalOf(cloudGame.log);
  const mine = game(2, 9);
  const { data, kv } = storage();
  const local = new LocalJournal(kv);
  for (const e of journalOf(mine.log)) local.append(e);
  const localLast = journalOf(mine.log).at(-1)!.atMs;
  const upTo = cloudEntries.findLast((e) => e.kind === 'song.landed' && e.position === 2)!.seq;
  const choice = await chooseResume({
    local, nowMs: localLast + 60_000, maxAgeMs: 12 * HOUR,
    cloud: cloudOf({ [cloudGame.show.gameId]: cloudEntries }, { resume: { gameId: cloudGame.show.gameId, seq: upTo, atMs: localLast + 30_000 } }),
  });
  assert.ok(choice.source === 'cloud', choice.source);
  assert.equal(choice.record.round?.position, 2, 'resumed at the chosen entry');
  assert.deepEqual(choice.record, replayJournal(cloudEntries.filter((e) => e.seq <= upTo)));
  // It is this page's journal now: a reload resumes it locally, and new entries number on from upTo.
  assert.equal(data.get('mixer.journal.current'), cloudGame.show.gameId);
  const again = new LocalJournal(kv).resume(localLast + 90_000, 12 * HOUR);
  assert.ok(again.ok && again.record.seq === upTo);
  assert.ok(data.has(`mixer.journal.${mine.show.gameId}`), 'the other Game is still stored');
});

test('a manual resume older than the local journal is not applied again; the local journal wins', async () => {
  const mine = game(3, 4);
  const { kv } = storage();
  const local = new LocalJournal(kv);
  for (const e of journalOf(mine.log)) local.append(e);
  const last = journalOf(mine.log).at(-1)!.atMs;
  const other = game(4, 8);
  const choice = await chooseResume({
    local, nowMs: last + 1000, maxAgeMs: 12 * HOUR,
    cloud: cloudOf({ [other.show.gameId]: journalOf(other.log) }, { resume: { gameId: other.show.gameId, seq: 3, atMs: last - 1000 } }),
  });
  assert.ok(choice.source === 'local', choice.source);
  assert.equal(choice.record.gameId, mine.show.gameId);
});

test('a new laptop with nothing local resumes the cloud copy\'s current Game, if it is recent', async () => {
  const g = game(4, 11);
  const entries = journalOf(g.log);
  const last = entries.at(-1)!.atMs;
  const fresh = () => new LocalJournal(storage().kv);
  const recent = await chooseResume({ local: fresh(), nowMs: last + HOUR, maxAgeMs: 12 * HOUR, cloud: cloudOf({ [g.show.gameId]: entries }, { current: g.show.gameId }) });
  assert.ok(recent.source === 'cloud', recent.source);
  assert.equal(recent.record.round?.position, 3);
  const stale = await chooseResume({ local: fresh(), nowMs: last + 13 * HOUR, maxAgeMs: 12 * HOUR, cloud: cloudOf({ [g.show.gameId]: entries }, { current: g.show.gameId }) });
  assert.equal(stale.source, 'none');
  const offline = await chooseResume({ local: fresh(), nowMs: last, maxAgeMs: 12 * HOUR, cloud: null });
  assert.equal(offline.source, 'none');
});

test('a broken cloud journal is never resumed from: the page says why and tries the next source', async () => {
  const g = game(3, 5);
  const entries = journalOf(g.log);
  const gap = entries.filter((e) => e.seq !== 2);
  const mine = game(2, 6);
  const { kv } = storage();
  const local = new LocalJournal(kv);
  for (const e of journalOf(mine.log)) local.append(e);
  const last = journalOf(mine.log).at(-1)!.atMs;
  const choice = await chooseResume({
    local, nowMs: last + 1000, maxAgeMs: 12 * HOUR,
    cloud: cloudOf({ [g.show.gameId]: gap }, { resume: { gameId: g.show.gameId, seq: 99, atMs: last + 500 } }),
  });
  assert.equal(choice.source, 'local', 'fell back to the local journal');
  assert.ok(choice.warnings.some((w) => /cloud resume not used/.test(w)), choice.warnings.join('; '));
});
