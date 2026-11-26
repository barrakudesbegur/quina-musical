// Each card a player follows has one identity, 1..10: its colour (--card-color-N) and its mark icon. The first
// card is corn, like the seeds on the paper cards. The rest are Christmas and New Year icons the user chose
// (2026-11-24), in ten colours that can't be confused. New cards take them in this order (neighbours contrast), and
// the picker shows them in it too, corn first (D5, D201): yellow corn, cyan, red, green, pink heart, orange, purple
// grapes, white, black top hat, the Tió's brown. Shape alone still tells the cards apart, so colour-blind players are
// fine too. Pure.

export const CARD_MARKS = ['corn', 'shootingStar', 'bauble', 'tree', 'heart', 'crown', 'grapes', 'snowflake', 'topHat', 'poop'] as const;
export type CardMarkName = (typeof CARD_MARKS)[number];

/** The mark of identity `n` (1-based); out-of-range identities wrap around. */
export function markName(n: number): CardMarkName {
  const i = ((Math.round(n) - 1) % CARD_MARKS.length + CARD_MARKS.length) % CARD_MARKS.length;
  return CARD_MARKS[i];
}

/** The identity (1-based) of a mark. */
export const identityOf = (mark: CardMarkName): number => CARD_MARKS.indexOf(mark) + 1;
