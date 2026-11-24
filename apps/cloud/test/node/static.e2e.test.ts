// Static files under `wrangler dev`, which routes them as Cloudflare does (the workerd tests call the Worker
// directly and never see them): they're served without running the Worker, with the headers of public/_headers.
import test from 'node:test';
import assert from 'node:assert/strict';
import { startDevServer } from '../../loadtest/dev-server.ts';

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
