// The claim pad (D110, D126; boards Consola-Comprovacio-Ritme ①, -Casos ⑤): the presenter types a number while
// asking «Algú més?», and «+ Un altre» turns it into a chip; «Comprovar» claims every chip (and the number still
// typed), in that order, for one prize. A number that isn't a printed card is refused here, in private: it stays
// typed, in red, and nothing reaches the engine. The console knows the printed numbers from the cards catalogue when
// it has one; without it the engine checks, and its `unknownCard` rejection names the chips to mark. Pure.
import type { CommandFields } from '@quina/protocol';
import { padPress, padValue, type PadKey, type PadLimits } from './numpad.ts';
import type { ClaimKind } from './show-data.ts';

/** A claimed number on the pad. */
export interface PadChip {
  cardId: number;
  /** The engine refused it: no printed card has this number (D126). */
  unknown: boolean;
}

export interface ClaimPadState {
  digits: string;
  chips: readonly PadChip[];
  kind: ClaimKind;
  /** The typed number was refused («Aquest número no existeix»): it stays typed, in red, until it's edited. */
  refused: boolean;
}

export interface ClaimPadRules extends PadLimits {
  /** Whether a number is a printed card; null when the console has no catalogue (the engine checks). */
  known: (cardId: number) => boolean | null;
  /** The most cards one claim takes (the `claim` command's `cardIds`). */
  maxCards: number;
}

export const openPad = (kind: ClaimKind): ClaimPadState => ({ digits: '', chips: [], kind, refused: false });

/** A key on the pad: the typed number changes, and a refusal's red goes. */
export const padKey = (pad: ClaimPadState, key: PadKey, rules: ClaimPadRules): ClaimPadState => ({ ...pad, digits: padPress(pad.digits, key, rules), refused: false });

/** What adding the typed number does: nothing typed, a chip, already a chip, the pad is full, or refused. */
export type AddOutcome = 'empty' | 'added' | 'duplicate' | 'full' | 'unknown';

/** «+ Un altre»: the typed number becomes a chip (and the field empties), unless no printed card has it. */
export function addTyped(pad: ClaimPadState, rules: ClaimPadRules): { pad: ClaimPadState; outcome: AddOutcome } {
  const value = padValue(pad.digits, rules);
  if (value === null) return { pad, outcome: 'empty' };
  if (rules.known(value) === false) return { pad: { ...pad, refused: true }, outcome: 'unknown' };
  if (pad.chips.some((c) => c.cardId === value)) return { pad: { ...pad, digits: '', refused: false }, outcome: 'duplicate' };
  if (pad.chips.length >= rules.maxCards) return { pad, outcome: 'full' };
  return { pad: { ...pad, digits: '', refused: false, chips: [...pad.chips, { cardId: value, unknown: false }] }, outcome: 'added' };
}

export const removeChip = (pad: ClaimPadState, cardId: number): ClaimPadState => ({ ...pad, chips: pad.chips.filter((c) => c.cardId !== cardId) });

/** The claim «Comprovar» sends: every chip, then the number still typed; null when there's nothing to claim, or a
 * number is refused (typed, or a chip the engine named). */
export function padClaim(pad: ClaimPadState, rules: ClaimPadRules): CommandFields['claim'] | null {
  const added = addTyped(pad, rules);
  if (added.outcome === 'unknown' || added.outcome === 'full' || pad.refused) return null;
  const chips = added.pad.chips;
  if (chips.length === 0 || chips.some((c) => c.unknown)) return null;
  const cardIds = chips.map((c) => c.cardId);
  return cardIds.length === 1 ? { cardId: cardIds[0], kind: pad.kind } : { cardIds, kind: pad.kind };
}

/** The cards a claim names, in order. */
export const claimedCards = (claim: CommandFields['claim']): number[] => claim.cardIds ?? (claim.cardId === undefined ? [] : [claim.cardId]);

/**
 * The engine refused the claim as `unknownCard` (D126): its `detail` lists the numbers ("999,1204"). The pad comes
 * back with the claim's cards as chips, those marked; the presenter removes or retypes them.
 */
export function padAfterUnknown(claim: CommandFields['claim'], detail: string | null | undefined, fallbackKind: ClaimKind): ClaimPadState {
  const unknown = new Set((detail ?? '').split(',').map((s) => Number(s.trim())).filter((n) => Number.isInteger(n) && n > 0));
  return { digits: '', refused: false, kind: claim.kind ?? fallbackKind, chips: claimedCards(claim).map((cardId) => ({ cardId, unknown: unknown.has(cardId) })) };
}
