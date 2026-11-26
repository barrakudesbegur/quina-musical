// The Check on the projector, paced by the presenters (D107): the claimed card's grid, the songs revealed so far
// (each press reveals the next one in the card's grid order, a Line's in its row), and the result, which shows only
// from the presenters' cue (`check.cue`): nothing on screen says ahead of it whether the card passes. Each revealed
// song's `atMs`/`durationMs` time its playing ring and its mark (ANIMATIONS.md `check-step`): the projector only reads
// its clock. The card's printed type is checked first (`check-type`: its badge gets ✓; a card of the wrong type has
// nothing to reveal and gets its ✗ with the result). A step back (`check.unrevealed`) takes the last mark off; a
// review («Revisió manual») keeps the marks the room already saw. A failed Check places its big ✗ where it hides
// nothing that was checked, and names the first song that didn't sound in its accessible label. The Desgraciat
// round's standing Check reads the other way round: a ✓ is a song that has NOT sounded, it stops on the first one
// that has, and that card has fallen (`check-fallen`). Pure.
import type { CheckInfo, CheckOutcome, FlowFields, WinKind } from '../../../packages/ui/flow.ts';
import type { PlayerCard } from '../../../packages/rules/marks.ts';
import { defaultCardType } from '@quina/protocol';
import { roundCardType, type GamePlan } from '../../../packages/ui/plan.ts';
import { cardTypeLabel, type PrintedCardType } from '../../../packages/ui/data/card-types.ts';

export interface CheckStepView {
  songId: number;
  landed: boolean;
  atMs: number;
  durationMs: number;
}

/**
 * The card's printed type as the Check's badge shows it: a mini card in the type's colour and its short name.
 * Public: it is printed on the card itself.
 */
export interface CardTypeBadge {
  /** 'normal', 'especial'… */
  type: string;
  /** The type's name from card-types.json ("Cartró normal"); the badge shows its short form. */
  label: string;
  color: string;
  /** It plays the Quina Especial (the mini card gets a star). */
  special: boolean;
  /** Whether the round plays it: ✓, or ✗ for a card of the wrong type. Null while not known yet: a Check with nothing to
   * reveal (the wrong type, D33) gets its mark only with the result, at the cue. */
  ok: boolean | null;
}

/**
 * The badge for a checked card's type: its name and colour from the card types (card-types.json, or what stands in
 * for it: knownCardTypes), its star when the plan's Quina Especial plays it (without a plan: the special round's
 * default type), and `ok` as the Check tells it publicly (checkTypeOk). Null for an unknown card, whose type isn't
 * known.
 */
export function cardTypeBadge(
  type: string | null | undefined,
  ok: boolean | null,
  types: readonly PrintedCardType[],
  plan: Pick<GamePlan, 'rounds'> | null,
): CardTypeBadge | null {
  if (!type) return null;
  const label = cardTypeLabel(type, types);
  const special = plan ? plan.rounds.some((r) => r.kind === 'special' && roundCardType(r) === type) : type === defaultCardType('special');
  return { type, label: label.name, color: label.color, special, ok };
}

/**
 * Whether the card's type plays this round, from public facts only: a Check with songs to reveal is of the round's
 * type; one with none (`total` 0: the wrong type) is known only at its cue, which fails it (a win by hand passes it).
 */
export function checkTypeOk(check: Pick<CheckInfo, 'total' | 'cue'>): boolean | null {
  if (check.total > 0) return true;
  return check.cue == null ? null : check.cue === 'pass';
}

/** What the projector says once the Check is over: `fallen` is a standing claim for a card one of whose songs has
 * landed (the Desgraciat round; a landing that would take out everyone left counts for none of them, D180). */
export type CheckVerdict = 'complete' | 'incomplete' | 'fallen' | 'notValid';

export interface CheckCell {
  songId: number;
  title: string | null;
  /** 0–2, top to bottom. */
  row: number;
  /** 0–3, left to right. */
  col: number;
  /** Index into `steps` when this song is played in the Check, else null. */
  step: number | null;
}

