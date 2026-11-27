// DemoFeed: `?demo=<name>` runs the player app on the shared fixtures (ui/fixtures/states.ts), projected through
// the same whitelist and the same `followFeed` path as the real feeds, so every screen can be reviewed without
// the show page, the relay or the cloud. A player demo picks a fixture and may add landings, patch the engine
// state, cut the laptop link, drop the feed, post Admin's notice, keep landing songs (`live`) or publish another plan.
// Fixture names that aren't player demos run as they are; unknown names fall back to `play`.
import { PROTOCOL_VERSION, type EventOf, type LandingInfo, type ShowState } from '@quina/protocol';
import { DESGRACIAT_LANDED, FIXTURES, FIXTURE_LANDED, FIXTURE_SONGS } from '../../../packages/ui/fixtures/states.ts';
import { SAMPLE_PLAN } from '../../../packages/ui/fixtures/plan.ts';
import type { FlowFields } from '../../../packages/ui/flow.ts';
import type { GamePlan } from '../../../packages/ui/plan.ts';
import type { FeedUpdate, PlayerFeed } from './feed.ts';
import { ProjectedFeedCore } from './projected-feed.ts';
import type { PublicLink } from './public.ts';

export interface PlayerDemo {
  /** The shared fixture it starts from. */
  fixture: string;
  /** Which cards the demo phone holds ('none' shows the empty, first-open screens), or these card numbers. */
  cards: 'none' | 'default' | readonly number[];
  /** Landings after the fixture's, oldest first. */
  extraLanded?: readonly number[];
  /** Engine-side changes before the projection (a claim's verdict, the round kind…). */
  patch?: (state: ShowState, nowMs: number) => ShowState;
  /** The laptop's link to the cloud, `agoMs` since its last change. */
  link?: { online: boolean; agoMs: number };
  notice?: string;
  /** Keep spinning and landing songs (and land a fixture's running transition). */
  live?: boolean;
  /** The songs a live demo lands first (else LIVE_FIRST). */
  liveFirst?: readonly number[];
  /** Drop the feed after `afterMs`, for `forMs` (the reconnect pill). */
  dropFeed?: { afterMs: number; forMs: number };
  /** The Game plan the demo publishes (else SAMPLE_PLAN). */
  plan?: GamePlan;
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
  /** The home's spins (§8 Y2): «Waka Waka» lands (one line), then «Vivir Así Es Morir de Amor» (two lines: the full drum
   *  grows, the views slide), then «Dancing in the Moonlight» (shorter again); the words stay, faded, while it turns. */
  spinLong: { fixture: 'spin', cards: 'default', live: true, liveFirst: [73, 16, 69] },
  suspense: { fixture: 'suspense', cards: 'default' },
  hold: { fixture: 'hold', cards: 'default' },
  /** Card 123's top Line is complete: plain marks, nothing announced. */
  lineDone: { fixture: 'play', cards: 'default', extraLanded: [69] },
  /** Card 123 is 1 song from Quina (a Line was confirmed earlier). */
  nearBingo: { fixture: 'play', cards: 'default', extraLanded: [69, 11, 64, 55], patch: (s) => ({ ...s, round: { ...s.round, lineConfirmed: true } }) },
  /** Card 123's last song just landed: every song marked, nothing announced (players claim it themselves). */
  cardFull: { fixture: 'play', cards: 'default', extraLanded: [69, 11, 64, 55, 66], patch: (s) => ({ ...s, round: { ...s.round, lineConfirmed: true } }) },
  /** Live, the your-song look (D74): 69 and 64 are on #123 and #57 (two in a row), 74 only on #412, which doesn't play
   * a regular round, then 20 is on #57 again. `lineDone` opens on one of your songs already playing (no flash). */
  yourSong: { fixture: 'play', cards: 'default', live: true, liveFirst: [69, 64, 74, 20] },
  special: { fixture: 'play', cards: 'default', patch: (s) => ({ ...s, round: { ...s.round, kind: 'special' } }) },
  // The garland at each Heat level (ANIMATIONS.md "The garland's lights"): cool, warm, hot, very hot (flames).
  heatCold: { fixture: 'playCold', cards: 'default' },
  heatWarm: { fixture: 'playWarm', cards: 'default' },
  heatHot: { fixture: 'playHot', cards: 'default' },
  heatFire: { fixture: 'playFire', cards: 'default' },
  /** Your song (the `party` lights) with the Heat very hot: the party colours and the flames. */
  yourSongFire: { fixture: 'playFire', cards: 'default', live: true, liveFirst: [69, 64, 74, 20] },
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
  // The Desgraciat round (Quina 5 in the shared fixtures, played on the normal cards; ANIMATIONS.md › The
  // Desgraciat round › Player app). Of the demo cards, «Breaking Free» (11) sinks #123 and «SUPERESTRELLA» (60)
  // sinks #57; #412 is an especial card, so it doesn't play. In the fixtures' story #57 is the last one standing.
  /** Two landings in: both playing cards stand (DEMPEUS). */
  desgraciat: { fixture: 'desgraciat', cards: 'default' },
  /** Live: «Breaking Free» lands and sinks #123 (`card-fall`); later landings on it only stamp their ✗. */
  desgraciatFall: { fixture: 'desgraciat', cards: 'default', live: true, liveFirst: [11, ...DESGRACIAT_LANDED.slice(2).filter((id) => id !== 11)] },
  /** Both playing cards seated (ASSEGUT), each with the ✗s of its landed songs. */
  desgraciatSeated: { fixture: 'desgraciat', cards: 'default', extraLanded: [30, 11, 45, 60, 56, 41] },
  /** #57, one of the phone's cards, is the last standing and confirmed: its card glowing, the nino, no title. */
  desgraciatMine: { fixture: 'celebrationStanding', cards: 'default' },
  /** Someone else's card (#57) is the last standing: the prize and confetti, no title, no card number. */
  desgraciatOther: { fixture: 'celebrationStanding', cards: [123, 412] },
  /** Every prize kept secret until the presenters reveal it (GamePlan.prizeReveal 'allSecret'): Premis shows the
   * "Secrets" lock on every round not revealed yet. */
  prizesSecret: { fixture: 'play', cards: 'default', plan: { ...SAMPLE_PLAN, prizeReveal: 'allSecret' } },
  /**
   * A plan with the doors' time, a start time and Throws after Quina 2 and Quina 6, set so Quina 3 starts on time:
   * Horari shows every row, "Venda de cartrons" and the "Primer descans" done, "~" times for what's next, the
   * "Segon descans" among them, then "Fi".
   */
  schedule: {
    fixture: 'play',
    cards: 'default',
    plan: (() => {
      const startAtMs = (Math.floor(Date.now() / 60_000) - 66) * 60_000;
      const throws = [{ afterRound: 2, minutes: 6 }, { afterRound: 6, minutes: 6 }];
      return { ...SAMPLE_PLAN, schedule: { doorsAtMs: startAtMs - 30 * 60_000, startAtMs, roundMinutes: 22, intervalMinutes: 4, throws } };
    })(),
  },
};

