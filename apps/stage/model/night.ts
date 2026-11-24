// The night's preview before the Game: each printed card type, its colour and price, and the rounds it
// plays, so the audience sees at a glance that one card is only for the Quina Especial (the user's review,
// 2026-11-24). Read from the Game plan only: the card types (`plan.cardTypes`, from the card generation) and
// the rounds' kinds, in play order. Pure.
import type { CardType, GamePlan } from '../../../packages/ui/plan.ts';

export interface NightCardType {
  /** The printed type ('normal', 'especial'). */
  type: CardType['type'];
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
 * The card types that play tonight, in the plan's order (normal first), each with the rounds it plays: the
 * plan's rounds whose kind the type accepts (`CardType.rounds`). A type that plays no round is left out.
 * The plan's round kinds are 'normal' and 'special' only: the Desgraciat round isn't in the plan yet, so it
 * can't be shown (reported to the protocol owner).
 */
export function nightCardTypes(plan: Pick<GamePlan, 'cardTypes' | 'rounds'> | null): NightCardType[] {
  if (!plan) return [];
  const rounds = [...plan.rounds].sort((a, b) => a.number - b.number);
  return plan.cardTypes
    .map((t) => {
      const plays = rounds.filter((r) => t.rounds.includes(r.kind));
      return {
        type: t.type,
        label: t.name,
        color: t.color,
        priceCents: t.priceCents,
        regularRounds: plays.filter((r) => r.kind === 'normal').map((r) => r.number),
        special: plays.some((r) => r.kind === 'special'),
      };
    })
    .filter((t) => t.regularRounds.length > 0 || t.special);
}
