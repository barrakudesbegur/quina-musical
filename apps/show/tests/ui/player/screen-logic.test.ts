// The pure rules behind the screens: the connection strip (offline, reconnecting, connected) and the pause, the reel
// synced to the Spin, the feedback cues (one at a time), the near-win highlight, and the derived views (no winning
// card numbers anywhere). The add-card pad's rules are in pad.test.ts.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { emptyPublicState, type PublicState } from '../../../../player/feed/public.ts';
import { feedbackFor, type FeedbackSnapshot } from '../../../../player/logic/feedback.ts';
import { reelOffset, reelState } from '../../../../player/logic/reel.ts';
import { NO_BANNER, connectionProblem, nextBanner, pauseOn, type BannerState, type StatusInput } from '../../../../player/logic/status.ts';
import { addCard, emptyData } from '../../../../player/logic/storage.ts';
import {
  cardViews,
  celebrationOf,
  focusRoundNumber,
  heatLevel,
  historyOf,
  kernelTilt,
  markKeys,
  markedIdentities,
  plannedStarts,
  planOf,
  prizeRounds,
  progress,
  roundRule,
} from '../../../../player/logic/view.ts';
import { SAMPLE_PLAN } from '../../../../../packages/ui/fixtures/plan.ts';
import { publicPlan } from '../../../../../packages/ui/plan.ts';
import { parseCards } from '../../../../../packages/ui/data/catalog.ts';
import { S } from '../../../../player/strings.ts';
import { songsOnCards } from '../../../../player/logic/your-song.ts';

const T = 1_000_000;
const playing = (patch: Partial<PublicState> = {}): PublicState => ({
  ...emptyPublicState('26'),
  gameId: 'g',
  scene: 'play',
  link: { online: true, sinceMs: 0 },
  rounds: [{ number: 3, kind: 'normal', startedAtMs: 0, lineConfirmed: false, ended: false, landings: [] }],
  ...patch,
});
const online = { online: true, sinceMs: 0, lastOutageMs: 0 };

// ---- connection strip and pause ---------------------------------------------------------------------------
const at = (patch: Partial<StatusInput> = {}): StatusInput => ({ state: playing(), connection: online, localNowMs: T, cloudNowMs: T, ...patch });

test('offline after 20 s without the laptop link, or without the feed, while the show is on', () => {
  const linkDown = playing({ link: { online: false, sinceMs: T } });
  assert.equal(connectionProblem(at({ state: linkDown, cloudNowMs: T + 19_000 })), null, 'the phone is fine: nothing yet');
  assert.equal(connectionProblem(at({ state: linkDown, cloudNowMs: T + 20_000 })), 'offline');
  const feedDown = { online: false, sinceMs: T, lastOutageMs: 0 };
  assert.equal(connectionProblem(at({ connection: feedDown, localNowMs: T + 19_999 })), 'reconnecting', 'the short-drop strip first');
  assert.equal(connectionProblem(at({ connection: feedDown, localNowMs: T + 20_000 })), 'offline', 'then offline, one strip only');
});

test('a short drop of the phone\'s feed: nothing for 3 s, then "Reconnectant…", before the Game too', () => {
  const feedDown = { online: false, sinceMs: T, lastOutageMs: 0 };
  assert.equal(connectionProblem(at({ connection: feedDown, localNowMs: T + 2999 })), null);
  assert.equal(connectionProblem(at({ connection: feedDown, localNowMs: T + 3000 })), 'reconnecting');
  const before = { ...playing(), scene: 'before' as const };
  assert.equal(connectionProblem(at({ state: before, connection: feedDown, localNowMs: T + 60_000 })), 'reconnecting', 'never offline before the Game');
});

test('no offline strip before or after the Game, when a switched-off laptop is normal', () => {
  const before = { ...playing({ link: { online: false, sinceMs: 0 } }), scene: 'before' as const };
  assert.equal(connectionProblem(at({ state: before })), null);
  assert.equal(connectionProblem(at({ state: { ...before, scene: 'after' } })), null);
  assert.equal(connectionProblem(at({ state: null, connection: { online: false, sinceMs: T, lastOutageMs: 0 }, localNowMs: T + 1000 })), null);
});

