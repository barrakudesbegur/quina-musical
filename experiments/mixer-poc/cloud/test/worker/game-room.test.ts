// The GameRoom end to end in workerd: the laptop uploads its journal, phones follow the public feed, the snapshot
// survives the GameRoom restarting, and the export replays to the same record.
import { env, evictDurableObject, runDurableObjectAlarm, runInDurableObject, SELF } from 'cloudflare:test';
import { describe, expect, it } from 'vitest';
import { PROTOCOL_VERSION, replayJournal, type JournalEntry } from '@quina/protocol';
import { followFeed, type PublicView } from '@quina/protocol';
import type { CloudMessage, LinkMessage } from '../../src/link-protocol.ts';
import { CLOSE } from '../../src/link-protocol.ts';
import type { EditionExport, RoomStats } from '../../src/api.ts';
import type { GameRoom } from '../../src/game-room.ts';
import { roomOf } from '../../src/worker.ts';
import { JournalBuilder } from '../support/journal-builder.ts';
import { PLAN } from '../support/plan.ts';

const BASE = 'http://localhost';

/** A WebSocket client with a message queue. */
async function connect(path: string) {
  const response = await SELF.fetch(`${BASE}${path}`, { headers: { upgrade: 'websocket' } });
  const ws = response.webSocket;
  if (!ws) throw new Error(`no WebSocket for ${path}: ${response.status} ${await response.text()}`);
  ws.accept();
  const queue: unknown[] = [];
  const waiting: ((message: unknown) => void)[] = [];
  let closed: { code: number; reason: string } | null = null;
  ws.addEventListener('message', (event) => {
    const message: unknown = JSON.parse(String(event.data));
    const waiter = waiting.shift();
    if (waiter) waiter(message);
    else queue.push(message);
  });
  ws.addEventListener('close', (event) => {
    closed = { code: event.code, reason: event.reason };
  });
  return {
    ws,
    get closed() {
      return closed;
    },
    /** The next message (waits up to 2 s). */
    next(): Promise<unknown> {
      const queued = queue.shift();
      if (queued !== undefined) return Promise.resolve(queued);
      return new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error(`no message on ${path}`)), 2000);
        waiting.push((message) => {
          clearTimeout(timer);
          resolve(message);
        });
      });
    },
    /** Everything queued now, after letting pending messages arrive. */
    async drain(): Promise<unknown[]> {
      await new Promise((resolve) => setTimeout(resolve, 50));
      return queue.splice(0);
    },
    send(message: LinkMessage | Record<string, unknown>): void {
      ws.send(JSON.stringify(message));
    },
  };
}

type Client = Awaited<ReturnType<typeof connect>>;

/** A phone following the feed with the shared reducer. */
async function phone(cards = '12,33') {
  const client = await connect(`/feed?cards=${cards}`);
  let view: PublicView | null = null;
  const seen: unknown[] = [];
  const follow = (message: unknown) => {
    seen.push(message);
    const result = followFeed(view, message);
    if (result.kind === 'resync') throw new Error('the phone saw a gap');
    if (result.kind === 'ok') view = result.view;
  };
  follow(await client.next());
  return {
    client,
    /** Every message this phone got. */
    seen,
    async view(): Promise<PublicView> {
      for (const message of await client.drain()) follow(message);
      if (!view) throw new Error('no snapshot');
      return view;
    },
  };
}

const v = PROTOCOL_VERSION;
const now = () => Date.now();

async function laptop(gameId: string | null, lastSeq = 0) {
  const client = await connect('/ws/show');
  client.send({ v, type: 'link.hello', clientId: 'test-laptop', gameId, lastSeq, sentAtMs: now() });
  const welcome = (await client.next()) as CloudMessage;
  expect(welcome.type).toBe('cloud.welcome');
  // The rest of the greeting: how many consoles listen, and the Game plan.
  const greeting = [(await client.next()) as CloudMessage, (await client.next()) as CloudMessage];
  expect(greeting.map((m) => m.type)).toEqual(['cloud.consoles', 'cloud.plan']);
  return { client, welcome, greeting };
}

async function upload(client: Client, gameId: string, entries: readonly unknown[]) {
  client.send({ v, type: 'link.journal', gameId, entries: [...entries], sentAtMs: now() });
  const ack = (await client.next()) as CloudMessage;
  expect(ack.type).toBe('cloud.ack');
  return ack as Extract<CloudMessage, { type: 'cloud.ack' }>;
}

