// Admin's plan checks: inline logos accepted and checked, pasted text, errors by path, and how a plan with
// inline logos is stored so every other screen can still load it.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkGamePlan } from '../../../../../packages/ui/plan.ts';
import { SAMPLE_PLAN } from '../../../../../packages/ui/fixtures/plan.ts';
import { base64Bytes, checkPlanDraft, checkPlanText, errorsAt, inlineLogoError, planForStorage, planFromStorage } from '../../../../admin/logic/plan-check.ts';

const LOGO = `data:image/png;base64,${Buffer.alloc(2000, 7).toString('base64')}`; // longer than the shared 500-character limit
const withLogo = (logo: string) => ({ ...SAMPLE_PLAN, sponsors: SAMPLE_PLAN.sponsors.map((s, i) => (i === 1 ? { ...s, logo } : s)) });

test('base64Bytes is the decoded size', () => {
  assert.equal(base64Bytes(Buffer.from('abc').toString('base64')), 3);
  assert.equal(base64Bytes(Buffer.from('abcd').toString('base64')), 4);
  assert.equal(base64Bytes(Buffer.from('abcde').toString('base64')), 5);
});

test('a plan with an inline logo passes, and keeps the logo', () => {
  assert.equal(checkGamePlan(withLogo(LOGO)).ok, false, 'the shared validator alone refuses it (the reason for this module)');
  const r = checkPlanDraft(withLogo(LOGO));
  assert.equal(r.ok, true);
  if (r.ok) assert.equal(r.plan.sponsors[1].logo, LOGO);
});

test('inline logos must be base64 PNG within the size limit (never WebP)', () => {
  assert.equal(inlineLogoError(LOGO), null);
  assert.match(inlineLogoError('data:image/jpeg;base64,AAAA') ?? '', /PNG/);
  assert.match(inlineLogoError('data:image/webp;base64,AAAA') ?? '', /WebP is no longer used/);
  assert.match(inlineLogoError(LOGO, 4) ?? '', /more than/);
  const r = checkPlanDraft(withLogo('data:text/html,<script>'));
  assert.equal(r.ok, false);
  if (!r.ok) assert.match(r.errors.join('\n'), /plan\.sponsors\[1\]\.logo: /);
});

test('logo errors and the shared errors come together, each with its path', () => {
  const bad = { ...withLogo('data:image/gif;base64,AAAA'), title: '' };
  const r = checkPlanDraft(bad);
  assert.equal(r.ok, false);
  if (r.ok) return;
  assert.ok(r.errors.some((e) => e.startsWith('plan.title:')));
  assert.ok(r.errors.some((e) => e.startsWith('plan.sponsors[1].logo:')));
});

test('checkPlanText tells syntax errors, empty text and invalid plans apart', () => {
  assert.deepEqual(checkPlanText('  '), { ok: false, kind: 'empty' });
  const syntax = checkPlanText('{ "v": 1, ');
  assert.equal(syntax.ok, false);
  if (!syntax.ok) assert.equal(syntax.kind, 'syntax');
  const invalid = checkPlanText('{"v": 2}');
  assert.equal(invalid.ok, false);
  if (!invalid.ok && invalid.kind === 'invalid') assert.ok(invalid.errors.length > 3, 'every problem is listed');
  assert.equal(checkPlanText(JSON.stringify(withLogo(LOGO))).ok, true);
});

test('errorsAt picks the errors under a path', () => {
  const errors = ['plan.rounds[1].line.title: must not be empty', 'plan.rounds[10].kind: bad', 'plan.rounds: too many', 'plan.title: x'];
  assert.deepEqual(errorsAt(errors, 'plan.rounds[1]'), ['plan.rounds[1].line.title: must not be empty']);
  assert.equal(errorsAt(errors, 'plan.rounds').length, 3);
});

test('a plan without inline logos is stored whole', () => {
  const { plan, logos } = planForStorage(SAMPLE_PLAN);
  assert.equal(plan, SAMPLE_PLAN);
  assert.deepEqual(logos, {});
});

test('inline logos are stored aside, so the stored plan passes the shared validator, and come back on load', () => {
  const full = withLogo(LOGO);
  const { plan, logos } = planForStorage(full);
  assert.equal(checkGamePlan(plan).ok, true);
  assert.equal(plan.sponsors[1].logo, null);
  assert.deepEqual(logos, { [full.sponsors[1].id]: LOGO });
  assert.deepEqual(planFromStorage(plan, logos), full);
});

test('a stored logo never overrides a logo the plan already has', () => {
  const plan = { ...SAMPLE_PLAN, sponsors: SAMPLE_PLAN.sponsors.map((s) => ({ ...s, logo: '/logos/x.png' })) };
  assert.deepEqual(planFromStorage(plan, { [plan.sponsors[0].id]: LOGO }), plan);
});
