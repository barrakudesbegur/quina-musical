// Projection: the engine's full events (relay or fixtures) → the public feed's PublicState, wrapped as
// `public.state` snapshots. Development only: in production the cloud builds the public state itself
// (cloud/src/domain/projection.ts). It exists so the player app runs on the same shape and the same
// `followFeed` path with every adapter, and it follows the cloud's semantics where they matter (a Check stays
// 'pending' until a presenter decides; `intro` until the round starts; Heat only as eased samples).
//
// STRICT WHITELIST. Every output field is built here one by one from named inputs; nothing from the engine
// is spread or copied whole. It never reads, so can never leak:
//   state.next, state.queue (beyond the last counted position), transition.to, possibleWinners,
//   phase, the raw Heat, claims' outcome/warnings/completeSince, a Check's steps, winners' names and notes,
//   the journal, the plan's cheat sheet and its locked rounds' prizes (the plan goes out as publicPlan, like
//   the cloud's).
// The drum's public seeds (D237), as the cloud projects them: a Spin's `spinSeed` from its `transition.scheduled` (never
// while a Suspense is held), and a round's `drumSeed` from the engine's state (`state.round.drumSeed`, the same value
// the journal has on `round.started`) or where this projector is given it (`seedRound`, `setDrumSeed`: the demos). Only an
// older engine's state has none: the phone then orders the drum by the round's number (logic/drum.ts).
// A Spin's landing song (`targetId`, D277: U206 answered, public from the Spin's start; the phones reveal it only at
// landAtMs) from its `transition.scheduled`'s `drum.targetId`, as the cloud's: never while a Suspense is held.
// tests/ui/player/project.test.ts feeds it a fixture full of private values and checks none come out.
import { DEFAULT_SIDE, PROTOCOL_VERSION, defaultCardType, isRoundKind, type IncomingEvent, type RoundKind, type ShowState } from '@quina/protocol';
import { flowOf, type FlowFields } from '../../../packages/ui/flow.ts';
import { publicPlan, revealedRounds, type GamePlan } from '../../../packages/ui/plan.ts';
import { HeatSmoother } from '../../../packages/rules/heat.ts';
import { roundGameEnd, type PublicCheck, type PublicHeat, type PublicLanding, type PublicLink, type PublicRound, type PublicShuffle, type PublicSnapshot, type PublicSpin, type PublicState, type PublicWinner } from './public.ts';

/** What the projection needs besides the engine's events. */
export interface ProjectionContext {
  /** The show's clock now (epoch ms). */
  nowMs: number;
  edition: string;
  gameId: string | null;
  /** Is the show page (the laptop) connected. */
  link: PublicLink;
  /** The whole plan: the projection keeps only what phones may see (publicPlan, with the engine's reveals). */
  plan: GamePlan | null;
  notice: string | null;
  soundsDefault: boolean;
}

interface RoundLog {
  number: number;
  kind: RoundKind;
  /** The printed card type it plays (public: it's on the cards). */
  cardType: string;
  /** The card's side it plays (public: phones mark that side's songs). */
  side: number;
  startedAtMs: number;
  lineConfirmed: boolean;
  /** position → landing, counted landings only. */
  landings: Map<number, PublicLanding>;
  /** The drum's public order seed, when known (D237). */
  drumSeed?: number;
}

/** The round being introduced, as newer engines send it (`state.intro`); older ones don't. */
type MaybeIntro = { intro?: { round: number; kind: RoundKind; cardType?: string; side?: number } | null };

/** Keep the first-seen time of at most this many Spins. */
const SPIN_MEMORY = 8;

export class PublicProjector {
  private seq = 0;
  private state: ShowState | null = null;
  private readonly rounds = new Map<number, RoundLog>();
  private readonly spinStarts = new Map<string, number>();
  /** Each Spin's public seed (D237), from its `transition.scheduled`. */
  private readonly spinSeeds = new Map<string, number>();
  /** Each Spin's landing song (D277), from its `transition.scheduled`. */
  private readonly spinTargets = new Map<string, number>();
  private readonly heat: HeatSmoother;

  constructor(random: () => number = Math.random) {
    this.heat = new HeatSmoother(random);
  }

  /** Feed one engine event, at the show clock's `nowMs`. Unknown events are ignored. */
  ingest(event: IncomingEvent, nowMs: number): void {
    switch (event.type) {
      case 'state':
        this.ingestState(event, nowMs);
        break;
      case 'transition.scheduled':
        // Only the Spin's public timing, seed and landing song (drum.targetId, D277); never `to` or the rest of `drum`.
        this.noteSpin(event.id, event.spinStartAtMs);
        if (Number.isInteger(event.spinSeed)) this.spinSeeds.set(event.id, event.spinSeed);
        if (Number.isInteger(event.drum?.targetId)) this.spinTargets.set(event.id, event.drum.targetId);
        break;
      case 'suspense.started':
        this.noteSpin(event.id, event.spinStartAtMs);
        break;
      case 'transition.landed':
        this.currentLog()?.landings.set(event.position, landing(event.position, event.songId, event.atMs));
        break;
      case 'landing.undone':
        this.currentLog()?.landings.delete(event.position);
        break;
      default:
        break;
    }
  }

