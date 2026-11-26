// The test's own remote: a tablet on this laptop (no token needed), sending commands and keeping every event.
import WebSocket from 'ws';
import { PROTOCOL_VERSION, type CommandName, type IncomingEvent, type ShowState } from '@quina/protocol';

type Fields = Record<string, unknown>;

export class Remote {
  readonly events: IncomingEvent[] = [];
  state: ShowState | null = null;
  private readonly ws: WebSocket;
  private seq = 0;
  private waiters: (() => void)[] = [];

  /** Set if the relay closed this socket: every wait then fails at once instead of timing out on a stale state. */
  private closed: string | null = null;

  private constructor(ws: WebSocket) {
    this.ws = ws;
    ws.on('close', (code) => {
      this.closed = `the relay closed the test's socket (${code})`;
      for (const wake of this.waiters.splice(0)) wake();
    });
    ws.on('message', (data) => {
      const message = JSON.parse(String(data)) as IncomingEvent;
      this.events.push(message);
      if (message.type === 'state') this.state = message;
      for (const wake of this.waiters.splice(0)) wake();
    });
  }

  static async connect(url: string): Promise<Remote> {
    const ws = new WebSocket(url);
    await new Promise((resolve, reject) => {
      ws.once('open', resolve);
      ws.once('error', reject);
    });
    ws.send(JSON.stringify({ v: PROTOCOL_VERSION, type: 'hello', role: 'tablet', clientId: 'e2e-tablet' }));
    return new Remote(ws);
  }

  /** Send a command; throws if the show rejects it within a moment. */
  async command(cmd: CommandName, fields: Fields = {}): Promise<void> {
    const reqId = `e2e-${++this.seq}`;
    const from = this.events.length;
    this.ws.send(JSON.stringify({ v: PROTOCOL_VERSION, type: 'cmd', cmd, reqId, ...fields }));
    const rejected = await this.waitFor(
      () => this.events.slice(from).find((e) => e.type === 'command.rejected' && e.reqId === reqId) ?? null,
      1500,
      true,
    );
    if (rejected && rejected.type === 'command.rejected') throw new Error(`${cmd} rejected: ${rejected.reason}${rejected.detail ? ` (${rejected.detail})` : ''}`);
  }

  /** Wait until `check` returns something (from the events or the latest state). */
  async waitFor<T>(check: () => T | null | undefined | false, timeoutMs: number, quiet = false): Promise<T | null> {
    const deadline = Date.now() + timeoutMs;
    for (;;) {
      if (this.closed) throw new Error(this.closed);
      const found = check();
      if (found) return found;
      const left = deadline - Date.now();
      if (left <= 0) {
        if (quiet) return null;
        throw new Error(`timed out after ${timeoutMs} ms; state: ${JSON.stringify(this.summary())}`);
      }
      await new Promise<void>((resolve) => {
        const timer = setTimeout(resolve, Math.min(left, 250));
        this.waiters.push(() => {
          clearTimeout(timer);
          resolve();
        });
      });
    }
  }

  /** Wait for a state that passes `test`. */
  async until(what: string, test: (s: ShowState) => boolean, timeoutMs = 60_000): Promise<ShowState> {
    try {
      return (await this.waitFor(() => (this.state && test(this.state) ? this.state : null), timeoutMs)) as ShowState;
    } catch (error) {
      throw new Error(`waiting for ${what}: ${(error as Error).message}`);
    }
  }

  /**
   * A Claim's Check as the presenters run it (D107): one press per reveal (`checkNext`, with the step it expects: the
   * songs revealed so far), then the cue's press, until the Claim has its verdict. With automatic reveal on, the
   * engine reveals by itself and a press only goes where it waits (a card's first reveal); a press it doesn't expect
   * is ignored. Returns the state with the verdict.
   */
  async checkByPresses(claimId: string, timeoutMs = 120_000): Promise<ShowState> {
    const deadline = Date.now() + timeoutMs;
    const left = () => Math.max(1, deadline - Date.now());
    const decided = (s: ShowState) => ['valid', 'invalid'].includes(s.claims.find((c) => c.claimId === claimId)?.status ?? '');
    for (let presses = 0; presses <= 20; presses++) {
      const s = await this.until(`the Check of ${claimId} on screen`, (n) => decided(n) || (n.check?.claimId === claimId && n.check.cue === null), left());
      if (decided(s)) return s;
      const step = s.check?.revealed.length ?? 0;
      await this.command('checkNext', { claimId, step });
      await this.until(`press ${step} on ${claimId}`, (n) => decided(n) || n.check?.claimId !== claimId || (n.check.revealed.length > step || n.check.cue !== null), left());
    }
    throw new Error(`the Check of ${claimId} took more than 20 presses`);
  }

  /** The few fields that say where the show is, for failure messages. */
  summary(): Fields | null {
    const s = this.state;
    return s && { scene: s.scene, status: s.status, current: s.current?.songId ?? null, hold: s.hold, suspense: Boolean(s.suspense), check: s.check ? { claimId: s.check.claimId, revealed: s.check.revealed.length, total: s.check.total, cue: s.check.cue, reviewing: s.check.reviewing } : null, claims: s.claims.map((c) => `${c.cardId}:${c.status}`), celebration: s.celebration?.kind ?? null, round: s.round.number, queue: s.queue };
  }

  close(): void {
    this.ws.close();
  }
}
