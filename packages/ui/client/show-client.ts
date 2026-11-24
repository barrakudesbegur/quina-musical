// A remote's view of the show: connects a Bus (the relay's WebSocket, the demo transport, later a cloud
// socket) and keeps the latest `state`, the show flow, who is connected and the clock offset. It holds no
// game logic: everything comes from the engine's snapshots and events. Framework-free, so the projector
// stage (plain TS) and the Svelte apps (through show.svelte.ts) share it.
import { Bus, WebSocketTransport, type Transport, type TransportHandlers } from '../../../apps/show/engine/src/net/bus.ts';
import {
  PROTOCOL_VERSION,
  isEvent,
  newReqId,
  type CommandRejected,
  type IncomingEvent,
  type RelayClients,
  type Role,
  type ShowState,
} from '@quina/protocol';
import { flowOf, type AnyCommandArgs, type AnyCommandName, type FlowFields } from '../flow.ts';
import { ClockOffset } from '../../rules/time.ts';
import { controlSocketUrl, labelForId } from './endpoints.ts';

export type ClientListener = (event: IncomingEvent) => void;

export interface ShowClientOptions {
  role: Role;
  /** Defaults to the page origin's control socket: the relay on the LAN, the cloud's console socket otherwise. */
  transport?: Transport;
  clientId?: string;
  /** The device label ("Tauleta", "Mòbil admin"). It starts the clientId and every reqId, so screens can say who did what. */
  label?: string;
  /** The relay token for a device on the hotspot's LAN (ui/client/pairing.ts); pages on the laptop need none. */
  token?: string | null;
}

const randomSuffix = () => Math.random().toString(36).slice(2, 6);

/** Wraps a transport to report connection changes (the Bus itself does not). */
class ObservedTransport implements Transport {
  private readonly inner: Transport;
  private readonly onChange: () => void;

  constructor(inner: Transport, onChange: () => void) {
    this.inner = inner;
    this.onChange = onChange;
  }

  get connected(): boolean {
    return this.inner.connected;
  }

  connect(handlers: TransportHandlers): void {
    this.inner.connect({
      open: () => {
        handlers.open();
        this.onChange();
      },
      message: (text) => handlers.message(text),
      close: () => {
        handlers.close();
        this.onChange();
      },
    });
  }

  send(text: string): boolean {
    return this.inner.send(text);
  }
}

export class ShowClient {
  readonly bus: Bus<unknown>;
  readonly clock = new ClockOffset();
  state: ShowState | null = null;
  flow: FlowFields = flowOf(null);
  clients: RelayClients['clients'] = [];
  lastRejection: CommandRejected | null = null;
  private readonly transport: Transport;
  private readonly listeners = new Set<ClientListener>();
  private readonly changeListeners = new Set<() => void>();
  private started = false;

  /** Starts every reqId this client sends (the device label, or 'r'). */
  readonly reqPrefix: string;

  /** The relay token this client pairs with, or null. */
  readonly token: string | null;

  constructor({ role, transport, clientId, label, token = null }: ShowClientOptions) {
    const tag = label ? labelForId(label) : null;
    this.reqPrefix = tag ?? 'r';
    this.token = token;
    this.bus = new Bus<unknown>({ role, token, clientId: clientId ?? (tag ? `${tag}-${randomSuffix()}` : undefined) });
    // The relay's socket only when no transport is given (a test's or the demo's never opens one).
    const inner = transport ?? (typeof location === 'undefined' ? new WebSocketTransport() : new WebSocketTransport(controlSocketUrl(location.href)));
    this.transport = new ObservedTransport(inner, () => this.changed());
  }

  /** Connect and ask for a fresh snapshot on every (re)connection. Safe to call twice. */
  start(): this {
    if (this.started) return this;
    this.started = true;
    this.bus.on((message, { local }) => {
      if (local || !isEvent(message)) return;
      this.handle(message);
    });
    this.bus.onOpen = () => void this.send('getState');
    this.bus.connect(this.transport);
    return this;
  }

  /** Connected to the relay (or the demo). */
  get connected(): boolean {
    return this.bus.connected;
  }

  /** The show page (the engine) is connected to the relay. */
  get showOnline(): boolean {
    return this.clients.some((c) => c.role === 'show');
  }

  /** The show laptop's clock now (epoch ms). Use it for every countdown. */
  now(): number {
    return this.clock.now(Date.now());
  }

  /** Every event, after the client has applied it. Returns an unsubscribe function. */
  on(listener: ClientListener): () => void {
    this.listeners.add(listener);
    return () => void this.listeners.delete(listener);
  }

  /** Called after anything the client keeps has changed. */
  onChange(listener: () => void): () => void {
    this.changeListeners.add(listener);
    return () => void this.changeListeners.delete(listener);
  }

  /** Send a command (merged or proposed). Returns its reqId, or null when not connected. */
  send<C extends AnyCommandName>(cmd: C, ...args: AnyCommandArgs<C>): string | null {
    const reqId = newReqId(this.reqPrefix);
    const fields = (args[0] ?? {}) as Record<string, unknown>;
    const message = { ...fields, v: PROTOCOL_VERSION, type: 'cmd', cmd, reqId };
    return this.bus.sendRemote(message) ? reqId : null;
  }

  private handle(event: IncomingEvent): void {
    switch (event.type) {
      case 'state':
        this.state = event;
        this.flow = flowOf(event);
        this.clock.add(event.atMs, Date.now());
        break;
      case 'relay.clients':
        this.clients = event.clients;
        break;
      case 'command.rejected':
        this.lastRejection = event;
        break;
      default:
        break;
    }
    for (const listener of this.listeners) listener(event);
    this.changed();
  }

  private changed(): void {
    for (const listener of this.changeListeners) listener();
  }
}
