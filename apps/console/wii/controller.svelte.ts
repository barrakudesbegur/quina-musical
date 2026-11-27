// The Wii Remote in the console: finds or asks for the remote (WebHID), turns its reports into the user's
// mapping (mapping.ts) and sends the commands exactly as the console's own buttons do, with a rumble for each.
// The remote pairs with the laptop, so this runs where the console is open on the laptop. A is resolved here,
// at the moment of the press, to the console's default action (logic/default-action.ts), the same one the
// console draws as primary; when there is none, or it's disabled, A sends nothing and doesn't rumble.
// The console that hosts the remote publishes its status (remote.status) through the relay; every console,
// the tablet included, shows the badges and the chip when any console has a remote connected.
// The shake gesture's switch (D148) is the Game's setting (`game.remoteShake`): every console shows and changes the same one.
// Development only: `?wii=demo` fakes a connected remote, so the badges and the dialog can be reviewed.
import type { ShowState } from '@quina/protocol';
import { readRemoteStatus, remoteStatusMessage, RemoteHosts, type RemoteSummary } from '../../../packages/ui/client/remote-status.ts';
import { WII } from '../config.ts';
import { flowOf } from '../../../packages/ui/flow.ts';
import { canToggleAuto, checkBackCommand, checkReviewCommand } from '../logic/check.ts';
import { sendDefault } from '../logic/default-action.ts';
import { activeHoldMode } from '../logic/hold-modes.ts';
import { canSend, controlsModel } from '../logic/scene.ts';
import type { ConsoleModel } from '../model.svelte.ts';
import { knownWiiRemote, onWiiConnection, requestWiiRemote, wiiSupported, type WiiRemote } from './driver.ts';
import { WiiMapper, type WiiCommand, type WiiContext, type WiiOutput } from './mapping.ts';
import { buttonChanges, type WiiButton, type WiiReport } from './report.ts';
import { dropReport, recentDrops } from './drops.ts';
import { wiiLockButton } from '../logic/two-level-lock.ts';

/** `lost`: a remote that was connected went away (worth a red chip); `disconnected`: none yet (optional, grey). */
export type WiiStatus = 'unsupported' | 'disconnected' | 'connecting' | 'connected' | 'lost';

/** `?wii=demo`, in development builds only (Vite drops the check from production builds). */
function demoRemote(): boolean {
  return import.meta.env.DEV && typeof location !== 'undefined' && new URLSearchParams(location.search).get('wii') === 'demo';
}

/** What the mapping needs from a snapshot and this console's settings. Pure. */
export function wiiContext(state: ShowState | null, settings: { shake: boolean; nextIsDefault: boolean }): WiiContext {
  const paused = Boolean(state?.pause);
  const flow = flowOf(state);
  // During Pausa a Check's commands wait (the engine refuses them): − and + leave Pausa, as anywhere.
  const check = !paused && flow.scene === 'check' ? flow.check : null;
  // The remote sends only while the console is online (as its buttons do), so ask the rules as if it were.
  const input = { state, flow, online: true };
  const suspense = controlsModel(input).suspense;
  return {
    holdMode: activeHoldMode(state),
    autoAdvance: state?.game.autoAdvance ?? true,
    paused,
    check: check ? { back: checkBackCommand(check), review: checkReviewCommand(check), auto: canToggleAuto(check) } : null,
    canSuspense: suspense.enabled && !suspense.open,
    canSuspenseInSpin: canSend('suspense', input) && !suspense.open,
    nextIsDefault: settings.nextIsDefault,
    suspenseOpen: suspense.open,
    shake: settings.shake,
  };
}

