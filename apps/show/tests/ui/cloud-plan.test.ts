// The cloud plan store and media upload: success, validation errors with paths, network failures as values.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CloudPlanStore, uploadMedia, type FetchLike } from '../../../../packages/ui/data/cloud-plan.ts';
import { SAMPLE_PLAN } from '../../../../packages/ui/fixtures/plan.ts';

const reply = (status: number, body: unknown) => ({ ok: status >= 200 && status < 300, status, json: async () => body });

test('refresh loads the cloud plan and tells subscribers', async () => {
  const fetchImpl: FetchLike = async () => reply(200, { plan: SAMPLE_PLAN });
  const store = new CloudPlanStore(fetchImpl);
  const heard: unknown[] = [];
  store.subscribe((p) => heard.push(p?.edition));
  assert.equal(store.load(), null);
  await store.refresh();
  assert.equal(store.load()?.rounds.length, SAMPLE_PLAN.rounds.length);
  assert.deepEqual(heard, ['26']);
});

test('put sends the whole plan and keeps what the cloud saved', async () => {
  let sent: { method?: string; body?: unknown } = {};
  const fetchImpl: FetchLike = async (_url, init) => {
    sent = { method: init?.method, body: init?.body };
    return reply(200, { ok: true, plan: SAMPLE_PLAN });
  };
  const store = new CloudPlanStore(fetchImpl);
  const r = await store.put(SAMPLE_PLAN);
  assert.equal(r.ok, true);
  assert.equal(sent.method, 'PUT');
  assert.equal(JSON.parse(String(sent.body)).edition, '26');
  assert.equal(store.load()?.edition, '26');
});

test('validation errors come back with their paths; network errors never throw', async () => {
  const bad = new CloudPlanStore(async () => reply(400, { ok: false, errors: ['plan.edition: this cloud serves edition 26'] }));
  assert.deepEqual(await bad.put(SAMPLE_PLAN), { ok: false, status: 400, errors: ['plan.edition: this cloud serves edition 26'] });
  const down = new CloudPlanStore(async () => {
    throw new Error('offline');
  });
  const r = await down.put(SAMPLE_PLAN);
  assert.equal(r.ok, false);
  assert.equal(await down.refresh(), null);
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
  const store = new CloudPlanStore(async () => reply(200, { ok: true, plan: SAMPLE_PLAN }));
  const heard: (string | null)[] = [];
  store.subscribe((p) => heard.push(p?.title ?? null));
  await store.put(SAMPLE_PLAN);
  store.receive(SAMPLE_PLAN);
  const other = { ...SAMPLE_PLAN, title: 'Canviat a Admin' };
  store.receive(other);
  store.receive(other);
  store.receive('not a plan');
  assert.deepEqual(heard, ['Canviat a Admin']);
  assert.equal(store.load()?.title, 'Canviat a Admin');
});
