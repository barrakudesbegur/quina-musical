// The GameRoom: one Durable Object per edition, the cloud's source of truth for the Game (ADR 0003). It keeps
// every Game's journal in SQLite plus ONE snapshot row (the current Game's record and the public state), takes
// the show laptop's uploads, and feeds the players' phones. I/O only: what to accept and what phones may see
// is decided by the pure modules in domain/ and feed/.
//
// WebSockets use the Hibernation API, so idle phones cost nothing. Phones send nothing; the laptop sends its
// journal, a few live events and a keepalive. An alarm notices a laptop that went silent.
//
// SQLite: `journal` (game_id, seq) → canonical entry JSON, and `snapshot` (one row). On wake the GameRoom reads
// the snapshot only; it reads a Game's history back only to switch to another Game or to export.
import { DurableObject } from 'cloudflare:workers';
import { PROTOCOL_VERSION, emptyRecord, extendJournal, replayJournal, type GameRecord, type JournalEntry } from '@quina/protocol';
import type { AccessEnv } from './access.ts';
import type { EditionExport, RoomStats } from './api.ts';
import { CLOUD } from './config.ts';
import { nextClockOffset, toCloudMs } from './domain/clock.ts';
import { ingest } from './domain/ingest.ts';
import { projectEntry, projectEvent, type ProjectionContext } from './domain/projection.ts';
import {
  applyPublic,
  emptyPublicState,
  newGamePublicState,
  parseCardsParam,
  type PublicChange,
  type PublicDelta,
  type PublicSnapshot,
  type PublicState,
} from './feed/public.ts';
import { CLOSE, checkLinkMessage, type CloudMessage, type LinkEvent, type LinkHello, type LinkJournal } from './link-protocol.ts';

/** The header the Worker sets to tell the GameRoom who connected (after Access); never taken from a client. */
export const IDENTITY_HEADER = 'x-quina-identity';

const SCHEMA_VERSION = 1;

interface RoomSnapshot {
  schema: typeof SCHEMA_VERSION;
  /** The current Game's record, or null before the laptop's first Game. */
  game: GameRecord | null;
  /** The public state and its feed position. */
  feed: { seq: number; state: PublicState };
}

interface ShowAttachment {
  role: 'show';
  identity: string;
  clientId: string | null;
  connectedAtMs: number;
  lastSeenMs: number;
  /** Cloud − laptop clock, ms (domain/clock.ts). */
  offsetMs: number | null;
}

interface PhoneAttachment {
  role: 'phone';
  cards: number[];
  connectedAtMs: number;
}

type Attachment = ShowAttachment | PhoneAttachment;

type RoomEnv = Env & AccessEnv;

export class GameRoom extends DurableObject<RoomEnv> {
  private readonly sql: SqlStorage;
  private room: RoomSnapshot;
  private readonly stats: RoomStats;

  constructor(ctx: DurableObjectState, env: RoomEnv) {
    super(ctx, env);
    this.sql = ctx.storage.sql;
    this.stats = newStats(Date.now());
    this.migrate();
    this.room = this.load();
  }

  // ---- connections -------------------------------------------------------------------------------------
  override async fetch(request: Request): Promise<Response> {
    if (request.headers.get('upgrade')?.toLowerCase() !== 'websocket') return text(426, 'expected a WebSocket');
    const url = new URL(request.url);
    if (url.pathname === '/feed') return this.acceptPhone(url);
    if (url.pathname === '/ws/show') return this.acceptShow(request.headers.get(IDENTITY_HEADER) ?? 'unknown');
    return text(404, 'not found');
  }

  private acceptPhone(url: URL): Response {
    const cards = parseCardsParam(url.searchParams.get('cards'));
    if (!cards) return text(400, 'cards must be up to 30 card numbers, comma-separated');
    const pair = new WebSocketPair();
    const [client, server] = [pair[0], pair[1]];
    this.ctx.acceptWebSocket(server, ['phone']);
    server.serializeAttachment({ role: 'phone', cards, connectedAtMs: Date.now() } satisfies PhoneAttachment);
    this.send(server, this.snapshotMessage());
    this.stats.phonesAccepted += 1;
    return new Response(null, { status: 101, webSocket: client });
  }

