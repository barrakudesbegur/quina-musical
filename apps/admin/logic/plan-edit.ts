// Edits to the Game plan that need more than setting a field: adding, removing and reordering rounds (they
// are renumbered 1, 2, 3… every time), a Line's or Quina's prize bundle (add, remove, move, mark headline:
// headline prizes always come first), sponsor ids that follow their name and keep prizes pointing at them,
// blank prizes and plans, a round's card type and side, the schedule's local date-time, the doors' time and the
// planned Throws. Pure: each returns new values and never mutates its input.
import type { PlannedThrow } from '@quina/protocol';
import { PLAN_VERSION, quinaNumber, type CheatSheet, type GamePlan, type Prize, type PrizeBundle, type RoundPlan, type SchedulePlan } from '../../../packages/ui/plan.ts';
import { cardTypeSides, defaultCardType, roundCardType, roundSide, type RoundKind } from '@quina/protocol';
import type { PrintedCardType } from '../../../packages/ui/data/card-types.ts';

export const blankPrize = (headline = false): Prize => ({ title: '', detail: null, sponsorId: null, image: null, headline });

/** A new round after `rounds`: its kind's card type, its default side (defaultSide), and no prizes yet (empty bundles
 * are valid; screens say the prizes are still to come). */
export function blankRound(number: number, kind: RoundKind = 'normal', types: readonly PrintedCardType[] = [], rounds: readonly Pick<RoundPlan, 'number' | 'kind'>[] = []): RoundPlan {
  const round = { number, kind, cardType: defaultCardType(kind), line: [], bingo: [] };
  return { ...round, side: defaultSide(round, rounds, types) };
}

// ---- a round's card type and side ------------------------------------------------------------------------

/**
 * The last Quina whose normal rounds play the normal card's side 1 (D193): Quines 1–5 play side 1, from pool 1, and
 * Quines 6–10 side 2, from pool 2, as printed on each side ("1–5", "6–10").
 */
export const SIDE_1_LAST_QUINA = 5;

/**
 * The side a round plays unless set otherwise (D171). The normal rounds count on their own, as the screens and the
 * card's mark do (quinaNumber): the first five play side 1 and the rest side 2, wherever the specials sit in the plan
 * (`rounds`); the Desgraciat and the Especial play side 1 (pool 1). A card type that doesn't have that side (one printed
 * on one side) plays its first. Without card-types.json, D171's side.
 */
export function defaultSide(round: Pick<RoundPlan, 'number' | 'kind'> & { cardType?: string }, rounds: readonly Pick<RoundPlan, 'number' | 'kind'>[], types: readonly PrintedCardType[]): number {
  const quina = quinaNumber(round, rounds);
  const wanted = quina !== null && quina > SIDE_1_LAST_QUINA ? 2 : 1;
  const sides = types.find((t) => t.type === roundCardType(round))?.sides;
  if (!sides) return wanted;
  return sides.some((s) => s.side === wanted) ? wanted : (sides[0]?.side ?? 1);
}

/** The sides a round's picker offers: its card type's (card-types.json), plus the round's own when the type lacks it
 * (so the picker still shows what the plan says, next to its warning). */
export function sideChoices(types: readonly PrintedCardType[], cardType: string, current: number): { side: number; label: string | null }[] {
  const sides = cardTypeSides(types.find((t) => t.type === cardType)).map((s) => ({ side: s.side, label: s.label ?? null }));
  return sides.some((s) => s.side === current) ? sides : [...sides, { side: current, label: null }];
}

/** The type has that side (or nobody knows: no card-types.json, an unlisted type). */
const hasSide = (types: readonly PrintedCardType[], cardType: string, side: number): boolean =>
  types.find((t) => t.type === cardType)?.sides.some((s) => s.side === side) ?? true;

/** A round of `rounds` given another card type: its side stays when the new type has it, else it takes its default. */
export function withCardType(round: RoundPlan, cardType: string, types: readonly PrintedCardType[], rounds: readonly Pick<RoundPlan, 'number' | 'kind'>[] = []): RoundPlan {
  const next = { ...round, cardType };
  return hasSide(types, cardType, roundSide(round)) ? next : { ...next, side: defaultSide(next, rounds, types) };
}

/**
 * A round switched to another kind. Its card type follows when it was still the old kind's default (a normal round
 * made special now plays the especial cards); a type picked on purpose stays. Its side likewise: the new default when it
 * was the old one, else the side picked while its card type has it. A round made the Desgraciat one keeps its Line prizes: that round has no Line,
 * so they move into its one bundle, the last card standing's (`bingo`), never lost (the editor says so:
 * movedLinePrizes).
 */
