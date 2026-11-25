// The Desgraciat round on the console (ANIMATIONS.md › The Desgraciat round › Console): the Dempeus tab and the
// Futur's countdown to the last card standing. The engine sends the cards still standing (PRIVATE: `state.standing`,
// the list only from STANDING_LIST_MAX cards down); which cards just fell is worked out here by comparing one
// snapshot's list with the next (`standing-fall`), and the last card standing becomes the default action
// (`standing-last`: logic/default-action.ts). Pure.
import { STANDING_LIST_MAX, type FutureInfo, type RoundInfo, type ShowState, type StandingInfo } from '@quina/protocol';
import { roundKey, type SongsAhead } from './future.ts';

/** The helpers' tabs (HelperTabs.svelte): Dempeus comes first, in the Desgraciat round only. */
export type HelperTab = 'standing' | 'future' | 'prizes' | 'effects';

/** The helpers' tabs for a round of this kind, in order. */
export function helperTabsFor(kind: RoundInfo['kind'] | null | undefined): HelperTab[] {
  return kind === 'desgraciat' ? ['standing', 'future', 'prizes', 'effects'] : ['future', 'prizes', 'effects'];
}

/** What the tab picker remembers: the round it last saw (`roundKey`) and whether one card stood then. */
export interface TabMemory {
  key: string | null;
  last: boolean;
}

export const EMPTY_TAB_MEMORY: TabMemory = Object.freeze({ key: null, last: false });

/**
 * The helpers' tab after a snapshot. A Desgraciat round selects Dempeus when it starts (a new round key, or the first
 * snapshot this device sees of it), and again when one card is left standing, so the default action's "Comprovar #57"
 * is on screen. Any other moment keeps this device's choice, unless the tab doesn't exist in this round (Dempeus
 * outside the Desgraciat round): then Futur.
 */
export function helperTabAfter(tab: HelperTab, memory: TabMemory, state: Pick<ShowState, 'round' | 'standing'> | null): { tab: HelperTab; memory: TabMemory } {
  if (!state) return { tab, memory };
  const key = roundKey(state.round);
  const desgraciat = state.round.kind === 'desgraciat';
  const last = desgraciat && state.standing?.count === 1;
  const next: TabMemory = { key, last };
  if (desgraciat && (key !== memory.key || (last && !memory.last))) return { tab: 'standing', memory: next };
  if (!helperTabsFor(state.round.kind).includes(tab)) return { tab: 'future', memory: next };
  return { tab, memory: next };
}

/** The Dempeus tab's numbers. */
export interface StandingSummary {
  count: number;
  /** The valid cards in play this round (`cards.validCount`), or null when unknown. */
  total: number | null;
  /** The cards that sat down (total − count), or null. */
  seated: number | null;
  /** The standing share of the total, 0..1, for the bar; null without a total. */
  share: number | null;
  /** The standing cards, sorted, from STANDING_LIST_MAX down; null above it (the count and the bar only). */
  ids: number[] | null;
  /** The last card standing, when exactly one is left and the list names it. */
  last: number | null;
  /** From this few down, the number turns gold. */
  gold: boolean;
  /** The cards that sat down with the song that just landed (`standing.fellLast`), sorted: the Desgraciat's shared
   * win when nobody in the room is left standing. Shown (each with its "Comprovar #N") once one card or none stands. */
  fellLast: number[];
}

/** The count turns gold from this many cards down (`standing-count`). */
export const STANDING_GOLD_FROM = 3;

export function standingSummary(standing: StandingInfo | null | undefined, validCount: number | null | undefined): StandingSummary | null {
  if (!standing) return null;
  const count = Math.max(0, standing.count);
  const total = validCount && validCount > 0 ? Math.max(validCount, count) : null;
  const ids = standing.cardIds && count <= STANDING_LIST_MAX ? [...standing.cardIds].sort((a, b) => a - b) : null;
  return {
    count,
    total,
    seated: total === null ? null : total - count,
    share: total === null ? null : count / total,
    ids,
    last: count === 1 && ids?.length === 1 ? ids[0] : null,
    gold: count >= 1 && count <= STANDING_GOLD_FROM,
    fellLast: count <= 1 && standing.fellLast ? [...standing.fellLast].sort((a, b) => a - b) : [],
  };
}

/**
 * The next card to check in the shared win: the first of `fellLast` with no claim yet in this round (a claim that was
 * rejected counts as tried). Null when none is left.
 */
export function nextFellLast(fellLast: readonly number[], claims: readonly { cardId: number; round: number }[], round: number): number | null {
  const tried = new Set(claims.filter((c) => c.round === round).map((c) => c.cardId));
  return fellLast.find((id) => !tried.has(id)) ?? null;
}

/**
 * The cards that fell between two lists of standing cards: in the old one, not in the new one. None when either list
 * is missing (above STANDING_LIST_MAX the engine sends only the count) or for a new round (`sameRound` false). A card
 * that comes back (Back undid a landing) simply reappears.
 */
export function fallenBetween(prev: readonly number[] | null | undefined, next: readonly number[] | null | undefined, sameRound = true): number[] {
  if (!sameRound || !prev || !next) return [];
  const still = new Set(next);
  return prev.filter((id) => !still.has(id)).sort((a, b) => a - b);
}

/** A chip of the Dempeus tab: a card standing, or one that just fell (red with a ✗, held, then gone). */
export interface StandingChip {
  cardId: number;
  fallen: boolean;
  /** Its place among the fallen chips, for the 30 ms stagger (0 for a standing chip). */
  order: number;
}

/**
 * The chips to draw: the standing cards and the ones that just fell, merged in card order. At most `maxAnimated` fallen
 * chips are drawn (they go red and leave with an animation); any more vanish at once (ANIMATIONS.md budget).
 */
export function standingChips(ids: readonly number[], fallen: readonly number[], maxAnimated: number): StandingChip[] {
  const shown = new Set(fallen.slice(0, Math.max(0, maxAnimated)));
  const order = new Map([...shown].map((id, i) => [id, i]));
  return [...new Set([...ids, ...shown])]
    .sort((a, b) => a - b)
    .map((cardId) => ({ cardId, fallen: shown.has(cardId) && !ids.includes(cardId), order: order.get(cardId) ?? 0 }));
}

// ---- Futur: the countdown to the last card standing -----------------------------------------------------------
/** The Futur tab's view in the Desgraciat round. */
export interface StandingFuture {
  /** Songs until one card stands: `in` (1 = the next song), `now` (one already stands), `never` (none does with the
   * rest of the Queue), or `unknown` (an older engine). */
  ahead: SongsAhead;
  /** The count after each of the next landings, up to the one that leaves one card (`standingCurve`). */
  curve: { song: number; standing: number }[];
}

export function standingFuture(engine: FutureInfo | null | undefined, position: number, standing: StandingInfo | null | undefined): StandingFuture {
  const curve = (engine?.standingCurve ?? []).map((n, i) => ({ song: i + 1, standing: n }));
  if (standing && standing.count <= 1) return { ahead: { state: 'now' }, curve: [] };
  if (!engine || engine.lastStandingAt === undefined) return { ahead: { state: 'unknown', atLeast: null }, curve };
  if (engine.lastStandingAt === null) return { ahead: { state: 'never' }, curve };
  return { ahead: { state: 'in', songs: Math.max(1, engine.lastStandingAt - position) }, curve };
}
