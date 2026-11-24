// Projection: the engine's full events (relay or fixtures) → the public feed's PublicState, wrapped as
// `public.state` snapshots. Development only: in production the cloud builds the public state itself
// (cloud/src/domain/projection.ts). It exists so the player app runs on the same shape and the same
// `followFeed` path with every adapter, and it follows the cloud's semantics where they matter (a Check stays
// 'pending' until a presenter decides; `intro` until the round starts; Heat only as eased samples).
//
// STRICT WHITELIST. Every output field is built here one by one from named inputs; nothing from the engine
// is spread or copied whole. It never reads, so can never leak:
//   state.next, state.queue (beyond the last counted position), transition.to, drum.targetId, possibleWinners,
//   phase, the raw Heat, claims' outcome/warnings/completeSince, a Check's steps, winners' names and notes,
//   the journal, the plan's cheat sheet and its locked rounds' prizes (the plan goes out as publicPlan, like
//   the cloud's).
// tests/ui/player/project.test.ts feeds it a fixture full of private values and checks none come out.
import { PROTOCOL_VERSION, defaultCardType, type IncomingEvent, type RoundKind, type ShowState } from '@quina/protocol';
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
  startedAtMs: number;
  lineConfirmed: boolean;
  /** position → landing, counted landings only. */
  landings: Map<number, PublicLanding>;
}

/** The round being introduced, as newer engines send it (`state.intro`); older ones don't. */
type MaybeIntro = { intro?: { round: number; kind: RoundKind; cardType?: string } | null };

/** Keep the first-seen time of at most this many Spins. */
const SPIN_MEMORY = 8;

export class PublicProjector {
  private seq = 0;
  private state: ShowState | null = null;
  private readonly rounds = new Map<number, RoundLog>();
  private readonly spinStarts = new Map<string, number>();
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
      case 'suspense.started':
        // Only the Spin's public timing; never `to` or `drum`.
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
  seedRound(number: number, kind: RoundKind, startedAtMs: number, lineConfirmed: boolean, landings: readonly PublicLanding[], cardType = defaultCardType(kind)): void {
    const log: RoundLog = { number, kind, cardType, startedAtMs, lineConfirmed, landings: new Map() };
    for (const l of landings) log.landings.set(l.position, landing(l.position, l.songId, l.atMs));
    this.rounds.set(number, log);
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
    // An older engine sends no card type: the kind's default.
    const intro = explicitIntro
      ? { round: explicitIntro.round, kind: explicitIntro.kind, cardType: explicitIntro.cardType ?? defaultCardType(explicitIntro.kind) }
      : introducing && s && currentNumber !== null
        ? { round: currentNumber, kind: s.round.kind, cardType: s.round.cardType ?? defaultCardType(s.round.kind) }
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
        log = { number: n, kind: s.round.kind, cardType: defaultCardType(s.round.kind), startedAtMs: s.round.startedAtMs, lineConfirmed: false, landings: new Map() };
        this.rounds.set(n, log);
      }
      log.kind = s.round.kind === 'special' ? 'special' : 'normal';
      log.cardType = s.round.cardType ?? defaultCardType(log.kind);
      log.startedAtMs = s.round.startedAtMs || log.startedAtMs;
      log.lineConfirmed = s.round.lineConfirmed;
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
  }

  private projectSpin(s: ShowState | null, nowMs: number): PublicSpin | null {
    if (!s) return null;
    if (s.suspense) return { startAtMs: this.spinStarts.get(s.suspense.id) ?? nowMs, landAtMs: null };
    if (s.transition) return { startAtMs: this.spinStarts.get(s.transition.id) ?? nowMs, landAtMs: s.transition.landAtMs };
    return null;
  }

  private projectHeat(): PublicHeat | null {
    const last = this.heat.samples[this.heat.samples.length - 1];
    return last ? { value: last.value, fromMs: last.fromMs, toMs: last.toMs } : null;
  }
}

const landing = (position: number, songId: number, atMs: number): PublicLanding => ({ position, songId, atMs });

function projectRound(log: RoundLog, currentNumber: number | null, flow: FlowFields, winners: readonly PublicWinner[]): PublicRound {
  const won = (kind: 'line' | 'bingo') => winners.some((w) => w.round === log.number && w.kind === kind);
  const isCurrent = log.number === currentNumber;
  const ended = won('bingo') || (currentNumber !== null && log.number < currentNumber) || (isCurrent && (flow.scene === 'interval' || flow.scene === 'after'));
  return {
    number: log.number,
    kind: log.kind,
    cardType: log.cardType,
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

/** Which card and what for, and the presenters' verdict only: 'pending' until a presenter decides. */
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
