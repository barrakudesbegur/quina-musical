// The Desgraciat's finale on the console (D161, D166–D168, D180–D187; the Consola-Desgraciat-Final board):
// - the claim slot becomes «Final a l'escenari», growing as fewer stand (D167, D184), then «+ Finalista»;
// - the finalists' pad: each number entered shows its card privately with ✓ or ✗ and is added only while it stands
//   (D168, D183), and «Començar final» sends the set (`finale { cardIds }`, at least 2);
// - the Dempeus tab as the stage: one nino per finalist (packages/rules/finale.ts), «Salvats!» (D181), the winner;
// - the engine's refusals of `finale`, turned back into the pad's private reasons.
// The engine decides; these only show the presenters what it will say, before it says it. Pure.
import { roundCardType, roundSide, type FinaleInfo, type RejectReason, type ShowState } from '@quina/protocol';
import { cardFace, type CatalogCard } from '../../../packages/ui/data/catalog.ts';
import { finaleRow, finaleSaved, type FinalistSpot } from '../../../packages/rules/finale.ts';
import { padPress, padValue, type PadKey, type PadLimits } from './numpad.ts';

// ---- the claim slot -------------------------------------------------------------------------------------
/** How big «Final a l'escenari» is: the usual size, grown, or the biggest of its column (recommended). */
export type FinaleSize = 'normal' | 'medium' | 'large';

export interface FinaleSizes {
  /** From this many standing down, the button grows. */
  medium: number;
  /** From this many down, it is the biggest, ringed and recommended. */
  large: number;
}

export function finaleSize(count: number, sizes: FinaleSizes): FinaleSize {
  return count <= sizes.large ? 'large' : count <= sizes.medium ? 'medium' : 'normal';
}

/** The Desgraciat round's claim slot: `start` opens the pad for the finale, `add` adds a finalist once it's on. */
export type FinaleSlot =
  | { kind: 'start'; size: FinaleSize; standing: number }
  | { kind: 'add'; enabled: boolean };

/** The claim slot in a Desgraciat round's play (null elsewhere: the usual «Comprovar cartró»). */
export function finaleSlot(state: Pick<ShowState, 'round' | 'standing' | 'finale'> | null, sizes: FinaleSizes): FinaleSlot | null {
  if (!state || state.round.kind !== 'desgraciat') return null;
  // A winner ends it: nobody joins the finale then (the board's greyed «+ Finalista»).
  if (state.finale) return { kind: 'add', enabled: state.finale.winner === null };
  // The count includes the unsold cards (the engine can't tell them apart): the presenters look at the room.
  const standing = state.standing?.count ?? Number.POSITIVE_INFINITY;
  return { kind: 'start', size: finaleSize(standing, sizes), standing: Number.isFinite(standing) ? standing : 0 };
}

// ---- checking a number ------------------------------------------------------------------------------------
/**
 * What entering a number finds: still standing (added), already fallen, not a printed card, not a card of this round
 * (another type, not in play, or no face on the round's side), already a finalist, or `unchecked` when the console has
 * no catalogue (it's added, and the engine checks).
 */
export type FinaleVerdict = 'standing' | 'fallen' | 'unknown' | 'notThisRound' | 'duplicate' | 'unchecked';

/** The reasons the pad shows for a number that isn't added; `comeBack` is the engine's D183 refusal. */
export type FinaleRefusal = 'fallen' | 'unknown' | 'notThisRound' | 'comeBack';

export interface FinaleCheckContext {
  /** The printed cards, or null without a catalogue. */
  cards: ReadonlyMap<number, CatalogCard> | null;
  round: ShowState['round'];
  /** The cards in play, or null when unknown. */
  inPlay: ReadonlySet<number> | null;
  /** The engine's standing cards (`standing.cardIds`, sent from 60 down), or null. */
  standing: readonly number[] | null;
  /** The round's counted songs as far as this console knows them. */
  landed: ReadonlySet<number>;
}

/** A song on the card being checked: ✓ (it hasn't sounded) or ✗ (it has: the card fell). */
export interface FinaleCardSong {
  songId: number;
  landed: boolean;
}

