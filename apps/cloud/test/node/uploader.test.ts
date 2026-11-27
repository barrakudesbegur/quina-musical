// The laptop link's upload state machine and its journal copy on disk.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { JournalCopy } from '../../laptop/journal-copy.ts';
import { Uploader } from '../../laptop/uploader.ts';
import { JournalBuilder } from '../support/journal-builder.ts';
import { tempDir } from '../support/temp.ts';

const game = JournalBuilder.sampleGame('g-up');
const linkDir = () => tempDir('quina-link-');

test('one upload in flight; the ack says where the next starts; a lost reply means a resend', () => {
  const copy = new JournalCopy(linkDir());
  for (const entry of game.entries.slice(0, 25)) copy.add(entry);
  const uploader = new Uploader(copy, 10, 1000);
  assert.equal(uploader.next(0), null, 'nothing before the welcome');

  const first = uploader.welcome('g-up', 0, 0);
  assert.deepEqual(first?.entries.map((e) => e.seq), [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  assert.equal(uploader.next(10), null, 'waits for the ack');
  const second = uploader.ack('g-up', 10, 20);
  assert.equal(second?.entries[0]?.seq, 11);
  assert.equal(uploader.next(500), null);
  const resent = uploader.next(1100);
  assert.equal(resent?.entries[0]?.seq, 11, 'no ack within the timeout: the same upload again');
  const third = uploader.ack('g-up', 20, 1200);
  assert.deepEqual(third?.entries.map((e) => e.seq), [21, 22, 23, 24, 25]);
  assert.equal(uploader.ack('g-up', 25, 1300), null, 'up to date');
  assert.equal(uploader.pending(), 0);

  copy.add(game.entries[25]);
  assert.equal(uploader.next(1400)?.entries[0]?.seq, 26, 'a new entry goes at once');
});

test('the cloud asks again from a missing entry; a conflict or a refused entry stops uploads', () => {
  const copy = new JournalCopy(linkDir());
  for (const entry of game.entries.slice(0, 30)) copy.add(entry);
  const uploader = new Uploader(copy, 50, 1000);
  uploader.welcome('g-up', 20, 0);
  assert.equal(uploader.need('g-up', 8, 10)?.entries[0]?.seq, 8);
  uploader.stop('conflict');
  assert.equal(uploader.next(5000), null);
  uploader.disconnected();
  assert.equal(uploader.welcome('g-up', 0, 6000), null, 'stopped stays stopped across reconnections');
  assert.equal(uploader.state.kind, 'stopped');
});

test('the journal copy: duplicates, conflicts, holes, and it survives a restart', () => {
  const dir = linkDir();
  const copy = new JournalCopy(dir);
  const entries = game.entries;
  assert.equal(copy.add(entries[0]), 'new');
  assert.equal(copy.add(entries[0]), 'duplicate');
  assert.equal(copy.add({ ...entries[0], atMs: 5 }), 'conflict');
  assert.equal(copy.add({ kind: 'nonsense' }), 'invalid');
  copy.add(entries[1]);
  copy.add(entries[4]);
  assert.equal(copy.contiguous('g-up'), 2);
  assert.equal(copy.firstMissing('g-up'), 3);
  copy.add(entries[2]);
  copy.add(entries[3]);
  assert.equal(copy.contiguous('g-up'), 5);
  assert.equal(copy.firstMissing('g-up'), null);

  fs.appendFileSync(path.join(dir, 'journal', 'g-up.jsonl'), '{"torn":'); // a crash mid-write
  const reopened = new JournalCopy(dir);
  assert.equal(reopened.currentGameId, 'g-up');
  assert.equal(reopened.contiguous('g-up'), 5);
  assert.deepEqual(reopened.slice('g-up', 1, 5), entries.slice(0, 5));

  const other = new JournalBuilder('weird/../id').startRound();
  reopened.add(other.entries[0]);
  assert.equal(reopened.currentGameId, 'weird/../id', 'a new Game becomes current');
  assert.ok(fs.readdirSync(path.join(dir, 'journal')).every((f) => /^[A-Za-z0-9._-]+\.jsonl$/.test(f)), 'odd ids get a hashed file name');
});
