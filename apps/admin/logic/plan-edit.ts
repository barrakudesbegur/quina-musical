// Edits to the Game plan that need more than setting a field: adding, removing and reordering rounds (they
// are renumbered 1, 2, 3… every time), sponsor ids that follow their name and keep prizes pointing at them,
// blank prizes and plans, and the schedule's local date-time. Pure: each returns new values and never
// mutates its input.
import { PLAN_VERSION, type CheatSheet, type GamePlan, type Prize, type RoundPlan, type SchedulePlan } from '../../../packages/ui/plan.ts';
import type { RoundKind } from '@quina/protocol';

export const blankPrize = (): Prize => ({ title: '', detail: null, sponsorId: null, image: null });

export const blankRound = (number: number, kind: RoundKind = 'normal'): RoundPlan => ({ number, kind, line: blankPrize(), bingo: blankPrize() });

export const DEFAULT_SCHEDULE: SchedulePlan = Object.freeze({ startAtMs: null, roundMinutes: 25, intervalMinutes: 3 });

/** A new plan with one normal round, no sponsors and the given cheat-sheet rules. */
export function blankPlan(edition: string, title: string, cheatSheet: CheatSheet): GamePlan {
  return {
    v: PLAN_VERSION,
    edition,
    title,
    rounds: [blankRound(1)],
    sponsors: [],
    schedule: { ...DEFAULT_SCHEDULE },
    cheatSheet: { claimRules: [...cheatSheet.claimRules], specialRoundRules: [...cheatSheet.specialRoundRules] },
  };
}

/** Rounds numbered 1, 2, 3… in their order. */
export function renumber(rounds: readonly RoundPlan[]): RoundPlan[] {
  return rounds.map((r, i) => (r.number === i + 1 ? r : { ...r, number: i + 1 }));
}

export function addRound(rounds: readonly RoundPlan[], kind: RoundKind = 'normal'): RoundPlan[] {
  return [...rounds, blankRound(rounds.length + 1, kind)];
}

export function removeRound(rounds: readonly RoundPlan[], index: number): RoundPlan[] {
  if (index < 0 || index >= rounds.length) return [...rounds];
  return renumber(rounds.filter((_, i) => i !== index));
}

/** Move the round at `from` to `to` (both clamped), then renumber. */
export function moveRound(rounds: readonly RoundPlan[], from: number, to: number): RoundPlan[] {
  const out = [...rounds];
  if (from < 0 || from >= out.length) return out;
  const target = Math.max(0, Math.min(out.length - 1, to));
  const [moved] = out.splice(from, 1);
  out.splice(target, 0, moved);
  return renumber(out);
}

// ---- sponsors -------------------------------------------------------------------------------------------

/** "Forn Can Pep, S.L." → "forn-can-pep-s-l": lowercase letters, digits and dashes, as checkGamePlan wants. */
export function slugify(name: string, maxLength = 64): string {
  const slug = name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\u00b7/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, maxLength)
    .replace(/-+$/, '');
  return slug;
}

/** An id for a new sponsor, unique among `taken` ("patrocinador", "patrocinador-2"…). */
export function sponsorIdFor(name: string, taken: Iterable<string>, fallback = 'patrocinador'): string {
  const used = new Set(taken);
  const base = slugify(name) || fallback;
  if (!used.has(base)) return base;
  for (let n = 2; ; n++) {
    const id = `${base.slice(0, 60)}-${n}`;
    if (!used.has(id)) return id;
  }
}

/** How many prizes point at a sponsor. */
export function sponsorUsage(plan: GamePlan, id: string): number {
  return plan.rounds.reduce((n, r) => n + (r.line?.sponsorId === id ? 1 : 0) + (r.bingo?.sponsorId === id ? 1 : 0), 0);
}

const mapPrizes = (plan: GamePlan, fn: (p: Prize) => Prize): RoundPlan[] =>
  plan.rounds.map((r) => ({ ...r, line: r.line && fn(r.line), bingo: r.bingo && fn(r.bingo) }));

/** Change a sponsor's id and every prize that points at it. */
export function renameSponsor(plan: GamePlan, oldId: string, newId: string): GamePlan {
  if (oldId === newId) return plan;
  return {
    ...plan,
    sponsors: plan.sponsors.map((s) => (s.id === oldId ? { ...s, id: newId } : s)),
    rounds: mapPrizes(plan, (p) => (p.sponsorId === oldId ? { ...p, sponsorId: newId } : p)),
  };
}

/** Remove a sponsor. Prizes that pointed at it keep their title with no sponsor; `cleared` counts them. */
export function removeSponsor(plan: GamePlan, id: string): { plan: GamePlan; cleared: number } {
  const cleared = sponsorUsage(plan, id);
  return {
    plan: {
      ...plan,
      sponsors: plan.sponsors.filter((s) => s.id !== id),
      rounds: mapPrizes(plan, (p) => (p.sponsorId === id ? { ...p, sponsorId: null } : p)),
    },
    cleared,
  };
}

// ---- schedule -------------------------------------------------------------------------------------------

const pad = (n: number) => String(n).padStart(2, '0');

/** Epoch ms → the value of an `<input type="datetime-local">` in this device's time zone ("" for null). */
export function toLocalInput(ms: number | null): string {
  if (ms === null || !Number.isFinite(ms)) return '';
  const d = new Date(ms);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** An `<input type="datetime-local">` value → epoch ms in this device's time zone; null when empty or junk. */
export function fromLocalInput(value: string): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/.exec(value.trim());
  if (!m) return null;
  const [y, mo, d, h, mi, s] = m.slice(1).map((x) => (x === undefined ? 0 : Number(x)));
  const date = new Date(y, mo - 1, d, h, mi, s);
  // Reject dates the Date constructor rolled over (2026-02-30 → March 2).
  if (date.getFullYear() !== y || date.getMonth() !== mo - 1 || date.getDate() !== d) return null;
  return date.getTime();
}

/** When the last round should end: start + rounds × round length + the Intervals between them. */
export function plannedEndMs(plan: Pick<GamePlan, 'rounds' | 'schedule'>): number | null {
  const { startAtMs, roundMinutes, intervalMinutes } = plan.schedule;
  if (startAtMs === null || !plan.rounds.length) return null;
  const n = plan.rounds.length;
  return startAtMs + (n * roundMinutes + (n - 1) * intervalMinutes) * 60_000;
}
