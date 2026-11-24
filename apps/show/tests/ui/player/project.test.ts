// The dev projection's STRICT WHITELIST: engine state full of private values goes in, and none of them may come
// out in the public state. Also: landings, Back, the Check verdict, winners without names, the Spin's timing.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PROTOCOL_VERSION, type IncomingEvent, type ShowState } from '@quina/protocol';
import { baseState, FIXTURE_LANDED, FIXTURES } from '../../../../../packages/ui/fixtures/states.ts';
import { SAMPLE_PLAN } from '../../../../../packages/ui/fixtures/plan.ts';
import { PublicProjector, type ProjectionContext } from '../../../../player/feed/project.ts';
import { ProjectedFeedCore } from '../../../../player/feed/projected-feed.ts';
import { followFeed } from '../../../../player/feed/public.ts';

const NOW = 1_700_000_000_000;

/** Private sentinels: none of these may appear anywhere in the output. */
const SECRET = {
  nextSong: 987_001,
  target: 987_002,
  drumTarget: 987_003,
  possibleLine: 987_004,
  possibleBingo: 987_005,
  completeSince: 987_006,
  completedBy: 987_007,
  checkStepSong: 987_008,
  queueLength: 987_009,
  songsUntilWinner: 987_010,
  historySong: 987_011,
  journalSong: 987_012,
  roundEnd: 987_013,
  name: 'SECRET-WINNER-NAME',
  notes: 'SECRET-WINNER-NOTES',
  nextTitle: 'SECRET-NEXT-TITLE',
  inPlay: 'SECRET-CARDS-IN-PLAY',
  hook: 'SECRET-HOOK',
};
const SECRET_VALUES = new Set<unknown>(Object.values(SECRET));
const FORBIDDEN_KEYS = ['next', 'to', 'targetId', 'drum', 'queue', 'possibleWinners', 'phase', 'warnings', 'completeSince', 'outcome', 'steps', 'name', 'notes', 'claims', 'history', 'game', 'cards', 'pace', 'hold', 'current'];

/** The play fixture with every private field filled with sentinels. */
function secretState(): ShowState {
  const s = baseState(NOW);
  const position = s.queue.position;
  const state = {
    ...s,
    next: { songId: SECRET.nextSong, title: SECRET.nextTitle, artist: 'x' },
    queue: { position, length: SECRET.queueLength },
    phase: 'final',
    status: 'transition',
    transition: { id: 'tr-secret', recipe: 'R7', phase: 'final', to: SECRET.target, landAtMs: NOW + 5000 },
    possibleWinners: {
      line: [{ cardId: SECRET.possibleLine, lines: [0], completedBy: SECRET.completedBy }],
      bingo: [{ cardId: SECRET.possibleBingo, lines: [0, 1, 2], completedBy: SECRET.completedBy }],
    },
    game: { ...s.game, songsUntilWinner: SECRET.songsUntilWinner, nextRecipe: SECRET.hook },
    cards: { ...s.cards, inPlay: SECRET.inPlay },
    schedule: { ...s.schedule, roundEndMs: SECRET.roundEnd },
    history: [{ recipe: 'R7', family: 'cut', exit: null, songId: SECRET.historySong, hookId: SECRET.hook, phase: 'final' }],
    current: { ...s.current!, hookId: SECRET.hook },
    claims: [
      { claimId: 'cl-9', round: 3, cardId: 57, kind: 'line', atMs: NOW, position, status: 'checked', outcome: 'complete', completeSince: SECRET.completeSince, warnings: ['notSold'] },
    ],
    check: {
      claimId: 'cl-9',
      cardId: 57,
      kind: 'line',
      outcome: 'complete',
      row: 2,
      otherRows: [],
      steps: [{ songId: SECRET.checkStepSong, landed: true, atMs: NOW, durationMs: 2500 }],
      startAtMs: NOW,
      endAtMs: NOW + 12_000,
    },
    scene: 'check',
    winners: s.winners.map((w) => ({ ...w, name: SECRET.name, notes: SECRET.notes })),
  };
  return state as unknown as ShowState;
}

const ctx: ProjectionContext = {
  nowMs: NOW,
  edition: '26',
  gameId: 'g1',
  link: { online: true, sinceMs: NOW - 1000 },
  plan: null,
  notice: null,
  soundsDefault: true,
};