  private async acceptShow(identity: string): Promise<Response> {
    // One laptop at a time: the newest wins (an old socket may be half-open after a network change).
    for (const old of this.sockets('show')) old.close(CLOSE.replaced, 'another laptop connected');
    const pair = new WebSocketPair();
    const [client, server] = [pair[0], pair[1]];
    const now = Date.now();
    this.ctx.acceptWebSocket(server, ['show']);
    server.serializeAttachment({ role: 'show', identity, clientId: null, connectedAtMs: now, lastSeenMs: now, offsetMs: null } satisfies ShowAttachment);
    this.stats.showsAccepted += 1;
    this.publish([{ kind: 'link', link: { online: true, sinceMs: now } }]);
    if ((await this.ctx.storage.getAlarm()) === null) await this.ctx.storage.setAlarm(now + CLOUD.showSilenceMs);
    return new Response(null, { status: 101, webSocket: client });
  }

  override async webSocketMessage(ws: WebSocket, message: string | ArrayBuffer): Promise<void> {
    this.stats.messagesIn += 1;
    const attachment = ws.deserializeAttachment() as Attachment;
    if (attachment.role === 'phone') {
      this.stats.phoneMessagesIn += 1; // phones send nothing; whatever arrives is ignored
      return;
    }
    const now = Date.now();
    if (typeof message !== 'string' || message.length > CLOUD.maxLinkMessageBytes) return this.refuse(ws, 'messages must be JSON text of at most 1 MB', null);
    let parsed: unknown;
    try {
      parsed = JSON.parse(message);
    } catch {
      return this.refuse(ws, 'not JSON', null);
    }
    const check = checkLinkMessage(parsed);
    if (!check.ok) return this.refuse(ws, check.error, null);
    const link = check.message;
    const show: ShowAttachment = { ...attachment, lastSeenMs: now, offsetMs: nextClockOffset(attachment.offsetMs, now, link.sentAtMs) };
    if (link.type === 'link.hello') show.clientId = link.clientId;
    else if (show.clientId === null) return ws.close(CLOSE.badHello, 'say link.hello first');
    ws.serializeAttachment(show);

    const ctx: ProjectionContext = { toCloudMs: (ms) => toCloudMs(ms, show.offsetMs) };
    switch (link.type) {
      case 'link.hello':
        return this.onHello(ws, link);
      case 'link.journal':
        return this.onJournal(ws, link, ctx);
      case 'link.event':
        return this.onEvent(link, ctx);
      case 'link.ping':
        return;
    }
  }

  override async webSocketClose(ws: WebSocket, code: number, reason: string): Promise<void> {
    try {
      ws.close(code === 1005 || code === 1006 ? 1000 : code, reason);
    } catch {
      // already closed
    }
    const attachment = ws.deserializeAttachment() as Attachment | null;
    if (attachment?.role === 'show' && this.sockets('show').every((other) => other === ws)) this.markOffline(Date.now());
  }

  override async webSocketError(ws: WebSocket): Promise<void> {
    await this.webSocketClose(ws, 1011, 'error');
  }

  /** The silence check: a laptop that said nothing for CLOUD.showSilenceMs is gone. */
  override async alarm(): Promise<void> {
    const now = Date.now();
    let latest = 0;
    for (const ws of this.sockets('show')) {
      const { lastSeenMs } = ws.deserializeAttachment() as ShowAttachment;
      if (now - lastSeenMs >= CLOUD.showSilenceMs) ws.close(CLOSE.silent, 'silent for too long');
      else latest = Math.max(latest, lastSeenMs);
    }
    if (latest > 0) await this.ctx.storage.setAlarm(latest + CLOUD.showSilenceMs);
    else this.markOffline(now);
  }

  // ---- the laptop's messages ---------------------------------------------------------------------------
  private onHello(ws: WebSocket, hello: LinkHello): void {
    if (hello.gameId !== null && hello.gameId !== this.room.game?.gameId) this.switchGame(hello.gameId);
    const ackSeq = hello.gameId !== null && this.room.game?.gameId === hello.gameId ? this.room.game.seq : 0;
    this.reply(ws, { type: 'cloud.welcome', edition: this.env.EDITION, gameId: hello.gameId, ackSeq });
  }

