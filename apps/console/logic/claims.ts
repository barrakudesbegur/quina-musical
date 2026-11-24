// The queue of claimed cards during a Check: what each claim's row says and which actions it offers. Pure.
import type { CheckInfo, ClaimInfo, ClaimStatus, CheckOutcome, WinKind } from '../../ui/flow.ts';

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
  notSold: boolean;
  /** The presenters have decided it (valid or invalid). */
  decided: boolean;
  /** (Re)start its Check (`checkStart`): a queued claim, or a re-check of an undecided one. */
  canCheck: boolean;
}

export interface ClaimsSummary {
  /** Oldest first: the first to claim wins. */
  items: ClaimView[];
  /** Claims still waiting for a verdict. */
  open: number;
  valid: number;
  invalid: number;
  /** Every claim has a verdict (and there is at least one). */
  allDecided: boolean;
}

const isDecided = (status: ClaimStatus) => status === 'valid' || status === 'invalid';

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
    notSold: claim.warnings.includes('notSold'),
    decided,
    canCheck: !decided,
  };
}

export function summarizeClaims(claims: readonly ClaimInfo[], check: CheckInfo | null): ClaimsSummary {
  const items = [...claims].sort((a, b) => a.atMs - b.atMs || a.claimId.localeCompare(b.claimId)).map((c) => claimView(c, check));
  const valid = items.filter((c) => c.status === 'valid').length;
  const invalid = items.filter((c) => c.status === 'invalid').length;
  return { items, open: items.length - valid - invalid, valid, invalid, allDecided: items.length > 0 && valid + invalid === items.length };
}
