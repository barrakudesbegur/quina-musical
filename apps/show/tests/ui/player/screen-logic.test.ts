// The pure rules behind the screens: the offline and pause notices, the reconnect pill, the reel synced to the
// Spin, the feedback cues (one at a time), the near-win highlight, and the derived views.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { emptyPublicState, type PublicState } from '../../../../player/feed/public.ts';
import { feedbackFor, type FeedbackSnapshot } from '../../../../player/logic/feedback.ts';
import { reelOffset, reelState } from '../../../../player/logic/reel.ts';
import { overlayFor, reconnectPill } from '../../../../player/logic/status.ts';
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
  padValue,
  plannedStarts,
  planOf,
  prizeRounds,
  progress,
  roundRule,
} from '../../../../player/logic/view.ts';
import { SAMPLE_PLAN } from '../../../../../packages/ui/fixtures/plan.ts';
import { publicPlan } from '../../../../../packages/ui/plan.ts';
import { parseCards } from '../../../../../packages/ui/data/catalog.ts';

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

// ---- notices ----------------------------------------------------------------------------------------------
test('offline after 20 s without the laptop link, or without the feed, while the show is on', () => {
  const linkDown = playing({ link: { online: false, sinceMs: T } });
  assert.equal(overlayFor({ state: linkDown, connection: online, localNowMs: T, cloudNowMs: T + 19_000 }), null);
  assert.equal(overlayFor({ state: linkDown, connection: online, localNowMs: T, cloudNowMs: T + 20_000 }), 'offline');
  const feedDown = { online: false, sinceMs: T, lastOutageMs: 0 };
  assert.equal(overlayFor({ state: playing(), connection: feedDown, localNowMs: T + 19_999, cloudNowMs: 0 }), null);
  assert.equal(overlayFor({ state: playing(), connection: feedDown, localNowMs: T + 20_000, cloudNowMs: 0 }), 'offline');
});

test('no offline notice before or after the Game, when a switched-off laptop is normal', () => {
  const before = { ...playing({ link: { online: false, sinceMs: 0 } }), scene: 'before' as const };
  assert.equal(overlayFor({ state: before, connection: online, localNowMs: T, cloudNowMs: T }), null);
  assert.equal(overlayFor({ state: { ...before, scene: 'after' }, connection: online, localNowMs: T, cloudNowMs: T }), null);
  assert.equal(overlayFor({ state: null, connection: { online: false, sinceMs: 0, lastOutageMs: 0 }, localNowMs: T, cloudNowMs: T }), null);
});

test('the technical pause shows "Tornem de seguida"; offline wins over it', () => {
  assert.equal(overlayFor({ state: playing({ pause: { sinceMs: T } }), connection: online, localNowMs: T, cloudNowMs: T }), 'pause');
  const both = playing({ pause: { sinceMs: T }, link: { online: false, sinceMs: 0 } });
  assert.equal(overlayFor({ state: both, connection: online, localNowMs: T, cloudNowMs: T }), 'offline');
});

