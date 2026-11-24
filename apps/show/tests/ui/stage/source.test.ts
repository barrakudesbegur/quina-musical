// The stage's feed: the show page's Bus (local emissions only) or a ShowClient, reduced to public facts.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PROTOCOL_VERSION, type IncomingEvent } from '@quina/protocol';
import { Bus } from '../../../engine/src/net/bus.ts';
import { FIXTURES } from '../../../ui/fixtures/states.ts';
import { busSource, toStageEvent, type StageEvent } from '../../../stage/source.ts';

const NOW = 1_800_000_000_000;

const scheduled: IncomingEvent = {
  v: PROTOCOL_VERSION,
  type: 'transition.scheduled',
  id: 'tr-1',
  reqId: null,
  from: 7,
  to: 74,
  position: 17,
  phase: 'late',
  recipe: 'R7',
  recipeName: 'build',
  exit: null,
  shape: 'S1',
  spinStartAtMs: NOW,
  exitAtMs: NOW + 1000,
  landAtMs: NOW + 7000,
  durationMs: 7000,
  hookId: 'h1',
  bpm: 120,
  drum: { removeId: null, targetId: 74, minLaps: 2 },
};

test('a scheduled Spin keeps only its timestamps: never the incoming song', () => {
  const event = toStageEvent(scheduled);
  assert.deepEqual(event, { kind: 'spin', id: 'tr-1', spinStartAtMs: NOW, landAtMs: NOW + 7000, autoReleaseAtMs: null });
  assert.ok(!JSON.stringify(event).includes('74'));
});

test('a Suspense keeps only its timestamps', () => {
  const event = toStageEvent({
    v: PROTOCOL_VERSION,
    type: 'suspense.started',
    id: 'tr-2',
    reqId: null,
    from: 7,
    to: 74,
    position: 17,
    phase: 'final',
    spinStartAtMs: NOW,
    exitAtMs: NOW + 1000,
    autoReleaseAtMs: NOW + 30000,
    drum: { removeId: null, targetId: 74 },
  });
  assert.deepEqual(event, { kind: 'spin', id: 'tr-2', spinStartAtMs: NOW, landAtMs: null, autoReleaseAtMs: NOW + 30000 });
});

test('landings, cancels and undos pass; health, journal and rejections do not', () => {
  assert.deepEqual(toStageEvent({ v: PROTOCOL_VERSION, type: 'transition.landed', id: 'tr-1', songId: 74, position: 17, atMs: NOW }), {
    kind: 'landed',
    id: 'tr-1',
    songId: 74,
    position: 17,
    atMs: NOW,
  });
  assert.equal(toStageEvent({ v: PROTOCOL_VERSION, type: 'transition.cancelled', id: 'tr-1', reason: 'hold', keptOutgoing: true, atMs: NOW })?.kind, 'cancelled');
  assert.equal(toStageEvent({ v: PROTOCOL_VERSION, type: 'landing.undone', songId: 74, position: 17, atMs: NOW })?.kind, 'undone');
  assert.equal(toStageEvent({ v: PROTOCOL_VERSION, type: 'command.rejected', reqId: null, cmd: 'next', reason: 'busy' }), null);
  assert.equal(toStageEvent({ v: PROTOCOL_VERSION, type: 'relay.clients', clients: [] }), null);
});

test('the bus source hears the page\'s own emissions only, never remote messages', () => {
  const bus = new Bus<unknown>({ role: 'show', clientId: 'test' });
  let clock = NOW;
  const source = busSource(bus, { clock: () => clock });
  const heard: StageEvent[] = [];
  source.onEvent((e) => heard.push(e));
  const state = { ...FIXTURES.play(NOW).state, atMs: NOW };
  bus.emit(state);
  // A remote's message reaching listeners as non-local (what a transport delivers): ignored.
  for (const listener of bus.listeners) listener({ ...state, seq: 99 }, { local: false });
  bus.emit({ not: 'an event' });
  bus.emit(scheduled);
  assert.deepEqual(heard.map((e) => e.kind), ['state', 'spin']);
  assert.equal(source.latest()?.seq, state.seq);
  assert.equal(source.link(), 'online');
  clock = NOW + 1000;
  assert.equal(source.now(), NOW + 1000, 'same laptop: no offset');
  source.dispose();
  bus.emit(state);
  assert.equal(heard.length, 2, 'nothing after dispose');
});
