// The public projection: which public changes a journal entry or a live show event makes. Pure. This is the
// one place that decides what phones may learn, so it is a whitelist by construction:
// - journal entries: an exhaustive switch, so tsc makes every new kind decide whether anything of it is public;
// - live events: only the cases below, and only the fields named there; every other event is private.
// Phones never get the Queue, the next song before a Spin, possible winners, the Phase, the real Heat, `roundEndMs`,
// a Check's steps before its verdict, a claim's details, or winners' names. A Spin does carry its landing song from
// its start (`targetId`, D277 for U206): phones reveal it only at `landAtMs`.
// Times arrive on the laptop's clock and leave on the cloud's (`toCloudMs`).
import type { GameRecord, JournalEntry, ShowEvent, ShowState } from '@quina/protocol';
import { DEFAULT_SIDE, defaultCardType, roundGameEnd, type PublicChange, type PublicRound, type PublicSpin, type PublicState } from '@quina/protocol';

export interface ProjectionContext {
  /** A laptop-clock epoch ms on the cloud's clock. */
  toCloudMs(laptopMs: number): number;
}

/**
 * The public changes a new journal entry makes. `state` is the public state before it, `record` the Game's
 * record right after it (for what the entry itself doesn't say, such as a decided claim's card).
 */
export function projectEntry(state: PublicState, entry: JournalEntry, record: GameRecord, ctx: ProjectionContext): PublicChange[] {
  switch (entry.kind) {
    case 'round.started': {
      const changes: PublicChange[] = [];
      const previous = state.rounds.at(-1);
      if (previous && !previous.ended && previous.number !== entry.round) changes.push({ kind: 'roundEnded', round: previous.number });
      const round: PublicRound = {
        number: entry.round,
        kind: entry.roundKind,
        cardType: entry.cardType ?? defaultCardType(entry.roundKind),
        ...sideOf(entry),
        ...drumSeedOf(entry),
        startedAtMs: ctx.toCloudMs(entry.startedAtMs),
        lineConfirmed: false,
        ended: false,
        landings: [],
      };
      changes.push({ kind: 'round', round });
      if (state.intro) changes.push({ kind: 'intro', intro: null });
      if (state.spin && ctx.toCloudMs(entry.atMs) >= state.spin.startAtMs) changes.push({ kind: 'spin', spin: null }); // not a late upload's
      if (state.check) changes.push({ kind: 'check', check: null });
      return changes;
    }
    case 'round.resumed': {
      // A manual resume (plan B): the round comes back whole, with songs 0..position counted (their real landing
      // times are unknown, so they carry the resume's), straight into play. Never its Queue beyond `position`.
      const changes: PublicChange[] = [];
      const previous = state.rounds.at(-1);
      if (previous && !previous.ended && previous.number !== entry.round) changes.push({ kind: 'roundEnded', round: previous.number });
      const atMs = ctx.toCloudMs(entry.atMs);
      const round: PublicRound = {
        number: entry.round,
        kind: entry.roundKind,
        cardType: entry.cardType ?? defaultCardType(entry.roundKind),
        ...sideOf(entry),
        ...drumSeedOf(entry),
        startedAtMs: ctx.toCloudMs(entry.startedAtMs),
        lineConfirmed: entry.lineConfirmedFrom !== null,
        ended: false,
        landings: entry.queue.slice(0, entry.position + 1).map((songId, position) => ({ position, songId, atMs })),
      };
      changes.push({ kind: 'round', round });
      if (state.intro) changes.push({ kind: 'intro', intro: null });
      if (state.shuffle) changes.push({ kind: 'shuffle', shuffle: null });
      if (state.spin && atMs >= state.spin.startAtMs) changes.push({ kind: 'spin', spin: null });
      if (state.check) changes.push({ kind: 'check', check: null });
      if (state.interval) changes.push({ kind: 'interval', interval: null });
      if (state.scene !== 'play') changes.push({ kind: 'scene', scene: 'play' });
      return changes;
    }
    case 'song.landed': {
      const atMs = ctx.toCloudMs(entry.atMs);
      const changes: PublicChange[] = [{ kind: 'landed', round: entry.round, landing: { position: entry.position, songId: entry.songId, atMs } }];
      // This landing ends the Spin only if it came after the Spin started: a journal catching up after an
      // offline stretch must not stop a newer Spin that the live events already showed.
      if (state.spin && atMs >= state.spin.startAtMs) changes.push({ kind: 'spin', spin: null });
      // A song only lands in play; this covers a journal whose `scene.changed` to play is still on its way.
      if (state.scene === 'roundStart' || state.scene === 'before') changes.push({ kind: 'scene', scene: 'play' });
      if (state.shuffle) changes.push({ kind: 'shuffle', shuffle: null });
      return changes;
    }
    case 'landing.undone':
      return [{ kind: 'undone', round: entry.round, position: entry.position }];
    case 'line.confirmed':
      return state.rounds.find((r) => r.number === entry.round)?.lineConfirmed ? [] : [{ kind: 'line', round: entry.round }];
    case 'scene.changed': {
      const changes: PublicChange[] = [];
      if (entry.scene !== state.scene) changes.push({ kind: 'scene', scene: entry.scene });
      // The round being introduced, unless it's already in play. Round 1 is already public before its intro: the
      // engine draws its Queue at boot (round.started, no Shuffle) so the first Spin can come without one.
      const inPlay = state.rounds.some((r) => r.number === entry.round && (r.landings.length > 0 || r.ended));
      if (entry.scene === 'roundStart' && !inPlay) {
        changes.push({ kind: 'intro', intro: { round: entry.round, kind: entry.roundKind, cardType: entry.cardType ?? defaultCardType(entry.roundKind), ...sideOf(entry) } });
      } else if (state.intro) {
        changes.push({ kind: 'intro', intro: null });
      }
      if (entry.scene !== 'check' && state.check) changes.push({ kind: 'check', check: null });
      if (entry.scene !== 'roundStart' && state.shuffle) changes.push({ kind: 'shuffle', shuffle: null });
      if (entry.scene !== 'interval' && state.interval) changes.push({ kind: 'interval', interval: null });
      return changes;
    }
    case 'claim.opened':
      // The Check is public once it's on screen (check.started), not when the claim is queued.
      return [];
    case 'claim.decided': {
      const claim = record.claims.find((c) => c.claimId === entry.claimId);
      if (!claim) return [];
      const changes: PublicChange[] = [];
      if (state.check && state.check.cardId === claim.cardId && state.check.result === 'pending') {
        changes.push({ kind: 'check', check: { ...state.check, result: entry.verdict } });
      }
      if (entry.verdict === 'valid') {
        changes.push({ kind: 'winner', winner: { round: entry.round, kind: claim.kind, cardIds: [claim.cardId] } });
        const round = state.rounds.find((r) => r.number === entry.round);
        if (claim.kind === 'line' && round && !round.lineConfirmed) changes.push({ kind: 'line', round: entry.round });
        // The Bingo, or the last card standing (the Desgraciat round), ends the round; neither confirms a Line.
        if ((claim.kind === 'bingo' || claim.kind === 'standing') && round && !round.ended) changes.push({ kind: 'roundEnded', round: entry.round });
      }
      return changes;
    }
    // A Review (D118–D121): what phones see of it is open (U76, U79), so for now the Check stays as it was, pending.
    case 'claim.reviewing':
    case 'claim.continued':
      return [];
    case 'claim.discarded': {
      // Discarded from a Review: the pending Check goes, with no mark and no winner.
      const claim = record.claims.find((c) => c.claimId === entry.claimId);
      const shown = claim && state.check && state.check.cardId === claim.cardId && state.check.result === 'pending';
      return shown ? [{ kind: 'check', check: null }] : [];
    }
    case 'prizes.revealed': // the GameRoom publishes the plan again, with this round's prizes (it holds the full plan)
    case 'winner.noted': // names and notes are private
    case 'cards.set': // the cards in play are the organizers' business
    case 'settings.changed': // Pace, auto-advance and the Phase placeholder would hint at the Phase
    case 'finale.set': // the Desgraciat's finalists: whether phones see the finale is U150; its wins come as claims
      return [];
    default:
      entry satisfies never;
      return [];
  }
}

