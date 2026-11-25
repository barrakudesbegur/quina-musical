// The Game plan validator: accepts a good plan (version 3, or a version 1 or 2 one it migrates), collects every
// problem with its path, never throws; and the public plan phones see (locked rounds keep only their skeleton).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkGamePlan, headlinePrizes, publicPlan, revealedRounds, roundCardPrice, roundCardType, roundPlan, sponsorOf, PLAN_VERSION } from '../../../packages/protocol/plan.ts';

const prize = (title: string, headline: boolean, sponsorId: string | null = null) => ({ title, detail: null, sponsorId, image: null, headline });

const good = () => ({
  v: 3,
  edition: '26',
  title: 'Quina Quina 3',
  prizeReveal: 'perRound',
  sponsors: [{ id: 'forn-can-pep', name: 'Forn Can Pep', logo: null }],
  rounds: [
    { number: 1, kind: 'normal', cardType: 'normal', line: [prize('Coca de recapte', true, 'forn-can-pep'), prize('Samarreta', false)], bingo: [prize('Sopar per a dos', true), prize('Pernil', true), prize('Tassa', false)] },
    { number: 2, kind: 'special', cardType: 'especial', line: [], bingo: [prize('Pernil', true)] },
  ] as Record<string, unknown>[],
  schedule: { startAtMs: null, roundMinutes: 25, intervalMinutes: 3 },
  cheatSheet: { claimRules: ['El primer que canta guanya.'], specialRoundRules: ['Només compten els cartrons especials.'] },
});

test('a good plan passes and comes back trimmed and typed', () => {
  const r = checkGamePlan(good());
  assert.equal(r.ok, true);
  if (!r.ok) return;
  assert.equal(r.plan.v, PLAN_VERSION);
  assert.equal(r.plan.rounds.length, 2);
  assert.equal(sponsorOf(r.plan, r.plan.rounds[0].line[0])?.name, 'Forn Can Pep');
  assert.equal(roundPlan(r.plan, 2)?.kind, 'special');
  assert.deepEqual(headlinePrizes(r.plan.rounds[0].bingo).map((p) => p.title), ['Sopar per a dos', 'Pernil']);
  assert.deepEqual(checkGamePlan(r.plan), r, 'a checked plan checks the same');
});

test('a version 2 plan is read as version 3: its card types say which type each round plays, then go', () => {
  const v2 = {
    ...good(), v: 2,
    cardTypes: [
      { type: 'normal', name: 'Cartró normal', color: '#cfe8ff', priceCents: 300, rounds: ['normal'] },
      { type: 'especial', name: 'Cartró especial', color: '#ffd9e8', priceCents: 500, rounds: ['special'] },
    ],
    rounds: good().rounds.map(({ cardType: _cardType, ...r }) => r),
  };
  const r = checkGamePlan(v2);
  assert.ok(r.ok);
  assert.equal(r.plan.v, PLAN_VERSION);
  assert.ok(!('cardTypes' in r.plan));
  assert.deepEqual(r.plan.rounds.map((x) => x.cardType), ['normal', 'especial']);
  // The normal card also played the special round.
  v2.cardTypes[0].rounds = ['normal', 'special'];
  const both = checkGamePlan(v2);
  assert.ok(both.ok);
  assert.deepEqual(both.plan.rounds.map((x) => x.cardType), ['normal', 'normal'], 'the first type that listed the kind');
  // A round that named its type (card type per round, step A) keeps it; none listed: the kind's default.
  const named = checkGamePlan({ ...v2, cardTypes: [], rounds: good().rounds });
  assert.ok(named.ok);
  assert.deepEqual(named.plan.rounds.map((x) => x.cardType), ['normal', 'especial']);
  // `cardTypes` is only read from version 2.
  const v3 = checkGamePlan({ ...good(), cardTypes: [] });
  assert.ok(!v3.ok && v3.errors.some((e) => /unknown key "cardTypes"/.test(e)));
});

