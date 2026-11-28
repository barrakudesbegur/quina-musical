// Admin's plan store: inline logos kept aside so the shared plan stays loadable, and a full storage reported
// instead of thrown.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkGamePlan } from '../../../../../packages/ui/plan.ts';
import { SAMPLE_PLAN } from '../../../../../packages/ui/fixtures/plan.ts';
import { AdminPlanStore, MemoryLogoStore, MemoryPlanStore, isQuotaError, type LogoStore } from '../../../../admin/data/admin-plan-store.ts';

const LOGO = `data:image/png;base64,${Buffer.alloc(3000, 1).toString('base64')}`;
const withLogo = () => ({ ...SAMPLE_PLAN, sponsors: SAMPLE_PLAN.sponsors.map((s, i) => (i === 0 ? { ...s, logo: LOGO } : s)) });

class FullLogoStore implements LogoStore {
  load() {
    return {};
  }
  save(): void {
    throw Object.assign(new Error('full'), { name: 'QuotaExceededError' });
  }
}

test('a plan with an inline logo is stored loadable by every screen, and loads back whole', () => {
  const plans = new MemoryPlanStore();
  const store = new AdminPlanStore(plans, new MemoryLogoStore(), 'local');
  assert.deepEqual(store.save(withLogo(), null), { ok: true });
  const shared = plans.load();
  assert.ok(shared);
  assert.equal(checkGamePlan(shared).ok, true, 'what other screens read passes the shared validator');
  assert.equal(shared.sponsors[0].logo, null);
  assert.deepEqual(store.load(), withLogo());
});

test('a full storage is reported, and the plan itself is still saved', () => {
  const plans = new MemoryPlanStore();
  const store = new AdminPlanStore(plans, new FullLogoStore(), 'local');
  const result = store.save(withLogo(), null);
  assert.deepEqual(result, { ok: false, reason: 'quota', detail: '' });
  assert.equal(plans.load()?.rounds.length, SAMPLE_PLAN.rounds.length);
});

test('subscribers get the joined plan', () => {
  const store = new AdminPlanStore(new MemoryPlanStore(), new MemoryLogoStore(), 'demo');
  const seen: unknown[] = [];
  const stop = store.subscribe((p) => seen.push(p?.sponsors[0].logo));
  store.save(withLogo(), null);
  stop();
  store.save(SAMPLE_PLAN, null);
  assert.deepEqual(seen, [LOGO]);
});

test('quota errors in every browser spelling', () => {
  assert.equal(isQuotaError({ name: 'QuotaExceededError' }), true);
  assert.equal(isQuotaError({ name: 'NS_ERROR_DOM_QUOTA_REACHED' }), true);
  assert.equal(isQuotaError({ code: 22 }), true);
  assert.equal(isQuotaError(new Error('nope')), false);
  assert.equal(isQuotaError(null), false);
});
