// The GameRoom: one Durable Object per edition, the cloud's source of truth for the Game (ADR 0003). It keeps
// every Game's journal in SQLite plus ONE snapshot row (the current Game's record and the public state), takes
// the show laptop's uploads, and feeds the players' phones. I/O only: what to accept and what phones may see
// is decided by the pure modules in domain/ and feed/.
//
// WebSockets use the Hibernation API, so idle phones cost nothing. Phones send nothing; the laptop sends its
// journal, a few live events and a keepalive. An alarm notices a laptop that went silent. Consoles (C2) speak the
// relay protocol on /ws/console: their commands go to the laptop link, the show's events come back to them.
//
// SQLite: `journal` (game_id, seq) → canonical entry JSON, and `snapshot` (one row). On wake the GameRoom reads
// the snapshot only; it reads a Game's history back only to switch to another Game or to export.
import { DurableObject } from 'cloudflare:workers';
import {
  PROTOCOL_VERSION,
  checkCommand,
  checkGamePlan,
  publicPlan,
  revealedRounds,
  formatResumeToken,
  emptyRecord,
  extendJournal,
  replayJournal,
  type CommandRejected,
  type GamePlan,
  type PublicPlan,
  type GameRecord,
  type JournalEntry,
  type RelayClients,
  type RelayPlan,
  type ResumeToken,
} from '@quina/protocol';
import type { AccessEnv } from './access.ts';
import type { EditionExport, GameSummary, MediaItem, MediaSave, PhonesNow, PlanSave, ResumeResult, RoomStats, SettingSave } from './api.ts';
import { CLOUD } from './config.ts';
import { nextClockOffset, toCloudMs } from './domain/clock.ts';
import { flaggedDecisions } from './domain/flags.ts';
import { isConsoleRole, mergedClients, type ConsoleRole } from './domain/consoles.ts';
import { UsageCounter, usageReport, type DailyUsage, type UsageReport } from './domain/usage.ts';
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
} from '@quina/protocol';
import { CLOSE, checkLinkMessage, type CloudMessage, type LinkEvent, type LinkFetch, type LinkHello, type LinkJournal, type LinkPlan } from './link-protocol.ts';

/** The header the Worker sets to tell the GameRoom who connected (after Access); never taken from a client. */
export const IDENTITY_HEADER = 'x-quina-identity';

const SCHEMA_VERSION = 1;

interface RoomSnapshot {
  schema: typeof SCHEMA_VERSION;
  /** The current Game's record, or null before the laptop's first Game. */
  game: GameRecord | null;
  /** The public state and its feed position. */
  feed: { seq: number; state: PublicState };
  /**
   * The edition's whole Game plan, as Admin saved it (the public state carries only what phones may see of it:
   * publicPlan, with the locked rounds' prizes left out). Absent in snapshots from before prize secrecy.
   */
  plan?: GamePlan | null;
  /** When `plan` was saved (cloud clock); absent in snapshots from before it was kept. */
  planSavedAtMs?: number | null;
}

interface ShowAttachment {
  role: 'show';
  identity: string;
  clientId: string | null;
  connectedAtMs: number;
  lastSeenMs: number;
  /** Cloud − laptop clock, ms (domain/clock.ts). */
  offsetMs: number | null;
  /** Who is on the laptop's relay, as it last said (kept here so it survives hibernation). */
  relayClients: RelayClients['clients'] | null;
}

interface ConsoleAttachment {
  role: 'console';
  identity: string;
  /** From its hello: 'tablet' or 'admin', and its clientId ('Tauleta-3f2a'); null before the hello. */
  consoleRole: ConsoleRole | null;
  clientId: string | null;
  connectedAtMs: number;
}

interface PhoneAttachment {
  role: 'phone';
  cards: number[];
  connectedAtMs: number;
}

type Attachment = ShowAttachment | PhoneAttachment | ConsoleAttachment;
type SocketTag = Attachment['role'];

type RoomEnv = Env & AccessEnv;

/**
 * The stored plan as this code reads plans. The snapshot keeps the plan as it was saved, so it goes through
 * checkGamePlan again, which reads every older plan version as the current one (v2's `cardTypes` pick each
 * round's `cardType`), and phones' public plan is derived from it again. That only changes anything after a
 * deploy, which drops every WebSocket anyway, so phones reconnect to the new snapshot. Snapshots from before
 * prize secrecy kept the whole plan in the public state: it's taken from there.
 */
