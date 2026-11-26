// The public projection: phones learn the landings, scenes, Check results and winning cards, and nothing private.
import test from 'node:test';
import assert from 'node:assert/strict';
import { defaultCardType, emptyRecord, extendJournal, PROTOCOL_VERSION, type GameRecord, type JournalEntry, type ShowEvent, type ShowState } from '@quina/protocol';
import { projectEntry, projectEvent, type ProjectionContext } from '../../src/domain/projection.ts';
import { applyPublic, emptyPublicState, PUBLIC_FEED, type PublicChange, type PublicState } from '@quina/protocol';
import { JournalBuilder } from '../support/journal-builder.ts';

const OFFSET = 250;
const ctx: ProjectionContext = { toCloudMs: (ms) => ms + OFFSET };

/** Run a journal through the projection, as the GameRoom does. */
function project(entries: readonly JournalEntry[], start = emptyPublicState('26')) {
  let record: GameRecord = emptyRecord(entries[0]?.gameId ?? 'g');
  let state: PublicState = { ...start, gameId: record.gameId };
  const changes: PublicChange[] = [];
  for (const entry of entries) {
    record = extendJournal(record, [entry]);
    const made = projectEntry(state, entry, record, ctx);
    state = applyPublic(state, made);
    changes.push(...made);
  }
  return { record, state, changes };
}

/** Keys that must never appear anywhere in what phones get. The paced Check's (D108–D123): the whole marked card,
 * how far its Check will reveal, whether the next press is the cue, a Review (U79) and a decision by hand (D121). */
const FORBIDDEN_KEYS = new Set(['queue', 'next', 'possibleWinners', 'future', 'standing', 'lastStandingAt', 'standingCurve', 'fellLast', 'outcome', 'slip', 'phase', 'phaseSeed', 'shuffleSeed', 'name', 'notes', 'steps', 'completeSince', 'warnings', 'to', 'targetId', 'drum', 'roundEndMs', 'cardsInPlay', 'claims', 'settings', 'markedCard', 'revealUntil', 'cueNext', 'reviewing', 'manual']);
function forbiddenKeys(value: unknown, path = ''): string[] {
  if (Array.isArray(value)) return value.flatMap((v, i) => forbiddenKeys(v, `${path}[${i}]`));
  if (!value || typeof value !== 'object') return [];
  return Object.entries(value).flatMap(([key, v]) => [...(FORBIDDEN_KEYS.has(key) ? [`${path}.${key}`] : []), ...forbiddenKeys(v, `${path}.${key}`)]);
}

const sample = JournalBuilder.sampleGame();

test('phones get the counted landings of every round, exactly, and nothing private at any step', () => {
  let record: GameRecord = emptyRecord(sample.gameId);
  let state = emptyPublicState('26');
  for (const entry of sample.entries) {
    record = extendJournal(record, [entry]);
    const made = projectEntry(state, entry, record, ctx);
    assert.deepEqual(forbiddenKeys(made), [], `changes for entry ${entry.seq} (${entry.kind})`);
    state = applyPublic(state, made);
    assert.deepEqual(forbiddenKeys(state), [], `state after entry ${entry.seq}`);
    const round = record.round;
    if (round) {
      const counted = round.landings.filter((l) => !l.undone).map((l) => ({ position: l.position, songId: l.songId, atMs: l.atMs + OFFSET }));
      assert.deepEqual(state.rounds.find((r) => r.number === round.number)?.landings, counted, `landings after entry ${entry.seq}`);
    }
  }
  assert.equal(JSON.stringify(state).includes('Àvia Rosa'), false, "a winner's name never goes public");
  assert.equal(state.heat, null, 'no Heat until the engine emits public samples');
});

test('the sample Game ends with the right rounds, Line, winners and scene', () => {
  const { state } = project(sample.entries);
  assert.deepEqual(
    state.rounds.map((r) => [r.number, r.kind, r.lineConfirmed, r.ended, r.landings.length]),
    [
      [1, 'normal', true, true, 23], // 6 − 1 (Back) + 5 + 4 + 9
      [2, 'special', false, false, 3],
    ],
  );
  assert.deepEqual(state.winners, [
    { round: 1, kind: 'line', cardIds: [33, 77] },
    { round: 1, kind: 'bingo', cardIds: [150] },
  ]);
  assert.equal(state.scene, 'play');
  assert.equal(state.check, null);
  assert.equal(state.intro, null);
});

