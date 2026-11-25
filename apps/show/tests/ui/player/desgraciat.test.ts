// The Desgraciat round on phones: each card's state from the round's kind, its card type and the landings; the
// falls only at their landing; the sounds (one bloop per landing, none for a ✗ on a seated card); the phone
// budget; the names, the single prize and the 'standing' Celebration, with no winning card numbers.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PROTOCOL_VERSION, type ShowState } from '@quina/protocol';
import { baseState } from '../../../../../packages/ui/fixtures/states.ts';
import { SAMPLE_PLAN } from '../../../../../packages/ui/fixtures/plan.ts';
import { publicPlan } from '../../../../../packages/ui/plan.ts';
import { parseCards } from '../../../../../packages/ui/data/catalog.ts';
import { PublicProjector } from '../../../../player/feed/project.ts';
import { emptyPublicState, type PublicRound, type PublicState } from '../../../../player/feed/public.ts';
import { FALL_ELEMENTS, budgetMarks, fallStagger, fallenKeys, fellAtLatest, isDesgraciat, standUpPlace, standingIds, standOf } from '../../../../player/logic/desgraciat.ts';
import { feedbackFor, type FeedbackSnapshot } from '../../../../player/logic/feedback.ts';
import { addCard, emptyData } from '../../../../player/logic/storage.ts';
import { cardViews, celebrationOf, markKeys, prizeRounds, roundKindOf } from '../../../../player/logic/view.ts';
import { S } from '../../../../player/strings.ts';

const catalog = parseCards([
  { id: 123, type: 'normal', lines: [[2, 17, 41, 69], [11, 15, 31, 64], [3, 55, 66, 68]] },
  { id: 57, type: 'normal', lines: [[5, 14, 64, 75], [15, 18, 60, 69], [2, 62, 16, 20]] },
  { id: 412, type: 'especial', lines: [[19, 31, 59, 74], [45, 57, 65, 69], [1, 37, 48, 58]] },
]);
const saved = (() => {
  let d = emptyData('26');
  for (const id of [123, 57, 412]) {
    const r = addCard(d, id, 0);
    if (r.ok) d = r.data;
  }
  return d.cards;
})();
const round = (songs: number[], patch: Partial<PublicRound> = {}): PublicRound => ({
  number: 3,
  kind: 'desgraciat',
  cardType: 'normal',
  startedAtMs: 0,
  lineConfirmed: false,
  ended: false,
  landings: songs.map((songId, position) => ({ position, songId, atMs: position })),
  ...patch,
});
const entries = (r: PublicRound) => cardViews(saved, catalog, r).map((v) => ({ cardId: v.saved.id, stand: v.stand }));

test("each playing card stands until one of its songs lands; another type's cards don't play", () => {
  const views = cardViews(saved, catalog, round([25, 1, 7]));
  assert.deepEqual(views.map((v) => [v.saved.id, v.valid, v.stand]), [
    [123, true, { fall: null }],
    [57, true, { fall: null }],
    [412, false, null],
  ]);
  const later = cardViews(saved, catalog, round([25, 31, 7, 69]));
  assert.deepEqual(later[0].stand, { fall: { songId: 31, position: 1 } }, 'the song that sank it, and where');
  assert.deepEqual(later[1].stand, { fall: { songId: 69, position: 3 } });
  assert.equal(later[0].marks?.count, 2, 'every landed song on it gets its ✗ (31 and 69)');
  assert.deepEqual(standingIds(entries(round([25, 31]))), [57]);
});

test('the round plays its card type: a Desgraciat round on the especial cards', () => {
  const views = cardViews(saved, catalog, round([31], { cardType: 'especial' }));
  assert.deepEqual(views.map((v) => [v.saved.id, v.stand]), [[123, null], [57, null], [412, { fall: { songId: 31, position: 0 } }]]);
});

