// The Game plan validator through the screens' import path (ui/plan.ts): accepts a good plan, collects every
// problem with its path, never throws; and the screens' bundle helpers (headline prizes first).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { bundleSummary, checkGamePlan, roundPlan, splitBundle, sponsorOf } from '../../../../packages/ui/plan.ts';
import { SAMPLE_PLAN } from '../../../../packages/ui/fixtures/plan.ts';

const prize = (title: string, headline: boolean, sponsorId: string | null = null) => ({ title, detail: null, sponsorId, image: null, headline });

const good = () => ({
  v: 2,
  edition: '26',
  title: 'Quina Quina 3',
  prizeReveal: 'perRound',
  sponsors: [{ id: 'forn-can-pep', name: 'Forn Can Pep', logo: null }],
  cardTypes: [{ type: 'normal', name: 'Cartró normal', color: '#cfe8ff', priceCents: null, rounds: ['normal'] }],
  rounds: [
    { number: 1, kind: 'normal', line: [prize('Coca de recapte', true, 'forn-can-pep')], bingo: [prize('Sopar per a dos', true), prize('Tassa', false)] },
    { number: 2, kind: 'special', line: [], bingo: [prize('Pernil', true)] },
  ],
  schedule: { startAtMs: null, roundMinutes: 25, intervalMinutes: 3 },
  cheatSheet: { claimRules: ['El primer que canta guanya.'], specialRoundRules: ['Només compten els cartrons especials.'] },
});

test('a good plan passes and comes back trimmed and typed', () => {
  const r = checkGamePlan(good());
  assert.equal(r.ok, true);
  if (!r.ok) return;
  assert.equal(r.plan.rounds.length, 2);
  assert.equal(sponsorOf(r.plan, r.plan.rounds[0].line[0])?.name, 'Forn Can Pep');
  assert.equal(roundPlan(r.plan, 2)?.kind, 'special');
});

test('the sample plan is a valid version 3 plan with bundles', () => {
  const r = checkGamePlan(SAMPLE_PLAN);
  assert.equal(r.ok, true, r.ok ? '' : r.errors.join('\n'));
  assert.equal(SAMPLE_PLAN.v, 3);
  assert.ok(SAMPLE_PLAN.rounds.every((round) => round.line.length >= 3 && round.bingo.length >= 4), 'a headline prize and a few smaller ones');
  assert.equal(SAMPLE_PLAN.rounds[7].bingo.filter((p) => p.headline).length, 2, 'the last Quina has two headline prizes');
});

test('a bundle splits into its headline prizes and the rest, and sums up in a few words', () => {
  const bundle = [prize('Sopar', true), prize('Pernil', true), prize('Tassa', false), prize('Clauer', false)];
  const { headline, others } = splitBundle(bundle);
  assert.deepEqual(headline.map((p) => p.title), ['Sopar', 'Pernil']);
  assert.deepEqual(others.map((p) => p.title), ['Tassa', 'Clauer']);
  assert.equal(bundleSummary(bundle), 'Sopar · Pernil +2');
  assert.deepEqual(splitBundle([prize('Tassa', false), prize('Clauer', false)]).headline.map((p) => p.title), ['Tassa'], 'none marked: the first one leads');
  assert.equal(bundleSummary([prize('Pernil', true)]), 'Pernil');
  assert.equal(bundleSummary([]), null);
});

test('every problem is reported with its path', () => {
  const p = good() as Record<string, unknown>;
  const rounds = p.rounds as Record<string, unknown>[];
  rounds[1].number = 5;
  ((rounds[0].line as Record<string, unknown>[])[0]).sponsorId = 'nobody';
  p.edition = '2026';
  p.extra = true;
  const r = checkGamePlan(p);
  assert.equal(r.ok, false);
  if (r.ok) return;
  const joined = r.errors.join('\n');
  assert.match(joined, /plan: unknown key "extra"/);
  assert.match(joined, /plan\.edition/);
  assert.match(joined, /plan\.rounds\[1\]\.number: must be 2/);
  assert.match(joined, /plan\.rounds\[0\]\.line\[0\]\.sponsorId: no sponsor with id "nobody"/);
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
