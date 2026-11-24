// A stand-in for the relay with the show page on it: whoever connects (the laptop's cloud link) gets the journal
// entries and show events the test or the load test plays, as the real relay forwards the engine's events.
import { WebSocketServer, type WebSocket as ServerSocket } from 'ws';
import { PROTOCOL_VERSION, type JournalEntry } from '@quina/protocol';
import { freePort } from './dev-server.ts';

const v = PROTOCOL_VERSION;

export type FakeRelay = Awaited<ReturnType<typeof fakeRelay>>;

/** Start one on a free port. */
export async function fakeRelay() {
  const port = await freePort();
  const server = new WebSocketServer({ port, host: '127.0.0.1' });
  const clients = new Set<ServerSocket>();
  const received: unknown[] = [];
  server.on('connection', (socket) => {
    clients.add(socket);
    socket.on('message', (data) => received.push(JSON.parse(String(data))));
    socket.on('close', () => clients.delete(socket));
  });
  await new Promise((resolve) => server.once('listening', resolve));
  return {
    url: `ws://127.0.0.1:${port}`,
    received,
    emit(message: unknown) {
      for (const socket of clients) socket.send(JSON.stringify(message));
    },
    journal(entries: readonly JournalEntry[]) {
      for (const entry of entries) this.emit({ v, type: 'journal.entry', entry });
    },
    close: () => new Promise<void>((resolve) => server.close(() => resolve())),
  };
}