function withCurrentPlan(stored: RoomSnapshot): RoomSnapshot {
  const beforeSecrecy = stored.plan === undefined;
  const saved: unknown = beforeSecrecy ? stored.feed.state.plan : stored.plan;
  const check = saved ? checkGamePlan(saved) : null;
  if (check && !check.ok && !beforeSecrecy) {
    // Never lose Admin's plan to a stricter check: keep it as saved until Admin saves it again.
    console.error(`the stored Game plan no longer passes checkGamePlan, kept as saved: ${check.errors.join('; ')}`);
    return stored;
  }
  const plan = check?.ok ? check.plan : null;
  const revealed = plan ? revealedRounds(plan, stored.game?.prizesRevealed ?? []) : [];
  return { ...stored, plan, feed: { ...stored.feed, state: { ...stored.feed.state, plan: plan ? publicPlan(plan, revealed) : null } } };
}

/** Whether the bytes start like the image type they claim (PNG, JPEG, or JPEG XL as a codestream or a container). */
function isImage(bytes: ArrayBuffer, contentType: string): boolean {
  const b = new Uint8Array(bytes, 0, Math.min(12, bytes.byteLength));
  const starts = (...sig: number[]) => sig.every((v, i) => b[i] === v);
  switch (contentType) {
    case 'image/png':
      return starts(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a);
    case 'image/jpeg':
      return starts(0xff, 0xd8, 0xff);
    case 'image/jxl':
      return starts(0xff, 0x0a) || starts(0x00, 0x00, 0x00, 0x0c, 0x4a, 0x58, 0x4c, 0x20, 0x0d, 0x0a, 0x87, 0x0a);
    default:
      return false;
  }
}

export class GameRoom extends DurableObject<RoomEnv> {
  private readonly sql: SqlStorage;
  private room: RoomSnapshot;
  private readonly stats: RoomStats;
  /** The show's last `state`, for a console that connects (memory only: after hibernation, its getState asks again). */
  private lastState: string | null = null;

  /** Today's usage against the free plan's daily limits (domain/usage.ts), saved now and then. */
  private readonly usage: UsageCounter;
  /** How late the laptop's last journal entry reached the cloud (cloud clock), or null before any. */
  private journalDelayMs: number | null = null;

  constructor(ctx: DurableObjectState, env: RoomEnv) {
    super(ctx, env);
    this.sql = ctx.storage.sql;
    this.stats = newStats(Date.now());
    this.migrate();
    this.room = this.load();
    const saved = this.rows('SELECT body FROM usage ORDER BY day DESC LIMIT 1')[0];
    this.usage = new UsageCounter(saved ? (JSON.parse(String(saved.body)) as DailyUsage) : null, Date.now(), (u) => {
      this.rows('INSERT INTO usage (day, body) VALUES (?, ?) ON CONFLICT (day) DO UPDATE SET body = excluded.body', u.day, JSON.stringify(u));
    });
  }

  /** One request into the GameRoom (a WebSocket upgrade, a call from the Worker, an alarm), for today's usage. */
  private counted(): void {
    this.usage?.count('requests', 1, Date.now());
  }

  // ---- connections -------------------------------------------------------------------------------------
  override async fetch(request: Request): Promise<Response> {
    this.counted();
    if (request.headers.get('upgrade')?.toLowerCase() !== 'websocket') return text(426, 'expected a WebSocket');
    const url = new URL(request.url);
    if (url.pathname === '/feed') return this.acceptPhone(url);
    const identity = request.headers.get(IDENTITY_HEADER) ?? 'unknown';
    if (url.pathname === '/ws/show') return this.acceptShow(identity);
    if (url.pathname === '/ws/console') return this.acceptConsole(identity);
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
    this.usage.phones(this.sockets('phone').length, Date.now());
    return new Response(null, { status: 101, webSocket: client });
  }

