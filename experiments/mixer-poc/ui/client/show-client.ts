// A remote's view of the show: connects a Bus (the relay's WebSocket, the demo transport, later a cloud
// socket) and keeps the latest `state`, the show flow, who is connected and the clock offset. It holds no
// game logic: everything comes from the engine's snapshots and events. Framework-free, so the projector
// stage (plain TS) and the Svelte apps (through show.svelte.ts) share it.
import { Bus, WebSocketTransport, type Transport, type TransportHandlers } from '../../engine/src/net/bus.ts';
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
import { ClockOffset } from '../rules/time.ts';

export type ClientListener = (event: IncomingEvent) => void;

export interface ShowClientOptions {
  role: Role;
  /** Defaults to the relay's WebSocket on this page's host. */
  transport?: Transport;
  clientId?: string;
}

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

  constructor({ role, transport, clientId }: ShowClientOptions) {
    this.bus = new Bus<unknown>({ role, clientId });
    this.transport = new ObservedTransport(transport ?? new WebSocketTransport(), () => this.changed());
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
    const reqId = newReqId();
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
