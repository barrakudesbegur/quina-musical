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

const CARDS = '1-60';
const journalOf = (effects: readonly Effect[]): JournalEntry[] => effects.flatMap((e) => (e.type === 'journal' ? [e.entry] : []));
const rejected = (effects: readonly Effect[]) => effects.flatMap((e) => (e.type === 'reject' ? [e.reason] : []));
const checksIn = (effects: readonly Effect[]) =>
  effects.flatMap((e) => (e.type === 'emit' && e.message.type === 'check.scheduled' ? [(e.message as ShowEvent as EventOf<'check.scheduled'>).check] : []));

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
  assert.equal(state.round.cardType, 'normal');
  assert.equal(state.cards.climbingTo, 'standing');
  assert.equal(state.standing?.count, 60);
  assert.equal(state.standing?.cardIds?.length, 60, 'listed up to STANDING_LIST_MAX');
  const course = standingCourse(h.show.phaseModel.valid, h.show.queue);
  assert.equal(course.tied, false, 'the Shuffle left one card last');
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
  assert.deepEqual({ count: s.standing?.count, cardIds: s.standing?.cardIds }, { count: 1, cardIds: [last.lastCardId] });
  assert.ok(s.standing?.fellLast?.length, 'the card that fell with the latest song is listed');
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
  assert.equal(first.steps.at(-1)?.landed, true);
  assert.ok(first.steps.slice(0, -1).every((s) => !s.landed));
  const snippets = h.log.filter((e) => e.type === 'checkSnippets').at(-1);
  assert.ok(snippets?.type === 'checkSnippets');
  assert.deepEqual(snippets.steps.map((s) => s.sound), [...first.steps.slice(0, -1).map(() => 'still'), 'snippet']);
  assert.ok(snippets.steps.slice(0, -1).every((s) => s.durationSec === FLOW.check.stillSec), 'a quick knock for each song still not heard');

  h.until(() => h.show.claims[0].status === 'checked');
  const second = checksIn(h.send('decide', { claimId: h.show.claims[0].claimId, valid: false }))[0] ?? checksIn(h.send('claim', { cardId: course.lastCardId! }))[0];
  assert.ok(second);
  assert.equal(second.outcome, 'complete');
  assert.equal(second.steps.length, 12);
  assert.equal(h.show.claims.at(-1)?.completeSince, course.lastStandingAt);
  h.until(() => h.show.claims.at(-1)?.status === 'checked');
  h.send('decide', { claimId: h.show.claims.at(-1)!.claimId, valid: true });
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

test('the last players standing who sit on the same song share the win; a card that fell earlier never wins', () => {
  const h = desgraciat({ seed: 14 });
  // A landing where at least two cards sit down together (early on, several do).
  // A landing (not the first) where at least two cards sit down together, with others fallen before.
  let fell: number[] = [];
  const fellBefore = () => h.show.phaseModel.valid.find((c) => !fell.includes(c.id) && !h.show.standingNow().includes(c));
  for (let k = 0; k < 20 && (fell.length < 2 || !fellBefore()); k++) {
    land(h, 1);
    fell = h.show.snapshot().standing?.fellLast ?? [];
  }
  assert.ok(fell.length >= 2, `two cards fell together (${fell})`);
  const earlier = fellBefore();
  assert.ok(earlier);
  const before = h.show.position;
  for (const cardId of fell.slice(0, 2)) {
    h.send('claim', { cardId });
    h.until(() => h.show.claims.at(-1)?.status === 'checked');
    assert.equal(h.show.claims.at(-1)?.outcome, 'fellLast');
    assert.deepEqual(rejected(h.send('decide', { claimId: h.show.claims.at(-1)!.claimId, valid: true })), []);
  }
  const state = h.show.snapshot();
  assert.equal(state.scene, 'celebration');
  assert.deepEqual([...(state.celebration?.cardIds ?? [])].sort(), fell.slice(0, 2).sort(), 'one Celebration, shared');
  assert.ok(state.winners.every((w) => w.kind === 'standing' && w.position === before && w.winningSongId === h.show.queue[before]));
  const decided = journalOf(h.log).filter((e) => e.kind === 'claim.decided');
  assert.ok(decided.every((e) => e.kind === 'claim.decided' && e.outcome === 'fellLast'), 'the journal records how they passed');
  // A card that fell on an earlier song is `fallen`: it can't be accepted.
  h.send('claim', { cardId: earlier.id });
  h.until(() => h.show.claims.at(-1)?.status === 'checked');
  assert.equal(h.show.claims.at(-1)?.outcome, 'fallen');
  assert.deepEqual(rejected(h.send('decide', { claimId: h.show.claims.at(-1)!.claimId, valid: true })), ['failedCheck']);
});