export interface CheckView {
  /** Changes when another card's Check comes on screen (or the same one again). */
  key: string;
  cardId: number;
  kind: WinKind;
  /** The card's printed type (public, on the card itself), or null for an unknown card. */
  cardType: CardTypeBadge | null;
  /** The result, from the presenters' cue; null until then. */
  verdict: CheckVerdict | null;
  /** A Line's row (0–2), whose songs it reveals; the other rows dim. Null for a Bingo and a standing Check. */
  row: number | null;
  /** How many songs its Check can reveal: 12, a Line's 4, 0 for a card of the wrong type. */
  total: number;
  /** The card's 12 songs (3 × 4), or only the revealed ones when the card is not in the catalog. */
  cells: CheckCell[];
  /** The songs revealed so far, in the order they were revealed. */
  steps: CheckStepView[];
  startAtMs: number;
  /** Under review («Revisió manual», D119–D123): the plaque shows, the marks stay as they were. */
  reviewing: boolean;
  /** When the review began, as far as the stage heard it (`check.reviewing`); null when it doesn't know. */
  reviewSinceMs: number | null;
  /** A step back replays the snippet of `step` (the new last revealed song), between these times: its equaliser shows. */
  replay: { step: number; fromMs: number; toMs: number } | null;
  /** Discarded from its review: the card fades out with the plate (`check-review`). */
  discarded: boolean;
}

/**
 * The result as the projector shows it, from the cue only (`cue` null: none yet). The engine's private finding only
 * shapes its look once the cue has played: a card of the wrong type, a fallen standing card, or any other failure; a
 * pass is a valid card.
 */
export function verdictOf(outcome: CheckOutcome, cue: CheckInfo['cue'] | undefined, kind: WinKind): CheckVerdict | null {
  if (cue == null) return null;
  if (cue === 'pass') return 'complete';
  if (outcome === 'wrongType' || outcome === 'unknownCard') return 'notValid';
  return kind === 'standing' ? 'fallen' : 'incomplete';
}

/**
 * The grid for a checked card. With the card in the catalog (holding every revealed song where its Check reveals it):
 * its 3 × 4 songs, each song the Check can reveal linked to its place in the reveal order (a Line's row left to right;
 * a Bingo's or a standing claim's 12 in card order), so the grid stays the same as the songs are revealed. Otherwise
 * the revealed songs alone, 4 per row (a Line's on its own row).
 */
export function checkCells(
  card: PlayerCard | null,
  steps: readonly CheckStepView[],
  row: number | null,
  title: (songId: number) => string | null,
): CheckCell[] {
  if (card && card.lines.length === 3 && card.lines.every((l) => l.length === 4)) {
    const order = row === null ? card.lines.flat() : (card.lines[row] ?? []);
    const stepOf = (r: number, c: number): number | null => (row === null ? r * 4 + c : r === row ? c : null);
    if (steps.every((s, i) => order[i] === s.songId)) {
      return card.lines.flatMap((line, r) => line.map((songId, c) => ({ songId, title: title(songId), row: r, col: c, step: stepOf(r, c) })));
    }
  }
  return steps.map((s, i) => ({
    songId: s.songId,
    title: title(s.songId),
    row: row ?? Math.floor(i / 4),
    col: i % 4,
    step: i,
  }));
}

/**
 * What the drawn grid depends on. It changes within one Check when the catalog arrives after the Check started
 * (a projector reloaded mid-Check): the grid then grows from the played songs to the whole card.
 */
export const gridKey = (cells: readonly CheckCell[]): string =>
  cells.map((c) => `${c.songId}@${c.row}.${c.col}:${c.step ?? '-'}:${c.title ?? ''}`).join('|');

/** One revealed song at a given time: not marked yet, its snippet playing, or marked. */
export type StepState = 'pending' | 'playing' | 'landed' | 'missed';

export interface CheckReveal {
  steps: StepState[];
  /** The revealed song whose snippet is playing (its ring), or null. */
  playing: number | null;
  /** A step back's replayed snippet (its equaliser only; the mark stays), or null. */
  replaying: number | null;
  /** The result, from the cue. */
  result: CheckVerdict | null;
}

/**
 * Each revealed song's state at `nowMs`. The snippet plays from `atMs` for `durationMs`; the mark shows when the
 * snippet ends (`markAt: 'end'`, ANIMATIONS.md) or as it starts (`'start'`). Once the cue has played every mark shows.
 * Under review the marks stay as they were when it began (the song that was playing isn't marked, D123) and no ring
 * plays.
 */