async function getJson<T>(path: string): Promise<T> {
  const response = await SELF.fetch(`${BASE}${path}`);
  expect(response.status).toBe(200);
  return (await response.json()) as T;
}

describe('the laptop and the phones', () => {
  it('a phone gets the snapshot at once, then each landing as it is uploaded', async () => {
    const p = await phone();
    expect((await p.view()).state.edition).toBe('26');
    expect((await p.view()).state.link.online).toBe(false);

    const game = JournalBuilder.sampleGame('g-live');
    const { client, welcome } = await laptop('g-live');
    expect(welcome).toMatchObject({ type: 'cloud.welcome', edition: '26', gameId: 'g-live', ackSeq: 0 });

    const firstLanding = game.entries.findIndex((e) => e.kind === 'song.landed');
    const ack = await upload(client, 'g-live', game.entries.slice(0, firstLanding + 1));
    expect(ack.ackSeq).toBe(firstLanding + 1);
    let view = await p.view();
    expect(view.state.gameId).toBe('g-live');
    expect(view.state.link.online).toBe(true);
    expect(view.state.rounds[0]?.landings).toHaveLength(1);
    const landed = game.entries[firstLanding] as Extract<JournalEntry, { kind: 'song.landed' }>;
    expect(view.state.rounds[0]?.landings[0]?.songId).toBe(landed.songId);

    await upload(client, 'g-live', game.entries.slice(firstLanding + 1));
    view = await p.view();
    expect(view.state.winners).toEqual([
      { round: 1, kind: 'line', cardIds: [33, 77] },
      { round: 1, kind: 'bingo', cardIds: [150] },
    ]);
    expect(JSON.stringify(view)).not.toContain('Àvia Rosa');
    expect(JSON.stringify(view)).not.toContain('"queue"');
  });

  it('resending is harmless, a gap asks for the rest, a different entry is a conflict', async () => {
    const game = JournalBuilder.sampleGame('g-resend');
    const { client } = await laptop('g-resend');
    await upload(client, 'g-resend', game.entries.slice(0, 10));
    expect((await upload(client, 'g-resend', game.entries.slice(0, 10))).ackSeq).toBe(10);

    expect((await upload(client, 'g-resend', game.entries.slice(12, 14))).ackSeq).toBe(10);
    expect(await client.next()).toMatchObject({ type: 'cloud.need', fromSeq: 11 });

    const different = { ...game.entries[5], atMs: 1 };
    expect((await upload(client, 'g-resend', [different])).ackSeq).toBe(10);
    expect(await client.next()).toMatchObject({ type: 'cloud.conflict', seq: 6 });

    const stats = await getJson<RoomStats>('/api/stats');
    expect(stats.duplicates).toBe(10);
    expect(stats.gaps).toBe(1);
    expect(stats.conflicts).toBe(1);
  });

  it('hibernation: the GameRoom wakes from its snapshot, and the same sockets carry on without a gap', async () => {
    const game = JournalBuilder.sampleGame('g-hibernate');
    const { client } = await laptop('g-hibernate');
    await upload(client, 'g-hibernate', game.entries.slice(0, 20));
    const p = await phone();
    const before = await p.view();

    await evictDurableObject(roomOf(env)); // memory gone, hibernated WebSockets kept
    expect((await upload(client, 'g-hibernate', game.entries.slice(20, 30))).ackSeq).toBe(30);
    const after = await p.view(); // followFeed throws on a gap
    expect(after.seq).toBeGreaterThan(before.seq);
    expect(after.state.rounds[0]?.landings.length).toBeGreaterThan(before.state.rounds[0]?.landings.length ?? 0);
  });

  it('a laptop that reconnects after a restart learns where to resume', async () => {
    const game = JournalBuilder.sampleGame('g-resume');
    const first = await laptop('g-resume');
    await upload(first.client, 'g-resume', game.entries.slice(0, 20));

    await evictDurableObject(roomOf(env), { webSockets: 'close' }); // a restart: only SQLite remains
    const second = await laptop('g-resume', 20);
    expect(second.welcome).toMatchObject({ ackSeq: 20 });
    await upload(second.client, 'g-resume', game.entries.slice(20));
    const view = await (await phone()).view();
    expect(view.state.rounds.map((r) => r.number)).toEqual([1, 2]);
  });

  it('a new laptop replaces the old one, which is told not to come back', async () => {
    const old = await laptop(null);
    await laptop(null);
    await old.client.drain();
    expect(old.client.closed?.code).toBe(CLOSE.replaced);
  });

  it('a new Game resets the rounds on the phones; going back to an old Game rebuilds it from its journal', async () => {
    const a = JournalBuilder.sampleGame('g-a');
    const { client } = await laptop('g-a');
    await upload(client, 'g-a', a.entries);
    const p = await phone();

    const b = new JournalBuilder('g-b').startRound().land(2);
    await upload(client, 'g-b', b.entries);
    let view = await p.view();
    expect(view.state.gameId).toBe('g-b');
    expect(view.state.rounds[0]?.landings).toHaveLength(2);
    expect(view.state.winners).toEqual([]);

    client.send({ v, type: 'link.hello', clientId: 'test-laptop', gameId: 'g-a', lastSeq: a.entries.length, sentAtMs: now() });
    expect(await client.next()).toMatchObject({ type: 'cloud.welcome', gameId: 'g-a', ackSeq: a.entries.length });
    expect(await client.next()).toMatchObject({ type: 'cloud.consoles' });
    expect(await client.next()).toMatchObject({ type: 'cloud.plan' });
    view = await p.view();
    expect(view.state.gameId).toBe('g-a');
    expect(view.state.winners).toHaveLength(2);
  });

  it('live events move the Spin; private fields never reach the phones', async () => {
    const game = new JournalBuilder('g-spin').startRound().land(1);
    const { client } = await laptop('g-spin');
    await upload(client, 'g-spin', game.entries);
    const p = await phone();
    const secret = 987_654;
    client.send({
      v,
      type: 'link.event',
      sentAtMs: now(),
      event: { v, type: 'transition.scheduled', id: 't9', to: secret, drum: { removeId: 1, targetId: secret, minLaps: 1 }, spinStartAtMs: now(), landAtMs: now() + 8000 },
    });
    const view = await p.view();
    expect(p.seen).toHaveLength(2); // the snapshot, then the Spin
    expect(JSON.stringify(p.seen)).not.toContain(String(secret));
    expect(view.state.spin?.landAtMs).toBeGreaterThan(now());
  });

  it('a silent laptop is marked offline by the alarm', async () => {
    await laptop(null);
    const p = await phone();
    expect((await p.view()).state.link.online).toBe(true);
    const stub = roomOf(env);
    await runInDurableObject(stub, (_instance: GameRoom, state) => {
      for (const ws of state.getWebSockets('show')) ws.serializeAttachment({ ...(ws.deserializeAttachment() as object), lastSeenMs: 0 });
    });
    expect(await runDurableObjectAlarm(stub)).toBe(true);
    expect((await p.view()).state.link.online).toBe(false);
  });

  it('the laptop must say hello first, and malformed messages are refused, not thrown', async () => {
    const quiet = await connect('/ws/show');
    quiet.send({ v, type: 'link.ping', sentAtMs: now() });
    await quiet.drain();
    expect(quiet.closed?.code).toBe(CLOSE.badHello);

    const { client } = await laptop(null);
    client.ws.send('not json');
    expect(await client.next()).toMatchObject({ type: 'cloud.refused', detail: 'not JSON' });
    client.send({ v, type: 'link.event', sentAtMs: now(), event: { v, type: 'journal.entry', entry: {} } });
    expect(await client.next()).toMatchObject({ type: 'cloud.refused' });
  });
});

