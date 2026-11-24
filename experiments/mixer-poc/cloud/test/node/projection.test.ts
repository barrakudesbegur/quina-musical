// The public projection: phones learn the landings, scenes, Check results and winning cards, and nothing private.
import test from 'node:test';
import assert from 'node:assert/strict';
import { emptyRecord, extendJournal, PROTOCOL_VERSION, type GameRecord, type JournalEntry, type ShowEvent, type ShowState } from '@quina/protocol';
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

/** Keys that must never appear anywhere in what phones get. */
const FORBIDDEN_KEYS = new Set(['queue', 'next', 'possibleWinners', 'phase', 'phaseSeed', 'shuffleSeed', 'name', 'notes', 'steps', 'completeSince', 'warnings', 'to', 'targetId', 'drum', 'roundEndMs', 'cardsInPlay', 'claims', 'settings']);
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
  assert.deepEqual(project(b.entries).state.intro, { round: 1, kind: 'special' });
  b.startRound('special');
  const { state } = project(b.entries);
  assert.equal(state.intro, null);
  assert.equal(state.scene, 'play');
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