test('one special card plays the Desgraciat and then the Especial (D81): its fall stays in the Desgraciat round', () => {
  // The Desgraciat on the special cards: #412 sits down when 31 lands.
  const desgraciat = cardViews(saved, catalog, round([31, 45], { number: 5, cardType: 'especial' }));
  assert.deepEqual(desgraciat.map((v) => [v.saved.id, v.valid]), [[123, false], [57, false], [412, true]]);
  assert.deepEqual(desgraciat[2].stand, { fall: { songId: 31, position: 0 } });
  // The Especial, later, on the same phone: #412 plays again, standing nowhere, marked only by this round's songs.
  const especial = cardViews(saved, catalog, round([45, 7], { number: 7, kind: 'special', cardType: 'especial' }));
  assert.deepEqual(especial.map((v) => [v.saved.id, v.valid, v.stand]), [[123, false, null], [57, false, null], [412, true, null]]);
  assert.equal(especial[2].marks?.count, 1, '45 only; the Desgraciat round\'s 31 is not carried over');
  assert.deepEqual([...especial[2].near], [], 'nothing near a win yet');
  assert.equal(S.typeRule('Cartró especial'), 'En aquesta quina només juga el cartró especial.', 'the same line in both rounds');
});

test('outside the Desgraciat round no card has a stand; the near-win highlight never runs in it', () => {
  assert.ok(cardViews(saved, catalog, round([2, 17, 41], { kind: 'normal' })).every((v) => v.stand === null));
  assert.deepEqual([...cardViews(saved, catalog, round([2, 17, 41], { kind: 'normal' }))[0].near], [69], 'a normal round: 1 song from a Line');
  assert.ok(cardViews(saved, catalog, round([2, 17, 41])).every((v) => v.near.size === 0), 'the Desgraciat round: nothing highlighted');
  assert.equal(standOf(null, true, round([])), null);
  assert.equal(isDesgraciat(null), false);
});

test('which cards fell at the latest landing: card-fall runs only for these', () => {
  assert.deepEqual(fellAtLatest(entries(round([25, 31])), round([25, 31])), [123]);
  assert.deepEqual(fellAtLatest(entries(round([25, 31, 69])), round([25, 31, 69])), [57], '123 was already seated');
  assert.deepEqual(fellAtLatest(entries(round([25, 69])), round([25, 69])), [123, 57], 'both, in card order');
  assert.deepEqual(fellAtLatest(entries(round([25, 31, 7])), round([25, 31, 7])), [], 'a landing on nobody');
  assert.deepEqual(fellAtLatest(entries(round([])), round([])), []);
  assert.deepEqual(fellAtLatest(entries(round([31], { kind: 'normal' })), round([31], { kind: 'normal' })), []);
});

/** The feedback snapshot the model takes, for a round. */
const snapOf = (r: PublicRound | null, patch: Partial<FeedbackSnapshot> = {}): FeedbackSnapshot => {
  const views = cardViews(saved, catalog, r);
  const stands = views.filter((v) => v.valid).map((v) => ({ cardId: v.saved.id, stand: v.stand }));
  return {
    round: r?.number ?? null,
    landings: r?.landings.length ?? 0,
    marks: markKeys(views),
    near: [],
    celebration: null,
    desgraciat: isDesgraciat(r),
    standing: standingIds(stands),
    fallen: fallenKeys(stands),
    latest: r?.landings.length ? Math.max(...r.landings.map((l) => l.position)) : null,
    ...patch,
  };
};

test('a card falls at its landing: one bloop however many cards fall, and its ✗ stamps', () => {
  const fall = feedbackFor(snapOf(round([25])), snapOf(round([25, 69])));
  assert.deepEqual(fall, { cue: 'fall', freshMarks: ['123:69', '57:69'], freshFalls: [123, 57], standUp: false });
});