test('the strip: offline, then green "Connectat" for 1 s once back, then gone; a blip shows nothing', () => {
  const linkDown = playing({ link: { online: false, sinceMs: T } });
  let b: BannerState = NO_BANNER;
  b = nextBanner(b, at({ state: linkDown, cloudNowMs: T + 25_000, localNowMs: T + 25_000 }));
  assert.deepEqual(b, { banner: 'offline', sinceMs: T + 25_000 });
  const same = nextBanner(b, at({ state: linkDown, cloudNowMs: T + 26_000, localNowMs: T + 26_000 }));
  assert.equal(same, b, 'unchanged: the same object, so the screen doesn\'t redraw');
  b = nextBanner(b, at({ state: playing({ link: { online: true, sinceMs: T + 30_000 } }), localNowMs: T + 30_000 }));
  assert.deepEqual(b, { banner: 'connected', sinceMs: T + 30_000 });
  assert.equal(nextBanner(b, at({ localNowMs: T + 30_999 })).banner, 'connected');
  b = nextBanner(b, at({ localNowMs: T + 31_000 }));
  assert.equal(b.banner, null);
  // A blip under 3 s never showed a strip, so nothing says "Connectat" either.
  const blip = nextBanner(NO_BANNER, at({ connection: { online: false, sinceMs: T, lastOutageMs: 0 }, localNowMs: T + 1000 }));
  assert.equal(blip, NO_BANNER);
  assert.equal(nextBanner(blip, at({ localNowMs: T + 1500 })), NO_BANNER);
});

test('one strip at a time: "Reconnectant…" turns into offline, never two banners', () => {
  const feedDown = { online: false, sinceMs: T, lastOutageMs: 0 };
  let b = nextBanner(NO_BANNER, at({ connection: feedDown, localNowMs: T + 5000 }));
  assert.equal(b.banner, 'reconnecting');
  b = nextBanner(b, at({ connection: feedDown, localNowMs: T + 21_000 }));
  assert.equal(b.banner, 'offline');
  b = nextBanner(b, at({ connection: { online: true, sinceMs: T + 22_000, lastOutageMs: 22_000 }, localNowMs: T + 22_000 }));
  assert.equal(b.banner, 'connected');
});

test('the technical pause is on with the presenters\' Pausa; the offline strip can show over it', () => {
  assert.equal(pauseOn(playing({ pause: { sinceMs: T } })), true);
  assert.equal(pauseOn(playing()), false);
  assert.equal(pauseOn(null), false);
  const both = playing({ pause: { sinceMs: T }, link: { online: false, sinceMs: 0 } });
  assert.equal(connectionProblem(at({ state: both })), 'offline');
});

// ---- reel -------------------------------------------------------------------------------------------------
test('the reel speeds up, slows down and stops exactly at landAtMs', () => {
  const total = 6000;
  const end = reelOffset(total, total);
  assert.ok(reelOffset(100, total) < reelOffset(1000, total));
  assert.ok(Math.abs(reelOffset(total - 1, total) - end) < 0.001, 'zero speed at the landing');
  assert.equal(reelOffset(total + 5000, total), end);
  // Monotone: it never runs backwards.
  let prev = -1;
  for (let t = 0; t <= total; t += 50) {
    const o = reelOffset(t, total);
    assert.ok(o >= prev);
    prev = o;
  }
});

test('reel phases: generic until the landing is public, never the song in advance', () => {
  const spin = { startAtMs: T, landAtMs: T + 6000 };
  const earlier = { position: 4, songId: 7, atMs: T - 10_000 };
  assert.equal(reelState(null, null, T).phase, 'idle');
  assert.equal(reelState(null, earlier, T).phase, 'landed');
  assert.equal(reelState(spin, earlier, T + 1000).phase, 'spinning', 'the previous song is not shown while spinning');
  assert.equal(reelState(spin, earlier, T + 6500).phase, 'stopped', 'stopped, waiting for the public landing');
  assert.equal(reelState(spin, { position: 5, songId: 9, atMs: T + 6000 }, T + 6500).phase, 'landed');
  const suspense = reelState({ startAtMs: T, landAtMs: null }, earlier, T + 2000);
  assert.equal(suspense.phase, 'coasting');
  assert.ok(suspense.offset > 0);
});

// ---- feedback ---------------------------------------------------------------------------------------------
const snap = (patch: Partial<FeedbackSnapshot> = {}): FeedbackSnapshot => ({
  round: 3,
  landings: 5,
  marks: [],
  near: [],
  celebration: null,
  desgraciat: false,
  standing: [],
  fallen: [],
  latest: 4,
  ...patch,
});
const quiet = { cue: null, freshMarks: [], freshFalls: [], standUp: false };

