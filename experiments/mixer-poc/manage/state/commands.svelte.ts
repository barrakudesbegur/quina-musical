// Sends Admin's commands and keeps what became of each (logic/command-log.ts), so a button can show
// "not sent: no relay", "sent" or the engine's rejection next to it. A command is not sent at all when the
// relay is unreachable or the show page isn't connected: the relay would silently drop it.
import type { ShowStore } from '../../ui/client/show.svelte.ts';
import type { AnyCommandArgs, AnyCommandName } from '../../ui/flow.ts';
import { applyRejection, lastCommand, recordCommand, type CommandRecord, type CommandStatus } from '../logic/command-log.ts';
import { MANAGE_CONFIG } from '../config.ts';

export class CommandTracker {
  readonly show: ShowStore;
  log = $state.raw<CommandRecord[]>([]);

  constructor(show: ShowStore) {
    this.show = show;
    show.client.on((event) => {
      if (event.type === 'command.rejected') this.log = applyRejection(this.log, event);
    });
  }

  /** Whether a command would leave this page now. */
  get canSend(): boolean {
    return this.show.connected && this.show.showOnline;
  }

  /** Send `cmd` about `subject` (a claimId, or null). Returns its record. */
  send<C extends AnyCommandName>(cmd: C, subject: string | null, ...args: AnyCommandArgs<C>): CommandRecord {
    let status: CommandStatus;
    let reqId: string | null = null;
    if (!this.show.connected) status = 'offline';
    else if (!this.show.showOnline) status = 'noShow';
    else {
      reqId = this.show.send(cmd, ...args);
      status = reqId ? 'sent' : 'offline';
    }
    const record: CommandRecord = { reqId, cmd, subject, atMs: Date.now(), status, reason: null, detail: null };
    this.log = recordCommand(this.log, record, MANAGE_CONFIG.commandLogSize);
    return record;
  }

  last(cmd: AnyCommandName, subject: string | null = null): CommandRecord | null {
    return lastCommand(this.log, cmd, subject);
  }
}