  /**
   * Seed an earlier round the projector never saw (the demo's history). Live feeds don't need it: they log
   * every round from the moment they connect.
   */
  seedRound(number: number, kind: RoundKind, startedAtMs: number, lineConfirmed: boolean, landings: readonly PublicLanding[], cardType = defaultCardType(kind), side = DEFAULT_SIDE, drumSeed?: number): void {
    const log: RoundLog = { number, kind, cardType, side, startedAtMs, lineConfirmed, landings: new Map(), ...(drumSeed !== undefined ? { drumSeed } : {}) };
    for (const l of landings) log.landings.set(l.position, landing(l.position, l.songId, l.atMs));
    this.rounds.set(number, log);
  }

  /** A round's public drum seed (D237), as the engine journals it with `round.started` (the demos give it here). */
  setDrumSeed(round: number, drumSeed: number): void {
    const log = this.rounds.get(round);
    if (log) log.drumSeed = drumSeed;
  }

  /** The public state for now. */
  project(ctx: ProjectionContext): PublicState {
    const s = this.state;
    const flow = flowOf(s);
    const currentNumber = s && s.round.number >= 1 ? s.round.number : null;
    const current = currentNumber === null ? undefined : this.rounds.get(currentNumber);
    // Being introduced: in roundStart, before its Shuffle and its first landing. The cloud adds the round to
    // `rounds` only once it starts.
    const introducing = flow.scene === 'roundStart' && !flow.shuffle && (!current || current.landings.size === 0);
    const explicitIntro = s ? (s as MaybeIntro).intro : null;
    // An older engine sends no card type (the kind's default) nor side (side 1).
    const intro = explicitIntro
      ? { round: explicitIntro.round, kind: explicitIntro.kind, cardType: explicitIntro.cardType ?? defaultCardType(explicitIntro.kind), side: explicitIntro.side ?? DEFAULT_SIDE }
      : introducing && s && currentNumber !== null
        ? { round: currentNumber, kind: s.round.kind, cardType: s.round.cardType ?? defaultCardType(s.round.kind), side: s.round.side ?? DEFAULT_SIDE }
        : null;
    const winners = projectWinners(flow);
    const rounds = [...this.rounds.values()]
      .filter((log) => !(intro && log.number === intro.round && log.landings.size === 0))
      .sort((a, b) => a.number - b.number)
      .map((log) => projectRound(log, currentNumber, flow, winners));
    return {
      edition: String(ctx.edition),
      gameId: ctx.gameId,
      scene: flow.scene,
      intro,
      shuffle: projectShuffle(flow),
      pause: flow.pause ? { sinceMs: flow.pause.sinceMs } : null,
      link: { online: ctx.link.online, sinceMs: ctx.link.sinceMs },
      rounds,
      spin: this.projectSpin(s, ctx.nowMs),
      heat: this.projectHeat(),
      check: projectCheck(flow, currentNumber ?? 0),
      winners,
      interval: flow.interval ? { nextRound: flow.interval.nextRound, guideEndMs: flow.interval.guideEndMs } : null,
      gameEndMs: s && s.schedule.gameEndMs > 0 ? roundGameEnd(s.schedule.gameEndMs) : null,
      plan: ctx.plan ? publicPlan(ctx.plan, revealedRounds(ctx.plan, s?.prizes?.revealed ?? [])) : null,
      notice: ctx.notice,
      soundsDefault: ctx.soundsDefault,
    };
  }

  /** The public state for now as a feed message, with the next seq. */
  snapshot(ctx: ProjectionContext): PublicSnapshot {
    return { v: PROTOCOL_VERSION, type: 'public.state', seq: ++this.seq, nowMs: ctx.nowMs, state: this.project(ctx) };
  }

  private ingestState(s: ShowState, nowMs: number): void {
    this.state = s;
    const n = s.round.number;
    if (n >= 1) {
      let log = this.rounds.get(n);
      // The same round number started again (a new run): forget the old landings.
      if (log && log.startedAtMs && s.round.startedAtMs && log.startedAtMs !== s.round.startedAtMs) log = undefined;
      if (!log) {
        log = { number: n, kind: s.round.kind, cardType: defaultCardType(s.round.kind), side: DEFAULT_SIDE, startedAtMs: s.round.startedAtMs, lineConfirmed: false, landings: new Map() };
        this.rounds.set(n, log);
      }
      log.kind = isRoundKind(s.round.kind) ? s.round.kind : 'normal';
      log.cardType = s.round.cardType ?? defaultCardType(log.kind);
      log.side = s.round.side ?? DEFAULT_SIDE;
      log.startedAtMs = s.round.startedAtMs || log.startedAtMs;
      log.lineConfirmed = s.round.lineConfirmed;
      if (s.round.drumSeed !== undefined) log.drumSeed = s.round.drumSeed;
      const last = s.queue.position;
      for (const l of s.landings) {
        if (l.undone || l.position > last) log.landings.delete(l.position);
        else log.landings.set(l.position, landing(l.position, l.songId, l.atMs));
      }
      // Back undid these.
      for (const p of [...log.landings.keys()]) if (p > last) log.landings.delete(p);
    }
    this.heat.push(s.heat, nowMs);
    if (s.transition) this.noteSpin(s.transition.id, nowMs, false);
    if (s.suspense) this.noteSpin(s.suspense.id, nowMs, false);
  }

