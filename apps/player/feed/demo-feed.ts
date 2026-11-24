// DemoFeed: `?demo=<name>` runs the player app on the shared fixtures (ui/fixtures/states.ts), projected through
// the same whitelist and the same `followFeed` path as the real feeds, so every screen can be reviewed without
// the show page, the relay or the cloud. A player demo picks a fixture and may add landings, patch the engine
// state, cut the laptop link, drop the feed, post Admin's notice or keep landing songs (`live`).
// Fixture names that aren't player demos run as they are; unknown names fall back to `play`.
import { PROTOCOL_VERSION, type LandingInfo, type ShowState } from '@quina/protocol';
import { FIXTURES, FIXTURE_LANDED, FIXTURE_SONGS } from '../../../packages/ui/fixtures/states.ts';
import { SAMPLE_PLAN } from '../../../packages/ui/fixtures/plan.ts';
import type { FlowFields } from '../../../packages/ui/flow.ts';
import type { FeedUpdate, PlayerFeed } from './feed.ts';
import { ProjectedFeedCore } from './projected-feed.ts';
import type { PublicLink } from './public.ts';

export interface PlayerDemo {
  /** The shared fixture it starts from. */
  fixture: string;
  /** Which cards the demo phone holds ('none' shows the empty, first-open screens). */
  cards: 'none' | 'default';
  /** Landings after the fixture's, oldest first. */
  extraLanded?: readonly number[];
  /** Engine-side changes before the projection (a claim's verdict, the round kind…). */
  patch?: (state: ShowState, nowMs: number) => ShowState;
  /** The laptop's link to the cloud, `agoMs` since its last change. */
  link?: { online: boolean; agoMs: number };
  notice?: string;
  /** Keep spinning and landing songs (and land a fixture's running transition). */
  live?: boolean;
  /** Drop the feed after `afterMs`, for `forMs` (the reconnect pill). */
  dropFeed?: { afterMs: number; forMs: number };
}

/** The demo phone's cards: card 123 (named) and 57 are each 1 song from a Line in the fixture story; 412 is a special card. */
export const DEMO_CARDS: readonly { id: number; name: string | null }[] = [
  { id: 123, name: 'Àvia' },
  { id: 57, name: null },
  { id: 412, name: null },
];

/** The presenters' verdict on the Check's claim. */
const decided = (status: 'valid' | 'invalid') => (s: ShowState): ShowState => {
  const flow = s as ShowState & Partial<FlowFields>;
  const claimId = flow.check?.claimId;
  const claims = (flow.claims ?? []).map((c) => (c.claimId === claimId ? { ...c, status } : c));
  return { ...flow, claims };
};

/** Every player state, by demo name. The README lists the URLs. */
export const PLAYER_DEMOS: Record<string, PlayerDemo> = {
  before: { fixture: 'before', cards: 'none' },
  beforeCards: { fixture: 'before', cards: 'default' },
  roundStart: { fixture: 'roundStart', cards: 'default' },
  shuffle: { fixture: 'shuffle', cards: 'default' },
  play: { fixture: 'play', cards: 'default' },
  live: { fixture: 'play', cards: 'default', live: true },
  spin: { fixture: 'spin', cards: 'default', live: true },
  suspense: { fixture: 'suspense', cards: 'default' },
  hold: { fixture: 'hold', cards: 'default' },
  /** Card 123's top Line is complete: plain marks, nothing announced. */
  lineDone: { fixture: 'play', cards: 'default', extraLanded: [69] },
  /** Card 123 is 1 song from Quina (a Line was confirmed earlier). */
  nearBingo: { fixture: 'play', cards: 'default', extraLanded: [69, 11, 64, 55], patch: (s) => ({ ...s, round: { ...s.round, lineConfirmed: true } }) },
  /** Card 123's last song just landed: every song marked, nothing announced (players claim it themselves). */
  cardFull: { fixture: 'play', cards: 'default', extraLanded: [69, 11, 64, 55, 66], patch: (s) => ({ ...s, round: { ...s.round, lineConfirmed: true } }) },
  special: { fixture: 'play', cards: 'default', patch: (s) => ({ ...s, round: { ...s.round, kind: 'special' } }) },
  check: { fixture: 'check', cards: 'default' },
  checkValid: { fixture: 'checkValid', cards: 'default', patch: decided('valid') },
  checkInvalid: { fixture: 'check', cards: 'default', patch: decided('invalid') },
  celebration: { fixture: 'celebration', cards: 'default' },
  celebrationBingo: { fixture: 'celebrationBingo', cards: 'default' },
  interval: { fixture: 'interval', cards: 'default' },
  after: { fixture: 'after', cards: 'default' },
  pause: { fixture: 'pause', cards: 'default' },
  offline: { fixture: 'play', cards: 'default', link: { online: false, agoMs: 25_000 } },
  reconnect: { fixture: 'play', cards: 'default', dropFeed: { afterMs: 1500, forMs: 6000 } },
  notice: { fixture: 'play', cards: 'default', notice: 'El bar tanca a les 00:30. Gràcies per venir!' },
};