describe('consoles through the cloud', () => {
  async function consoleClient(clientId = 'Tauleta-3f2a', role = 'tablet') {
    const client = await connect('/ws/console');
    client.send({ v, type: 'hello', role, clientId });
    return client;
  }
  const clientsIn = (messages: unknown[]) => messages.filter((m) => (m as { type?: string }).type === 'relay.clients').at(-1) as { clients: { role: string; clientId: string }[] } | undefined;

  it('without the laptop: the console sees only itself, and a command is refused as notReady at once', async () => {
    await evictDurableObject(roomOf(env), { webSockets: 'close' }); // no laptop left over from other tests
    const c = await consoleClient();
    expect(clientsIn(await c.drain())?.clients).toEqual([{ role: 'tablet', clientId: 'Tauleta-3f2a' }]);
    c.send({ v, type: 'cmd', cmd: 'next', reqId: 'Tauleta-r-1' });
    expect(await c.next()).toMatchObject({ type: 'command.rejected', reqId: 'Tauleta-r-1', cmd: 'next', reason: 'notReady' });
    c.send({ v, type: 'cmd', cmd: 'setPace', reqId: 'Tauleta-r-2', pace: 'fast' });
    expect(await c.next()).toMatchObject({ type: 'command.rejected', reqId: 'Tauleta-r-2', reason: 'invalid' });
    c.ws.close();
  });

  it('with the laptop: commands go to the link, events come back raw, the client list is merged', async () => {
    const { client: link } = await laptop(null);
    const c = await consoleClient('Mobil-admin-77', 'admin');
    expect(await link.next()).toMatchObject({ type: 'cloud.consoles', count: 1 });

    link.send({ v, type: 'link.event', sentAtMs: now(), event: { v, type: 'relay.clients', clients: [{ role: 'show', clientId: 'show-1' }, { role: 'cloud', clientId: 'laptop-1' }] } });
    await c.drain();
    c.send({ v, type: 'cmd', cmd: 'hold', reqId: 'Mobil-r-1', on: true });
    expect(await link.next()).toMatchObject({ type: 'cloud.command', command: { v, type: 'cmd', cmd: 'hold', reqId: 'Mobil-r-1', on: true } });

    const p = await phone();
    const secret = 424_242;
    link.send({ v, type: 'link.event', sentAtMs: now(), event: { v, type: 'transition.scheduled', id: 't', to: secret, drum: { removeId: 1, targetId: secret, minLaps: 1 }, spinStartAtMs: now(), landAtMs: now() + 5000 } });
    link.send({ v, type: 'link.event', sentAtMs: now(), event: { v, type: 'claim.opened', claim: { claimId: 'cl-1', cardId: 12 } } });
    const got = await c.drain();
    expect(got.map((m) => (m as { type: string }).type)).toEqual(['transition.scheduled', 'claim.opened']);
    expect((got[0] as { to: number }).to).toBe(secret); // consoles see the private fields, as on the relay
    await p.view();
    expect(JSON.stringify(p.seen)).not.toContain(String(secret)); // phones never do

    const fresh = await consoleClient('Tauleta-9');
    const greeting = await fresh.drain();
    expect(clientsIn(greeting)?.clients.map((x) => x.clientId)).toEqual(['show-1', 'laptop-1', 'Mobil-admin-77', 'Tauleta-9']);

    fresh.ws.close();
    c.ws.close();
    await link.drain();
    const stats = await getJson<RoomStats>('/api/stats');
    expect(stats.commandsRelayed).toBeGreaterThanOrEqual(1);
    expect(stats.consolesConnected).toBe(0);
  });

  it('the laptop going offline takes the show off every console', async () => {
    const { client: link } = await laptop(null);
    link.send({ v, type: 'link.event', sentAtMs: now(), event: { v, type: 'relay.clients', clients: [{ role: 'show', clientId: 'show-1' }] } });
    const c = await consoleClient('Tauleta-5');
    expect(clientsIn(await c.drain())?.clients.some((x) => x.role === 'show')).toBe(true);
    link.ws.close();
    await new Promise((resolve) => setTimeout(resolve, 100));
    expect(clientsIn(await c.drain())?.clients.some((x) => x.role === 'show')).toBe(false);
    c.ws.close();
  });

  it('a console may not pretend to be the show, and must say hello first', async () => {
    const impostor = await consoleClient('evil', 'show');
    await impostor.drain();
    expect(impostor.closed?.code).toBe(CLOSE.badHello);
    const rude = await connect('/ws/console');
    rude.send({ v, type: 'cmd', cmd: 'next', reqId: 'x' });
    await rude.drain();
    expect(rude.closed?.code).toBe(CLOSE.badHello);
  });
});

