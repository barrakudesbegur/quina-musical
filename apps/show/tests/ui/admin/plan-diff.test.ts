// The import's diff summary: rounds, prize bundles, sponsors, schedule, rules, the prize reveal and card types.
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
  next.rounds[2].line = [{ ...next.rounds[2].line[0], title: 'Pernil' }];
  next.rounds[3].bingo = [];
  const d = diffPlans(SAMPLE_PLAN, next);
  assert.equal(d.same, false);
  assert.deepEqual(d.rounds.removed, [7, 8]);
  assert.deepEqual(d.rounds.added, []);
  assert.deepEqual(d.rounds.kindChanged, [2]);
  assert.deepEqual(d.prizes, [
    { round: 3, kind: 'line', before: 'Ampolla de vi blanc +3', after: 'Pernil' },
    { round: 4, kind: 'bingo', before: "Fregidora d'aire +17", after: null },
  ]);
});

test('a prize whose sponsor, place or headline mark changes counts as changed', () => {
  const next = clone(SAMPLE_PLAN);
  next.rounds[0].line[1].sponsorId = 'barrakudes';
  next.rounds[1].bingo.reverse();
  next.rounds[2].line[1].headline = true;
  const d = diffPlans(SAMPLE_PLAN, next);
  assert.deepEqual(d.prizes.map((p) => [p.round, p.kind]), [[1, 'line'], [2, 'bingo'], [3, 'line']]);
  assert.equal(d.prizes[0].before, d.prizes[0].after, 'the summary may stay the same');
});

test('the prize reveal', () => {
  const next = clone(SAMPLE_PLAN);
  next.prizeReveal = 'allSecret';
  const d = diffPlans(SAMPLE_PLAN, next);
  assert.equal(d.prizeReveal, true);
  assert.equal(d.same, false);
  assert.equal(diffPlans(SAMPLE_PLAN, clone(SAMPLE_PLAN)).same, true);
});

test("a round that plays another card type; a plan without card types plays its kind's default", () => {
  const next = clone(SAMPLE_PLAN);
  next.rounds[4].cardType = 'desgraciat';
  const d = diffPlans(SAMPLE_PLAN, next);
  assert.deepEqual(d.rounds.cardTypeChanged, [5]);
  assert.equal(d.same, false);
  const bare = clone(SAMPLE_PLAN);
  for (const r of bare.rounds) delete (r as Partial<typeof r>).cardType;
  assert.deepEqual(diffPlans(bare, SAMPLE_PLAN).rounds.cardTypeChanged, [], 'the defaults, spelt out or not');
});

test("a round that plays another side of the card; a plan without sides plays side 1", () => {
  const next = clone(SAMPLE_PLAN);
  next.rounds[7].side = 1;
  const d = diffPlans(SAMPLE_PLAN, next);
  assert.deepEqual(d.rounds.sideChanged, [8]);
  assert.equal(d.same, false);
  const bare = clone(SAMPLE_PLAN);
  for (const r of bare.rounds) if (r.side === 1) delete r.side;
  assert.deepEqual(diffPlans(bare, SAMPLE_PLAN).rounds.sideChanged, [], 'side 1, spelt out or not');
});

test('sponsors added, removed and changed (name or logo)', () => {
  const next = clone(SAMPLE_PLAN);
  next.sponsors = next.sponsors.filter((s) => s.id !== 'patrocinador-2').map((s) => (s.id === 'barrakudes' ? { ...s, logo: 'data:image/png;base64,AAAA' } : s));
  next.sponsors.push({ id: 'forn', name: 'Forn', logo: null });
  for (const r of next.rounds) for (const p of [...r.line, ...r.bingo]) if (p.sponsorId === 'patrocinador-2') p.sponsorId = null;
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
