// Admin's plan session over the cloud or the relay (whats-left 7.1): nothing to edit and nothing saved until the
// plan has loaded, however late the plan and the socket's push come; a blank plan is never sent on its own; every
// save names the version it was based on, and a refused (stale) one stops the saving and says so.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { registerSvelteModules } from '../support/svelte-modules.ts';
import { CloudPlanStore, type FetchLike } from '../../../../../packages/ui/data/cloud-plan.ts';
import { SAMPLE_PLAN } from '../../../../../packages/ui/fixtures/plan.ts';
import type { GamePlan } from '../../../../../packages/ui/plan.ts';
import { AdminPlanStore, MemoryLogoStore } from '../../../../admin/data/admin-plan-store.ts';

registerSvelteModules();
const { PlanSession } = await import('../../../../admin/state/plan-session.svelte.ts');
// start() listens for leaving the page.
Object.assign(globalThis, { window: { addEventListener() {}, removeEventListener() {} } });

const AUTOSAVE_MS = 600;
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const reply = (status: number, body: unknown) => ({ ok: status >= 200 && status < 300, status, json: async () => body });
/** The cloud's real plan: every sample round and sponsor, under a name a blank plan never has. */
const REAL: GamePlan = { ...SAMPLE_PLAN, title: 'Quina Quina 3' };

interface Request {
  method: string;
  base: string | undefined;
  body: GamePlan | null;
}

/**
 * A cloud (or relay) that answers GET /api/plan with `plan` at version `savedAtMs` after `getDelayMs`, and PUTs as
 * the real one does: refused (409) unless based on its version. Every request is logged.
 */
function fakeServer(opts: { plan: GamePlan | null; savedAtMs: number | null; getDelayMs: number; getStatus?: number }) {
  const log: Request[] = [];
  const state = { plan: opts.plan, savedAtMs: opts.savedAtMs, getStatus: opts.getStatus ?? 200 };
  const fetchImpl: FetchLike = async (_url, init) => {
    const method = init?.method ?? 'GET';
    const base = init?.headers?.['x-quina-plan-base'];
    log.push({ method, base, body: init?.body ? (JSON.parse(String(init.body)) as GamePlan) : null });
    if (method === 'GET') {
      const answer = { plan: state.plan, savedAtMs: state.savedAtMs };
      await sleep(opts.getDelayMs);
      return reply(state.getStatus, answer);
    }
    const expected = state.savedAtMs === null ? 'none' : String(state.savedAtMs);
    if (base !== expected) return reply(409, { ok: false, stale: true, savedAtMs: state.savedAtMs, errors: ['plan: changed'] });
    state.plan = JSON.parse(String(init?.body)) as GamePlan;
    state.savedAtMs = (state.savedAtMs ?? 0) + 1000;
    return reply(200, { ok: true, plan: state.plan, savedAtMs: state.savedAtMs });
  };
  const puts = () => log.filter((r) => r.method === 'PUT');
  return { fetchImpl, log, state, puts };
}

function session(server: ReturnType<typeof fakeServer>, kind: 'cloud' | 'relay' = 'cloud') {
  const cloud = new CloudPlanStore(server.fetchImpl);
  const store = new AdminPlanStore(cloud, new MemoryLogoStore(), kind, { store: cloud, fetchImpl: server.fetchImpl });
  const s = new PlanSession(store, null);
  return { s, cloud, stop: s.start() };
}

test('the plan and the socket both later than the autosave: loading, nothing to edit, nothing sent; then the real plan, still nothing sent', async () => {
  for (const kind of ['cloud', 'relay'] as const) {
    const server = fakeServer({ plan: REAL, savedAtMs: 5000, getDelayMs: 1500 });
    const { s, stop } = session(server, kind);
    try {
      assert.equal(s.phase.kind, 'loading');
      assert.equal(s.current, null, 'no plan to show while loading');
      // Even a change to the placeholder draft (nothing on screen can make one) is never saved.
      s.draft.title = 'Escrit massa d’hora';
      await sleep(AUTOSAVE_MS + 400);
      assert.equal(s.phase.kind, 'loading');
      assert.deepEqual(server.puts(), [], `${kind}: no save before the plan loaded`);
      assert.equal(s.hasUnsavedEdits(), false);

      await sleep(500); // the plan arrives at 1.5 s
      assert.equal(s.phase.kind, 'ready');
      assert.equal(s.current?.title, 'Quina Quina 3');
      assert.equal(s.draft.rounds.length, REAL.rounds.length);
      assert.equal(s.draft.sponsors.length, REAL.sponsors.length);
      await sleep(AUTOSAVE_MS + 200);
      assert.deepEqual(server.puts(), [], `${kind}: loading the plan saves nothing`);

      // The first edit saves, based on the version loaded.
      s.draft.title = 'Quina Quina 3 · editada';
      await sleep(AUTOSAVE_MS + 200);
      assert.deepEqual(server.puts().map((r) => [r.base, r.body?.title, r.body?.rounds.length]), [['5000', 'Quina Quina 3 · editada', REAL.rounds.length]]);
      assert.equal(s.status.kind, 'saved');
      // And the next one on the version that save made.
      s.draft.title = 'Segona edició';
      await sleep(AUTOSAVE_MS + 200);
      assert.deepEqual(server.puts().map((r) => r.base), ['5000', '6000']);
    } finally {
      stop();
    }
  }
});