/** The public changes a live show event makes. */
export function projectEvent(state: PublicState, event: ShowEvent, ctx: ProjectionContext): PublicChange[] {
  switch (event.type) {
    case 'transition.scheduled':
      // Its timing, its public spinSeed (D237) and its landing song, `drum.targetId`, from its start (D277, U206:
      // phones reveal it at landAtMs). Never the rest of `drum` (removeId, minLaps) or `to`.
      return spinChange(state, {
        startAtMs: ctx.toCloudMs(event.spinStartAtMs),
        landAtMs: ctx.toCloudMs(event.landAtMs),
        ...(event.spinSeed != null ? { spinSeed: event.spinSeed } : {}),
        ...(typeof event.drum?.targetId === 'number' ? { targetId: event.drum.targetId } : {}),
      });
    // A held Suspense's landing isn't chosen yet: no targetId. Its braking landing comes as a transition.scheduled.
    case 'suspense.started':
      return spinChange(state, { startAtMs: ctx.toCloudMs(event.spinStartAtMs), landAtMs: null });
    case 'transition.cancelled':
    case 'transition.landed': // the song itself comes from the journal's song.landed
      return spinChange(state, null);
    case 'shuffle.scheduled':
      return [{ kind: 'shuffle', shuffle: { round: event.round, startAtMs: ctx.toCloudMs(event.startAtMs), endAtMs: ctx.toCloudMs(event.endAtMs) } }];
    case 'check.started': {
      // Only which card and what for: its reveals and its outcome stay off phones (D107), so nothing public says
      // ahead of the cue whether the card passes; the result comes from the journal's claim.decided.
      const round = state.rounds.at(-1)?.number ?? 0;
      const { cardId, kind } = event.check;
      if (state.check && state.check.cardId === cardId && state.check.kind === kind && state.check.result === 'pending') return [];
      return [{ kind: 'check', check: { round, cardId, kind, result: 'pending' } }];
    }
    case 'state':
      return projectState(state, event, ctx);
    default:
      return [];
  }
}

