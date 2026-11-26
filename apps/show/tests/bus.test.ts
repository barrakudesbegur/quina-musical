// The show page's bus (engine/src/net/bus.ts): a listener on the page that throws never keeps the remotes, or the
// other listeners, from a message (Backend's e2e, 26 Nov: the stage failing on a Check froze every tablet's state).
import test from 'node:test';
import assert from 'node:assert/strict';
import { Bus, type Transport, type TransportHandlers } from '../engine/src/net/bus.ts';

function fakeTransport() {
  const sent: string[] = [];
  let handlers: TransportHandlers | null = null;
  const transport: Transport = {
    connected: true,
    connect: (h) => {
      handlers = h;
    },
    send: (text) => {
      sent.push(text);
      return true;
    },
  };
  return { transport, sent, receive: (text: string) => handlers?.message(text) };
}

test('a page listener that throws: the message still goes to the relay and to every other listener', () => {
  const bus = new Bus<{ type: string; n: number }>({ role: 'show', clientId: 'show-test' });
  const { transport, sent, receive } = fakeTransport();
  bus.connect(transport);
  const got: unknown[] = [];
  const errors: unknown[] = [];
  const original = console.error;
  console.error = (...args: unknown[]) => errors.push(args);
  try {
    bus.on(() => {
      throw new TypeError("Cannot read properties of undefined (reading 'map')");
    });
    bus.on((m) => got.push(m));
    bus.emit({ type: 'state', n: 1 });
    bus.emit({ type: 'state', n: 2 });
    receive(JSON.stringify({ type: 'cmd', n: 3 }));
  } finally {
    console.error = original;
  }
  assert.deepEqual(sent.map((t) => JSON.parse(t).n), [1, 2], 'both states reached the relay');
  assert.deepEqual(got, [{ type: 'state', n: 1 }, { type: 'state', n: 2 }, { type: 'cmd', n: 3 }], 'the other listener got everything');
  assert.equal(errors.length, 1, 'the same failure is logged once, not on every state');
});
