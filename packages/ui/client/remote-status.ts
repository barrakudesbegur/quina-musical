// The Wii Remote's status between consoles: the console the remote pairs with (the laptop's) publishes it
// through the relay, and every paired console shows the remote's badges and chip from it. Private: the relay
// forwards it to paired consoles only, never to the public feed. The relay replays the last one on hello and
// reports a host as disconnected when its socket drops. Pure.
// The message itself is @quina/protocol's (events.ts); this file folds the hosts' reports into what the console
// shows. The re-exports keep the console's imports where they were.
import type { RemoteStatus } from '@quina/protocol';

export { REMOTE_STATUS_TYPE, readRemoteStatus, remoteStatusMessage } from '@quina/protocol';
export type { RemoteStatus, RemoteStatusMessage } from '@quina/protocol';

export interface RemoteSummary {
  /** Some console has a remote connected. */
  connected: boolean;
  /** A host's remote that was connected went away (and none is connected now). */
  lost: boolean;
  /** The connected remote's battery, when known. */
  battery: number | null;
  /** Drops in the hosts' last 10 minutes (their range; `remote.status.drops`), summed over the hosts. */
  drops: number;
}

/** What every host reported, folded into one summary. */
export class RemoteHosts {
  private readonly hosts = new Map<string, RemoteStatus & { wasConnected: boolean }>();

  /** Take one report; true when the summary may have changed. */
  apply(clientId: string, status: RemoteStatus): boolean {
    const before = this.hosts.get(clientId);
    if (before && before.connected === status.connected && before.battery === status.battery && before.drops === status.drops) return false;
    this.hosts.set(clientId, { ...status, wasConnected: Boolean(before?.wasConnected || before?.connected || status.connected) });
    return true;
  }

  summary(): RemoteSummary {
    const all = [...this.hosts.values()];
    const live = all.find((h) => h.connected);
    const drops = all.reduce((sum, h) => sum + (h.drops ?? 0), 0);
    return { connected: Boolean(live), lost: !live && all.some((h) => h.wasConnected), battery: live?.battery ?? null, drops };
  }
}
