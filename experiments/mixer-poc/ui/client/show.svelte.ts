// Svelte 5 adapter for ShowClient: reactive fields that components read directly (`show.state`,
// `show.flow`, `show.connected`) plus a ticking clock for countdowns. One ShowStore per page.
import type { CommandRejected, RelayClients, Role, ShowState } from '@quina/protocol';
import { flowOf, type AnyCommandArgs, type AnyCommandName, type FlowFields } from '../flow.ts';
import { ShowClient } from './show-client.ts';
import { DemoTransport, demoNameFromLocation } from './demo.ts';

export class ShowStore {
  readonly client: ShowClient;
  state = $state.raw<ShowState | null>(null);
  flow = $state.raw<FlowFields>(flowOf(null));
  connected = $state(false);
  showOnline = $state(false);
  clients = $state.raw<RelayClients['clients']>([]);
  lastRejection = $state.raw<CommandRejected | null>(null);
  /** The show laptop's clock, refreshed 4 times a second (for countdowns). */
  now = $state(Date.now());
  /** True when running on the demo transport (`?demo=`). */
  readonly demo: string | null;

  constructor(client: ShowClient, demo: string | null = null) {
    this.client = client;
    this.demo = demo;
    client.onChange(() => this.sync());
    this.sync();
    setInterval(() => (this.now = client.now()), 250);
  }

  send = <C extends AnyCommandName>(cmd: C, ...args: AnyCommandArgs<C>): string | null => this.client.send(cmd, ...args);

  private sync(): void {
    this.state = this.client.state;
    this.flow = this.client.flow;
    this.connected = this.client.connected;
    this.showOnline = this.client.showOnline;
    this.clients = this.client.clients;
    this.lastRejection = this.client.lastRejection;
    this.now = this.client.now();
  }
}

/** The page's ShowStore: the demo transport with `?demo=<fixture>`, else the relay. */
export function createShow(role: Role): ShowStore {
  const demo = demoNameFromLocation();
  const client = new ShowClient({ role, transport: demo ? new DemoTransport(demo) : undefined });
  const store = new ShowStore(client, demo);
  client.start();
  return store;
}