  private async acceptShow(identity: string): Promise<Response> {
    // One laptop at a time: the newest wins (an old socket may be half-open after a network change).
    for (const old of this.sockets('show')) old.close(CLOSE.replaced, 'another laptop connected');
    const pair = new WebSocketPair();
    const [client, server] = [pair[0], pair[1]];
    const now = Date.now();
    this.ctx.acceptWebSocket(server, ['show']);
    server.serializeAttachment({ role: 'show', identity, clientId: null, connectedAtMs: now, lastSeenMs: now, offsetMs: null, relayClients: null } satisfies ShowAttachment);
    this.stats.showsAccepted += 1;
    this.publish([{ kind: 'link', link: { online: true, sinceMs: now } }]);
    if ((await this.ctx.storage.getAlarm()) === null) await this.ctx.storage.setAlarm(now + CLOUD.showSilenceMs);
    return new Response(null, { status: 101, webSocket: client });
  }

  private acceptConsole(identity: string): Response {
    const pair = new WebSocketPair();
    const [client, server] = [pair[0], pair[1]];
    this.ctx.acceptWebSocket(server, ['console']);
    server.serializeAttachment({ role: 'console', identity, consoleRole: null, clientId: null, connectedAtMs: Date.now() } satisfies ConsoleAttachment);
    this.stats.consolesAccepted += 1;
    return new Response(null, { status: 101, webSocket: client });
  }

  override async webSocketMessage(ws: WebSocket, message: string | ArrayBuffer): Promise<void> {
    this.stats.messagesIn += 1;
    this.usage.count('wsMessagesIn', 1, Date.now());
    const attachment = ws.deserializeAttachment() as Attachment;
    if (attachment.role === 'phone') {
      this.stats.phoneMessagesIn += 1; // phones send nothing; whatever arrives is ignored
      return;
    }
    if (attachment.role === 'console') return this.onConsoleMessage(ws, attachment, message);
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
        return this.onEvent(ws, link, ctx);
      case 'link.fetch':
        return this.onFetch(ws, link);
      case 'link.plan':
        return this.onLinkPlan(ws, link, ctx, now);
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
    if (attachment?.role === 'console') this.consolesChanged(ws);
  }

  override async webSocketError(ws: WebSocket): Promise<void> {
    await this.webSocketClose(ws, 1011, 'error');
  }

