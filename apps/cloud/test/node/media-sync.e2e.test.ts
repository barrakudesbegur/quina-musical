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
