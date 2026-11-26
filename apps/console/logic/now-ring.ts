// The ring next to "Ara sona" (the Consola-Anell board): what the show is doing about the next song, at a
// glance. It counts down to the next auto-advance, spins with a transition, counts a Suspense down to its
// auto-release, says "press Següent" when nothing will advance by itself, and shows why the show is waiting
// (Parlem, Aguanta, a Check, a failed Check, a technical pause). A badge on its corner names the mode (auto,
// auto off, final phase, Parlem, Aguanta, held), and a chip under the song says the state in words.
// Pure: the snapshot, its show-flow fields and the clock come in as arguments.
import type { ShowState } from '@quina/protocol';
import type { FlowFields } from '../../../packages/ui/flow.ts';
import { autoAdvanceCountdown, autoAdvanceStatus, autoModeOn, landingCountdown, suspenseCountdown, type Countdown } from './countdown.ts';
import { activeHoldMode } from './hold-modes.ts';

export const RING_STATES = [
  'auto',
  'autoLast',
  'spinning',
  'suspense',
  'manual',
  'manualFinal',
  'lastStanding',
  'finaleWinner',
  'talk',
  'stay',
  'checking',
  'checkFailed',
  'paused',
  'waiting',
] as const;
/**
 * - auto: counting down to the next auto-advance; autoLast: its last seconds;
 * - spinning: a transition runs, the next song lands at `landAtMs`;
 * - suspense: a Suspense is open, counting down to its auto-release;
 * - manual: auto-advance is off, so a presenter must press Següent; manualFinal: the same because the final
 *   phase stops auto-advance;
 * - lastStanding: a Desgraciat round with one card left standing. Auto-advance never takes it out, and the
 *   presenters' next step is to check that card (the Dempeus tab's "Comprovar #N", the default action), not Següent;
 * - finaleWinner: the Desgraciat's finale has its winner (D180): no more songs land until the presenters' «Celebrem!»;
 * - talk (Parlem: ducked) and stay (Aguanta: full volume): a Hold;
 * - checking: a Claim is being checked; checkFailed: the last Check found no valid card, error music until Resume;
 * - paused: the technical pause;
 * - waiting: auto-advance applies but isn't scheduled yet (before the first song, the Celebration…).
 */
export type RingState = (typeof RING_STATES)[number];

/** The badge on the ring's corner: the auto-advance mode, or the kind of wait. Null: no badge. */
export type RingBadge = 'auto' | 'autoOff' | 'final' | 'talk' | 'stay' | 'held' | null;

export interface RingView {
  state: RingState;
  /** What the ring empties to (auto, autoLast, spinning, suspense); null otherwise. */
  countdown: Countdown | null;
  badge: RingBadge;
  /** When the Hold or the pause started, for "des de fa 0:42"; null when not waiting. */
  sinceMs: number | null;
  /** Hold music (or the error music of a failed Check) plays instead of the song. */
  holdMusic: boolean;
  /** The card being checked (state checking), when known. */
  cardId: number | null;
}

export interface RingInput {
  state: ShowState;
  flow: Pick<FlowFields, 'pause' | 'check' | 'claims' | 'celebration'>;
  nowMs: number;
  /** The last seconds of an auto-advance countdown, drawn in red (CONSOLE.ringLastSec). */
  lastSec: number;
}

/** The auto-advance mode's badge: on, off, or off because of the final phase. */
export function modeBadge(state: Pick<ShowState, 'game' | 'phase'>): 'auto' | 'autoOff' | 'final' {
  if (autoModeOn(state)) return 'auto';
  return state.game.autoAdvance ? 'final' : 'autoOff';
}

/** The ring's state, most pressing first: a pause, a Hold (by kind), a Suspense, a Spin, then auto-advance. */
export function nowRing({ state, flow, nowMs, lastSec }: RingInput): RingView {
  const base = { countdown: null, sinceMs: null, holdMusic: state.holdMusic, cardId: null };
  if (flow.pause) return { ...base, state: 'paused', badge: null, sinceMs: flow.pause.sinceMs, holdMusic: true };

  if (state.status === 'hold' && state.hold) {
    const sinceMs = state.hold.sinceMs;
    if (state.hold.reason === 'checkFailed') return { ...base, state: 'checkFailed', badge: 'held', sinceMs, holdMusic: true };
    // A Claim's Hold lasts through the Celebration too: only a Check in progress reads as checking.
    const checkingClaim = flow.claims.find((c) => c.status === 'checking') ?? null;
    if (flow.check || checkingClaim || (state.hold.reason === 'claim' && !flow.celebration)) {
      return { ...base, state: 'checking', badge: 'held', sinceMs, cardId: flow.check?.cardId ?? checkingClaim?.cardId ?? null };
    }
    const mode = activeHoldMode(state) ?? 'talk';
    return { ...base, state: mode, badge: mode, sinceMs, holdMusic: state.holdMusic || state.hold.holdMusic };
  }

  const badge = modeBadge(state);
  if (state.suspense) return { ...base, state: 'suspense', badge, countdown: suspenseCountdown(state, nowMs) };
  if (state.status === 'transition') return { ...base, state: 'spinning', badge, countdown: landingCountdown(state, nowMs) };

  // The finale's winner waits for the cue, like the default action; while the finale is on, its finalists decide.
  if (state.finale?.winner && !state.finale.cued) return { ...base, state: 'finaleWinner', badge: 'final', cardId: state.finale.winner.cardId };
  // The Desgraciat's last card standing: the ring points at the Check, like the default action does.
  if (state.round.kind === 'desgraciat' && !state.finale && state.standing?.count === 1) return { ...base, state: 'lastStanding', badge: 'final', cardId: state.standing.cardIds?.[0] ?? null };

  const why = autoAdvanceStatus(state);
  if (why === 'running') {
    const countdown = autoAdvanceCountdown(state, nowMs);
    const last = countdown !== null && !countdown.done && countdown.secondsLeft <= lastSec;
    return { ...base, state: last ? 'autoLast' : 'auto', badge, countdown };
  }
  if (why === 'off') return { ...base, state: 'manual', badge };
  if (why === 'offFinal') return { ...base, state: 'manualFinal', badge };
  return { ...base, state: 'waiting', badge };
}