/** The demo for a name: a player demo, else a shared fixture as it is, else `play`. */
export function demoFor(name: string): PlayerDemo {
  return PLAYER_DEMOS[name] ?? (FIXTURES[name] ? { fixture: name, cards: 'default' } : PLAYER_DEMOS.play);
}

const LIVE_FIRST = [74, 69, 20, 11, 64, 55, 66];
const SPIN_MS = 6000;
const BETWEEN_MS = 4000;
const SLOT_MS = 14_000;

const songRef = (songId: number) => ({ songId, title: FIXTURE_SONGS[songId]?.[0] ?? `Cançó ${songId}`, artist: FIXTURE_SONGS[songId]?.[1] ?? '' });

/** The fixture story's whole round so far (the fixture snapshot carries only its last 10), plus `extra`. */
export function storyLandings(state: ShowState, extra: readonly number[], nowMs: number): LandingInfo[] | null {
  const tail = state.landings;
  const isStory = tail.length > 0 && tail.every((l) => FIXTURE_LANDED[l.position] === l.songId);
  if (!isStory && !extra.length) return null;
  const ids = [...(isStory ? FIXTURE_LANDED : tail.map((l) => l.songId)), ...extra];
  return ids.map((songId, position) => ({ ...songRef(songId), position, atMs: nowMs - (ids.length - 1 - position) * SLOT_MS, undone: false }));
}

/** A deterministic history for an earlier round (positions 0..count-1). */
function pastRound(round: number, count: number, endMs: number): { position: number; songId: number; atMs: number }[] {
  const ids = Array.from({ length: 77 }, (_, i) => i + 1);
  let seed = round * 7919;
  for (let i = ids.length - 1; i > 0; i--) {
    seed = (seed * 1103515245 + 12345) % 2147483648;
    const j = seed % (i + 1);
    [ids[i], ids[j]] = [ids[j], ids[i]];
  }
  return ids.slice(0, count).map((songId, position) => ({ position, songId, atMs: endMs - (count - 1 - position) * SLOT_MS }));
}

export class DemoFeed implements PlayerFeed {
  readonly kind = 'demo' as const;
  readonly name: string;
  readonly demo: PlayerDemo;
  private readonly core: ProjectedFeedCore;
  private engine: ShowState | null = null;
  private link: PublicLink = { online: true, sinceMs: 0 };
  private upcoming: number[] = [];
  private timers: ReturnType<typeof setTimeout>[] = [];
  private online = false;

  constructor(name: string, random: () => number = Math.random) {
    this.name = name;
    this.demo = demoFor(name);
    this.core = new ProjectedFeedCore(random);
  }