describe('the Game plan and its media (Admin)', () => {
  const put = (body: unknown, url = `${BASE}/api/plan`) => SELF.fetch(url, { method: 'PUT', headers: { 'content-type': 'application/json' }, body: typeof body === 'string' ? body : JSON.stringify(body) });

  it('Admin saves a checked plan; phones and the laptop get it; Admin reads it back', async () => {
    const { client: link } = await laptop(null);
    const p = await phone();
    const bad = await put({ ...PLAN, rounds: 'many' });
    expect(bad.status).toBe(400);
    expect(((await bad.json()) as { errors: string[] }).errors.join()).toContain('plan.rounds');
    expect((await put({ ...PLAN, edition: '25' })).status).toBe(400);
    expect((await put('{not json')).status).toBe(400);

    const saved = await put(PLAN);
    expect(saved.status).toBe(200);
    expect(await getJson('/api/plan')).toEqual({ plan: PLAN });
    expect((await p.view()).state.plan).toEqual(PLAN);
    const messages = await link.drain();
    expect(messages).toContainEqual(expect.objectContaining({ type: 'cloud.plan', plan: PLAN }));

    const { greeting } = await laptop(null); // a laptop connecting later gets it too
    expect(greeting[1]).toMatchObject({ type: 'cloud.plan', plan: PLAN });
  });

  it('logos: uploaded once by content, served immutable and public; only raster images', async () => {
    const webp = new Uint8Array([82, 73, 70, 70, 1, 2, 3, 4, 87, 69, 66, 80]);
    const upload = (bytes: Uint8Array, type: string) => SELF.fetch(`${BASE}/api/media`, { method: 'POST', headers: { 'content-type': type }, body: bytes });
    const first = await upload(webp, 'image/webp');
    expect(first.status).toBe(201);
    const { path } = (await first.json()) as { path: string };
    expect(path).toMatch(/^\/media\/[0-9a-f]{32}\.webp$/);
    expect(((await (await upload(webp, 'image/webp')).json()) as { path: string }).path).toBe(path);

    const served = await SELF.fetch(`https://quina.example${path}`); // public, from anywhere
    expect(served.status).toBe(200);
    expect(served.headers.get('content-type')).toBe('image/webp');
    expect(served.headers.get('cache-control')).toContain('immutable');
    expect(served.headers.get('x-content-type-options')).toBe('nosniff');
    expect(new Uint8Array(await served.arrayBuffer())).toEqual(webp);

    expect((await upload(new TextEncoder().encode('<svg onload="alert(1)"/>'), 'image/svg+xml')).status).toBe(415);
    expect((await upload(new Uint8Array(0), 'image/png')).status).toBe(413);
    expect((await upload(new Uint8Array(400 * 1024), 'image/png')).status).toBe(413);
    expect((await SELF.fetch(`${BASE}/media/${'0'.repeat(32)}.webp`)).status).toBe(404);
    expect((await SELF.fetch(`${BASE}/media/not-a-hash.webp`)).status).toBe(404);
  });

  it('only organizers may change the plan or upload; methods are checked', async () => {
    expect((await put(PLAN, 'https://quina.example/api/plan')).status).toBe(403);
    expect((await SELF.fetch('https://quina.example/api/media', { method: 'POST', body: 'x' })).status).toBe(403);
    expect((await SELF.fetch(`${BASE}/api/media`)).status).toBe(405);
    expect((await SELF.fetch(`${BASE}/api/plan`, { method: 'DELETE' })).status).toBe(405);
  });
});

