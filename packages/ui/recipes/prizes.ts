// The prize recipes' data side (components-v2.md § 4 C2 and § 11.5; D-p): what a prize ticket and a prize card say and
// which palette their kind chip takes, from the game's data. Shared by the Svelte recipes (Ticket.svelte,
// PrizeCard.svelte), so both draw the same words. (The projector shows no prizes for now, D311.) Pure, tested in
// apps/show/tests/ui/ds/prizes.test.ts.
import { CONCEPTS } from '../concepts.ts';
import type { PaletteColor } from '../components/types.ts';
import type { WinKind } from '../flow.ts';
import { CA } from '../i18n/ca.ts';

/** The kind chip's palette: the concepts' colours (the Line gold, the Bingo orange, the last card standing green). */
export const PRIZE_COLOR: Readonly<Record<WinKind, PaletteColor>> = {
  line: CONCEPTS.line.color,
  bingo: CONCEPTS.bingo.color,
  standing: CONCEPTS.standing.color,
};

/** A ticket's ribbon: the kind's short name («LÍNIA», «QUINA», «DEMPEUS»; drawn in capitals). */
export const ticketRibbon = (kind: WinKind): { label: string; color: PaletteColor } => ({ label: CA[kind], color: PRIZE_COLOR[kind] });

/** One prize as the recipes take it: its sponsor's name already resolved. */
export interface PrizeLine {
  readonly title: string;
  readonly detail: string | null;
  readonly sponsor: string | null;
}

/** What a headline prize card shows (the phone's Celebration, the projector's round start and Celebration). */
export interface PrizeCardData {
  readonly kind: WinKind;
  /** The headline prizes (D31: first, and the card's name). */
  readonly headline: readonly PrizeLine[];
  /** How many other prizes the bundle holds. */
  readonly more: number;
  /** The headline sponsor's logo (an asset URL), when it has one. */
  readonly logo?: string | null;
}

/** The card's words, top to bottom (D-p): the chip, the prize, its detail, the sponsor, «i N premis més». */
export interface PrizeCardText {
  readonly chip: string;
  readonly color: PaletteColor;
  readonly title: string;
  readonly detail: string | null;
  readonly sponsor: string | null;
  readonly more: string | null;
}

export function prizeCardText(data: PrizeCardData): PrizeCardText {
  const sponsors = [...new Set(data.headline.map((p) => p.sponsor).filter((s): s is string => !!s))];
  return {
    chip: CA.prize[data.kind],
    color: PRIZE_COLOR[data.kind],
    title: data.headline.map((p) => p.title).join(' · '),
    detail: data.headline.length === 1 ? (data.headline[0]?.detail ?? null) : null,
    sponsor: sponsors.length ? CA.sponsoredBy(sponsors.join(' · ')) : null,
    more: data.more > 0 ? CA.morePrizes(data.more) : null,
  };
}
