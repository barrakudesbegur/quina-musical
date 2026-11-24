// The projector's words, in Catalan. Shared terms (Quina N, Línia, QUINA!, the check results…) come from
// ui/i18n/ca.ts; this file holds what only the projector says. Pure, so the formatting is tested.
import { CA } from '../../packages/ui/i18n/ca.ts';
import type { WinKind } from '../../packages/ui/flow.ts';

/** "57", "57 i 301", "12, 57 i 301". */
export function joinCa(items: readonly (string | number)[]): string {
  const parts = items.map(String);
  if (parts.length <= 1) return parts.join('');
  return `${parts.slice(0, -1).join(', ')} i ${parts[parts.length - 1]}`;
}

/** "Cartró 123" or "Cartrons 57 i 301" (empty for none). */
export function cardsLabel(cardIds: readonly number[]): string {
  if (cardIds.length === 0) return '';
  return cardIds.length === 1 ? CA.card(cardIds[0]) : `${CA.cards} ${joinCa(cardIds)}`;
}

/** What a rough countdown says. `start`: before the Game; `back`: the Interval. */
export type CountdownContext = 'start' | 'back';

export const STAGE_TEXT = {
  title: CA.gameTitle,
  round: CA.round,
  roundOf: CA.roundOf,
  nextRound: CA.nextRound,
  specialRound: CA.specialRound,
  specialRule: 'Només compten els cartrons especials',
  shout: CA.shout,
  prize: CA.prize,
  sponsoredBy: CA.sponsoredBy,
  checking: CA.checking,
  checkResult: { complete: CA.checkValid, incomplete: CA.checkInvalid, notValid: 'Cartró no vàlid' },
  mark: { landed: '✓', missed: '✗' },
  markLabel: { landed: CA.landed, missed: CA.notLanded },
  pause: CA.pause,
  scanYourCard: CA.scanYourCard,
  thanks: CA.thanks,
  winners: CA.winners,
  shuffling: 'Barrejant…',
  howToPlayTitle: 'Com es juga',
  howToPlay: ['Quan soni una cançó del teu cartró, marca-la.', 'Quatre en una fila? Crida «Línia!»', 'Tot el cartró ple? Crida «Quina!»'],
  sponsorsTitle: 'Amb el suport de',
  sponsorThanks: (name: string) => `Gràcies, ${name}!`,
  lastWinners: (round: number) => `Guanyadors de la ${CA.round(round)}`,
  winnerLine: (kind: WinKind, cardIds: readonly number[]) => `${kind === 'line' ? CA.line : CA.bingo}: ${joinCa(cardIds)}`,
  noWinner: '—',
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
