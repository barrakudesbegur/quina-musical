// The media sync end to end against the real Worker (wrangler dev, a local R2 bucket): a laptop pushes its repertoire
// as content-addressed blobs and a manifest (D248), a takeover laptop pulls it back into the readable folders; only
// changed contents move, nothing local is ever deleted, and prune removes only the blobs no manifest names.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { prune, pull, push, referenceFile, type RootDir } from '../../laptop/media-sync.ts';
import type { MediaManifest, SyncOverview } from '../../src/domain/media-sync.ts';
import { startDevServer } from '../../loadtest/dev-server.ts';
import { tempDir } from '../support/temp.ts';

const sha = (data: string | Buffer) => createHash('sha256').update(data).digest('hex');

function laptop(files: Record<string, string> = {}) {
  const base = tempDir('quina-media-');
  const roots: RootDir[] = [
    { root: 'cache', dir: path.join(base, 'cache'), exclude: (rel) => rel.startsWith('stretch/') },
    { root: 'covers', dir: path.join(base, 'covers') },
    { root: 'voice-cache', dir: path.join(base, 'voice') },
  ];
  for (const [rel, text] of Object.entries(files)) {
    fs.mkdirSync(path.dirname(path.join(base, rel)), { recursive: true });
    fs.writeFileSync(path.join(base, rel), text);
  }
  return { base, roots, dataDir: path.join(base, 'link-data') };
}

const quiet = { headers: {}, log: () => {} };

