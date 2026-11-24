// The logo library: pairing a folder of cleaned logos, searching by name, reading GET /api/media, uploading pairs.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pairLogoFiles } from '../../../../admin/logic/logo-files.ts';
import { matchesQuery } from '../../../../admin/logic/logo-library.ts';
import { AdminPlanStore, MemoryLogoStore } from '../../../../admin/data/admin-plan-store.ts';
import { CloudPlanStore, listMedia, type FetchLike } from '../../../../../packages/ui/data/cloud-plan.ts';

const reply = (status: number, body: unknown) => ({ ok: status >= 200 && status < 300, status, json: async () => body });
const file = (name: string) => ({ name });

test('a folder pairs each PNG with its JXL; other files and lone JXLs are skipped', () => {
  const { pairs, skipped } = pairLogoFiles(['can-pere.png', 'can-pere.jxl', 'lebagu.png', 'orfe.jxl', 'contact-sheet.png', 'report.md'].map(file));
  assert.deepEqual(pairs.map((p) => [p.slug, p.fallback.name, p.jxl?.name ?? null]), [
    ['can-pere', 'can-pere.png', 'can-pere.jxl'],
    ['contact-sheet', 'contact-sheet.png', null],
    ['lebagu', 'lebagu.png', null],
  ]);
  assert.deepEqual(skipped, ['report.md', 'orfe.jxl']);
});

test('search: every word, ignoring case and accents, in the name or the key', () => {
  const item = { name: 'Fleca La Palma', key: 'fleca-la-palma' };
  assert.equal(matchesQuery(item, ''), true);
  assert.equal(matchesQuery(item, 'fleca palma'), true);
  assert.equal(matchesQuery(item, 'FLÉCA'), true);
  assert.equal(matchesQuery(item, 'forn'), false);
  assert.equal(matchesQuery({ name: null, key: 'can-pere' }, 'can pere'), true);
});

test('the library list: newest first, malformed entries skipped, failures as values', async () => {
  const body = {
    media: [
      { key: 'a', name: 'old', fallback: '/media/a.png', jxl: true, uploadedAtMs: 1 },
      { key: 'b', name: ' new ', fallback: '/media/b.png', jxl: false, uploadedAtMs: 2 },
      { key: 'c', fallback: 'https://elsewhere/x.png' },
      'junk',
    ],
  };
  const r = await listMedia(async () => reply(200, body));
  assert.ok(r.ok);
  if (r.ok) assert.deepEqual(r.media.map((m) => [m.key, m.name]), [['b', 'new'], ['a', 'old']]);
  assert.deepEqual(await listMedia(async () => reply(403, {})), { ok: false, status: 403 });
});

test('uploading a logo: the named PNG, then the given JXL (no encoding); cloud only', async () => {
  const calls: string[] = [];
  const fetchImpl: FetchLike = async (url, init) => {
    calls.push(`${init?.method ?? 'GET'} ${url} ${init?.headers?.['content-type'] ?? ''}`.trim());
    if (url.includes('/api/media?')) return reply(201, { ok: true, path: '/media/k1.png', key: 'k1' });
    return reply(201, { ok: true, path: '/media/k1.jxl', key: 'k1' });
  };
  const cloud = new CloudPlanStore(fetchImpl);
  let encoded = 0;
  const store = new AdminPlanStore(cloud, new MemoryLogoStore(), 'cloud', { store: cloud, fetchImpl }, async () => {
    encoded++;
    return null;
  });
  const png = new Blob([new Uint8Array([1])], { type: 'image/png' });
  const jxl = new Blob([new Uint8Array([0xff, 0x0a])]);
  const r = await store.uploadLogo(png, jxl, 'can pere');
  assert.deepEqual(r, { ok: true, path: '/media/k1.png', key: 'k1' });
  assert.deepEqual(calls, ['POST /api/media?name=can%20pere image/png', 'PUT /api/media/k1.jxl image/jxl']);
  assert.equal(encoded, 0, 'the logo tool already made its JXL');
  const local = new AdminPlanStore(cloud, new MemoryLogoStore(), 'relay', { store: cloud, fetchImpl });
  assert.equal((await local.uploadLogo(png, null, 'x')).ok, false, 'no library on the relay');
});
