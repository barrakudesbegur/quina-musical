// Where the stage's events come from. In the show page: the page's own Bus, whose LOCAL emissions are the
// engine's events. Standalone (split mode, development): a ShowClient on the relay or the demo transport.
// Both become the same read-only feed. The stage never sends a command.
//
// This is also the first privacy gate: only the events the projector needs pass, and the ones that name the
// incoming song (`transition.scheduled`, `suspense.started`) are reduced to their timestamps here, so `to`
// and `drum.targetId` never reach the rest of the stage. No DOM; tested in tests/ui/stage/source.test.ts.
import { isEvent, type IncomingEvent, type ShowState } from '@quina/protocol';
import type { Bus } from '../show/engine/src/net/bus.ts';
import type { ShowClient } from '../../packages/ui/client/show-client.ts';
import { ClockOffset } from '../../packages/rules/time.ts';

/** What the stage hears, already stripped to public facts (the snapshot is stripped by `stageView`). */
export type StageEvent =
  | { kind: 'state'; state: ShowState }
  | { kind: 'spin'; id: string; spinStartAtMs: number; landAtMs: number | null; autoReleaseAtMs: number | null }
  | { kind: 'landed'; id: string; songId: number; position: number; atMs: number }
  | { kind: 'cancelled'; id: string; atMs: number }
  | { kind: 'undone'; position: number; atMs: number }
  /** The engine's Heat sample, the same one phones get: the projector and the phones show the same Heat. */
  | { kind: 'heat'; value: number; fromMs: number; toMs: number }
  /** The Game plan the relay pushes (`relay.plan`): public, the same plan phones get. Unchecked here. */
  | { kind: 'plan'; plan: unknown }
  /** A Check went under review («Revisió manual»): from then its marks stay as they were. */
  | { kind: 'reviewing'; claimId: string; atMs: number }
  /** A step back inside a Check: the mark at `index` went, and the song before it replays. */
  | { kind: 'unrevealed'; claimId: string; index: number; atMs: number };

/** `online`; `offline`: the relay is gone; `noShow`: the relay is up but the show page isn't on it. */
export type LinkState = 'online' | 'offline' | 'noShow';

export interface StageSource {
  /** The show laptop's clock now (epoch ms): every timestamp in the events is on it. */
  now(): number;
  /** The latest snapshot already known, if any. */
  latest(): ShowState | null;
  link(): LinkState;
  onEvent(listener: (event: StageEvent) => void): () => void;
  onLink(listener: (link: LinkState) => void): () => void;
  /** Stop listening (it never closes a client it didn't create). */
  dispose(): void;
}

/** The public part of an incoming event, or null for events the stage ignores. */
export function toStageEvent(event: IncomingEvent): StageEvent | null {
  switch (event.type) {
    case 'state':
      return { kind: 'state', state: event };
    case 'transition.scheduled':
      return { kind: 'spin', id: event.id, spinStartAtMs: event.spinStartAtMs, landAtMs: event.landAtMs, autoReleaseAtMs: null };
    case 'suspense.started':
      return { kind: 'spin', id: event.id, spinStartAtMs: event.spinStartAtMs, landAtMs: null, autoReleaseAtMs: event.autoReleaseAtMs };
    case 'transition.landed':
      return { kind: 'landed', id: event.id, songId: event.songId, position: event.position, atMs: event.atMs };
    case 'transition.cancelled':
      return { kind: 'cancelled', id: event.id, atMs: event.atMs };
    case 'landing.undone':
      return { kind: 'undone', position: event.position, atMs: event.atMs };
    case 'heat.sample':
      return { kind: 'heat', value: event.value, fromMs: event.fromMs, toMs: event.toMs };
    case 'relay.plan':
      return { kind: 'plan', plan: event.plan };
    case 'check.reviewing':
      return { kind: 'reviewing', claimId: event.claimId, atMs: event.atMs };
    case 'check.unrevealed':
      return { kind: 'unrevealed', claimId: event.claimId, index: event.index, atMs: event.atMs };
    default:
      return null;
  }
}

/**
 * The show page's own Bus: its local emissions are the engine's events, on this very clock. Messages from
 * the transport (remotes' commands) are ignored, except the relay's plan push (`relay.plan`), which is public
 * and is how a kiosk projector, which never regains focus, learns that Admin changed the plan.
 */
export function busSource(bus: Bus<unknown>, { clock = () => Date.now() }: { clock?: () => number } = {}): StageSource {
  const offset = new ClockOffset();
  const listeners = new Set<(event: StageEvent) => void>();
  let latest: ShowState | null = null;
  const off = bus.on((message, { local }) => {
    if (!isEvent(message) || (!local && message.type !== 'relay.plan')) return;
    const event = toStageEvent(message);
    if (!event) return;
    if (event.kind === 'state') {
      latest = event.state;
      offset.add(event.state.atMs, clock());
    }
    for (const listener of listeners) listener(event);
  });
  return {
    now: () => offset.now(clock()),
    latest: () => latest,
    link: () => 'online',
    onEvent(listener) {
      listeners.add(listener);
      return () => void listeners.delete(listener);
    },
    onLink: () => () => {},
    dispose() {
      off();
      listeners.clear();
    },
  };
}

/** A ShowClient (relay or demo). The stage reads it; the caller owns and starts it. */
export function clientSource(client: ShowClient): StageSource {
  const linkOf = (): LinkState => (!client.connected ? 'offline' : client.showOnline ? 'online' : 'noShow');
  const offs: (() => void)[] = [];
  return {
    now: () => client.now(),
    latest: () => client.state,
    link: linkOf,
    onEvent(listener) {
      const off = client.on((incoming) => {
        const event = toStageEvent(incoming);
        if (event) listener(event);
      });
      offs.push(off);
      return off;
    },
    onLink(listener) {
      let last = linkOf();
      const off = client.onChange(() => {
        const link = linkOf();
        if (link !== last) {
          last = link;
          listener(link);
        }
      });
      offs.push(off);
      return off;
    },
    dispose() {
      for (const off of offs.splice(0)) off();
    },
  };
}
