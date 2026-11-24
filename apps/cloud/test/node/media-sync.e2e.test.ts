// The media sync end to end: a laptop pushes its pool's files to the cloud's R2 (local, under wrangler dev), a
// takeover laptop pulls them; only changed files move, and nothing local is ever deleted.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pull, push, type RootDir } from '../../laptop/media-sync.ts';
import { startDevServer } from '../../loadtest/dev-server.ts';

function laptop(files: Record<string, string> = {}) {
  const base = fs.mkdtempSync(path.join(os.tmpdir(), 'quina-media-'));
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
    const cloud = { cloud: server.http, headers: {}, pool: 'default', log: () => {} };
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

test('without the R2 bucket, the sync says so and changes nothing', async () => {
  const server = await startDevServer();
  try {
    const main = laptop({ 'covers/1.jpg': 'x' });
    await assert.rejects(push({ cloud: server.http, headers: {}, pool: 'default', roots: main.roots, dataDir: main.dataDir, log: () => {} }), /503/);
  } finally {
    await server.stop();
  }
});

test('the bucket lists its pools with their sizes, and a whole pool can be deleted, only when named twice', async () => {
  const server = await startDevServer({ media: true });
  try {
    const cloud = { cloud: server.http, headers: {}, log: () => {} };
    const old = laptop({ 'cache/1/mix.flac': 'last year, song one', 'covers/1.jpg': 'cover one' });
    const fresh = laptop({ 'cache/1/mix.flac': 'this year, song one' });
    await push({ ...cloud, pool: 'default', roots: old.roots, dataDir: old.dataDir });
    await push({ ...cloud, pool: '2026', roots: fresh.roots, dataDir: fresh.dataDir });
    const list = async () => (await (await fetch(`${server.http}/api/sync`)).json()) as { pools: { name: string; files: number; bytes: number }[]; totalBytes: number; freeTierBytes: number };
    const before = await list();
    assert.deepEqual(before.pools.map((p) => [p.name, p.files]).sort(), [['2026', 1], ['default', 2]]);
    assert.equal(before.totalBytes, 'last year, song one'.length + 'cover one'.length + 'this year, song one'.length);
    assert.equal(before.freeTierBytes, 10e9);

    // Deleting needs the pool's name again in a header; a file alone can't be deleted.
    assert.equal((await fetch(`${server.http}/api/sync/default/manifest`, { method: 'DELETE' })).status, 400);
    assert.equal((await fetch(`${server.http}/api/sync/default/manifest`, { method: 'DELETE', headers: { 'x-confirm-pool': '2026' } })).status, 400);
    assert.equal((await fetch(`${server.http}/api/sync/default/file?path=covers/1.jpg`, { method: 'DELETE' })).status, 405);
    const deleted = await fetch(`${server.http}/api/sync/default/manifest`, { method: 'DELETE', headers: { 'x-confirm-pool': 'default' } });
    assert.equal(deleted.status, 200);
    assert.deepEqual(await deleted.json(), { ok: true, deleted: 2 });

    const after = await list();
    assert.deepEqual(after.pools.map((p) => p.name), ['2026'], 'the other pool stays');
    assert.equal((await fetch(`${server.http}/api/sync/default/file?path=cache/1/mix.flac`)).status, 404);
    assert.ok(fs.existsSync(path.join(old.base, 'cache/1/mix.flac')), 'laptops keep their copies');
  } finally {
    await server.stop();
  }
});
