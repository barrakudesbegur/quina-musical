// The laptop's plan: the cloud link's copy wins over this browser's, which stays the offline fallback.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { LaptopPlanStore, followPlanPushes, type PlanStore } from '../../../../packages/ui/data/plan-store.ts';
import { SAMPLE_PLAN } from '../../../../packages/ui/fixtures/plan.ts';
import type { GamePlan } from '../../../../packages/ui/plan.ts';

class MemoryStore implements PlanStore {
  plan: GamePlan | null;
  constructor(plan: GamePlan | null) {
    this.plan = plan;
  }
  load() {
    return this.plan;
  }
  save(plan: GamePlan) {
    this.plan = plan;
  }
  subscribe() {
    return () => {};
  }
}

const local: GamePlan = { ...SAMPLE_PLAN, title: 'Local' };
const fromCloud: GamePlan = { ...SAMPLE_PLAN, title: 'Del núvol' };

test('the cloud link copy wins once fetched, and subscribers hear about it once', async () => {
  const store = new LaptopPlanStore(async () => ({ ok: true, json: async () => fromCloud }), new MemoryStore(local));
  const heard: string[] = [];
  store.subscribe((p) => heard.push(p?.title ?? 'none'));
  assert.equal(store.load()?.title, 'Local');
  await store.refresh();
  await store.refresh();
  assert.equal(store.load()?.title, 'Del núvol');
  assert.deepEqual(heard, ['Del núvol']);
});

test('without the link folder, or offline, the stored copy stands', async () => {
  const missing = new LaptopPlanStore(async () => ({ ok: false, json: async () => null }), new MemoryStore(local));
  assert.equal((await missing.refresh())?.title, 'Local');
  const offline = new LaptopPlanStore(async () => {
    throw new Error('offline');
  }, new MemoryStore(local));
  assert.equal((await offline.refresh())?.title, 'Local');
});

test('an invalid or empty link copy falls back to the stored plan', async () => {
  const store = new LaptopPlanStore(async () => ({ ok: true, json: async () => null }), new MemoryStore(local));
  assert.equal((await store.refresh())?.title, 'Local');
});

test('a pushed plan (relay.plan) wins at once; the same one again is quiet; an invalid one is ignored', () => {
  const store = new LaptopPlanStore(async () => ({ ok: false, json: async () => null }), new MemoryStore(local));
  const heard: string[] = [];
  store.subscribe((p) => heard.push(p?.title ?? 'none'));
  store.receive(fromCloud);
  store.receive(fromCloud);
  store.receive({ nonsense: true });
  assert.equal(store.load()?.title, 'Del núvol');
  store.receive(null);
  assert.equal(store.load()?.title, 'Local', 'no plan on the link: the stored copy stands');
  assert.deepEqual(heard, ['Del núvol', 'Local']);
});

test('followPlanPushes feeds relay.plan messages, and only those, to the store', () => {
  const store = new LaptopPlanStore(async () => ({ ok: false, json: async () => null }), new MemoryStore(local));
  let listener: (event: { type: string; plan?: unknown }) => void = () => {};
  const client = { on: (l: typeof listener) => ((listener = l), () => {}) };
  followPlanPushes(client, store);
  listener({ type: 'state', plan: fromCloud });
  assert.equal(store.load()?.title, 'Local');
  listener({ type: 'relay.plan', plan: fromCloud });
  assert.equal(store.load()?.title, 'Del núvol');
});

test('a paired device sends the relay token, so the relay gives it the whole plan; the laptop itself sends none', async () => {
  const calls: { url: string; headers: Record<string, string> | undefined }[] = [];
  const fetchImpl = async (url: string, init?: { headers?: Record<string, string> }) => {
    calls.push({ url, headers: init?.headers });
    return { ok: true, json: async () => fromCloud };
  };
  await new LaptopPlanStore(fetchImpl, new MemoryStore(local), 'tok_12345678').refresh();
  await new LaptopPlanStore(fetchImpl, new MemoryStore(local)).refresh();
  assert.deepEqual(calls, [
    { url: '/cloud/plan.json', headers: { authorization: 'Bearer tok_12345678' } },
    { url: '/cloud/plan.json', headers: undefined },
  ]);
});

test('the public plan (what an unpaired device gets) is not a plan here: the stored copy stands', async () => {
  const { publicPlan } = await import('../../../../packages/ui/plan.ts');
  const store = new LaptopPlanStore(async () => ({ ok: true, json: async () => publicPlan(fromCloud, [1]) }), new MemoryStore(local));
  assert.equal((await store.refresh())?.title, 'Local');
});
