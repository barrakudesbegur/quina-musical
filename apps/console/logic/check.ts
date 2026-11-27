// The Check as the presenters pace it (D107–D126; boards Consola-Comprovacio-Ritme, -Casos, -Revisio, -Desgraciada).
// The tablet sees everything at once and in private (D108): the whole card marked (the Claim's `markedCard`), where
// the reveals stop (`revealUntil`), the verdict and the warnings. The room sees a song only when a press reveals it,
// and the result only on the cue. Each press says which step it expects (`checkNext { claimId, step }`), so two
// presses at once reveal once. Everything here is derived from the engine's snapshot. Pure.
import { DEFAULT_SIDE, defaultCardType, isPassingOutcome, type CommandFields } from '@quina/protocol';
import { cardTypeLabel, typeSideLabel, type PrintedCardType } from '../../../packages/ui/data/card-types.ts';
import type { CheckInfo, ClaimInfo, FlowFields, WinKind } from '../../../packages/ui/flow.ts';
import { roundCardType, type GamePlan } from '../../../packages/ui/plan.ts';

/** A song's mark, which always means "good for the claim": ✓ (`ok`) or ✗ (`bad`). */
export type Mark = 'ok' | 'bad';

/**
 * A song's mark from whether it landed. For a Line or a Bingo a landed song is ✓; in a standing Check (the Desgraciat
 * round) a song that has NOT landed is, and the landed one is the ✗ that sank the card. There, "landed" means counted
 * against the card: a landing that would have taken out everyone left counts for none of them (D180).
 */
export function stepMark(kind: WinKind, landed: boolean): Mark {
  return landed !== (kind === 'standing') ? 'ok' : 'bad';
}

/** One song of the claimed card as the tablet draws it. */
export interface CheckCell {
  songId: number;
  /** 0–2, top to bottom. */
  row: number;
  /** 0–3, left to right. */
  col: number;
  /** Played by this Check: a Line's row; every song of a Bingo or a standing claim. */
  inCheck: boolean;
  /** Its mark, known to the presenters from the start; null for a song the Check doesn't play. */
  mark: Mark | null;
  /** The room has seen it (a full mark, from the end of its snippet); before that the mark is the presenters' alone
   * (dotted). */
  revealed: boolean;
  /** Revealed, its snippet (or the broken record) playing now: highlighted (ANIMATIONS.md › check-step, console). */
  playing: boolean;
  /** The next press reveals it («Següent»). */
  next: boolean;
  /** How many presses until it's revealed (1 = the next one, «Següent»; 2, 3… after it), while the Check still
   * reveals; null once revealed or playing, after the reveals stop, or for a song the Check doesn't play (#78). */
  ahead: number | null;
  /** In the Check but after the reveals stop (the first ✗): it will never be revealed («no es destaparà»). */
  skipped: boolean;
}

const COLS = 4;

/** The Claim a Check is for. */
export const claimOf = (flow: Pick<FlowFields, 'claims'>, check: Pick<CheckInfo, 'claimId'> | null): ClaimInfo | null =>
  check ? (flow.claims.find((c) => c.claimId === check.claimId) ?? null) : null;

/** The card's songs in the Check's reveal order (a Line: its row), each with its grid index. */
function checkedSongs(check: CheckInfo, claim: ClaimInfo | null): { songId: number; landed: boolean; index: number }[] {
  const card = claim?.markedCard ?? [];
  const all = card.map((s, index) => ({ ...s, index }));
  if (check.kind === 'line' && check.row !== null) return all.filter((s) => Math.floor(s.index / COLS) === check.row);
  return all;
}

/** The claimed card's 12 songs (none for a card of the wrong type), each with what the tablet shows on it at `nowMs`. */
export function checkCells(check: CheckInfo, claim: ClaimInfo | null, nowMs: number): CheckCell[] {
  const card = claim?.markedCard ?? [];
  const order = new Map(checkedSongs(check, claim).map((s, i) => [s.index, i]));
  const revealed = check.revealed.length;
  const until = claim?.revealUntil ?? null;
  const stillRevealing = check.cue === null && (until === null || revealed <= until);
  return card.map((s, index) => {
    const at = order.get(index) ?? null;
    const step = at === null ? undefined : check.revealed[at];
    // A reveal from before this Check came on screen (a review resumed after another card's Check, D121) was heard
    // then: no snippet replays it, so it is never «playing» again.
    const heard = step !== undefined && (nowMs >= step.atMs + step.durationMs || step.atMs < check.startAtMs);
    return {
      songId: s.songId,
      row: Math.floor(index / COLS),
      col: index % COLS,
      inCheck: at !== null,
      mark: at === null ? null : stepMark(check.kind, s.landed),
      revealed: heard,
      playing: step !== undefined && !heard,
      next: at !== null && at === revealed && stillRevealing,
      ahead: at !== null && at >= revealed && stillRevealing && (until === null || at <= until) ? at - revealed + 1 : null,
      skipped: at !== null && until !== null && at > until,
    };
  });
}