export class WiiController {
  /** A fake remote (`?wii=demo`, development only): shows as connected, sends nothing. */
  readonly demo = demoRemote();
  status = $state<WiiStatus>(this.demo ? 'connected' : wiiSupported() ? 'disconnected' : 'unsupported');
  /** Set when a remote connects: the Comandament dialog opens by itself (and clears it). */
  justConnected = $state(false);
  /** The remote's battery (0..1) on this console, when it hosts the remote and the remote has said. */
  battery = $state<number | null>(null);
  /** What the other consoles' remotes report (through the relay). */
  hosts = $state.raw<RemoteSummary>({ connected: false, lost: false, battery: null, drops: 0 });
  /** A remote is connected on this console or on another one. */
  readonly anyConnected = $derived(this.status === 'connected' || this.hosts.connected);
  /** The console shows each control's Wii button while a remote is connected anywhere. */
  readonly badges = $derived(this.anyConnected);
  /** For the chip and the links list: this console's remote, else another console's. */
  readonly linkStatus = $derived<WiiStatus>(
    this.status === 'connected' || this.hosts.connected ? 'connected' : this.status === 'lost' || this.hosts.lost ? 'lost' : this.status,
  );
  /** When this console's remote dropped without anyone asking (show clock), for `remote.status.drops`. */
  private dropTimes: number[] = [];
  /** The presenter pressed "Desconnectar": the next detach isn't a drop. */
  private leaving = false;
  /** What this console last published about its own remote's drops (when it hosts the remote). */
  private ownDrops = $state.raw<{ drops: number; lastDropMs: number | null }>({ drops: 0, lastDropMs: null });
  /** The drops in the last WII.dropWindowMs: this console's own (when it hosts the remote) and the other hosts' reports. */
  readonly drops = $derived(this.ownDrops.drops + this.hosts.drops);
  /** The battery of whichever remote is connected. */
  readonly batteryLevel = $derived(this.status === 'connected' ? this.battery : this.hosts.battery);
  private readonly remoteHosts = new RemoteHosts();
  private hosting = false;
  private statusSinceMs = 0;
  private batteryTimer: ReturnType<typeof setInterval> | null = null;
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
    const stopListening = this.listen();
    if (this.status === 'unsupported' || this.demo) return stopListening;
    void knownWiiRemote().then((remote) => remote && this.attach(remote));
    onWiiConnection((connected) => {
      if (connected && !this.remote) void knownWiiRemote().then((remote) => remote && this.attach(remote));
      if (!connected) this.detach();
    });
    return () => {
      stopListening();
      void this.disconnect();
    };
  }

  /** Every console: other consoles' remote reports; the host also republishes whenever it (re)connects. */
  private listen(): () => void {
    const client = this.model.show.client;
    const offMessages = client.bus.on((message, { local }) => {
      if (local) return;
      const report = readRemoteStatus(message);
      if (report && this.remoteHosts.apply(report.clientId, report)) this.hosts = this.remoteHosts.summary();
    });
    let online = client.connected;
    const offChange = client.onChange(() => {
      if (client.connected && !online) this.publish();
      online = client.connected;
    });
    return () => {
      offMessages();
      offChange();
    };
  }

  /** Tell the other consoles (through the relay) how this console's remote is. Only a host publishes. */
  private publish(): void {
    if (!this.hosting) return;
    const report = dropReport(this.dropTimes, this.model.show.client.now(), WII.dropWindowMs);
    this.ownDrops = report;
    this.model.show.client.bus.sendRemote(remoteStatusMessage({ connected: this.status === 'connected', battery: this.status === 'connected' ? this.battery : null, sinceMs: this.statusSinceMs, ...report }));
  }

  /** The shake gesture (B + 3 shakes = Suspens) is on (D148): the Game's setting, the same on every console; on until
   * someone turns it off (an older journal lacks it). */
  get shake(): boolean {
    return this.model.show.state?.game.remoteShake ?? WII.shakeOn;
  }

  /** The switch can change it now (the engine takes `setGame`). */
  get canSetShake(): boolean {
    return this.model.can('setGame');
  }

  /** The menu's and the Comandament dialog's switch: asks the engine, and shows what the state then says. */
  setShake(on: boolean): void {
    this.model.act('setGame', { remoteShake: on });
  }

  /** What the mapping needs now. */
  private context(): WiiContext {
    const next = this.model.defaultAction;
    return wiiContext(this.model.show.state, { shake: this.shake, nextIsDefault: next?.control === 'next' && next.enabled });
  }

  /** The presenter's click: ask Chrome for the remote. */
  async connect(): Promise<void> {
    const remote = await requestWiiRemote();
    if (remote) await this.attach(remote);
  }

  async disconnect(): Promise<void> {
    const remote = this.remote;
    this.leaving = true;
    this.detach();
    await remote?.stop();
  }

  private async attach(remote: WiiRemote): Promise<void> {
    if (this.remote) return;
    this.status = 'connecting';
    try {
      await remote.start(
        (report) => this.onReport(report),
        (level) => {
          if (level === this.battery) return;
          this.battery = level;
          this.publish();
        },
      );
    } catch {
      this.status = 'disconnected';
      return;
    }
    this.remote = remote;
    this.status = 'connected';
    this.justConnected = true;
    this.hosting = true;
    this.statusSinceMs = this.model.show.client.now();
    this.publish();
    remote.rumble(WII.rumble.tap);
    remote.requestStatus();
    this.ticker = setInterval(() => this.apply(this.mapper.tick(Date.now(), this.context())), WII.tickMs);
    // Once a minute: the battery, and the drops count republished as old drops leave the window.
    this.batteryTimer = setInterval(() => {
      remote.requestStatus();
      this.publish();
    }, WII.batteryEveryMs);
  }

  private detach(): void {
    if (this.ticker) clearInterval(this.ticker);
    if (this.batteryTimer) clearInterval(this.batteryTimer);
    this.ticker = null;
    this.batteryTimer = null;
    this.battery = null;
    this.remote = null;
    // Held keys let go with the remote (the lock mirror, D234), as the mapper forgets them.
    for (const b of this.pressed) if (wiiLockButton(b)) this.model.twoLevelReleaseAll(`wii-${b}`);
    this.pressed = new Set();
    this.mapper.reset();
    // A connected remote that goes away without "Desconnectar" dropped: out of range, or out of battery.
    if (this.status === 'connected' && !this.leaving) this.dropTimes = [...recentDrops(this.dropTimes, this.model.show.client.now(), WII.dropWindowMs), this.model.show.client.now()];
    this.leaving = false;
    if (this.status !== 'unsupported') this.status = this.status === 'connected' ? 'lost' : 'disconnected';
    this.statusSinceMs = this.model.show.client.now();
    this.publish();
  }

  private onReport(report: WiiReport): void {
    const now = Date.now();
    const ctx = this.context();
    const { down, up } = buttonChanges(this.pressed, report.pressed);
    this.pressed = report.pressed;
    // The lock mirror (D234): B is Aguanta's two-level button, − and + Parlem's. The engine hears the press before what
    // it does, and the let-go after.
    for (const b of down) {
      const lock = wiiLockButton(b);
      if (lock) this.model.twoLevelPress(lock, `wii-${b}`);
      this.apply(this.mapper.press(b, now, ctx));
    }
    for (const b of up) {
      this.apply(this.mapper.release(b, ctx));
      const lock = wiiLockButton(b);
      if (lock) this.model.twoLevelRelease(lock, `wii-${b}`);
    }
    if (report.accel) this.apply(this.mapper.motion(now, report.accel, ctx));
  }

  private apply(outputs: readonly WiiOutput[]): void {
    for (const o of outputs) {
      // Only what was sent rumbles: an A with nothing to do stays still, so the presenter feels the difference.
      const sent = o.command ? this.send(o.command) : true;
      if (sent && o.rumble) this.remote?.rumble(WII.rumble[o.rumble], o.rumble === 'suspenseOn' ? WII.rumbleLoop.suspenseOn : []);
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
      case 'checkBack':
        this.model.act('checkBack', c.args);
        break;
      case 'checkReview':
        this.model.act('checkReview', c.args);
        break;
      case 'checkAuto':
        this.model.act('checkAuto', c.args);
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