  private currentLog(): RoundLog | undefined {
    const n = this.state?.round.number ?? 0;
    return n >= 1 ? this.rounds.get(n) : undefined;
  }

  /** Remember when a Spin started. `exact` times (from the Spin's own event) replace a first-seen guess. */
  private noteSpin(id: string, atMs: number, exact = true): void {
    if (!exact && this.spinStarts.has(id)) return;
    this.spinStarts.set(id, atMs);
    while (this.spinStarts.size > SPIN_MEMORY) this.spinStarts.delete(this.spinStarts.keys().next().value as string);
    while (this.spinSeeds.size > SPIN_MEMORY) this.spinSeeds.delete(this.spinSeeds.keys().next().value as string);
    while (this.spinTargets.size > SPIN_MEMORY) this.spinTargets.delete(this.spinTargets.keys().next().value as string);
  }

  private projectSpin(s: ShowState | null, nowMs: number): PublicSpin | null {
    if (!s) return null;
    if (s.suspense) return { startAtMs: this.spinStarts.get(s.suspense.id) ?? nowMs, landAtMs: null };
    if (s.transition) {
      const spinSeed = this.spinSeeds.get(s.transition.id);
      const targetId = this.spinTargets.get(s.transition.id);
      return {
        startAtMs: this.spinStarts.get(s.transition.id) ?? nowMs,
        landAtMs: s.transition.landAtMs,
        ...(spinSeed !== undefined ? { spinSeed } : {}),
        ...(targetId !== undefined ? { targetId } : {}),
      };
    }
    return null;
  }

  private projectHeat(): PublicHeat | null {
    const last = this.heat.samples[this.heat.samples.length - 1];
    return last ? { value: last.value, fromMs: last.fromMs, toMs: last.toMs } : null;
  }
}

const landing = (position: number, songId: number, atMs: number): PublicLanding => ({ position, songId, atMs });

function projectRound(log: RoundLog, currentNumber: number | null, flow: FlowFields, winners: readonly PublicWinner[]): PublicRound {
  const won = (kind: PublicWinner['kind']) => winners.some((w) => w.round === log.number && w.kind === kind);
  const isCurrent = log.number === currentNumber;
  // The Bingo, or the Desgraciat round's last card standing, ends the round (as the cloud's projection does).
  const ended = won('bingo') || won('standing') || (currentNumber !== null && log.number < currentNumber) || (isCurrent && (flow.scene === 'interval' || flow.scene === 'after'));
  return {
    number: log.number,
    kind: log.kind,
    cardType: log.cardType,
    side: log.side,
    ...(log.drumSeed !== undefined ? { drumSeed: log.drumSeed } : {}),
    startedAtMs: log.startedAtMs,
    lineConfirmed: log.lineConfirmed || won('line') || won('bingo'),
    ended,
    landings: [...log.landings.values()].sort((a, b) => a.position - b.position).map((l) => landing(l.position, l.songId, l.atMs)),
  };
}

function projectShuffle(flow: FlowFields): PublicShuffle | null {
  const s = flow.shuffle;
  return s ? { round: s.round, startAtMs: s.startAtMs, endAtMs: s.endAtMs } : null;
}

/**
 * Which card and what for, and its result only from the presenters' cue (the paced Check, D107: the Claim is decided
 * at its cue): 'pending' while its songs are revealed, under review (U79: nothing new for phones) and at its cue
 * before it's pressed. Never its reveals.
 */
function projectCheck(flow: FlowFields, round: number): PublicCheck | null {
  const check = flow.check;
  if (!check) return null;
  const status = flow.claims.find((c) => c.claimId === check.claimId)?.status;
  return { round, cardId: check.cardId, kind: check.kind, result: status === 'valid' ? 'valid' : status === 'invalid' ? 'invalid' : 'pending' };
}

/** Winning card numbers per prize, in the order they were won, plus a Celebration's cards. Never names or notes. */
function projectWinners(flow: FlowFields): PublicWinner[] {
  const out: PublicWinner[] = [];
  const add = (round: number, kind: PublicWinner['kind'], cardId: number) => {
    let group = out.find((w) => w.round === round && w.kind === kind);
    if (!group) {
      group = { round, kind, cardIds: [] };
      out.push(group);
    }
    if (!group.cardIds.includes(cardId)) group.cardIds.push(cardId);
  };
  for (const w of flow.winners) add(w.round, w.kind, w.cardId);
  const c = flow.celebration;
  if (c) for (const id of c.cardIds) add(c.round, c.kind, id);
  return out;
}