test('a later landing on a seated card stamps only its ✗, with no sound but the landing pop', () => {
  const next = feedbackFor(snapOf(round([25, 31])), snapOf(round([25, 31, 2])));
  assert.deepEqual(next.freshFalls, [57], '2 is on both: 57 falls, 123 only gets a ✗');
  assert.equal(next.cue, 'fall');
  const seatedOnly = feedbackFor(snapOf(round([25, 31])), snapOf(round([25, 31, 41])));
  assert.deepEqual(seatedOnly, { cue: 'landing', freshMarks: ['123:41'], freshFalls: [], standUp: false }, 'no mark tock in this round');
});

test('never before the landing, never again: the first look, a reload and a catalogue load are quiet', () => {
  assert.deepEqual(feedbackFor(null, snapOf(round([25, 31]))).freshFalls, [], 'opening the app on a seated card');
  assert.deepEqual(feedbackFor(snapOf(round([25, 31])), snapOf(round([25, 31]))).freshFalls, []);
  // A card that shows as seated without its fall being the latest landing (a card just added) never animates.
  assert.deepEqual(feedbackFor(snapOf(round([25, 31, 7]), { fallen: [] }), snapOf(round([25, 31, 7]))).freshFalls, []);
});

test('Back stands a card up quietly, and a new landing can sink it again', () => {
  const back = feedbackFor(snapOf(round([25, 31])), snapOf(round([25])));
  assert.deepEqual([back.cue, back.freshFalls], [null, []]);
  assert.deepEqual(feedbackFor(snapOf(round([25])), snapOf(round([25, 31]))).freshFalls, [123]);
});

test('the round starting stands the playing cards up, with one tap blip; not a normal round, not mid-round', () => {
  const start = feedbackFor(snapOf(round([], { number: 2, kind: 'normal' })), snapOf(round([])));
  assert.deepEqual(start, { cue: 'standUp', freshMarks: [], freshFalls: [], standUp: true });
  assert.deepEqual(feedbackFor(snapOf(null), snapOf(round([]))).standUp, true, 'the first round of the night too');
  assert.equal(feedbackFor(snapOf(round([], { number: 2 })), snapOf(round([], { number: 3, kind: 'normal' }))).standUp, false);
  assert.equal(feedbackFor(null, snapOf(round([]))).standUp, false, 'opening the app during the round');
  const noneOfMine = feedbackFor(snapOf(null), snapOf(round([], { cardType: 'daurat' })));
  assert.deepEqual([noneOfMine.cue, noneOfMine.standUp], [null, false], 'no card of the round\'s type');
});

test('the phone budget: at most 24 animated elements, the falls first, then the other cells', () => {
  assert.equal(Math.floor(24 / FALL_ELEMENTS), 3);
  assert.deepEqual([...fallStagger([1, 2, 3, 4])], [[1, 0], [2, 1], [3, 2]], 'a fourth fall appears seated at once');
  const falls = fallStagger([1]);
  const fresh = ['1:5', ...Array.from({ length: 30 }, (_, i) => `${i + 10}:5`)];
  const marks = budgetMarks(fresh, falls);
  assert.equal(marks[0], '1:5', "the falling card's own ✗ always stamps");
  assert.equal(marks.length, 1 + 24 - FALL_ELEMENTS);
  assert.deepEqual([standUpPlace(0, true), standUpPlace(11, true), standUpPlace(12, true), standUpPlace(0, false)], [0, 11, null, null]);
});

const PLAN = (() => {
  const plan = publicPlan(SAMPLE_PLAN, [1, 2, 3]);
  return { ...plan, rounds: plan.rounds.map((r) => (r.number === 3 ? { ...r, kind: 'desgraciat' as const, line: [] } : r)) };
})();
const state = (patch: Partial<PublicState> = {}): PublicState => ({
  ...emptyPublicState('26'),
  gameId: 'g',
  scene: 'play',
  link: { online: true, sinceMs: 0 },
  rounds: [round([25, 31])],
  ...patch,
});

