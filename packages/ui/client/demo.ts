// The demo transport: any page with `?demo=<fixture>` runs on a fixture instead of the relay, so every scene
// can be reviewed and developed without the show page or audio. It answers `getState` with the fixture's
// snapshot, replays the fixture's later events, reports the show as connected, and logs every command it
// receives (console and `window.__quinaDemoLog`) without acting on it.
// `?demo=list` logs the fixture names.
import { PROTOCOL_VERSION, type IncomingEvent } from '@quina/protocol';
import type { Transport, TransportHandlers } from '../../../apps/show/engine/src/net/bus.ts';
import { FIXTURES, FIXTURE_NAMES } from '../fixtures/states.ts';

declare global {
  interface Window {
    __quinaDemoLog?: unknown[];
  }
}

/** The fixture named by `?demo=`, or null. */
export function demoNameFromLocation(): string | null {
  if (typeof location === 'undefined') return null;
  const name = new URLSearchParams(location.search).get('demo');
  return name && name.length > 0 ? name : null;
}

export class DemoTransport implements Transport {
  readonly name: string;
  private handlers: TransportHandlers | null = null;
  private open = false;
  private readonly startedAt = Date.now();

  constructor(name: string) {
    this.name = name;
  }

  get connected(): boolean {
    return this.open;
  }

  connect(handlers: TransportHandlers): void {
    this.handlers = handlers;
    if (!FIXTURES[this.name]) console.warn(`[demo] no fixture "${this.name}"; try one of: ${FIXTURE_NAMES.join(', ')}`);
    setTimeout(() => {
      this.open = true;
      handlers.open();
      this.deliver({ v: PROTOCOL_VERSION, type: 'relay.clients', clients: [{ role: 'show', clientId: 'demo-show' }] });
      for (const { afterMs, event } of this.script().events ?? []) setTimeout(() => this.deliver(event), afterMs);
    }, 50);
  }

  send(text: string): boolean {
    if (!this.open) return false;
    let command: { cmd?: unknown } | null = null;
    try {
      command = JSON.parse(text) as { cmd?: unknown };
    } catch {
      return true;
    }
    if (command?.cmd === 'getState') {
      this.deliver({ ...this.script().state, atMs: Date.now() });
    } else if (command && 'cmd' in command) {
      console.info('[demo] command', command);
      if (typeof window !== 'undefined') (window.__quinaDemoLog ??= []).push(command);
    }
    return true;
  }

  private script() {
    const make = FIXTURES[this.name] ?? FIXTURES.play;
    return make(this.startedAt);
  }

  private deliver(event: IncomingEvent): void {
    this.handlers?.message(JSON.stringify(event));
  }
}
