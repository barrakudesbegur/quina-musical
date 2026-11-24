// Variety over whole nights, judged the way a listener hears them: four simulated nights of 12 rounds through the
// real Show (tests/support/night.ts: real analysis data and cards, the Line and the Bingo claimed, Holds, Back and
// false Claims), every transition checked for the landing invariants, and the sameness table kept under the
// thresholds below so the rotation memory (plan/variety.ts) cannot silently regress.
//
// The thresholds sit between the engine before the rotation memory (first column of each comment) and after it
// (second), from `node tests/support/variety.ts 4 1`: falling back to the old behaviour fails them.
import { dataTest as test } from './support/data.ts';
import assert from 'node:assert/strict';
import { familyGroup } from '../engine/src/plan/recipes.ts';
import { MOVES } from '../engine/src/config.ts';
import type { PhaseName } from '../engine/src/config.ts';
import { deckTimeline } from '../engine/src/plan/timeline.ts';
import { checkLanding } from './support/landing.ts';
import { formatTable, roundsOf, runNights, varietyReport } from './support/variety.ts';
import type { NightLog } from './support/night.ts';

const NIGHTS = 4;
let logs: NightLog[] | null = null;
/** The nights, simulated once for every test of this file. */
const nights = (): NightLog[] => (logs ??= runNights(NIGHTS, 1));

test('whole nights: every transition keeps the landing invariants and the hard rotation rules', () => {
  for (const log of nights()) {
    assert.equal(log.rounds, 12, `night ${log.seed}: every round reaches its Bingo`);
    for (const round of roundsOf(log)) {
      round.forEach((t, k) => {
        checkLanding(t.plan, t.A);
        const before = round.slice(0, k);
        const what = `night ${log.seed} round ${t.round} #${t.index} ${t.plan.recipe}`;
        // Never one family three times running (the spiral counts as an echo).
        const lastTwo = before.slice(-2);
        if (lastTwo.length === 2 && t.plan.recipe !== 'FADE') {
          assert.ok(!lastTwo.every((x) => familyGroup(x.plan.family) === familyGroup(t.plan.family)), `${what}: three ${t.plan.family} in a row`);
        }
        // The gimmicks wait their turn: D2, D6 and the power-down.
        const cooldowns: Record<string, number> = { D2: MOVES.hits.cooldown, D6: MOVES.fake.cooldown, R10: MOVES.powerDown.cooldown };
        const cooldown = cooldowns[t.plan.recipe];
        if (cooldown) assert.ok(!before.slice(-cooldown).some((x) => x.plan.recipe === t.plan.recipe), `${what}: within its cooldown`);
      });
    }
  }
});

test('whole nights: the sameness table stays under its thresholds', () => {
  const report = varietyReport(nights());
  console.log(formatTable(report));
  const { all, early, mid, late, final } = report.scopes;
  const under = (value: number, max: number, what: string) => assert.ok(value <= max, `${what}: ${value.toFixed(3)} > ${max}`);
  const over = (value: number, min: number, what: string) => assert.ok(value >= min, `${what}: ${value.toFixed(3)} < ${min}`);

  // The recipes: no runaway favourite, early not a short list, final not one move.
  under(all.topRecipe.share, 0.2, 'top recipe'); // 21% → 18%
  under(final.topRecipe.share, 0.29, 'top recipe in final'); // 29% → 26%
  // Early is narrower since the user's first listen: the light, clean moves (a cut, a short echo, a filter, drum or
  // stem swap), the builds and theatrical moves rare until mid.
  over(early.effectiveRecipes, 7.5, 'effective recipes early'); // 9.9 → 11.2, light early 8.6
  // Families: never three running, rarely back within three.
  under(all.maxFamilyRun, 2, 'longest run of one family'); // 3 → 2
  // Early's palette is narrower since the user's first listen (light, clean moves), and a sudden vocal entry favours
  // a cut on the one: families come back a little sooner there (early 24%).
  under(all.familyWithin3, 0.21, 'family again within 3'); // 24% → 14%, light early and vocals 20%
  // How A leaves, the landing, its impact and the riser rarely repeat the previous transition (an impact without
  // samples, or no riser, never counts as a repeat).
  under(all.exitRepeat, 0.045, 'exit = previous'); // 6% → 3%
  under(all.exitWithin3, 0.19, 'exit within 3'); // 21% → 15%
  under(all.landingRepeat, 0.23, 'landing = previous'); // 32% → 17%
  under(all.impactRepeat, 0.17, 'impact = previous'); // 26% → 10%
  under(all.riserRepeat, 0.32, 'riser = previous'); // 37% → 26%
  // R7's bridge pattern, and builds from silence (no longer always R7).
  under(all.bridgeRepeat, 0.27, 'R7 bridge = previous R7'); // 35% → 20%
  under(all.topOpener.share, 0.85, 'builds from silence: top recipe'); // 99% → 64%
  // Lengths: the build or A's move, the bridge, the gap.
  // Early moves are quick since the user's first listen (most last A's last bar), so lengths repeat more there.
  under(all.buildRepeat, 0.47, 'build length = previous'); // 48% → 38%, light early 45%
  under(early.buildRepeat, 0.6, 'build length = previous, early'); // 61% → 44%, light early 56%
  under(mid.topBridgeLength.share, 0.71, 'one bridge length in mid'); // 77% → 64%
  under(late.topBridgeLength.share, 0.63, 'one bridge length in late'); // 73% → 52%
  under(all.gapRepeat, 0.36, 'gap = previous'); // 52% → 25%
  for (const [name, s] of [['mid', mid], ['late', late], ['final', final]] as const) {
    under(s.gapRepeat, 0.4, `gap = previous in ${name}`); // 64% / 60% / 45% → 23% / 19% / 27%
    over(s.gaps, 3, `distinct gaps in ${name}`); // 3 / 2 / 2 → 3 / 4 / 3
  }
  // Signatures do not come back at once, and nothing sounds like one of the last three.
  under(all.signatureReuse, 0.1, 'Signature again within 10'); // 1% → 2%
  under(all.sameAsRecent, 0.03, 'sounds like one of the last 3'); // 4% → 1%
});