/** Every key and every primitive value anywhere in `value`. */
function walk(value: unknown, keys = new Set<string>(), values = new Set<unknown>()): { keys: Set<string>; values: Set<unknown> } {
  if (Array.isArray(value)) for (const v of value) walk(v, keys, values);
  else if (value && typeof value === 'object') {
    for (const [k, v] of Object.entries(value)) {
      keys.add(k);
      walk(v, keys, values);
    }
  } else values.add(value);
  return { keys, values };
}

function projected(events: IncomingEvent[] = []) {
  const p = new PublicProjector(() => 0.5);
  p.ingest(secretState(), NOW);
  for (const e of events) p.ingest(e, NOW);
  return p.project(ctx);
}

test('no private value or key ever comes out', () => {
  const scheduled = {
    v: PROTOCOL_VERSION,
    type: 'transition.scheduled',
    id: 'tr-secret',
    reqId: null,
    from: 7,
    to: SECRET.target,
    position: 17,
    phase: 'final',
    recipe: 'R7',
    recipeName: SECRET.hook,
    exit: null,
    shape: 'S1',
    spinStartAtMs: NOW - 2000,
    exitAtMs: NOW,
    landAtMs: NOW + 5000,
    durationMs: 7000,
    hookId: SECRET.hook,
    bpm: 120,
    drum: { removeId: null, targetId: SECRET.drumTarget, minLaps: 3 },
  } as unknown as IncomingEvent;
  const journal = { v: PROTOCOL_VERSION, type: 'journal.entry', entry: { kind: 'round.started', queue: [SECRET.journalSong] } } as unknown as IncomingEvent;
  const out = projected([scheduled, journal]);
  const { keys, values } = walk(out);
  for (const v of SECRET_VALUES) assert.ok(!values.has(v), `leaked ${String(v)}`);
  for (const k of FORBIDDEN_KEYS) assert.ok(!keys.has(k), `leaked key "${k}"`);
  assert.ok(!values.has('notSold') && !values.has('complete') && !values.has('final'), 'no warning, engine outcome or Phase');
  assert.ok(!JSON.stringify(out).includes('SECRET'));
});

test('the public state has exactly the contract keys', () => {
  const out = projected();
  assert.deepEqual(Object.keys(out).sort(), [
    'check', 'edition', 'gameEndMs', 'gameId', 'heat', 'interval', 'intro', 'link', 'notice', 'pause', 'plan', 'rounds', 'scene', 'shuffle', 'soundsDefault', 'spin', 'winners',
  ].sort());
  for (const r of out.rounds) {
    assert.deepEqual(Object.keys(r).sort(), ['ended', 'kind', 'landings', 'lineConfirmed', 'number', 'startedAtMs']);
    for (const l of r.landings) assert.deepEqual(Object.keys(l).sort(), ['atMs', 'position', 'songId']);
  }
  for (const w of out.winners) assert.deepEqual(Object.keys(w).sort(), ['cardIds', 'kind', 'round']);
  assert.deepEqual(Object.keys(out.check ?? {}).sort(), ['cardId', 'kind', 'result', 'round']);
  assert.deepEqual(Object.keys(out.spin ?? {}).sort(), ['landAtMs', 'startAtMs']);
});

test('the Spin carries only its timing; the exact start comes from the Spin event', () => {
  const out = projected();
  assert.deepEqual(out.spin, { startAtMs: NOW, landAtMs: NOW + 5000 });
  const withEvent = projected([{ v: PROTOCOL_VERSION, type: 'suspense.started', id: 'tr-secret', reqId: null, from: 7, to: SECRET.target, position: 17, phase: 'final', spinStartAtMs: NOW - 3000, exitAtMs: NOW, autoReleaseAtMs: NOW + 9000, drum: { removeId: null, targetId: SECRET.drumTarget } } as unknown as IncomingEvent]);
  assert.equal(withEvent.spin?.startAtMs, NOW - 3000);
});

test('a Check stays pending until a presenter decides, whatever the engine found', () => {
  assert.deepEqual(projected().check, { round: 3, cardId: 57, kind: 'line', result: 'pending' });
  const p = new PublicProjector(() => 0.5);
  const s = secretState() as ShowState & { claims: { status: string }[] };
  p.ingest({ ...s, claims: s.claims.map((c) => ({ ...c, status: 'invalid' })) } as unknown as ShowState, NOW);
  assert.equal(p.project(ctx).check?.result, 'invalid');
});

