// The laptop ↔ cloud messages: checked on arrival, and only the forwarded event types get through.
import test from 'node:test';
import assert from 'node:assert/strict';
import { PROTOCOL_VERSION } from '@quina/protocol';
import { checkLinkMessage, isCloudMessage, linkMessage, type LinkHello } from '../../src/link-protocol.ts';
import { nextClockOffset, toCloudMs } from '../../src/domain/clock.ts';

const v = PROTOCOL_VERSION;

test('a hello, an upload, a ping and the forwarded events pass', () => {
  const hello = linkMessage<LinkHello>({ type: 'link.hello', clientId: 'laptop-1', gameId: null, lastSeq: 0 }, 5);
  assert.deepEqual(hello, { v, type: 'link.hello', clientId: 'laptop-1', gameId: null, lastSeq: 0, sentAtMs: 5 });
  const good = [
    hello,
    { v, type: 'link.journal', gameId: 'g', entries: [], sentAtMs: 1 },
    { v, type: 'link.ping', sentAtMs: 1 },
    { v, type: 'link.event', sentAtMs: 1, event: { v, type: 'transition.scheduled', spinStartAtMs: 1, landAtMs: 2, to: 5 } },
    { v, type: 'link.event', sentAtMs: 1, event: { v, type: 'suspense.started', spinStartAtMs: 1 } },
    { v, type: 'link.event', sentAtMs: 1, event: { v, type: 'transition.landed' } },
    { v, type: 'link.event', sentAtMs: 1, event: { v, type: 'shuffle.scheduled', round: 2, startAtMs: 1, endAtMs: 2 } },
    { v, type: 'link.event', sentAtMs: 1, event: { v, type: 'check.started', check: { cardId: 4, kind: 'bingo' } } },
    // The Desgraciat round's Check, for the last card standing.
    { v, type: 'link.event', sentAtMs: 1, event: { v, type: 'check.started', check: { cardId: 4, kind: 'standing' } } },
    { v, type: 'link.event', sentAtMs: 1, event: { v, type: 'state', pause: null, interval: null, schedule: { gameEndMs: 9 }, transition: null, suspense: null } },
    { v, type: 'link.event', sentAtMs: 1, event: { v, type: 'state', pause: { sinceMs: 3, overlay: false }, interval: null, schedule: { gameEndMs: 9 }, transition: null, suspense: null } },
    { v, type: 'link.event', sentAtMs: 1, event: { v, type: 'relay.clients', clients: [] } },
    { v, type: 'link.event', sentAtMs: 1, event: { v, type: 'claim.opened', claim: {} } },
  ];
  for (const message of good) assert.ok(checkLinkMessage(message).ok, JSON.stringify(message));
});

test('anything malformed, an unknown event type, or the journal as an event, is refused', () => {
  const bad = [
    null,
    { v: 2, type: 'link.ping', sentAtMs: 1 },
    { v, type: 'link.ping' },
    { v, type: 'link.hello', clientId: '', gameId: null, lastSeq: 0, sentAtMs: 1 },
    { v, type: 'link.hello', clientId: 'x', gameId: 5, lastSeq: 0, sentAtMs: 1 },
    { v, type: 'link.hello', clientId: 'x', gameId: null, lastSeq: -1, sentAtMs: 1 },
    { v, type: 'link.journal', gameId: 'g', entries: {}, sentAtMs: 1 },
    { v, type: 'link.journal', gameId: '', entries: [], sentAtMs: 1 },
    { v, type: 'link.event', sentAtMs: 1, event: { v, type: 'journal.entry', entry: {} } },
    { v, type: 'link.event', sentAtMs: 1, event: { v, type: 'engine.health' } },
    { v, type: 'link.event', sentAtMs: 1, event: { v, type: 'journal.entries', entries: [] } },
    { v, type: 'link.event', sentAtMs: 1, event: { v, type: 'made.up' } },
    { v, type: 'link.event', sentAtMs: 1, event: { v, type: 'transition.scheduled', spinStartAtMs: 1 } },
    { v, type: 'link.event', sentAtMs: 1, event: { v, type: 'state', pause: 5, interval: null, schedule: { gameEndMs: 9 } } },
    // Pausa says whether phones show it (D135).
    { v, type: 'link.event', sentAtMs: 1, event: { v, type: 'state', pause: { sinceMs: 3 }, interval: null, schedule: { gameEndMs: 9 }, transition: null, suspense: null } },
    // The timed Check is gone (step 2).
    { v, type: 'link.event', sentAtMs: 1, event: { v, type: 'check.scheduled', check: { cardId: 4, kind: 'bingo' } } },
    { v, type: 'link.event', sentAtMs: 1, event: { v, type: 'check.started', check: { cardId: 4, kind: 'house' } } },
    { v, type: 'cloud.ack', sentAtMs: 1 },
  ];
  for (const message of bad) assert.equal(checkLinkMessage(message).ok, false, JSON.stringify(message));
});

test('cloud messages are recognised on the laptop', () => {
  assert.ok(isCloudMessage({ v, type: 'cloud.ack', gameId: 'g', ackSeq: 3, nowMs: 1 }));
  assert.equal(isCloudMessage({ v, type: 'public.state' }), false);
  assert.equal(isCloudMessage({ v: 2, type: 'cloud.ack' }), false);
});

test('the clock offset keeps the smallest delay seen', () => {
  let offset: number | null = null;
  offset = nextClockOffset(offset, 10_120, 10_000);
  offset = nextClockOffset(offset, 20_060, 20_000);
  offset = nextClockOffset(offset, 30_400, 30_000);
  assert.equal(offset, 60);
  assert.equal(toCloudMs(1000.4, offset), 1060);
  assert.equal(toCloudMs(1000, null), 1000);
});