test('Back takes the song off the phones; it lands again later at the same position', () => {
  const b = new JournalBuilder('g-back');
  b.startRound().land(3).undo();
  const { state } = project(b.entries);
  assert.deepEqual(state.rounds[0]?.landings.map((l) => l.position), [0, 1]);
  b.land(1);
  assert.deepEqual(project(b.entries).state.rounds[0]?.landings.map((l) => l.position), [0, 1, 2]);
});

test('a manual resume brings the round back whole, its counted songs only, straight into play', () => {
  const b = new JournalBuilder('g-resume');
  b.startRound().land(5);
  b.scene('interval', 2);
  b.resume(3, 9, { lineConfirmedFrom: 6 }).land(1);
  const { state, record } = project(b.entries);
  assert.deepEqual(state.rounds.map((r) => [r.number, r.ended, r.lineConfirmed, r.landings.length]), [
    [1, true, false, 5],
    [3, false, true, 11],
  ]);
  assert.deepEqual(state.rounds[1]?.landings.map((l) => l.songId), record.round?.queue.slice(0, 11));
  assert.equal(state.scene, 'play');
  assert.equal(state.interval, null);
  assert.deepEqual(forbiddenKeys(state), []);
});

test('the round being introduced is public before its Shuffle, and goes once it starts', () => {
  const b = new JournalBuilder('g-intro');
  b.scene('roundStart', 1, 'special');
  // A journal from before card type per round: the kind's default type.
  assert.deepEqual(project(b.entries).state.intro, { round: 1, kind: 'special', cardType: 'especial' });
  b.startRound('special');
  const { state } = project(b.entries);
  assert.equal(state.intro, null);
  assert.equal(state.scene, 'play');
  assert.equal(state.rounds[0]?.cardType, 'especial');
});

test('the Desgraciat round: public as its kind; the last card standing wins it and ends it, with no Line', () => {
  const b = new JournalBuilder('g-desgraciat');
  b.startRound('desgraciat').land(30);
  let { state } = project(b.entries);
  assert.equal(state.rounds[0]?.kind, 'desgraciat');
  assert.equal(state.rounds[0]?.cardType, defaultCardType('desgraciat'), "its kind's default card type");
  assert.equal(state.rounds[0]?.landings.length, 30, 'phones work out Dempeus or Assegut from the landings');
  const claimId = b.claim(34, 'standing');
  b.scene('check').decide(claimId, 'valid').scene('celebration');
  ({ state } = project(b.entries));
  assert.deepEqual(state.winners.at(-1), { round: 1, kind: 'standing', cardIds: [34] });
  assert.equal(state.rounds[0]?.ended, true);
  assert.equal(state.rounds[0]?.lineConfirmed, false);
});

test("round 1's intro is public too, though the engine drew round 1 at boot; a round in play is never reintroduced", () => {
  const b = new JournalBuilder('g-boot').boot(); // round 1's Queue, drawn without the public Shuffle
  assert.equal(project(b.entries).state.rounds[0]?.kind, 'normal');
  assert.equal(project(b.entries).state.scene, 'before');
  // The presenters introduce round 1 as the Desgraciat round: phones see the intro.
  b.scene('roundStart', 1, 'desgraciat');
  assert.deepEqual(project(b.entries).state.intro, { round: 1, kind: 'desgraciat', cardType: defaultCardType('desgraciat') });
  // Its Shuffle starts it again, as introduced: the intro goes.
  b.restartRound('desgraciat');
  let { state } = project(b.entries);
  assert.equal(state.intro, null);
  assert.equal(state.rounds.length, 1);
  assert.equal(state.rounds[0]?.kind, 'desgraciat');
  // A round with landings is never reintroduced (a scene change back to roundStart for it).
  b.land(3).scene('roundStart', 1, 'desgraciat');
  ({ state } = project(b.entries));
  assert.equal(state.intro, null);
});

test("the Desgraciat round's shared win: one public winner with every card that stood last; no slip, no outcome", () => {
  const b = new JournalBuilder('g-shared').startRound('desgraciat').land(25);
  const claims = [b.claim(3, 'standing'), b.claim(7, 'standing')];
  b.scene('check');
  for (const id of claims) b.decide(id, 'valid', 'fellLast');
  b.note(claims[0] as string, null, null, '17').note(claims[1] as string, 'Àvia Rosa', null, '18');
  b.scene('celebration');
  const { state } = project(b.entries);
  assert.deepEqual(state.winners, [{ round: 1, kind: 'standing', cardIds: [3, 7] }]);
  assert.equal(state.rounds[0]?.ended, true);
  const all = JSON.stringify(state);
  assert.ok(!all.includes('Àvia') && !all.includes('"slip"') && !all.includes('fellLast'), 'names, slips and outcomes stay private');
  assert.deepEqual(forbiddenKeys(state), []);
});

