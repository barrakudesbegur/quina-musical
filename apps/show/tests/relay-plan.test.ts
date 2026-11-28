// The laptop's copy of the Game plan (relay/plan.ts): the newest of the cloud's and a local save wins, a save is
// checked like the cloud checks it, and every change of the newest plan is heard once.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { checkGamePlan, type GamePlan } from '@quina/protocol';
import { CLOUD_PLAN_FILE, LOCAL_PLAN_FILE, LaptopPlan, newestPlan, parseStoredPlan, type CurrentPlan } from '../relay/plan.ts';
import { SAMPLE_PLAN } from '../../../packages/ui/fixtures/plan.ts';

const PLAN: GamePlan = (() => {
  const check = checkGamePlan(SAMPLE_PLAN);
  if (!check.ok) throw new Error(`the sample plan is invalid: ${check.errors.join('; ')}`);
  return check.plan;
})();
const titled = (title: string): GamePlan => ({ ...PLAN, title });
const scratch = () => fs.mkdtempSync(path.join(os.tmpdir(), 'quina-relay-plan-'));
const write = (dir: string, name: string, value: unknown) => fs.writeFileSync(path.join(dir, name), JSON.stringify(value));

test('a stored plan needs a save time and a plan that passes checkGamePlan', () => {
  assert.deepEqual(parseStoredPlan({ savedAtMs: 5, plan: PLAN }), { savedAtMs: 5, plan: PLAN });
  assert.deepEqual(parseStoredPlan({ savedAtMs: 5, plan: null }), { savedAtMs: 5, plan: null });
  assert.equal(parseStoredPlan({ plan: PLAN }), null);
  assert.equal(parseStoredPlan({ savedAtMs: 5, plan: { ...PLAN, secret: 'x' } }), null);
  assert.equal(parseStoredPlan(PLAN), null); // the old bare plan.json is not a stored plan
  assert.equal(parseStoredPlan('nope'), null);
});

test("the newest save wins, and the cloud's on a tie", () => {
  const cloud = { savedAtMs: 100, plan: titled('cloud') };
  assert.equal(newestPlan(cloud, { savedAtMs: 200, plan: titled('local') }).plan?.title, 'local');
  assert.equal(newestPlan(cloud, { savedAtMs: 50, plan: titled('local') }).plan?.title, 'cloud');
  assert.equal(newestPlan(cloud, { savedAtMs: 100, plan: titled('local') }).plan?.title, 'cloud');
  assert.deepEqual(newestPlan(null, null), { plan: null, savedAtMs: null });
  assert.deepEqual(newestPlan(null, cloud), { plan: cloud.plan, savedAtMs: 100 });
});

test("the laptop's plan follows both files and saves a checked local plan", () => {
  const dir = scratch();
  try {
    const heard: CurrentPlan[] = [];
    write(dir, CLOUD_PLAN_FILE, { savedAtMs: 1000, plan: titled('cloud') });
    const laptop = new LaptopPlan(dir, (current) => heard.push(current));
    assert.equal(laptop.current().plan?.title, 'cloud');
    assert.equal(heard.length, 1);

    // A save on the laptop's network: checked, for the cloud's edition, and never older than what it replaces.
    assert.equal(laptop.saveLocal({ ...PLAN, rounds: 'many' }, 2000).ok, false);
    // A logo that isn't an uploaded one is refused on the laptop too (D287's stickers), not quietly dropped.
    const foreign = laptop.saveLocal({ ...PLAN, sponsors: [{ id: 'x', name: 'X', logo: 'https://example.com/x.png' }] }, 2000);
    assert.equal(foreign.ok, false);
    assert.match(foreign.ok ? '' : foreign.errors.join(), /plan\.sponsors\[0\]\.logo/);
    assert.deepEqual(laptop.saveLocal({ ...PLAN, edition: '99' }, 2000), { ok: false, errors: ["plan.edition: the cloud's plan is for edition " + PLAN.edition] });
    const saved = laptop.saveLocal(titled('local'), 500); // this laptop's clock is behind the cloud's save
    assert.ok(saved.ok);
    assert.equal(saved.savedAtMs, 1001);
    assert.equal(laptop.current().plan?.title, 'local');
    assert.equal(heard.length, 2);
    assert.equal(parseStoredPlan(JSON.parse(fs.readFileSync(path.join(dir, LOCAL_PLAN_FILE), 'utf8')))?.plan?.title, 'local');

    // Re-reading the same files is silent; a newer cloud copy (Admin saved in the cloud) takes over.
    laptop.reload();
    assert.equal(heard.length, 2);
    write(dir, CLOUD_PLAN_FILE, { savedAtMs: 5000, plan: titled('cloud 2') });
    laptop.reload();
    assert.equal(laptop.current().plan?.title, 'cloud 2');
    assert.equal(heard.length, 3);

    // The link drops the local file once the cloud has settled it; a broken file reads as none.
    fs.rmSync(path.join(dir, LOCAL_PLAN_FILE));
    fs.writeFileSync(path.join(dir, CLOUD_PLAN_FILE), '{half');
    laptop.reload();
    assert.deepEqual(laptop.current(), { plan: null, savedAtMs: null });
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('with no link folder yet, a local save makes it', () => {
  const dir = path.join(scratch(), 'link');
  try {
    const laptop = new LaptopPlan(dir, () => {});
    assert.deepEqual(laptop.current(), { plan: null, savedAtMs: null });
    const saved = laptop.saveLocal(PLAN, 42);
    assert.ok(saved.ok && saved.savedAtMs === 42);
    assert.equal(laptop.current().plan?.title, PLAN.title);
  } finally {
    fs.rmSync(path.dirname(dir), { recursive: true, force: true });
  }
});
