// A whole Desgraciat round on the show engine: introduced and shuffled like any round, cards falling as their songs
// land, the console's private standing list and Futur, the Phase climbing as fewer cards stand, auto-advance that
// never takes out the last card, standing claims and their Check, the Celebration, and the journal replaying it.
import { dataTest as test } from './support/data.ts';
import assert from 'node:assert/strict';
import { replayJournal, type EventOf, type JournalEntry, type ShowEvent } from '@quina/protocol';
import { FLOW } from '../engine/src/config.ts';
import { standingCourse } from '../engine/src/game/cards.ts';
import type { Effect } from '../engine/src/show/show.ts';
import { setup, allCards, type Harness } from './support/harness.ts';

// Especial cards: the Desgraciat plays them unless the plan says otherwise (D70).
const CARDS = '400-459';
const journalOf = (effects: readonly Effect[]): JournalEntry[] => effects.flatMap((e) => (e.type === 'journal' ? [e.entry] : []));
const rejected = (effects: readonly Effect[]) => effects.flatMap((e) => (e.type === 'reject' ? [e.reason] : []));
const checksIn = (effects: readonly Effect[]) =>
  effects.flatMap((e) => (e.type === 'emit' && e.message.type === 'check.started' ? [(e.message as ShowEvent as EventOf<'check.started'>).check] : []));

/** A Game whose round 4 is the Desgraciat, introduced and shuffled, ready to play. */
function desgraciat({ seed = 11, autoAdvance = false } = {}): Harness {
  const h = setup({ seed, cards: allCards, cardsInPlay: CARDS, settings: { autoAdvance, autoAdvanceFinal: autoAdvance } });
  h.send('unlock');
  h.send('roundIntro', { number: 4, kind: 'desgraciat' });
  h.send('newRound');
  h.advance(FLOW.shuffleSec + 0.1);
  return h;
}

function land(h: Harness, count: number) {
  for (let i = 0; i < count; i++) {
    const position = h.show.position;
    h.send('next');
    h.until(() => h.show.position === position + 1 && h.show.status === 'playing');
  }
}

/** Land songs until one card is left standing. */
function toLastStanding(h: Harness) {
  const course = standingCourse(h.show.phaseModel.valid, h.show.queue);
  assert.ok(course.lastStandingAt != null);
  land(h, course.lastStandingAt - h.show.position);
  return course;
}

test('the Desgraciat round: cards fall as their songs land, the console sees who stands, the Phase climbs with the count', () => {
  const h = desgraciat();
  const state = h.show.snapshot();
  assert.equal(state.round.kind, 'desgraciat');
  assert.equal(state.round.cardType, 'especial');
  assert.equal(state.cards.climbingTo, 'standing');
  assert.equal(state.standing?.count, 60);
  assert.equal(state.standing?.cardIds?.length, 60, 'listed up to STANDING_LIST_MAX');
  const course = standingCourse(h.show.phaseModel.valid, h.show.queue);
  assert.ok(course.lastStandingAt != null, 'one card is always left last (D180)');
  assert.equal(state.future?.lastStandingAt, course.lastStandingAt);
  assert.equal(state.future?.standingCurve?.at(-1), 1);
  assert.deepEqual(state.possibleWinners, { line: [], bingo: [] });

  let phases: string[] = [];
  for (let i = 0; i < 6; i++) {
    land(h, 1);
    const s = h.show.snapshot();
    assert.equal(s.standing?.count, course.standingAfter[h.show.position]);
    if (s.standing?.cardIds) assert.equal(s.standing.cardIds.length, s.standing.count);
    phases.push(s.phase);
  }
  const last = toLastStanding(h);
  const s = h.show.snapshot();
  assert.deepEqual(s.standing, { count: 1, cardIds: [last.lastCardId] });
  assert.equal(s.future?.lastStandingAt, null, 'already reached');
  phases.push(s.phase);
  assert.equal(phases.at(-1), 'final');
  assert.deepEqual(rejected(h.send('confirmLine')), ['invalid'], 'no Line in this round');
});

test('auto-advance plays the round on by itself but never takes out the last card standing', () => {
  const h = desgraciat({ seed: 12, autoAdvance: true });
  const course = standingCourse(h.show.phaseModel.valid, h.show.queue);
  h.send('next');
  h.until(() => h.show.position === course.lastStandingAt, 60 * 40);
  h.until(() => h.show.status === 'playing');
  assert.equal(h.show.snapshot().standing?.count, 1);
  assert.equal(h.show.timers.autoAt, null, 'no Next is coming');
  h.advance(90);
  assert.equal(h.show.position, course.lastStandingAt, 'it waits for the presenters');
});

