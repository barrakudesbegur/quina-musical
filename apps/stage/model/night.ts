// The night's preview before the Game: each printed card type, its colour and price, and the rounds it
// plays, so the audience sees at a glance that one card is only for the Quina Especial (the user's review,
// 2026-11-24). Which rounds a type plays comes from the plan's rounds (each names its card type, in play order);
// its name, colour and price from card-types.json (ui/data/card-types.ts knownCardTypes says what stands in when
// that file is missing). Pure.
import type { GamePlan } from '../../../packages/ui/plan.ts';
import { cardTypeLabel, roundsByCardType, type PrintedCardType } from '../../../packages/ui/data/card-types.ts';

export interface NightCardType {
  /** The printed type's id ('normal', 'especial'…). */
  type: string;
  /** Its name, "Cartró normal" (`label`, as everywhere on the stage: `name` is a winner's, which never comes out). */
  label: string;
  /** Its pastel colour, "#rrggbb". */
  color: string;
  priceCents: number | null;
  /** The regular rounds it plays, by their number ("Quina 1"…), in play order. */
  regularRounds: number[];
  /** It plays the Quina Especial. */
  special: boolean;
}

/**
 * The card types that play tonight, each with the rounds it plays: card-types.json's order first (normal first),
 * then any type a round names that the list doesn't have, in play order. A type that plays no round is left out.
 */
export function nightCardTypes(plan: Pick<GamePlan, 'rounds'> | null, types: readonly PrintedCardType[]): NightCardType[] {
  if (!plan) return [];
  const order = (type: string) => {
    const i = types.findIndex((t) => t.type === type);
    return i < 0 ? types.length : i;
  };
  return roundsByCardType(plan.rounds)
    .map((plays, i) => ({ plays, i }))
    // A stable sort: listed types in the list's order, then the unlisted ones as the rounds name them.
    .sort((a, b) => order(a.plays.type) - order(b.plays.type) || a.i - b.i)
    .map(({ plays }) => {
      const label = cardTypeLabel(plays.type, types);
      return { type: plays.type, label: label.name, color: label.color, priceCents: label.priceCents, regularRounds: plays.regularRounds, special: plays.special };
    });
}