export function checkReveal(
  check: Pick<CheckView, 'steps' | 'verdict' | 'reviewing' | 'reviewSinceMs' | 'replay'>,
  nowMs: number,
  markAt: 'end' | 'start' = 'end',
): CheckReveal {
  const at = check.reviewing ? Math.min(nowMs, check.reviewSinceMs ?? nowMs) : nowMs;
  const settled = check.verdict !== null;
  let playing: number | null = null;
  const steps = check.steps.map((s, i): StepState => {
    const markMs = markAt === 'end' ? s.atMs + s.durationMs : s.atMs;
    if (settled || at >= markMs) return s.landed ? 'landed' : 'missed';
    if (!check.reviewing && at >= s.atMs) {
      playing = i;
      return 'playing';
    }
    return 'pending';
  });
  const r = check.replay;
  const replaying = r && !check.reviewing && !settled && r.step < steps.length && nowMs >= r.fromMs && nowMs < r.toMs ? r.step : null;
  return { steps, playing, replaying, result: check.verdict };
}

/**
 * A checked song's mark, which always means "good for the claim" (ANIMATIONS.md): ✓ (`ok`) or ✗ (`bad`); null before
 * it's marked. For a Line or a Bingo a landed song is good; in a standing Check (the Desgraciat round) a song that has
 * NOT landed is, and the landed one is the ✗ that sank the card.
 */
export function stepMark(kind: WinKind, state: StepState): 'ok' | 'bad' | null {
  if (state !== 'landed' && state !== 'missed') return null;
  return (state === 'landed') !== (kind === 'standing') ? 'ok' : 'bad';
}

/** The card-type step: not yet, passed (✓) or failed (✗). */
export type TypeState = 'pending' | 'ok' | 'wrong';

/**
 * When the type badge gets its ✓: `leadMs` after the Check comes on screen (once the plate and badge have dropped in),
 * but never after its first song is revealed.
 */
export function typeMarkAt(check: Pick<CheckView, 'startAtMs' | 'steps'>, leadMs: number): number {
  const at = check.startAtMs + Math.max(0, leadMs);
  const first = check.steps[0];
  return first ? Math.min(at, first.atMs) : at;
}

/** The type badge's state at `nowMs`; null without a badge (an unknown card). A badge not known yet stays pending. */
export function typeReveal(check: Pick<CheckView, 'startAtMs' | 'steps' | 'cardType'>, nowMs: number, leadMs: number): TypeState | null {
  if (!check.cardType) return null;
  if (check.cardType.ok === null) return 'pending';
  if (!check.cardType.ok) return 'wrong';
  return nowMs < typeMarkAt(check, leadMs) ? 'pending' : 'ok';
}

/** A Check that ends without a prize: the card is incomplete, fallen, or not valid. */
export const isFailed = (verdict: CheckVerdict): boolean => verdict !== 'complete';

/** The song a failed Check names: the first step (in the order they played) marked ✗. */
export interface CheckMiss {
  /** Index into `steps`; its tile is the one marked ✗ first. */
  step: number;
  songId: number;
  /** From the tile, so null when the catalog doesn't know the song (the plaque then names none). */
  title: string | null;
}

/**
 * The first step marked ✗: for a Line or a Bingo the first song that didn't land; in a standing Check (`kind`
 * 'standing') the song that landed and sank the card, its last step.
 */
export function firstMiss(check: Pick<CheckView, 'steps' | 'cells'> & { kind?: WinKind }): CheckMiss | null {
  const standing = check.kind === 'standing';
  const step = check.steps.findIndex((s) => s.landed === standing);
  if (step < 0) return null;
  const cell = check.cells.find((c) => c.step === step);
  return { step, songId: check.steps[step].songId, title: cell?.title ?? null };
}

/** Columns on a card. */
export const CARD_COLS = 4;

/**
 * Where a fallen card's big ✗ lands across the card (a share of its width): over the half away from the song that
 * sank it (`check-fallen`), so that song's lifted tile stays in plain view beside it. 0.5 (the middle) for every other
 * result, or when the sinking song isn't on the grid.
 */
export function resultX(check: Pick<CheckView, 'verdict' | 'steps' | 'cells' | 'kind'>): number {
  if (check.verdict !== 'fallen') return 0.5;
  const miss = firstMiss(check);
  const cell = miss ? check.cells.find((c) => c.step === miss.step) : undefined;
  if (!cell) return 0.5;
  return cell.col < CARD_COLS / 2 ? 0.75 : 0.25;
}

/** Rows on a card. The grid keeps all three slots even when it only knows the played songs. */
export const CARD_ROWS = 3;

