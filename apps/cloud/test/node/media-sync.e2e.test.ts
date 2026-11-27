// The media sync end to end: a laptop pushes its repertoire's files to the cloud's R2 (local, under wrangler dev), a
// takeover laptop pulls them; only changed files move, and nothing local is ever deleted.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { pull, push, pushJournalFile, type RootDir } from '../../laptop/media-sync.ts';
import { startDevServer } from '../../loadtest/dev-server.ts';
import { tempDir } from '../support/temp.ts';

function laptop(files: Record<string, string> = {}) {
  const base = tempDir('quina-media-');
  const roots: RootDir[] = [
    { root: 'cache', dir: path.join(base, 'cache'), exclude: (rel) => rel.startsWith('stretch/') },
    { root: 'covers', dir: path.join(base, 'covers') },
  ];
  for (const [rel, text] of Object.entries(files)) {
    fs.mkdirSync(path.dirname(path.join(base, rel)), { recursive: true });
    fs.writeFileSync(path.join(base, rel), text);
  }
  return { base, roots, dataDir: path.join(base, 'link-data') };
}

test('push, then pull on another laptop: the same files; only changes move; nothing local is deleted', async () => {
  const server = await startDevServer({ media: true });
  try {
    const main = laptop({
      'cache/12/mix.flac': 'song twelve',
      'cache/12/stems/drums.48000.flac': 'drums',
      'cache/stretch/12/x.flac': 'a Blend render, made on demand',
      'covers/12.jpg': 'cover',
    });
    const cloud = { cloud: server.http, headers: {}, repertoire: 'default', log: () => {} };
    const lines: string[] = [];
    const preview = await push({ ...cloud, roots: main.roots, dataDir: main.dataDir, dryRun: true, log: (line) => lines.push(line) });
    assert.equal(preview.moved, 0);
    assert.match(lines.join('\n'), /would upload 3 files, .* to repertoires\/default\/; nothing was sent/);
    const untouched = (await (await fetch(`${server.http}/api/sync/default/manifest`)).json()) as { files?: Record<string, unknown> };
    assert.deepEqual(untouched.files ?? {}, {}, 'a dry run uploads nothing and writes no manifest');
    const first = await push({ ...cloud, roots: main.roots, dataDir: main.dataDir });
    assert.equal(first.moved, 3, 'not the stretch render');

    const spare = laptop({ 'covers/99.jpg': 'only on the spare laptop' });
    const pulled = await pull({ ...cloud, roots: spare.roots, dataDir: spare.dataDir });
    assert.equal(pulled.moved, 3);
    for (const rel of ['cache/12/mix.flac', 'cache/12/stems/drums.48000.flac', 'covers/12.jpg']) {
      assert.equal(fs.readFileSync(path.join(spare.base, rel), 'utf8'), fs.readFileSync(path.join(main.base, rel), 'utf8'), rel);
    }
    assert.ok(fs.existsSync(path.join(spare.base, 'covers/99.jpg')), 'a pull never deletes');
    assert.equal(fs.existsSync(path.join(spare.base, 'cache/stretch')), false);

    assert.equal((await push({ ...cloud, roots: main.roots, dataDir: main.dataDir })).moved, 0, 'nothing changed');
    fs.writeFileSync(path.join(main.base, 'cache/12/mix.flac'), 'song twelve, analysed again');
    assert.equal((await push({ ...cloud, roots: main.roots, dataDir: main.dataDir })).moved, 1);
    assert.equal((await pull({ ...cloud, roots: spare.roots, dataDir: spare.dataDir })).moved, 1);
    assert.equal(fs.readFileSync(path.join(spare.base, 'cache/12/mix.flac'), 'utf8'), 'song twelve, analysed again');
    assert.equal((await pull({ ...cloud, roots: spare.roots, dataDir: spare.dataDir })).moved, 0);
  } finally {
    await server.stop();
  }
});