/**
 * From the engine's full state, only the pause, the Interval and the Game's end, rounded; and the Spin stops
 * when the engine has nothing in flight (Panic and a new round end a Spin without `transition.cancelled`).
 */
function projectState(state: PublicState, show: ShowState, ctx: ProjectionContext): PublicChange[] {
  const changes: PublicChange[] = [];
  if (state.spin && show.transition === null && show.suspense === null) changes.push({ kind: 'spin', spin: null });
  // "Tornem de seguida" only where the projector shows it too: in a round, a Check or a Celebration (D135).
  const pause = show.pause?.overlay ? { sinceMs: ctx.toCloudMs(show.pause.sinceMs) } : null;
  if (pause?.sinceMs !== state.pause?.sinceMs) changes.push({ kind: 'pause', pause });
  const interval = show.interval ? { nextRound: show.interval.nextRound, guideEndMs: ctx.toCloudMs(show.interval.guideEndMs) } : null;
  if (interval?.nextRound !== state.interval?.nextRound || interval?.guideEndMs !== state.interval?.guideEndMs) changes.push({ kind: 'interval', interval });
  const gameEndMs = roundGameEnd(ctx.toCloudMs(show.schedule.gameEndMs));
  if (gameEndMs !== state.gameEndMs) changes.push({ kind: 'gameEnd', gameEndMs });
  return changes;
}

/** The card's side a round plays (D178), for phones to mark that face: only when it isn't 1, as the journal has it. */
function sideOf(entry: { side?: number }): { side?: number } {
  return entry.side && entry.side !== DEFAULT_SIDE ? { side: entry.side } : {};
}

/** The drum's public order seed (D237), only when the journal has it (an older engine's doesn't). */
function drumSeedOf(entry: { drumSeed?: number }): { drumSeed?: number } {
  return entry.drumSeed != null ? { drumSeed: entry.drumSeed } : {};
}

function spinChange(state: PublicState, spin: PublicSpin | null): PublicChange[] {
  const same =
    spin === null
      ? state.spin === null
      : state.spin !== null &&
        state.spin.startAtMs === spin.startAtMs &&
        state.spin.landAtMs === spin.landAtMs &&
        state.spin.spinSeed === spin.spinSeed &&
        state.spin.targetId === spin.targetId;
  return same ? [] : [{ kind: 'spin', spin }];
}

/**
 * The live show events the laptop forwards to the cloud. The link drops every other type before sending, and
 * the cloud refuses any other type it receives. `state` goes at most every LINK.stateEveryMs.
 */
export const FORWARDED_EVENT_TYPES = [
  'state',
  'transition.scheduled',
  'suspense.started',
  'transition.cancelled',
  'transition.landed',
  'shuffle.scheduled',
  'check.started',
] as const satisfies readonly ShowEvent['type'][];
export type ForwardedEventType = (typeof FORWARDED_EVENT_TYPES)[number];
export const isForwardedEventType = (type: unknown): type is ForwardedEventType =>
  typeof type === 'string' && (FORWARDED_EVENT_TYPES as readonly string[]).includes(type);
