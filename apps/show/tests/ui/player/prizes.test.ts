// The Premis drawer (D244): which round it opens on, the selector's steps, a bundle's parts (P2), the sponsors' logos
// on the prizes, and the demo's made-up logos.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { emptyPublicState, type PublicState } from '../../../../player/feed/public.ts';
import { demoFor } from '../../../../player/feed/demo-feed.ts';
import { bundleView, prizesStartRound, stepRound } from '../../../../player/logic/prizes.ts';
import { planOf, prizeRounds } from '../../../../player/logic/view.ts';
import { SAMPLE_PLAN } from '../../../../../packages/ui/fixtures/plan.ts';
import { checkGamePlan, publicPlan } from '../../../../../packages/ui/plan.ts';
import { S } from '../../../../player/strings.ts';

const playing = (patch: Partial<PublicState> = {}): PublicState => ({
  ...emptyPublicState('26'),
  gameId: 'g',
  scene: 'play',
  link: { online: true, sinceMs: 0 },
  rounds: [{ number: 3, kind: 'normal', startedAtMs: 0, lineConfirmed: false, ended: false, landings: [] }],
  ...patch,
});
const PUBLIC = publicPlan(SAMPLE_PLAN, [1, 2, 3]);

test('the drawer opens on the round Horari asked for, else the round in focus, else the first', () => {
  const rounds = prizeRounds(PUBLIC, playing());
  assert.equal(prizesStartRound(rounds, 6, 3), 6, 'Horari asked for Quina 6');
  assert.equal(prizesStartRound(rounds, undefined, 3), 3, 'the round being played');
  assert.equal(prizesStartRound(rounds, 42, 3), 3, 'a round the plan lacks falls back');
  assert.equal(prizesStartRound(rounds, undefined, null), 1, 'before the night: the first planned round');
  assert.equal(prizesStartRound([], undefined, 3), null, 'no plan, no round');
});

test('‹ and › step through the planned rounds and stop at the ends', () => {
  const rounds = prizeRounds(PUBLIC, playing());
  assert.equal(stepRound(rounds, 3, 1), 4);
  assert.equal(stepRound(rounds, 3, -1), 2);
  assert.equal(stepRound(rounds, 1, -1), null, 'nothing before the first');
  assert.equal(stepRound(rounds, 8, 1), null, 'nothing after the last');
  assert.equal(stepRound(rounds, 42, 1), null);
});

test('a bundle on the page: the headline, the sponsors\' rows, the plain prizes on one line, and the count', () => {
  const quina = prizeRounds(PUBLIC, playing())[2].lines[1];
  const view = bundleView(quina);
  assert.equal(view.count, quina.headline.length + quina.others.length);
  assert.equal(view.count, 17, 'Quina 3\'s hamper: the ham, 12 staples, 4 sponsors\' gifts');
  assert.deepEqual(view.headline.map((p) => p.title), ['Pernil']);
  assert.ok(view.rows.every((p) => p.sponsor || p.detail), 'a row names a sponsor or a detail');
  assert.ok(view.rows.some((p) => p.title === 'Samarreta de Barrakudes'), 'the club\'s own T-shirt names its sponsor');
  assert.deepEqual(view.plain.slice(0, 3), ['Xocolata', 'Panettone', 'Torró'], 'the staples, in order and as written');
  assert.equal(view.headline.length + view.rows.length + view.plain.length, view.count, 'nothing dropped');
  const line = bundleView(prizeRounds(PUBLIC, playing())[2].lines[0]);
  assert.deepEqual([line.count, line.plain], [4, ['Fuet', 'Neules']]);
  assert.equal(S.prizeCount(1), '1 premi');
  assert.equal(S.prizeCount(17), '17 premis');
});

test('a prize carries its sponsor\'s logo; a locked round carries nothing of its own', () => {
  const plan = { ...PUBLIC, sponsors: PUBLIC.sponsors.map((s) => (s.id === 'patrocinador-1' ? { ...s, logo: '/media/0123456789abcdef0123456789abcdef.png' } : s)) };
  const rounds = prizeRounds(plan, playing());
  assert.deepEqual(rounds[2].lines[0].headline[0], { title: 'Ampolla de vi blanc', detail: null, sponsor: '[Patrocinador 1]', logo: '/media/0123456789abcdef0123456789abcdef.png' });
  assert.equal(rounds[2].lines[1].others.find((p) => p.title === 'Xocolata')?.logo, null, 'no sponsor, no logo');
  assert.deepEqual(rounds[4].lines.map((l) => bundleView(l).count), [0], 'a locked round: not even how many');
});

test('the prizes demo\'s made-up logos fit the plan\'s rules, so phones read its plan', () => {
  const plan = demoFor('prizes').plan;
  assert.ok(plan, 'the demo publishes its own plan');
  const check = checkGamePlan(plan);
  assert.ok(check.ok, check.ok ? '' : check.errors.join('; '));
  assert.ok(plan.sponsors.filter((s) => s.logo).length >= 10, 'most sponsors have a logo');
  assert.ok(plan.sponsors.some((s) => !s.logo), 'and some none, as on the night');
  const state = playing({ plan: publicPlan(plan, [1, 2, 3]) } as Partial<PublicState>);
  assert.equal(planOf(state)?.sponsors.length, plan.sponsors.length, 'the public plan checks on the phone');
});