test('winners are card numbers per prize, never names', () => {
  const out = projected();
  assert.deepEqual(out.winners, [
    { round: 1, kind: 'line', cardIds: [12] },
    { round: 1, kind: 'bingo', cardIds: [188] },
    { round: 2, kind: 'line', cardIds: [77] },
    { round: 2, kind: 'bingo', cardIds: [140] },
  ]);
});

test('landings come from the snapshot and the landing events; undone ones and Back are dropped', () => {
  const p = new PublicProjector(() => 0.5);
  const s = secretState();
  const last = s.queue.position;
  // An undone landing in the list, and one beyond the queue position, must not count.
  const landings = [...s.landings.slice(0, -1), { ...s.landings[s.landings.length - 1], undone: true }, { songId: 3, title: '', artist: '', position: last + 1, atMs: NOW, undone: false }];
  p.ingest({ ...s, landings }, NOW);
  let round = p.project(ctx).rounds.at(-1)!;
  assert.equal(round.number, 3);
  assert.deepEqual(round.landings.map((l) => l.position), s.landings.slice(0, -1).map((l) => l.position));
  p.ingest({ v: PROTOCOL_VERSION, type: 'transition.landed', id: 'tr-x', songId: 74, position: last, atMs: NOW }, NOW);
  round = p.project(ctx).rounds.at(-1)!;
  assert.equal(round.landings.at(-1)?.songId, 74);
  p.ingest({ v: PROTOCOL_VERSION, type: 'landing.undone', songId: 74, position: last, atMs: NOW }, NOW);
  round = p.project(ctx).rounds.at(-1)!;
  assert.notEqual(round.landings.at(-1)?.songId, 74);
});

test('the fixture story projects as a playable round', () => {
  const p = new PublicProjector(() => 0.5);
  const s = baseState(NOW) as unknown as ShowState;
  p.ingest(s, NOW);
  const out = p.project(ctx);
  assert.equal(out.scene, 'play');
  assert.equal(out.rounds.length, 1);
  assert.deepEqual(out.rounds[0].landings.map((l) => l.songId), FIXTURE_LANDED.slice(-10));
  assert.equal(out.gameEndMs! % (5 * 60_000), 0, 'the end time is rounded to 5 minutes');
});

test('snapshots go through followFeed like the cloud messages', () => {
  const p = new PublicProjector(() => 0.5);
  p.ingest(secretState(), NOW);
  const first = followFeed(null, p.snapshot(ctx));
  assert.equal(first.kind, 'ok');
  const second = followFeed(first.kind === 'ok' ? first.view : null, p.snapshot(ctx));
  assert.equal(second.kind === 'ok' && second.view.seq, 2);
});

test('the Heat leaves only as an eased sample that starts later', () => {
  const heat = projected().heat;
  assert.ok(heat);
  assert.ok(heat.fromMs >= NOW + 4000, 'never moves at the moment it changes');
  assert.ok(heat.toMs > heat.fromMs);
});

test('the plan goes out as the public plan: locked rounds without prizes, never the cheat sheet', () => {
  const p = new PublicProjector(() => 0.5);
  p.ingest(baseState(NOW) as unknown as ShowState, NOW); // rounds 1 to 3 introduced
  const out = p.project({ ...ctx, plan: SAMPLE_PLAN });
  assert.ok(out.plan);
  assert.deepEqual(out.plan.rounds.map((r) => r.revealed), [true, true, true, false, false, false, false, false]);
  assert.equal(out.plan.rounds[2].bingo?.[0].title, '[Premi de quina 3]');
  assert.deepEqual(Object.keys(out.plan.rounds[3]).sort(), ['cardType', 'kind', 'number', 'revealed'], 'a locked round: only its skeleton (its card type is printed, never secret)');
  const json = JSON.stringify(out);
  assert.ok(!json.includes('cheatSheet') && !json.includes(SAMPLE_PLAN.cheatSheet.claimRules[0]));
  assert.ok(!json.includes('Premi de línia 4'), "a locked round's prizes never leave");
  // All secret: the intro reveals count for nothing, the presenters' do.
  const secret = p.project({ ...ctx, plan: { ...SAMPLE_PLAN, prizeReveal: 'allSecret' } });
  assert.deepEqual(secret.plan?.rounds.filter((r) => r.revealed).map((r) => r.number), []);
  const revealed = new PublicProjector(() => 0.5);
  revealed.ingest({ ...baseState(NOW), prizes: { revealed: [{ round: 5, by: 'presenters' }] } } as unknown as ShowState, NOW);
  assert.deepEqual(revealed.project({ ...ctx, plan: { ...SAMPLE_PLAN, prizeReveal: 'allSecret' } }).plan?.rounds.filter((r) => r.revealed).map((r) => r.number), [5]);
});