test('Premis: the Desgraciat round has one bundle, the last card standing\'s, and no Line', () => {
  const rounds = prizeRounds(PLAN, state({ winners: [{ round: 3, kind: 'standing', cardIds: [57] }] }), [123]);
  const desgraciat = rounds[2];
  assert.equal(desgraciat.kind, 'desgraciat');
  assert.deepEqual(desgraciat.lines.map((l) => l.kind), ['standing']);
  assert.equal(desgraciat.lines[0].headline[0]?.title, SAMPLE_PLAN.rounds[2].bingo[0].title, 'its prizes are the plan\'s `bingo` bundle');
  assert.deepEqual([desgraciat.lines[0].won, desgraciat.lines[0].ownCardIds], [true, []], 'won, by nobody named');
  assert.deepEqual(rounds[1].lines.map((l) => l.kind), ['line', 'bingo'], 'other rounds keep both');
  assert.equal(S.prize.standing, "Premi de l'últim dempeus");
});

test("the Celebration for the last card standing: no title (U6), the phone's own card, never a number", () => {
  const winners = [{ round: 3, kind: 'standing' as const, cardIds: [4242] }];
  const others = celebrationOf(state({ scene: 'celebration', winners }), [123, 57]);
  assert.deepEqual(others, { key: 'celebration:3:standing', kind: 'standing', round: 3, ownCardIds: [] });
  assert.ok(!JSON.stringify(others).includes('4242'));
  const mine = celebrationOf(state({ scene: 'celebration', winners: [{ round: 3, kind: 'standing', cardIds: [57] }] }), [123, 57]);
  assert.deepEqual(mine?.ownCardIds, [57]);
  assert.equal(S.shout.standing, null, 'no word shouted in the Desgraciat round');
  assert.equal(S.yourWin.standing, null, "not even on the winner's phone");
});

test('the round is "Quina Desgraciada" wherever it is named; its kind comes from the intro, the rounds or the plan', () => {
  assert.equal(S.roundName(3, 'desgraciat'), 'Quina Desgraciada');
  assert.equal(S.roundName(3, 'special'), 'Quina 3');
  assert.equal(S.prizesOf(S.roundName(3, 'desgraciat')), 'Premis de la Quina Desgraciada');
  assert.equal(S.nextRound(S.roundName(4, 'normal')), 'Següent: Quina 4');
  assert.equal(roundKindOf(3, state(), null), 'desgraciat');
  assert.equal(roundKindOf(3, state({ rounds: [] }), PLAN), 'desgraciat', 'from the plan before it is played');
  assert.equal(roundKindOf(5, state({ intro: { round: 5, kind: 'desgraciat' } }), null), 'desgraciat', 'its intro');
  assert.equal(roundKindOf(9, state(), PLAN), 'normal');
  assert.equal(roundKindOf(null, state(), PLAN), 'normal');
});

test('the dev projection keeps the Desgraciat kind and ends the round on its last card standing', () => {
  const NOW = 1_700_000_000_000;
  const s = baseState(NOW);
  const desgraciat = { ...s, round: { ...s.round, kind: 'desgraciat' as const, cardType: 'normal' } };
  const ctx = { nowMs: NOW, edition: '26', gameId: 'g', link: { online: true, sinceMs: 0 }, plan: null, notice: null, soundsDefault: true };
  const p = new PublicProjector(() => 0.5);
  p.ingest(desgraciat as ShowState, NOW);
  const playing = p.project(ctx).rounds.at(-1);
  assert.deepEqual([playing?.kind, playing?.cardType, playing?.ended], ['desgraciat', 'normal', false]);
  const won = {
    ...desgraciat,
    scene: 'celebration',
    celebration: { kind: 'standing', round: 3, cardIds: [57], winningSongId: null, sinceMs: NOW, music: 'victory' },
  };
  p.ingest({ ...won, v: PROTOCOL_VERSION } as unknown as ShowState, NOW);
  const out = p.project(ctx);
  assert.deepEqual(out.winners.at(-1), { round: 3, kind: 'standing', cardIds: [57] });
  assert.equal(out.rounds.at(-1)?.ended, true);
});