test('the reconnect pill: after 3 s down, then "Connectat" for 1 s after an outage of 3 s or more', () => {
  assert.equal(reconnectPill({ online: false, sinceMs: T, lastOutageMs: 0 }, T + 2999), null);
  assert.equal(reconnectPill({ online: false, sinceMs: T, lastOutageMs: 0 }, T + 3000), 'reconnecting');
  assert.equal(reconnectPill({ online: true, sinceMs: T, lastOutageMs: 5000 }, T + 500), 'connected');
  assert.equal(reconnectPill({ online: true, sinceMs: T, lastOutageMs: 5000 }, T + 1000), null);
  assert.equal(reconnectPill({ online: true, sinceMs: T, lastOutageMs: 800 }, T + 100), null, 'a blip shows nothing');
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
const snap = (patch: Partial<FeedbackSnapshot> = {}): FeedbackSnapshot => ({ round: 3, landings: 5, marks: [], near: [], celebration: null, ...patch });

test('the first update and a new round are quiet', () => {
  assert.deepEqual(feedbackFor(null, snap({ marks: ['1:2'] })), { cue: null, freshMarks: [] });
  assert.deepEqual(feedbackFor(snap(), snap({ round: 4, landings: 1, marks: ['1:2'] })), { cue: null, freshMarks: [] });
});

test('one cue at a time, the most important: celebrate > near-win > mark > landing', () => {
  assert.equal(feedbackFor(snap(), snap({ landings: 6 })).cue, 'landing');
  assert.deepEqual(feedbackFor(snap({ marks: ['1:2'] }), snap({ landings: 6, marks: ['1:2', '1:3', '4:3'] })), { cue: 'mark', freshMarks: ['1:3', '4:3'] });
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

test("which cards a round counts, in the phone's words: the usual rules, else the type by name", () => {
  const types = [{ type: 'desgraciat', name: 'Cartró desgraciat', color: '#d8f0c8', title: '', priceCents: null }];
  assert.deepEqual(roundRule({ kind: 'normal', cardType: 'normal' }, types), { kind: 'normal' });
  assert.deepEqual(roundRule({ kind: 'special' }, types), { kind: 'special' }, "an older snapshot: the kind's default");
  assert.deepEqual(roundRule({ kind: 'normal', cardType: 'desgraciat' }, types), { kind: 'type', name: 'Cartró desgraciat' });
  assert.deepEqual(roundRule({ kind: 'special', cardType: 'daurat' }, []), { kind: 'type', name: 'Cartró daurat' }, 'unlisted: the stand-in name');
});

/** The sample plan as phones get it with rounds 1 to 3 revealed. */
const PUBLIC = publicPlan(SAMPLE_PLAN, [1, 2, 3]);

test('prizes, progress and the planned times come from the plan and the winners', () => {
  const state = playing({ winners: [{ round: 3, kind: 'line', cardIds: [123, 57] }] });
  const rounds = prizeRounds(PUBLIC, state);
  assert.equal(rounds.length, SAMPLE_PLAN.rounds.length);
  assert.equal(rounds[2].state, 'current');
  assert.deepEqual(rounds[2].lines[0].winners, [123, 57]);
  assert.deepEqual(rounds[2].lines[0].headline, [{ title: '[Premi de línia 3]', detail: null, sponsor: '[Patrocinador 1]' }]);
  assert.equal(rounds[2].lines[0].others.length, 4, 'the rest of the bundle, after the headline prize');
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
  assert.deepEqual(secret[0].lines[1].winners, [9], 'a locked round still lists its winning cards');
});

test('the feed\'s plan is checked as a public plan: locked rounds stay locked, junk reads as no plan', () => {
  const state = playing({ plan: PUBLIC });
  const plan = planOf(state);
  assert.ok(plan);
  assert.deepEqual(plan.rounds.map((r) => r.revealed), [true, true, true, false, false, false, false, false]);
  assert.equal(plan.rounds[0].line?.[0].title, '[Premi de línia 1]');
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
});

test("the feed's plan keeps each round's card type; an older cloud's rounds get their kind's default", () => {
  const typed = publicPlan({ ...SAMPLE_PLAN, rounds: SAMPLE_PLAN.rounds.map((r) => (r.number === 2 ? { ...r, cardType: 'desgraciat' } : r)) }, [1]);
  assert.deepEqual(planOf(playing({ plan: typed }))?.rounds.slice(0, 3).map((r) => r.cardType), ['normal', 'desgraciat', 'normal'], 'locked rounds too');
  const older = { ...PUBLIC, rounds: PUBLIC.rounds.map(({ cardType: _gone, ...r }) => r) };
  assert.deepEqual(planOf(playing({ plan: older }))?.rounds.map((r) => r.cardType)[6], 'especial');
});

test('the Celebration shows the latest prize of the round; Historial is the current round, newest first', () => {
  const state = playing({ scene: 'celebration', winners: [{ round: 3, kind: 'line', cardIds: [57] }] });
  assert.deepEqual(celebrationOf(state), { key: 'celebration:3:line', kind: 'line', round: 3, cardIds: [57] });
  assert.equal(celebrationOf(playing()), null);
  const withHistory = playing({
    rounds: [
      { number: 2, kind: 'normal', startedAtMs: 0, lineConfirmed: true, ended: true, landings: [{ position: 0, songId: 1, atMs: 0 }] },
      { number: 3, kind: 'normal', startedAtMs: 0, lineConfirmed: false, ended: false, landings: [{ position: 0, songId: 5, atMs: 0 }, { position: 1, songId: 6, atMs: 1 }] },
    ],
  });
  const history = historyOf(withHistory);
  assert.deepEqual([history?.round, history?.landings.map((l) => l.songId)], [3, [6, 5]], 'earlier rounds are not shown');
  assert.equal(historyOf(playing({ rounds: [] })), null);
});

test('small helpers: Heat levels, kernel tilt, the number pad', () => {
  assert.deepEqual([0, 0.3, 0.6, 0.9].map(heatLevel), ['cold', 'warm', 'hot', 'fire']);
  const tilt = kernelTilt(123, 17);
  assert.equal(kernelTilt(123, 17), tilt, 'stable');
  assert.ok(tilt >= -15 && tilt <= 15);
  assert.equal(padValue('', '0'), '');
  assert.equal(padValue('12', '3'), '123');
  assert.equal(padValue('1234', '5'), '1234');
  assert.equal(padValue('123', 'back'), '12');
  assert.equal(padValue('12', 'x'), '12');
});