test('standing claims: the last card passes all 12, a fallen one stops on the song that sank it; the Celebration ends the round', () => {
  const h = desgraciat();
  const course = toLastStanding(h);
  const valid = h.show.phaseModel.valid;
  const fallen = valid.find((c) => c.id !== course.lastCardId)!;
  assert.deepEqual(rejected(h.send('claim', { cardId: fallen.id, kind: 'line' })), ['invalid'], 'not won by a Line');

  const first = checksIn(h.send('claim', { cardId: fallen.id }))[0];
  assert.equal(h.show.claims[0].kind, 'standing', 'the default kind');
  assert.equal(first.kind, 'standing');
  assert.equal(first.outcome, 'fallen');
  assert.equal(first.row, null);
  // Its reveals: a knock for each song still not heard, then the one that sank it, its snippet as the proof.
  const out = h.pressCue(h.show.claims[0].claimId);
  const reveals = out.flatMap((e) => (e.type === 'checkReveal' ? [e.step] : []));
  assert.equal(reveals.length, first.total);
  assert.equal(reveals.at(-1)?.landed, true);
  assert.deepEqual(reveals.map((s) => s.sound), [...reveals.slice(0, -1).map(() => 'still'), 'snippet']);
  assert.ok(reveals.slice(0, -1).every((s) => !s.landed && s.durationSec === FLOW.check.stillSec), 'a quick knock for each song still not heard');
  assert.equal(h.show.claims[0].status, 'invalid', 'its cue: the fail moment');

  const second = checksIn(h.send('claim', { cardId: course.lastCardId! }))[0];
  assert.ok(second);
  assert.equal(second.outcome, 'complete');
  assert.equal(second.total, 12);
  assert.equal(h.show.claims.at(-1)?.completeSince, course.lastStandingAt);
  h.pressCue(h.show.claims.at(-1)!.claimId);
  const state = h.show.snapshot();
  assert.equal(state.scene, 'celebration');
  assert.equal(state.celebration?.kind, 'standing');
  assert.equal(state.celebration?.music, 'victory');
  assert.deepEqual(state.winners.map((w) => [w.kind, w.cardId]), [['standing', course.lastCardId]]);
  assert.equal(state.round.lineConfirmed, false);
  h.advance(FLOW.celebration.toIntervalSec + 1);
  assert.equal(h.show.scene, 'interval', 'it flows into the Interval like a Bingo');

  // The journal replays to the show, and a restarted page climbs to the last card standing again.
  const record = replayJournal(journalOf(h.log));
  assert.deepEqual(record, h.show.record());
  assert.equal(record.round?.climbingTo, 'standing');
  assert.ok(journalOf(h.log).some((e) => e.kind === 'claim.opened' && e.winKind === 'standing'));
  const r = setup({ seed: 5, cards: allCards, restore: record, startSec: 0.5 });
  assert.equal(r.show.phaseModel.kind, 'standing');
  assert.equal(r.show.snapshot().standing?.count, 1);
});

test('D180: a landing that would take out the last cards together counts for none of them; the round goes on to one', () => {
  // Two especial cards that share a song, alone in play, and a Queue that plays that song first.
  const especial = allCards.filter((c) => c.type === 'especial');
  const ids = (c: (typeof allCards)[number]) => c.lines.flat().map((x) => (typeof x === 'number' ? x : x.id));
  let pair: [number, number, number] | null = null;
  for (const a of especial) {
    const b = especial.find((c) => c.id > a.id && ids(c).some((id) => ids(a).includes(id)));
    if (b) {
      pair = [a.id, b.id, ids(b).find((id) => ids(a).includes(id))!];
      break;
    }
  }
  assert.ok(pair, 'two especial cards share a song');
  const [a, b, shared] = pair;
  const others = [...new Set(allCards.flatMap(ids))].filter((id) => id !== shared).sort((x, y) => x - y);
  const h = setup({ seed: 14, cards: allCards, cardsInPlay: `${a}, ${b}`, fixedQueue: [shared, ...others], settings: { autoAdvance: false } });
  h.send('unlock');
  h.send('roundIntro', { number: 4, kind: 'desgraciat' });
  h.send('newRound');
  h.advance(FLOW.shuffleSec + 0.1);
  land(h, 1);
  assert.deepEqual(h.show.snapshot().standing, { count: 2, cardIds: [a, b] }, 'both still stand: no shared win');
  h.send('claim', { cardId: a });
  assert.equal(h.show.claims.at(-1)?.outcome, 'complete', 'the song that would have taken both out counts for neither');
  assert.equal(h.show.claims.at(-1)?.completeSince, null, 'not the last one yet');
  // The round goes on until one of them goes alone.
  const course = standingCourse(h.show.phaseModel.valid, h.show.queue);
  assert.ok(course.lastStandingAt != null && course.lastStandingAt > 0);
  assert.equal(course.standingAfter[0], 2);
  assert.equal(course.standingAfter[course.lastStandingAt], 1);
});

