// CloudFeed: the cloud's public WebSocket, `wss://<host>/feed?cards=<ids>`. The phone sends nothing: no
// hello, no heartbeat, no polling (the free tier's budget). It gets a snapshot on every connection, then
// deltas; a seq gap reconnects for a fresh snapshot. Reconnects use full-jitter backoff (1 s doubling to 30 s),
// and coming back to the foreground reconnects after 0–2 s of jitter.
//
// UNTESTED AGAINST THE REAL CLOUD until it is deployed; tests/ui/player/cloud-feed.test.ts drives it with a
// fake socket, and `npx wrangler dev` in cloud/ serves the real endpoint locally (ws://localhost:8787/feed).
import { PLAYER_CONFIG } from '../config.ts';
import { Backoff, resumeDelayMs } from './backoff.ts';
import { ConnectionTracker, type FeedUpdate, type PlayerFeed } from './feed.ts';
import { FeedFollower } from './follow.ts';
import { cardsParam } from './public.ts';

/** The part of a WebSocket the feed uses (a fake one in tests). */
export interface SocketLike {
  readonly readyState: number;
  onopen: (() => void) | null;
  onmessage: ((event: { data: unknown }) => void) | null;
  onclose: (() => void) | null;
  onerror: (() => void) | null;
  close(): void;
}

/** Where page visibility comes from (the document, or a fake). */
export interface VisibilitySource {
  readonly hidden: boolean;
  addEventListener(type: 'visibilitychange', listener: () => void): void;
  removeEventListener(type: 'visibilitychange', listener: () => void): void;
}

export interface Timers {
  set(fn: () => void, ms: number): unknown;
  clear(handle: unknown): void;
}

export interface CloudFeedOptions {
  /** The feed's base URL, for example wss://quina.barrakudesbegur.org/feed. */
  url: string;
  cards?: readonly number[];
  createSocket?: (url: string) => SocketLike;
  random?: () => number;
  timers?: Timers;
  visibility?: VisibilitySource | null;
  clock?: () => number;
}

const OPEN = 1;

/** The feed URL for these cards: `?cards=` unique and sorted (the contract's `cardsParam`), at most maxCards. */
export function cloudFeedUrl(base: string, cards: readonly number[]): string {
  const ids = cards.filter((id) => Number.isInteger(id) && id >= PLAYER_CONFIG.cardIdMin && id <= PLAYER_CONFIG.cardIdMax).slice(0, PLAYER_CONFIG.maxCards);
  if (!ids.length) return base;
  return `${base}${base.includes('?') ? '&' : '?'}cards=${cardsParam(ids)}`;
}

/** The feed's default base URL: /feed on the page's own host. */
export function defaultFeedBase(loc: { protocol: string; host: string }): string {
  return `${loc.protocol === 'https:' ? 'wss' : 'ws'}://${loc.host}/feed`;
}

const browserTimers: Timers = {
  set: (fn, ms) => setTimeout(fn, ms),
  clear: (handle) => clearTimeout(handle as ReturnType<typeof setTimeout>),
};

export class CloudFeed implements PlayerFeed {
  readonly kind = 'cloud' as const;
  private readonly base: string;
  private cards: readonly number[];
  private readonly createSocket: (url: string) => SocketLike;
  private readonly timers: Timers;
  private readonly visibility: VisibilitySource | null;
  private readonly clockNow: () => number;
  private readonly random: () => number;
  private readonly backoff: Backoff;
  private readonly follower = new FeedFollower();
  private readonly connection: ConnectionTracker;
  private readonly listeners = new Set<(update: FeedUpdate) => void>();
  private socket: SocketLike | null = null;
  private retry: unknown = null;
  private retryAtMs = 0;
  private hiddenAtMs: number | null = null;
  private started = false;

  constructor({ url, cards = [], createSocket, random = Math.random, timers = browserTimers, visibility = null, clock = Date.now }: CloudFeedOptions) {
    this.base = url;
    this.cards = [...cards];
    this.createSocket = createSocket ?? ((u) => new WebSocket(u) as unknown as SocketLike);
    this.random = random;
    this.timers = timers;
    this.visibility = visibility;
    this.clockNow = clock;
    this.backoff = new Backoff(random);
    this.connection = new ConnectionTracker(clock);
  }

