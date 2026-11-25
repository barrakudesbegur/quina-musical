// Decisions a person should look at. The Check's result decides (docs/event.md): the engine refuses to accept a
// card whose Check didn't pass (isPassingOutcome). The cloud never refuses an entry for a game rule, because a
// refused entry stops the laptop's uploads and with them the phones (docs/requirements/operations.md, D65). It
// flags instead: an accepted claim whose journalled outcome doesn't pass shows in Admin's Games and the export.
// Pure.
import { isPassingOutcome, type CheckOutcome, type JournalEntry, type WinKind } from '@quina/protocol';

export interface FlaggedDecision {
  claimId: string;
  round: number;
  cardId: number;
  kind: WinKind;
  /** The Check's result when the presenters accepted it. */
  outcome: CheckOutcome;
  atMs: number;
}

/** Accepted claims whose Check didn't pass, in journal order. An older journal (no outcome) is never flagged. */
export function flaggedDecisions(entries: readonly JournalEntry[]): FlaggedDecision[] {
  const opened = new Map<string, { cardId: number; kind: WinKind }>();
  const flagged: FlaggedDecision[] = [];
  for (const entry of entries) {
    if (entry.kind === 'claim.opened') opened.set(entry.claimId, { cardId: entry.cardId, kind: entry.winKind });
    else if (entry.kind === 'claim.decided' && entry.verdict === 'valid' && entry.outcome !== undefined) {
      const claim = opened.get(entry.claimId);
      if (claim && !isPassingOutcome(entry.outcome, claim.kind)) {
        flagged.push({ claimId: entry.claimId, round: entry.round, cardId: claim.cardId, kind: claim.kind, outcome: entry.outcome, atMs: entry.atMs });
      }
    }
  }
  return flagged;
}
