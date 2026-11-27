// The media sync against a cloud that fails: a fake of the Worker's /api/sync (R2's SHA-256 check included) that can
// cut a connection, answer 503 or 403, or drop a download halfway. Failures that may pass are tried again with a new
// request (and a new read stream); the others stop at once; a push that stopped resumes from its journal.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import http from 'node:http';
import type { AddressInfo } from 'node:net';
import path from 'node:path';
import { pull, push, pushJournalFile, type RootDir, type SyncOptions } from '../../laptop/media-sync.ts';
import { tempDir } from '../support/temp.ts';

const sha = (data: Buffer | string): string => createHash('sha256').update(data).digest('hex');

/** What the fake does with one request: let it through, cut the connection, answer a status, or (a download) send half and cut. */
type Fault = 'destroy' | 'half' | number | undefined;

interface Request {
  method: string;
  resource: 'manifest' | 'file';
  path: string | null;
}

async function fakeCloud(fault: (r: Request, nth: number) => Fault = () => undefined) {
  const objects = new Map<string, Buffer>();
  let manifest: string | null = null;
  const seen: Request[] = [];
  const server = http.createServer((req, res) => {
    const url = new URL(req.url ?? '/', 'http://x');
    const match = /^\/api\/sync\/([a-z0-9_-]+)\/(manifest|file)$/.exec(url.pathname);
    if (!match) return void res.writeHead(404).end();
    const r: Request = { method: req.method ?? 'GET', resource: match[2] as Request['resource'], path: url.searchParams.get('path') };
    seen.push(r);
    const f = fault(r, seen.filter((s) => s.method === r.method && s.resource === r.resource && s.path === r.path).length);
    if (f === 'destroy') return void req.socket.destroy();
    if (typeof f === 'number') return void res.writeHead(f, { 'content-type': 'text/plain' }).end(`fake ${f}`);
    const chunks: Buffer[] = [];
    req.on('data', (c: Buffer) => chunks.push(c));
    req.on('end', () => {
      const body = Buffer.concat(chunks);
      if (r.resource === 'manifest') {
        if (r.method === 'PUT') {
          manifest = body.toString();
          return void res.writeHead(200).end('{"ok":true}');
        }
        return void res.writeHead(200, { 'content-type': 'application/json' }).end(manifest ?? JSON.stringify({ v: 2, repertoire: match[1], files: {}, updatedAtMs: 0 }));
      }
      const key = r.path ?? '';
      if (r.method === 'PUT') {
        if (sha(body) !== req.headers['x-sha256']) return void res.writeHead(400).end('the content does not match x-sha256');
        objects.set(key, body);
        return void res.writeHead(200).end('{"ok":true}');
      }
      const object = objects.get(key);
      if (!object) return void res.writeHead(404).end('not found');
      res.writeHead(200, { 'content-length': String(object.length), 'x-sha256': sha(object) });
      if (f === 'half') {
        res.write(object.subarray(0, object.length >> 1));
        return void setTimeout(() => req.socket.destroy(), 5);
      }
      res.end(object);
    });
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  return {
    url: `http://127.0.0.1:${(server.address() as AddressInfo).port}`,
    objects,
    seen,
    manifest: () => (manifest ? (JSON.parse(manifest) as { files: Record<string, { size: number; sha256: string }> }) : null),
    puts: (p: string) => seen.filter((s) => s.method === 'PUT' && s.path === p).length,
    stop: () => new Promise<void>((resolve) => server.close(() => resolve())),
  };
}

function laptop(files: Record<string, string | Buffer>) {
  const base = tempDir('quina-media-retry-');
  const roots: RootDir[] = [
    { root: 'cache', dir: path.join(base, 'cache') },
    { root: 'covers', dir: path.join(base, 'covers') },
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

test('a file whose upload is cut off, then answered 503, goes up on the third try; the manifest once, at the end', async () => {
  const cloud = await fakeCloud((r, nth) => {
    if (r.resource === 'manifest' && r.method === 'GET' && nth === 1) return 503;
    if (r.method === 'PUT' && r.path === 'cache/1/mix.flac') return nth === 1 ? 'destroy' : nth === 2 ? 503 : undefined;
    return undefined;
  });
  try {
    const main = laptop({ 'cache/1/mix.flac': song, 'covers/1.jpg': 'cover' });
    const lines: string[] = [];
    const report = await push(options(cloud.url, main, lines));
    assert.equal(report.moved, 2);
    assert.equal(cloud.puts('cache/1/mix.flac'), 3);
    assert.equal(cloud.seen.filter((s) => s.resource === 'manifest' && s.method === 'PUT').length, 1);
    assert.deepEqual(cloud.objects.get('cache/1/mix.flac'), song, 'the bytes on the server are whole');
    assert.equal(cloud.manifest()?.files['cache/1/mix.flac']?.sha256, sha(song));
    const retries = lines.filter((line) => line.includes('retry'));
    assert.equal(retries.length, 3, retries.join('\n'));
    assert.match(retries[0] ?? '', /retry the cloud's manifest: attempt 2\/5 in \d+\.\d s, after HTTP 503/);
    assert.match(retries.join('\n'), /retry upload cache\/1\/mix.flac: attempt 2\/5 in .* after fetch failed/);
    assert.match(retries.join('\n'), /retry upload cache\/1\/mix.flac: attempt 3\/5 in .* after HTTP 503 fake 503/);
    assert.equal(fs.existsSync(pushJournalFile(main.dataDir, '2026')), false, 'the journal goes with the manifest');
  } finally {
    await cloud.stop();
  }
});

test('a 403 stops the push at once, with no retry and no manifest', async () => {
  const cloud = await fakeCloud((r) => (r.method === 'PUT' && r.path === 'covers/1.jpg' ? 403 : undefined));
  try {
    const main = laptop({ 'covers/1.jpg': 'cover' });
    await assert.rejects(push(options(cloud.url, main)), /^Error: upload covers\/1\.jpg: HTTP 403 fake 403$/);
    assert.equal(cloud.puts('covers/1.jpg'), 1);
    assert.equal(cloud.manifest(), null);
  } finally {
    await cloud.stop();
  }
});

test('a download dropped halfway is fetched again, and only the whole file lands', async () => {
  const cloud = await fakeCloud((r, nth) => (r.method === 'GET' && r.path === 'cache/1/mix.flac' && nth === 1 ? 'half' : undefined));
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
    if (r.method === 'PUT' && r.path === 'cache/1/analysis.json' && nth === 1) {
      fs.appendFileSync(path.join(main?.base ?? '', 'cache/1/analysis.json'), ', and more');
      return 503;
    }
    return undefined;
  });
  try {
    main = laptop({ 'cache/1/analysis.json': '{"bpm":120}' });
    await assert.rejects(push(options(cloud.url, main)), /cache\/1\/analysis\.json changed during the push; run it again/);
    assert.equal(cloud.puts('cache/1/analysis.json'), 1);
    assert.equal(cloud.manifest(), null);
  } finally {
    await cloud.stop();
  }
});

test('after the last try it gives up with the path and the last reason', async () => {
  const cloud = await fakeCloud((r) => (r.method === 'PUT' && r.path === 'covers/1.jpg' ? 503 : undefined));
  try {
    const main = laptop({ 'covers/1.jpg': 'cover' });
    await assert.rejects(push(options(cloud.url, main)), /^Error: upload covers\/1\.jpg: HTTP 503 fake 503 \(gave up after 5 attempts\)$/);
    assert.equal(cloud.puts('covers/1.jpg'), 5);
    assert.equal(cloud.manifest(), null);
  } finally {
    await cloud.stop();
  }
});

test('a push that stopped resumes: what its journal names and the bucket still holds is not sent again', async () => {
  let refuse = true;
  const cloud = await fakeCloud((r) => (refuse && r.method === 'PUT' && r.path === 'covers/2.jpg' ? 403 : undefined));
  try {
    const main = laptop({ 'cache/1/mix.flac': song, 'covers/1.jpg': 'cover one', 'covers/2.jpg': 'cover two', 'covers/3.jpg': 'cover three' });
    const one = { ...options(cloud.url, main), concurrency: 1 };
    await assert.rejects(push(one), /upload covers\/2\.jpg: HTTP 403/);
    assert.equal(cloud.manifest(), null, 'no manifest: a pull sees nothing of a push that stopped');
    assert.deepEqual([...cloud.objects.keys()].sort(), ['cache/1/mix.flac', 'covers/1.jpg']);
    assert.equal(cloud.puts('covers/3.jpg'), 0, 'no new file starts after a failure');

    // The bucket lost covers/1.jpg meanwhile (a prune, say): the journal alone never skips a file.
    cloud.objects.delete('covers/1.jpg');
    refuse = false;
    const lines: string[] = [];
    const report = await push({ ...options(cloud.url, main, lines), concurrency: 1 });
    assert.equal(report.moved, 3);
    assert.equal(cloud.puts('cache/1/mix.flac'), 1, 'already up');
    assert.equal(cloud.puts('covers/1.jpg'), 2, 'gone from the bucket, so sent again');
    assert.match(lines.join('\n'), /1 of them already in the bucket from a push that stopped/);
    assert.deepEqual(Object.keys(cloud.manifest()?.files ?? {}).sort(), ['cache/1/mix.flac', 'covers/1.jpg', 'covers/2.jpg', 'covers/3.jpg']);
    for (const [p, f] of Object.entries(cloud.manifest()?.files ?? {})) assert.equal(sha(cloud.objects.get(p) ?? ''), f.sha256, p);
    assert.equal(fs.existsSync(pushJournalFile(main.dataDir, '2026')), false);

    // A changed file isn't skipped because an older copy of it is journalled.
    fs.writeFileSync(path.join(main.base, 'covers/3.jpg'), 'cover three, again');
    fs.appendFileSync(pushJournalFile(main.dataDir, '2026'), `${JSON.stringify({ cloud: cloud.url, path: 'covers/3.jpg', size: 11, sha256: sha('cover three') })}\n{"cut off`);
    assert.equal((await push(options(cloud.url, main))).moved, 1);
    assert.equal(cloud.objects.get('covers/3.jpg')?.toString(), 'cover three, again');
  } finally {
    await cloud.stop();
  }
});