test("a round's card type is public from its intro: the one it names, else its kind's default", () => {
  const b = new JournalBuilder('g-types');
  b.scene('roundStart', 1, 'normal', 'groc');
  assert.deepEqual(project(b.entries).state.intro, { round: 1, kind: 'normal', cardType: 'groc' });
  b.startRound('normal', undefined, 'groc');
  assert.equal(project(b.entries).state.rounds.at(-1)?.cardType, 'groc');
  b.startRound('normal');
  assert.equal(project(b.entries).state.rounds.at(-1)?.cardType, 'normal');
  // A manual resume (plan B) carries it too.
  const r = new JournalBuilder('g-types-resume').resume(3, 4, { kind: 'special' });
  assert.equal(project(r.entries).state.rounds.at(-1)?.cardType, 'especial');
});

test('a Check under review stays pending on phones (U76/U79 open); a discard clears it with no mark (D118–D121)', () => {
  const b = new JournalBuilder('g-review');
  b.startRound().land(10);
  const claimId = b.claim(42, 'line');
  b.scene('check');
  let { state, record } = project(b.entries);
  const scheduled = {
    v: PROTOCOL_VERSION,
    type: 'check.scheduled',
    check: { claimId, cardId: 42, kind: 'line', outcome: 'incomplete', row: 0, otherRows: [], steps: [], startAtMs: 1, endAtMs: 9 },
  } as unknown as ShowEvent;
  state = applyPublic(state, projectEvent(state, scheduled, ctx));
  assert.equal(state.check?.result, 'pending');

  const next = (): JournalEntry => {
    const entry = b.entries.at(-1) as JournalEntry;
    record = extendJournal(record, [entry]);
    return entry;
  };
  b.review(claimId);
  assert.deepEqual(projectEntry(state, next(), record, ctx), [], 'under review: nothing public yet');
  b.continue(claimId);
  assert.deepEqual(projectEntry(state, next(), record, ctx), [], 'the Check goes on');
  b.review(claimId).discard(claimId);
  projectEntry(state, b.entries.at(-2) as JournalEntry, (record = extendJournal(record, [b.entries.at(-2) as JournalEntry])), ctx);
  const discarded = next();
  assert.deepEqual(projectEntry(state, discarded, record, ctx), [{ kind: 'check', check: null }], 'discarded: the Check goes, with no mark');
  state = applyPublic(state, projectEntry(state, discarded, record, ctx));
  assert.deepEqual(state.winners, []);
  assert.deepEqual(project(b.entries).state.winners, [], 'replayed from the start, the same');
});

test('a win by hand from a Review shows on phones as any win, with nothing saying it was by hand', () => {
  const b = new JournalBuilder('g-by-hand');
  b.startRound().land(10);
  const claimId = b.claim(42, 'bingo');
  b.review(claimId).decide(claimId, 'valid', 'incomplete', true);
  const { state } = project(b.entries);
  assert.deepEqual(state.winners, [{ round: 1, kind: 'bingo', cardIds: [42] }]);
  assert.equal(JSON.stringify(state).includes('"manual"'), false, 'no `manual` key reaches phones');
});

test('a Check is public as "pending" from its start, without its steps, and shows its verdict only once decided', () => {
  const b = new JournalBuilder('g-check');
  b.startRound().land(10);
  const claimId = b.claim(42, 'line');
  b.scene('check');
  let { state, record } = project(b.entries);
  assert.equal(state.check, null, 'queued claims are not public');

  const scheduled = {
    v: PROTOCOL_VERSION,
    type: 'check.scheduled',
    check: { claimId, cardId: 42, kind: 'line', outcome: 'incomplete', row: 0, otherRows: [], steps: [{ songId: 5, landed: false, atMs: 1, durationMs: 2000 }], startAtMs: 1, endAtMs: 9 },
  } as unknown as ShowEvent;
  const made = projectEvent(state, scheduled, ctx);
  assert.deepEqual(made, [{ kind: 'check', check: { round: 1, cardId: 42, kind: 'line', result: 'pending' } }]);
  assert.deepEqual(projectEvent(applyPublic(state, made), scheduled, ctx), [], 'scheduling it again changes nothing');
  state = applyPublic(state, made);

  b.decide(claimId, 'invalid');
  const decided = b.entries.at(-1) as JournalEntry;
  record = extendJournal(record, [decided]);
  state = applyPublic(state, projectEntry(state, decided, record, ctx));
  assert.equal(state.check?.result, 'invalid');
  assert.deepEqual(state.winners, []);
  b.scene('play');
  const back = b.entries.at(-1) as JournalEntry;
  state = applyPublic(state, projectEntry(state, back, extendJournal(record, [back]), ctx));
  assert.equal(state.check, null, 'leaving the Check clears it');
});

