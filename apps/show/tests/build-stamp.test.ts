// The dist build's stamp (relay/build-stamp.ts): a build records its sources' hashes, and the relay with --dist
// refuses a dist built from other sources (27 Nov: a test ran a dist two days older than the code).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { distProblem, pageApps, sourceHashes, staleFiles, writeStamp } from '../relay/build-stamp.ts';

/** A throwaway repo: two page apps, the engine, a non-page app, packages/ and the lockfile. */
function repo(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'quina-stamp-'));
  const put = (file: string, text: string) => {
    fs.mkdirSync(path.dirname(path.join(dir, file)), { recursive: true });
    fs.writeFileSync(path.join(dir, file), text);
  };
  put('apps/console/index.html', '<p>console</p>');
  put('apps/console/logic/a.ts', 'export const a = 1;');
  put('apps/player/index.html', '<p>player</p>');
  put('apps/cloud/index.html', 'not a page of the build');
  put('apps/ds/index.html', 'development only');
  put('apps/show/engine/src/main.ts', 'main');
  put('apps/show/relay/server.ts', 'relay, not in the build');
  put('apps/show/engine/README.md', 'docs never change a build');
  put('packages/ui/x.svelte', '<b>x</b>');
  put('packages/ui/tests/x.test.ts', 'tests are not bundled');
  put('packages/ui/node_modules/dep/index.js', 'a dependency');
  put('package-lock.json', '{}');
  fs.mkdirSync(path.join(dir, 'apps/show/dist'), { recursive: true });
  return dir;
}

test('the stamp covers what the build reads, and nothing else', () => {
  const dir = repo();
  assert.deepEqual(pageApps(path.join(dir, 'apps')), ['console', 'player']);
  assert.deepEqual(Object.keys(sourceHashes(dir)), [
    'apps/console/index.html', 'apps/console/logic/a.ts', 'apps/player/index.html', 'apps/show/engine/src/main.ts',
    'package-lock.json', 'packages/ui/x.svelte',
  ]);
});

test('the relay serves a dist built from these sources and refuses any other', () => {
  const dir = repo();
  const dist = path.join(dir, 'apps/show/dist');
  assert.match(distProblem(dist, dir) ?? '', /no build stamp/);
  writeStamp(dist, sourceHashes(dir), Date.UTC(2026, 10, 25, 3, 39));
  assert.equal(distProblem(dist, dir), null, 'fresh');
  fs.writeFileSync(path.join(dir, 'apps/show/engine/README.md'), 'a doc edit');
  fs.utimesSync(path.join(dir, 'packages/ui/x.svelte'), new Date(), new Date());
  assert.equal(distProblem(dist, dir), null, 'a doc edit, or a file touched with the same content, keeps it fresh');
  fs.writeFileSync(path.join(dir, 'apps/console/logic/a.ts'), 'export const a = 2;');
  fs.writeFileSync(path.join(dir, 'packages/ui/y.ts'), 'new');
  assert.match(distProblem(dist, dir) ?? '', /^dist\/ was built on 25 Nov 2026.* 2 file\(s\) changed since \(apps\/console\/logic\/a\.ts, packages\/ui\/y\.ts\)$/);
});

test('changed, added and removed files are all stale', () => {
  assert.deepEqual(staleFiles({ a: '1', b: '2', c: '3' }, { a: '1', b: '9', d: '4' }), ['b', 'c', 'd']);
});
