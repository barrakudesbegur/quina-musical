// What an import would change, shown before "Substituir" replaces the plan: rounds added, removed,
// switched between normal and special or to another card type, prize bundles changed, sponsors added, removed or changed, and whether
// the schedule, the cheat-sheet rules, the title, the edition, the prize reveal or the card types changed. Pure.
import { bundleSummary, roundCardType, roundSide, type GamePlan, type Prize, type RoundPlan, type Sponsor } from '../../../packages/ui/plan.ts';
import type { WinKind } from '../../../packages/ui/flow.ts';

export interface PrizeChange {
  round: number;
  kind: WinKind;
  /** The bundle before and after, in a few words (bundleSummary; null: no prizes). */
  before: string | null;
  after: string | null;
}

export interface PlanDiff {
  /** Nothing at all changes. */
  same: boolean;
  title: boolean;
  edition: boolean;
  rounds: {
    before: number;
    after: number;
    /** Round numbers. */
    added: number[];
    removed: number[];
    kindChanged: number[];
    /** Rounds that play another card type (a plan without one plays its kind's default). */
    cardTypeChanged: number[];
    /** Rounds that play another side of the card (a plan without one plays side 1). */
    sideChanged: number[];
  };
  /** Bundles that differ in any prize, field or order, in rounds that exist before and after. */
  prizes: PrizeChange[];
  /** Sponsor ids. `changed`: a different name or logo. */
  sponsors: { added: string[]; removed: string[]; changed: string[] };
  schedule: boolean;
  cheatSheet: boolean;
  prizeReveal: boolean;
}

/** The plan's two bundles per round. */
const KINDS = ['line', 'bingo'] as const satisfies readonly WinKind[];
const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
const bundleKey = (bundle: readonly Prize[] | undefined) => (bundle ?? []).map((p) => [p.title, p.detail, p.sponsorId, p.image, p.headline]);

/** The changes from `before` (the current plan, or null when there is none) to `after`. */
export function diffPlans(before: GamePlan | null, after: GamePlan): PlanDiff {
  const oldRounds = new Map<number, RoundPlan>((before?.rounds ?? []).map((r) => [r.number, r]));
  const newRounds = new Map<number, RoundPlan>(after.rounds.map((r) => [r.number, r]));
  const added = [...newRounds.keys()].filter((n) => !oldRounds.has(n));
  const removed = [...oldRounds.keys()].filter((n) => !newRounds.has(n));
  const kindChanged: number[] = [];
  const cardTypeChanged: number[] = [];
  const sideChanged: number[] = [];
  const prizes: PrizeChange[] = [];
  for (const [n, next] of newRounds) {
    const prev = oldRounds.get(n);
    if (!prev) continue;
    if (prev.kind !== next.kind) kindChanged.push(n);
    if (roundCardType(prev) !== roundCardType(next)) cardTypeChanged.push(n);
    if (roundSide(prev) !== roundSide(next)) sideChanged.push(n);
    for (const kind of KINDS) {
      // The Desgraciat round's `bingo` bundle is the last card standing's prize.
      const shown: WinKind = kind === 'bingo' && next.kind === 'desgraciat' ? 'standing' : kind;
      if (!same(bundleKey(prev[kind]), bundleKey(next[kind]))) prizes.push({ round: n, kind: shown, before: bundleSummary(prev[kind]), after: bundleSummary(next[kind]) });
    }
  }

  const oldSponsors = new Map<string, Sponsor>((before?.sponsors ?? []).map((s) => [s.id, s]));
  const newSponsors = new Map<string, Sponsor>(after.sponsors.map((s) => [s.id, s]));
  const sponsors = {
    added: [...newSponsors.keys()].filter((id) => !oldSponsors.has(id)),
    removed: [...oldSponsors.keys()].filter((id) => !newSponsors.has(id)),
    changed: [...newSponsors.values()].filter((s) => {
      const prev = oldSponsors.get(s.id);
      return prev !== undefined && (prev.name !== s.name || prev.logo !== s.logo);
    }).map((s) => s.id),
  };

  const diff: PlanDiff = {
    same: false,
    title: before?.title !== after.title,
    edition: before?.edition !== after.edition,
    rounds: { before: before?.rounds.length ?? 0, after: after.rounds.length, added, removed, kindChanged, cardTypeChanged, sideChanged },
    prizes,
    sponsors,
    schedule: !same(before?.schedule ?? null, after.schedule),
    cheatSheet: !same(before?.cheatSheet ?? null, after.cheatSheet),
    prizeReveal: before?.prizeReveal !== after.prizeReveal,
  };
  diff.same =
    !diff.title &&
    !diff.edition &&
    !added.length &&
    !removed.length &&
    !kindChanged.length &&
    !cardTypeChanged.length &&
    !sideChanged.length &&
    !prizes.length &&
    !sponsors.added.length &&
    !sponsors.removed.length &&
    !sponsors.changed.length &&
    !diff.schedule &&
    !diff.cheatSheet &&
    !diff.prizeReveal &&
    // Same content in another order (rounds are matched by number, sponsors by id).
    same(before?.sponsors.map((s) => s.id), after.sponsors.map((s) => s.id));
  return diff;
}
