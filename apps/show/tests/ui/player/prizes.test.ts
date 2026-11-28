// The Premis drawer (D244): which round it opens on, the selector's steps, a bundle's parts (P2), the sponsors' logos
// on the prizes, and the demo's made-up logos.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { emptyPublicState, type PublicState } from '../../../../player/feed/public.ts';
import { DemoFeed } from '../../../../player/feed/demo-feed.ts';
import { bundleView, prizesStartRound, stepRound } from '../../../../player/logic/prizes.ts';
import { planOf, prizeRounds, viewPlan } from '../../../../player/logic/view.ts';
import { SAMPLE_PLAN } from '../../../../../packages/ui/fixtures/plan.ts';
import { publicPlan } from '../../../../../packages/ui/plan.ts';
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

test('the prizes demos show their made-up logos on the view\'s plan, after the phone\'s checks', async () => {
  for (const name of ['prizes', 'prizesInterval']) {
    const feed = new DemoFeed(name);
    let state: PublicState | null = null;
    const stop = feed.subscribe((u) => (state = u.state));
    feed.start();
    await new Promise((r) => setTimeout(r, 120));
    feed.stop();
    stop();
    const checked = planOf(state);
    assert.ok(checked, `${name}: the published plan checks on the phone`);
    assert.ok(checked.sponsors.every((s) => s.logo === null), `${name}: no made-up logo goes through the checks`);
    const plan = viewPlan(state, feed);
    assert.equal(plan?.sponsors.length, SAMPLE_PLAN.sponsors.length, `${name}: every sponsor`);
    const logos = plan?.sponsors.filter((s) => s.logo) ?? [];
    assert.ok(logos.length >= 10, `${name}: most sponsors have a logo on the view's plan (${logos.length})`);
    assert.ok(logos.every((s) => s.logo?.startsWith('data:image/svg+xml,')), `${name}: the demo's own wordmarks`);
    assert.ok(plan?.sponsors.some((s) => !s.logo), `${name}: and some none, as on the night`);
  }
});

test('a feed without dressPlan hands the view planOf\'s plan as it is (the cloud and the relay)', () => {
  const state = playing({ plan: PUBLIC } as Partial<PublicState>);
  assert.deepEqual(viewPlan(state, {}), planOf(state));
  assert.equal(viewPlan(playing(), {}), null);
});