test('the first update and a new round are quiet', () => {
  assert.deepEqual(feedbackFor(null, snap({ marks: ['1:2'] })), quiet);
  assert.deepEqual(feedbackFor(snap(), snap({ round: 4, landings: 1, marks: ['1:2'] })), quiet);
});

test('one cue at a time, the most important: celebrate > near-win > mark > landing', () => {
  assert.equal(feedbackFor(snap(), snap({ landings: 6 })).cue, 'landing');
  assert.deepEqual(feedbackFor(snap({ marks: ['1:2'] }), snap({ landings: 6, marks: ['1:2', '1:3', '4:3'] })), { ...quiet, cue: 'mark', freshMarks: ['1:3', '4:3'] });
  assert.equal(feedbackFor(snap(), snap({ landings: 6, marks: ['1:3'], near: ['1:9'] })).cue, 'nearWin');
  assert.equal(feedbackFor(snap(), snap({ near: ['1:9'], celebration: 'celebration:3:line' })).cue, 'celebrate');
});

test('the near-win chime only when a card first gets a highlighted song', () => {
  assert.equal(feedbackFor(snap({ near: ['1:9'] }), snap({ near: ['1:9', '2:4'] })).cue, null);
});

// ---- views ------------------------------------------------------------------------------------------------
const catalog = parseCards([
  { id: 123, type: 'normal', lines: [[2, 17, 41, 69], [11, 15, 31, 64], [3, 55, 66, 68]] },
  { id: 412, type: 'especial', lines: [[1, 2, 3, 4], [5, 6, 7, 8], [9, 10, 12, 13]] },
]);
const saved = (() => {
  let d = emptyData('26');
  for (const id of [123, 412, 999]) {
    const r = addCard(d, id, 0);
    if (r.ok) d = r.data;
  }
  return d.cards;
})();

test('card views: only the right kind plays; every landed song is marked; unknown cards stay listed', () => {
  const round = { number: 3, kind: 'normal' as const, startedAtMs: 0, lineConfirmed: false, ended: false, landings: [2, 17, 41].map((songId, position) => ({ position, songId, atMs: 0 })) };
  const views = cardViews(saved, catalog, round);
  assert.deepEqual(views.map((v) => [v.saved.id, v.valid]), [[123, true], [412, false], [999, true]]);
  assert.equal(views[0].marks?.count, 3);
  assert.equal(views[1].marks, null);
  assert.equal(views[2].card, null);
  assert.deepEqual(markKeys(views), ['123:2', '123:17', '123:41']);
  assert.deepEqual(markedIdentities(views).get(17), [1]);
  assert.deepEqual([...views[0].near], [69], 'card 123 is 1 song from its first Line: that song is highlighted');
  assert.deepEqual([...cardViews(saved, catalog, { ...round, lineConfirmed: true })[0].near], [], 'no Line highlight once a Line is confirmed');
  const special = cardViews(saved, catalog, { ...round, kind: 'special' });
  assert.deepEqual(special.filter((v) => v.valid && v.card).map((v) => v.saved.id), [412]);
  assert.ok(cardViews(saved, catalog, null).every((v) => v.valid && v.marks === null), 'before any round: all shown, unmarked');
});

test("a side-2 round (D171: Quines 5–10): the phone shows and marks each normal card's side 2", () => {
  const sided = parseCards([
    { id: 123, type: 'normal', sides: [{ side: 1, lines: [[2, 17, 41, 69], [11, 15, 31, 64], [3, 55, 66, 68]] }, { side: 2, lines: [[71, 72, 73, 74], [75, 76, 77, 78], [79, 80, 81, 82]] }] },
    { id: 412, type: 'especial', sides: [{ side: 1, lines: [[1, 2, 3, 4], [5, 6, 7, 8], [9, 10, 12, 13]] }] },
  ]);
  const round = { number: 6, kind: 'normal' as const, cardType: 'normal', side: 2, startedAtMs: 0, lineConfirmed: false, ended: false, landings: [71, 72, 73, 2].map((songId, position) => ({ position, songId, atMs: 0 })) };
  const views = cardViews(saved, sided, round);
  assert.deepEqual(views[0].card?.lines[0], [71, 72, 73, 74], "card 123 shows its side 2's songs");
  assert.equal(views[0].marks?.count, 3, "only side 2's songs mark: «2» is on side 1");
  assert.deepEqual([...views[0].near], [74], "1 song from side 2's first Line");
  assert.deepEqual(songsOnCards(views.filter((v) => v.valid)), new Set([71, 72, 73, 74, 75, 76, 77, 78, 79, 80, 81, 82]), "the your-song look: side 2's songs");
  assert.deepEqual(views.map((v) => [v.saved.id, v.valid]), [[123, true], [412, false], [999, true]]);
  assert.deepEqual(views[1].card?.lines[0], [1, 2, 3, 4], 'the especial card, resting, shows its one side');
  const one = cardViews(saved, sided, { ...round, number: 3, side: 1 });
  assert.deepEqual(one[0].card?.lines[0], [2, 17, 41, 69], 'a side-1 round: side 1');
  assert.deepEqual(cardViews(saved, sided, { ...round, side: undefined })[0].card?.lines[0], [2, 17, 41, 69], 'an older cloud sends no side: side 1');
  assert.deepEqual(cardViews(saved, sided, null)[0].card?.lines[0], [2, 17, 41, 69], 'before any round: side 1');
});