  private onJournal(ws: WebSocket, upload: LinkJournal, ctx: ProjectionContext): void {
    this.stats.uploads += 1;
    if (upload.entries.length > CLOUD.maxEntriesPerUpload) return this.refuse(ws, `at most ${CLOUD.maxEntriesPerUpload} entries per upload`, null);
    if (upload.gameId !== this.room.game?.gameId) this.switchGame(upload.gameId);
    const game = this.room.game ?? emptyRecord(upload.gameId);
    const result = ingest(game, upload.entries, (seq) => this.storedEntry(upload.gameId, seq));
    this.stats.duplicates += result.duplicates;

    if (result.accepted.length > 0) {
      let state = this.room.feed.state;
      const changes: PublicChange[] = [];
      for (const { entry, record } of result.accepted) {
        const made = projectEntry(state, entry, record, ctx);
        state = applyPublic(state, made);
        changes.push(...made);
      }
      this.ctx.storage.transactionSync(() => {
        for (const { entry, json } of result.accepted) {
          this.rows('INSERT INTO journal (game_id, seq, at_ms, kind, entry) VALUES (?, ?, ?, ?, ?)', entry.gameId, entry.seq, entry.atMs, entry.kind, json);
        }
        this.room = { ...this.room, game: result.record };
        if (changes.length > 0) this.room.feed = { seq: this.room.feed.seq + 1, state };
        this.save();
      });
      this.stats.entriesStored += result.accepted.length;
      if (changes.length > 0) this.broadcast(this.deltaMessage(changes));
    }

    const gameId = upload.gameId;
    this.reply(ws, { type: 'cloud.ack', gameId, ackSeq: result.record.seq });
    const stop = result.stop;
    if (!stop) return;
    switch (stop.kind) {
      case 'gap':
        this.stats.gaps += 1;
        return this.reply(ws, { type: 'cloud.need', gameId, fromSeq: stop.fromSeq });
      case 'conflict':
        this.stats.conflicts += 1;
        console.error(`journal conflict in game ${gameId} at entry ${stop.seq}: ${stop.detail}`);
        return this.reply(ws, { type: 'cloud.conflict', gameId, seq: stop.seq, detail: stop.detail });
      case 'invalid':
        return this.refuse(ws, stop.detail, stop.seq);
    }
  }

  private onEvent(link: LinkEvent, ctx: ProjectionContext): void {
    this.publish(projectEvent(this.room.feed.state, link.event, ctx));
  }

  // ---- the Game ------------------------------------------------------------------------------------------
  /** Make `gameId` the current Game: rebuild its record and public state from its stored entries, if any. */
  private switchGame(gameId: string): void {
    const entries = this.entriesOf(gameId);
    let record = emptyRecord(gameId);
    let state = newGamePublicState(this.room.feed.state, gameId);
    const ctx: ProjectionContext = { toCloudMs: (ms) => toCloudMs(ms, null) };
    try {
      for (const entry of entries) {
        record = extendJournal(record, [entry]);
        state = applyPublic(state, projectEntry(state, entry, record, ctx));
      }
    } catch (error) {
      // The stored journal was checked on the way in, so this should never happen; keep the GameRoom usable.
      console.error(`game ${gameId}: its stored journal does not replay`, error);
    }
    this.room = { ...this.room, game: record, feed: { seq: this.room.feed.seq + 1, state } };
    this.save();
    this.broadcast(this.snapshotMessage());
  }

  /** Apply public changes, store them, and send them to every phone. */
  private publish(changes: PublicChange[]): void {
    if (changes.length === 0) return;
    this.room = { ...this.room, feed: { seq: this.room.feed.seq + 1, state: applyPublic(this.room.feed.state, changes) } };
    this.save();
    this.broadcast(this.deltaMessage(changes));
  }

  private markOffline(now: number): void {
    if (this.room.feed.state.link.online) this.publish([{ kind: 'link', link: { online: false, sinceMs: now } }]);
  }

  // ---- RPC for the Worker ------------------------------------------------------------------------------
  /** Every Game of the edition, replayed with the protocol's own reducer as a check. */
  exportEdition(): EditionExport {
    const rows = this.rows('SELECT game_id, entry FROM journal ORDER BY game_id, seq');
    const byGame = new Map<string, JournalEntry[]>();
    for (const row of rows) {
      const gameId = String(row.game_id);
      const list = byGame.get(gameId) ?? [];
      list.push(JSON.parse(String(row.entry)) as JournalEntry);
      byGame.set(gameId, list);
    }
    const games = [...byGame].map(([gameId, entries]) => {
      try {
        return { gameId, entries, record: replayJournal(entries, gameId), error: null };
      } catch (error) {
        return { gameId, entries, record: null, error: String(error) };
      }
    });
    return { edition: this.env.EDITION, exportedAtMs: Date.now(), currentGameId: this.room.game?.gameId ?? null, games, publicState: this.room.feed.state };
  }

  getStats(): RoomStats {
    return { ...this.stats, phonesConnected: this.sockets('phone').length };
  }

