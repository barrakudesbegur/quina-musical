// Admin in the cloud: inline logos are uploaded as media first, then the whole plan is saved; failures are values.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { AdminPlanStore, MemoryLogoStore, dataUrlToBlob } from '../../../manage/data/admin-plan-store.ts';
import { CloudPlanStore, type FetchLike } from '../../../ui/data/cloud-plan.ts';
import { SAMPLE_PLAN } from '../../../ui/fixtures/plan.ts';
import type { GamePlan } from '../../../ui/plan.ts';

const reply = (status: number, body: unknown) => ({ ok: status >= 200 && status < 300, status, json: async () => body });
const LOGO = 'data:image/webp;base64,UklGRg==';

function cloudStore(fetchImpl: FetchLike) {
  const store = new CloudPlanStore(fetchImpl);
  return new AdminPlanStore(store, new MemoryLogoStore(), 'cloud', { store, fetchImpl });
}

test('a data URL becomes a Blob of its type', async () => {
  const blob = dataUrlToBlob(LOGO);
  assert.equal(blob.type, 'image/webp');
  assert.equal(blob.size, 4);
});

test('inline logos are uploaded, then the plan is saved with their media paths', async () => {
  const calls: string[] = [];
  let putBody: GamePlan | null = null;
  const fetchImpl: FetchLike = async (url, init) => {
    calls.push(`${init?.method ?? 'GET'} ${url}`);
    if (url.endsWith('/api/media')) return reply(201, { ok: true, path: '/media/abc.webp' });
    putBody = JSON.parse(String(init?.body)) as GamePlan;
    return reply(200, { ok: true, plan: putBody });
  };
  const plan: GamePlan = { ...SAMPLE_PLAN, sponsors: SAMPLE_PLAN.sponsors.map((s, i) => (i === 0 ? { ...s, logo: LOGO } : s)) };
  const result = await cloudStore(fetchImpl).save(plan);
  assert.deepEqual(calls, ['POST /api/media', 'PUT /api/plan']);
  assert.equal(result.ok, true);
  assert.equal(putBody!.sponsors[0].logo, '/media/abc.webp');
  if (result.ok) assert.equal(result.saved?.sponsors[0].logo, '/media/abc.webp');
});

test('a refused upload or plan is reported, never thrown', async () => {
  const plan: GamePlan = { ...SAMPLE_PLAN, sponsors: SAMPLE_PLAN.sponsors.map((s, i) => (i === 0 ? { ...s, logo: LOGO } : s)) };
  const tooBig = await cloudStore(async () => reply(413, { ok: false })).save(plan);
  assert.deepEqual(tooBig, { ok: false, reason: 'error', detail: 'logo patrocinador-1: size' });
  const invalid = await cloudStore(async () => reply(400, { ok: false, errors: ['plan.edition: this cloud serves edition 26'] })).save(SAMPLE_PLAN);
  assert.deepEqual(invalid, { ok: false, reason: 'error', detail: 'plan.edition: this cloud serves edition 26' });
});
