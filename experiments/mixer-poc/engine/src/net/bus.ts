// Message bus for @quina/protocol messages. In-page listeners and, when connected, a Transport (the
// relay's WebSocket today; a cloud socket or a direct device link later) see the same messages, so the
// remotes and the on-page controls are interchangeable and the protocol does not care how it travels.
// What arrives through a transport is untrusted JSON: listeners get `unknown` and check it with the
// protocol (the show engine with `checkCommand`, a remote with `isEvent`).
import { PROTOCOL_VERSION, type RelayHello, type Role } from '@quina/protocol';

/** Where a message came from: emitted on this page (`local`), or through the transport. */
export interface Delivery {
  local: boolean;
}
/** A local message is one this page emitted; one from the transport is unchecked JSON. */
export type BusListener = (message: unknown, delivery: Delivery) => void;

/** What a transport reports. `open` fires on every (re)connection. */
export interface TransportHandlers {
  open(): void;
  message(text: string): void;
  close(): void;
}

/** Carries text frames to and from the other devices. It reconnects by itself. */
export interface Transport {
  readonly connected: boolean;
  connect(handlers: TransportHandlers): void;
  /** Send one frame; false when not connected (the message is dropped, never queued). */
  send(text: string): boolean;
}

/** The relay's WebSocket on this page's host (`/ws`). */
export function relayUrl(): string {
  return `${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/ws`;
}

/** A WebSocket that reconnects with backoff (0.5 s doubling to 5 s). */
export class WebSocketTransport implements Transport {
  readonly url: string;
  socket: WebSocket | null = null;

  constructor(url = relayUrl()) {
    this.url = url;
  }

  get connected(): boolean {
    return this.socket?.readyState === WebSocket.OPEN;
  }

  connect(handlers: TransportHandlers): void {
    let retry = 500;
    const open = () => {
      const socket = new WebSocket(this.url);
      this.socket = socket;
      socket.addEventListener('open', () => {
        retry = 500;
        handlers.open();
      });
      socket.addEventListener('message', (event: MessageEvent<unknown>) => handlers.message(String(event.data)));
      socket.addEventListener('close', () => {
        handlers.close();
        setTimeout(open, retry);
        retry = Math.min(retry * 2, 5000);
      });
      socket.addEventListener('error', () => socket.close());
    };
    open();
  }

  send(text: string): boolean {
    if (!this.connected || !this.socket) return false;
    this.socket.send(text);
    return true;
  }
}

export interface BusOptions {
  role: Role;
  clientId?: string;
}

/** `Out`: what this page sends (the show page emits `ShowEvent`s; a remote sends `Command`s). */
export class Bus<Out> {
  readonly role: Role;
  readonly clientId: string;
  readonly listeners = new Set<BusListener>();
  transport: Transport | null = null;
  /** Called on every (re)connection, after the hello. */
  onOpen: (() => void) | null = null;

  constructor({ role, clientId = `${role}-${Math.random().toString(36).slice(2, 7)}` }: BusOptions) {
    this.role = role;
    this.clientId = clientId;
  }

  get connected(): boolean {
    return this.transport?.connected ?? false;
  }

  on(listener: BusListener): () => boolean {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /** Deliver locally and send through the transport. */
  emit(message: Out): void {
    for (const listener of this.listeners) listener(message, { local: true });
    this.sendRemote(message);
  }

  /** Send through the transport only. */
  sendRemote(message: Out): boolean {
    return this.transport?.send(JSON.stringify(message)) ?? false;
  }

  /** Connect through `transport` (the relay's WebSocket by default) and say hello on every connection. */
  connect(transport: Transport = new WebSocketTransport()): void {
    this.transport = transport;
    transport.connect({
      open: () => {
        const hello: RelayHello = { v: PROTOCOL_VERSION, type: 'hello', role: this.role, clientId: this.clientId };
        transport.send(JSON.stringify(hello));
        this.onOpen?.();
      },
      message: (text) => {
        let message: unknown;
        try {
          message = JSON.parse(text);
        } catch {
          return;
        }
        for (const listener of this.listeners) listener(message, { local: false });
      },
      close: () => {},
    });
  }
}

export { newReqId as reqId } from '@quina/protocol';