/** What the engine's finding says, privately (the green or red strip over the card). */
export type Verdict =
  | { kind: 'complete'; win: WinKind; row: number | null }
  /** A Line or Bingo song that didn't sound: the reveals stop there (`position`, 1-based in the reveal order). */
  | { kind: 'missing'; win: WinKind; position: number; songId: number }
  /** A standing card fell on that song. */
  | { kind: 'fallen'; position: number; songId: number }
  | { kind: 'wrongType'; cardType: string | null }
  | { kind: 'unknownCard' };

export function checkVerdict(check: CheckInfo, claim: ClaimInfo | null): Verdict {
  const songs = checkedSongs(check, claim);
  switch (check.outcome) {
    case 'wrongType':
      return { kind: 'wrongType', cardType: check.cardType ?? null };
    case 'unknownCard':
      return { kind: 'unknownCard' };
    case 'complete':
      return { kind: 'complete', win: check.kind, row: check.row };
    // `fellLast` only in a journal from before D180, which can't give a shared win any more.
    case 'fallen':
    case 'fellLast': {
      const at = Math.max(0, songs.findIndex((s) => s.landed));
      return { kind: 'fallen', position: at + 1, songId: songs[at]?.songId ?? 0 };
    }
    case 'incomplete': {
      const at = Math.max(0, songs.findIndex((s) => !s.landed));
      return { kind: 'missing', win: check.kind, position: at + 1, songId: songs[at]?.songId ?? 0 };
    }
  }
}

/** The card passes its Check (the cue will be «Celebrem!»): complete. */
export const checkPasses = (check: Pick<CheckInfo, 'outcome' | 'kind'>): boolean => isPassingOutcome(check.outcome, check.kind);

/** Where the Check is, as the tablet's right column follows it. */
export type CheckStage =
  /** Revealing, one press at a time («Destapa»). */
  | 'reveal'
  /** Revealing in a row («Seguides», or A held: «Destapant…»). */
  | 'auto'
  /** Every song it reveals is revealed: the next press is the cue («Celebrem!», «Vàlid · següent» or «Fallada»). */
  | 'cue'
  /** Its cue has played; the next card's Check comes on screen by itself. */
  | 'cued'
  /** The last card failed after an earlier one passed: one more press starts the shared Celebration. */
  | 'celebrateNext'
  /** Under review («Revisió manual»): the tablet's four choices. */
  | 'review';

export interface CheckState {
  stage: CheckStage;
  /** The cue passes (at `cue`), or the cue that played (at `cued`). */
  pass: boolean;
  /** More cards wait their turn after this one (a pass is then «Vàlid · següent», with no fanfare). */
  more: boolean;
}

/** The Check on screen's stage, or null without one (none on screen, and no shared Celebration due). */
export function checkState(flow: Pick<FlowFields, 'check' | 'claims' | 'celebrationNext'>): CheckState | null {
  const check = flow.check;
  if (flow.celebrationNext) return { stage: 'celebrateNext', pass: false, more: false };
  if (!check) return null;
  const claim = claimOf(flow, check);
  const more = flow.claims.some((c) => c.claimId !== check.claimId && (c.status === 'queued' || c.status === 'reviewing'));
  if (check.reviewing) return { stage: 'review', pass: checkPasses(check), more };
  if (check.cue !== null) return { stage: 'cued', pass: check.cue === 'pass', more };
  // Without its Claim (an odd snapshot), a card with nothing to reveal is at its cue.
  if (claim?.cueNext ?? check.total === 0) return { stage: 'cue', pass: checkPasses(check), more };
  return { stage: check.auto ? 'auto' : 'reveal', pass: checkPasses(check), more };
}

/** The big button's command: a reveal or the cue (`checkNext` with the step it expects), or stopping «Seguides». */
export type CheckPress = { cmd: 'checkNext'; args: CommandFields['checkNext'] } | { cmd: 'checkAuto'; args: CommandFields['checkAuto'] };

