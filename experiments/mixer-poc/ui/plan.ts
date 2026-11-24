// The Game plan: the setup that Admin edits and the cloud stores. The laptop, projector, console and phones
// all read it:
// - the rounds, each normal or special, with its Line and Quina prizes;
// - the sponsors;
// - the schedule;
// - the cheat sheet's rules.
// Admin's bulk JSON import and export use exactly this shape, so an AI agent can fill it from the
// organizers' spreadsheet.
//
// Proposed for @quina/protocol as protocol/plan.ts (the sound engine session reviews and merges it). Until
// then the screens import it from here. It must not import engine code.
import type { RoundKind } from '@quina/protocol';

export const PLAN_VERSION = 1;

export interface Sponsor {
  /** Stable id, referenced by prizes (for example "forn-can-pep"). */
  id: string;
  name: string;
  /** Path of the cleaned-up logo asset (WebP), or null until it is uploaded. */
  logo: string | null;
}

export interface Prize {
  /** What is won, as presenters read it out ("Sopar per a dos"). */
  title: string;
  detail: string | null;
  sponsorId: string | null;
  /** Optional picture of the prize (an asset path). */
  image: string | null;
}

export interface RoundPlan {
  /** 1, 2, 3… in play order. */
  number: number;
  kind: RoundKind;
  line: Prize | null;
  /** The full-card prize ("premi de quina"). */
  bingo: Prize | null;
}

export interface SchedulePlan {
  /** When the first round should start (epoch ms), or null when not set. */
  startAtMs: number | null;
  /** Planned length of a round, in minutes. */
  roundMinutes: number;
  /** Planned length of an Interval, in minutes (the countdown guide). */
  intervalMinutes: number;
}

export interface CheatSheet {
  claimRules: string[];
  specialRoundRules: string[];
}

export interface GamePlan {
  v: typeof PLAN_VERSION;
  /** The year tag ("26"): in the cards' QR links (/26/123), names the cloud room; phones keep their cards per edition. */
  edition: string;
  /** The night's name on screen: "Quina Musical". */
  title: string;
  rounds: RoundPlan[];
  sponsors: Sponsor[];
  schedule: SchedulePlan;
  cheatSheet: CheatSheet;
}

export type PlanCheck = { ok: true; plan: GamePlan } | { ok: false; errors: string[] };

const LIMITS = { rounds: 20, sponsors: 200, text: 200, detail: 1000, id: 64, rules: 30 } as const;
const ID_RE = /^[a-z0-9][a-z0-9-]*$/;
const EDITION_RE = /^[0-9]{2}$/;

type Rec = Record<string, unknown>;
const isRec = (v: unknown): v is Rec => typeof v === 'object' && v !== null && !Array.isArray(v);

/**
 * Check a Game plan, for example one pasted into Admin's import box. It never throws. It collects every
 * problem with its JSON path, so whoever prepared the file can fix them all at once. Unknown keys are errors,
 * so a typo can't silently drop a prize.
 */
