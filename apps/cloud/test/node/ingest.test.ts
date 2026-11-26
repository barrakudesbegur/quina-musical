// Journal uploads: idempotent by seq, never applied out of order, a different resent entry is a conflict, and a
// broken entry stops the upload where it is. The record the cloud keeps always equals replaying what it stored.
import test from 'node:test';
import assert from 'node:assert/strict';
import { emptyRecord, replayJournal, type JournalEntry } from '@quina/protocol';
import { ingest } from '../../src/domain/ingest.ts';
import { canonicalJson, checkJournalEntry } from '../../src/domain/journal-check.ts';
import { JournalBuilder } from '../support/journal-builder.ts';

/** The cloud's side of a test: its record and what it stored. */
function cloud(gameId: string) {
  let record = emptyRecord(gameId);
  const stored = new Map<number, string>();
  return {
    get record() {
      return record;
    },
    stored,
    upload(batch: readonly unknown[]) {
      const result = ingest(record, batch, (seq) => stored.get(seq) ?? null);
      for (const { entry, json } of result.accepted) stored.set(entry.seq, json);
      record = result.record;
      return result;
    },
  };
}

const sample = JournalBuilder.sampleGame();
const entries = sample.entries;

test('the sample journal replays (it uses every entry kind)', () => {
  const kinds = new Set(entries.map((e) => e.kind));
  assert.equal(kinds.size, 10); // every kind but round.resumed (its own test in projection.test.ts)
  assert.doesNotThrow(() => replayJournal(entries));
});

test('uploads in batches of any size end in the same record as one replay', () => {
  for (const size of [1, 3, 7, entries.length]) {
    const c = cloud(sample.gameId);
    for (let i = 0; i < entries.length; i += size) {
      const result = c.upload(entries.slice(i, i + size));
      assert.equal(result.stop, null);
    }
    assert.deepEqual(c.record, replayJournal(entries), `batch size ${size}`);
    assert.equal(c.stored.size, entries.length);
  }
});

test('resending is harmless: the same entries are skipped, the record does not change', () => {
  const c = cloud(sample.gameId);
  c.upload(entries.slice(0, 10));
  const result = c.upload(entries.slice(0, 15));
  assert.equal(result.duplicates, 10);
  assert.equal(result.accepted.length, 5);
  assert.equal(result.stop, null);
  assert.equal(c.record.seq, 15);
  const again = c.upload(entries.slice(5, 15));
  assert.equal(again.accepted.length, 0);
  assert.equal(again.record, c.record, 'the same record object when nothing was accepted');
});

test('a gap is never applied: the cloud keeps what came before and asks for the missing entry', () => {
  const c = cloud(sample.gameId);
  const result = c.upload([...entries.slice(0, 4), ...entries.slice(6, 9)]);
  assert.deepEqual(result.stop, { kind: 'gap', fromSeq: 5 });
  assert.equal(c.record.seq, 4);
  assert.equal(c.upload(entries.slice(4, 9)).stop, null);
  assert.deepEqual(c.record, replayJournal(entries.slice(0, 9)));
});

test('entries out of order within an upload are sorted first', () => {
  const c = cloud(sample.gameId);
  const result = c.upload(entries.slice(0, 8).reverse());
  assert.equal(result.stop, null);
  assert.equal(c.record.seq, 8);
});

test('a different entry with a seq the cloud has is a conflict, and nothing after it is taken', () => {
  const c = cloud(sample.gameId);
  c.upload(entries.slice(0, 10));
  const other = { ...entries[4], atMs: (entries[4] as JournalEntry).atMs + 1 };
  const result = c.upload([other, ...entries.slice(10, 12)]);
  assert.equal(result.stop?.kind, 'conflict');
  assert.equal(result.accepted.length, 0);
  assert.equal(c.record.seq, 10);
});

test('the same entry with its keys in another order is not a conflict (canonical JSON)', () => {
  const c = cloud(sample.gameId);
  c.upload(entries.slice(0, 3));
  const reordered = Object.fromEntries(Object.entries(entries[2] as JournalEntry).reverse());
  assert.equal(canonicalJson(reordered), canonicalJson(entries[2]));
  const result = c.upload([reordered]);
  assert.equal(result.duplicates, 1);
  assert.equal(result.stop, null);
});

