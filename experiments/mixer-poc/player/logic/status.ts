// The connection and pause notices. Pure: the clocks are passed in.
// - offline: "Connexió perduda, tornem de seguida", once the laptop's link to the cloud has been down for 20 s,
//   or the phone has had no feed for 20 s. Only while the show is on (not before or after the Game, when a
//   switched-off laptop is normal).
// - pause: the presenters' technical pause, "Tornem de seguida".
// - The reconnect pill: "Reconnectant…" after 3 s without the feed, then "Connectat" for 1 s once it's back.
import { PLAYER_CONFIG } from '../config.ts';
import type { FeedConnection } from '../feed/feed.ts';
import type { PublicState } from '../feed/public.ts';

export type Overlay = 'offline' | 'pause' | null;

export interface StatusInput {
  state: PublicState | null;
  connection: FeedConnection;
  /** Date.now() */
  localNowMs: number;
  /** The cloud's clock now. */
  cloudNowMs: number;
}

const showIsOn = (state: PublicState | null): boolean => Boolean(state && state.gameId !== null && state.scene !== 'before' && state.scene !== 'after');

/** The full-screen notice over the app, if any. */
export function overlayFor({ state, connection, localNowMs, cloudNowMs }: StatusInput, afterMs = PLAYER_CONFIG.offlineNoticeAfterMs): Overlay {
  const feedDown = !connection.online && localNowMs - connection.sinceMs >= afterMs;
  const linkDown = Boolean(state && !state.link.online && cloudNowMs - state.link.sinceMs >= afterMs);
  if ((feedDown || linkDown) && showIsOn(state)) return 'offline';
  if (state?.pause) return 'pause';
  return null;
}

export type Pill = 'reconnecting' | 'connected' | null;

/** The small connection pill. */
export function reconnectPill(connection: FeedConnection, localNowMs: number): Pill {
  const elapsed = localNowMs - connection.sinceMs;
  if (!connection.online) return elapsed >= PLAYER_CONFIG.reconnectPillAfterMs ? 'reconnecting' : null;
  return connection.lastOutageMs >= PLAYER_CONFIG.reconnectPillAfterMs && elapsed < PLAYER_CONFIG.reconnectedPillMs ? 'connected' : null;
}
