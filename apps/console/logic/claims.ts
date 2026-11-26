// The claimed cards during a Check (the strip «Cartrons cantats», shown with 2 or more, D110): what each one's chip
// says and whether it can be (re)checked by hand (`checkStart`: a queued card, e.g. after a Back). Pure.
import type { CheckInfo, ClaimInfo, ClaimStatus, CheckOutcome, WinKind } from '../../../packages/ui/flow.ts';

export interface ClaimView {
  claimId: string;
  cardId: number;
  kind: WinKind;
  status: ClaimStatus;
  outcome: CheckOutcome | null;
  /** Its Check is the one on screen. */
  current: boolean;
  /** "complete since song N": the 1-based song number, or null. */
  completeSinceSong: number | null;
  /** "claimed at song N": the 1-based number of the last counted song when it was claimed (0 before any). */
  claimedAtSong: number;
  notSold: boolean;
  /** Settled: valid or invalid by its cue (or by hand from a Review), or discarded. */
  decided: boolean;
  /** Its Check can be started by hand (`checkStart`): a queued claim. One under review goes on with `reviewEnd`. */
  canCheck: boolean;
}

export interface ClaimsSummary {
  /** Oldest first: the first to claim wins. */
  items: ClaimView[];
  /** Claims still waiting for a verdict (queued, being checked or under review). */
  open: number;
  valid: number;
  invalid: number;
  /** Every claim has a verdict (and there is at least one). */
  allDecided: boolean;
}

const isDecided = (status: ClaimStatus) => status === 'valid' || status === 'invalid' || status === 'discarded';

export function claimView(claim: ClaimInfo, check: CheckInfo | null): ClaimView {
  const decided = isDecided(claim.status);
  return {
    claimId: claim.claimId,
    cardId: claim.cardId,
    kind: claim.kind,
    status: claim.status,
    outcome: claim.outcome,
    current: check?.claimId === claim.claimId,
    completeSinceSong: claim.completeSince === null ? null : claim.completeSince + 1,
    claimedAtSong: claim.position + 1,
    notSold: claim.warnings.includes('notSold'),
    decided,
    canCheck: claim.status === 'queued',
  };
}

export function summarizeClaims(claims: readonly ClaimInfo[], check: CheckInfo | null): ClaimsSummary {
  const items = [...claims].sort((a, b) => a.atMs - b.atMs || a.claimId.localeCompare(b.claimId)).map((c) => claimView(c, check));
  const valid = items.filter((c) => c.status === 'valid').length;
  const invalid = items.filter((c) => c.status === 'invalid').length;
  const open = items.filter((c) => !c.decided).length;
  return { items, open, valid, invalid, allDecided: items.length > 0 && open === 0 };
}