export function checkGamePlan(json: unknown): PlanCheck {
  const errors: string[] = [];
  const err = (path: string, msg: string) => errors.push(`${path}: ${msg}`);

  const keys = (rec: Rec, path: string, allowed: readonly string[]) => {
    for (const k of Object.keys(rec)) if (!allowed.includes(k)) err(path, `unknown key "${k}"`);
  };
  const str = (rec: Rec, key: string, path: string, { max = LIMITS.text as number, nullable = false, empty = false } = {}): string | null => {
    const v = rec[key];
    if (v === null && nullable) return null;
    if (typeof v !== 'string') {
      err(`${path}.${key}`, nullable ? 'must be a string or null' : 'must be a string');
      return null;
    }
    const t = v.trim();
    if (!t && !empty) err(`${path}.${key}`, 'must not be empty');
    if (t.length > max) err(`${path}.${key}`, `longer than ${max} characters`);
    return t;
  };
  const num = (rec: Rec, key: string, path: string, min: number, max: number, { nullable = false, integer = false } = {}): number | null => {
    const v = rec[key];
    if (v === null && nullable) return null;
    if (typeof v !== 'number' || !Number.isFinite(v) || (integer && !Number.isInteger(v))) {
      err(`${path}.${key}`, integer ? 'must be a whole number' : 'must be a number');
      return null;
    }
    if (v < min || v > max) err(`${path}.${key}`, `must be between ${min} and ${max}`);
    return v;
  };
  const list = (rec: Rec, key: string, path: string, max: number): unknown[] => {
    const v = rec[key];
    if (!Array.isArray(v)) {
      err(`${path}.${key}`, 'must be a list');
      return [];
    }
    if (v.length > max) err(`${path}.${key}`, `more than ${max} items`);
    return v;
  };

  if (!isRec(json)) return { ok: false, errors: ['plan: must be a JSON object'] };
  keys(json, 'plan', ['v', 'edition', 'title', 'rounds', 'sponsors', 'schedule', 'cheatSheet']);
  if (json.v !== PLAN_VERSION) err('plan.v', `must be ${PLAN_VERSION}`);
  const edition = str(json, 'edition', 'plan', { max: 2 });
  if (edition !== null && !EDITION_RE.test(edition)) err('plan.edition', 'must be the two-digit year, for example "26"');
  const title = str(json, 'title', 'plan');

  const sponsors: Sponsor[] = [];
  list(json, 'sponsors', 'plan', LIMITS.sponsors).forEach((s, i) => {
    const path = `plan.sponsors[${i}]`;
    if (!isRec(s)) return err(path, 'must be an object');
    keys(s, path, ['id', 'name', 'logo']);
    const id = str(s, 'id', path, { max: LIMITS.id });
    if (id !== null && !ID_RE.test(id)) err(`${path}.id`, 'use lowercase letters, digits and dashes');
    if (id !== null && sponsors.some((o) => o.id === id)) err(`${path}.id`, `repeats "${id}"`);
    sponsors.push({ id: id ?? '', name: str(s, 'name', path) ?? '', logo: str(s, 'logo', path, { nullable: true, max: 500 }) });
  });
  const sponsorIds = new Set(sponsors.map((s) => s.id));

  const prize = (rec: Rec, key: 'line' | 'bingo', path: string): Prize | null => {
    const p = rec[key];
    if (p === null) return null;
    const ppath = `${path}.${key}`;
    if (!isRec(p)) {
      err(ppath, 'must be an object or null');
      return null;
    }
    keys(p, ppath, ['title', 'detail', 'sponsorId', 'image']);
    const sponsorId = str(p, 'sponsorId', ppath, { nullable: true, max: LIMITS.id });
    if (sponsorId !== null && !sponsorIds.has(sponsorId)) err(`${ppath}.sponsorId`, `no sponsor with id "${sponsorId}"`);
    return {
      title: str(p, 'title', ppath) ?? '',
      detail: str(p, 'detail', ppath, { nullable: true, max: LIMITS.detail, empty: true }),
      sponsorId,
      image: str(p, 'image', ppath, { nullable: true, max: 500 }),
    };
  };

  const rounds: RoundPlan[] = [];
  list(json, 'rounds', 'plan', LIMITS.rounds).forEach((r, i) => {
    const path = `plan.rounds[${i}]`;
    if (!isRec(r)) return err(path, 'must be an object');
    keys(r, path, ['number', 'kind', 'line', 'bingo']);
    const number = num(r, 'number', path, 1, LIMITS.rounds, { integer: true });
    if (number !== null && number !== i + 1) err(`${path}.number`, `must be ${i + 1} (rounds are numbered 1, 2, 3… in order)`);
    const kind = r.kind;
    if (kind !== 'normal' && kind !== 'special') err(`${path}.kind`, 'must be "normal" or "special"');
    rounds.push({ number: number ?? i + 1, kind: kind === 'special' ? 'special' : 'normal', line: prize(r, 'line', path), bingo: prize(r, 'bingo', path) });
  });
  if (rounds.length === 0 && Array.isArray(json.rounds)) err('plan.rounds', 'needs at least one round');
  if (rounds.filter((r) => r.kind === 'special').length > 1) err('plan.rounds', 'only one special round is supported');

  let schedule: SchedulePlan = { startAtMs: null, roundMinutes: 25, intervalMinutes: 3 };
  const sch = json.schedule;
  if (!isRec(sch)) err('plan.schedule', 'must be an object');
  else {
    keys(sch, 'plan.schedule', ['startAtMs', 'roundMinutes', 'intervalMinutes']);
    schedule = {
      startAtMs: num(sch, 'startAtMs', 'plan.schedule', 0, 8.64e15, { nullable: true, integer: true }),
      roundMinutes: num(sch, 'roundMinutes', 'plan.schedule', 1, 240) ?? schedule.roundMinutes,
      intervalMinutes: num(sch, 'intervalMinutes', 'plan.schedule', 0, 120) ?? schedule.intervalMinutes,
    };
  }

  let cheatSheet: CheatSheet = { claimRules: [], specialRoundRules: [] };
  const cs = json.cheatSheet;
  if (!isRec(cs)) err('plan.cheatSheet', 'must be an object');
  else {
    keys(cs, 'plan.cheatSheet', ['claimRules', 'specialRoundRules']);
    const lines = (key: 'claimRules' | 'specialRoundRules') =>
      list(cs, key, 'plan.cheatSheet', LIMITS.rules).map((line, i) => {
        if (typeof line !== 'string' || !line.trim()) {
          err(`plan.cheatSheet.${key}[${i}]`, 'must be a non-empty string');
          return '';
        }
        return line.trim();
      });
    cheatSheet = { claimRules: lines('claimRules'), specialRoundRules: lines('specialRoundRules') };
  }

  if (errors.length) return { ok: false, errors };
  return { ok: true, plan: { v: PLAN_VERSION, edition: edition ?? '', title: title ?? '', rounds, sponsors, schedule, cheatSheet } };
}

/** The sponsor of a prize, if any. */
export function sponsorOf(plan: GamePlan, prize: Prize | null): Sponsor | null {
  if (!prize?.sponsorId) return null;
  return plan.sponsors.find((s) => s.id === prize.sponsorId) ?? null;
}

/** The plan of round `number`, if planned. */
export function roundPlan(plan: GamePlan | null, number: number): RoundPlan | null {
  return plan?.rounds.find((r) => r.number === number) ?? null;
}
