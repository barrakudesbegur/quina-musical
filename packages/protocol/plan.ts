// The Game plan: the setup that Admin edits and the cloud stores. The laptop, projector, console and phones
// all read it:
// - the edition's name on every screen ("Quina Quina 3");
// - the rounds, each normal, special or Desgraciat, with its Line's and Quina's prize bundles (headline prizes
//   first; the Desgraciat round has no Line, and its `bingo` bundle is the last card standing's prize);
// - when the prizes are revealed (round by round as the presenters announce them, or all kept secret);
// - each round's printed card type (its name, colour and price are apps/cards' card-types.json);
// - the sponsors;
// - the schedule;
// - the cheat sheet's rules (presenters only).
// Phones see it through publicPlan: locked rounds keep only their skeleton, and the cheat sheet stays out.
// Admin's bulk JSON import and export use exactly this shape, so an AI agent can fill it from the
// organizers' spreadsheet.
//
// Part of @quina/protocol (written by the UI session). It must not import engine code.
import { defaultCardType, isCardTypeId, isRoundKind, type RoundKind } from './vocabulary.ts';

/** Version 2: prize bundles, card types and the prize reveal. checkGamePlan still reads version 1 plans. */
export const PLAN_VERSION = 2;

export interface Sponsor {
  /** Stable id, referenced by prizes (for example "forn-can-pep"). */
  id: string;
  name: string;
  /** Path of the cleaned-up logo asset (`/media/<key>.png` or `.jpg`, with a `.jxl` beside it; never WebP), or null until it is uploaded. */
  logo: string | null;
}

export interface Prize {
  /** What is won, as presenters read it out ("Sopar per a dos"). */
  title: string;
  detail: string | null;
  sponsorId: string | null;
  /** Optional picture of the prize (an asset path); screens show it for headline prizes. */
  image: string | null;
  /** Shown first and bigger: usually one or two per bundle, and they come first in it. */
  headline: boolean;
}

/** A Line's or a Quina's prizes, in the order screens list them (headline prizes first); empty until set. */
export type PrizeBundle = Prize[];

export interface RoundPlan {
  /** 1, 2, 3… in play order. */
  number: number;
  kind: RoundKind;
  /**
   * The printed card type this round plays (a card-types.json id): only cards of this type count in it.
   * checkGamePlan always fills it (defaultCardType(kind) when the plan doesn't say); optional in the type only until
   * every screen sets it (then it becomes required, with plan version 3). Read it with roundCardType().
   */
  cardType?: string;
  line: PrizeBundle;
  /** The full-card prizes ("premis de quina"); in the Desgraciat round, the last card standing's (its `line` is empty). */
  bingo: PrizeBundle;
}

/**
 * @deprecated The card types now come from apps/cards' card-types.json, and each round names its own
 * (`RoundPlan.cardType`). Kept until every screen reads them there; plan version 3 drops it.
 * The printed card types (cards.json `type`): how screens show them before the night, and where they play.
 */
export interface CardType {
  type: 'normal' | 'especial';
  /** "Cartró normal". */
  name: string;
  /** Its pastel colour, "#rrggbb". */
  color: string;
  /** Its price in cents, or null when not set. */
  priceCents: number | null;
  /** The round kinds that accept it (the engine's rule: normal cards in normal rounds, especial in the special one). */
  rounds: RoundKind[];
}

/** When phones see each round's prizes: round by round as announced (round 1 from the start), or all kept secret
 * until the presenters reveal a round. */
export type PrizeReveal = 'perRound' | 'allSecret';

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
  /** The edition's name, on every screen: "Quina Quina 3". */
  title: string;
  prizeReveal: PrizeReveal;
  rounds: RoundPlan[];
  sponsors: Sponsor[];
  /** @deprecated See CardType: read card-types.json and `RoundPlan.cardType` instead. */
  cardTypes: CardType[];
  schedule: SchedulePlan;
  cheatSheet: CheatSheet;
}

export type PlanCheck = { ok: true; plan: GamePlan } | { ok: false; errors: string[] };

