// The Wii Remote in the console: finds or asks for the remote (WebHID), turns its reports into the user's
// mapping (mapping.ts) and sends the commands exactly as the console's own buttons do, with a rumble for each.
// The remote pairs with the laptop, so this runs where the console is open on the laptop.
import type { ShowState } from '@quina/protocol';
import { WII } from '../config.ts';
import { activeHoldMode } from '../logic/hold-modes.ts';
import type { ConsoleModel } from '../model.svelte.ts';
import { knownWiiRemote, onWiiConnection, requestWiiRemote, wiiSupported, type WiiRemote } from './driver.ts';
import { WiiMapper, type WiiCommand, type WiiContext, type WiiOutput } from './mapping.ts';
import { buttonChanges, type WiiButton, type WiiReport } from './report.ts';

export type WiiStatus = 'unsupported' | 'disconnected' | 'connecting' | 'connected';

/** What the mapping needs from a snapshot. Pure. */
export function wiiContext(state: ShowState | null): WiiContext {
  return { holdMode: activeHoldMode(state), autoAdvance: state?.game.autoAdvance ?? true, paused: Boolean(state?.pause) };
}

export class WiiController {
  status = $state<WiiStatus>(wiiSupported() ? 'disconnected' : 'unsupported');
  /** Set when a remote connects: the Comandament dialog opens by itself. */
  justConnected = $state(false);
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
    if (this.status === 'unsupported') return () => {};
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
    if (this.status !== 'unsupported') this.status = 'disconnected';
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
      if (o.command) this.send(o.command);
      this.remote?.rumble(WII.rumble[o.rumble]);
    }
  }

  private send(c: WiiCommand): void {
    switch (c.cmd) {
      case 'next':
        this.model.act('next');
        break;
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
  }
}