test("a round of any card type counts only that type's cards; an older snapshot plays its kind's default", () => {
  const typed = parseCards([
    { id: 123, type: 'normal', lines: [[2, 17, 41, 69], [11, 15, 31, 64], [3, 55, 66, 68]] },
    { id: 412, type: 'especial', lines: [[1, 2, 3, 4], [5, 6, 7, 8], [9, 10, 12, 13]] },
    { id: 999, type: 'desgraciat', lines: [[2, 17, 41, 69], [11, 15, 31, 64], [3, 55, 66, 68]] },
  ]);
  const round = { number: 5, kind: 'normal' as const, startedAtMs: 0, lineConfirmed: false, ended: false, landings: [2, 17].map((songId, position) => ({ position, songId, atMs: 0 })) };
  const valid = (r: typeof round & { cardType?: string; kind: 'normal' | 'special' }) => cardViews(saved, typed, r).filter((v) => v.valid).map((v) => v.saved.id);
  assert.deepEqual(valid({ ...round, cardType: 'desgraciat' }), [999], 'a normal round that plays the desgraciat cards');
  assert.equal(cardViews(saved, typed, { ...round, cardType: 'desgraciat' })[2].marks?.count, 2, 'and marks them');
  assert.deepEqual(valid({ ...round, kind: 'special', cardType: 'normal' }), [123], 'a special round that plays the normal cards');
  assert.deepEqual(valid({ ...round, cardType: 'daurat' }), [], 'a type no card has: every card rests');
  assert.deepEqual(valid(round), [123], 'no card type (an older cloud): normal round, normal cards');
  assert.deepEqual(valid({ ...round, kind: 'special' }), [412], 'no card type: special round, especial cards');
});

test("which cards a round counts, in the phone's words: the type by name; only a regular round on normal cards is usual", () => {
  const types = [
    { type: 'normal', name: 'Cartró normal', color: '#cfe8ff', title: '', priceCents: null },
    { type: 'especial', name: 'Cartró especial', color: '#ffd9e8', title: '', priceCents: null },
    { type: 'desgraciat', name: 'Cartró desgraciat', color: '#d8f0c8', title: '', priceCents: null },
  ];
  assert.deepEqual(roundRule({ kind: 'normal', cardType: 'normal' }, types), { name: 'Cartró normal', usual: true });
  assert.deepEqual(roundRule({ kind: 'special' }, types), { name: 'Cartró especial', usual: false }, "an older snapshot: the kind's default");
  assert.deepEqual(roundRule({ kind: 'desgraciat', cardType: 'especial' }, types), { name: 'Cartró especial', usual: false }, 'D70: the Desgraciat names its type too');
  assert.deepEqual(roundRule({ kind: 'normal', cardType: 'desgraciat' }, types), { name: 'Cartró desgraciat', usual: false });
  assert.deepEqual(roundRule({ kind: 'special', cardType: 'daurat' }, []), { name: 'Cartró daurat', usual: false }, 'unlisted: the stand-in name');
  assert.equal(S.typeRule('Cartró especial'), 'En aquesta quina només juga el cartró especial.');
  assert.equal(S.typeRule('Cartró de Nadal'), 'En aquesta quina només juga el cartró de Nadal.', 'only the first letter is lowered');
});

/** The sample plan as phones get it with rounds 1 to 3 revealed. */
const PUBLIC = publicPlan(SAMPLE_PLAN, [1, 2, 3]);