export function withRoundKind(round: RoundPlan, kind: RoundKind, types: readonly PrintedCardType[] = [], rounds: readonly Pick<RoundPlan, 'number' | 'kind'>[] = []): RoundPlan {
  if (round.kind === kind) return round;
  const type = roundCardType(round);
  const next = { ...round, kind, cardType: type === defaultCardType(round.kind) ? defaultCardType(kind) : type };
  const side = roundSide(round) === defaultSide(round, rounds, types) ? defaultSide(next, rounds, types) : roundSide(round);
  const withSide = { ...next, side: hasSide(types, next.cardType, side) ? side : defaultSide(next, rounds, types) };
  return kind === 'desgraciat' ? withLineMoved(withSide) : withSide;
}

/** How many Line prizes switching this round to `kind` moves into its last-card-standing bundle. */
export const movedLinePrizes = (round: Pick<RoundPlan, 'kind' | 'line'>, kind: RoundKind): number => (kind === 'desgraciat' && round.kind !== kind ? round.line.length : 0);

/** A round's Line prizes moved after its Quina's (headline prizes first, as the plan requires), its Line left empty. */
export function withLineMoved(round: RoundPlan): RoundPlan {
  if (!round.line.length) return round;
  return { ...round, bingo: sortBundle([...round.bingo, ...round.line]), line: [] };
}

/** Whether a round other than the one at `index` already is the night's Desgraciat round: there can be only one
 * (checkGamePlan refuses a second). */
export function desgraciatTaken(rounds: readonly Pick<RoundPlan, 'kind'>[], index: number): boolean {
  return rounds.some((r, i) => i !== index && r.kind === 'desgraciat');
}

/** The card types a round's picker offers: card-types.json's, plus the round's own when the list lacks it (so the
 * picker still shows what the plan says, next to its warning). */
export function cardTypeChoices(types: readonly PrintedCardType[], current: string): string[] {
  const ids = types.map((t) => t.type);
  return ids.includes(current) ? ids : [...ids, current];
}

/** A round names a type card-types.json doesn't have (a typo, or a type not printed yet). Unknowable without the file. */
export const isUnknownCardType = (type: string, printed: readonly PrintedCardType[] | null): boolean =>
  printed !== null && !printed.some((t) => t.type === type);

export const DEFAULT_SCHEDULE: SchedulePlan = Object.freeze({ startAtMs: null, roundMinutes: 25, intervalMinutes: 3 });