test('Spin timing goes public on the cloud clock, never its song; a landing or a cancel stops it', () => {
  const state = project(new JournalBuilder('g-spin').startRound().land(2).entries).state;
  const scheduled = { v: PROTOCOL_VERSION, type: 'transition.scheduled', id: 't1', to: 33, drum: { removeId: 1, targetId: 33, minLaps: 2 }, spinStartAtMs: 1000, landAtMs: 9000 } as unknown as ShowEvent;
  const spin = projectEvent(state, scheduled, ctx);
  assert.deepEqual(spin, [{ kind: 'spin', spin: { startAtMs: 1000 + OFFSET, landAtMs: 9000 + OFFSET } }]);
  const spinning = applyPublic(state, spin);
  const suspense = { v: PROTOCOL_VERSION, type: 'suspense.started', to: 33, spinStartAtMs: 2000 } as unknown as ShowEvent;
  assert.deepEqual(projectEvent(spinning, suspense, ctx), [{ kind: 'spin', spin: { startAtMs: 2000 + OFFSET, landAtMs: null } }]);
  for (const type of ['transition.cancelled', 'transition.landed']) {
    assert.deepEqual(projectEvent(spinning, { v: PROTOCOL_VERSION, type } as unknown as ShowEvent, ctx), [{ kind: 'spin', spin: null }]);
  }
  assert.deepEqual(projectEvent(state, { v: PROTOCOL_VERSION, type: 'transition.cancelled' } as unknown as ShowEvent, ctx), [], 'no Spin, no change');
});

test('a late journal upload does not stop a newer Spin; the landing it belongs to does', () => {
  const b = new JournalBuilder('g-late').startRound().land(2);
  const { state } = project(b.entries);
  const lastLanding = (b.entries.at(-1) as JournalEntry).atMs + OFFSET;
  const spinning = applyPublic(state, [{ kind: 'spin', spin: { startAtMs: lastLanding + 60_000, landAtMs: lastLanding + 68_000 } }]);
  b.land(1); // journalled before the Spin started, but uploaded only now
  const stale = b.entries.at(-1) as JournalEntry;
  b.nowMs += 60_000;
  b.land(1); // the Spin's own landing
  const own = b.entries.at(-1) as JournalEntry;
  const record = extendJournal(project(b.entries.slice(0, -2)).record, [stale]);
  const afterStale = applyPublic(spinning, projectEntry(spinning, stale, record, ctx));
  assert.notEqual(afterStale.spin, null, 'the newer Spin keeps turning');
  const afterOwn = projectEntry(afterStale, own, extendJournal(record, [own]), ctx);
  assert.ok(afterOwn.some((c) => c.kind === 'spin' && c.spin === null), 'its own landing stops it');
});

test("from the engine's state only the pause, the Interval and the rounded Game end go public", () => {
  const state = emptyPublicState('26');
  const step = PUBLIC_FEED.gameEndRoundingMs;
  const show = {
    v: PROTOCOL_VERSION,
    type: 'state',
    next: { songId: 7, title: 'Secret', artist: 'X' },
    possibleWinners: { line: [{ cardId: 12, lines: [0], completedBy: 7 }], bingo: [] },
    // The Desgraciat round's standing cards and the Futur's curve are the console's.
    standing: { count: 2, cardIds: [12, 34] },
    future: { lastStandingAt: 40, standingCurve: [10, 5, 2, 1] },
    phase: 'final',
    heat: 0.93,
    pause: { sinceMs: 5000 },
    interval: { sinceMs: 0, nextRound: 4, guideEndMs: 600_000 },
    schedule: { roundEndMs: 123_456, gameEndMs: 10 * step + 0.4 * step - OFFSET, roundDriftSec: 3, gameDriftSec: 1 },
  } as unknown as ShowState;
  const made = projectEvent(state, show, ctx);
  assert.deepEqual(made, [
    { kind: 'pause', pause: { sinceMs: 5000 + OFFSET } },
    { kind: 'interval', interval: { nextRound: 4, guideEndMs: 600_000 + OFFSET } },
    { kind: 'gameEnd', gameEndMs: 10 * step },
  ]);
  assert.deepEqual(projectEvent(applyPublic(state, made), show, ctx), [], 'the same state again changes nothing');
  assert.deepEqual(forbiddenKeys(made), []);
});