/** The demo for a name: a player demo, else a shared fixture as it is, else `play`. */
export function demoFor(name: string): PlayerDemo {
  return PLAYER_DEMOS[name] ?? (FIXTURES[name] ? { fixture: name, cards: 'default' } : PLAYER_DEMOS.play);
}

const LIVE_FIRST = [74, 69, 20, 11, 64, 55, 66];
const SPIN_MS = 6000;
const BETWEEN_MS = 4000;
const SLOT_MS = 14_000;

/** A demo round's public drum seed (D237), as the engine would journal it: fixed per round, so a demo replays. */
const demoDrumSeed = (round: number): number => Math.imul(0x9e3779b9, round + 1) >>> 0;

/** A Spin as the engine schedules it, for its public timing and seed (the projection keeps only those). */
function scheduled(id: string, to: number, position: number, spinStartAtMs: number, landAtMs: number, phase: ShowState['phase']): EventOf<'transition.scheduled'> {
  return {
    v: PROTOCOL_VERSION, type: 'transition.scheduled', id, reqId: null, from: null, to, position, phase, recipe: 'R1', recipeName: 'demo',
    exit: null, shape: 'S1', spinStartAtMs, exitAtMs: landAtMs, landAtMs, durationMs: landAtMs - spinStartAtMs, hookId: 'h1', bpm: null,
    drum: { removeId: null, targetId: to, minLaps: 1 }, spinSeed: Math.imul(0x85ebca6b, position + 7) >>> 0,
  };
}