/** A number checked against the round: the verdict, and its card on the round's side when printed. */
export interface FinaleCheck {
  cardId: number;
  verdict: FinaleVerdict;
  songs: FinaleCardSong[] | null;
}

export function checkFinalist(cardId: number, finalists: readonly number[], ctx: FinaleCheckContext): FinaleCheck {
  const card = ctx.cards?.get(cardId);
  const face = card ? cardFace(card, roundSide(ctx.round)) : null;
  const songs = face ? face.lines.flat().map((songId) => ({ songId, landed: ctx.landed.has(songId) })) : null;
  const verdict = ((): FinaleVerdict => {
    if (finalists.includes(cardId)) return 'duplicate';
    if (!ctx.cards) return 'unchecked';
    if (!card) return 'unknown';
    if (!face || card.type !== roundCardType(ctx.round) || ctx.inPlay?.has(cardId) === false) return 'notThisRound';
    // The engine's list is the authority from 60 down; above it, the songs this console has seen land.
    if (ctx.standing) return ctx.standing.includes(cardId) ? 'standing' : 'fallen';
    return songs?.some((s) => s.landed) ? 'fallen' : 'standing';
  })();
  return { cardId, verdict, songs };
}

// ---- the finalists' pad ---------------------------------------------------------------------------------------
/** `start`: the finale isn't on yet; `add`: «+ Finalista» during it. */
export type FinalePadMode = 'start' | 'add';

export interface FinalePadState {
  mode: FinalePadMode;
  digits: string;
  /** The finalists already in the finale when the pad opened (`add`), first in the set sent. */
  current: readonly number[];
  /** The numbers added on this pad, in the order entered (the order the engine keeps, and each nino's look). */
  added: readonly number[];
  /** The last number entered: its card shows on the right. */
  shown: FinaleCheck | null;
  /** The number typed was refused: it stays typed, in red, with its reason. */
  refused: FinaleRefusal | null;
}

export const openFinalePad = (mode: FinalePadMode, current: readonly number[] = []): FinalePadState => ({ mode, digits: '', current: [...current], added: [], shown: null, refused: null });

export const finalePadKey = (pad: FinalePadState, key: PadKey, limits: PadLimits): FinalePadState => ({ ...pad, digits: padPress(pad.digits, key, limits), refused: null });

/** Every finalist the pad would send, in the order entered. */
export const finalePadSet = (pad: FinalePadState): number[] => [...pad.current, ...pad.added];

export type FinaleEnterOutcome = 'empty' | 'added' | 'shown' | 'refused' | 'full';

/** ↵: check the typed number. Standing (or unchecked): added; already there: its card shows again; else refused. */
export function finalePadEnter(pad: FinalePadState, limits: PadLimits & { maxFinalists: number }, check: (cardId: number, finalists: readonly number[]) => FinaleCheck): { pad: FinalePadState; outcome: FinaleEnterOutcome } {
  const value = padValue(pad.digits, limits);
  if (value === null) return { pad, outcome: 'empty' };
  const set = finalePadSet(pad);
  const shown = check(value, set);
  switch (shown.verdict) {
    case 'duplicate':
      return { pad: { ...pad, digits: '', shown, refused: null }, outcome: 'shown' };
    case 'standing':
    case 'unchecked':
      if (set.length >= limits.maxFinalists) return { pad: { ...pad, shown }, outcome: 'full' };
      return { pad: { ...pad, digits: '', shown, refused: null, added: [...pad.added, value] }, outcome: 'added' };
    default:
      return { pad: { ...pad, shown, refused: shown.verdict }, outcome: 'refused' };
  }
}

/** Take a number entered on this pad off it (the finale's own finalists leave through «Editar»). */
export const finalePadRemove = (pad: FinalePadState, cardId: number): FinalePadState => ({
  ...pad,
  added: pad.added.filter((id) => id !== cardId),
  shown: pad.shown?.cardId === cardId ? null : pad.shown,
});

/** What the pad's big button sends, or null while it can't: a start needs `min` finalists, an addition a new one. */
export function finalePadCommand(pad: FinalePadState, min: number): { cardIds: number[] } | null {
  const cardIds = finalePadSet(pad);
  if (pad.mode === 'start' ? cardIds.length < min : pad.added.length === 0) return null;
  return { cardIds };
}