test("the paced Check's events and its private claim fields never reach phones (D108, D123; U79)", () => {
  const state = applyPublic(emptyPublicState('26'), [{ kind: 'check', check: { round: 1, cardId: 12, kind: 'line', result: 'pending' } }]);
  const check = { claimId: 'cl-1', cardId: 12, kind: 'line', outcome: 'complete', row: 0, otherRows: [], steps: [], startAtMs: 0, endAtMs: 0, total: 4, revealed: [], auto: false, cue: null, reviewing: true };
  const events = [
    { v: PROTOCOL_VERSION, type: 'check.started', check },
    { v: PROTOCOL_VERSION, type: 'check.revealed', claimId: 'cl-1', index: 0, step: { songId: 7, landed: true, atMs: 10, durationMs: 3000 } },
    { v: PROTOCOL_VERSION, type: 'check.reviewing', claimId: 'cl-1', atMs: 20 },
    { v: PROTOCOL_VERSION, type: 'check.cue', claimId: 'cl-1', cue: 'pass', manual: true, atMs: 30 },
    { v: PROTOCOL_VERSION, type: 'celebration.started', celebration: { kind: 'line', round: 1, check } },
    {
      v: PROTOCOL_VERSION,
      type: 'state',
      pause: null,
      interval: null,
      schedule: { gameEndMs: 0 },
      transition: null,
      suspense: null,
      check,
      claims: [{ claimId: 'cl-1', cardId: 12, markedCard: [{ songId: 7, landed: true }], revealUntil: 3, cueNext: true, warnings: ['notSold'] }],
    },
  ] as unknown as ShowEvent[];
  for (const event of events) {
    const made = projectEvent(state, event, ctx);
    assert.deepEqual(forbiddenKeys(made), [], event.type);
    if (event.type !== 'state') assert.deepEqual(made, [], `${event.type} changes nothing public`);
    else assert.equal(made.some((c) => c.kind === 'check'), false, "the state's Check stays the console's");
  }
});

test("a state with nothing in flight stops the phones' Spin (Panic, a new round)", () => {
  const spinning = applyPublic(emptyPublicState('26'), [{ kind: 'spin', spin: { startAtMs: 1, landAtMs: 9 } }]);
  const show = (transition: unknown, suspense: unknown) =>
    ({ v: PROTOCOL_VERSION, type: 'state', pause: null, interval: null, schedule: { gameEndMs: 0 }, transition, suspense }) as unknown as ShowState;
  assert.ok(projectEvent(spinning, show(null, null), ctx).some((c) => c.kind === 'spin' && c.spin === null));
  assert.equal(projectEvent(spinning, show({ id: 't' }, null), ctx).some((c) => c.kind === 'spin'), false, 'a Spin in flight keeps turning');
  assert.equal(projectEvent(spinning, show(null, { id: 's' }), ctx).some((c) => c.kind === 'spin'), false, 'a Suspense keeps turning');
});

test('the shuffle goes public with its timing only', () => {
  const state = emptyPublicState('26');
  const shuffle = { v: PROTOCOL_VERSION, type: 'shuffle.scheduled', round: 2, kind: 'normal', startAtMs: 100, endAtMs: 6100, songCount: 77 } as unknown as ShowEvent;
  assert.deepEqual(projectEvent(state, shuffle, ctx), [{ kind: 'shuffle', shuffle: { round: 2, startAtMs: 100 + OFFSET, endAtMs: 6100 + OFFSET } }]);
});

test('every other event is private', () => {
  const state = emptyPublicState('26');
  for (const type of ['journal.entry', 'engine.health', 'command.rejected', 'claim.opened', 'claim.decided', 'celebration.started', 'scene.changed', 'landing.undone']) {
    assert.deepEqual(projectEvent(state, { v: PROTOCOL_VERSION, type } as unknown as ShowEvent, ctx), [], type);
  }
});