test('a standing claim in a normal round is invalid; resume by hand rebuilds a Desgraciat round', () => {
  const n = setup({ seed: 3, cards: allCards, cardsInPlay: '1-60', settings: { autoAdvance: false } });
  n.send('unlock');
  land(n, 1);
  assert.deepEqual(rejected(n.send('claim', { cardId: 5, kind: 'standing' })), ['invalid']);

  const a = desgraciat({ seed: 13 });
  land(a, 3);
  const token = a.show.snapshot().resume;
  assert.ok(token);
  assert.match(token.text, /^Q4D-/);
  const { text: _text, ...fields } = token;
  const b = setup({ seed: 77, cards: allCards, cardsInPlay: CARDS, settings: { autoAdvance: false } });
  assert.deepEqual(rejected(b.dispatch({ v: 1, type: 'cmd', cmd: 'resumeAt', reqId: 'r', ...fields })), []);
  assert.deepEqual(b.show.queue, a.show.queue, 'the same last-standing Shuffle');
  assert.equal(b.show.phaseModel.kind, 'standing');
  assert.equal(b.show.snapshot().standing?.count, a.show.snapshot().standing?.count);
});

test('fuzz: random commands through Desgraciat rounds never break the invariants, and the journal always replays', () => {
  const scenes = new Set<string>();
  const celebrated = new Set<string>();
  for (let seed = 1; seed <= 5; seed++) {
    const h = setup({ seed, cards: allCards, cardsInPlay: '400-439', settings: { autoAdvance: seed % 2 === 0 } });
    h.send('unlock');
    h.send('roundIntro', { number: 1, kind: 'desgraciat' });
    h.send('newRound');
    let rnd = seed * 7919;
    const pick = <T>(list: readonly T[]): T => list[(rnd = (rnd * 48271) % 2147483647) % list.length];
    // Mostly an undecided Claim, so Checks get decided and the round moves on.
    const open = () => h.show.claims.filter((c) => c.status !== 'valid' && c.status !== 'invalid' && c.status !== 'discarded').map((c) => c.claimId);
    const claimId = () => pick([...open(), ...open(), ...open(), ...h.show.claims.map((c) => c.claimId), 'cl-99']);
    const standingCard = () => h.show.snapshot().standing?.cardIds?.[0] ?? 400;
    // Songs land far more often than anyone claims, as on the night.
    const next = () => h.send('next');
    // A presenter pressing the Check on screen through to its cue (a standing card has 12 reveals), and the shared
    // Celebration's press.
    const press = () => {
      const cn = h.show.celebrationNext;
      if (cn) return h.send('checkNext', cn);
      return h.show.check ? h.pressCue() : next();
    };
    const commands = [
      next, next, next, next, next, next, next, next, () => h.send('back'), () => h.send('hold'), () => h.send('hold', { on: false }),
      () => h.send('suspense'), () => h.send('pause'),
      () => h.send('claim', { cardId: standingCard() }),
      () => h.send('claim', { cardId: pick([400, 407, 430, 9999, 10]), kind: pick([undefined, 'line', 'bingo', 'standing'] as const) }),
      () => h.send('checkStart', { claimId: claimId() }), press, press, press,
      () => h.send('checkReview', { claimId: claimId() }), () => h.send('reviewEnd', { claimId: claimId(), outcome: pick(['continue', 'lose', 'discard'] as const) }),
      () => h.send('confirmLine'), () => h.send('interval'), () => h.send('roundIntro', { kind: 'desgraciat' }),
      () => h.send('newRound', { kind: 'desgraciat' }),
    ];
    for (let step = 0; step < 200; step++) {
      pick(commands)();
      h.advance((rnd % 1000) / 100);
      const s = h.show;
      const where = `seed ${seed} step ${step}: ${s.scene} ${s.status}`;
      if (s.status === 'hold' && !s.pause) assert.ok(s.current || s.holdMusic || s.bed, `${where}: hold in silence`);
      assert.equal(s.phaseModel.kind, 'standing', where);
      assert.equal(s.round.lineConfirmed, false, where);
      assert.equal(s.snapshot().standing?.count, s.standingNow().length, where);
      assert.equal(s.round.kind, 'desgraciat', where);
      assert.ok(s.claims.every((c) => c.kind === 'standing'), `${where}: only standing claims`);
      assert.ok(s.claims.every((c) => c.outcome == null || ['complete', 'fallen', 'fellLast', 'unknownCard', 'wrongType'].includes(c.outcome)), `${where}: a standing Check's outcome`);
      assert.deepEqual(replayJournal(journalOf(h.log)), s.record(), `${where}: the journal replays to the show`);
      scenes.add(s.scene);
      if (s.celebration) celebrated.add(s.celebration.kind);
    }
  }
  assert.ok(celebrated.has('standing'), 'the fuzz celebrates a last card standing');
  for (const scene of ['play', 'check', 'celebration', 'interval', 'roundStart']) assert.ok(scenes.has(scene), `the fuzz reaches ${scene}`);
});
