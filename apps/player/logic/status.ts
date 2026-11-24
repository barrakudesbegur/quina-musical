// The connection strip at the top of the screen, and the presenters' pause. Pure: the clocks are passed in.
// - offline: once the laptop's link to the cloud has been down for 20 s, or the phone has had no feed for 20 s.
//   Only while the show is on (not before or after the Game, when a switched-off laptop is normal). The normal
//   screen stays usable underneath: the strip reads "Sense connexió · reconnectant…" and the screen greys.
// - reconnecting: the phone's own feed has been down for 3 s (the short-drop pill, "Reconnectant…").
// - connected: whichever of the two was showing turns green ("Connectat") for 1 s once things are back.
// One strip at a time: offline wins over reconnecting, so the phone never shows two banners.
// - pause: the presenters' technical pause, "Tornem de seguida", shown in the drum's place.
import { PLAYER_CONFIG } from '../config.ts';
import type { FeedConnection } from '../feed/feed.ts';
import type { PublicState } from '../feed/public.ts';

export interface StatusInput {
  state: PublicState | null;
  connection: FeedConnection;
  /** Date.now() */
  localNowMs: number;
  /** The cloud's clock now. */
  cloudNowMs: number;
}

export interface StatusTimes {
  /** The feed or the laptop link down this long, during the show: offline. */
  offlineAfterMs: number;
  /** The phone's feed down this long: reconnecting. */
  reconnectingAfterMs: number;
  /** How long "Connectat" stays. */
  connectedMs: number;
}

const TIMES: StatusTimes = {
  offlineAfterMs: PLAYER_CONFIG.offlineNoticeAfterMs,
  reconnectingAfterMs: PLAYER_CONFIG.reconnectPillAfterMs,
  connectedMs: PLAYER_CONFIG.reconnectedPillMs,
};

const showIsOn = (state: PublicState | null): boolean => Boolean(state && state.gameId !== null && state.scene !== 'before' && state.scene !== 'after');

/** What is down right now, if anything: offline wins over a short drop of the phone's own feed. */
export function connectionProblem({ state, connection, localNowMs, cloudNowMs }: StatusInput, times: StatusTimes = TIMES): 'offline' | 'reconnecting' | null {
  const feedDownMs = connection.online ? 0 : localNowMs - connection.sinceMs;
  const linkDownMs = state && !state.link.online ? cloudNowMs - state.link.sinceMs : 0;
  if ((feedDownMs >= times.offlineAfterMs || linkDownMs >= times.offlineAfterMs) && showIsOn(state)) return 'offline';
  if (feedDownMs >= times.reconnectingAfterMs) return 'reconnecting';
  return null;
}

export type Banner = 'offline' | 'reconnecting' | 'connected' | null;

export interface BannerState {
  banner: Banner;
  /** Local time the banner last changed. */
  sinceMs: number;
}

export const NO_BANNER: BannerState = Object.freeze({ banner: null, sinceMs: 0 });

/**
 * The strip's next state. It needs the previous one: "Connectat" only follows a strip that was showing, so a
 * blip shorter than 3 s shows nothing at all. Returns `prev` itself when nothing changed.
 */
export function nextBanner(prev: BannerState, input: StatusInput, times: StatusTimes = TIMES): BannerState {
  const now = input.localNowMs;
  const problem = connectionProblem(input, times);
  if (problem) return prev.banner === problem ? prev : { banner: problem, sinceMs: now };
  if (prev.banner === 'offline' || prev.banner === 'reconnecting') return { banner: 'connected', sinceMs: now };
  if (prev.banner === 'connected' && now - prev.sinceMs < times.connectedMs) return prev;
  return prev.banner === null ? prev : { banner: null, sinceMs: now };
}

/** The presenters' technical pause is on. */
export const pauseOn = (state: PublicState | null): boolean => Boolean(state?.pause);
