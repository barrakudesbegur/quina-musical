// The state each connected show page last sent (whats-left 1.7). The consoles hear the latest sender's, as before; when
// that page leaves (a second show page closed, a tab shut), its state goes with it and the consoles get the state of the
// show page still connected at once, or the relay asks it to resend. With none left the relay holds no state, so a
// console that says hello hears none and shows "no show page", never a closed page's. Pure, so it is tested without a
// socket (tests/relay-show-states.test.ts); relay/server.ts keeps one, keyed by socket.
import type { ShowState } from '@quina/protocol';

/** What the relay does when a show page leaves. */
export type ShowPageLeft<K> =
  /** The current state was another page's: nothing changes for the consoles. */
  | { kind: 'none' }
  /** Send every listener this state, the latest of a page still connected. */
  | { kind: 'replay'; state: ShowState }
  /** The pages still connected have sent no state yet: ask them (`getState`); their answer goes out as usual. */
  | { kind: 'ask'; pages: K[] }
  /** No show page is left: the relay holds no state. */
  | { kind: 'gone' };

export class ShowStates<K> {
  /** Each connected show page and the state it last sent (null before its first), the latest sender last. */
  private readonly pages = new Map<K, ShowState | null>();
  /** The page whose state the consoles hear: the latest sender's, null when no connected page has sent one. */
  private latest: K | null = null;

  /** A show page said hello. */
  connected(page: K): void {
    if (!this.pages.has(page)) this.pages.set(page, null);
  }

  /** A show page sent its state: it is the current one now. */
  sent(page: K, state: ShowState): void {
    this.pages.delete(page);
    this.pages.set(page, state);
    this.latest = page;
  }

  /** The state the consoles hear: the latest sender's, while that page is connected. */
  current(): ShowState | null {
    return this.latest === null ? null : (this.pages.get(this.latest) ?? null);
  }

  /** A socket closed (any role: a page never connected as a show page leaves nothing to do). */
  left(page: K): ShowPageLeft<K> {
    if (!this.pages.delete(page) || page !== this.latest) return { kind: 'none' };
    this.latest = null;
    if (this.pages.size === 0) return { kind: 'gone' };
    const withState = [...this.pages].filter(([, state]) => state !== null);
    const last = withState.at(-1);
    if (!last) return { kind: 'ask', pages: [...this.pages.keys()] };
    this.latest = last[0];
    return { kind: 'replay', state: last[1] as ShowState };
  }
}