  /** The URL the next connection uses. */
  get url(): string {
    return cloudFeedUrl(this.base, this.cards);
  }

  /** Failed attempts since the last snapshot (for tests and diagnostics). */
  get attempts(): number {
    return this.backoff.attempt;
  }

  start(): void {
    if (this.started) return;
    this.started = true;
    this.visibility?.addEventListener('visibilitychange', this.onVisibility);
    this.connect();
  }

  stop(): void {
    this.started = false;
    this.visibility?.removeEventListener('visibilitychange', this.onVisibility);
    this.cancelRetry();
    this.drop();
  }

  now(): number {
    return this.follower.now(this.clockNow());
  }

  setCards(ids: readonly number[]): void {
    const next = [...ids];
    if (cardsParam(next) === cardsParam(this.cards)) return;
    this.cards = next;
    if (this.started) this.connect();
  }

  subscribe(listener: (update: FeedUpdate) => void): () => void {
    this.listeners.add(listener);
    listener(this.update());
    return () => void this.listeners.delete(listener);
  }

  private update(): FeedUpdate {
    return { state: this.follower.state, connection: this.connection.value };
  }

  private emit(): void {
    const update = this.update();
    for (const listener of this.listeners) listener(update);
  }

  /** Open a fresh socket, replacing any current one. The last state stays on screen until the new snapshot. */
  private connect(): void {
    this.cancelRetry();
    this.drop();
    const socket = this.createSocket(this.url);
    this.socket = socket;
    socket.onmessage = (event) => {
      if (socket === this.socket) this.receive(String(event.data));
    };
    socket.onclose = () => {
      if (socket !== this.socket) return;
      this.socket = null;
      if (this.connection.set(false)) this.emit();
      if (this.started) this.scheduleRetry(this.backoff.next());
    };
    socket.onerror = () => socket.close();
  }

  private receive(text: string): void {
    const result = this.follower.receiveText(text, this.clockNow());
    if (result === 'resync') {
      // A missed message (or a delta before any snapshot): reconnect for a fresh snapshot, with jitter in
      // case the whole room saw the same gap.
      this.drop();
      this.scheduleRetry(this.backoff.next());
      return;
    }
    if (result !== 'ok') return;
    this.backoff.reset();
    this.connection.set(true);
    this.emit();
  }

  private readonly onVisibility = (): void => {
    if (!this.visibility || !this.started) return;
    const now = this.clockNow();
    if (this.visibility.hidden) {
      this.hiddenAtMs = now;
      return;
    }
    const hiddenFor = this.hiddenAtMs === null ? 0 : now - this.hiddenAtMs;
    this.hiddenAtMs = null;
    const healthy = this.socket?.readyState === OPEN && this.connection.value.online;
    if (healthy && hiddenFor < PLAYER_CONFIG.visibleStaleAfterMs) return;
    const delay = resumeDelayMs(this.random);
    // Only bring a pending retry forward, never push it back.
    if (this.retry !== null && this.retryAtMs <= now + delay) return;
    this.scheduleRetry(delay);
  };

  private scheduleRetry(ms: number): void {
    this.cancelRetry();
    this.retryAtMs = this.clockNow() + ms;
    this.retry = this.timers.set(() => {
      this.retry = null;
      if (this.started) this.connect();
    }, ms);
  }

  private cancelRetry(): void {
    if (this.retry !== null) this.timers.clear(this.retry);
    this.retry = null;
  }

  /** Close the current socket without triggering its retry. */
  private drop(): void {
    const socket = this.socket;
    this.socket = null;
    if (socket) {
      socket.onopen = null;
      socket.onmessage = null;
      socket.onclose = null;
      socket.onerror = null;
      try {
        socket.close();
      } catch {
        // already closed
      }
    }
    if (this.connection.set(false)) this.emit();
  }
}
