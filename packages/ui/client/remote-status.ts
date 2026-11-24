// The Wii Remote's status between consoles: the console the remote pairs with (the laptop's) publishes it
// through the relay, and every paired console shows the remote's badges and chip from it. Private: the relay
// forwards it to paired consoles only, never to the public feed. The relay replays the last one on hello and
// reports a host as disconnected when its socket drops. Pure.
// Not in @quina/protocol yet (its owner is away); it moves there when they're back.
import { PROTOCOL_VERSION } from '@quina/protocol';

export const REMOTE_STATUS_TYPE = 'remote.status';

export interface RemoteStatus {
  connected: boolean;
  /** 0..1, or null until the remote has said. */
  battery: number | null;
  /** When `connected` last changed (show clock, epoch ms). */
  sinceMs: number;
}

export interface RemoteStatusMessage extends RemoteStatus {
  v: typeof PROTOCOL_VERSION;
  type: typeof REMOTE_STATUS_TYPE;
  /** Added by the relay: which console hosts the remote. */
  clientId?: string;
}

export const remoteStatusMessage = (s: RemoteStatus): RemoteStatusMessage => ({ v: PROTOCOL_VERSION, type: REMOTE_STATUS_TYPE, ...s });

/** A `remote.status` message (untrusted), or null. */
export function readRemoteStatus(message: unknown): (RemoteStatus & { clientId: string }) | null {
  if (!message || typeof message !== 'object') return null;
  const m = message as Record<string, unknown>;
  if (m.v !== PROTOCOL_VERSION || m.type !== REMOTE_STATUS_TYPE || typeof m.connected !== 'boolean' || typeof m.sinceMs !== 'number') return null;
  const battery = typeof m.battery === 'number' && m.battery >= 0 && m.battery <= 1 ? m.battery : null;
  return { connected: m.connected, battery, sinceMs: m.sinceMs, clientId: typeof m.clientId === 'string' ? m.clientId : '' };
}

export interface RemoteSummary {
  /** Some console has a remote connected. */
  connected: boolean;
  /** A host's remote that was connected went away (and none is connected now). */
  lost: boolean;
  /** The connected remote's battery, when known. */
  battery: number | null;
}

/** What every host reported, folded into one summary. */
export class RemoteHosts {
  private readonly hosts = new Map<string, RemoteStatus & { wasConnected: boolean }>();

  /** Take one report; true when the summary may have changed. */
  apply(clientId: string, status: RemoteStatus): boolean {
    const before = this.hosts.get(clientId);
    if (before && before.connected === status.connected && before.battery === status.battery) return false;
    this.hosts.set(clientId, { ...status, wasConnected: Boolean(before?.wasConnected || before?.connected || status.connected) });
    return true;
  }

  summary(): RemoteSummary {
    const all = [...this.hosts.values()];
    const live = all.find((h) => h.connected);
    return { connected: Boolean(live), lost: !live && all.some((h) => h.wasConnected), battery: live?.battery ?? null };
  }
}
