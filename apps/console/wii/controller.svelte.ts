// The Wii Remote in the console: finds or asks for the remote (WebHID), turns its reports into the user's
// mapping (mapping.ts) and sends the commands exactly as the console's own buttons do, with a rumble for each.
// The remote pairs with the laptop, so this runs where the console is open on the laptop. A is resolved here,
// at the moment of the press, to the console's default action (logic/default-action.ts), the same one the
// console draws as primary; when there is none, or it's disabled, A sends nothing and doesn't rumble.
// Development only: `?wii=demo` fakes a connected remote, so the badges and the dialog can be reviewed.
import type { ShowState } from '@quina/protocol';
import { WII } from '../config.ts';
import { sendDefault } from '../logic/default-action.ts';
import { activeHoldMode } from '../logic/hold-modes.ts';
import type { ConsoleModel } from '../model.svelte.ts';
import { knownWiiRemote, onWiiConnection, requestWiiRemote, wiiSupported, type WiiRemote } from './driver.ts';
import { WiiMapper, type WiiCommand, type WiiContext, type WiiOutput } from './mapping.ts';
import { buttonChanges, type WiiButton, type WiiReport } from './report.ts';

/** `lost`: a remote that was connected went away (worth a red chip); `disconnected`: none yet (optional, grey). */
export type WiiStatus = 'unsupported' | 'disconnected' | 'connecting' | 'connected' | 'lost';

/** `?wii=demo`, in development builds only (Vite drops the check from production builds). */
function demoRemote(): boolean {
  return import.meta.env.DEV && typeof location !== 'undefined' && new URLSearchParams(location.search).get('wii') === 'demo';
}

/** What the mapping needs from a snapshot. Pure. */
export function wiiContext(state: ShowState | null): WiiContext {
  return { holdMode: activeHoldMode(state), autoAdvance: state?.game.autoAdvance ?? true, paused: Boolean(state?.pause) };
}

export class WiiController {
  /** A fake remote (`?wii=demo`, development only): shows as connected, sends nothing. */
  readonly demo = demoRemote();
  status = $state<WiiStatus>(this.demo ? 'connected' : wiiSupported() ? 'disconnected' : 'unsupported');
  /** Set when a remote connects: the Comandament dialog opens by itself (and clears it). */
  justConnected = $state(false);
  /** The console shows each control's Wii button while a remote is connected. */
  readonly badges = $derived(this.status === 'connected');
  private readonly model: ConsoleModel;
  private readonly mapper = new WiiMapper(WII);
  private remote: WiiRemote | null = null;
  private pressed: ReadonlySet<WiiButton> = new Set();
  private ticker: ReturnType<typeof setInterval> | null = null;

  constructor(model: ConsoleModel) {
    this.model = model;
  }

  /** Reconnect a remote this browser already knows, and follow connects and disconnects. */
  start(): () => void {
    if (this.status === 'unsupported' || this.demo) return () => {};
    void knownWiiRemote().then((remote) => remote && this.attach(remote));
    onWiiConnection((connected) => {
      if (connected && !this.remote) void knownWiiRemote().then((remote) => remote && this.attach(remote));
      if (!connected) this.detach();
    });
    return () => void this.disconnect();
  }

  /** The presenter's click: ask Chrome for the remote. */
  async connect(): Promise<void> {
    const remote = await requestWiiRemote();
    if (remote) await this.attach(remote);
  }

  async disconnect(): Promise<void> {
    const remote = this.remote;
    this.detach();
    await remote?.stop();
  }

  private async attach(remote: WiiRemote): Promise<void> {
    if (this.remote) return;
    this.status = 'connecting';
    try {
      await remote.start((report) => this.onReport(report));
    } catch {
      this.status = 'disconnected';
      return;
    }
    this.remote = remote;
    this.status = 'connected';
    this.justConnected = true;
    remote.rumble(WII.rumble.tap);
    this.ticker = setInterval(() => this.apply(this.mapper.tick(Date.now())), WII.tickMs);
  }

  private detach(): void {
    if (this.ticker) clearInterval(this.ticker);
    this.ticker = null;
    this.remote = null;
    this.pressed = new Set();
    this.mapper.reset();
    if (this.status !== 'unsupported') this.status = this.status === 'connected' ? 'lost' : 'disconnected';
  }

  private onReport(report: WiiReport): void {
    const now = Date.now();
    const ctx = wiiContext(this.model.show.state);
    const { down, up } = buttonChanges(this.pressed, report.pressed);
    this.pressed = report.pressed;
    for (const b of down) this.apply(this.mapper.press(b, now, ctx));
    for (const b of up) this.apply(this.mapper.release(b, ctx));
    if (report.accel) this.apply(this.mapper.motion(now, report.accel));
  }

  private apply(outputs: readonly WiiOutput[]): void {
    for (const o of outputs) {
      // Only what was sent rumbles: an A with nothing to do stays still, so the presenter feels the difference.
      const sent = o.command ? this.send(o.command) : true;
      if (sent) this.remote?.rumble(WII.rumble[o.rumble]);
    }
  }

  /** Whether something was sent. */
  private send(c: WiiCommand): boolean {
    switch (c.cmd) {
      case 'default':
        // Resolved now, from the console's current state: exactly what its highlighted control would send.
        return sendDefault(this.model.act, this.model.defaultAction) !== null;
      case 'back':
        this.model.act('back');
        break;
      case 'hold':
        this.model.act('hold', c.args);
        break;
      case 'suspense':
        this.model.act('suspense', c.args);
        break;
      case 'pause':
        this.model.act('pause', c.args);
        break;
      case 'setGame':
        this.model.act('setGame', c.args);
        break;
      case 'sfx':
        this.model.act('sfx', c.args);
        break;
    }
    return true;
  }
}
