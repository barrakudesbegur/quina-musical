// The show laptop's cloud link: a Node process next to the relay (ADR 0003). It follows the relay like a remote,
// keeps its own copy of the Game journal on disk, uploads it to the edition's GameRoom, and forwards the few
// live events phones need (FORWARDED_EVENT_TYPES; `state` at most every LINK.stateEveryMs). It never sends
// anything to the show except `getJournal`, so a cloud problem can't touch playback.
//
// To the cloud it authenticates with an Access service token (headers, which a browser WebSocket can't set).
// Offline, it keeps journalling to disk; on reconnect the cloud's ackSeq says where to resume.
// Waiting on protocol patch 0001 (folded in by the sound engine session): the relay role `cloud` (until then the
// relay treats this link as an unknown remote, which still gets every event) and `getJournal` /
// `journal.entries` to fill holes (until then only live entries arrive, so start the link before the show).
import WebSocket from 'ws';
import { isEvent, newReqId, PROTOCOL_VERSION, type JournalEntry, type ShowEvent } from '@quina/protocol';
import { LINK } from '../src/config.ts';
import { isForwardedEventType } from '../src/domain/projection.ts';
import { reconnectDelayMs } from '../src/feed/public.ts';
import { CLOSE, isCloudMessage, type CloudMessage, type LinkEvent, type LinkMessage } from '../src/link-protocol.ts';
import { JournalCopy } from './journal-copy.ts';
import { Uploader, type UploaderState } from './uploader.ts';

export interface LinkOptions {
  /** The relay's WebSocket, for example ws://localhost:5174/ws. */
  relayUrl: string;
  /** The GameRoom's laptop endpoint, for example wss://quina-cloud.example.workers.dev/ws/show. */
  cloudUrl: string;
  /** The Access service token headers (CF-Access-Client-Id, CF-Access-Client-Secret); none for wrangler dev. */
  cloudHeaders: Record<string, string>;
  /** Where the journal copy lives. */
  dataDir: string;
  clientId: string;
  log?: (line: string) => void;
  now?: () => number;
  random?: () => number;
  /** Reconnect backoff to the cloud (tests shorten it). */
  reconnectFirstMs?: number;
  reconnectCapMs?: number;
}

export interface LinkStatus {
  relay: boolean;
  cloud: 'connecting' | 'online' | 'offline' | 'replaced';
  gameId: string | null;
  /** Entries 1..n on disk. */
  journalled: number;
  /** The cloud has entries 1..ackSeq. */
  ackSeq: number;
  pending: number;
  uploader: UploaderState;
}

export class CloudLink {
  readonly journal: JournalCopy;
  readonly uploader: Uploader;
  private readonly options: Required<LinkOptions>;
  private relay: WebSocket | null = null;
  private cloud: WebSocket | null = null;
  private cloudState: LinkStatus['cloud'] = 'offline';
  private cloudAttempt = 0;
  private cloudOpenedAtMs = 0;
  private lastSentAtMs = 0;
  private latestState: ShowEvent | null = null;
  private lastStateSentAtMs = 0;
  private stateTimer: NodeJS.Timeout | null = null;
  private retryTimer: NodeJS.Timeout | null = null;
  private relayTimer: NodeJS.Timeout | null = null;
  private tickTimer: NodeJS.Timeout | null = null;
  private lastJournalRequestMs = 0;
  private showConnected = false;
  private running = false;

  constructor(options: LinkOptions) {
    this.options = {
      log: (line) => console.log(line),
      now: Date.now,
      random: Math.random,
      reconnectFirstMs: LINK.reconnectFirstMs,
      reconnectCapMs: LINK.reconnectCapMs,
      ...options,
    };
    this.journal = new JournalCopy(options.dataDir);
    this.uploader = new Uploader(this.journal);
  }

  start(): void {
    this.running = true;
    this.connectRelay();
    this.connectCloud();
    this.tickTimer = setInterval(() => this.tick(), 1000);
  }

  stop(): void {
    this.running = false;
    for (const timer of [this.stateTimer, this.retryTimer, this.relayTimer]) if (timer) clearTimeout(timer);
    if (this.tickTimer) clearInterval(this.tickTimer);
    this.relay?.close();
    this.cloud?.close();
  }

