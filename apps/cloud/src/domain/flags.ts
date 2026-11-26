// Decisions a person should look at. The Check's result decides (docs/event.md), but since the Review (D121) the
// presenters can win or lose a card by hand, whatever it shows. The cloud never refuses an entry for a game rule,
// because a refused entry stops the laptop's uploads and with them the phones (docs/requirements/operations.md,
// D65). It flags instead, in Admin's Games and the export:
// - a card accepted although its Check didn't pass (a win by hand from a Review, or an older journal's override);
// - a card accepted although it isn't among the cards in play: not sold (`notSold`, as the console warns).
// Pure.
import { isPassingOutcome, parseCardRanges, type CheckOutcome, type JournalEntry, type WinKind } from '@quina/protocol';

export type FlagReason = 'notPassing' | 'notSold';

export interface FlaggedDecision {
  claimId: string;
  round: number;
  cardId: number;
  kind: WinKind;
  /** The Check's result when the card was accepted; null in an older journal. */
  outcome: CheckOutcome | null;
  /** Won by hand from a Review (D121). */
  manual: boolean;
  /** Why it's flagged, at least one. */
  reasons: FlagReason[];
  atMs: number;
}

/**
 * Accepted claims to look at, in journal order. `notPassing` needs the journalled outcome (an older journal has
 * none); `notSold` needs the cards in play (`cards.set`) to be journalled before the decision.
 */
export function flaggedDecisions(entries: readonly JournalEntry[]): FlaggedDecision[] {
  const opened = new Map<string, { cardId: number; kind: WinKind }>();
  let inPlay: Set<number> | null = null;
  const flagged: FlaggedDecision[] = [];
  for (const entry of entries) {
    if (entry.kind === 'cards.set') inPlay = cardsInPlay(entry.ranges);
    else if (entry.kind === 'claim.opened') opened.set(entry.claimId, { cardId: entry.cardId, kind: entry.winKind });
    else if (entry.kind === 'claim.decided' && entry.verdict === 'valid') {
      const claim = opened.get(entry.claimId);
      if (!claim) continue;
      const reasons: FlagReason[] = [];
      if (entry.outcome !== undefined && !isPassingOutcome(entry.outcome, claim.kind)) reasons.push('notPassing');
      if (inPlay && !inPlay.has(claim.cardId)) reasons.push('notSold');
      if (reasons.length) {
        flagged.push({ claimId: entry.claimId, round: entry.round, cardId: claim.cardId, kind: claim.kind, outcome: entry.outcome ?? null, manual: entry.manual === true, reasons, atMs: entry.atMs });
      }
    }
  }
  return flagged;
}

/** The cards in play a `cards.set` names; null when its ranges can't be read (then nothing is flagged as not sold). */
function cardsInPlay(ranges: string): Set<number> | null {
  try {
    return new Set(parseCardRanges(ranges));
  } catch {
    return null;
  }
}
