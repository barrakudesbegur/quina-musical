// The Game plan's versions (whats-left 7.1). Pure, so it is tested on its own.
// - A plan's version is its `savedAtMs`: the cloud's clock when it was saved, never lower than the one before (0 for
//   a plan stored before it was kept). A save names the version it was based on in the `x-quina-plan-base` header
//   (`none`: there was no plan), and the GameRoom refuses it when its plan is no longer that version, so a page that
//   never loaded the plan, or loaded an older one, can't replace it. Admin (packages/ui/data/cloud-plan.ts) and the
//   relay (apps/show/relay/plan.ts) spell the header the same.

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
