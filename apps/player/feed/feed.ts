// The one interface every feed adapter implements, so the app never knows where its PublicState comes from:
// - CloudFeed: the real thing, the cloud's public WebSocket (production);
// - DevRelayFeed: development only, the relay's engine events projected into PublicState;
// - DemoFeed: `?demo=<fixture>`, the shared fixtures projected the same way.
// Also the pure choice of adapter from the page's URL.
import type { PublicState } from './public.ts';

export type FeedKind = 'cloud' | 'relay' | 'demo';

/** Whether the phone has the feed itself (not the laptop's link: that is `state.link`). */
export interface FeedConnection {
  online: boolean;
  /** Local `Date.now()` of the last change. */
  sinceMs: number;
  /** How long the last outage lasted, once back online (for the "Connectat" pill); 0 when none. */
  lastOutageMs: number;
}

export interface FeedUpdate {
  state: PublicState | null;
  connection: FeedConnection;
}

export interface PlayerFeed {
  readonly kind: FeedKind;
  start(): void;
  stop(): void;
  /** The cloud's clock now (epoch ms): the local clock corrected by the estimated offset. */
  now(): number;
  /** Follow these cards. The cloud counts cards opened on phones; other adapters ignore it. */
  setCards(ids: readonly number[]): void;
  /** Called with every change, and once right away. Returns an unsubscribe function. */
  subscribe(listener: (update: FeedUpdate) => void): () => void;
}

/** Tracks a feed's connection for the FeedConnection it reports. */
export class ConnectionTracker {
  value: FeedConnection;
  private readonly clock: () => number;

  constructor(clock: () => number = Date.now) {
    this.clock = clock;
    this.value = { online: false, sinceMs: clock(), lastOutageMs: 0 };
  }

  /** Returns true when it changed. */
  set(online: boolean): boolean {
    if (online === this.value.online) return false;
    const now = this.clock();
    this.value = { online, sinceMs: now, lastOutageMs: online ? now - this.value.sinceMs : this.value.lastOutageMs };
    return true;
  }
}

export interface FeedChoiceInput {
  search: string;
  hostname: string;
  /** Built for development (Vite's import.meta.env.DEV). */
  dev: boolean;
}

export interface FeedChoice {
  kind: FeedKind;
  /** The fixture for `demo`. */
  demo: string | null;
}

const LOCAL_HOST = /^(localhost|127\.\d+\.\d+\.\d+|\[?::1\]?|10\.\d+\.\d+\.\d+|192\.168\.\d+\.\d+|172\.(1[6-9]|2\d|3[01])\.\d+\.\d+|[a-z0-9-]+\.local)$/i;

/** A development host: this machine or the LAN (a phone testing against the laptop's relay). */
export const isLocalHost = (hostname: string): boolean => LOCAL_HOST.test(hostname);

/** This machine itself (loopback): only the show laptop can open a page here. */
export const isThisMachine = (hostname: string): boolean => /^(localhost|[a-z0-9-]+\.localhost|127\.\d+\.\d+\.\d+|\[?::1\]?)$/i.test(hostname);

/**
 * `?demo=<fixture>` → DemoFeed; `?feed=cloud` → CloudFeed; otherwise CloudFeed.
 * The relay hands out the full private state (the next song, possible winners, the resume code), so:
 * - a development build may use the relay (`?feed=relay`, or by default when served from this machine or the LAN);
 * - a production build uses it only when asked (`?feed=relay`) on this machine itself (the laptop running the
 *   built show with `npm start`, as the end-to-end test does), which already sees everything. On the LAN or in
 *   the cloud a production build never connects to it, whatever the URL says.
 */
export function chooseFeed({ search, hostname, dev }: FeedChoiceInput): FeedChoice {
  const params = new URLSearchParams(search);
  const demo = params.get('demo');
  if (demo) return { kind: 'demo', demo };
  if (!dev) return { kind: params.get('feed') === 'relay' && isThisMachine(hostname) ? 'relay' : 'cloud', demo: null };
  const feed = params.get('feed');
  if (feed === 'relay' || feed === 'cloud') return { kind: feed, demo: null };
  return { kind: isLocalHost(hostname) ? 'relay' : 'cloud', demo: null };
}
