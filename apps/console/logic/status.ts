// What the always-visible header shows: the connections, the console-wide alert, the round on screen, the
// Heat and the Drift. Pure: everything comes in as arguments.
import type { RoundKind, ShowState, ShowStatus } from '@quina/protocol';
import { formatDrift } from '../../../packages/rules/time.ts';
import type { FlowFields } from '../../../packages/ui/flow.ts';
import type { WiiStatus } from '../wii/controller.svelte.ts';

export const LINK_NAMES = ['relay', 'show', 'cloud', 'feed', 'wii'] as const;
/** relay: this console ↔ the laptop's relay; show: the show page on the relay; wii: a remote on this device;
 *  cloud, feed (phones): not wired yet. */
export type LinkName = (typeof LINK_NAMES)[number];
export type LinkState = 'up' | 'down' | 'unknown';
export type Links = Record<LinkName, LinkState>;

/**
 * The Wii remote's link: up when connected, down when a connected remote went away, unknown otherwise (none
 * connected yet, or no WebHID here: a tablet or phone; the remote pairs with the laptop).
 */
export function wiiLink(status: WiiStatus): LinkState {
  if (status === 'connected') return 'up';
  // The remote is optional: only one that was connected and went away is worth a red chip.
  return status === 'lost' ? 'down' : 'unknown';
}

/** The connection chips. Cloud and the phones' feed have no source yet, so they read "unknown". */
export function linksOf(connected: boolean, showOnline: boolean, wii: WiiStatus = 'unsupported'): Links {
  return {
    relay: connected ? 'up' : 'down',
    // Without the relay we can't know whether the show page is open.
    show: !connected ? 'unknown' : showOnline ? 'up' : 'down',
    cloud: 'unknown',
    feed: 'unknown',
    wii: wiiLink(wii),
  };
}

/** The header's chips (the menu lists every link): the cloud, the LAN link to the laptop, the phones, the Wii. */
export const HEADER_CHIPS = ['cloud', 'lan', 'feed', 'wii'] as const;
export type HeaderChip = (typeof HEADER_CHIPS)[number];

/**
 * The header's chips from the links. LAN is the way to the show laptop: up only when both its relay and the
 * show page on it answer (commands get through), down otherwise.
 */
export function headerChips(links: Links): Record<HeaderChip, LinkState> {
  const lan: LinkState = links.relay === 'up' && links.show === 'up' ? 'up' : links.relay === 'unknown' ? 'unknown' : 'down';
  return { cloud: links.cloud, lan, feed: links.feed, wii: links.wii };
}

/** How the Drift chip looks: on time, running late, or ahead. */
export type DriftTone = 'onTime' | 'late' | 'early';

/** "On time" is whatever the shared `formatDrift` calls on time, so the chip's colour and its words agree. */
export function driftTone(sec: number | null | undefined): DriftTone {
  if (sec === null || sec === undefined || !Number.isFinite(sec) || formatDrift(sec) === formatDrift(0)) return 'onTime';
  return sec > 0 ? 'late' : 'early';
}

/** The one alert the console shows above everything, most serious first. */
export type ConsoleAlert = 'disconnected' | 'unpaired' | 'showOffline' | 'waiting' | 'locked';

export interface AlertInput {
  connected: boolean;
  showOnline: boolean;
  hasState: boolean;
  status: ShowStatus | null;
  /** Connected for a while but the relay has sent nothing (it ignores unpaired devices on the hotspot). */
  unpaired?: boolean;
}

export function consoleAlert({ connected, showOnline, hasState, status, unpaired = false }: AlertInput): ConsoleAlert | null {
  if (!connected) return 'disconnected';
  if (unpaired) return 'unpaired';
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

/** A round the header names (S.header.round): its number in the plan and its kind. */
export interface RoundOnScreen {
  number: number;
  kind: RoundKind;
}

/**
 * The round the header names: the one being introduced in `roundStart` (what the projector shows), else the
 * engine's current round (in the Interval, the one that just ended; the Interval panel names the next).
 * Null before the first round (the header then says "Quina Musical").
 */
export function roundOnScreen(state: ShowState | null, flow: FlowFields): RoundOnScreen | null {
  if (!state) return null;
  const intro = flow.intro;
  if (flow.scene === 'roundStart' && intro) return { number: intro.round, kind: intro.kind };
  const of = (number: number) => ({ number, kind: state.round.kind });
  if (flow.scene === 'roundStart' && flow.shuffle) return of(flow.shuffle.round);
  if (flow.scene === 'before' || state.round.number < 1) return null;
  return of(state.round.number);
}

/** This machine (the laptop itself), where the relay needs no token. */
export function isLoopback(hostname: string): boolean {
  const h = hostname.replace(/^\[|\]$/g, '');
  return h === 'localhost' || h === '::1' || /^127\./.test(h);
}

/**
 * The relay sends an unpaired device nothing at all, not even who is connected. So: connected, no client
 * list and no state after `graceMs`, on an address other than the laptop's own.
 */
export function looksUnpaired(input: { connected: boolean; heardClients: boolean; hasState: boolean; hostname: string; connectedForMs: number; graceMs: number }): boolean {
  return input.connected && !input.heardClients && !input.hasState && !isLoopback(input.hostname) && input.connectedForMs >= input.graceMs;
}
