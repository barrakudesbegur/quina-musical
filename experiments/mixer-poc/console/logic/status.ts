// What the always-visible header shows: the connections, the console-wide alert, the round on screen and the
// Heat. Pure: everything comes in as arguments.
import type { ShowState, ShowStatus } from '@quina/protocol';
import type { FlowFields } from '../../ui/flow.ts';

export const LINK_NAMES = ['relay', 'show', 'cloud', 'feed', 'wii'] as const;
/** relay: this console ↔ the laptop's relay; show: the show page on the relay; cloud, feed (phones), wii: not wired yet. */
export type LinkName = (typeof LINK_NAMES)[number];
export type LinkState = 'up' | 'down' | 'unknown';
export type Links = Record<LinkName, LinkState>;

/** The connection chips. Cloud, the phones' feed and the Wii remote have no source yet, so they read "unknown". */
export function linksOf(connected: boolean, showOnline: boolean): Links {
  return {
    relay: connected ? 'up' : 'down',
    // Without the relay we can't know whether the show page is open.
    show: !connected ? 'unknown' : showOnline ? 'up' : 'down',
    cloud: 'unknown',
    feed: 'unknown',
    wii: 'unknown',
  };
}

/** The one alert the console shows above everything, most serious first. */
export type ConsoleAlert = 'disconnected' | 'showOffline' | 'waiting' | 'locked';

export interface AlertInput {
  connected: boolean;
  showOnline: boolean;
  hasState: boolean;
  status: ShowStatus | null;
}

export function consoleAlert({ connected, showOnline, hasState, status }: AlertInput): ConsoleAlert | null {
  if (!connected) return 'disconnected';
  if (!showOnline) return 'showOffline';
  if (!hasState) return 'waiting';
  if (status === 'locked') return 'locked';
  return null;
}

/** Commands can reach the engine: the relay is up and the show page is on it. */
export const isOnline = (connected: boolean, showOnline: boolean): boolean => connected && showOnline;

/** The real Heat as a whole percentage, or null without one. */
export function heatPercent(heat: number | null | undefined): number | null {
  if (heat === null || heat === undefined || !Number.isFinite(heat)) return null;
  return Math.round(Math.min(1, Math.max(0, heat)) * 100);
}

export interface RoundOnScreen {
  number: number;
  special: boolean;
}

/**
 * The round the header names: the one being introduced in `roundStart` (what the projector shows), else the
 * engine's current round (in the Interval, the one that just ended; the Interval panel names the next).
 * Null before the first round (the header then says "Quina Musical").
 */
export function roundOnScreen(state: ShowState | null, flow: FlowFields): RoundOnScreen | null {
  if (!state) return null;
  const intro = flow.intro;
  if (flow.scene === 'roundStart' && intro) return { number: intro.round, special: intro.kind === 'special' };
  if (flow.scene === 'roundStart' && flow.shuffle) return { number: flow.shuffle.round, special: state.round.kind === 'special' };
  if (flow.scene === 'before' || state.round.number < 1) return null;
  return { number: state.round.number, special: state.round.kind === 'special' };
}