describe("a new laptop, and Admin's manual resume", () => {
  /** Three full rounds: more than one 200-entry chunk. */
  function longGame(gameId: string) {
    const b = new JournalBuilder(gameId);
    for (let r = 0; r < 3; r++) b.startRound().land(77);
    return b;
  }

  it("the welcome names the cloud's current Game, and a fetch sends it back in chunks", async () => {
    const game = longGame('g-long');
    const { client } = await laptop('g-long');
    for (let i = 0; i < game.entries.length; i += 200) await upload(client, 'g-long', game.entries.slice(i, i + 200));
    const fresh = await laptop(null);
    expect(fresh.welcome).toMatchObject({ gameId: null, ackSeq: 0, current: { gameId: 'g-long', seq: game.entries.length } });

    fresh.client.send({ v, type: 'link.fetch', gameId: 'g-long', fromSeq: 1, sentAtMs: now() });
    const chunks: Extract<CloudMessage, { type: 'cloud.journal' }>[] = [];
    while (!chunks.at(-1)?.done) chunks.push((await fresh.client.next()) as Extract<CloudMessage, { type: 'cloud.journal' }>);
    expect(chunks.length).toBe(2);
    expect(chunks.flatMap((c) => c.entries)).toEqual(game.entries);

    fresh.client.send({ v, type: 'link.fetch', gameId: 'g-nothing', fromSeq: 1, sentAtMs: now() });
    expect(await fresh.client.next()).toMatchObject({ type: 'cloud.journal', gameId: 'g-nothing', entries: [], done: true });
  });

  it('Admin lists the Games and resumes one: it becomes current, and its journal goes to the laptop', async () => {
    const a = JournalBuilder.sampleGame('g-rehearsal');
    const b = new JournalBuilder('g-night').startRound().land(4);
    const { client } = await laptop('g-rehearsal');
    await upload(client, 'g-rehearsal', a.entries);
    await upload(client, 'g-night', b.entries);
    const { games } = await getJson<{ games: { gameId: string; seq: number; rounds: number; current: boolean }[] }>('/api/games');
    expect(games.find((g) => g.gameId === 'g-night')).toMatchObject({ seq: b.entries.length, rounds: 1, current: true });
    expect(games.find((g) => g.gameId === 'g-rehearsal')).toMatchObject({ seq: a.entries.length, rounds: 2, current: false });

    const p = await phone();
    const missing = await SELF.fetch(`${BASE}/api/resume`, { method: 'POST', body: JSON.stringify({ gameId: 'g-nope' }) });
    expect(missing.status).toBe(404);
    expect((await SELF.fetch(`${BASE}/api/resume`, { method: 'POST', body: '{}' })).status).toBe(400);

    await client.drain();
    const resumed = await SELF.fetch(`${BASE}/api/resume`, { method: 'POST', body: JSON.stringify({ gameId: 'g-rehearsal' }) });
    expect(await resumed.json()).toEqual({ ok: true, gameId: 'g-rehearsal', seq: a.entries.length, laptopOnline: true });
    const told = await client.drain();
    expect(told[0]).toMatchObject({ type: 'cloud.resume', gameId: 'g-rehearsal', seq: a.entries.length, by: 'dev' });
    expect(told.filter((m) => (m as { type: string }).type === 'cloud.journal').flatMap((m) => (m as { entries: unknown[] }).entries)).toEqual(a.entries);
    expect((await p.view()).state.gameId).toBe('g-rehearsal');
    expect((await SELF.fetch('https://quina.example/api/resume', { method: 'POST', body: '{"gameId":"g-night"}' })).status).toBe(403);
  });
});