const LIMITS = { rounds: 20, sponsors: 200, text: 200, detail: 1000, id: 64, rules: 30, bundle: 40, priceCents: 100_000 } as const;
const COLOR_RE = /^#[0-9a-f]{6}$/i;
/** The card types every plan starts with (and a version 1 plan gets). */
export const DEFAULT_CARD_TYPES: readonly CardType[] = Object.freeze([
  { type: 'normal', name: 'Cartró normal', color: '#cfe8ff', priceCents: null, rounds: ['normal'] },
  { type: 'especial', name: 'Cartró especial', color: '#ffd9e8', priceCents: null, rounds: ['special'] },
]);
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
  // Version 1 (one prize per Line or Quina, no card types, no reveal setting) is read as version 2: each prize
  // becomes a bundle of one headline prize.
  const v1 = json.v === 1;
  keys(json, 'plan', v1 ? ['v', 'edition', 'title', 'rounds', 'sponsors', 'schedule', 'cheatSheet'] : ['v', 'edition', 'title', 'prizeReveal', 'rounds', 'sponsors', 'cardTypes', 'schedule', 'cheatSheet']);
  if (json.v !== PLAN_VERSION && !v1) err('plan.v', `must be ${PLAN_VERSION}`);
  const prizeReveal: PrizeReveal = v1 ? 'perRound' : json.prizeReveal === 'allSecret' ? 'allSecret' : 'perRound';
  if (!v1 && json.prizeReveal !== 'perRound' && json.prizeReveal !== 'allSecret') err('plan.prizeReveal', 'must be "perRound" or "allSecret"');
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

  const prize = (p: unknown, ppath: string, headline: boolean | null): Prize | null => {
    if (!isRec(p)) {
      err(ppath, 'must be an object');
      return null;
    }
    keys(p, ppath, headline === null ? ['title', 'detail', 'sponsorId', 'image', 'headline'] : ['title', 'detail', 'sponsorId', 'image']);
    const sponsorId = str(p, 'sponsorId', ppath, { nullable: true, max: LIMITS.id });
    if (sponsorId !== null && !sponsorIds.has(sponsorId)) err(`${ppath}.sponsorId`, `no sponsor with id "${sponsorId}"`);
    if (headline === null && typeof p.headline !== 'boolean') err(`${ppath}.headline`, 'must be true or false');
    return {
      title: str(p, 'title', ppath) ?? '',
      detail: str(p, 'detail', ppath, { nullable: true, max: LIMITS.detail, empty: true }),
      sponsorId,
      image: str(p, 'image', ppath, { nullable: true, max: 500 }),
      headline: headline ?? p.headline === true,
    };
  };
  /** A bundle (version 2: a list, headline prizes first), or a version 1 prize (one headline prize, or null). */
  const bundle = (rec: Rec, key: 'line' | 'bingo', path: string): PrizeBundle => {
    const v = rec[key];
    const bpath = `${path}.${key}`;
    if (v1) {
      if (v === null) return [];
      const one = prize(v, bpath, true);
      return one ? [one] : [];
    }
    const items = list(rec, key, path, LIMITS.bundle).flatMap((p, i) => prize(p, `${bpath}[${i}]`, null) ?? []);
    const firstOther = items.findIndex((p) => !p.headline);
    if (firstOther >= 0 && items.slice(firstOther).some((p) => p.headline)) err(bpath, 'headline prizes must come first');
    return items;
  };

  const rounds: RoundPlan[] = [];
  list(json, 'rounds', 'plan', LIMITS.rounds).forEach((r, i) => {
    const path = `plan.rounds[${i}]`;
    if (!isRec(r)) return err(path, 'must be an object');
    keys(r, path, v1 ? ['number', 'kind', 'line', 'bingo'] : ['number', 'kind', 'cardType', 'line', 'bingo']);
    const number = num(r, 'number', path, 1, LIMITS.rounds, { integer: true });
    if (number !== null && number !== i + 1) err(`${path}.number`, `must be ${i + 1} (rounds are numbered 1, 2, 3… in order)`);
    const kind = r.kind;
    if (!isRoundKind(kind)) err(`${path}.kind`, 'must be "normal", "special" or "desgraciat"');
    if (r.cardType !== undefined && !isCardTypeId(r.cardType)) err(`${path}.cardType`, 'must be a card type id from card-types.json, such as "normal" or "especial"');
    rounds.push({
      number: number ?? i + 1,
      kind: isRoundKind(kind) ? kind : 'normal',
      // Filled below when the plan doesn't name one (from its old card types, else the kind's default).
      ...(isCardTypeId(r.cardType) ? { cardType: r.cardType } : {}),
      line: bundle(r, 'line', path),
      bingo: bundle(r, 'bingo', path),
    });
  });
  if (rounds.length === 0 && Array.isArray(json.rounds)) err('plan.rounds', 'needs at least one round');
  if (rounds.filter((r) => r.kind === 'special').length > 1) err('plan.rounds', 'only one special round is supported');
  if (rounds.filter((r) => r.kind === 'desgraciat').length > 1) err('plan.rounds', 'only one Desgraciat round per night');
  rounds.forEach((r, i) => {
    if (r.kind === 'desgraciat' && r.line.length) err(`plan.rounds[${i}].line`, 'a Desgraciat round has no Line: put its prizes in "bingo" (the last card standing)');
  });

  const cardTypes: CardType[] = v1 ? DEFAULT_CARD_TYPES.map((c) => ({ ...c, rounds: [...c.rounds] })) : [];
  if (!v1) {
    list(json, 'cardTypes', 'plan', 10).forEach((c, i) => {
      const path = `plan.cardTypes[${i}]`;
      if (!isRec(c)) return err(path, 'must be an object');
      keys(c, path, ['type', 'name', 'color', 'priceCents', 'rounds']);
      if (c.type !== 'normal' && c.type !== 'especial') err(`${path}.type`, 'must be "normal" or "especial" (as on the printed cards)');
      if (cardTypes.some((o) => o.type === c.type)) err(`${path}.type`, `repeats "${String(c.type)}"`);
      const color = str(c, 'color', path, { max: 7 });
      if (color !== null && !COLOR_RE.test(color)) err(`${path}.color`, 'must be a colour like "#cfe8ff"');
      const kinds = Array.isArray(c.rounds) ? c.rounds : [];
      if (!Array.isArray(c.rounds) || !kinds.length || kinds.some((k) => k !== 'normal' && k !== 'special')) err(`${path}.rounds`, 'must list "normal" and/or "special"');
      cardTypes.push({
        type: c.type === 'especial' ? 'especial' : 'normal',
        name: str(c, 'name', path) ?? '',
        color: color ?? '',
        priceCents: num(c, 'priceCents', path, 0, LIMITS.priceCents, { nullable: true, integer: true }),
        rounds: kinds.filter((k): k is RoundKind => k === 'normal' || k === 'special'),
      });
    });
  }

  // A round without its own card type plays the first old card type that listed its kind, else the kind's default.
  for (const r of rounds) r.cardType ??= cardTypes.find((c) => c.rounds.includes(r.kind))?.type ?? defaultCardType(r.kind);

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
  return { ok: true, plan: { v: PLAN_VERSION, edition: edition ?? '', title: title ?? '', prizeReveal, rounds, sponsors, cardTypes, schedule, cheatSheet } };
}