test('a broken entry stops the upload at it; what came before is kept', () => {
  const c = cloud(sample.gameId);
  const landed = entries.findIndex((e) => e.kind === 'song.landed');
  const wrongSong = { ...entries[landed], songId: 9999 };
  const result = c.upload([...entries.slice(0, landed), wrongSong, ...entries.slice(landed + 1, landed + 3)]);
  assert.equal(result.stop?.kind, 'invalid');
  assert.match(result.stop?.kind === 'invalid' ? result.stop.detail : '', /not at Queue index/);
  assert.equal(c.record.seq, landed);
});

test("another Game's entry, or garbage, is refused before anything is taken", () => {
  const c = cloud(sample.gameId);
  assert.equal(c.upload([entries[0], { ...entries[1], gameId: 'other' }]).stop?.kind, 'invalid');
  assert.equal(c.record.seq, 0);
  for (const garbage of [null, 7, 'x', [], { kind: 'song.landed' }, { ...entries[0], seq: 0 }, { ...entries[0], kind: 'unknown.kind' }]) {
    const result = c.upload([garbage]);
    assert.equal(result.stop?.kind, 'invalid', JSON.stringify(garbage));
  }
  assert.equal(c.record.seq, 0);
});

test('the entry check: types of known fields, extra fields allowed, unknown kinds and huge entries refused', () => {
  for (const entry of entries) assert.ok(checkJournalEntry(entry).ok, entry.kind);
  const started = entries.find((e) => e.kind === 'round.started') as JournalEntry;
  assert.ok(checkJournalEntry({ ...started, addedLater: true }).ok, 'an additive field');
  const { shuffleSeed: _seed, shuffleAttempts: _attempts, ...older } = started as JournalEntry & { shuffleSeed: number; shuffleAttempts: number };
  assert.ok(checkJournalEntry(older).ok, 'a journal from before the tie-free Shuffle');
  assert.ok(checkJournalEntry({ ...started, cardType: 'especial' }).ok, 'a round naming its card type');
  const intro = entries.find((e) => e.kind === 'scene.changed') as JournalEntry;
  assert.ok(checkJournalEntry({ ...intro, cardType: 'groc' }).ok, 'an intro naming its card type');
  assert.ok(checkJournalEntry({ ...started, roundKind: 'desgraciat' }).ok, 'the Desgraciat round');
  const opened = entries.find((e) => e.kind === 'claim.opened') as JournalEntry;
  assert.ok(checkJournalEntry({ ...opened, winKind: 'standing' }).ok, 'a claim for the last card standing');
  const decided = entries.find((e) => e.kind === 'claim.decided') as JournalEntry;
  for (const outcome of ['complete', 'fellLast', 'fallen', 'incomplete']) assert.ok(checkJournalEntry({ ...decided, outcome }).ok, `the Check's outcome ${outcome}`);
  const noted = entries.find((e) => e.kind === 'winner.noted') as JournalEntry;
  assert.ok(checkJournalEntry({ ...noted, slip: '17' }).ok, "a winner's slip");
  assert.ok(checkJournalEntry({ ...noted, slip: null }).ok, 'a slip cleared');
  // The presenter-paced Check's Review (D118–D121): under review, continued, discarded, or decided by hand.
  const base = { gameId: decided.gameId, seq: 99, atMs: 1, round: 1, claimId: 'c1' };
  assert.ok(checkJournalEntry({ ...base, kind: 'claim.reviewing' }).ok, 'a Check put under review');
  assert.ok(checkJournalEntry({ ...base, kind: 'claim.continued' }).ok, 'a Review that goes on with the Check');
  assert.ok(checkJournalEntry({ ...base, kind: 'claim.discarded' }).ok, 'a claim discarded');
  assert.equal(checkJournalEntry({ ...base, kind: 'claim.dropped' }).ok, false, "D124's old name isn't a kind");
  assert.equal(checkJournalEntry({ ...base, kind: 'claim.reviewing', claimId: 7 }).ok, false, 'the claim id is text');
  assert.equal(checkJournalEntry({ ...base, kind: 'claim.stopped' }).ok, false, "the step-1 name isn't a kind");
  assert.ok(checkJournalEntry({ ...decided, manual: true }).ok, 'a decision by hand');
  assert.equal(checkJournalEntry({ ...decided, manual: false }).ok, false, '`manual` is true or absent');
  // The Desgraciat's finale (D166–D172): its finalists, set whole each time; empty calls it off.
  const finale = { ...base, kind: 'finale.set', cardIds: [7, 12, 40] };
  assert.ok(checkJournalEntry(finale).ok, 'the finalists');
  assert.ok(checkJournalEntry({ ...finale, cardIds: [] }).ok, 'the finale called off');
  assert.ok(checkJournalEntry({ ...finale, cardIds: [7], byHand: true }).ok, 'a removal that left one: won by hand');
  assert.equal(checkJournalEntry({ ...finale, cardIds: [7, 7] }).ok, false, 'a finalist twice');
  assert.equal(checkJournalEntry({ ...finale, cardIds: Array.from({ length: 21 }, (_, i) => i + 1) }).ok, false, 'more than 20');
  assert.equal(checkJournalEntry({ ...finale, cardIds: ['7'] }).ok, false, 'card numbers, not text');
  assert.equal(checkJournalEntry({ ...finale, byHand: false }).ok, false, '`byHand` is true or absent');
  // The volume sliders (D139): percents, absent until set; a slider this cloud doesn't know yet never stalls uploads.
  const changed = entries.find((e) => e.kind === 'settings.changed') as JournalEntry & { settings: object };
  assert.ok(checkJournalEntry({ ...changed, settings: { ...changed.settings, volumes: { master: 80, songsParlem: 45, end: 0, throws: 150 } } }).ok, 'the volumes, up to 150% (D157)');
  assert.ok(checkJournalEntry({ ...changed, settings: { ...changed.settings, volumes: { master: 100, laterSlider: 300 } } }).ok, 'a slider added later');
  // The remote's shake switch (D148): a boolean, absent in an older journal.
  assert.ok(checkJournalEntry({ ...changed, settings: { ...changed.settings, remoteShake: false } }).ok, 'the shake switch off');
  const bad: [string, unknown][] = [
    ['a volume above its most (150%)', { ...changed, settings: { ...changed.settings, volumes: { master: 151 } } }],
    ['a volume as text', { ...started, settings: { ...changed.settings, volumes: { songs: '80' } } }],
    ['volumes as a list', { ...changed, settings: { ...changed.settings, volumes: [80] } }],
    ['the shake switch as text', { ...changed, settings: { ...changed.settings, remoteShake: 'on' } }],
    ['win kind', { ...opened, winKind: 'quina' }],
    ['an outcome the protocol does not know', { ...decided, outcome: 'won' }],
    ['a slip longer than 16', { ...noted, slip: 'x'.repeat(17) }],
    ['verdict fallen (a live Check outcome, never journalled)', { ...entries.find((e) => e.kind === 'claim.decided'), verdict: 'fallen' }],
    ['card type with a dash (the resume code splits on it)', { ...started, cardType: 'cartro-groc' }],
    ['card type in capitals', { ...intro, cardType: 'Especial' }],
    ['card type as a number', { ...started, kind: 'round.resumed', position: 0, lineConfirmedFrom: null, cardType: 2 }],
    ['queue with a repeat', { ...started, queue: [1, 2, 2] }],
    ['queue of strings', { ...started, queue: ['1'] }],
    ['settings missing a field', { ...started, settings: { pace: 14 } }],
    ['round kind', { ...started, roundKind: 'bonus' }],
    ['seq 1.5', { ...started, seq: 1.5 }],
    ['empty gameId', { ...started, gameId: '' }],
    ['atMs as text', { ...started, atMs: '1' }],
    ['unknown kind', { ...started, kind: 'round.paused' }],
    ['resumed past the Queue', { ...started, kind: 'round.resumed', position: 77, lineConfirmedFrom: null }],
    ['huge', { ...started, padding: 'x'.repeat(70_000) }],
  ];
  for (const [what, value] of bad) assert.equal(checkJournalEntry(value).ok, false, what);
});
