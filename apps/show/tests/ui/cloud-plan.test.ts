// The cloud plan store and media upload: success, validation errors with paths, network failures as values.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CloudPlanStore, uploadMedia, type FetchLike } from '../../../../packages/ui/data/cloud-plan.ts';
import { SAMPLE_PLAN } from '../../../../packages/ui/fixtures/plan.ts';

const reply = (status: number, body: unknown) => ({ ok: status >= 200 && status < 300, status, json: async () => body });

test('refresh loads the cloud plan and its version, and tells subscribers', async () => {
  const fetchImpl: FetchLike = async () => reply(200, { plan: SAMPLE_PLAN, savedAtMs: 1234 });
  const store = new CloudPlanStore(fetchImpl);
  const heard: unknown[] = [];
  store.subscribe((p) => heard.push(p?.edition));
  assert.equal(store.load(), null);
  const got = await store.refresh();
  assert.ok(got.ok && got.plan?.rounds.length === SAMPLE_PLAN.rounds.length && got.savedAtMs === 1234);
  assert.equal(store.load()?.rounds.length, SAMPLE_PLAN.rounds.length);
  assert.equal(store.version(), 1234);
  assert.deepEqual(heard, ['26']);
});

test("a failed or unreadable load is a failure, never \"no plan\": the cache stays (7.1)", async () => {
  let answer = reply(200, { plan: SAMPLE_PLAN, savedAtMs: 7 });
  const store = new CloudPlanStore(async () => answer);
  await store.refresh();
  const answers = [reply(503, 'down'), reply(200, { plan: { ...SAMPLE_PLAN, rounds: 'many' }, savedAtMs: 8 }), reply(200, { plan: SAMPLE_PLAN }), reply(200, 'nope')];
  for (const next of answers) {
    answer = next;
    assert.equal((await store.refresh()).ok, false);
    assert.equal(store.load()?.title, SAMPLE_PLAN.title);
    assert.equal(store.version(), 7);
  }
  const offline = new CloudPlanStore(async () => {
    throw new Error('offline');
  });
  assert.deepEqual(await offline.refresh(), { ok: false, detail: 'offline' });
  // "No plan yet" is an answer, with its version null.
  assert.deepEqual(await new CloudPlanStore(async () => reply(200, { plan: null, savedAtMs: null })).refresh(), { ok: true, plan: null, savedAtMs: null });
});

test('an older answer never replaces a newer one: a GET answered before a push that arrived first', async () => {
  const store = new CloudPlanStore(async () => reply(200, { plan: { ...SAMPLE_PLAN, title: 'GET' }, savedAtMs: 10 }));
  store.receive({ ...SAMPLE_PLAN, title: 'push' }, 20);
  await store.refresh();
  assert.equal(store.load()?.title, 'push');
  assert.equal(store.version(), 20);
  // The same plan under a newer version: the version moves, subscribers hear it.
  const heard: (number | null)[] = [];
  store.subscribe(() => heard.push(store.version()));
  store.receive({ ...SAMPLE_PLAN, title: 'push' }, 30);
  store.receive({ ...SAMPLE_PLAN, title: 'push' }, 30);
  assert.deepEqual(heard, [30]);
});

test('put sends the whole plan with its base version, and keeps what the cloud saved', async () => {
  let sent: { method?: string; body?: unknown; headers?: Record<string, string> } = {};
  const fetchImpl: FetchLike = async (_url, init) => {
    sent = { method: init?.method, body: init?.body, headers: init?.headers };
    return reply(200, { ok: true, plan: SAMPLE_PLAN, savedAtMs: 99 });
  };
  const store = new CloudPlanStore(fetchImpl);
  const r = await store.put(SAMPLE_PLAN, 42);
  assert.deepEqual(r, { ok: true, plan: SAMPLE_PLAN, savedAtMs: 99 });
  assert.equal(sent.method, 'PUT');
  assert.equal(sent.headers?.['x-quina-plan-base'], '42');
  assert.equal(store.version(), 99);
  await store.put(SAMPLE_PLAN, null);
  assert.equal(sent.headers?.['x-quina-plan-base'], 'none');
  assert.equal(JSON.parse(String(sent.body)).edition, '26');
  assert.equal(store.load()?.edition, '26');
});

test('validation errors come back with their paths; network errors never throw', async () => {
  const bad = new CloudPlanStore(async () => reply(400, { ok: false, errors: ['plan.edition: this cloud serves edition 26'] }));
  assert.deepEqual(await bad.put(SAMPLE_PLAN, 1), { ok: false, status: 400, errors: ['plan.edition: this cloud serves edition 26'], stale: false });
  const stale = new CloudPlanStore(async () => reply(409, { ok: false, stale: true, savedAtMs: 5, errors: ['plan: changed'] }));
  assert.deepEqual(await stale.put(SAMPLE_PLAN, 1), { ok: false, status: 409, errors: ['plan: changed'], stale: true });
  const down = new CloudPlanStore(async () => {
    throw new Error('offline');
  });
  const r = await down.put(SAMPLE_PLAN, 1);
  assert.equal(r.ok, false);
  assert.equal((await down.refresh()).ok, false);
});

test('media upload returns the public path, or a reason', async () => {
  const blob = new Blob([new Uint8Array([1, 2, 3])], { type: 'image/png' });
  assert.deepEqual(await uploadMedia(async () => reply(201, { ok: true, path: '/media/0123456789abcdef0123456789abcdef.png', key: '0123456789abcdef0123456789abcdef' }), blob), { ok: true, path: '/media/0123456789abcdef0123456789abcdef.png', key: '0123456789abcdef0123456789abcdef' });
  assert.deepEqual(await uploadMedia(async () => reply(201, { ok: true, path: '/media/fedcba9876543210fedcba9876543210.png' }), blob), { ok: true, path: '/media/fedcba9876543210fedcba9876543210.png', key: 'fedcba9876543210fedcba9876543210' }, 'the key from the path');
  assert.deepEqual(await uploadMedia(async () => reply(415, { ok: false }), blob), { ok: false, status: 415, reason: 'type' });
  assert.deepEqual(await uploadMedia(async () => reply(413, { ok: false }), blob), { ok: false, status: 413, reason: 'size' });
  assert.deepEqual(
    await uploadMedia(async () => {
      throw new Error('x');
    }, blob),
    { ok: false, status: 0, reason: 'network' },
  );
});

test('a plan pushed on the console socket notifies subscribers once; our own put stays quiet', async () => {
  const store = new CloudPlanStore(async () => reply(200, { ok: true, plan: SAMPLE_PLAN, savedAtMs: 5 }));
  const heard: (string | null)[] = [];
  store.subscribe((p) => heard.push(p?.title ?? null));
  await store.put(SAMPLE_PLAN, null);
  store.receive(SAMPLE_PLAN, 5);
  const other = { ...SAMPLE_PLAN, title: 'Canviat a Admin' };
  store.receive(other, 6);
  store.receive(other, 6);
  store.receive('not a plan', 7);
  store.receive(other, 'no version');
  assert.deepEqual(heard, ['Canviat a Admin']);
  assert.equal(store.load()?.title, 'Canviat a Admin');
});