test('a version 1 plan is read as version 3: each prize becomes a bundle of one headline prize', () => {
  const v1 = {
    v: 1, edition: '26', title: 'Quina Musical',
    sponsors: [], schedule: { startAtMs: null, roundMinutes: 25, intervalMinutes: 3 }, cheatSheet: { claimRules: [], specialRoundRules: [] },
    rounds: [{ number: 1, kind: 'normal', line: { title: 'Coca', detail: null, sponsorId: null, image: null }, bingo: null }],
  };
  const r = checkGamePlan(v1);
  assert.equal(r.ok, true);
  if (!r.ok) return;
  assert.equal(r.plan.v, 3);
  assert.equal(r.plan.prizeReveal, 'perRound');
  assert.deepEqual(r.plan.rounds[0].line, [{ title: 'Coca', detail: null, sponsorId: null, image: null, headline: true }]);
  assert.deepEqual(r.plan.rounds[0].bingo, []);
  assert.equal(r.plan.rounds[0].cardType, 'normal');
});

test('every problem is reported with its path', () => {
  const p = good() as Record<string, unknown>;
  const rounds = p.rounds as Record<string, unknown>[];
  rounds[1].number = 5;
  ((rounds[0].line as Record<string, unknown>[])[0]).sponsorId = 'nobody';
  (rounds[0].bingo as unknown[]).reverse(); // a non-headline prize before the headline ones
  rounds[1].cardType = 'Especial';
  p.prizeReveal = 'sometimes';
  p.edition = '2026';
  p.extra = true;
  const r = checkGamePlan(p);
  assert.equal(r.ok, false);
  if (r.ok) return;
  const joined = r.errors.join('\n');
  assert.match(joined, /plan: unknown key "extra"/);
  assert.match(joined, /plan\.edition/);
  assert.match(joined, /plan\.prizeReveal/);
  assert.match(joined, /plan\.rounds\[1\]\.number: must be 2/);
  assert.match(joined, /plan\.rounds\[0\]\.line\[0\]\.sponsorId: no sponsor with id "nobody"/);
  assert.match(joined, /plan\.rounds\[0\]\.bingo: headline prizes must come first/);
  assert.match(joined, /plan\.rounds\[1\]\.cardType/);
});