test('a push that stopped resumes against the real Worker: a journalled file the bucket holds is checked, not sent again', async () => {
  const server = await startDevServer({ media: true });
  try {
    const main = laptop({ 'cache/12/mix.flac': 'song twelve', 'covers/12.jpg': 'cover' });
    const sha = (text: string) => createHash('sha256').update(text).digest('hex');
    // What a push that died after its first file leaves: that file in the bucket, its line in the journal, no manifest.
    const put = await fetch(`${server.http}/api/sync/default/file?path=cache/12/mix.flac`, { method: 'PUT', headers: { 'x-sha256': sha('song twelve') }, body: 'song twelve' });
    assert.equal(put.status, 200);
    fs.mkdirSync(main.dataDir, { recursive: true });
    const line = (p: string, text: string) => `${JSON.stringify({ cloud: server.http, path: p, size: text.length, sha256: sha(text) })}\n`;
    // covers/12.jpg is journalled too, but never reached the bucket: it goes up.
    fs.writeFileSync(pushJournalFile(main.dataDir, 'default'), line('cache/12/mix.flac', 'song twelve') + line('covers/12.jpg', 'cover'));
    const lines: string[] = [];
    const report = await push({ cloud: server.http, headers: {}, repertoire: 'default', roots: main.roots, dataDir: main.dataDir, log: (l) => lines.push(l) });
    assert.equal(report.moved, 1);
    assert.match(lines.join('\n'), /1 of them already in the bucket from a push that stopped/);
    const spare = laptop();
    assert.equal((await pull({ cloud: server.http, headers: {}, repertoire: 'default', roots: spare.roots, dataDir: spare.dataDir, log: () => {} })).moved, 2);
    assert.equal(fs.readFileSync(path.join(spare.base, 'covers/12.jpg'), 'utf8'), 'cover');
  } finally {
    await server.stop();
  }
});

test('without the R2 bucket, the sync says so and changes nothing', async () => {
  const server = await startDevServer();
  try {
    const main = laptop({ 'covers/1.jpg': 'x' });
    // A 503 may pass, so it is tried again (here without the real waits) before the push gives up.
    await assert.rejects(push({ cloud: server.http, headers: {}, repertoire: 'default', roots: main.roots, dataDir: main.dataDir, log: () => {}, retryFirstMs: 1, retryCapMs: 1 }), /503 media sync is not configured.*gave up after 5 attempts/s);
  } finally {
    await server.stop();
  }
});

test('the bucket lists its repertoires with their sizes, and a whole repertoire can be deleted, only when named twice', async () => {
  const server = await startDevServer({ media: true });
  try {
    const cloud = { cloud: server.http, headers: {}, log: () => {} };
    const old = laptop({ 'cache/1/mix.flac': 'last year, song one', 'covers/1.jpg': 'cover one' });
    const fresh = laptop({ 'cache/1/mix.flac': 'this year, song one' });
    await push({ ...cloud, repertoire: 'default', roots: old.roots, dataDir: old.dataDir });
    await push({ ...cloud, repertoire: '2026', roots: fresh.roots, dataDir: fresh.dataDir });
    const list = async () => (await (await fetch(`${server.http}/api/sync`)).json()) as { repertoires: { name: string; files: number; bytes: number }[]; totalBytes: number; freeTierBytes: number };
    const before = await list();
    assert.deepEqual(before.repertoires.map((p) => [p.name, p.files]).sort(), [['2026', 1], ['default', 2]]);
    assert.equal(before.totalBytes, 'last year, song one'.length + 'cover one'.length + 'this year, song one'.length);
    assert.equal(before.freeTierBytes, 10e9);

    // Deleting needs the repertoire's name again in a header; a file alone can't be deleted.
    assert.equal((await fetch(`${server.http}/api/sync/default/manifest`, { method: 'DELETE' })).status, 400);
    assert.equal((await fetch(`${server.http}/api/sync/default/manifest`, { method: 'DELETE', headers: { 'x-confirm-repertoire': '2026' } })).status, 400);
    assert.equal((await fetch(`${server.http}/api/sync/default/file?path=covers/1.jpg`, { method: 'DELETE' })).status, 405);
    const deleted = await fetch(`${server.http}/api/sync/default/manifest`, { method: 'DELETE', headers: { 'x-confirm-repertoire': 'default' } });
    assert.equal(deleted.status, 200);
    assert.deepEqual(await deleted.json(), { ok: true, deleted: 2 });

    const after = await list();
    assert.deepEqual(after.repertoires.map((p) => p.name), ['2026'], 'the other repertoire stays');
    assert.equal((await fetch(`${server.http}/api/sync/default/file?path=cache/1/mix.flac`)).status, 404);
    assert.ok(fs.existsSync(path.join(old.base, 'cache/1/mix.flac')), 'laptops keep their copies');
  } finally {
    await server.stop();
  }
});
