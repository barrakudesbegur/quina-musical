// Consoles through the cloud (milestone C2). A console connected to `/ws/console` sees what it would see on the
// relay: the show's events, raw, and a `relay.clients` list. Pure: what the laptop forwards, and who is listed.
import type { RelayClients, Role } from '@quina/protocol';
import { FORWARDED_EVENT_TYPES } from './projection.ts';

/**
 * Never sent to the cloud as events: the journal travels as `link.journal`; engine health is local chatter; the
 * relay's plan push never rides along (the cloud has its own, and `link.plan` carries a laptop's newer one); the Wii
 * Remote's status (remote.status) is for the laptop's consoles only.
 */
export const NEVER_FORWARDED = ['journal.entry', 'journal.entries', 'engine.health', 'relay.plan', 'remote.status'] as const;

/** Always forwarded: what phones need, and who is on the relay (tiny and rare). */
export const ALWAYS_FORWARDED: readonly string[] = [...FORWARDED_EVENT_TYPES, 'relay.clients'];

/** Should the laptop link send this event to the cloud? Everything else only while a console listens there. */
export function shouldForward(type: string, consolesInCloud: number): boolean {
  if ((NEVER_FORWARDED as readonly string[]).includes(type)) return false;
  return ALWAYS_FORWARDED.includes(type) || consolesInCloud > 0;
}

/** The roles a console may take on `/ws/console`. */
export const CONSOLE_ROLES = ['tablet', 'admin'] as const satisfies readonly Role[];
export type ConsoleRole = (typeof CONSOLE_ROLES)[number];
export const isConsoleRole = (value: unknown): value is ConsoleRole => typeof value === 'string' && (CONSOLE_ROLES as readonly string[]).includes(value);

type Client = RelayClients['clients'][number];

/**
 * Who is connected, as consoles in the cloud see it: the laptop relay's own list (the show page, LAN consoles,
 * the drum, the link) while the laptop link is online, plus the consoles connected through the cloud.
 * Without the link, the show is not listed, so `showOnline` turns false on every cloud console.
 */
export function mergedClients(relayClients: readonly Client[] | null, linkOnline: boolean, cloudConsoles: readonly Client[]): Client[] {
  return [...(linkOnline && relayClients ? relayClients : []), ...cloudConsoles];
}