/** A bundle's headline prizes (the first ones), or its first prize when none is marked. */
export function headlinePrizes(bundle: PrizeBundle): Prize[] {
  const marked = bundle.filter((p) => p.headline);
  return marked.length ? marked : bundle.slice(0, 1);
}

/** A round's prize reveal, as the journal records it (`prizes.revealed`): by the presenters, or as it was introduced. */
export interface PrizesRevealed {
  round: number;
  by: 'presenters' | 'intro';
}

/**
 * The rounds whose prizes phones may see. `perRound`: round 1 from the start, and every round the journal says was
 * revealed (as introduced or by the presenters). `allSecret`: only the rounds the presenters revealed.
 */
export function revealedRounds(plan: Pick<GamePlan, 'prizeReveal'>, revealed: readonly PrizesRevealed[]): number[] {
  const perRound = plan.prizeReveal === 'perRound';
  const rounds = new Set<number>(perRound ? [1] : []);
  for (const r of revealed) if (perRound || r.by === 'presenters') rounds.add(r.round);
  return [...rounds].sort((a, b) => a - b);
}

/** A round as phones see it: its skeleton always (to show it locked, game-style), its bundles once revealed. */
export interface PublicRoundPlan {
  number: number;
  kind: RoundKind;
  /** The card type it plays (printed on the cards, so never secret). Optional in the type only: publicPlan always
   * sets it, and an older cloud's snapshot lacks it (then it is defaultCardType(kind)). */
  cardType?: string;
  revealed: boolean;
  line?: PrizeBundle;
  bingo?: PrizeBundle;
}

/** The plan as phones and public screens see it: no locked round's prizes (not even how many), no cheat sheet. */
export interface PublicPlan {
  v: typeof PLAN_VERSION;
  edition: string;
  title: string;
  prizeReveal: PrizeReveal;
  rounds: PublicRoundPlan[];
  sponsors: Sponsor[];
  cardTypes: CardType[];
  schedule: SchedulePlan;
}

/** The public plan: `revealed` are the rounds whose prizes may be seen (revealedRounds). */
export function publicPlan(plan: GamePlan, revealed: readonly number[]): PublicPlan {
  const open = new Set(revealed);
  return {
    v: plan.v, edition: plan.edition, title: plan.title, prizeReveal: plan.prizeReveal,
    rounds: plan.rounds.map((r) => (open.has(r.number)
      ? { number: r.number, kind: r.kind, cardType: roundCardType(r), revealed: true, line: r.line, bingo: r.bingo }
      : { number: r.number, kind: r.kind, cardType: roundCardType(r), revealed: false })),
    sponsors: plan.sponsors, cardTypes: plan.cardTypes, schedule: plan.schedule,
  };
}

/** The sponsor of a prize, if any. */
export function sponsorOf(plan: GamePlan, prize: Prize | null): Sponsor | null {
  if (!prize?.sponsorId) return null;
  return plan.sponsors.find((s) => s.id === prize.sponsorId) ?? null;
}

/** The card type a planned round plays: its own, else its kind's default (a plan from before card types per round). */
export function roundCardType(round: Pick<RoundPlan, 'kind' | 'cardType'>): string {
  return round.cardType ?? defaultCardType(round.kind);
}

/** The plan of round `number`, if planned. */
export function roundPlan(plan: GamePlan | null, number: number): RoundPlan | null {
  return plan?.rounds.find((r) => r.number === number) ?? null;
}
