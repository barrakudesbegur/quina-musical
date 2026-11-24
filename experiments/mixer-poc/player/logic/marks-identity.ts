// Each card a player follows has one identity, 1..8: its colour (--card-color-N) and its mark icon. The first
// card is corn, like the seeds on the paper cards. The rest follow last year's set, so shape alone tells the
// cards apart (colour-blind players included). Pure.

export const CARD_MARKS = ['corn', 'star', 'moon', 'triangle', 'gift', 'clubs', 'circle', 'square'] as const;
export type CardMarkName = (typeof CARD_MARKS)[number];

/** The mark of identity `n` (1-based); out-of-range identities wrap around. */
export function markName(n: number): CardMarkName {
  const i = ((Math.round(n) - 1) % CARD_MARKS.length + CARD_MARKS.length) % CARD_MARKS.length;
  return CARD_MARKS[i];
}
