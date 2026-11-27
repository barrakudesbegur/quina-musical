// The edition tool's plan check, its test start time, and the upload against a fake cloud.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { checkGamePlan, type CardTypeSides, type GamePlan } from '@quina/protocol';
import { checkPlan, planOf, planSummary, venueTimeMs, withStart } from './plan.ts';
import { uploadPlan } from './upload.ts';

const ROOT = path.resolve(import.meta.dirname, '../..');
/** The tracked plan source for 2026 (D192's order, D193's and D226's sides, D197's Descans). */
const SOURCE = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/editions/2026.plan.json'), 'utf8')) as unknown;

const TWO_SIDED: CardTypeSides[] = [
  { type: 'normal', sides: [{ side: 1, pool: '1' }, { side: 2, pool: '2' }] },
  { type: 'especial', sides: [{ side: 1, pool: '1' }, { side: 2, pool: '2' }] },
];

test("2026's plan source: the night's order, sides and Descans, checked against two-sided cards", () => {
  const report = checkPlan(SOURCE, { cardTypes: TWO_SIDED, poolSongs: { '1': 70, '2': 64 } });
  assert.deepEqual(report.errors, []);
  assert.deepEqual(report.warnings, []);
  const plan = report.plan!;
  assert.deepEqual(
    plan.rounds.map((r) => `${r.kind}/${r.cardType}/${r.side}`),
    [...Array(5).fill('normal/normal/1'), 'desgraciat/especial/1', ...Array(5).fill('normal/normal/2'), 'special/especial/2'],
  );
  assert.deepEqual(plan.rounds[5]!.line, [], 'the Desgraciat has no Line');
  assert.deepEqual(plan.schedule.throws, [{ afterRound: 6, minutes: 10 }]);
  assert.equal(plan.schedule.startAtMs, venueTimeMs('2026-12-27 18:00'));
  assert.equal(plan.schedule.doorsAtMs, venueTimeMs('2026-12-27 17:00'));
});

test('a round on a side its card type lacks stops the upload; an empty pool only warns', () => {
  const oneSided: CardTypeSides[] = [TWO_SIDED[0]!, { type: 'especial', sides: [{ side: 1, pool: '1' }] }];
  const report = checkPlan(SOURCE, { cardTypes: oneSided, poolSongs: { '1': 70, '2': 64 } });
  assert.equal(report.errors.length, 1);
  assert.match(report.errors[0]!, /^plan\.rounds\[11\]\.side: round 12 plays side 2 of card type "especial"/);

  const noPool2 = checkPlan(SOURCE, { cardTypes: TWO_SIDED, poolSongs: { '1': 70 } });
  assert.deepEqual(noPool2.errors, []);
  assert.ok(noPool2.warnings.length > 0 && noPool2.warnings.every((w) => /pool 2, which has no songs/.test(w)));

  assert.match(checkPlan(SOURCE, { cardTypes: null }).warnings[0]!, /pass --repertoire/);
  const bad = checkPlan({ ...(SOURCE as object), rounds: [] }, { cardTypes: null });
  assert.equal(bad.plan, null);
  assert.ok(bad.errors.length > 0);
});

test('planOf reads a plan source, an edition file and a backup alike', () => {
  const plan = { v: 3, rounds: [] };
  assert.equal(planOf(plan), plan);
  assert.equal(planOf({ v: 1, plan, songs: [] }), plan);
  assert.equal(planOf({ cloud: 'https://x', savedAtMs: 1, plan }), plan);
});

