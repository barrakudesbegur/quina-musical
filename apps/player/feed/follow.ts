// The one path every feed adapter's messages take: the contract's `followFeed` (snapshot, deltas, gap →
// resync) plus the clock offset from each message's `nowMs`. Pure apart from the local time passed in.
import { ClockOffset } from '../../ui/rules/time.ts';
import { followFeed, type PublicState, type PublicView } from './public.ts';

export type FollowResult = 'ok' | 'resync' | 'ignore';

export class FeedFollower {
  view: PublicView | null = null;
  readonly clock = new ClockOffset();

  /** The latest public state, or null before the first snapshot. */
  get state(): PublicState | null {
    return this.view?.state ?? null;
  }

  /** Take one message (untrusted JSON, already parsed). `localMs` is Date.now() when it arrived. */
  receive(message: unknown, localMs: number): FollowResult {
    const result = followFeed(this.view, message);
    if (result.kind !== 'ok') return result.kind;
    this.view = result.view;
    const nowMs = (message as { nowMs: number }).nowMs;
    this.clock.add(nowMs, localMs);
    return 'ok';
  }

  /** Parse a socket frame and take it; a frame that isn't JSON is ignored. */
  receiveText(text: string, localMs: number): FollowResult {
    let message: unknown;
    try {
      message = JSON.parse(text);
    } catch {
      return 'ignore';
    }
    return this.receive(message, localMs);
  }

  /** The cloud's clock now. */
  now(localMs: number): number {
    return this.clock.now(localMs);
  }
}