/** Where the result (a valid card's plaque, a failed card's big ✗) sits over the card. */
export interface PlaqueSpot {
  /** Its centre, as a share of the card's height (0 top, 1 bottom). */
  at: number;
  /**
   * `rows`: over a Line's two other rows. `row`: over one row only (the checked row is the middle one), so the
   * plaque is compact. `card`: over the whole card (a scrim dims it when the Check failed).
   */
  over: 'row' | 'rows' | 'card';
}

/**
 * A Line's plaque covers the rows that weren't checked, so its ✓ and ✗ stay readable: the two other rows when
 * they're side by side, the bottom one when the checked row is the middle one. A Bingo's, or one with no grid
 * (a card that is not valid), sits in the middle of the card.
 */
export function plaqueSpot(check: Pick<CheckView, 'row' | 'cells'>): PlaqueSpot {
  const { row } = check;
  if (row === null || row < 0 || row >= CARD_ROWS || check.cells.length === 0) return { at: 0.5, over: 'card' };
  const others = Array.from({ length: CARD_ROWS }, (_, r) => r).filter((r) => r !== row);
  const covered = others[1] - others[0] === 1 ? others : [others[others.length - 1]];
  const centre = covered.reduce((sum, r) => sum + r + 0.5, 0) / covered.length;
  return { at: centre / CARD_ROWS, over: covered.length > 1 ? 'rows' : 'row' };
}

// ---- between snapshots: what the stage remembers about the Check -------------------------------------------

/** What the stage remembers about the Check from snapshots and events (Stage keeps it; the view reads it). */
export interface CheckMemory {
  /** The last Check a snapshot had on screen. */
  last: CheckInfo | null;
  /** When the stage heard a Claim go under review (`check.reviewing`), so the marks stay as they were then. */
  review: { claimId: string; atMs: number } | null;
  /** The last step back (`check.unrevealed`): the mark at `index` went, and the song before it replays from `atMs`. */
  unrevealed: { claimId: string; index: number; atMs: number } | null;
}

export const NO_CHECK_MEMORY: CheckMemory = { last: null, review: null, unrevealed: null };

/** The memory after a snapshot: its Check, if it has one (a snapshot without one keeps the last). */
export function rememberCheck(memory: CheckMemory, check: CheckInfo | null | undefined): CheckMemory {
  return check ? { ...memory, last: check } : memory;
}

/**
 * The Check as a snapshot carries it, read defensively: an odd or older snapshot (no `revealed`, no `total`) draws
 * as a Check with nothing revealed instead of breaking the projector, which runs inside the show page.
 */
export function readCheck(check: CheckInfo): CheckInfo {
  const revealed = Array.isArray(check.revealed) ? check.revealed.filter((s) => s && typeof s.songId === 'number') : [];
  return {
    ...check,
    otherRows: Array.isArray(check.otherRows) ? check.otherRows : [],
    revealed,
    total: typeof check.total === 'number' ? check.total : revealed.length,
    cue: check.cue === 'pass' || check.cue === 'fail' ? check.cue : null,
    reviewing: check.reviewing === true,
    auto: check.auto === true,
  };
}

/** The Check to draw, and whether it's one that was just discarded (it fades out). */
export interface ShownCheck {
  check: CheckInfo;
  discarded: boolean;
}

/**
 * The Check the projector draws: the one on screen, else one that just left that the room should still see.
 * - The last card's fail: the engine goes straight back to the round (scene `play`, the `checkFailed` Hold) as the
 *   cue plays, so the projector keeps that card, with its fail moment, until the Hold ends (Next, Back, another
 *   Claim).
 * - A Claim discarded from its review while the round waits in its Check for the next card: it fades out (the
 *   last card's discard goes back to the round, which fades the Check out anyway).
 */
export function shownCheck(
  flow: Pick<FlowFields, 'scene' | 'check' | 'claims'>,
  holdReason: string | null,
  last: CheckInfo | null,
): ShownCheck | null {
  if (flow.check) return { check: readCheck(flow.check), discarded: false };
  if (!last) return null;
  const claim = flow.claims.find((c) => c.claimId === last.claimId);
  if (!claim) return null;
  if (flow.scene === 'check' && claim.status === 'discarded') return { check: readCheck(last), discarded: true };
  if (flow.scene === 'play' && holdReason === 'checkFailed' && claim.status === 'invalid') {
    return { check: { ...readCheck(last), cue: 'fail', reviewing: false }, discarded: false };
  }
  return null;
}