test('push, then pull on another laptop: the same files; only changes move; nothing local is deleted', async () => {
  const server = await startDevServer({ media: true });
  try {
    const main = laptop({
      'cache/12/mix.flac': 'song twelve',
      'cache/12/stems/drums.48000.flac': 'drums',
      'cache/stretch/12/x.flac': 'a Blend render, made on demand',
      'covers/12.jpg': 'cover',
    });
    const cloud = { ...quiet, cloud: server.http, repertoire: 'default' };
    const lines: string[] = [];
    const preview = await push({ ...cloud, roots: main.roots, dataDir: main.dataDir, dryRun: true, log: (line) => lines.push(line) });
    assert.equal(preview.moved, 0);
    assert.match(lines.join('\n'), /would upload 3 blobs, .* then manifests\/default\.json; nothing was sent/);
    assert.equal((await fetch(`${server.http}/api/sync/manifests/default`)).status, 404, 'a dry run uploads nothing and writes no manifest');
    assert.equal((await push({ ...cloud, roots: main.roots, dataDir: main.dataDir })).moved, 3, 'not the stretch render');

    const spare = laptop({ 'covers/99.jpg': 'only on the spare laptop' });
    assert.equal((await pull({ ...cloud, roots: spare.roots, dataDir: spare.dataDir })).moved, 3);
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

test('the night: a spare laptop pulls into an empty data folder and gets every file at its readable path, with the right hash', async () => {
  const server = await startDevServer({ media: true });
  try {
    // A track both pools share under two song ids, and a voice cue: one blob for the two mixes.
    const main = laptop({
      'cache/12/mix.flac': 'a track in both pools',
      'cache/83/mix.flac': 'a track in both pools',
      'cache/12/raw.json': '{"id":12}',
      'cache/83/raw.json': '{"id":83}',
      'covers/12.jpg': 'cover twelve',
      'voice/benvinguts.flac': 'benvinguts',
    });
    const cloud = { ...quiet, cloud: server.http, repertoire: '2026' };
    assert.equal((await push({ ...cloud, roots: main.roots, dataDir: main.dataDir })).moved, 5, 'the shared track once');
    const manifest = (await (await fetch(`${server.http}/api/sync/manifests/2026`)).json()) as MediaManifest;
    assert.equal(manifest.v, 3);
    assert.equal(Object.keys(manifest.files).length, 6);

    const empty = laptop(); // a fresh temp folder: no cache, no covers, no index, no link data
    assert.deepEqual(fs.readdirSync(empty.base), []);
    const report = await pull({ ...cloud, roots: empty.roots, dataDir: empty.dataDir });
    assert.equal(report.moved, 6);
    assert.deepEqual(report.skipped, []);
    for (const [syncPath, file] of Object.entries(manifest.files)) {
      const [root, ...rest] = syncPath.split('/');
      const abs = path.join(empty.roots.find((r) => r.root === root)?.dir ?? '/nowhere', ...rest);
      const bytes = fs.readFileSync(abs);
      assert.equal(bytes.length, file.size, syncPath);
      assert.equal(sha(bytes), file.sha256, syncPath);
    }
    assert.equal(fs.readFileSync(path.join(empty.base, 'cache/83/mix.flac'), 'utf8'), 'a track in both pools');
    const leftovers = fs.readdirSync(empty.base, { recursive: true }).map(String).filter((p) => p.endsWith('.part'));
    assert.deepEqual(leftovers, []);
    assert.deepEqual(JSON.parse(fs.readFileSync(referenceFile(empty.dataDir, '2026'), 'utf8')).files, manifest.files, "the preflight's offline reference");
  } finally {
    await server.stop();
  }
});

test('a file replaced under the same name (a recorded voice for a placeholder): only its new hash goes up, and prune removes exactly the old blob', async () => {
  const server = await startDevServer({ media: true });
  try {
    const main = laptop({ 'voice/benvinguts.flac': 'placeholder voice', 'covers/1.jpg': 'cover one' });
    const cloud = { ...quiet, cloud: server.http, repertoire: '2026' };
    const options = { ...cloud, roots: main.roots, dataDir: main.dataDir };
    assert.equal((await push(options)).moved, 2);

    fs.writeFileSync(path.join(main.base, 'voice/benvinguts.flac'), "the user's recorded voice");
    const lines: string[] = [];
    const second = await push({ ...options, log: (line) => lines.push(line) });
    assert.equal(second.moved, 1, 'only the new hash');
    assert.equal(second.bytes, "the user's recorded voice".length);
    const manifest = (await (await fetch(`${server.http}/api/sync/manifests/2026`)).json()) as MediaManifest;
    assert.equal(manifest.files['voice-cache/benvinguts.flac']?.sha256, sha("the user's recorded voice"), 'the manifest moved to it');

    const dry = await prune({ ...quiet, cloud: server.http });
    assert.deepEqual(dry.unnamed, [{ sha256: sha('placeholder voice'), size: 'placeholder voice'.length }], 'exactly the old blob');
    assert.equal(dry.deleted, 0);
    assert.equal(dry.overview.blobs.count, 3, 'a dry run deletes nothing');
    assert.deepEqual(dry.overview.unnamed, { count: 1, bytes: 'placeholder voice'.length });

    const done = await prune({ ...quiet, cloud: server.http, yes: true });
    assert.equal(done.deleted, 1);
    assert.equal((await fetch(`${server.http}/api/sync/blobs/${sha('placeholder voice')}`)).status, 404);
    const after = (await (await fetch(`${server.http}/api/sync`)).json()) as SyncOverview;
    assert.deepEqual(after.blobs, { count: 2, bytes: "the user's recorded voice".length + 'cover one'.length });
    assert.equal(after.unnamed.count, 0);
    assert.equal((await prune({ ...quiet, cloud: server.http, yes: true })).deleted, 0, 'nothing left to prune');

    const spare = laptop();
    assert.equal((await pull({ ...cloud, roots: spare.roots, dataDir: spare.dataDir })).moved, 2);
    assert.equal(fs.readFileSync(path.join(spare.base, 'voice/benvinguts.flac'), 'utf8'), "the user's recorded voice");
    assert.ok(fs.existsSync(path.join(main.base, 'voice/benvinguts.flac')), 'the laptop keeps its files');
  } finally {
    await server.stop();
  }
});

test('the bucket lists its repertoires and its real size (shared blobs once); dropping a repertoire frees only the blobs no other names', async () => {
  const server = await startDevServer({ media: true });
  try {
    const old = laptop({ 'cache/1/mix.flac': 'last year, song one', 'cache/2/mix.flac': 'the Hold music, shared', 'covers/1.jpg': 'cover one' });
    const fresh = laptop({ 'cache/1/mix.flac': 'this year, song one', 'cache/9/mix.flac': 'the Hold music, shared' });
    await push({ ...quiet, cloud: server.http, repertoire: 'default', roots: old.roots, dataDir: old.dataDir });
    await push({ ...quiet, cloud: server.http, repertoire: '2026', roots: fresh.roots, dataDir: fresh.dataDir });
    const overview = (await (await fetch(`${server.http}/api/sync`)).json()) as SyncOverview;
    assert.deepEqual(
      overview.repertoires.map((r) => [r.name, r.files, r.blobs]),
      [['2026', 2, 2], ['default', 3, 3]],
    );
    const unique = ['last year, song one', 'the Hold music, shared', 'cover one', 'this year, song one'].reduce((n, t) => n + t.length, 0);
    assert.equal(overview.totalBytes, unique, 'the shared blob counted once');
    assert.deepEqual(overview.blobs, { count: 4, bytes: unique });
    assert.equal(overview.freeTierBytes, 10e9);

    // Dropping needs the repertoire's name again in a header.
    assert.equal((await fetch(`${server.http}/api/sync/manifests/default`, { method: 'DELETE' })).status, 400);
    assert.equal((await fetch(`${server.http}/api/sync/manifests/default`, { method: 'DELETE', headers: { 'x-confirm-repertoire': '2026' } })).status, 400);

    const dry = await prune({ ...quiet, cloud: server.http, drop: 'default' });
    assert.deepEqual(dry.unnamed.map((b) => b.sha256).sort(), [sha('last year, song one'), sha('cover one')].sort(), 'not the Hold music 2026 names too');
    assert.equal((await fetch(`${server.http}/api/sync/manifests/default`)).status, 200, 'a dry run drops nothing');
    await assert.rejects(prune({ ...quiet, cloud: server.http, drop: 'nope' }), /no repertoire "nope" in the bucket/);

    const done = await prune({ ...quiet, cloud: server.http, drop: 'default', yes: true });
    assert.equal(done.deleted, 2);
    const after = (await (await fetch(`${server.http}/api/sync`)).json()) as SyncOverview;
    assert.deepEqual(after.repertoires.map((r) => r.name), ['2026'], 'the other repertoire stays');
    assert.equal(after.blobs.count, 2);
    assert.ok(fs.existsSync(path.join(old.base, 'cache/1/mix.flac')), 'laptops keep their copies');
    const spare = laptop();
    assert.equal((await pull({ ...quiet, cloud: server.http, repertoire: '2026', roots: spare.roots, dataDir: spare.dataDir })).moved, 2);
    assert.equal(fs.readFileSync(path.join(spare.base, 'cache/9/mix.flac'), 'utf8'), 'the Hold music, shared');
  } finally {
    await server.stop();
  }
});

test('without the R2 bucket, the sync says so and changes nothing', async () => {
  const server = await startDevServer();
  try {
    const main = laptop({ 'covers/1.jpg': 'x' });
    // A 503 may pass, so it is tried again (here without the real waits) before the push gives up.
    await assert.rejects(push({ ...quiet, cloud: server.http, repertoire: 'default', roots: main.roots, dataDir: main.dataDir, retryFirstMs: 1, retryCapMs: 1 }), /503 media sync is not configured.*gave up after 5 attempts/s);
  } finally {
    await server.stop();
  }
});