describe('the Worker', () => {
  it('serves the export: every Game, replayed with the protocol reducer', async () => {
    const game = JournalBuilder.sampleGame('g-export');
    const { client } = await laptop('g-export');
    await upload(client, 'g-export', game.entries);
    const exported = await getJson<EditionExport>('/api/export');
    expect(exported.edition).toBe('26');
    expect(exported.currentGameId).toBe('g-export');
    const mine = exported.games.find((g) => g.gameId === 'g-export');
    expect(mine?.entries).toEqual(game.entries);
    expect(mine?.record).toEqual(replayJournal(game.entries));
  });

  it('refuses what it should', async () => {
    expect((await SELF.fetch(`${BASE}/feed`)).status).toBe(426);
    expect((await SELF.fetch(`${BASE}/feed?cards=0`, { headers: { upgrade: 'websocket' } })).status).toBe(400);
    expect((await SELF.fetch(`${BASE}/nope`)).status).toBe(404);
    expect((await SELF.fetch(`${BASE}/api/export`, { method: 'POST' })).status).toBe(405);
    // The dev bypass only works on localhost: anywhere else, the admin routes are closed.
    expect((await SELF.fetch('https://quina.example/api/export')).status).toBe(403);
    expect((await SELF.fetch('https://quina.example/ws/show', { headers: { upgrade: 'websocket' } })).status).toBe(403);
    expect((await SELF.fetch('https://quina.example/ws/console', { headers: { upgrade: 'websocket' } })).status).toBe(403);
    expect(await getJson('/api/health')).toEqual({ ok: true, edition: '26' });
  });

  it('a phone that sends something is ignored, and costs only a counter', async () => {
    const p = await phone();
    p.client.ws.send('hello?');
    await p.client.drain();
    const stats = await getJson<RoomStats>('/api/stats');
    expect(stats.phoneMessagesIn).toBeGreaterThanOrEqual(1);
    expect(p.client.closed).toBeNull();
  });
});