  start(): void {
    if (this.engine) return;
    const now = Date.now();
    let state = FIXTURES[this.demo.fixture](now).state as ShowState;
    const full = storyLandings(state, this.demo.extraLanded ?? [], now);
    if (full) {
      const latest = full[full.length - 1].songId;
      state = { ...state, landings: full, queue: { ...state.queue, position: full.length - 1 }, current: { ...songRef(latest), hookId: 'h1', posSec: 6, endsAtMs: now + 60_000 } };
    }
    if (this.demo.patch) state = this.demo.patch(state, now);
    this.engine = state;
    this.link = this.demo.link ? { online: this.demo.link.online, sinceMs: now - this.demo.link.agoMs } : { online: true, sinceMs: now - 60 * 60_000 };
    // Earlier rounds, so Historial and Premis have something to show.
    for (let r = 1; r < state.round.number && r <= 2; r++) {
      const count = r === 1 ? 49 : 52;
      this.core.projector.seedRound(r, 'normal', now - (4 - r) * 30 * 60_000, true, pastRound(r, count, now - (3 - r) * 30 * 60_000));
    }
    const landed = new Set([...state.landings.map((l) => l.songId), ...(state.transition ? [state.transition.to] : [])]);
    this.upcoming = [...LIVE_FIRST, ...Array.from({ length: 77 }, (_, i) => i + 1)].filter((id, i, all) => !landed.has(id) && all.indexOf(id) === i);
    this.later(50, () => {
      this.online = true;
      this.core.setOnline(true);
      this.ingestState();
      if (this.demo.live) this.continueLive();
    });
    const drop = this.demo.dropFeed;
    if (drop) {
      this.later(drop.afterMs, () => this.setOnline(false));
      this.later(drop.afterMs + drop.forMs, () => this.setOnline(true));
    }
  }

  stop(): void {
    for (const t of this.timers) clearTimeout(t);
    this.timers = [];
  }

  now(): number {
    return this.core.now();
  }

  setCards(): void {
    // Demo only.
  }

  subscribe(listener: (update: FeedUpdate) => void): () => void {
    return this.core.subscribe(listener);
  }

  private later(ms: number, fn: () => void): void {
    this.timers.push(setTimeout(fn, ms));
  }

  private setOnline(online: boolean): void {
    this.online = online;
    this.core.setOnline(online);
    if (online) this.publish();
  }

  private ingestState(): void {
    if (!this.engine) return;
    this.core.projector.ingest({ ...this.engine, atMs: Date.now() }, Date.now());
    this.publish();
  }

  private publish(): void {
    if (!this.online) return;
    this.core.publish({
      nowMs: Date.now(),
      edition: SAMPLE_PLAN.edition,
      gameId: `demo-${this.name}`,
      link: this.link,
      plan: SAMPLE_PLAN,
      notice: this.demo.notice ?? null,
      soundsDefault: true,
    });
  }

  /** Land a running transition when due, then keep spinning and landing (live demos). */
  private continueLive(): void {
    const t = this.engine?.transition;
    if (t) this.later(Math.max(0, t.landAtMs - Date.now()), () => this.land(t.to, t.id));
    else this.later(BETWEEN_MS, () => this.spin());
  }

  private spin(): void {
    const songId = this.upcoming.shift();
    if (!this.engine || songId === undefined) return;
    const id = `demo-${this.engine.queue.position + 1}`;
    const landAtMs = Date.now() + SPIN_MS;
    // The target sits in the engine's private field, as in a real show; the projection never reads it.
    this.engine = { ...this.engine, status: 'transition', autoAtMs: null, transition: { id, recipe: 'R1', phase: this.engine.phase, to: songId, landAtMs } };
    this.ingestState();
    this.later(SPIN_MS, () => this.land(songId, id));
  }

  private land(songId: number, id: string): void {
    if (!this.engine) return;
    const atMs = Date.now();
    const position = this.engine.queue.position + 1;
    this.engine = {
      ...this.engine,
      status: 'playing',
      transition: null,
      queue: { ...this.engine.queue, position },
      current: { ...songRef(songId), hookId: 'h1', posSec: 0, endsAtMs: atMs + 60_000 },
      landings: [...this.engine.landings, { ...songRef(songId), position, atMs, undone: false }],
      heat: Math.min(1, (this.engine.heat ?? 0.5) + 0.04),
    };
    this.core.projector.ingest({ v: PROTOCOL_VERSION, type: 'transition.landed', id, songId, position, atMs }, atMs);
    this.ingestState();
    this.later(BETWEEN_MS, () => this.spin());
  }
}
