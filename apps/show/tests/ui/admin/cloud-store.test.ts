// Admin in the cloud: inline logos are uploaded as media first, then the whole plan is saved; failures are values.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { AdminPlanStore, MemoryLogoStore, dataUrlToBlob } from '../../../../admin/data/admin-plan-store.ts';
import { CloudPlanStore, type FetchLike } from '../../../../../packages/ui/data/cloud-plan.ts';
import { SAMPLE_PLAN } from '../../../../../packages/ui/fixtures/plan.ts';
import type { GamePlan } from '../../../../../packages/ui/plan.ts';

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

// Plan B: Admin served by the show laptop (or a paired device) saves through the relay's /api/plan.
function relayStore(fetchImpl: FetchLike) {
  const store = new CloudPlanStore(fetchImpl);
  return new AdminPlanStore(store, new MemoryLogoStore(), 'relay', { store, fetchImpl });
}

const BIG_LOGO = `data:image/png;base64,${Buffer.alloc(3000, 1).toString('base64')}`;

test('relay: the plan goes to the relay; an inline logo too big for the plan stays in this browser and loads back', async () => {
  const calls: string[] = [];
  let putBody: GamePlan | null = null;
  const fetchImpl: FetchLike = async (url, init) => {
    calls.push(`${init?.method ?? 'GET'} ${url}`);
    putBody = JSON.parse(String(init?.body)) as GamePlan;
    return reply(200, { ok: true, plan: putBody, savedAtMs: 1 });
  };
  const plan: GamePlan = { ...SAMPLE_PLAN, sponsors: SAMPLE_PLAN.sponsors.map((s, i) => (i === 0 ? { ...s, logo: BIG_LOGO } : s)) };
  const store = relayStore(fetchImpl);
  assert.deepEqual(await store.save(plan), { ok: true });
  assert.deepEqual(calls, ['PUT /api/plan'], 'no media upload: the relay has none');
  assert.equal(putBody!.sponsors[0].logo, null, 'the screens get the plan without the oversized logo');
  assert.equal(store.load()?.sponsors[0].logo, BIG_LOGO, 'Admin keeps editing it with its logo');
});

test('relay: a refused save (not paired, invalid) is reported, never thrown', async () => {
  const notPaired = relayStore(async () => reply(403, { ok: false, errors: ['not paired'] }));
  const result = await notPaired.save(SAMPLE_PLAN);
  assert.equal(result.ok, false);
  if (!result.ok) assert.match(result.detail, /not paired/);
});
