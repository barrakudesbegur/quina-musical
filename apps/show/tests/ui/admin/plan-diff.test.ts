// The import's diff summary: rounds, prizes, sponsors, schedule and rules.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { GamePlan } from '../../../../../packages/ui/plan.ts';
import { SAMPLE_PLAN } from '../../../../../packages/ui/fixtures/plan.ts';
import { diffPlans } from '../../../../admin/logic/plan-diff.ts';

const clone = (p: GamePlan): GamePlan => structuredClone(p);

test('the same plan is "same"', () => {
  const d = diffPlans(SAMPLE_PLAN, clone(SAMPLE_PLAN));
  assert.equal(d.same, true);
  assert.deepEqual(d.prizes, []);
});

test('against no plan, everything is new', () => {
  const d = diffPlans(null, SAMPLE_PLAN);
  assert.equal(d.same, false);
  assert.equal(d.rounds.added.length, SAMPLE_PLAN.rounds.length);
  assert.equal(d.sponsors.added.length, SAMPLE_PLAN.sponsors.length);
});

test('rounds added and removed, kinds and prizes changed', () => {
  const next = clone(SAMPLE_PLAN);
  next.rounds = next.rounds.slice(0, 6); // rounds 7 and 8 removed
  next.rounds[1].kind = 'special';
  next.rounds[2].line = { ...next.rounds[2].line!, title: 'Pernil' };
  next.rounds[3].bingo = null;
  const d = diffPlans(SAMPLE_PLAN, next);
  assert.equal(d.same, false);
  assert.deepEqual(d.rounds.removed, [7, 8]);
  assert.deepEqual(d.rounds.added, []);
  assert.deepEqual(d.rounds.kindChanged, [2]);
  assert.deepEqual(d.prizes, [
    { round: 3, kind: 'line', before: '[Premi de línia 3]', after: 'Pernil' },
    { round: 4, kind: 'bingo', before: '[Premi de quina 4]', after: null },
  ]);
});

test('a prize whose sponsor changes counts as changed', () => {
  const next = clone(SAMPLE_PLAN);
  next.rounds[0].line!.sponsorId = 'barrakudes';
  const d = diffPlans(SAMPLE_PLAN, next);
  assert.equal(d.prizes.length, 1);
  assert.equal(d.prizes[0].before, d.prizes[0].after);
});

test('sponsors added, removed and changed (name or logo)', () => {
  const next = clone(SAMPLE_PLAN);
  next.sponsors = next.sponsors.filter((s) => s.id !== 'patrocinador-2').map((s) => (s.id === 'barrakudes' ? { ...s, logo: 'data:image/png;base64,AAAA' } : s));
  next.sponsors.push({ id: 'forn', name: 'Forn', logo: null });
  for (const r of next.rounds) if (r.line?.sponsorId === 'patrocinador-2') r.line.sponsorId = null;
  const d = diffPlans(SAMPLE_PLAN, next);
  assert.deepEqual(d.sponsors, { added: ['forn'], removed: ['patrocinador-2'], changed: ['barrakudes'] });
});

test('schedule, rules, title and edition', () => {
  const next = clone(SAMPLE_PLAN);
  next.schedule.roundMinutes = 30;
  next.cheatSheet.claimRules.push('Nova norma');
  next.title = 'Quina Musical 2026';
  const d = diffPlans(SAMPLE_PLAN, next);
  assert.equal(d.schedule, true);
  assert.equal(d.cheatSheet, true);
  assert.equal(d.title, true);
  assert.equal(d.edition, false);
});

test('only the sponsors order changing is still a change', () => {
  const next = clone(SAMPLE_PLAN);
  next.sponsors.reverse();
  assert.equal(diffPlans(SAMPLE_PLAN, next).same, false);
});
