// The Desgraciat round on a phone (ANIMATIONS.md › The Desgraciat round › Player app). Phones get nothing new
// for it: each card's state comes from the round's kind, its card type and the counted landings
// (packages/rules/standing.ts). A card of another type doesn't play, so it has no state here. Phones never know
// the other cards or the count, so nothing here ever says a card won: only a confirmed PublicWinner does. Pure.
import { cardFall, type CardFall } from '../../../packages/rules/standing.ts';
import type { PlayerCard } from '../../../packages/rules/marks.ts';
import { PLAYER_CONFIG } from '../config.ts';
import type { PublicRound, RoundKind } from '../feed/public.ts';

/** Is this the Desgraciat round (played in reverse: the last card standing wins). */
export const isDesgraciat = (round: { kind: RoundKind } | null | undefined): boolean => round?.kind === 'desgraciat';

/** A playing card's state in the Desgraciat round: standing while `fall` is null ("Dempeus"), else seated ("Assegut"). */
export interface CardStand {
  /** The landing that sank it (the song with the ✗ that came first), or null while it stands. */
  fall: CardFall | null;
}

/** A card's state in this round, or null when the round isn't the Desgraciat one or the card doesn't play it. */
export function standOf(card: PlayerCard | null, valid: boolean, round: PublicRound | null): CardStand | null {
  if (!card || !valid || !round || !isDesgraciat(round)) return null;
  return { fall: cardFall(card, round.landings) };
}

/** What the feedback needs of one card. */
export interface StandEntry {
  cardId: number;
  stand: CardStand | null;
}

/** "cardId:position" of every seated card: a fall is new when its key wasn't there before. */
export const fallenKeys = (cards: readonly StandEntry[]): string[] =>
  cards.flatMap(({ cardId, stand }) => (stand?.fall ? [`${cardId}:${stand.fall.position}`] : []));

/** The cards still standing, in card order. */
export const standingIds = (cards: readonly StandEntry[]): number[] => cards.filter((c) => c.stand && !c.stand.fall).map((c) => c.cardId);

/** The phone's cards that fell at the round's latest landing, in card order: `card-fall` runs only for these. */
export function fellAtLatest(cards: readonly StandEntry[], round: PublicRound | null): number[] {
  if (!round?.landings.length || !isDesgraciat(round)) return [];
  const latest = Math.max(...round.landings.map((l) => l.position));
  return cards.filter((c) => c.stand?.fall?.position === latest).map((c) => c.cardId);
}

/** How many elements one `card-fall` animates: the cell's ✗, the card, its veil, its glow, both badges, the nino. */
export const FALL_ELEMENTS = 7;

/**
 * The falls that animate, each with its place in the 120 ms stagger: at most as many as fit in the phone budget
 * (PLAYER_CONFIG.maxAnimated); any others appear seated at once.
 */
export function fallStagger(cardIds: readonly number[], maxAnimated: number = PLAYER_CONFIG.maxAnimated): Map<number, number> {
  const fit = Math.max(0, Math.floor(maxAnimated / FALL_ELEMENTS));
  return new Map(cardIds.slice(0, fit).map((id, i) => [id, i] as const));
}

/**
 * The fresh cells ("cardId:songId") that animate alongside the falls: every falling card's own ✗ (part of its
 * fall), then the other new ✗s and kernels while the budget lasts. The rest simply appear.
 */
export function budgetMarks(freshMarks: readonly string[], falls: ReadonlyMap<number, number>, maxAnimated: number = PLAYER_CONFIG.maxAnimated): string[] {
  const falling = (key: string) => falls.has(Number(key.split(':')[0]));
  const room = Math.max(0, maxAnimated - falls.size * FALL_ELEMENTS);
  return [...freshMarks.filter(falling), ...freshMarks.filter((k) => !falling(k)).slice(0, room)];
}

/** How many elements one `stand-up` animates: the badge and the glow. */
export const STAND_UP_ELEMENTS = 2;

/** A card's place in the `stand-up` stagger, or null when it just appears (beyond the phone budget, or not now). */
export function standUpPlace(index: number, standingUp: boolean, maxAnimated: number = PLAYER_CONFIG.maxAnimated): number | null {
  return standingUp && index < Math.floor(maxAnimated / STAND_UP_ELEMENTS) ? index : null;
}
