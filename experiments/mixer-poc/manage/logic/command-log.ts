// What happened to the commands Admin sent, so every action can show its outcome next to its button. The
// protocol has no "accepted" acknowledgement: a command is `sent` once the relay took it, and turns
// `rejected` if the engine answers `command.rejected` with its reqId. It is never sent when the relay is
// unreachable (`offline`) or the show page isn't connected (`noShow`: the relay would drop it). Pure.
import type { CommandRejected } from '@quina/protocol';

export type CommandStatus = 'offline' | 'noShow' | 'sent' | 'rejected';

export interface CommandRecord {
  /** null when it never left this page. */
  reqId: string | null;
  cmd: string;
  /** What the record is about, when one command serves many things (a winner's claimId). */
  subject: string | null;
  atMs: number;
  status: CommandStatus;
  /** The rejection's reason and detail. */
  reason: string | null;
  detail: string | null;
}

/** Add a record, newest first, keeping at most `max`. */
export function recordCommand(log: readonly CommandRecord[], record: CommandRecord, max = 30): CommandRecord[] {
  return [record, ...log].slice(0, max);
}

/** Mark the command a rejection quotes. Unknown reqIds leave the log as it is. */
export function applyRejection(log: readonly CommandRecord[], rejection: Pick<CommandRejected, 'reqId' | 'reason' | 'detail'>): CommandRecord[] {
  if (!rejection.reqId || !log.some((r) => r.reqId === rejection.reqId)) return [...log];
  return log.map((r) => (r.reqId === rejection.reqId ? { ...r, status: 'rejected', reason: rejection.reason, detail: rejection.detail ?? null } : r));
}

/** The latest record of a command (and subject, when given). */
export function lastCommand(log: readonly CommandRecord[], cmd: string, subject: string | null = null): CommandRecord | null {
  return log.find((r) => r.cmd === cmd && (subject === null || r.subject === subject)) ?? null;
}