test('whole nights: the landings keep the outgoing song\'s phrases', () => {
  // Counted from the hook A landed on: B lands on a 4- or 8-bar boundary of A (an S2 bridge takes A's last bars),
  // or, for an S2 build, A completes its phrase first. Before phrase-aware auto-advance 59% of them fell
  // mid-phrase.
  const byPhase: Record<string, { on: number; all: number }> = {};
  for (const log of nights()) {
    for (const t of log.transitions) {
      if (!t.A || t.A.landedDownbeatIndex == null || t.plan.landIndex == null) continue;
      const tl = deckTimeline(t.A.analysis, t.A.deck, t.A.landedDownbeatIndex);
      const atExit = t.plan.shape === 'S2' && t.plan.exitIndex != null && tl.phraseClass(t.plan.exitIndex) !== 'bar';
      const count = (byPhase[t.plan.phase] ??= { on: 0, all: 0 });
      count.all++;
      if (tl.phraseClass(t.plan.landIndex) !== 'bar' || atExit) count.on++;
    }
  }
  const total = Object.values(byPhase).reduce((sum, c) => ({ on: sum.on + c.on, all: sum.all + c.all }), { on: 0, all: 0 });
  console.log('on a phrase:', Object.entries(byPhase).map(([phase, c]) => `${phase} ${((100 * c.on) / c.all).toFixed(1)}%`).join(', '));
  assert.ok(total.all > 500, `only ${total.all} transitions with A`);
  assert.ok(total.on / total.all > 0.9, `on a phrase: ${total.on}/${total.all}`);
});

test('whole nights: light and clean early, growing with the Phase; the orchestra hit is rare', () => {
  // The user's first listen: too intense everywhere and far too many orchestra hits. Before: an impact on every
  // landing, samples on 67% of early ones (17% an orchestra hit), a riser on 75%; an orchestra hit every second
  // transition.
  const phases: readonly PhaseName[] = ['early', 'mid', 'late', 'final'];
  const share = Object.fromEntries(phases.map((p) => [p, { n: 0, impact: 0, samples: 0, orchestra: 0, riser: 0 }]));
  let all = 0;
  let orchestras = 0;
  for (const log of nights()) {
    for (const round of roundsOf(log)) {
      let last = -Infinity;
      round.forEach((t, k) => {
        const { plan } = t;
        const at = plan.events.filter((e) => e.kind === 'sfx' && e.at >= plan.T - 0.06 && e.at <= plan.T + 1e-6);
        const orchestra = at.some((e) => e.kind === 'sfx' && e.name === 'orchestra-hit');
        const s = share[plan.phase];
        s.n++;
        all++;
        if (plan.events.some((e) => e.kind === 'synth' && e.name === 'impact')) s.impact++;
        if (at.length) s.samples++;
        if (plan.events.some((e) => e.kind === 'synth' && e.name === 'riser')) s.riser++;
        if (orchestra) {
          s.orchestra++;
          orchestras++;
          assert.ok(k - last > MOVES.landing.orchestraCooldown[plan.phase], `night ${log.seed} round ${t.round}: orchestra hits ${k - last} apart`);
          last = k;
        }
      });
    }
  }
  const of = (p: PhaseName, key: 'impact' | 'samples' | 'orchestra' | 'riser') => share[p][key] / share[p].n;
  console.log(phases.map((p) => `${p}: impact ${(100 * of(p, 'impact')).toFixed(0)}%, samples ${(100 * of(p, 'samples')).toFixed(0)}%, orchestra ${(100 * of(p, 'orchestra')).toFixed(0)}%, riser ${(100 * of(p, 'riser')).toFixed(0)}%`).join('; '));
  assert.ok(of('early', 'impact') < 0.5 && of('early', 'samples') < 0.15 && of('early', 'riser') < 0.4, 'early is light');
  assert.ok(of('final', 'impact') > 0.9, 'final always hits');
  // Final's own moves (the power-down, the braker) bring no riser, so the risers are checked up to late.
  for (const key of ['impact', 'samples', 'riser'] as const) {
    const upTo = key === 'riser' ? 3 : phases.length;
    for (let k = 1; k < upTo; k++) assert.ok(of(phases[k], key) >= of(phases[k - 1], key) - 0.02, `${key} grows from ${phases[k - 1]} to ${phases[k]}`);
  }
  assert.equal(share.early.orchestra + share.mid.orchestra, 0, 'no orchestra hit before late');
  assert.ok(orchestras / all < 0.1, `orchestra hits: ${orchestras}/${all}`);
});