test("--start is Begur's wall clock, winter or summer, whatever the laptop's zone", () => {
  assert.equal(venueTimeMs('2026-11-27 19:00'), Date.UTC(2026, 10, 27, 18, 0));
  assert.equal(venueTimeMs('2026-11-27T19:00'), Date.UTC(2026, 10, 27, 18, 0));
  assert.equal(venueTimeMs('2026-07-01 19:00'), Date.UTC(2026, 6, 1, 17, 0));
  assert.equal(venueTimeMs('2026-03-29 02:30'), null, 'skipped by the clock change');
  assert.equal(venueTimeMs('27/11 19:00'), null);
  const plan = checkPlan(SOURCE, { cardTypes: null }).plan!;
  const moved = withStart(plan, Date.UTC(2026, 10, 27, 18, 0));
  assert.equal(moved.schedule.doorsAtMs, Date.UTC(2026, 10, 27, 17, 0));
  assert.deepEqual({ ...moved, schedule: null }, { ...plan, schedule: null }, 'nothing else moves');
  assert.match(planSummary(moved).join('\n'), /doors 27 Nov 2026, 18:00, start 27 Nov 2026, 19:00, throws: after round 6, 10 min/);
});

/** A cloud that answers GET with `stored` and records every PUT. */
function fakeCloud(stored: unknown, refuse = false) {
  const puts: unknown[] = [];
  const impl = (async (_url: string | URL | Request, init?: RequestInit) => {
    if (init?.method === 'PUT') {
      puts.push(JSON.parse(String(init.body)));
      return Response.json(refuse ? { ok: false, errors: ['plan.rounds: no'] } : { ok: true, plan: JSON.parse(String(init.body)) }, { status: refuse ? 400 : 200 });
    }
    return Response.json({ plan: stored, savedAtMs: 1795547101343 });
  }) as typeof fetch;
  return { impl, puts };
}

test('upload: shows the change and stops without --yes; with it, saves the old plan first, then replaces it', async () => {
  const plan = checkPlan(SOURCE, { cardTypes: null }).plan!;
  const old: GamePlan = { ...plan, rounds: plan.rounds.slice(0, 1), title: 'Quina Musical (old)', schedule: { startAtMs: null, roundMinutes: 25, intervalMinutes: 3 } };
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'quina-edition-'));
  try {
    const lines: string[] = [];
    const dry = fakeCloud(old);
    const preview = await uploadPlan({ cloud: 'https://cloud.test', headers: {}, plan, backupDir: dir, yes: false, fetch: dry.impl, log: (l) => lines.push(l) });
    assert.deepEqual(preview, { uploaded: false, backup: null });
    assert.equal(dry.puts.length, 0);
    assert.deepEqual(fs.readdirSync(dir), []);
    assert.ok(lines.some((l) => l.includes('1 round(s)')) && lines.some((l) => l.includes('12 round(s)')));

    const real = fakeCloud(old);
    const done = await uploadPlan({ cloud: 'https://cloud.test', headers: {}, plan, backupDir: dir, yes: true, fetch: real.impl, now: () => Date.UTC(2026, 10, 27, 11, 32, 54), log: () => {} });
    assert.equal(done.uploaded, true);
    assert.equal(done.backup, path.join(dir, 'cloud.test-plan-20261127T113254Z.json'));
    const saved = JSON.parse(fs.readFileSync(done.backup!, 'utf8')) as { plan: GamePlan; savedAtMs: number };
    assert.equal(saved.plan.title, 'Quina Musical (old)');
    assert.equal(saved.savedAtMs, 1795547101343);
    assert.ok(checkGamePlan(planOf(saved)).ok, 'the backup uploads back as it is');
    assert.deepEqual(real.puts, [plan]);

    const same = fakeCloud({ ...plan, volumes: { master: 90 } });
    assert.equal((await uploadPlan({ cloud: 'https://cloud.test', headers: {}, plan, backupDir: dir, yes: true, fetch: same.impl, log: () => {} })).uploaded, false);
    assert.equal(same.puts.length, 0, "the tablet's volumes are the cloud's own");

    await assert.rejects(
      uploadPlan({ cloud: 'https://cloud.test', headers: {}, plan, backupDir: dir, yes: true, fetch: fakeCloud(old, true).impl, log: () => {} }),
      /refused the plan \(HTTP 400\):\n {2}plan\.rounds: no\nIts old plan is unchanged, and saved in /,
    );
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
