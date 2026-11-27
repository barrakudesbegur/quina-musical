// The media sync against a cloud that fails: a fake of the Worker's content-addressed /api/sync (R2's SHA-256 check,
// the paged blob list and the manifest's check that its blobs are there included) that can cut a connection, answer
// 503 or 403, or drop a download halfway. Failures that may pass are tried again with a new request (and a new read
// stream); the others stop at once; a push that stopped resumes from the bucket's list.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import http from 'node:http';
import type { AddressInfo } from 'node:net';
import path from 'node:path';
import { pull, push, referenceFile, type RootDir, type SyncOptions } from '../../laptop/media-sync.ts';
import { tempDir } from '../support/temp.ts';

const sha = (data: Buffer | string): string => createHash('sha256').update(data).digest('hex');

/** What the fake does with one request: let it through, cut the connection, answer a status, or (a download) send half and cut. */
type Fault = 'destroy' | 'half' | number | undefined;

interface Request {
  method: string;
  resource: 'manifest' | 'blob' | 'blobs';
  /** The blob's hash, the manifest's repertoire, or the list's cursor. */
  id: string;
}

/** A page of the list holds 2 blobs, so the laptop's paging is exercised too. */
const PAGE = 2;

async function fakeCloud(fault: (r: Request, nth: number) => Fault = () => undefined) {
  const blobs = new Map<string, Buffer>();
  const manifests = new Map<string, string>();
  const seen: Request[] = [];
  const server = http.createServer((req, res) => {
    const url = new URL(req.url ?? '/', 'http://x');
    const match = /^\/api\/sync\/(?:blobs\/([0-9a-f]{64})|manifests\/([a-z0-9_-]+)|(blobs))$/.exec(url.pathname);
    if (!match) return void res.writeHead(404).end();
    const r: Request = match[1] ? { method: req.method ?? 'GET', resource: 'blob', id: match[1] } : match[2] ? { method: req.method ?? 'GET', resource: 'manifest', id: match[2] } : { method: 'GET', resource: 'blobs', id: url.searchParams.get('cursor') ?? '' };
    seen.push(r);
    const f = fault(r, seen.filter((s) => s.method === r.method && s.resource === r.resource && s.id === r.id).length);
    if (f === 'destroy') return void req.socket.destroy();
    if (typeof f === 'number') return void res.writeHead(f, { 'content-type': 'text/plain' }).end(`fake ${f}`);
    const chunks: Buffer[] = [];
    req.on('data', (c: Buffer) => chunks.push(c));
    req.on('end', () => {
      const body = Buffer.concat(chunks);
      if (r.resource === 'blobs') {
        const keys = [...blobs.keys()].sort();
        const from = Number(r.id || 0);
        const page = keys.slice(from, from + PAGE).map((k) => ({ sha256: k, size: (blobs.get(k) as Buffer).length }));
        return void res.writeHead(200, { 'content-type': 'application/json' }).end(JSON.stringify({ blobs: page, cursor: from + PAGE < keys.length ? String(from + PAGE) : null }));
      }
      if (r.resource === 'manifest') {
        if (r.method === 'PUT') {
          const files = (JSON.parse(body.toString()) as { files: Record<string, { sha256: string }> }).files;
          if (Object.values(files).some((file) => !blobs.has(file.sha256))) return void res.writeHead(409).end('a blob it names is not in the bucket');
          manifests.set(r.id, body.toString());
          return void res.writeHead(200).end('{"ok":true}');
        }
        const manifest = manifests.get(r.id);
        return manifest ? void res.writeHead(200, { 'content-type': 'application/json' }).end(manifest) : void res.writeHead(404).end('no manifest');
      }
      if (r.method === 'PUT') {
        if (sha(body) !== r.id) return void res.writeHead(400).end('the content does not match its SHA-256');
        blobs.set(r.id, body);
        return void res.writeHead(200).end('{"ok":true}');
      }
      const blob = blobs.get(r.id);
      if (!blob) return void res.writeHead(404).end('no such blob');
      res.writeHead(200, { 'content-length': String(blob.length) });
      if (f === 'half') {
        res.write(blob.subarray(0, blob.length >> 1));
        return void setTimeout(() => req.socket.destroy(), 5);
      }
      res.end(blob);
    });
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  return {
    url: `http://127.0.0.1:${(server.address() as AddressInfo).port}`,
    blobs,
    seen,
    manifest: (repertoire = '2026') => {
      const text = manifests.get(repertoire);
      return text ? (JSON.parse(text) as { v: number; files: Record<string, { size: number; sha256: string }> }) : null;
    },
    /** Requests of a kind for one blob. */
    count: (method: string, id: string) => seen.filter((s) => s.method === method && s.resource === 'blob' && s.id === id).length,
    stop: () => new Promise<void>((resolve) => server.close(() => resolve())),
  };
}

function laptop(files: Record<string, string | Buffer>) {
  const base = tempDir('quina-media-retry-');
  const roots: RootDir[] = [
    { root: 'cache', dir: path.join(base, 'cache') },
    { root: 'covers', dir: path.join(base, 'covers') },
    { root: 'hold-cache', dir: path.join(base, 'hold') },
  ];
  for (const [rel, data] of Object.entries(files)) {
    fs.mkdirSync(path.dirname(path.join(base, rel)), { recursive: true });
    fs.writeFileSync(path.join(base, rel), data);
  }
  return { base, roots, dataDir: path.join(base, 'link-data') };
}

/** Options with millisecond backoff, logging into `lines`. */
function options(cloud: string, l: ReturnType<typeof laptop>, lines: string[] = []): SyncOptions {
  return { cloud, headers: {}, repertoire: '2026', roots: l.roots, dataDir: l.dataDir, log: (line) => lines.push(line), retryFirstMs: 2, retryCapMs: 10 };
}

const song = Buffer.from(Array.from({ length: 300_000 }, (_, i) => (i * 31) % 251));

test('a blob whose upload is cut off, then answered 503, goes up on the third try; the manifest once, at the end', async () => {
  const cloud = await fakeCloud((r, nth) => {
    if (r.resource === 'manifest' && r.method === 'GET' && nth === 1) return 503;
    if (r.method === 'PUT' && r.id === sha(song)) return nth === 1 ? 'destroy' : nth === 2 ? 503 : undefined;
    return undefined;
  });
  try {
    const main = laptop({ 'cache/1/mix.flac': song, 'covers/1.jpg': 'cover' });
    const lines: string[] = [];
    const report = await push(options(cloud.url, main, lines));
    assert.equal(report.moved, 2);
    assert.equal(cloud.count('PUT', sha(song)), 3);
    assert.equal(cloud.seen.filter((s) => s.resource === 'manifest' && s.method === 'PUT').length, 1);
    assert.deepEqual(cloud.blobs.get(sha(song)), song, 'the bytes on the server are whole');
    assert.equal(cloud.manifest()?.v, 3);
    assert.equal(cloud.manifest()?.files['cache/1/mix.flac']?.sha256, sha(song));
    const retries = lines.filter((line) => line.includes('retry'));
    assert.equal(retries.length, 3, retries.join('\n'));
    assert.match(retries[0] ?? '', /retry the cloud's manifest of 2026: attempt 2\/5 in \d+\.\d s, after HTTP 503/);
    assert.match(retries.join('\n'), /retry upload cache\/1\/mix.flac: attempt 2\/5 in .* after fetch failed/);
    assert.match(retries.join('\n'), /retry upload cache\/1\/mix.flac: attempt 3\/5 in .* after HTTP 503 fake 503/);
    assert.deepEqual(JSON.parse(fs.readFileSync(referenceFile(main.dataDir, '2026'), 'utf8')).files, cloud.manifest()?.files, "the preflight's reference is the manifest pushed");
  } finally {
    await cloud.stop();
  }
});

test('a 403 stops the push at once, with no retry and no manifest', async () => {
  const cloud = await fakeCloud((r) => (r.method === 'PUT' && r.id === sha('cover') ? 403 : undefined));
  try {
    const main = laptop({ 'covers/1.jpg': 'cover' });
    await assert.rejects(push(options(cloud.url, main)), /^Error: upload covers\/1\.jpg: HTTP 403 fake 403$/);
    assert.equal(cloud.count('PUT', sha('cover')), 1);
    assert.equal(cloud.manifest(), null);
  } finally {
    await cloud.stop();
  }
});

test('a download dropped halfway is fetched again, and only the whole file lands', async () => {
  const cloud = await fakeCloud((r, nth) => (r.method === 'GET' && r.resource === 'blob' && nth === 1 ? 'half' : undefined));
  try {
    await push(options(cloud.url, laptop({ 'cache/1/mix.flac': song })));
    const spare = laptop({});
    const lines: string[] = [];
    const report = await pull(options(cloud.url, spare, lines));
    assert.equal(report.moved, 1);
    assert.deepEqual(fs.readFileSync(path.join(spare.base, 'cache/1/mix.flac')), song);
    assert.equal(fs.existsSync(path.join(spare.base, 'cache/1/mix.flac.part')), false);
    assert.match(lines.join('\n'), /retry download cache\/1\/mix.flac: attempt 2\/5 .* after cut off after \d+ of 300000 bytes/);
  } finally {
    await cloud.stop();
  }
});

test('a file that grows between the scan and its retry stops the push: run it again', async () => {
  let main: ReturnType<typeof laptop> | null = null;
  const cloud = await fakeCloud((r, nth) => {
    if (r.method === 'PUT' && r.id === sha('{"bpm":120}') && nth === 1) {
      fs.appendFileSync(path.join(main?.base ?? '', 'cache/1/analysis.json'), ', and more');
      return 503;
    }
    return undefined;
  });
  try {
    main = laptop({ 'cache/1/analysis.json': '{"bpm":120}' });
    await assert.rejects(push(options(cloud.url, main)), /cache\/1\/analysis\.json changed during the push; run it again/);
    assert.equal(cloud.count('PUT', sha('{"bpm":120}')), 1);
    assert.equal(cloud.manifest(), null);
  } finally {
    await cloud.stop();
  }
});

test('after the last try it gives up with the path and the last reason', async () => {
  const cloud = await fakeCloud((r) => (r.method === 'PUT' && r.resource === 'blob' ? 503 : undefined));
  try {
    const main = laptop({ 'covers/1.jpg': 'cover' });
    await assert.rejects(push(options(cloud.url, main)), /^Error: upload covers\/1\.jpg: HTTP 503 fake 503 \(gave up after 5 attempts\)$/);
    assert.equal(cloud.count('PUT', sha('cover')), 5);
    assert.equal(cloud.manifest(), null);
  } finally {
    await cloud.stop();
  }
});

test('a push that stopped resumes from the bucket’s list: what went up is not sent again, what went missing is', async () => {
  let refuse = true;
  const cloud = await fakeCloud((r) => (refuse && r.method === 'PUT' && r.id === sha('cover two') ? 403 : undefined));
  try {
    const main = laptop({ 'cache/1/mix.flac': song, 'covers/1.jpg': 'cover one', 'covers/2.jpg': 'cover two', 'covers/3.jpg': 'cover three' });
    const one = { ...options(cloud.url, main), concurrency: 1 };
    await assert.rejects(push(one), /upload covers\/2\.jpg: HTTP 403/);
    assert.equal(cloud.manifest(), null, 'no manifest: a pull sees nothing of a push that stopped');
    assert.deepEqual([...cloud.blobs.keys()].sort(), [sha(song), sha('cover one')].sort());
    assert.equal(cloud.count('PUT', sha('cover three')), 0, 'no new upload starts after a failure');

    // The bucket lost cover one meanwhile (a prune, say): the list says so, and it goes up again.
    cloud.blobs.delete(sha('cover one'));
    refuse = false;
    const lines: string[] = [];
    const report = await push({ ...options(cloud.url, main, lines), concurrency: 1 });
    assert.equal(report.moved, 3);
    assert.equal(cloud.count('PUT', sha(song)), 1, 'already up');
    assert.equal(cloud.count('PUT', sha('cover one')), 2, 'gone from the bucket, so sent again');
    assert.match(lines.join('\n'), /3 blobs to upload \(.* MB\), 1 already in the bucket/);
    assert.deepEqual(Object.keys(cloud.manifest()?.files ?? {}).sort(), ['cache/1/mix.flac', 'covers/1.jpg', 'covers/2.jpg', 'covers/3.jpg']);
    for (const [p, f] of Object.entries(cloud.manifest()?.files ?? {})) assert.equal(sha(cloud.blobs.get(f.sha256) ?? ''), f.sha256, p);
    assert.ok(cloud.seen.filter((s) => s.resource === 'blobs').length >= 2, 'the list is paged');

    // Nothing changed: nothing goes up, and the manifest stays as it is.
    const manifestPuts = () => cloud.seen.filter((s) => s.resource === 'manifest' && s.method === 'PUT').length;
    const before = manifestPuts();
    assert.equal((await push(options(cloud.url, main))).moved, 0);
    assert.equal(manifestPuts(), before);
  } finally {
    await cloud.stop();
  }
});

test('the same content at two paths, or in two repertoires, goes up once; a pull downloads it once and writes both paths', async () => {
  const cloud = await fakeCloud();
  try {
    // A track in both pools under two song ids, and the Hold music every repertoire shares.
    const main = laptop({ 'cache/12/mix.flac': song, 'cache/83/mix.flac': song, 'hold/loop.flac': 'hold music' });
    assert.equal((await push(options(cloud.url, main))).moved, 2);
    assert.equal(cloud.count('PUT', sha(song)), 1);
    const files = cloud.manifest()?.files ?? {};
    assert.equal(files['cache/12/mix.flac']?.sha256, files['cache/83/mix.flac']?.sha256);
    const other = laptop({ 'cache/1/mix.flac': 'another year', 'hold/loop.flac': 'hold music' });
    assert.equal((await push({ ...options(cloud.url, other), repertoire: 'default' })).moved, 1, "the Hold music is in the bucket already, from 2026's push");
    assert.equal(cloud.count('PUT', sha('hold music')), 1);

    const spare = laptop({});
    const report = await pull(options(cloud.url, spare));
    assert.equal(report.moved, 3);
    assert.equal(report.bytes, song.length + 'hold music'.length, 'each blob downloaded once');
    assert.equal(cloud.count('GET', sha(song)), 1);
    for (const rel of ['cache/12/mix.flac', 'cache/83/mix.flac']) assert.deepEqual(fs.readFileSync(path.join(spare.base, rel)), song, rel);

    // A spare that already has 2026's files pulls the other repertoire: the shared Hold music is there already.
    const gets = cloud.seen.filter((s) => s.method === 'GET' && s.resource === 'blob').length;
    const next = await pull({ ...options(cloud.url, spare), repertoire: 'default' });
    assert.equal(next.moved, 1, 'only the song that differs (the Hold music is the same here)');
    assert.equal(cloud.seen.filter((s) => s.method === 'GET' && s.resource === 'blob').length, gets + 1);
    assert.equal(fs.readFileSync(path.join(spare.base, 'cache/1/mix.flac'), 'utf8'), 'another year');
  } finally {
    await cloud.stop();
  }
});

test('a file already here under another path is copied into place, not downloaded', async () => {
  const cloud = await fakeCloud();
  try {
    await push(options(cloud.url, laptop({ 'cache/12/mix.flac': song, 'cache/83/mix.flac': song })));
    const spare = laptop({ 'cache/12/mix.flac': song });
    const report = await pull(options(cloud.url, spare));
    assert.equal(report.moved, 1);
    assert.equal(report.bytes, 0);
    assert.equal(cloud.count('GET', sha(song)), 0);
    assert.deepEqual(fs.readFileSync(path.join(spare.base, 'cache/83/mix.flac')), song);
  } finally {
    await cloud.stop();
  }
});

test('a manifest the cloud refuses (a blob went missing: a prune at the same time) stops the push, with no reference written', async () => {
  const cloud = await fakeCloud((r) => (r.resource === 'manifest' && r.method === 'PUT' ? 409 : undefined));
  try {
    const main = laptop({ 'covers/1.jpg': 'cover' });
    await assert.rejects(push(options(cloud.url, main)), /^Error: the manifest: HTTP 409 fake 409$/);
    assert.equal(fs.existsSync(referenceFile(main.dataDir, '2026')), false);
  } finally {
    await cloud.stop();
  }
});

test('a pull of a repertoire the bucket has no manifest for says so', async () => {
  const cloud = await fakeCloud();
  try {
    await assert.rejects(pull(options(cloud.url, laptop({}))), /no repertoire 2026 in the bucket \(manifests\/2026\.json\)/);
  } finally {
    await cloud.stop();
  }
});
