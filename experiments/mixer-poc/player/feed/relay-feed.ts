// DevRelayFeed (DEVELOPMENT ONLY): the relay's engine events, seen as a split-mode drum would see them, projected
// into the public feed's shape through the strict whitelist in project.ts. Phones never talk to the engine in
// production (ADR 0003): there the cloud projects, and the phone runs CloudFeed.
// The Game plan comes from Admin's store on this origin (ui/data/plan-store.ts), like the other dev screens.
// Limitation: the engine's snapshot carries only the last 10 landings, so a page opened mid-round knows the
// earlier ones only from then on (the cloud's feed carries them all).
import { ShowClient } from '../../ui/client/show-client.ts';
import { LocalPlanStore, type PlanStore } from '../../ui/data/plan-store.ts';
import type { GamePlan } from '../../ui/plan.ts';
import { PLAYER_CONFIG } from '../config.ts';
import type { FeedUpdate, PlayerFeed } from './feed.ts';
import { ProjectedFeedCore } from './projected-feed.ts';
import type { PublicLink } from './public.ts';

export interface DevRelayFeedOptions {
  client?: ShowClient;
  planStore?: PlanStore;
  random?: () => number;
}

export class DevRelayFeed implements PlayerFeed {
  readonly kind = 'relay' as const;
  private readonly client: ShowClient;
  private readonly planStore: PlanStore;
  private readonly core: ProjectedFeedCore;
  private plan: GamePlan | null;
  private link: PublicLink = { online: false, sinceMs: 0 };
  private offs: (() => void)[] = [];

  constructor({ client, planStore, random }: DevRelayFeedOptions = {}) {
    this.client = client ?? new ShowClient({ role: 'drum' });
    this.planStore = planStore ?? new LocalPlanStore();
    this.plan = this.planStore.load();
    this.core = new ProjectedFeedCore(random);
  }

  start(): void {
    if (this.offs.length) return;
    this.offs = [
      this.client.on((event) => this.core.projector.ingest(event, this.client.now())),
      this.client.onChange(() => this.refresh()),
      this.planStore.subscribe((plan) => {
        this.plan = plan;
        this.refresh();
      }),
    ];
    this.client.start();
    this.refresh();
  }

  /** Stops listening. The relay socket itself stays open (ShowClient has no stop); dev only. */
  stop(): void {
    for (const off of this.offs) off();
    this.offs = [];
  }

  now(): number {
    return this.core.now();
  }

  setCards(): void {
    // The relay doesn't count cards opened on phones.
  }

  subscribe(listener: (update: FeedUpdate) => void): () => void {
    return this.core.subscribe(listener);
  }

  private refresh(): void {
    const nowMs = this.client.now();
    const online = this.client.showOnline;
    if (online !== this.link.online || this.link.sinceMs === 0) this.link = { online, sinceMs: nowMs };
    this.core.setOnline(this.client.connected);
    if (!this.client.connected) return;
    this.core.publish({
      nowMs,
      edition: this.plan?.edition || PLAYER_CONFIG.edition,
      gameId: 'relay',
      link: this.link,
      plan: this.plan,
      notice: null,
      soundsDefault: true,
    });
  }
}