test('garbage never throws', () => {
  for (const junk of [null, 42, 'plan', [], { v: 1 }, { v: 2 }, { v: 3 }, { v: 4 }, { rounds: 'x', sponsors: {}, schedule: [], cheatSheet: 1 }]) {
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

test('phones see a locked round\'s skeleton only, never its prizes nor how many; no cheat sheet', () => {
  const r = checkGamePlan(good());
  assert.ok(r.ok);
  const revealed = revealedRounds(r.plan, []);
  assert.deepEqual(revealed, [1], 'per round: round 1 from the start');
  const pub = publicPlan(r.plan, revealed);
  assert.deepEqual(pub.rounds[1], { number: 2, kind: 'special', cardType: 'especial', revealed: false }, 'its card type is printed: never secret');
  assert.equal(pub.rounds[0].revealed, true);
  assert.equal(pub.rounds[0].bingo?.length, 3);
  assert.ok(!('cheatSheet' in pub));
  assert.ok(!JSON.stringify(pub.rounds[1]).includes('Pernil'));
  assert.equal(pub.title, 'Quina Quina 3');
  // Announced (roundIntro) or revealed by the presenters.
  assert.deepEqual(revealedRounds(r.plan, [{ round: 2, by: 'intro' }]), [1, 2]);
  // All secret: only what the presenters reveal, and round 1 is no exception.
  const secret = { prizeReveal: 'allSecret' as const };
  assert.deepEqual(revealedRounds(secret, [{ round: 2, by: 'intro' }]), []);
  assert.deepEqual(revealedRounds(secret, [{ round: 2, by: 'presenters' }, { round: 1, by: 'intro' }]), [2]);
});

test('a round that names no card type plays its kind\'s default; any card-types.json id is fine to the plan', () => {
  const bare = checkGamePlan({ ...good(), rounds: good().rounds.map(({ cardType: _cardType, ...r }) => r) });
  assert.ok(bare.ok);
  assert.deepEqual(bare.plan.rounds.map((x) => x.cardType), ['normal', 'especial']);
  assert.equal(roundCardType({ kind: 'special' }), 'especial', 'a round from before card types per round');
  const own = good();
  own.rounds[0].cardType = 'groc2';
  own.rounds[1].cardType = 'normal';
  const o = checkGamePlan(own);
  assert.ok(o.ok);
  assert.deepEqual(o.plan.rounds.map((x) => x.cardType), ['groc2', 'normal']);
});

test('a round\'s card type must look like a card-types.json id', () => {
  for (const bad of ['Especial', 'cartró', 'es-pecial', '', 7, null]) {
    const p = good();
    (p.rounds[0] as Record<string, unknown>).cardType = bad;
    const r = checkGamePlan(p);
    assert.equal(r.ok, false, String(bad));
    if (!r.ok) assert.match(r.errors.join('\n'), /plan\.rounds\[0\]\.cardType/);
  }
});

test('planned breaks: after a round that isn\'t the last, once each, 1–60 minutes; none by default', () => {
  const r = checkGamePlan(good());
  assert.ok(r.ok);
  assert.equal(r.plan.schedule.breaks, undefined, 'none: absent, so the plan reads back unchanged');
  const p = good();
  (p.schedule as Record<string, unknown>).breaks = [{ afterRound: 1, minutes: 5 }];
  const ok = checkGamePlan(p);
  assert.ok(ok.ok);
  assert.deepEqual(ok.plan.schedule.breaks, [{ afterRound: 1, minutes: 5 }]);
  assert.deepEqual(publicPlan(ok.plan, [1]).schedule.breaks, [{ afterRound: 1, minutes: 5 }], 'public: phones show it in Horari');
  for (const bad of [[{ afterRound: 2, minutes: 5 }], [{ afterRound: 1, minutes: 0 }], [{ afterRound: 1, minutes: 5 }, { afterRound: 1, minutes: 3 }], [{ afterRound: 1 }], 'x']) {
    const q = good();
    (q.schedule as Record<string, unknown>).breaks = bad;
    const c = checkGamePlan(q);
    assert.equal(c.ok, false, JSON.stringify(bad));
    if (!c.ok) assert.match(c.errors.join('\n'), /plan\.schedule\.breaks/);
  }
});

test('the card price before a round: per regular round still to play, or the especial card\'s fixed price', () => {
  const rounds = [
    { number: 1, kind: 'normal' as const }, { number: 2, kind: 'normal' as const }, { number: 3, kind: 'desgraciat' as const },
    { number: 4, kind: 'normal' as const }, { number: 5, kind: 'special' as const },
  ];
  const plan = { rounds: rounds.map((r) => ({ ...r, cardType: r.kind === 'special' ? 'especial' : 'normal', line: [], bingo: [] })) };
  const normal = { priceCents: 150 };
  assert.equal(roundCardPrice(plan, 1, normal), 450, 'before round 1: 3 regular rounds (the Desgraciat and the Especial never count)');
  assert.equal(roundCardPrice(plan, 3, normal), 150, 'before the Desgraciat: the regular rounds after it');
  assert.equal(roundCardPrice(plan, 4, { priceCents: 150, priceRule: 'perRegularRound' }), 150);
  assert.equal(roundCardPrice(plan, 5, { priceCents: 500, priceRule: 'fixed' }), 500);
  assert.equal(roundCardPrice(plan, 1, { priceCents: null }), null);
  // Last year's night: 10 regular rounds at 1.50 €, 15 € before round 1.
  const ten = { rounds: Array.from({ length: 10 }, (_, i) => ({ number: i + 1, kind: 'normal' as const, cardType: 'normal', line: [], bingo: [] })) };
  assert.equal(roundCardPrice(ten, 1, normal), 1500);
});