test("the socket's push, late too, loads the plan before the GET does", async () => {
  const server = fakeServer({ plan: REAL, savedAtMs: 5000, getDelayMs: 2500 });
  const { s, cloud, stop } = session(server);
  try {
    await sleep(1000);
    assert.equal(s.phase.kind, 'loading');
    cloud.receive(REAL, 5000); // relay.plan, at 1 s
    assert.equal(s.phase.kind, 'ready');
    assert.equal(s.current?.title, 'Quina Quina 3');
    await sleep(1700); // the GET answers too: the same version, nothing changes
    assert.equal(s.phase.kind, 'ready');
    assert.deepEqual(server.puts(), []);
  } finally {
    stop();
  }
});

test('a plan that fails to load shows the failure with nothing editable and nothing sent; the retry loads it', async () => {
  const server = fakeServer({ plan: REAL, savedAtMs: 5000, getDelayMs: 50, getStatus: 503 });
  const { s, stop } = session(server);
  try {
    await sleep(200);
    assert.deepEqual(s.phase, { kind: 'failed', detail: 'HTTP 503' });
    assert.equal(s.current, null);
    await sleep(AUTOSAVE_MS + 200);
    assert.deepEqual(server.puts(), []);
    server.state.getStatus = 200;
    await s.load(); // «Tornar-ho a provar»
    assert.equal(s.phase.kind, 'ready');
    assert.equal(s.current?.title, 'Quina Quina 3');
    assert.deepEqual(server.puts(), []);
  } finally {
    stop();
  }
});

test('with no plan anywhere yet, Admin starts from a blank one and sends it only once edited, based on "none"', async () => {
  const server = fakeServer({ plan: null, savedAtMs: null, getDelayMs: 900 });
  const { s, stop } = session(server);
  try {
    await sleep(1000 + AUTOSAVE_MS + 200);
    assert.equal(s.phase.kind, 'ready');
    assert.equal(s.draft.rounds.length, 1);
    assert.deepEqual(server.puts(), [], 'a blank plan is never sent on its own');
    s.draft.title = 'La primera';
    await sleep(AUTOSAVE_MS + 200);
    assert.deepEqual(server.puts().map((r) => [r.base, r.body?.title]), [['none', 'La primera']]);
  } finally {
    stop();
  }
});

test('a save not based on the plan there now is refused: the session says so and saves nothing more until it has the newer plan', async () => {
  const server = fakeServer({ plan: REAL, savedAtMs: 5000, getDelayMs: 10 });
  const { s, cloud, stop } = session(server);
  try {
    await sleep(100);
    server.state.savedAtMs = 7000; // someone saved from another device; this page never heard it
    s.draft.title = 'Des d’aquí';
    await sleep(AUTOSAVE_MS + 200);
    assert.deepEqual(server.puts().map((r) => r.base), ['5000']);
    assert.equal(s.stale, true);
    assert.equal(s.status.kind === 'failed' && s.status.reason, 'stale');
    assert.equal(server.state.plan?.title, 'Quina Quina 3', "the other device's plan stays");
    s.draft.title = 'Encara des d’aquí';
    await sleep(AUTOSAVE_MS + 200);
    assert.equal(server.puts().length, 1, 'no more tries until the page is reloaded');
    assert.equal(s.hasUnsavedEdits(), true, 'leaving warns: these edits are not saved');

    // The newer plan arrives (its push): keeping mine now saves over it knowingly, based on its version.
    cloud.receive({ ...REAL, title: 'D’un altre lloc' }, 7000);
    assert.equal(s.external?.title, 'D’un altre lloc');
    s.resolveConflict('mine');
    assert.equal(s.stale, false);
    await sleep(AUTOSAVE_MS + 200);
    assert.deepEqual(server.puts().map((r) => [r.base, r.body?.title]), [['5000', 'Des d’aquí'], ['7000', 'Encara des d’aquí']]);
  } finally {
    stop();
  }
});

test("another device's plan while editing: kept apart; keeping mine saves over it knowingly, based on its version", async () => {
  const server = fakeServer({ plan: REAL, savedAtMs: 5000, getDelayMs: 10 });
  const { s, cloud, stop } = session(server);
  try {
    await sleep(100);
    s.draft.title = 'Meu';
    server.state.plan = { ...REAL, title: 'Seu' };
    server.state.savedAtMs = 8000;
    cloud.receive(server.state.plan, 8000); // its push, before this page's autosave
    assert.equal(s.external?.title, 'Seu');
    await sleep(AUTOSAVE_MS + 200);
    assert.deepEqual(server.puts(), [], 'no save while the person picks');
    s.resolveConflict('mine');
    await sleep(AUTOSAVE_MS + 200);
    assert.deepEqual(server.puts().map((r) => [r.base, r.body?.title]), [['8000', 'Meu']]);
    assert.equal(s.stale, false);
  } finally {
    stop();
  }
});