/** What the big button (and A) sends now, or null when it has nothing to do (between cards, under review). */
export function checkPress(flow: Pick<FlowFields, 'check' | 'claims' | 'celebrationNext'>): CheckPress | null {
  if (flow.celebrationNext) return { cmd: 'checkNext', args: { ...flow.celebrationNext } };
  const check = flow.check;
  const state = checkState(flow);
  if (!check || !state) return null;
  switch (state.stage) {
    case 'reveal':
    case 'cue':
      return { cmd: 'checkNext', args: { claimId: check.claimId, step: check.revealed.length } };
    case 'auto':
      // A tap on «Destapant…» stops the reveals in a row before the cue (the board's «Un toc al botó gran les para»).
      return { cmd: 'checkAuto', args: { on: false } };
    default:
      return null;
  }
}

/** «Enrere» inside a Check (D127, D134): the last revealed mark comes off. Only while revealing. */
export function checkBackCommand(check: CheckInfo | null): CommandFields['checkBack'] | null {
  if (!check || check.reviewing || check.cue !== null || check.revealed.length === 0) return null;
  return { claimId: check.claimId, step: check.revealed.length - 1 };
}

/** «Revisió manual» (D119): the Check on screen, before its cue. */
export function checkReviewCommand(check: CheckInfo | null): CommandFields['checkReview'] | null {
  if (!check || check.reviewing || check.cue !== null) return null;
  return { claimId: check.claimId };
}

/** «Seguides» can be switched: revealing or at the cue (it then plays the cue by itself), with songs to reveal. */
export function canToggleAuto(check: CheckInfo | null): boolean {
  return check !== null && !check.reviewing && check.cue === null && check.total > 0;
}

/** «Ara destapes»: the next song to reveal and where it is in the reveals ("3 de 4": up to where they stop). */
export interface NextReveal {
  songId: number;
  /** 1-based. */
  at: number;
  of: number;
}

export function nextReveal(check: CheckInfo, claim: ClaimInfo | null): NextReveal | null {
  const songs = checkedSongs(check, claim);
  const at = check.revealed.length;
  const of = claim?.revealUntil === null || claim?.revealUntil === undefined ? songs.length : claim.revealUntil + 1;
  const song = songs[at];
  if (!song || at >= of) return null;
  return { songId: song.songId, at: at + 1, of };
}

/**
 * Whether the last step back (`check.unrevealed`) is this Check's, still showing «Enrere: torna a sonar…»: on this
 * card, nothing revealed since, and made since it came on screen. One from before a review that left the screen
 * doesn't count when the Check comes back with its marks (D121): no snippet replays then.
 */
export const stepBackOnScreen = (check: Pick<CheckInfo, 'claimId' | 'revealed' | 'startAtMs'>, back: { claimId: string; index: number; atMs: number } | null): boolean =>
  back !== null && back.claimId === check.claimId && check.revealed.length === back.index && back.atMs >= check.startAtMs;

/** The song a step back replays: the one before the mark that came off, or null at none (the music from before comes back). */
export const replayedAfterBack = (check: CheckInfo, claim: ClaimInfo | null, removedIndex: number): number | null =>
  removedIndex > 0 ? (checkedSongs(check, claim)[removedIndex - 1]?.songId ?? null) : null;

/** The cards of the shared Celebration (`celebrationNext`): the valid Claims of the Check's kind. */
export function batchWinners(flow: Pick<FlowFields, 'check' | 'claims'>): number[] {
  const kind = flow.check?.kind;
  return flow.claims.filter((c) => c.status === 'valid' && (kind === undefined || c.kind === kind)).map((c) => c.cardId);
}

/** The Review's decisions by hand (D121): winning a card that fails, or losing one that passes, needs a confirmation. */
export const reviewNeedsConfirm = (outcome: 'win' | 'lose', check: Pick<CheckInfo, 'outcome' | 'kind'>): boolean =>
  (outcome === 'win') !== checkPasses(check);

/** The claimed card's printed type as its chip shows it ("Normal 1–4", "Especial" with a star), from card-types.json. */
export interface TypeChip {
  /** The short name ("Normal"): a wrong type's verdict and its big type name. */
  name: string;
  /** The type and the side checked in one label (D163, D226): "Normal 1–5", "Normal 6–10", "Especial · Desgraciat". */
  label: string;
  color: string;
  /** It plays the Quina Especial. */
  special: boolean;
}

/** A type's chip; `side` is the side checked (the Check's, which is the round's). */
export function typeChip(type: string | null | undefined, types: readonly PrintedCardType[], plan: Pick<GamePlan, 'rounds'> | null, side: number = DEFAULT_SIDE): TypeChip | null {
  if (!type) return null;
  const known = cardTypeLabel(type, types);
  const special = plan ? plan.rounds.some((r) => r.kind === 'special' && roundCardType(r) === type) : type === defaultCardType('special');
  return { name: known.shortName, label: typeSideLabel(type, side, types), color: known.color, special };
}
