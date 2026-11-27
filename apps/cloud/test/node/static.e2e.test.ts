// Static files under `wrangler dev`, which routes them as Cloudflare does (the workerd tests call the Worker
// directly and never see them): they're served without running the Worker, with the headers of static/_headers.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { startDevServer } from '../../loadtest/dev-server.ts';

const ROOT = path.resolve(import.meta.dirname, '../..');

test("static files: the kill switch for last year's service worker is never cached; _headers stays private", async () => {
  const server = await startDevServer();
  try {
    const sw = await fetch(`${server.http}/sw.js`);
    assert.equal(sw.status, 200);
    assert.equal(sw.headers.get('cache-control'), 'no-cache');
    assert.match(sw.headers.get('content-type') ?? '', /javascript/);
    assert.match(await sw.text(), /registration\.unregister\(\)/);
    assert.doesNotMatch(await (await fetch(`${server.http}/_headers`)).text(), /Cache-Control/, '_headers itself is never served');
    assert.equal((await fetch(`${server.http}/`)).status, 200);
    const page = await fetch(`${server.http}/26/123`, { headers: { accept: 'text/html', 'sec-fetch-mode': 'navigate' } });
    assert.equal(page.status, 200, 'a card link opens the player (SPA fallback)');
    assert.match(await page.text(), /<html/);
  } finally {
    await server.stop();
  }
});

test("static files: the player's PWA (worker, manifest, icons) always revalidates; hashed assets keep a year", async () => {
  // A build as scripts/assets.ts assembles it: static/, plus the UI build's PWA files and a hashed asset.
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'quina-static-'));
  fs.cpSync(path.join(ROOT, 'static'), dir, { recursive: true });
  const put = (file: string, body: string) => {
    fs.mkdirSync(path.dirname(path.join(dir, file)), { recursive: true });
    fs.writeFileSync(path.join(dir, file), body);
  };
  put('player-sw.js', "self.addEventListener('fetch', () => {});\n");
  put('player.webmanifest', JSON.stringify({ name: 'Quina Musical', start_url: '/' }));
  put('icons/player-192.png', 'png');
  put('assets/player-AbCd1234.js', 'export {};\n');
  const server = await startDevServer({ assets: dir });
  try {
    const get = async (file: string) => {
      const response = await fetch(`${server.http}${file}`);
      await response.arrayBuffer();
      assert.equal(response.status, 200, file);
      return response.headers;
    };
    const worker = await get('/player-sw.js');
    assert.equal(worker.get('cache-control'), 'no-cache');
    assert.match(worker.get('content-type') ?? '', /javascript/);
    const manifest = await get('/player.webmanifest');
    assert.equal(manifest.get('cache-control'), 'no-cache');
    assert.match(manifest.get('content-type') ?? '', /^application\/manifest\+json/);
    assert.equal((await get('/icons/player-192.png')).get('cache-control'), 'no-cache');
    assert.equal((await get('/assets/player-AbCd1234.js')).get('cache-control'), 'public, max-age=31536000, immutable');
    assert.equal((await get('/sw.js')).get('cache-control'), 'no-cache', 'the kill switch is unchanged');
    for (const page of ['/', '/26/123']) {
      const response = await fetch(`${server.http}${page}`, { headers: { accept: 'text/html', 'sec-fetch-mode': 'navigate' } });
      await response.arrayBuffer();
      assert.doesNotMatch(response.headers.get('cache-control') ?? '', /immutable|max-age=[1-9]/, `${page} is never kept`);
    }
  } finally {
    await server.stop();
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