test('prizes, progress and the planned times come from the plan and the winners', () => {
  const state = playing({ winners: [{ round: 3, kind: 'line', cardIds: [123, 57] }] });
  const rounds = prizeRounds(PUBLIC, state);
  assert.equal(rounds.length, SAMPLE_PLAN.rounds.length);
  assert.equal(rounds[2].state, 'current');
  assert.equal(rounds[2].lines[0].won, true);
  assert.deepEqual(rounds[2].lines[0].ownCardIds, [], 'nobody else\'s card is named');
  assert.equal(rounds[2].lines[1].won, false);
  assert.deepEqual(prizeRounds(PUBLIC, state, [57, 9])[2].lines[0].ownCardIds, [57], 'only the phone\'s own cards');
  assert.deepEqual(rounds[2].lines[0].headline, [{ title: 'Ampolla de vi blanc', detail: null, sponsor: '[Patrocinador 1]' }]);
  assert.equal(rounds[2].lines[0].others.length, 3, 'the rest of the bundle, after the headline prize');
  assert.equal(rounds[2].lines[1].others.length, 16, "the rest of the Quina's hamper");
  assert.equal(rounds[6].kind, 'special');
  assert.deepEqual(progress(PUBLIC, state), { current: 3, total: 8 });
  const interval = playing({ scene: 'interval', interval: { nextRound: 4, guideEndMs: T } });
  assert.equal(focusRoundNumber(interval), 4);
  assert.equal(prizeRounds(PUBLIC, interval)[3].state, 'next');
  assert.equal(plannedStarts(SAMPLE_PLAN), null, 'no start time in the sample plan');
  const starts = plannedStarts({ ...PUBLIC, schedule: { startAtMs: T, roundMinutes: 25, intervalMinutes: 5 } });
  assert.equal(starts?.get(2), T + 30 * 60_000);
});

test('rounds not revealed yet show locked, with no prize, but keep their winners', () => {
  const state = playing({ scene: 'interval', interval: { nextRound: 4, guideEndMs: T } });
  const rounds = prizeRounds(PUBLIC, state);
  assert.deepEqual(rounds.map((r) => r.lockedUntil), [null, null, null, 'intro', 'intro', 'intro', 'intro', 'intro']);
  assert.deepEqual(rounds[3].lines.map((l) => [l.headline, l.others]), [[[], []], [[], []]], 'nothing of a locked round, not even how many');
  const secret = prizeRounds({ ...publicPlan(SAMPLE_PLAN, [2]), prizeReveal: 'allSecret' }, playing({ winners: [{ round: 1, kind: 'bingo', cardIds: [9] }] }));
  assert.deepEqual(secret.map((r) => r.lockedUntil).slice(0, 3), ['presenters', null, 'presenters'], 'all secret: until the presenters reveal them');
  assert.equal(secret[0].lines[1].won, true, 'a locked round still says it was won');
});

test('the feed\'s plan is checked as a public plan: locked rounds stay locked, junk reads as no plan', () => {
  const state = playing({ plan: PUBLIC });
  const plan = planOf(state);
  assert.ok(plan);
  assert.deepEqual(plan.rounds.map((r) => r.revealed), [true, true, true, false, false, false, false, false]);
  assert.equal(plan.rounds[0].line?.[0].title, 'Ampolla de vi blanc');
  assert.equal(plan.rounds[3].line, undefined);
  assert.equal('cheatSheet' in plan, false, 'never a cheat sheet');
  // A locked round that carries prizes anyway: they are dropped, never shown.
  const leaky = { ...PUBLIC, rounds: PUBLIC.rounds.map((r) => (r.revealed ? r : { ...r, line: SAMPLE_PLAN.rounds[r.number - 1].line })) };
  assert.equal(planOf(playing({ plan: leaky }))?.rounds[3].line, undefined);
  const whole = planOf(playing({ plan: SAMPLE_PLAN as never }));
  assert.ok(whole && whole.rounds.every((r) => !r.revealed && r.line === undefined), 'a whole plan (no `revealed` marks): every round locked');
  assert.equal(planOf(playing({ plan: { nonsense: true } as never })), null);
  assert.equal(planOf(playing({ plan: { ...PUBLIC, rounds: PUBLIC.rounds.map((r) => (r.number === 1 ? { ...r, line: [{ title: '' }] } : r)) } as never })), null);
  assert.equal(planOf(playing()), null);
  assert.deepEqual(plan.rounds.map((r) => r.side ?? 1), SAMPLE_PLAN.rounds.map((r) => r.side ?? 1), "each round's side comes through (D178)");
});