test('the dev feed follows the engine through every scene: before → roundStart → play after a landing', () => {
  const core = new ProjectedFeedCore(() => 0.5, () => NOW);
  const publish = () => core.publish({ ...ctx, plan: SAMPLE_PLAN });
  const before = FIXTURES.before(NOW).state as unknown as ShowState;
  core.projector.ingest(before, NOW);
  publish();
  assert.equal(core.follower.state?.scene, 'before');
  assert.deepEqual(core.follower.state?.plan?.rounds.filter((r) => r.revealed).map((r) => r.number), [1], 'before the night: round 1 only');

  const intro = { ...before, seq: 2, scene: 'roundStart', round: { ...before.round, number: 1 }, intro: { round: 1, kind: 'normal', sinceMs: NOW }, prizes: { revealed: [{ round: 1, by: 'intro' }] } } as unknown as ShowState;
  core.projector.ingest(intro, NOW);
  publish();
  assert.equal(core.follower.state?.scene, 'roundStart');
  assert.deepEqual(core.follower.state?.intro, { round: 1, kind: 'normal' });

  const playing = { ...intro, seq: 3, scene: 'play', intro: null, round: { ...intro.round, startedAtMs: NOW }, queue: { position: 0, length: 77 }, landings: [{ songId: 25, title: 'Gasolina', artist: 'Daddy Yankee', position: 0, atMs: NOW, undone: false }] } as unknown as ShowState;
  core.projector.ingest(playing, NOW);
  core.projector.ingest({ v: PROTOCOL_VERSION, type: 'transition.landed', id: 'tr-1', songId: 25, position: 0, atMs: NOW }, NOW);
  publish();
  assert.equal(core.follower.state?.scene, 'play');
  assert.deepEqual(core.follower.state?.rounds.at(-1)?.landings.map((l) => l.songId), [25]);
  assert.equal(core.follower.view?.seq, 3, 'every snapshot was taken');
});

test('DevRelayFeed over a relay socket: the engine\'s states reach the player as before → roundStart → play', async () => {
  const { DevRelayFeed } = await import('../../../../player/feed/relay-feed.ts');
  const { ShowClient } = await import('../../../../../packages/ui/client/show-client.ts');
  let handlers: { open(): void; message(text: string): void; close(): void } | null = null;
  const sent: string[] = [];
  const transport = { connected: false, connect(h: typeof handlers) { handlers = h; }, send(text: string) { sent.push(text); return true; } };
  const client = new ShowClient({ role: 'drum', transport });
  const planStore = { load: () => SAMPLE_PLAN, save: () => {}, subscribe: () => () => {} };
  const feed = new DevRelayFeed({ client, planStore, random: () => 0.5 });
  const scenes: (string | null)[] = [];
  feed.subscribe((u) => scenes.push(u.state?.scene ?? null));
  feed.start();
  transport.connected = true;
  handlers!.open();
  const deliver = (event: unknown) => handlers!.message(JSON.stringify(event));
  deliver({ v: PROTOCOL_VERSION, type: 'relay.clients', clients: [{ role: 'show', clientId: 'show' }] });
  const before = FIXTURES.before(NOW).state;
  deliver(before);
  deliver({ v: PROTOCOL_VERSION, type: 'relay.plan', plan: SAMPLE_PLAN });
  deliver({ ...before, seq: 2, scene: 'roundStart', round: { ...before.round, number: 1 }, intro: { round: 1, kind: 'normal', sinceMs: NOW }, prizes: { revealed: [{ round: 1, by: 'intro' }] } });
  assert.equal(scenes.at(-1), 'roundStart');
  deliver({ ...before, seq: 3, scene: 'play', intro: null, round: { ...before.round, number: 1, startedAtMs: NOW }, queue: { position: 0, length: 77 }, landings: [{ songId: 25, title: 'x', artist: 'y', position: 0, atMs: NOW, undone: false }] });
  deliver({ v: PROTOCOL_VERSION, type: 'transition.landed', id: 'tr-1', songId: 25, position: 0, atMs: NOW });
  assert.equal(scenes.at(-1), 'play');
  assert.ok(scenes.includes('before'));
  feed.stop();
});
