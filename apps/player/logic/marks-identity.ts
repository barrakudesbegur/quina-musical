// Each card a player follows has one identity, 1..8: its colour (--card-color-N) and its mark icon. The first
// card is corn, like the seeds on the paper cards. The rest are Christmas icons the user chose (2026-11-24), in
// eight colours that can't be confused: the three primaries, the three secondaries, white and black. Shape alone
// still tells the cards apart, so colour-blind players are fine too. Pure.

export const CARD_MARKS = ['corn', 'shootingStar', 'moon', 'tree', 'snowflake', 'clubs', 'bauble', 'crown'] as const;
export type CardMarkName = (typeof CARD_MARKS)[number];

/** The mark of identity `n` (1-based); out-of-range identities wrap around. */
export function markName(n: number): CardMarkName {
  const i = ((Math.round(n) - 1) % CARD_MARKS.length + CARD_MARKS.length) % CARD_MARKS.length;
  return CARD_MARKS[i];
}