test("the feed's plan keeps each round's card type; an older cloud's rounds get their kind's default", () => {
  const typed = publicPlan({ ...SAMPLE_PLAN, rounds: SAMPLE_PLAN.rounds.map((r) => (r.number === 2 ? { ...r, cardType: 'desgraciat' } : r)) }, [1]);
  assert.deepEqual(planOf(playing({ plan: typed }))?.rounds.slice(0, 3).map((r) => r.cardType), ['normal', 'desgraciat', 'normal'], 'locked rounds too');
  const older = { ...PUBLIC, rounds: PUBLIC.rounds.map(({ cardType: _gone, ...r }) => r) };
  assert.deepEqual(planOf(playing({ plan: older }))?.rounds.map((r) => r.cardType)[6], 'especial');
});

test('the Celebration shows the latest prize of the round; Historial is the current round, newest first', () => {
  const state = playing({ scene: 'celebration', winners: [{ round: 3, kind: 'line', cardIds: [57] }] });
  assert.deepEqual(celebrationOf(state, [123]), { key: 'celebration:3:line', kind: 'line', round: 3, ownCardIds: [] }, "someone else's win");
  assert.deepEqual(celebrationOf(state, [123, 57]), { key: 'celebration:3:line', kind: 'line', round: 3, ownCardIds: [57] }, 'the phone\'s own card');
  assert.equal(celebrationOf(playing()), null);
  const withHistory = playing({
    rounds: [
      { number: 2, kind: 'normal', startedAtMs: 0, lineConfirmed: true, ended: true, landings: [{ position: 0, songId: 1, atMs: 0 }] },
      { number: 3, kind: 'normal', startedAtMs: 0, lineConfirmed: false, ended: false, landings: [{ position: 0, songId: 5, atMs: 0 }, { position: 1, songId: 6, atMs: 1 }] },
    ],
  });
  const history = historyOf(withHistory);
  assert.deepEqual([history?.round, history?.landings.map((l) => l.songId)], [3, [6, 5]], 'earlier rounds are not shown');
  assert.equal(history?.nowPosition, 1, 'the song playing now is in it, first');
  assert.equal(historyOf(playing({ rounds: [] })), null);
  const ended = playing({ rounds: [{ number: 3, kind: 'normal', startedAtMs: 0, lineConfirmed: true, ended: true, landings: [{ position: 0, songId: 5, atMs: 0 }] }] });
  assert.equal(historyOf(ended)?.nowPosition, null, 'once the round ends, nothing is playing now');
});

test('no winning card numbers on phones: the Celebration and the prize lists name only the phone\'s own cards', () => {
  const winners = [
    { round: 3, kind: 'line' as const, cardIds: [301, 57] },
    { round: 3, kind: 'bingo' as const, cardIds: [4242] },
  ];
  const state = playing({ scene: 'celebration', winners });
  const others = celebrationOf(state, [123]);
  assert.ok(others);
  assert.deepEqual(Object.keys(others).sort(), ['key', 'kind', 'ownCardIds', 'round'], 'no list of winning cards in the view');
  assert.deepEqual(others.ownCardIds, []);
  for (const id of [301, 57, 4242]) assert.ok(!JSON.stringify(others).includes(String(id)), `card ${id} is nowhere in the view`);
  const mine = celebrationOf(playing({ scene: 'celebration', winners: [winners[0]] }), [57, 123]);
  assert.deepEqual(mine?.ownCardIds, [57]);
  assert.ok(!JSON.stringify(mine).includes('301'), 'the other winner stays unnamed');
  const lines = prizeRounds(PUBLIC, state, [123]).flatMap((r) => r.lines);
  assert.ok(lines.every((l) => !('winners' in l)), 'no winners list in the prize lines');
  assert.ok(!JSON.stringify(lines).match(/\b(301|4242)\b/), 'no winning number in Premis');
  assert.deepEqual(lines.filter((l) => l.won).length, 2);
});

test('small helpers: Heat levels, kernel tilt', () => {
  assert.deepEqual([0, 0.3, 0.6, 0.9].map(heatLevel), ['cold', 'warm', 'hot', 'fire']);
  const tilt = kernelTilt(123, 17);
  assert.equal(kernelTilt(123, 17), tilt, 'stable');
  assert.ok(tilt >= -15 && tilt <= 15);
});
