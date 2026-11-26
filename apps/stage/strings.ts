// The projector's words, in Catalan. Shared terms (Quina N, Línia, QUINA!, the check results…) come from
// ui/i18n/ca.ts; this file holds what only the projector says. Pure, so the formatting is tested.
import { CA } from '../../packages/ui/i18n/ca.ts';
import type { CheckVerdict } from './model/check.ts';

/** Kept on one line (no-break spaces) when the plaque's second line wraps. */
const GAME_GOES_ON = 'El\u00a0joc\u00a0continua!';

/**
 * A failed Check's words, which the projector doesn't print (the big ✗ says it) but gives the result as its
 * accessible label: "Falta «title». El joc continua!", naming the first song that didn't sound when its title
 * is known, else "El joc continua!"; for a card that fell in the Desgraciat round, "«title» ja ha sonat. El joc
 * continua!", naming the song that sank it. A valid one has none.
 */
export function checkResultDetail(verdict: CheckVerdict, songTitle: string | null): string | null {
  if (verdict === 'complete') return null;
  if (verdict === 'fallen' && songTitle) return `«${songTitle}» ja ha sonat. ${GAME_GOES_ON}`;
  return verdict === 'incomplete' && songTitle ? `Falta «${songTitle}». ${GAME_GOES_ON}` : GAME_GOES_ON;
}

/** "57", "57 i 301", "12, 57 i 301". */
export function joinCa(items: readonly (string | number)[]): string {
  const parts = items.map(String);
  if (parts.length <= 1) return parts.join('');
  return `${parts.slice(0, -1).join(', ')} i ${parts[parts.length - 1]}`;
}

/** A card type's price: "2 €", "2,50 €"; null when it isn't set. */
export function priceLabel(cents: number | null): string | null {
  if (cents === null || !Number.isFinite(cents) || cents < 0) return null;
  const whole = Math.floor(cents / 100);
  const rest = Math.round(cents % 100);
  return rest ? `${whole},${String(rest).padStart(2, '0')} €` : `${whole} €`;
}

/** A card type's short name for the Check's badge: "Cartró normal" → "Normal", "Cartró especial" → "Especial". */
export function shortTypeName(name: string): string {
  const short = name.trim().replace(/^cartr[óo]\s+/i, '');
  return short ? short[0].toLocaleUpperCase('ca') + short.slice(1) : name;
}

/** A round as the stage names it: "Quina 4", or "Quina Desgraciada" (no number: there's only one). */
export function roundName(round: { number: number; desgraciat?: boolean }): string {
  return round.desgraciat ? CA.desgraciatRound : CA.round(round.number);
}

/** The Interval's plate: "Següent: Quina 4 de 8", "Següent: Quina 4" without a total, "Següent: Quina Especial",
 * "Següent: Quina Desgraciada". */
export function nextRoundLabel(round: { number: number; special: boolean; desgraciat?: boolean }, total: number | null): string {
  if (round.special) return `Següent: ${STAGE_TEXT.specialRoundName}`;
  if (round.desgraciat) return `Següent: ${CA.desgraciatRound}`;
  return `Següent: ${total ? CA.roundOf(round.number, total) : CA.round(round.number)}`;
}

/** What a rough countdown says. `start`: before the Game; `back`: the Interval. */
export type CountdownContext = 'start' | 'back';

export const STAGE_TEXT = {
  title: CA.gameTitle,
  round: CA.round,
  specialRound: CA.specialRound,
  specialRule: 'Només compten els cartrons especials',
  shout: CA.shout,
  prize: CA.prize,
  sponsoredBy: CA.sponsoredBy,
  morePrizes: CA.morePrizes,
  /** The Check's plate: "Cartró #57" (shown in capitals). */
  checkPlate: (id: number) => `Cartró #${id}`,
  /** The plaque while a Check is under review (D123). */
  checkReview: 'Revisió manual',
  /** The Check's card-type badge, for its accessible label: "Cartró normal: correcte". */
  checkType: (name: string, ok: boolean | null) => (ok === null ? name : `${name}: ${ok ? 'correcte' : 'no val per a aquesta quina'}`),
  checkResult: { complete: CA.checkValid, incomplete: CA.checkInvalid, fallen: 'Cartró caigut', notValid: 'Cartró no vàlid' } satisfies Record<CheckVerdict, string>,
  /** A Check's marks mean "good for the claim": ✓, else ✗ (model/check.ts stepMark). */
  mark: { ok: '✓', bad: '✗' },
  /** What a checked song's tile says, by what happened to the song (the same in every round). */
  markLabel: { landed: CA.landed, missed: CA.notLanded },
  pause: CA.pause,
  scanYourCard: CA.scanYourCard,
  thanks: CA.thanks,
  shuffling: 'Barrejant…',
  /** Before the Game: the night's preview. A regular round's ball reads its number after "Quina". */
  roundsWord: 'Quina',
  roundsLabel: (numbers: readonly number[]) => (numbers.length === 1 ? CA.round(numbers[0]) : `Quines ${joinCa(numbers)}`),
  specialRoundName: 'Quina Especial',
  desgraciatRoundName: CA.desgraciatRound,
  priceOf: (name: string, price: string | null) => (price ? `${name}: ${price}` : name),
  /** The Interval's price tag (U5): what a card costs for the coming round. */
  priceFor: (price: string) => `Cartró: ${price}`,
  sponsorsTitle: 'Amb el suport de',
  intervalTitle: CA.scene.interval,
  minutesUnit: 'min',
  /** The Interval ring's number under a minute. */
  ringSoon: '<1',
  suspense: '?',
  drumPlaceholder: 'Tambor · a la pàgina del show',
  link: { offline: 'Sense connexió', noShow: 'Esperant el show' },
  countdown: {
    minutes: (ctx: CountdownContext, min: number) =>
      `${ctx === 'start' ? 'Comencem' : 'Tornem'} d'aquí a ${min === 1 ? 'un minut' : `uns ${min} minuts`}`,
    at: (ctx: CountdownContext, clock: string) => `${ctx === 'start' ? 'Comencem' : 'Tornem'} a les ${clock}`,
    soon: (ctx: CountdownContext) => (ctx === 'start' ? 'Comencem de seguida!' : 'Tornem de seguida!'),
  },
} as const;