  // ---- storage ---------------------------------------------------------------------------------------------
  private migrate(): void {
    this.rows(`CREATE TABLE IF NOT EXISTS journal (
      game_id TEXT NOT NULL,
      seq INTEGER NOT NULL,
      at_ms REAL NOT NULL,
      kind TEXT NOT NULL,
      entry TEXT NOT NULL,
      PRIMARY KEY (game_id, seq)
    ) WITHOUT ROWID`);
    this.rows('CREATE TABLE IF NOT EXISTS snapshot (id INTEGER PRIMARY KEY CHECK (id = 1), body TEXT NOT NULL)');
  }

  private load(): RoomSnapshot {
    const row = this.rows('SELECT body FROM snapshot WHERE id = 1')[0];
    if (row) {
      const stored = JSON.parse(String(row.body)) as RoomSnapshot;
      if (stored.schema === SCHEMA_VERSION) return stored;
      console.error(`snapshot schema ${String(stored.schema)} is not ${SCHEMA_VERSION}: starting from an empty snapshot`);
    }
    return { schema: SCHEMA_VERSION, game: null, feed: { seq: 0, state: emptyPublicState(this.env.EDITION) } };
  }

  private save(): void {
    this.rows('INSERT INTO snapshot (id, body) VALUES (1, ?) ON CONFLICT (id) DO UPDATE SET body = excluded.body', JSON.stringify(this.room));
  }

  private storedEntry(gameId: string, seq: number): string | null {
    const row = this.rows('SELECT entry FROM journal WHERE game_id = ? AND seq = ?', gameId, seq)[0];
    return row ? String(row.entry) : null;
  }

  private entriesOf(gameId: string): JournalEntry[] {
    return this.rows('SELECT entry FROM journal WHERE game_id = ? ORDER BY seq', gameId).map((row) => JSON.parse(String(row.entry)) as JournalEntry);
  }

  /** Run SQL, count the rows it read and wrote (the free plan's units), and return its result rows. */
  private rows(query: string, ...bindings: (string | number | null)[]): Record<string, SqlStorageValue>[] {
    const cursor = this.sql.exec(query, ...bindings);
    const rows = cursor.toArray();
    this.stats.rowsRead += cursor.rowsRead;
    this.stats.rowsWritten += cursor.rowsWritten;
    return rows;
  }

  // ---- sending -----------------------------------------------------------------------------------------
  private sockets(tag: 'show' | 'phone'): WebSocket[] {
    return this.ctx.getWebSockets(tag).filter((ws) => ws.readyState === WebSocket.OPEN);
  }

  private snapshotMessage(): string {
    const message: PublicSnapshot = { v: PROTOCOL_VERSION, type: 'public.state', seq: this.room.feed.seq, nowMs: Date.now(), state: this.room.feed.state };
    return JSON.stringify(message);
  }

  private deltaMessage(changes: PublicChange[]): string {
    const message: PublicDelta = { v: PROTOCOL_VERSION, type: 'public.delta', seq: this.room.feed.seq, nowMs: Date.now(), changes };
    return JSON.stringify(message);
  }

  private broadcast(text: string): void {
    this.stats.broadcasts += 1;
    for (const ws of this.sockets('phone')) this.send(ws, text);
  }

  private send(ws: WebSocket, text: string): void {
    try {
      ws.send(text);
      this.stats.messagesOut += 1;
    } catch {
      // closing: its webSocketClose cleans up
    }
  }

  private reply(ws: WebSocket, body: DistributiveOmit<CloudMessage, 'v' | 'nowMs'>): void {
    this.send(ws, JSON.stringify({ v: PROTOCOL_VERSION, ...body, nowMs: Date.now() }));
  }

  private refuse(ws: WebSocket, detail: string, seq: number | null): void {
    this.stats.refused += 1;
    this.reply(ws, { type: 'cloud.refused', detail, seq });
  }
}

type DistributiveOmit<T, K extends PropertyKey> = T extends unknown ? Omit<T, K> : never;

function text(status: number, body: string): Response {
  return new Response(`${body}\n`, { status, headers: { 'content-type': 'text/plain; charset=utf-8' } });
}

function newStats(sinceMs: number): RoomStats {
  return {
    sinceMs,
    phonesConnected: 0,
    phonesAccepted: 0,
    showsAccepted: 0,
    messagesIn: 0,
    phoneMessagesIn: 0,
    messagesOut: 0,
    broadcasts: 0,
    uploads: 0,
    entriesStored: 0,
    duplicates: 0,
    gaps: 0,
    conflicts: 0,
    refused: 0,
    rowsRead: 0,
    rowsWritten: 0,
  };
}