  /** The silence check: a laptop that said nothing for CLOUD.showSilenceMs is gone. */
  override async alarm(): Promise<void> {
    this.counted();
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
    const current = this.room.game && this.room.game.seq > 0 ? { gameId: this.room.game.gameId, seq: this.room.game.seq } : null;
    if (hello.gameId !== null && hello.gameId !== this.room.game?.gameId) this.switchGame(hello.gameId);
    const ackSeq = hello.gameId !== null && this.room.game?.gameId === hello.gameId ? this.room.game.seq : 0;
    this.reply(ws, { type: 'cloud.welcome', edition: this.env.EDITION, gameId: hello.gameId, ackSeq, current });
    this.reply(ws, { type: 'cloud.consoles', count: this.consoles().length });
    this.reply(ws, { type: 'cloud.plan', plan: this.room.plan ?? null, savedAtMs: this.planSavedAtMs() });
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
      const last = result.accepted.at(-1)?.entry;
      if (last) this.journalDelayMs = Math.max(0, Date.now() - ctx.toCloudMs(last.atMs));
      if (changes.length > 0) this.broadcast(this.deltaMessage(changes));
      // A round's prizes revealed (prizes.revealed): phones get that round's bundles now.
      if (result.accepted.some(({ entry }) => entry.kind === 'prizes.revealed')) this.refreshPublicPlan();
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

  /** The link's copy is behind: send it a Game's entries from `fromSeq`, in chunks. */
  private onFetch(ws: WebSocket, fetch: LinkFetch): void {
    this.sendJournal(ws, fetch.gameId, fetch.fromSeq);
  }

  private sendJournal(ws: WebSocket, gameId: string, fromSeq: number): void {
    const entries = this.entriesOf(gameId).filter((e) => e.seq >= fromSeq);
    const size = CLOUD.maxEntriesPerUpload;
    for (let i = 0; i === 0 || i < entries.length; i += size) {
      this.reply(ws, { type: 'cloud.journal', gameId, entries: entries.slice(i, i + size), done: i + size >= entries.length });
    }
  }

  private onEvent(ws: WebSocket, link: LinkEvent, ctx: ProjectionContext): void {
    const event = link.event;
    if (event.type === 'relay.clients') {
      const show = ws.deserializeAttachment() as ShowAttachment;
      ws.serializeAttachment({ ...show, relayClients: event.clients } satisfies ShowAttachment);
      return this.sendClients();
    }
    this.publish(projectEvent(this.room.feed.state, event, ctx));
    // Consoles get the show's events raw, as the relay would hand them over.
    const text = JSON.stringify(event);
    if (event.type === 'state') this.lastState = text;
    for (const consoleWs of this.consoles()) this.send(consoleWs, text);
  }

  // ---- consoles ----------------------------------------------------------------------------------------------
  private onConsoleMessage(ws: WebSocket, attachment: ConsoleAttachment, message: string | ArrayBuffer): void {
    if (typeof message !== 'string' || message.length > 64 * 1024) return;
    let parsed: unknown;
    try {
      parsed = JSON.parse(message);
    } catch {
      return;
    }
    const m = parsed as Record<string, unknown> | null;
    if (!m || typeof m !== 'object' || m.v !== PROTOCOL_VERSION) return;
    if (m.type === 'hello') {
      const clientId = typeof m.clientId === 'string' && m.clientId.length > 0 && m.clientId.length <= 60 ? m.clientId : null;
      if (!isConsoleRole(m.role) || !clientId) return ws.close(CLOSE.badHello, 'a console says hello as tablet or admin, with a clientId');
      ws.serializeAttachment({ ...attachment, consoleRole: m.role, clientId } satisfies ConsoleAttachment);
      if (this.lastState) this.send(ws, this.lastState);
      this.send(ws, JSON.stringify(this.planMessage()));
      return this.consolesChanged(null);
    }
    if (m.type !== 'cmd') return;
    if (attachment.clientId === null) return ws.close(CLOSE.badHello, 'say hello first');
    const check = checkCommand(parsed);
    if (!check.ok) return this.rejectCommand(ws, check.reqId, check.cmd, 'invalid', check.error);
    const show = this.sockets('show')[0];
    if (!show) return this.rejectCommand(ws, check.command.reqId, check.command.cmd, 'notReady', 'the show laptop is offline');
    this.reply(show, { type: 'cloud.command', command: check.command });
    this.stats.commandsRelayed += 1;
  }

  private rejectCommand(ws: WebSocket, reqId: string | null, cmd: string | null, reason: CommandRejected['reason'], detail: string): void {
    const rejected: CommandRejected = { v: PROTOCOL_VERSION, type: 'command.rejected', reqId, cmd, reason, detail };
    this.send(ws, JSON.stringify(rejected));
  }

  /** Consoles that said hello. */
  private consoles(except: WebSocket | null = null): WebSocket[] {
    return this.sockets('console').filter((ws) => ws !== except && (ws.deserializeAttachment() as ConsoleAttachment).clientId !== null);
  }

  /** A console came or went: tell the consoles who is here, and the laptop how many listen. */
  private consolesChanged(closing: WebSocket | null): void {
    this.sendClients(closing);
    const count = this.consoles(closing).length;
    for (const show of this.sockets('show')) this.reply(show, { type: 'cloud.consoles', count });
  }

  /** The merged client list (the laptop's relay plus the cloud's consoles) to every console. */
  private sendClients(closing: WebSocket | null = null): void {
    const show = this.sockets('show')[0];
    const relayClients = show ? (show.deserializeAttachment() as ShowAttachment).relayClients : null;
    const consoles = this.consoles(closing).map((ws) => {
      const a = ws.deserializeAttachment() as ConsoleAttachment;
      return { role: a.consoleRole ?? ('tablet' as const), clientId: a.clientId ?? '' };
    });
    const list: RelayClients = { v: PROTOCOL_VERSION, type: 'relay.clients', clients: mergedClients(relayClients, Boolean(show), consoles) };
    const text = JSON.stringify(list);
    for (const ws of this.consoles(closing)) this.send(ws, text);
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
    // Another Game reveals its own rounds: phones see only what this Game revealed.
    state = { ...state, plan: this.publicPlanFor(record) };
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
    this.lastState = null;
    this.sendClients();
  }

  // ---- RPC for the Worker ------------------------------------------------------------------------------
  /** Every Game of the edition, replayed with the protocol's own reducer as a check. */
  exportEdition(): EditionExport {
    this.counted();
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
        return { gameId, entries, record: replayJournal(entries, gameId), error: null, flaggedDecisions: flaggedDecisions(entries) };
      } catch (error) {
        return { gameId, entries, record: null, error: String(error), flaggedDecisions: flaggedDecisions(entries) };
      }
    });
    return { edition: this.env.EDITION, exportedAtMs: Date.now(), currentGameId: this.room.game?.gameId ?? null, games, publicState: this.room.feed.state };
  }

  // ---- the Game plan and its media (Admin) -------------------------------------------------------------
  /** The edition's Game plan. It is all public (prizes, sponsors, schedule), so it lives in the public state. */
  getPlan(): GamePlan | null {
    this.counted();
    return this.room.plan ?? null;
  }

  /** When the plan was saved (cloud clock), or null without one. */
  getPlanSavedAtMs(): number | null {
    return this.planSavedAtMs();
  }

  /** Save the whole plan: checked with the protocol's checkGamePlan, for this edition only. Everyone gets it. */
  setPlan(json: unknown): PlanSave {
    this.counted();
    const check = this.checkPlan(json);
    if (!check.ok) return check;
    // Never older than the plan it replaces, so a laptop's copy saved a moment ago can't win over it.
    this.adoptPlan(check.plan, Math.max(Date.now(), (this.planSavedAtMs() ?? 0) + 1));
    return { ok: true, plan: check.plan };
  }

  /** checkGamePlan, for this edition only. */
  private checkPlan(json: unknown): ReturnType<typeof checkGamePlan> {
    const check = checkGamePlan(json);
    if (!check.ok) return check;
    if (check.plan.edition !== this.env.EDITION) return { ok: false, errors: [`plan.edition: this cloud serves edition ${this.env.EDITION}`] };
    return check;
  }

  private planSavedAtMs(): number | null {
    return this.room.plan ? (this.room.planSavedAtMs ?? 0) : null;
  }

  /** A new plan: the phones (public delta), the laptop (cloud.plan) and the consoles (relay.plan) get it. */
  private adoptPlan(plan: GamePlan, savedAtMs: number): void {
    this.room = { ...this.room, plan, planSavedAtMs: savedAtMs };
    // Saved now, whatever phones see of it: an edit to a locked round's prizes or the cheat sheet changes nothing
    // public, so refreshPublicPlan doesn't save it, and it was lost when the GameRoom restarted.
    this.save();
    this.refreshPublicPlan();
    for (const show of this.sockets('show')) this.reply(show, { type: 'cloud.plan', plan, savedAtMs });
    const text = JSON.stringify(this.planMessage());
    for (const consoleWs of this.consoles()) this.send(consoleWs, text);
  }

  /** The plan for a console, as the relay pushes it to the laptop's screens (protocol RelayPlan). */
  private planMessage(): RelayPlan {
    return { v: PROTOCOL_VERSION, type: 'relay.plan', plan: this.room.plan ?? null, savedAtMs: this.planSavedAtMs() };
  }

  /** What phones may see of the plan for this Game: only the revealed rounds' prizes (plan.ts revealedRounds). */
  private publicPlanFor(record: GameRecord | null): PublicPlan | null {
    const plan = this.room.plan ?? null;
    return plan ? publicPlan(plan, revealedRounds(plan, record?.prizesRevealed ?? [])) : null;
  }

  /** Publish the public plan again if it changed (a new plan, a round's prizes revealed, another Game). */
  private refreshPublicPlan(): void {
    const next = this.publicPlanFor(this.room.game);
    if (JSON.stringify(next) !== JSON.stringify(this.room.feed.state.plan)) this.publish([{ kind: 'plan', plan: next }]);
  }

  /**
   * A plan Admin saved on the laptop's network while the cloud was away. The newest wins: the cloud takes it if
   * it is newer than its own and differs, and otherwise answers with its own, so the laptop's copy follows.
   */
  private onLinkPlan(ws: WebSocket, link: LinkPlan, ctx: ProjectionContext, now: number): void {
    const check = this.checkPlan(link.plan);
    if (!check.ok) return this.refuse(ws, `link.plan: ${check.errors.slice(0, 5).join('; ')}`, null);
    // On the cloud's clock, and never in the future (a laptop with a wrong clock can't pin its plan forever).
    const savedAtMs = Math.min(ctx.toCloudMs(link.savedAtMs), now);
    const own = this.planSavedAtMs();
    const same = JSON.stringify(check.plan) === JSON.stringify(this.room.plan ?? null);
    if (!same && (own === null || savedAtMs > own)) return this.adoptPlan(check.plan, savedAtMs);
    this.reply(ws, { type: 'cloud.plan', plan: this.room.plan ?? null, savedAtMs: own });
  }

  /**
   * Keep an uploaded fallback (PNG or JPEG) under its content hash; the same file twice is stored once (a new
   * name replaces the old). Its JPEG XL comes separately (putMediaJxl).
   */
  async putMedia(bytes: ArrayBuffer, contentType: string, name: string | null = null): Promise<MediaSave> {
    this.counted();
    const ext = CLOUD.media.types[contentType];
    const only = `only ${Object.keys(CLOUD.media.types).join(', ')} (a JPEG XL goes to PUT /api/media/<key>.jxl)`;
    if (!ext) return { ok: false, status: 415, error: only };
    if (bytes.byteLength === 0 || bytes.byteLength > CLOUD.media.maxBytes) return { ok: false, status: 413, error: `files of 1 byte to ${CLOUD.media.maxBytes / 1024} KB` };
    if (!isImage(bytes, contentType)) return { ok: false, status: 415, error: `${only}: these bytes aren't a ${ext.toUpperCase()}` };
    const id = [...new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))].map((b) => b.toString(16).padStart(2, '0')).join('').slice(0, 32);
    const known = this.rows('SELECT id FROM media WHERE id = ?', id).length > 0;
    if (!known) {
      const count = Number(this.rows('SELECT COUNT(*) AS n FROM media')[0]?.n ?? 0);
      if (count >= CLOUD.media.maxFiles) return { ok: false, status: 507, error: `at most ${CLOUD.media.maxFiles} files` };
      this.rows('INSERT INTO media (id, content_type, bytes, at_ms, name) VALUES (?, ?, ?, ?, ?)', id, contentType, bytes, Date.now(), name);
    } else if (name !== null) {
      this.rows('UPDATE media SET name = ? WHERE id = ?', name, id);
    }
    return { ok: true, path: `/media/${id}.${ext}`, key: id };
  }

  /** Attach the JPEG XL to an uploaded fallback (replacing an earlier one). */
  putMediaJxl(id: string, bytes: ArrayBuffer): MediaSave {
    this.counted();
    if (this.rows('SELECT id FROM media WHERE id = ?', id).length === 0) return { ok: false, status: 404, error: 'upload the PNG or JPEG first (POST /api/media)' };
    if (bytes.byteLength === 0 || bytes.byteLength > CLOUD.media.maxBytes) return { ok: false, status: 413, error: `files of 1 byte to ${CLOUD.media.maxBytes / 1024} KB` };
    if (!isImage(bytes, 'image/jxl')) return { ok: false, status: 415, error: 'only image/jxl' };
    this.rows('INSERT INTO media_jxl (id, bytes, at_ms) VALUES (?, ?, ?) ON CONFLICT (id) DO UPDATE SET bytes = excluded.bytes, at_ms = excluded.at_ms', id, bytes, Date.now());
    return { ok: true, path: `/media/${id}.jxl`, key: id };
  }

  /** A stored file: the fallback, or for `jxl` the JPEG XL (`isFallback` when there is none, so the fallback answers). */
  getMedia(id: string, jxl = false): { bytes: ArrayBuffer; contentType: string; isFallback: boolean } | null {
    this.counted();
    if (jxl) {
      const row = this.rows('SELECT bytes FROM media_jxl WHERE id = ?', id)[0];
      if (row) return { bytes: row.bytes as ArrayBuffer, contentType: 'image/jxl', isFallback: false };
    }
    const row = this.rows('SELECT content_type, bytes FROM media WHERE id = ?', id)[0];
    return row ? { bytes: row.bytes as ArrayBuffer, contentType: String(row.content_type), isFallback: jxl } : null;
  }

  /** Every uploaded pair, newest first: Admin's picker. */
  listMedia(): MediaItem[] {
    this.counted();
    const rows = this.rows(
      'SELECT m.id, m.name, m.content_type, length(m.bytes) AS size, m.at_ms, length(j.bytes) AS jxl_size FROM media m LEFT JOIN media_jxl j ON j.id = m.id ORDER BY m.at_ms DESC',
    );
    const exts: Record<string, string> = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp' };
    return rows.map((r) => {
      const key = String(r.id);
      const contentType = String(r.content_type);
      return {
        key,
        name: r.name === null || r.name === undefined ? null : String(r.name),
        fallback: `/media/${key}.${exts[contentType] ?? 'png'}`,
        jxl: `/media/${key}.jxl`,
        contentType,
        size: Number(r.size),
        jxlSize: r.jxl_size === null || r.jxl_size === undefined ? null : Number(r.jxl_size),
        uploadedAtMs: Number(r.at_ms),
      };
    });
  }

  // ---- Games and Admin's manual resume ---------------------------------------------------------------------
  /** Every Game of the edition, newest first (Admin's resume picker). */
  listGames(): GameSummary[] {
    this.counted();
    const rows = this.rows(
      `SELECT game_id, MAX(seq) AS seq, MIN(at_ms) AS first_at, MAX(at_ms) AS last_at,
              COUNT(DISTINCT CASE WHEN kind IN ('round.started', 'round.resumed') THEN json_extract(entry, '$.round') END) AS rounds
       FROM journal GROUP BY game_id ORDER BY last_at DESC`,
    );
    const round = this.room.game?.round ?? null;
    // Only the claims' entries, to flag accepted ones whose Check didn't pass.
    const claims = new Map<string, JournalEntry[]>();
    for (const row of this.rows("SELECT game_id, entry FROM journal WHERE kind IN ('claim.opened', 'claim.decided') ORDER BY game_id, seq")) {
      const list = claims.get(String(row.game_id)) ?? [];
      list.push(JSON.parse(String(row.entry)) as JournalEntry);
      claims.set(String(row.game_id), list);
    }
    return rows.map((r) => {
      const current = String(r.game_id) === this.room.game?.gameId;
      return {
        gameId: String(r.game_id),
        seq: Number(r.seq),
        firstAtMs: Number(r.first_at),
        lastAtMs: Number(r.last_at),
        rounds: Number(r.rounds),
        current,
        resumePoint: current && round ? resumeToken(round) : null,
        flaggedDecisions: flaggedDecisions(claims.get(String(r.game_id)) ?? []),
      };
    });
  }

  /**
   * Admin's manual resume: make `gameId` the current Game and hand its whole journal to the laptop, which keeps
   * it for the show page to resume from. History is never rewritten; to go back in a Game, the show uses Back.
   */
  resumeGame(gameId: string, by: string): ResumeResult {
    this.counted();
    const seq = Number(this.rows('SELECT MAX(seq) AS seq FROM journal WHERE game_id = ?', gameId)[0]?.seq ?? 0);
    if (!seq) return { ok: false, error: `no Game ${gameId} in edition ${this.env.EDITION}` };
    if (this.room.game?.gameId !== gameId) this.switchGame(gameId);
    const show = this.sockets('show')[0];
    if (show) {
      this.reply(show, { type: 'cloud.resume', gameId, seq, by });
      this.sendJournal(show, gameId, 1);
    }
    return { ok: true, gameId, seq, laptopOnline: Boolean(show) };
  }

  // ---- what Admin sees of the phones, and says to them ------------------------------------------------------
  phonesNow(): PhonesNow {
    this.counted();
    const counts = new Map<number, number>();
    const phones = this.sockets('phone');
    for (const ws of phones) for (const card of (ws.deserializeAttachment() as PhoneAttachment).cards) counts.set(card, (counts.get(card) ?? 0) + 1);
    return { phones: phones.length, cards: [...counts].sort((a, b) => a[0] - b[0]).map(([card, n]) => ({ card, phones: n })) };
  }

  setNotice(notice: unknown): SettingSave {
    this.counted();
    if (notice !== null && (typeof notice !== 'string' || notice.trim().length > CLOUD.maxNoticeLength)) {
      return { ok: false, error: `notice must be null or a text of at most ${CLOUD.maxNoticeLength} characters` };
    }
    const text = typeof notice === 'string' && notice.trim() ? notice.trim() : null;
    if (text !== this.room.feed.state.notice) this.publish([{ kind: 'notice', notice: text }]);
    return { ok: true };
  }

  setSoundsDefault(soundsDefault: unknown): SettingSave {
    this.counted();
    if (typeof soundsDefault !== 'boolean') return { ok: false, error: 'soundsDefault must be true or false' };
    if (soundsDefault !== this.room.feed.state.soundsDefault) this.publish([{ kind: 'sounds', soundsDefault }]);
    return { ok: true };
  }

  /** The cloud's clock, edition and current Game (the laptop's preflight). */
  ping(): { nowMs: number; edition: string; current: { gameId: string; seq: number } | null } {
    this.counted();
    const game = this.room.game;
    return { nowMs: Date.now(), edition: this.env.EDITION, current: game && game.seq > 0 ? { gameId: game.gameId, seq: game.seq } : null };
  }

  getStats(): RoomStats & { today: UsageReport; link: { online: boolean; lastSeenAgoMs: number | null; journalDelayMs: number | null } } {
    this.counted();
    const now = Date.now();
    this.usage.flush(now);
    const show = this.sockets('show')[0];
    const lastSeenMs = show ? (show.deserializeAttachment() as ShowAttachment).lastSeenMs : null;
    return {
      ...this.stats,
      phonesConnected: this.sockets('phone').length,
      consolesConnected: this.consoles().length,
      today: usageReport(this.usage.read(now), now),
      link: { online: Boolean(show), lastSeenAgoMs: lastSeenMs === null ? null : now - lastSeenMs, journalDelayMs: this.journalDelayMs },
    };
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
    this.rows('CREATE TABLE IF NOT EXISTS media (id TEXT PRIMARY KEY, content_type TEXT NOT NULL, bytes BLOB NOT NULL, at_ms REAL NOT NULL) WITHOUT ROWID');
    // Added with the JPEG XL pairs: a name for Admin's picker, and each fallback's JXL.
    if (!this.rows('PRAGMA table_info(media)').some((c) => c.name === 'name')) this.rows('ALTER TABLE media ADD COLUMN name TEXT');
    this.rows('CREATE TABLE IF NOT EXISTS media_jxl (id TEXT PRIMARY KEY, bytes BLOB NOT NULL, at_ms REAL NOT NULL) WITHOUT ROWID');
    // Today's usage against the free plan's limits (domain/usage.ts): one row a day, saved now and then.
    this.rows('CREATE TABLE IF NOT EXISTS usage (day TEXT PRIMARY KEY, body TEXT NOT NULL) WITHOUT ROWID');
  }

  private load(): RoomSnapshot {
    const row = this.rows('SELECT body FROM snapshot WHERE id = 1')[0];
    if (row) {
      const stored = JSON.parse(String(row.body)) as RoomSnapshot;
      if (stored.schema === SCHEMA_VERSION) return withCurrentPlan(stored);
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
  private rows(query: string, ...bindings: (string | number | null | ArrayBuffer)[]): Record<string, SqlStorageValue>[] {
    const cursor = this.sql.exec(query, ...bindings);
    const rows = cursor.toArray();
    this.stats.rowsRead += cursor.rowsRead;
    this.stats.rowsWritten += cursor.rowsWritten;
    if (this.usage) {
      const now = Date.now();
      this.usage.count('rowsRead', cursor.rowsRead, now);
      this.usage.count('rowsWritten', cursor.rowsWritten, now);
    }
    return rows;
  }

  // ---- sending -----------------------------------------------------------------------------------------
  private sockets(tag: SocketTag): WebSocket[] {
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

/** Where a round stands, as the engine's `resumeAt` takes it, with its short code. */
function resumeToken(round: NonNullable<GameRecord['round']>): ResumeToken {
  const point = {
    round: round.number,
    kind: round.kind,
    // The round's valid cards, and so its Queue, depend on its card type (formatResumeToken writes it only when
    // it isn't the kind's default).
    cardType: round.cardType,
    shuffleSeed: round.shuffleSeed,
    shuffleAttempts: round.shuffleAttempts,
    position: round.position,
    lastSongId: round.position >= 0 ? (round.queue[round.position] ?? null) : null,
    lineConfirmedFrom: round.climbingTo === 'bingo' ? round.climbFrom : null,
  };
  return { ...point, text: formatResumeToken(point) };
}

function text(status: number, body: string): Response {
  return new Response(`${body}\n`, { status, headers: { 'content-type': 'text/plain; charset=utf-8' } });
}

function newStats(sinceMs: number): RoomStats {
  return {
    sinceMs,
    phonesConnected: 0,
    phonesAccepted: 0,
    consolesConnected: 0,
    consolesAccepted: 0,
    commandsRelayed: 0,
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
