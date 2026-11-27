// The GameRoom end to end in workerd: the laptop uploads its journal, phones follow the public feed, the snapshot
// survives the GameRoom restarting, and the export replays to the same record.
import { env, evictDurableObject, runDurableObjectAlarm, runInDurableObject, SELF } from 'cloudflare:test';
import { describe, expect, it } from 'vitest';
import { PROTOCOL_VERSION, parseResumeToken, publicPlan, replayJournal, type GamePlan, type JournalEntry } from '@quina/protocol';
import { followFeed, type PublicView } from '@quina/protocol';
import type { CloudMessage, LinkMessage } from '../../src/link-protocol.ts';
import { CLOSE } from '../../src/link-protocol.ts';
import type { EditionExport, RoomStats } from '../../src/api.ts';
import type { GameRoom } from '../../src/game-room.ts';
import { roomOf } from '../../src/worker.ts';
import { JournalBuilder } from '../support/journal-builder.ts';
import { PLAN, SECRET_PRIZE } from '../support/plan.ts';

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

  it("the drum's public seeds (D237) reach the phones, and a phone that connects after a restart still gets them", async () => {
    const game = new JournalBuilder('g-seeds').startRound().land(1);
    const drumSeed = (game.entries.find((e) => e.kind === 'round.started') as { drumSeed?: number }).drumSeed;
    expect(typeof drumSeed).toBe('number');
    const { client } = await laptop('g-seeds');
    await upload(client, 'g-seeds', game.entries);
    const p = await phone();
    const secret = 987_654;
    const spinSeed = 4_294_967_295;
    client.send({
      v,
      type: 'link.event',
      sentAtMs: now(),
      event: { v, type: 'transition.scheduled', id: 't7', to: secret, drum: { removeId: 1, targetId: secret, minLaps: 1 }, spinStartAtMs: now(), landAtMs: now() + 8000, spinSeed },
    });
    const view = await p.view();
    expect(view.state.rounds.at(-1)?.drumSeed).toBe(drumSeed);
    expect(view.state.spin?.spinSeed).toBe(spinSeed);
    expect(JSON.stringify(p.seen)).not.toContain(String(secret));

    await evictDurableObject(roomOf(env), { webSockets: 'close' }); // a restart: only SQLite remains
    const late = await (await phone()).view();
    expect(late.state.rounds.at(-1)?.drumSeed).toBe(drumSeed);
    expect(late.state.spin).toMatchObject({ spinSeed });
    expect(JSON.stringify(late)).not.toContain(String(secret));
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
    expect(await getJson('/api/plan')).toEqual({ plan: PLAN, savedAtMs: expect.any(Number) });
    // Phones get only what they may see: round 1's prizes (perRound), round 2 locked, no cheat sheet.
    expect((await p.view()).state.plan).toEqual(publicPlan(PLAN, [1]));
    const messages = await link.drain();
    expect(messages).toContainEqual(expect.objectContaining({ type: 'cloud.plan', plan: PLAN }));

    const { greeting } = await laptop(null); // a laptop connecting later gets it too
    expect(greeting[1]).toMatchObject({ type: 'cloud.plan', plan: PLAN });
  });

  it('a plan stored in an older shape is read as the current one after a restart: v2 card types become each round\'s', async () => {
    expect((await put(PLAN)).status).toBe(200);
    // As a cloud from before card type per round saved it: no round names its card type, `cardTypes` says where
    // each type plays (here the especial cards in every round).
    const older = {
      ...PLAN,
      v: 2,
      rounds: PLAN.rounds.map((r) => ({ number: r.number, kind: r.kind, line: r.line, bingo: r.bingo })),
      cardTypes: [{ type: 'especial', name: 'Cartró especial', color: '#ffd9e8', priceCents: null, rounds: ['normal', 'special'] }],
    };
    await runInDurableObject(roomOf(env), (_room: GameRoom, state) => {
      const body = JSON.parse(String(state.storage.sql.exec('SELECT body FROM snapshot WHERE id = 1').one().body)) as object;
      state.storage.sql.exec('UPDATE snapshot SET body = ? WHERE id = 1', JSON.stringify({ ...body, plan: older }));
    });
    await evictDurableObject(roomOf(env), { webSockets: 'close' }); // a deploy, or the GameRoom waking up

    const { plan } = await getJson<{ plan: GamePlan }>('/api/plan');
    expect(plan.rounds.map((r) => r.cardType)).toEqual(['especial', 'especial']);
    const p = await phone(); // phones get the public plan derived again from it
    expect((await p.view()).state.plan?.rounds.map((r) => r.cardType)).toEqual(['especial', 'especial']);
    expect((await put(PLAN)).status).toBe(200); // leave the test plan for the next tests
  });

  it("an edit phones can't see (a locked round's prize, the cheat sheet) is saved too, and survives a restart", async () => {
    expect((await put(PLAN)).status).toBe(200);
    const edited: GamePlan = {
      ...PLAN,
      rounds: PLAN.rounds.map((r) => (r.number === 2 ? { ...r, bingo: [{ title: 'Una panera', detail: null, sponsorId: 'forn', image: null, headline: true }] } : r)),
      cheatSheet: { ...PLAN.cheatSheet, claimRules: ['Canteu fort'] },
    };
    expect((await put(edited)).status).toBe(200);
    await evictDurableObject(roomOf(env), { webSockets: 'close' }); // a deploy, or the GameRoom waking up
    expect((await getJson<{ plan: GamePlan }>('/api/plan')).plan).toEqual(edited);
    expect((await put(PLAN)).status).toBe(200); // leave the test plan for the next tests
  });

  it("a locked round's prizes never reach the public feed, until the show reveals them", async () => {
    await evictDurableObject(roomOf(env), { webSockets: 'close' });
    const p = await phone();
    expect((await put(PLAN)).status).toBe(200);
    const { client: link } = await laptop('g-secret');
    const view = async () => (await p.view()).state.plan;
    expect((await view())?.rounds).toEqual([
      { number: 1, kind: 'normal', cardType: 'normal', revealed: true, line: PLAN.rounds[0]?.line, bingo: PLAN.rounds[0]?.bingo },
      { number: 2, kind: 'special', cardType: 'especial', revealed: false },
    ]);
    // A locked round shows its kind and card type (both printed on the cards), never its prizes.
    // Nothing of round 2 anywhere in what phones got: not its prize, not its count, nor the cheat sheet.
    const heard = JSON.stringify(p.seen);
    expect(heard).not.toContain(SECRET_PRIZE);
    expect(heard).not.toContain('El primer que canta guanya');
    const late = await phone(); // a phone joining now gets a snapshot: the same filter
    expect(JSON.stringify(late.seen)).not.toContain(SECRET_PRIZE);
    expect(JSON.stringify((await late.view()).state)).not.toContain(SECRET_PRIZE);

    // The show introduces round 2: its prizes go public with the journal entry.
    const game = new JournalBuilder('g-secret').startRound().land(3).reveal(2, 'intro');
    await upload(link, 'g-secret', game.entries);
    await expect.poll(async () => (await view())?.rounds[1]).toMatchObject({ number: 2, revealed: true, bingo: PLAN.rounds[1]?.bingo });

    // allSecret: an intro reveals nothing, only the presenters do.
    expect((await put({ ...PLAN, prizeReveal: 'allSecret' })).status).toBe(200);
    await expect.poll(async () => (await view())?.rounds.map((r) => r.revealed)).toEqual([false, false]);
    expect(JSON.stringify((await late.view()).state)).not.toContain(SECRET_PRIZE); // locked again in what phones hold
    await link.drain(); // the new plan, sent to the laptop
    await upload(link, 'g-secret', new JournalBuilder('g-secret').startRound().land(3).reveal(2, 'intro').reveal(2, 'presenters').entries.slice(game.entries.length));
    await expect.poll(async () => (await view())?.rounds.map((r) => r.revealed)).toEqual([false, true]);

    // Admin and the laptop always have the whole plan.
    expect(((await getJson('/api/plan')) as { plan: { cheatSheet: unknown } }).plan.cheatSheet).toEqual(PLAN.cheatSheet);
  });

  it("consoles get the plan on hello and on every save; a laptop's newer plan wins, an older one doesn't", async () => {
    const plans = (messages: unknown[]) => messages.filter((m) => (m as { type?: string }).type === 'relay.plan') as { plan: { title: string } | null; savedAtMs: number | null }[];
    expect((await put(PLAN)).status).toBe(200);
    const c = await connect('/ws/console');
    c.send({ v, type: 'hello', role: 'admin', clientId: 'Admin-1' });
    const [hello] = plans(await c.drain());
    expect(hello).toMatchObject({ v, plan: PLAN });
    expect(hello?.savedAtMs).toBeTypeOf('number');

    // Admin saves again: the console hears it, never older than before.
    expect((await put({ ...PLAN, title: 'Quina 2' })).status).toBe(200);
    const [saved] = plans(await c.drain());
    expect(saved?.plan?.title).toBe('Quina 2');
    expect(saved?.savedAtMs).toBeGreaterThan(hello?.savedAtMs ?? Infinity);

    // A plan saved on the laptop while the cloud was away, and newer: everyone gets it.
    const { client: link } = await laptop(null);
    const p = await phone();
    link.send({ v, type: 'link.plan', plan: { ...PLAN, title: 'Desada al portàtil' }, savedAtMs: now(), sentAtMs: now() });
    expect(await link.next()).toMatchObject({ type: 'cloud.plan', plan: { title: 'Desada al portàtil' } });
    expect(plans(await c.drain()).at(-1)?.plan?.title).toBe('Desada al portàtil');
    expect((await p.view()).state.plan?.title).toBe('Desada al portàtil');

    // An older one (or the cloud's own plan again) changes nothing: the laptop gets the cloud's back.
    link.send({ v, type: 'link.plan', plan: { ...PLAN, title: 'Antiga' }, savedAtMs: 1000, sentAtMs: now() });
    expect(await link.next()).toMatchObject({ type: 'cloud.plan', plan: { title: 'Desada al portàtil' } });
    expect(plans(await c.drain())).toEqual([]);
    expect(await getJson('/api/plan')).toMatchObject({ plan: { title: 'Desada al portàtil' } });

    // Another edition's plan is refused.
    link.send({ v, type: 'link.plan', plan: { ...PLAN, edition: '25' }, savedAtMs: now(), sentAtMs: now() });
    expect(await link.next()).toMatchObject({ type: 'cloud.refused' });
  });

  it('logos: a PNG or JPEG by content hash, its JPEG XL beside it, public and immutable; never WebP or SVG', async () => {
    const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3, 4]);
    const jxl = new Uint8Array([0xff, 0x0a, 9, 8, 7, 6]);
    const upload = (bytes: Uint8Array, type: string, query = '') => SELF.fetch(`${BASE}/api/media${query}`, { method: 'POST', headers: { 'content-type': type }, body: bytes });
    const attach = (key: string, bytes: Uint8Array) => SELF.fetch(`${BASE}/api/media/${key}.jxl`, { method: 'PUT', headers: { 'content-type': 'image/jxl' }, body: bytes });
    const first = await upload(png, 'image/png', '?name=Croak');
    expect(first.status).toBe(201);
    const { path, key } = (await first.json()) as { path: string; key: string };
    expect(path).toBe(`/media/${key}.png`);
    expect(key).toMatch(/^[0-9a-f]{32}$/);
    expect(((await (await upload(png, 'image/png')).json()) as { path: string }).path).toBe(path);

    // Before its JPEG XL, the .jxl answers with the PNG (so a <picture> never breaks), cached only briefly.
    const early = await SELF.fetch(`https://quina.example/media/${key}.jxl`);
    expect(early.status).toBe(200);
    expect(early.headers.get('content-type')).toBe('image/png');
    expect(early.headers.get('cache-control')).not.toContain('immutable');

    expect((await attach(key, new Uint8Array([1, 2, 3]))).status).toBe(415); // not a JPEG XL
    expect((await attach('0'.repeat(32), jxl)).status).toBe(404); // no fallback with that key
    const attached = await attach(key, jxl);
    expect(attached.status).toBe(201);
    expect(await attached.json()).toEqual({ ok: true, path: `/media/${key}.jxl`, key });

    for (const [ext, type, bytes] of [['png', 'image/png', png], ['jxl', 'image/jxl', jxl]] as const) {
      const served = await SELF.fetch(`https://quina.example/media/${key}.${ext}?v=after`); // public, from anywhere
      expect(served.status).toBe(200);
      expect(served.headers.get('content-type')).toBe(type);
      expect(served.headers.get('cache-control')).toContain('immutable');
      expect(served.headers.get('x-content-type-options')).toBe('nosniff');
      expect(new Uint8Array(await served.arrayBuffer())).toEqual(bytes);
    }

    // Admin's picker: every pair, with its name and both paths.
    const { media } = await getJson<{ media: { key: string; name: string | null; fallback: string; jxl: string; size: number; jxlSize: number | null }[] }>('/api/media');
    expect(media.find((m) => m.key === key)).toMatchObject({ name: 'Croak', fallback: path, jxl: `/media/${key}.jxl`, size: png.length, jxlSize: jxl.length });

    const webp = new Uint8Array([82, 73, 70, 70, 1, 2, 3, 4, 87, 69, 66, 80]);
    expect((await upload(webp, 'image/webp')).status).toBe(415);
    expect((await upload(new Uint8Array([1, 2, 3, 4]), 'image/png')).status).toBe(415); // claims PNG, isn't one
    expect((await upload(new TextEncoder().encode('<svg onload="alert(1)"/>'), 'image/svg+xml')).status).toBe(415);
    expect((await upload(new Uint8Array(0), 'image/png')).status).toBe(413);
    expect((await upload(new Uint8Array(400 * 1024), 'image/png')).status).toBe(413);
    expect((await SELF.fetch(`${BASE}/media/${'0'.repeat(32)}.png`)).status).toBe(404);
    expect((await SELF.fetch(`${BASE}/media/not-a-hash.png`)).status).toBe(404);
  });

  it("the tablet's sliders fold into the plan's volumes, for the next fresh Game; a plan saved elsewhere, or an older Game, can't undo them (D139)", async () => {
    expect((await put(PLAN)).status).toBe(200);
    const { client: link } = await laptop('g-volumes-old');
    // A rehearsal: the presenters tune two sliders, journalled once still.
    const old = new JournalBuilder('g-volumes-old', now() - 60_000).settings().startRound().land(2).settings({ volumes: { master: 90 } });
    const rehearsal = new JournalBuilder('g-volumes', now()).settings().startRound().land(2).settings({ volumes: { master: 80, pausa: 60 } });
    link.send({ v, type: 'link.journal', gameId: 'g-volumes', entries: rehearsal.entries, sentAtMs: now() });
    const heard = await link.drain();
    expect(heard).toContainEqual(expect.objectContaining({ type: 'cloud.ack', ackSeq: rehearsal.entries.length }));
    expect(heard).toContainEqual(expect.objectContaining({ type: 'cloud.plan', plan: expect.objectContaining({ volumes: { master: 80, pausa: 60 } }) }));
    expect((await getJson<{ plan: GamePlan }>('/api/plan')).plan.volumes).toEqual({ master: 80, pausa: 60 });
    const p = await phone();
    expect(JSON.stringify((await p.view()).state.plan)).not.toContain('volumes'); // phones never get them

    // An older Game's journal, uploaded late (the spare laptop), doesn't undo them.
    link.send({ v, type: 'link.journal', gameId: 'g-volumes-old', entries: old.entries, sentAtMs: now() });
    expect(await link.drain()).toContainEqual(expect.objectContaining({ type: 'cloud.ack', ackSeq: old.entries.length }));
    expect((await getJson<{ plan: GamePlan }>('/api/plan')).plan.volumes).toEqual({ master: 80, pausa: 60 });

    // Admin saves its copy, from before the sliders moved: the volumes stay; the answer says so.
    const saved = await put({ ...PLAN, title: 'Quina amb volums' });
    expect(((await saved.json()) as { plan: GamePlan }).plan.volumes).toEqual({ master: 80, pausa: 60 });
    link.send({ v, type: 'link.plan', plan: { ...PLAN, volumes: { master: 5 } }, savedAtMs: now(), sentAtMs: now() });
    await link.drain();
    await evictDurableObject(roomOf(env), { webSockets: 'close' }); // and they're saved
    expect((await getJson<{ plan: GamePlan }>('/api/plan')).plan).toMatchObject({ title: PLAN.title, volumes: { master: 80, pausa: 60 } });

    // Leave the test plan as it was for the next tests: without volumes.
    await runInDurableObject(roomOf(env), (_room: GameRoom, state) => {
      const body = JSON.parse(String(state.storage.sql.exec('SELECT body FROM snapshot WHERE id = 1').one().body)) as { plan: GamePlan };
      const { volumes: _volumes, ...plan } = body.plan;
      state.storage.sql.exec('UPDATE snapshot SET body = ? WHERE id = 1', JSON.stringify({ ...body, plan, volumesAtMs: null }));
    });
    await evictDurableObject(roomOf(env), { webSockets: 'close' });
  });

  it('only organizers may change the plan or upload; methods are checked', async () => {
    expect((await put(PLAN, 'https://quina.example/api/plan')).status).toBe(403);
    expect((await SELF.fetch('https://quina.example/api/media', { method: 'POST', body: 'x' })).status).toBe(403);
    expect((await SELF.fetch(`${BASE}/api/media`, { method: 'DELETE' })).status).toBe(405);
    expect((await SELF.fetch('https://quina.example/api/media')).status).toBe(403);
    expect((await SELF.fetch(`https://quina.example/api/media/${'0'.repeat(32)}.jxl`, { method: 'PUT', body: 'x' })).status).toBe(403);
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

  it("an accepted claim whose Check didn't pass is flagged in Admin's Games and the export, never refused", async () => {
    const b = new JournalBuilder('g-flagged').startRound().land(6);
    const ok = b.claim(12, 'line');
    b.decide(ok, 'valid', 'complete');
    const odd = b.claim(34, 'bingo');
    b.decide(odd, 'valid', 'incomplete').note(odd, null, null, '17');
    const { client } = await laptop('g-flagged');
    const ack = await upload(client, 'g-flagged', b.entries);
    expect(ack.ackSeq).toBe(b.entries.length); // taken whole: the cloud flags, it doesn't refuse
    const { games } = await getJson<{ games: { gameId: string; flaggedDecisions: { cardId: number; kind: string; outcome: string }[] }[] }>('/api/games');
    expect(games.find((g) => g.gameId === 'g-flagged')?.flaggedDecisions).toMatchObject([{ cardId: 34, kind: 'bingo', outcome: 'incomplete' }]);
    const exported = await getJson<EditionExport>('/api/export');
    expect(exported.games.find((g) => g.gameId === 'g-flagged')?.flaggedDecisions).toHaveLength(1);
    // The slip is kept with the winner, and never public.
    expect(exported.games.find((g) => g.gameId === 'g-flagged')?.record?.winners.find((w) => w.cardId === 34)).toMatchObject({ slip: '17' });
    expect(JSON.stringify(exported.publicState)).not.toContain('"slip"');
  });

  it('Admin lists the Games and resumes one: it becomes current, and its journal goes to the laptop', async () => {
    const a = JournalBuilder.sampleGame('g-rehearsal');
    const b = new JournalBuilder('g-night').startRound('normal', undefined, 'groc', 2).land(4); // this year's own card type, its side 2 (D178)
    const { client } = await laptop('g-rehearsal');
    await upload(client, 'g-rehearsal', a.entries);
    await upload(client, 'g-night', b.entries);
    const { games } = await getJson<{ games: { gameId: string; seq: number; rounds: number; current: boolean }[] }>('/api/games');
    expect(games.find((g) => g.gameId === 'g-night')).toMatchObject({
      seq: b.entries.length,
      rounds: 1,
      current: true,
      resumePoint: { round: 1, kind: 'normal', cardType: 'groc', side: 2, shuffleSeed: 100, shuffleAttempts: 0, position: 3, lastSongId: b.queue[3], lineConfirmedFrom: null },
    });
    const night = games.find((g) => g.gameId === 'g-night') as unknown as { resumePoint: { text: string } };
    // The code carries the card type and the side, since the round's valid cards and its Queue depend on them.
    expect(parseResumeToken(night.resumePoint.text)).toMatchObject({ round: 1, cardType: 'groc', side: 2, position: 3, shuffleSeed: 100, lastSongId: b.queue[3] });
    expect(games.find((g) => g.gameId === 'g-rehearsal')).toMatchObject({ seq: a.entries.length, rounds: 2, current: false, resumePoint: null });

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

describe('the media sync (R2, content-addressed: D248)', () => {
  const enc = (text: string) => new TextEncoder().encode(text);
  const sha = async (bytes: Uint8Array) => [...new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))].map((b) => b.toString(16).padStart(2, '0')).join('');
  const putBlob = (sha256: string, bytes: Uint8Array, url = BASE) => SELF.fetch(`${url}/api/sync/blobs/${sha256}`, { method: 'PUT', headers: { 'content-length': String(bytes.length) }, body: bytes });
  const putManifest = (repertoire: string, body: unknown, url = BASE) => SELF.fetch(`${url}/api/sync/manifests/${repertoire}`, { method: 'PUT', body: JSON.stringify(body) });
  const manifestOf = (repertoire: string, files: Record<string, { size: number; sha256: string }>) => ({ v: 3, repertoire, files, updatedAtMs: 5 });
  const prune = (hashes: unknown) => SELF.fetch(`${BASE}/api/sync/prune`, { method: 'POST', body: JSON.stringify({ sha256: hashes }) });
  /** Every blob the bucket lists, paging with the cursor. */
  const listed = async () => {
    const all = new Map<string, number>();
    let cursor: string | null = null;
    do {
      const page: { blobs: { sha256: string; size: number }[]; cursor: string | null } = await getJson(`/api/sync/blobs${cursor ? `?cursor=${encodeURIComponent(cursor)}` : ''}`);
      for (const b of page.blobs) all.set(b.sha256, b.size);
      cursor = page.cursor;
    } while (cursor);
    return all;
  };

  it('stores a blob only under its own SHA-256, and gives it back, never cached', async () => {
    const bytes = enc('fLaC pretend audio');
    const digest = await sha(bytes);
    expect((await putBlob(digest, bytes)).status).toBe(200);
    const back = await SELF.fetch(`${BASE}/api/sync/blobs/${digest}`);
    expect(back.status).toBe(200);
    expect(back.headers.get('cache-control')).toBe('no-store');
    expect(new Uint8Array(await back.arrayBuffer())).toEqual(bytes);
    expect((await listed()).get(digest)).toBe(bytes.length);
    // Other bytes under that hash, or these under another: R2 refuses them, so a key never holds other bytes.
    expect((await putBlob(digest, enc('something else'))).status).toBe(400);
    expect((await putBlob('0'.repeat(64), bytes)).status).toBe(400);
    expect(new Uint8Array(await (await SELF.fetch(`${BASE}/api/sync/blobs/${digest}`)).arrayBuffer())).toEqual(bytes);
    expect((await SELF.fetch(`${BASE}/api/sync/blobs/${'1'.repeat(64)}`)).status).toBe(404);
  });

  it('refuses odd hashes, odd repertoire names, wrong methods and anyone but the laptop', async () => {
    for (const path of ['/api/sync/blobs/ABC', `/api/sync/blobs/${'a'.repeat(63)}`, `/api/sync/blobs/${'a'.repeat(64)}/x`, '/api/sync/manifests/Bad%20Pool', '/api/sync/manifests/x.json', '/api/sync/default/manifest', '/api/sync/x']) {
      expect((await SELF.fetch(`${BASE}${path}`)).status, path).toBe(404);
    }
    expect((await SELF.fetch(`${BASE}/api/sync`, { method: 'PUT', body: '{}' })).status).toBe(405);
    expect((await SELF.fetch(`${BASE}/api/sync/blobs/${'a'.repeat(64)}`, { method: 'DELETE' })).status).toBe(405);
    expect((await SELF.fetch(`${BASE}/api/sync/prune`)).status).toBe(405);
    expect((await SELF.fetch('https://quina.example/api/sync/manifests/default')).status).toBe(403);
  });

  it('keeps one manifest per repertoire: v3, checked, and only once every blob it names is in the bucket', async () => {
    expect((await SELF.fetch(`${BASE}/api/sync/manifests/m-test`)).status).toBe(404);
    const bytes = enc('cover for the manifest test');
    const digest = await sha(bytes);
    const file = { size: bytes.length, sha256: digest };
    const manifest = manifestOf('m-test', { 'covers/1.jpg': file, 'cache/12/mix.flac': file });
    const missing = await putManifest('m-test', manifest);
    expect(missing.status).toBe(409);
    expect(((await missing.json()) as { missing: string[] }).missing).toEqual([digest]);
    expect((await SELF.fetch(`${BASE}/api/sync/manifests/m-test`)).status).toBe(404);
    expect((await putBlob(digest, bytes)).status).toBe(200);
    const saved = await putManifest('m-test', manifest);
    expect(saved.status).toBe(200);
    expect(await saved.json()).toEqual({ ok: true, files: 2, blobs: 1 });
    expect(await getJson('/api/sync/manifests/m-test')).toEqual(manifest);
    for (const bad of [
      { ...manifest, v: 2 },
      { ...manifest, repertoire: 'default' },
      manifestOf('m-test', { '../x': file }),
      manifestOf('m-test', { 'covers/1.jpg': { size: 1, sha256: 'A'.repeat(64) } }),
      manifestOf('m-test', { 'covers/1.jpg': file, 'covers/2.jpg': { ...file, size: file.size + 1 } }),
    ]) {
      expect((await putManifest('m-test', bad)).status).toBe(400);
    }
    expect((await SELF.fetch(`${BASE}/api/sync/manifests/m-test`, { method: 'PUT', body: 'not json' })).status).toBe(400);
  });

  it('lists the repertoires and the bucket’s real size; prunes only blobs no manifest names', async () => {
    const shared = enc('the Hold music, in every repertoire');
    const own = enc('a song only p-one has');
    const loose = enc('a replaced placeholder');
    const [s, o, l] = await Promise.all([shared, own, loose].map(sha)) as [string, string, string];
    for (const [digest, bytes] of [[s, shared], [o, own], [l, loose]] as const) expect((await putBlob(digest, bytes)).status).toBe(200);
    expect((await putManifest('p-one', manifestOf('p-one', { 'hold-cache/a.flac': { size: shared.length, sha256: s }, 'cache/1/mix.flac': { size: own.length, sha256: o } }))).status).toBe(200);
    expect((await putManifest('p-two', manifestOf('p-two', { 'hold-cache/a.flac': { size: shared.length, sha256: s } }))).status).toBe(200);

    type Overview = { repertoires: { name: string; files: number; bytes: number; blobs: number }[]; blobs: { count: number; bytes: number }; unnamed: { count: number; bytes: number }; totalBytes: number; freeTierBytes: number };
    const overview = await getJson<Overview>('/api/sync');
    expect(overview.repertoires.filter((r) => r.name.startsWith('p-'))).toEqual([
      { name: 'p-one', files: 2, bytes: shared.length + own.length, blobs: 2, updatedAtMs: 5 },
      { name: 'p-two', files: 1, bytes: shared.length, blobs: 1, updatedAtMs: 5 },
    ]);
    const all = await listed();
    expect(overview.blobs).toEqual({ count: all.size, bytes: [...all.values()].reduce((a, b) => a + b, 0) });
    expect(overview.totalBytes).toBe(overview.blobs.bytes);
    expect(overview.freeTierBytes).toBe(10e9);

    // A blob a manifest names is never deleted, not even in a batch with others.
    const refused = await prune([l, s]);
    expect(refused.status).toBe(409);
    expect(((await refused.json()) as { named: string[] }).named).toEqual([s]);
    expect(all.has(l) && (await listed()).has(l)).toBe(true);
    expect((await prune([])).status).toBe(400);
    expect((await prune(['nope'])).status).toBe(400);
    expect((await prune(Array.from({ length: 1001 }, () => l))).status).toBe(400);
    expect(await (await prune([l])).json()).toEqual({ ok: true, deleted: 1 });
    expect((await listed()).has(l)).toBe(false);

    // Dropping a repertoire (named twice) leaves its blobs for a prune; the shared one stays named by p-two.
    expect((await SELF.fetch(`${BASE}/api/sync/manifests/p-one`, { method: 'DELETE' })).status).toBe(400);
    const dropped = await SELF.fetch(`${BASE}/api/sync/manifests/p-one`, { method: 'DELETE', headers: { 'x-confirm-repertoire': 'p-one' } });
    expect(await dropped.json()).toEqual({ ok: true, existed: true });
    expect((await listed()).has(o)).toBe(true);
    expect((await prune([s])).status).toBe(409);
    expect((await prune([o])).status).toBe(200);
  });

  it('never serves a blob or a manifest publicly: every sync route needs the laptop token, and no public path reads the bucket', async () => {
    const bytes = enc('PRIVATE copyrighted song bytes');
    const digest = await sha(bytes);
    expect((await putBlob(digest, bytes)).status).toBe(200);
    expect((await putManifest('privacy', manifestOf('privacy', { 'cache/1/mix.flac': { size: bytes.length, sha256: digest } }))).status).toBe(200);
    for (const host of ['https://quina.barrakudesbegur.org', 'https://quina-dev.barrakudesbegur.org']) {
      // Without the Access service token (here: not the localhost dev bypass), every sync route is refused.
      for (const [method, path] of [
        ['GET', '/api/sync'],
        ['GET', '/api/sync/blobs'],
        ['GET', `/api/sync/blobs/${digest}`],
        ['PUT', `/api/sync/blobs/${digest}`],
        ['GET', '/api/sync/manifests/privacy'],
        ['PUT', '/api/sync/manifests/privacy'],
        ['DELETE', '/api/sync/manifests/privacy'],
        ['POST', '/api/sync/prune'],
      ] as const) {
        const response = await SELF.fetch(`${host}${path}`, { method, headers: { 'x-confirm-repertoire': 'privacy' }, body: method === 'GET' ? undefined : JSON.stringify({ sha256: [digest] }) });
        expect(response.status, `${method} ${host}${path}`).toBe(403);
        expect(await response.text()).not.toContain('PRIVATE');
      }
      // Paths a public reader might try: the bucket's keys, the public /media/ route (Admin's images, not R2), the player's pages.
      for (const path of [`/blobs/${digest}`, '/manifests/privacy.json', `/media/${digest}`, `/media/${digest.slice(0, 32)}.png`, `/media/${digest.slice(0, 32)}.jxl`, `/26/blobs/${digest}`, `/api/sync/blobs/${digest}.flac`, `/covers/${digest}.jpg`]) {
        const response = await SELF.fetch(`${host}${path}`);
        const body = new Uint8Array(await response.arrayBuffer());
        expect(new TextDecoder().decode(body), `${host}${path}`).not.toContain('PRIVATE');
        expect(body.length === bytes.length && body.every((b, i) => b === bytes[i]), `${host}${path}`).toBe(false);
      }
    }
    // Still there, for the laptop.
    expect(new TextDecoder().decode(await (await SELF.fetch(`${BASE}/api/sync/blobs/${digest}`)).arrayBuffer())).toContain('PRIVATE');
  });
});

describe("Admin and the phones", () => {
  it('Admin sees which cards are open on phones (anonymous), and sends a banner and the sound default', async () => {
    await evictDurableObject(roomOf(env), { webSockets: 'close' });
    const a = await phone('12,33');
    const b = await phone('33');
    expect(await getJson('/api/phones')).toEqual({ phones: 2, cards: [{ card: 12, phones: 1 }, { card: 33, phones: 2 }] });

    const send = (path: string, body: unknown) => SELF.fetch(`${BASE}${path}`, { method: 'PUT', body: JSON.stringify(body) });
    expect((await send('/api/notice', { notice: '  Tornem en 5 minuts  ' })).status).toBe(200);
    expect((await a.view()).state.notice).toBe('Tornem en 5 minuts');
    expect((await send('/api/notice', { notice: 'x'.repeat(201) })).status).toBe(400);
    expect((await send('/api/notice', { notice: null })).status).toBe(200);
    expect((await b.view()).state.notice).toBeNull();
    expect((await send('/api/sounds', { soundsDefault: false })).status).toBe(200);
    expect((await b.view()).state.soundsDefault).toBe(false);
    expect((await send('/api/sounds', { soundsDefault: 'no' })).status).toBe(400);
    // Admin reads them back as the phones have them (its form starts from these, not from its own last send).
    expect((await send('/api/notice', { notice: 'Bar obert' })).status).toBe(200);
    expect(await getJson('/api/notice')).toEqual({ notice: 'Bar obert' });
    expect(await getJson('/api/sounds')).toEqual({ soundsDefault: false });
    expect((await SELF.fetch('https://quina.example/api/notice')).status).toBe(403);
    expect((await SELF.fetch('https://quina.example/api/phones')).status).toBe(403);
    expect((await SELF.fetch('https://quina.example/api/notice', { method: 'PUT', body: '{"notice":"hack"}' })).status).toBe(403);
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

describe("show-night health: today's usage against the free plan", () => {
  it('counts requests, incoming messages, rows and the phones peak, and reports the link', async () => {
    type Health = RoomStats & {
      today: { day: string; requests: number; wsMessagesIn: number; rowsWritten: number; phonesPeak: number; billedRequests: number; level: string; resetAtMs: number; shares: { requests: number } };
      link: { online: boolean; lastSeenAgoMs: number | null; journalDelayMs: number | null };
    };
    const before = await getJson<Health>('/api/stats');
    const { client: link } = await laptop('g-health');
    const p1 = await phone();
    const p2 = await phone();
    await upload(link, 'g-health', new JournalBuilder('g-health', Date.now() - 2_000).startRound().land(2).entries);
    const after = await getJson<Health>('/api/stats');
    expect(after.today.day).toBe(new Date().toISOString().slice(0, 10));
    expect(after.today.requests).toBeGreaterThan(before.today.requests);
    expect(after.today.wsMessagesIn).toBeGreaterThan(before.today.wsMessagesIn);
    expect(after.today.rowsWritten).toBeGreaterThan(0);
    expect(after.today.phonesPeak).toBeGreaterThanOrEqual(2);
    expect(after.today.billedRequests).toBe(after.today.requests + Math.ceil(after.today.wsMessagesIn / 20));
    expect(after.today.level).toBe('ok');
    expect(after.today.resetAtMs).toBeGreaterThan(Date.now());
    expect(after.link.online).toBe(true);
    expect(after.link.journalDelayMs).toBeTypeOf('number');
    // Saved now and then (getStats saves first): a GameRoom that wakes again carries on from that row.
    const saved = await runInDurableObject(roomOf(env), async (_room: GameRoom, state) => state.storage.sql.exec('SELECT body FROM usage WHERE day = ?', after.today.day).toArray());
    expect(JSON.parse(String(saved[0]?.body)).requests).toBeGreaterThanOrEqual(after.today.requests - 1);
    void p1;
    void p2;
  }, 20_000);
});