test('a standing claim in a normal round is invalid; resume by hand rebuilds a Desgraciat round', () => {
  const n = setup({ seed: 3, cards: allCards, cardsInPlay: CARDS, settings: { autoAdvance: false } });
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
    const h = setup({ seed, cards: allCards, cardsInPlay: '1-40', settings: { autoAdvance: seed % 2 === 0 } });
    h.send('unlock');
    h.send('roundIntro', { number: 1, kind: 'desgraciat' });
    h.send('newRound');
    let rnd = seed * 7919;
    const pick = <T>(list: readonly T[]): T => list[(rnd = (rnd * 48271) % 2147483647) % list.length];
    // Mostly an undecided Claim, so Checks get decided and the round moves on.
    const open = () => h.show.claims.filter((c) => c.status !== 'valid' && c.status !== 'invalid').map((c) => c.claimId);
    const claimId = () => pick([...open(), ...open(), ...open(), ...h.show.claims.map((c) => c.claimId), 'cl-99']);
    const standingCard = () => h.show.snapshot().standing?.cardIds?.[0] ?? 1;
    // Songs land far more often than anyone claims, as on the night.
    const next = () => h.send('next');
    const commands = [
      next, next, next, next, next, next, next, next, () => h.send('back'), () => h.send('hold'), () => h.send('hold', { on: false }),
      () => h.send('suspense'), () => h.send('pause'),
      () => h.send('claim', { cardId: standingCard() }),
      () => h.send('claim', { cardId: pick([1, 7, 30, 9999, 410]), kind: pick([undefined, 'line', 'bingo', 'standing'] as const) }),
      () => h.send('checkStart', { claimId: claimId() }), () => h.send('decide', { claimId: claimId(), valid: pick([true, false]) }),
      () => h.send('decide', { claimId: claimId(), valid: true }), () => h.send('decide', { claimId: claimId(), valid: false }),
      () => h.send('confirmLine'), () => h.send('interval'), () => h.send('roundIntro', { kind: 'desgraciat' }),
      () => h.send('newRound', { kind: 'desgraciat' }),
    ];
    for (let step = 0; step < 200; step++) {
      pick(commands)();
      h.advance((rnd % 1000) / 100);
      const s = h.show;
      const where = `seed ${seed} step ${step}: ${s.scene} ${s.status}`;
      if (s.status === 'hold') assert.ok(s.current || s.holdMusic || s.bed, `${where}: hold in silence`);
      assert.equal(s.phaseModel.kind, 'standing', where);
      assert.equal(s.round.lineConfirmed, false, where);
      assert.equal(s.snapshot().standing?.count, s.standingNow().length, where);
      assert.equal(s.round.kind, 'desgraciat', where);
      assert.ok(s.claims.every((c) => c.kind === 'standing'), `${where}: only standing claims`);
      assert.ok(s.claims.every((c) => c.outcome == null || ['complete', 'fallen', 'unknownCard', 'wrongType'].includes(c.outcome)), `${where}: a standing Check's outcome`);
      assert.deepEqual(replayJournal(journalOf(h.log)), s.record(), `${where}: the journal replays to the show`);
      scenes.add(s.scene);
      if (s.celebration) celebrated.add(s.celebration.kind);
    }
  }
  assert.ok(celebrated.has('standing'), 'the fuzz celebrates a last card standing');
  for (const scene of ['play', 'check', 'celebration', 'interval', 'roundStart']) assert.ok(scenes.has(scene), `the fuzz reaches ${scene}`);
});