const songRef = (songId: number) => ({ songId, title: FIXTURE_SONGS[songId]?.[0] ?? `Cançó ${songId}`, artist: FIXTURE_SONGS[songId]?.[1] ?? '' });

/** The fixtures' stories: Quina 3's, and the Desgraciat round's (Quina 5). */
const STORIES: readonly (readonly number[])[] = [FIXTURE_LANDED, DESGRACIAT_LANDED];

/**
 * A fixture story's whole round so far (the fixture snapshot carries only its last 10, so a card could look
 * sunk by the wrong song), plus `extra`.
 */
export function storyLandings(state: ShowState, extra: readonly number[], nowMs: number): LandingInfo[] | null {
  const tail = state.landings;
  const last = tail[tail.length - 1]?.position ?? -1;
  const story = tail.length > 0 ? STORIES.find((ids) => tail.every((l) => ids[l.position] === l.songId)) : undefined;
  if (!story && !extra.length) return null;
  const ids = [...(story ? story.slice(0, last + 1) : tail.map((l) => l.songId)), ...extra];
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
      state = { ...state, landings: full, queue: { ...state.queue, position: full.length - 1 }, current: { ...songRef(latest), hookId: 'h1', firstPlay: false, posSec: 6, endsAtMs: now + 60_000 } };
    }
    if (this.demo.patch) state = this.demo.patch(state, now);
    this.engine = state;
    this.link = this.demo.link ? { online: this.demo.link.online, sinceMs: now - this.demo.link.agoMs } : { online: true, sinceMs: now - 60 * 60_000 };
    // Earlier rounds, so Historial and Premis have something to show.
    const n = state.round.number;
    for (let r = 1; r < n; r++) {
      const count = 49 + ((r * 3) % 7);
      this.core.projector.seedRound(r, 'normal', now - (n - r + 1) * 30 * 60_000, true, pastRound(r, count, now - (n - r) * 30 * 60_000), undefined, undefined, demoDrumSeed(r));
    }
    const landed = new Set([...state.landings.map((l) => l.songId), ...(state.transition ? [state.transition.to] : [])]);
    this.upcoming = [...(this.demo.liveFirst ?? LIVE_FIRST), ...Array.from({ length: 77 }, (_, i) => i + 1)].filter((id, i, all) => !landed.has(id) && all.indexOf(id) === i);
    this.later(50, () => {
      this.online = true;
      this.core.setOnline(true);
      // The fixture's running Spin, scheduled as it is first seen (its public seed).
      const t = this.engine?.transition;
      if (t && this.engine) this.core.projector.ingest(scheduled(t.id, t.to, this.engine.queue.position + 1, Date.now(), t.landAtMs, this.engine.phase), Date.now());
      this.ingestState();
      if (this.engine) this.core.projector.setDrumSeed(this.engine.round.number, demoDrumSeed(this.engine.round.number));
      this.publish();
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
      plan: this.demo.plan ?? SAMPLE_PLAN,
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
    this.core.projector.ingest(scheduled(id, songId, this.engine.queue.position + 1, Date.now(), landAtMs, this.engine.phase), Date.now());
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
      current: { ...songRef(songId), hookId: 'h1', firstPlay: true, posSec: 0, endsAtMs: atMs + 60_000 },
      landings: [...this.engine.landings, { ...songRef(songId), position, atMs, undone: false }],
      heat: Math.min(1, (this.engine.heat ?? 0.5) + 0.04),
    };
    this.core.projector.ingest({ v: PROTOCOL_VERSION, type: 'transition.landed', id, songId, position, atMs }, atMs);
    this.ingestState();
    this.later(BETWEEN_MS, () => this.spin());
  }
}
