// The Game plan validator through the screens' import path (ui/plan.ts): accepts a good plan, collects every
// problem with its path, never throws; and the screens' bundle helpers (headline prizes first).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { bundleSummary, checkGamePlan, prizeRuns, publicPlan, roundAt, roundPlan, roundTitle, roundTitleOf, splitBundle, sponsorOf } from '../../../../packages/ui/plan.ts';
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
  assert.deepEqual(
    SAMPLE_PLAN.rounds.filter((round) => round.kind !== 'normal').map((round) => [round.number, round.kind]),
    [
      [5, 'desgraciat'],
      [7, 'special'],
    ],
  );
  const desgraciat = SAMPLE_PLAN.rounds[4];
  assert.ok(desgraciat.line.length === 0 && desgraciat.bingo.length >= 17, "the Desgraciat round: no Line, the last card standing's hamper");
  assert.equal(SAMPLE_PLAN.rounds[7].bingo.filter((p) => p.headline).length, 2, 'the last Quina has two headline prizes');
});

/** The 12 staples in every sample hamper (docs/event.md "Prizes and sponsors"), the fruit and the sweet varying. */
const STAPLES = ['Xocolata', 'Torró', 'Neules', 'Vi negre', 'Vi blanc', 'Cava', "Paquet d'arròs", 'Tomàquet', 'Fuet', 'Samarreta de Barrakudes'];