/**
 * The engine refused the set (`unknownCard`, or `invalid` naming the cards): which reason, and which cards. Null for any
 * other refusal (it becomes a toast). The engine's details are "already fallen: 12,34", "not a card of this round: 5",
 * "a fallen finalist can't come back: 7" (engine show.ts › setFinale).
 */
export function finaleRefusal(reason: RejectReason | string, detail: string | null | undefined): { refusal: FinaleRefusal; cardIds: number[] } | null {
  const ids = (text: string) => text.split(',').map((s) => Number(s.trim())).filter((n) => Number.isInteger(n) && n > 0);
  const text = detail ?? '';
  if (reason === 'unknownCard') return { refusal: 'unknown', cardIds: ids(text) };
  if (reason !== 'invalid') return null;
  const known: [RegExp, FinaleRefusal][] = [
    [/^already fallen:(.*)$/, 'fallen'],
    [/^not a card of this round:(.*)$/, 'notThisRound'],
    [/^a fallen finalist can't come back:(.*)$/, 'comeBack'],
  ];
  for (const [re, refusal] of known) {
    const m = re.exec(text);
    if (m) return { refusal, cardIds: ids(m[1]) };
  }
  return null;
}

/** The pad again after the engine refused what it sent: the refused numbers taken off, the first one typed back in red. */
export function finalePadAfterRefusal(sent: FinalePadState, refused: { refusal: FinaleRefusal; cardIds: number[] }): FinalePadState {
  const first = refused.cardIds[0];
  return {
    ...sent,
    added: sent.added.filter((id) => !refused.cardIds.includes(id)),
    digits: first === undefined ? '' : String(first),
    refused: refused.refusal,
    shown: null,
  };
}

// ---- the Dempeus tab as the stage ---------------------------------------------------------------------------------
export interface FinaleTabView {
  /** How many stand. */
  count: number;
  /** "a l'escenari" until someone falls, then "dempeus" (the board's wording). */
  word: 'onStage' | 'standing';
  /** «Salvats!» at the last landing, shown until the next Spin. */
  saved: boolean;
  spots: FinalistSpot[];
  /** Fallen finalists are shown now (Enrere's note says it brings them back). */
  fallenShown: boolean;
  winner: number | null;
}

/** A Spin or a Suspens is on: the last landing's fallen and its «Salvats!» have gone. */
export const spinning = (state: Pick<ShowState, 'status' | 'suspense'>): boolean => state.status === 'transition' || state.suspense != null;

/** The last counted landing, when it is the current one (null before the first, or right after Enrere's undo of it). */
export function lastLanding(state: Pick<ShowState, 'landings' | 'queue'>): { position: number; songId: number } | null {
  const l = state.landings.findLast((x) => !x.undone);
  return l && l.position === state.queue.position ? { position: l.position, songId: l.songId } : null;
}

export function finaleTabView(
  finale: FinaleInfo,
  state: Pick<ShowState, 'status' | 'suspense' | 'landings' | 'queue' | 'round'>,
  cards: ReadonlyMap<number, CatalogCard> | null,
  reversed: boolean,
): FinaleTabView {
  const moving = spinning(state);
  const spots = finaleRow(finale, { position: state.queue.position, spinning: moving }, reversed);
  const side = roundSide(state.round);
  const songsOf = (id: number) => {
    const card = cards?.get(id);
    const face = card ? cardFace(card, side) : null;
    return face ? face.lines.flat() : null;
  };
  return {
    count: finale.standing.length,
    word: finale.fallen.length ? 'standing' : 'onStage',
    saved: !moving && finaleSaved(finale, lastLanding(state), songsOf),
    spots,
    fallenShown: spots.some((s) => s.fate === 'fallen'),
    winner: finale.winner?.cardId ?? null,
  };
}

/** «Editar»'s ×: the finale without that finalist (a removal leaving one standing makes that one the winner). */
export const withoutFinalist = (finale: FinaleInfo, cardId: number): number[] => finale.cardIds.filter((id) => id !== cardId);
