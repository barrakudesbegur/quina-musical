// The laptop's plan: the cloud link's copy wins over this browser's, which stays the offline fallback.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { LaptopPlanStore, type PlanStore } from '../../../../packages/ui/data/plan-store.ts';
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