test('the sample plan has real-sized bundles: a 17–19-prize hamper per Quina, a small Line, placeholder sponsors only', () => {
  const sponsorName = (id: string | null) => SAMPLE_PLAN.sponsors.find((s) => s.id === id)?.name;
  for (const round of SAMPLE_PLAN.rounds) {
    const at = `round ${round.number}`;
    const hamper = round.bingo;
    // The hamper (the Desgraciat round's too, in its `bingo` bundle): 17–19 prizes, the plan's limit far off.
    assert.ok(hamper.length >= 17 && hamper.length <= 19 && hamper.length <= 40, `${at}: ${hamper.length} prizes in the hamper`);
    const { headline, others } = splitBundle(hamper);
    assert.deepEqual(headline, hamper.filter((p) => p.headline), `${at}: headline prizes marked and first`);
    assert.equal(headline.length, round.number === 8 ? 2 : 1, `${at}: one headline prize (two in the last Quina)`);
    if (round.kind === 'special') assert.equal(headline[0].title, 'Televisor', 'the Especial is played for a TV');
    for (const title of STAPLES) assert.ok(others.some((p) => p.title === title), `${at}: ${title}`);
    assert.ok(others.some((p) => p.title === 'Panettone' || p.title === 'Bombons') && others.some((p) => p.title === 'Taronges' || p.title === 'Pinya'), `${at}: a sweet and a fruit`);
    assert.equal(others.filter((p) => !p.sponsorId).length, 11, `${at}: the club's 11 staples (its T-shirt is its own gift)`);
    const gifts = others.filter((p) => p.sponsorId && p.sponsorId !== 'barrakudes');
    assert.ok(gifts.length >= 4 && gifts.length <= 6, `${at}: ${gifts.length} sponsors' vouchers or products`);
    assert.equal(new Set(gifts.map((p) => p.sponsorId)).size, gifts.length, `${at}: each gift from a different sponsor`);
    // The Line: something small (a bottle of white wine, a fuet, neules and a small sponsor's prize); none in the Desgraciat round.
    if (round.kind === 'desgraciat') assert.deepEqual(round.line, [], `${at}: no Line`);
    else {
      assert.deepEqual(round.line.map((p) => p.title).slice(0, 3), ['Ampolla de vi blanc', 'Fuet', 'Neules'], `${at}: the Line's prize`);
      assert.equal(round.line.length, 4);
      assert.ok(round.line[0].headline && round.line[3].sponsorId, `${at}: the wine leads, a small sponsor's prize closes`);
    }
    for (const p of [...round.line, ...round.bingo]) assert.ok(!p.sponsorId || sponsorName(p.sponsorId), `${at}: ${p.title}'s sponsor is in the plan`);
  }
  // Made-up sponsors only: bracketed placeholders, obviously generic ones, or the club itself. Never a real business.
  for (const s of SAMPLE_PLAN.sponsors) assert.match(s.name, /^(\[Patrocinador \d+\]|Barrakudes|Forn del poble|Botiga d'esports|Restaurant del port)$/, s.name);
  // Every sponsor but the money donor gives something.
  const giving = new Set(SAMPLE_PLAN.rounds.flatMap((r) => [...r.line, ...r.bingo]).map((p) => p.sponsorId));
  assert.deepEqual(SAMPLE_PLAN.sponsors.filter((s) => !giving.has(s.id)).map((s) => s.id), ['patrocinador-16']);
});

test("a bundle's other prizes run compact: plain ones together, each with a sponsor or a detail alone, nothing reordered", () => {
  const p = (title: string, sponsor: string | null = null, detail: string | null = null) => ({ title, sponsor, detail });
  const items = [p('Xocolata'), p('Torró'), p('Samarreta', 'Barrakudes'), p('Neules'), p('Sopar', null, 'Per a dos'), p('Val de 20 €', 'Forn'), p('Fuet'), p('Cava')];
  const runs = prizeRuns(items);
  assert.deepEqual(
    runs.map((r) => [r.plain, r.items.map((i) => i.title)]),
    [
      [true, ['Xocolata', 'Torró']],
      [false, ['Samarreta']],
      [true, ['Neules']],
      [false, ['Sopar']],
      [false, ['Val de 20 €']],
      [true, ['Fuet', 'Cava']],
    ],
  );
  assert.deepEqual(runs.flatMap((r) => r.items), items, 'every prize, in order');
  assert.deepEqual(prizeRuns([]), []);
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

test('a round is named by its Quina number; the special rounds have none and do not count (2025\'s order)', () => {
  const n = (number: number) => ({ number, kind: 'normal' as const });
  const order2025 = { rounds: [n(1), n(2), n(3), { number: 4, kind: 'desgraciat' as const }, n(5), n(6), { number: 7, kind: 'special' as const }, n(8)] };
  assert.deepEqual(order2025.rounds.map((r) => roundTitle(r, order2025)), [
    'Quina 1', 'Quina 2', 'Quina 3', 'Quina Desgraciada', 'Quina 4', 'Quina 5', 'Quina Especial', 'Quina 6',
  ]);
});

test('the sample plan: the Desgraciat round 5 and the Especial round 7 have no number; round 8 is Quina 6', () => {
  assert.deepEqual(SAMPLE_PLAN.rounds.map((r) => roundTitle(r, SAMPLE_PLAN)), [
    'Quina 1', 'Quina 2', 'Quina 3', 'Quina 4', 'Quina Desgraciada', 'Quina 5', 'Quina Especial', 'Quina 6',
  ]);
  // The public plan names them the same way (the phones').
  const shown = publicPlan(SAMPLE_PLAN, []);
  assert.equal(roundTitle(shown.rounds[5], shown), 'Quina 5');
  // The total after a normal round's number stays the night's count (pending U163); a special round has neither.
  assert.equal(roundTitleOf(SAMPLE_PLAN.rounds[5], SAMPLE_PLAN, 8), 'Quina 5 de 8');
  assert.equal(roundTitleOf(SAMPLE_PLAN.rounds[6], SAMPLE_PLAN, 8), 'Quina Especial');
  assert.equal(roundTitleOf(SAMPLE_PLAN.rounds[4], SAMPLE_PLAN, 8), 'Quina Desgraciada');
  assert.equal(roundTitleOf(SAMPLE_PLAN.rounds[5], SAMPLE_PLAN, null), 'Quina 5', 'no total');
  assert.equal(roundTitleOf(SAMPLE_PLAN.rounds[5], SAMPLE_PLAN, 0), 'Quina 5', 'an engine that counts none');
});

test('a round known by its number only takes its kind from the plan', () => {
  assert.deepEqual(roundAt(SAMPLE_PLAN, 7), { number: 7, kind: 'special' });
  assert.equal(roundTitle(roundAt(SAMPLE_PLAN, 8), SAMPLE_PLAN), 'Quina 6');
  assert.deepEqual(roundAt(SAMPLE_PLAN, 12), { number: 12, kind: 'normal' }, 'a round the plan lacks: normal');
  assert.deepEqual(roundAt(null, 5, 'desgraciat'), { number: 5, kind: 'desgraciat' }, 'unless the screen knows its kind');
});

test('without the plan, or with one that lacks the round, a normal round keeps its plan number; the specials keep their names', () => {
  assert.equal(roundTitle({ number: 6, kind: 'normal' }, null), 'Quina 6');
  assert.equal(roundTitle({ number: 12, kind: 'normal' }, SAMPLE_PLAN), 'Quina 12', 'an old snapshot past the plan');
  assert.equal(roundTitle({ number: 7, kind: 'special' }, null), 'Quina Especial');
  assert.equal(roundTitle({ number: 5, kind: 'desgraciat' }, null), 'Quina Desgraciada');
  assert.equal(roundTitleOf({ number: 6, kind: 'normal' }, null, 8), 'Quina 6 de 8');
});