  status(): LinkStatus {
    const gameId = this.journal.currentGameId;
    return {
      relay: this.relay?.readyState === WebSocket.OPEN,
      cloud: this.cloudState,
      gameId,
      journalled: gameId ? this.journal.contiguous(gameId) : 0,
      ackSeq: this.uploader.ackSeq,
      pending: this.uploader.pending(),
      uploader: this.uploader.state,
    };
  }

  // ---- the relay -----------------------------------------------------------------------------------------
  private connectRelay(): void {
    if (!this.running) return;
    const ws = new WebSocket(this.options.relayUrl);
    this.relay = ws;
    ws.on('open', () => {
      this.log('relay: connected');
      ws.send(JSON.stringify({ v: PROTOCOL_VERSION, type: 'hello', role: 'cloud', clientId: this.options.clientId }));
      this.requestJournal(1);
    });
    ws.on('message', (data) => this.onRelayMessage(String(data)));
    ws.on('close', () => {
      if (this.relay === ws) this.relay = null;
      if (!this.running) return;
      this.relayTimer = setTimeout(() => this.connectRelay(), LINK.relayRetryMs);
    });
    ws.on('error', () => ws.close());
  }

  private onRelayMessage(text: string): void {
    let message: unknown;
    try {
      message = JSON.parse(text);
    } catch {
      return;
    }
    // `journal.entries` (getJournal's answer) is read before isEvent knows it (protocol patch 0001).
    const m = message as { v?: unknown; type?: unknown; entries?: unknown };
    if (m?.v === PROTOCOL_VERSION && m.type === 'journal.entries' && Array.isArray(m.entries)) return this.addEntries(m.entries);
    if (!isEvent(message)) return;
    switch (message.type) {
      case 'journal.entry':
        return this.addEntries([message.entry]);
      case 'relay.clients': {
        // The show page (re)connected: it may have journalled while this link wasn't listening.
        const show = message.clients.some((c) => c.role === 'show');
        if (show && !this.showConnected) this.requestJournal(1);
        this.showConnected = show;
        return;
      }
      default:
        if (isForwardedEventType(message.type)) this.forward(message);
    }
  }

  private addEntries(entries: readonly unknown[]): void {
    const before = this.journal.currentGameId;
    for (const entry of entries) {
      const result = this.journal.add(entry);
      if (result === 'conflict') this.log(`journal: a different entry ${String((entry as JournalEntry).seq)} for the same Game arrived; kept the first`);
      if (result === 'invalid') this.log('journal: ignored an entry that fails its check');
    }
    const gameId = this.journal.currentGameId;
    if (gameId && gameId !== before) {
      this.log(`journal: Game ${gameId}`);
      this.sendHello(); // the cloud switches to it and says how much it has
    }
    const missing = gameId ? this.journal.firstMissing(gameId) : null;
    if (missing !== null) this.requestJournal(missing);
    this.pump();
  }

  /** Ask the show for its journal from `fromSeq` (at most every 5 s). */
  private requestJournal(fromSeq: number): void {
    const now = this.options.now();
    if (this.relay?.readyState !== WebSocket.OPEN || now - this.lastJournalRequestMs < 5000) return;
    this.lastJournalRequestMs = now;
    this.relay.send(JSON.stringify({ v: PROTOCOL_VERSION, type: 'cmd', cmd: 'getJournal', reqId: newReqId('link'), fromSeq }));
  }

  // ---- the cloud -----------------------------------------------------------------------------------------
  private connectCloud(): void {
    if (!this.running || this.cloudState === 'replaced') return;
    this.cloudState = 'connecting';
    const ws = new WebSocket(this.options.cloudUrl, { headers: this.options.cloudHeaders });
    this.cloud = ws;
    ws.on('open', () => {
      this.cloudOpenedAtMs = this.options.now();
      this.cloudState = 'online';
      this.log('cloud: connected');
      this.sendHello();
    });
    ws.on('message', (data) => {
      let message: unknown;
      try {
        message = JSON.parse(String(data));
      } catch {
        return;
      }
      if (isCloudMessage(message)) this.onCloudMessage(message);
    });
    ws.on('unexpected-response', (_request, response) => {
      this.log(`cloud: refused with HTTP ${response.statusCode} (check the Access service token)`);
      ws.terminate();
    });
    ws.on('close', (code, reason) => {
      if (this.cloud === ws) this.cloud = null;
      this.uploader.disconnected();
      if (code === CLOSE.replaced) {
        this.cloudState = 'replaced';
        this.log('cloud: another laptop took over; this link stops uploading (restart it to take over again)');
        return;
      }
      this.cloudState = 'offline';
      if (!this.running) return;
      if (this.cloudOpenedAtMs && this.options.now() - this.cloudOpenedAtMs >= LINK.stableAfterMs) this.cloudAttempt = 0;
      this.cloudOpenedAtMs = 0;
      const delay = reconnectDelayMs(this.cloudAttempt++, this.options.random, this.options.reconnectFirstMs, this.options.reconnectCapMs);
      this.log(`cloud: closed (${code}${reason.length ? ` ${String(reason)}` : ''}); retrying in ${(delay / 1000).toFixed(1)} s`);
      this.retryTimer = setTimeout(() => this.connectCloud(), delay);
    });
    ws.on('error', () => {
      // 'close' follows
    });
  }

