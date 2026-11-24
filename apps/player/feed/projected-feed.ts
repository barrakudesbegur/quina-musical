// What DevRelayFeed and DemoFeed share: a PublicProjector whose snapshots go through the same FeedFollower
// (`followFeed`) as the cloud's messages, a connection tracker and the listeners.
import { ConnectionTracker, type FeedUpdate } from './feed.ts';
import { FeedFollower } from './follow.ts';
import { PublicProjector, type ProjectionContext } from './project.ts';

export class ProjectedFeedCore {
  readonly projector: PublicProjector;
  readonly follower = new FeedFollower();
  readonly connection: ConnectionTracker;
  private readonly clock: () => number;
  private readonly listeners = new Set<(update: FeedUpdate) => void>();

  constructor(random: () => number = Math.random, clock: () => number = Date.now) {
    this.projector = new PublicProjector(random);
    this.clock = clock;
    this.connection = new ConnectionTracker(clock);
  }

  /** Project the engine's current view and deliver it as a snapshot message. */
  publish(ctx: ProjectionContext): void {
    this.follower.receive(this.projector.snapshot(ctx), this.clock());
    this.emit();
  }

  setOnline(online: boolean): void {
    if (this.connection.set(online)) this.emit();
  }

  now(): number {
    return this.follower.now(this.clock());
  }

  subscribe(listener: (update: FeedUpdate) => void): () => void {
    this.listeners.add(listener);
    listener(this.update());
    return () => void this.listeners.delete(listener);
  }

  private update(): FeedUpdate {
    return { state: this.follower.state, connection: this.connection.value };
  }

  private emit(): void {
    const update = this.update();
    for (const listener of this.listeners) listener(update);
  }
}
