// The Game plan's versions (whats-left 7.1). Pure, so it is tested on its own (test/node/plan-versions.test.ts).
// - A plan's version is its `savedAtMs`: the cloud's clock when it was saved, never lower than the one before (0 for
//   a plan stored before it was kept). A save names the version it was based on in the `x-quina-plan-base` header
//   (`none`: there was no plan), and the GameRoom refuses it when its plan is no longer that version, so a page that
//   never loaded the plan, or loaded an older one, can't replace it. Admin (packages/ui/data/cloud-plan.ts) and the
//   relay (apps/show/relay/plan.ts) spell the header the same.
// - The plans a save replaced are kept, the newest `CLOUD.planHistory` of them, to restore a bad save.

/** The request header that names a save's base version. */
export const PLAN_BASE_HEADER = 'x-quina-plan-base';

/** A version: a plan's savedAtMs, or null for "no plan". */
export type PlanVersion = number | null;

/** The header's version, or undefined when it is missing or not one (`none`, or a whole number of ms). */
export function parsePlanBase(header: string | null): PlanVersion | undefined {
  if (header === null) return undefined;
  const value = header.trim();
  if (value === 'none') return null;
  return /^\d{1,16}$/.test(value) ? Number(value) : undefined;
}

/** One replaced plan, as GET /api/plan/history lists it (the plan itself at /api/plan/history/<savedAtMs>). */
export interface PlanHistoryItem {
  /** Its version: when it was saved. */
  savedAtMs: number;
  /** When a newer save replaced it. */
  replacedAtMs: number;
  /** Bytes of its JSON. */
  bytes: number;
  title: string | null;
  rounds: number | null;
  sponsors: number | null;
}

/** A replaced plan's list entry, from its stored JSON (never throws: a broken one lists with nulls). */
export function historyItem(savedAtMs: number, replacedAtMs: number, body: string): PlanHistoryItem {
  let plan: Record<string, unknown> = {};
  try {
    const parsed: unknown = JSON.parse(body);
    if (parsed && typeof parsed === 'object') plan = parsed as Record<string, unknown>;
  } catch {
    // listed with nulls
  }
  return {
    savedAtMs,
    replacedAtMs,
    bytes: new TextEncoder().encode(body).byteLength,
    title: typeof plan.title === 'string' ? plan.title : null,
    rounds: Array.isArray(plan.rounds) ? plan.rounds.length : null,
    sponsors: Array.isArray(plan.sponsors) ? plan.sponsors.length : null,
  };
}