/** A new plan with one normal round (it plays its kind's card type), no sponsors and the given cheat-sheet rules. */
export function blankPlan(edition: string, title: string, cheatSheet: CheatSheet): GamePlan {
  return {
    v: PLAN_VERSION,
    edition,
    title,
    prizeReveal: 'perRound',
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

export function addRound(rounds: readonly RoundPlan[], kind: RoundKind = 'normal', types: readonly PrintedCardType[] = []): RoundPlan[] {
  return [...rounds, blankRound(rounds.length + 1, kind, types, rounds)];
}

/**
 * How many rounds at the top of the plan are fixed during the night: the ones played, and the one in play or
 * being introduced. Their number, order and kind can't change (the engine, the projector and the phones already
 * know them); the upcoming ones can still be moved and edited live. 0 before the first round.
 */
export function lockedRoundCount(current: { number: number; startedAtMs: number } | null | undefined, introduced: number | null = null): number {
  const started = current && current.startedAtMs > 0 ? current.number : 0;
  return Math.max(started, introduced ?? 0);
}

/** Remove the round at `index`, then renumber. A fixed round (below `locked`) stays. */
export function removeRound(rounds: readonly RoundPlan[], index: number, locked = 0): RoundPlan[] {
  if (index < locked || index < 0 || index >= rounds.length) return [...rounds];
  return renumber(rounds.filter((_, i) => i !== index));
}

/** Move the round at `from` to `to` (clamped), then renumber. Fixed rounds (below `locked`) never move, and
 * nothing moves above them. */
export function moveRound(rounds: readonly RoundPlan[], from: number, to: number, locked = 0): RoundPlan[] {
  const out = [...rounds];
  if (from < locked || from < 0 || from >= out.length) return out;
  const target = Math.max(locked, Math.min(out.length - 1, to));
  const [moved] = out.splice(from, 1);
  out.splice(target, 0, moved);
  return renumber(out);
}

// ---- prize bundles ------------------------------------------------------------------------------------

/** How many prizes at the start of a bundle are headline ones. */
const headlineCount = (bundle: readonly Prize[]): number => {
  const first = bundle.findIndex((p) => !p.headline);
  return first < 0 ? bundle.length : first;
};

/** Headline prizes first, each group in its order (what checkGamePlan requires). */
export function sortBundle(bundle: readonly Prize[]): PrizeBundle {
  return [...bundle.filter((p) => p.headline), ...bundle.filter((p) => !p.headline)];
}

/** Add a blank prize: a headline one after the other headline prizes, any other at the end. */
export function addPrize(bundle: readonly Prize[], headline = false): PrizeBundle {
  const sorted = sortBundle(bundle);
  const at = headline ? headlineCount(sorted) : sorted.length;
  return [...sorted.slice(0, at), blankPrize(headline), ...sorted.slice(at)];
}

export function removePrize(bundle: readonly Prize[], index: number): PrizeBundle {
  return bundle.filter((_, i) => i !== index);
}

/** The range a prize may move in: headline prizes among themselves, the others below them. */
export function prizeMoveRange(bundle: readonly Prize[], index: number): { min: number; max: number } {
  const headlines = headlineCount(bundle);
  return bundle[index]?.headline ? { min: 0, max: headlines - 1 } : { min: headlines, max: bundle.length - 1 };
}

/** Move a prize from `from` to `to`, clamped to its group (a headline prize never drops below another prize). */
export function movePrize(bundle: readonly Prize[], from: number, to: number): PrizeBundle {
  const out = [...bundle];
  if (from < 0 || from >= out.length) return out;
  const { min, max } = prizeMoveRange(out, from);
  const target = Math.max(min, Math.min(max, to));
  const [moved] = out.splice(from, 1);
  out.splice(target, 0, moved);
  return out;
}

/** Mark a prize as headline (it joins the end of the headline ones) or not (it leads the others). */
export function setHeadline(bundle: readonly Prize[], index: number, headline: boolean): PrizeBundle {
  const prize = bundle[index];
  if (!prize) return [...bundle];
  const rest = sortBundle(bundle.filter((_, i) => i !== index));
  const at = headlineCount(rest);
  return [...rest.slice(0, at), { ...prize, headline }, ...rest.slice(at)];
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
  return plan.rounds.reduce((n, r) => n + [...r.line, ...r.bingo].filter((p) => p.sponsorId === id).length, 0);
}

const mapPrizes = (plan: GamePlan, fn: (p: Prize) => Prize): RoundPlan[] => plan.rounds.map((r) => ({ ...r, line: r.line.map(fn), bingo: r.bingo.map(fn) }));

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

/** The doors open (`doorsAtMs`, D150) after the first round's start: checkGamePlan refuses it, and the field says so. */
export function doorsAfterStart(schedule: Pick<SchedulePlan, 'doorsAtMs' | 'startAtMs'>): boolean {
  return schedule.doorsAtMs != null && schedule.startAtMs !== null && schedule.doorsAtMs > schedule.startAtMs;
}

/** When the last round should end: start + rounds × round length + the Intervals between them + the planned Throws
 * (a Throw after the last round wouldn't count; the plan doesn't allow one). */
export function plannedEndMs(plan: Pick<GamePlan, 'rounds' | 'schedule'>): number | null {
  const { startAtMs, roundMinutes, intervalMinutes } = plan.schedule;
  if (startAtMs === null || !plan.rounds.length) return null;
  const n = plan.rounds.length;
  const throws = (plan.schedule.throws ?? []).filter((t) => t.afterRound >= 1 && t.afterRound < n).reduce((sum, t) => sum + t.minutes, 0);
  return startAtMs + (n * roundMinutes + (n - 1) * intervalMinutes + throws) * 60_000;
}

// ---- planned Throws (D136: about 5 minutes on top of the Interval after some rounds, docs/event.md) -------------
/** The default length of a planned Throw, in minutes. */
export const DEFAULT_THROW_MINUTES = 5;

/** The rounds a Throw may follow: every planned round but the last, and not one that already has a Throw. */
export function throwSlots(plan: Pick<GamePlan, 'rounds' | 'schedule'>): number[] {
  const taken = new Set((plan.schedule.throws ?? []).map((t) => t.afterRound));
  return plan.rounds.map((r) => r.number).filter((n) => n < plan.rounds.length && !taken.has(n));
}

/** The Throws with one added after `afterRound` (sorted by round); the same list when that round has one already. */
export function withThrow(throws: readonly PlannedThrow[] | undefined, afterRound: number, minutes = DEFAULT_THROW_MINUTES): PlannedThrow[] {
  const list = [...(throws ?? [])];
  if (list.some((t) => t.afterRound === afterRound)) return list;
  return [...list, { afterRound, minutes }].sort((a, b) => a.afterRound - b.afterRound);
}

/** The Throws without the one after `afterRound`. Undefined when none is left, so a plan without Throws reads back
 * unchanged (the protocol leaves the field out then). */
export function withoutThrow(throws: readonly PlannedThrow[] | undefined, afterRound: number): PlannedThrow[] | undefined {
  const left = (throws ?? []).filter((t) => t.afterRound !== afterRound);
  return left.length ? left : undefined;
}
