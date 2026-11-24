// The Game plan validator: accepts a good plan, collects every problem with its path, never throws.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkGamePlan, roundPlan, sponsorOf } from '../protocol/plan.ts';

const good = () => ({
  v: 1,
  edition: '26',
  title: 'Quina Musical',
  sponsors: [{ id: 'forn-can-pep', name: 'Forn Can Pep', logo: null }],
  rounds: [
    { number: 1, kind: 'normal', line: { title: 'Coca de recapte', detail: null, sponsorId: 'forn-can-pep', image: null }, bingo: { title: 'Sopar per a dos', detail: 'Divendres', sponsorId: null, image: null } },
    { number: 2, kind: 'special', line: null, bingo: { title: 'Pernil', detail: null, sponsorId: null, image: null } },
  ],
  schedule: { startAtMs: null, roundMinutes: 25, intervalMinutes: 3 },
  cheatSheet: { claimRules: ['El primer que canta guanya.'], specialRoundRules: ['Només compten els cartrons especials.'] },
});

test('a good plan passes and comes back trimmed and typed', () => {
  const r = checkGamePlan(good());
  assert.equal(r.ok, true);
  if (!r.ok) return;
  assert.equal(r.plan.rounds.length, 2);
  assert.equal(sponsorOf(r.plan, r.plan.rounds[0].line)?.name, 'Forn Can Pep');
  assert.equal(roundPlan(r.plan, 2)?.kind, 'special');
});

test('every problem is reported with its path', () => {
  const p = good() as Record<string, unknown>;
  const rounds = p.rounds as Record<string, unknown>[];
  rounds[1].number = 5;
  (rounds[0].line as Record<string, unknown>).sponsorId = 'nobody';
  p.edition = '2026';
  p.extra = true;
  const r = checkGamePlan(p);
  assert.equal(r.ok, false);
  if (r.ok) return;
  const joined = r.errors.join('\n');
  assert.match(joined, /plan: unknown key "extra"/);
  assert.match(joined, /plan\.edition/);
  assert.match(joined, /plan\.rounds\[1\]\.number: must be 2/);
  assert.match(joined, /plan\.rounds\[0\]\.line\.sponsorId: no sponsor with id "nobody"/);
});

test('garbage never throws', () => {
  for (const junk of [null, 42, 'plan', [], { v: 1 }, { rounds: 'x', sponsors: {}, schedule: [], cheatSheet: 1 }]) {
    const r = checkGamePlan(junk);
    assert.equal(r.ok, false);
  }
});

test('only one special round', () => {
  const p = good();
  p.rounds[0].kind = 'special';
  const r = checkGamePlan(p);
  assert.equal(r.ok, false);
});