  private onCloudMessage(message: CloudMessage): void {
    const now = this.options.now();
    switch (message.type) {
      case 'cloud.welcome':
        this.log(`cloud: edition ${message.edition}, Game ${message.gameId ?? '(none)'} at entry ${message.ackSeq}`);
        this.sendUpload(this.uploader.welcome(message.gameId, message.ackSeq, now));
        if (this.latestState) this.sendCloud({ v: PROTOCOL_VERSION, type: 'link.event', event: this.latestState, sentAtMs: now } as LinkEvent);
        return;
      case 'cloud.ack':
        return this.sendUpload(this.uploader.ack(message.gameId, message.ackSeq, now));
      case 'cloud.need':
        return this.sendUpload(this.uploader.need(message.gameId, message.fromSeq, now));
      case 'cloud.conflict':
        this.uploader.stop(`the cloud has a different entry ${message.seq} for Game ${message.gameId}`);
        this.log(`cloud: CONFLICT at entry ${message.seq}: ${message.detail}. Uploads stopped; resume this Game by hand (docs/deploy-plan.md)`);
        return;
      case 'cloud.refused':
        this.log(`cloud: refused: ${message.detail}`);
        if (message.seq !== null) this.uploader.stop(`the cloud refused entry ${message.seq}: ${message.detail}`);
        return;
    }
  }

  private sendHello(): void {
    const gameId = this.journal.currentGameId;
    this.sendCloud({ v: PROTOCOL_VERSION, type: 'link.hello', clientId: this.options.clientId, gameId, lastSeq: gameId ? this.journal.contiguous(gameId) : 0, sentAtMs: this.options.now() });
  }

  private pump(): void {
    this.sendUpload(this.uploader.next(this.options.now()));
  }

  private sendUpload(upload: { gameId: string; entries: JournalEntry[] } | null): void {
    if (upload) this.sendCloud({ v: PROTOCOL_VERSION, type: 'link.journal', gameId: upload.gameId, entries: upload.entries, sentAtMs: this.options.now() });
  }

  /** A live event for the phones: sent now, except `state`, which goes at most every LINK.stateEveryMs. */
  private forward(event: ShowEvent): void {
    if (event.type !== 'state') {
      this.sendCloud({ v: PROTOCOL_VERSION, type: 'link.event', event, sentAtMs: this.options.now() } as LinkEvent);
      return;
    }
    this.latestState = event;
    if (this.stateTimer) return;
    const wait = Math.max(0, this.lastStateSentAtMs + LINK.stateEveryMs - this.options.now());
    this.stateTimer = setTimeout(() => {
      this.stateTimer = null;
      this.lastStateSentAtMs = this.options.now();
      if (this.latestState) this.sendCloud({ v: PROTOCOL_VERSION, type: 'link.event', event: this.latestState, sentAtMs: this.lastStateSentAtMs } as LinkEvent);
    }, wait);
  }

  private sendCloud(message: LinkMessage): void {
    if (this.cloud?.readyState !== WebSocket.OPEN) return; // offline: the journal waits on disk, live events are stale anyway
    this.cloud.send(JSON.stringify(message));
    this.lastSentAtMs = this.options.now();
  }

  /** Every second: resend an unanswered upload, and keep the connection known to be alive. */
  private tick(): void {
    this.pump();
    const now = this.options.now();
    if (this.cloud?.readyState === WebSocket.OPEN && now - this.lastSentAtMs >= LINK.keepaliveMs) {
      this.sendCloud({ v: PROTOCOL_VERSION, type: 'link.ping', sentAtMs: now });
    }
  }

  private log(line: string): void {
    this.options.log(`[cloud-link] ${line}`);
  }
}
