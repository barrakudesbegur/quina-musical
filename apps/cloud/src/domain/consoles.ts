// Consoles through the cloud (milestone C2). A console connected to `/ws/console` sees what it would see on the
// relay: the show's events, raw, and a `relay.clients` list. Pure: what the laptop forwards, and who is listed.
import { CLOUD_CONSOLES_MAX, CLOUD_FROM_PREFIX, isCloudConsoleId, type Command, type RelayClients, type Role } from '@quina/protocol';
import { FORWARDED_EVENT_TYPES } from './projection.ts';

/**
 * Never sent to the cloud as events: the journal travels as `link.journal`; engine health is local chatter; the
 * relay's plan push never rides along (the cloud has its own, and `link.plan` carries a laptop's newer one); the Wii
 * Remote's status (remote.status) is for the laptop's consoles only; so is the relay's test mode (relay.mode, the
 * console's «Proves»), which only the show laptop and a LAN tablet may see.
 */
export const NEVER_FORWARDED = ['journal.entry', 'journal.entries', 'engine.health', 'relay.plan', 'remote.status', 'relay.mode'] as const;

/**
 * Commands the cloud never relays: the test tools (the console's «Proves») reset the show page, so only the laptop's
 * consoles may send them, and the relay also drops them unless it runs with `--test`. Matched by name, as plain strings.
 */
export const LAPTOP_ONLY_COMMANDS = ['testReset'] as const;

/** Is this parsed message a command only the laptop's consoles may send? */
export function isLaptopOnlyCommand(message: unknown): boolean {
  if (!message || typeof message !== 'object') return false;
  const cmd = (message as Record<string, unknown>).cmd;
  return typeof cmd === 'string' && (LAPTOP_ONLY_COMMANDS as readonly string[]).includes(cmd);
}

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
  // The relay lists the cloud's consoles too (`cloud:<id>`, from `cloud.consoles`): listed once, as the cloud sees them.
  const relay = linkOnline && relayClients ? relayClients.filter((c) => !isCloudConsoleId(c.clientId)) : [];
  return [...relay, ...cloudConsoles];
}

/** A cloud console's sender id (D234's lock through the cloud): `cloud:` and its hello clientId, or null when that isn't a plain id. */
export function cloudConsoleId(clientId: string | null): string | null {
  const id = `${CLOUD_FROM_PREFIX}${clientId ?? ''}`;
  return clientId && isCloudConsoleId(id) ? id : null;
}

/**
 * A checked console command as the cloud hands it to the link: `from` is the sending console's cloud id, never one the
 * browser set (so no console can pose as another), and none when its clientId isn't a plain id. The relay keeps a
 * `cloud:` from only on the link's socket; the engine's two-level lock tells cloud consoles apart by it.
 */
export function stampCloudCommand(command: Command, clientId: string | null): Command {
  const stamped: Command = { ...command };
  delete stamped.from;
  const from = cloudConsoleId(clientId);
  if (from) stamped.from = from;
  return stamped;
}

/** The ids the link forwards to the relay as `cloud.consoles`: each connected console's cloud id once, at most CLOUD_CONSOLES_MAX. */
export function cloudConsoleIds(clientIds: readonly (string | null)[]): string[] {
  const ids = clientIds.map(cloudConsoleId).filter((id): id is string => id !== null);
  return [...new Set(ids)].slice(0, CLOUD_CONSOLES_MAX);
}
