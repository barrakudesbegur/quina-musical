// The Game plan: the setup that Admin edits and the cloud stores. The laptop, projector, console and phones
// all read it:
// - the edition's name on every screen ("Quina Quina 3");
// - the rounds, each normal, special or Desgraciat, with its Line's and Quina's prize bundles (headline prizes
//   first; the Desgraciat round has no Line, and its `bingo` bundle is the last card standing's prize);
// - when the prizes are revealed (round by round as the presenters announce them, or all kept secret);
// - each round's printed card type (its name, colour and price are apps/cards' card-types.json);
// - the sponsors;
// - the schedule, with the planned Throws;
// - the volumes a fresh Game starts with (D139; the laptop only, never phones);
// - the cheat sheet's rules (presenters only).
// Phones see it through publicPlan: locked rounds keep only their skeleton, and the cheat sheet stays out.
// Admin's bulk JSON import and export use exactly this shape, so an AI agent can fill it from the
// organizers' spreadsheet.
//
// Part of @quina/protocol (written by the UI session). It must not import engine code.
import {
  DEFAULT_SIDE, SIDE_MAX, VOLUME_MAX, cardTypeSides, defaultCardType, isCardTypeId, isRoundKind, isSide, isVolumeKey, sidePool,
  type CardTypeSides, type RoundKind, type VolumeKey,
} from './vocabulary.ts';

/**
 * Version 3: each round names the printed card type it plays (`RoundPlan.cardType`); the card types' names, colours
 * and prices are apps/cards' card-types.json. checkGamePlan still reads version 2 (its `cardTypes` list only says
 * which round kinds took each type) and version 1 (one prize per Line or Quina).
 */
export const PLAN_VERSION = 3;

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
   * The printed card type this round plays (a card-types.json id): only cards of this type count in it. A plan
   * file may leave it out: checkGamePlan fills in defaultCardType(kind).
   */
  cardType: string;
  /**
   * The side of the card this round plays (D178, D193: the normal card's side 1 plays Pool 1 in Quines 1–5, side 2 Pool 2 in Quines 6–10; D226: the
   * especial card's side 1 plays Pool 1 in the Desgraciat, side 2 Pool 2 in the Especial): only its lines count, and its pool (card-types.json) is
   * the Queue's songs. Absent means 1 (roundSide).
   */
  side?: number;
  line: PrizeBundle;
  /** The full-card prizes ("premis de quina"); in the Desgraciat round, the last card standing's (its `line` is empty). */
  bingo: PrizeBundle;
}

/** When phones see each round's prizes: round by round as announced (round 1 from the start), or all kept secret
 * until the presenters reveal a round. */
export type PrizeReveal = 'perRound' | 'allSecret';

export interface SchedulePlan {
  /** When the doors open and the cards go on sale (epoch ms), Horari's first row (D150). Absent when not set (a plan
   * without it reads back unchanged); never after `startAtMs`. */
  doorsAtMs?: number;
  /** When the first round should start (epoch ms), or null when not set. */
  startAtMs: number | null;
  /** Planned length of a round, in minutes. */
  roundMinutes: number;
  /** Planned length of an Interval, in minutes (the countdown guide). */
  intervalMinutes: number;
  /** The planned Throws ("parón") after some rounds: each sets that break's length in place of `intervalMinutes`, and the
   * Schedule and the countdown follow it. Absent when there are none (a plan without Throws reads back unchanged); read
   * it as `throws ?? []`. */
  throws?: PlannedThrow[];
}

/**
 * A planned Throw after round `afterRound` (never the last): the break after that round lasts `minutes` and has the throw
 * in it ("Descans + llançament (10 min)"): it is that Interval's length, not time on top of it.
 */
export interface PlannedThrow {
  afterRound: number;
  minutes: number;
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
  schedule: SchedulePlan;
  /**
   * The volume sliders a fresh Game starts with (D139, percent 0–VOLUME_MAX, vocabulary.ts VOLUME_KEYS): the edition file
   * holds them, and the cloud folds a Game's slider moves back in. The engine reads them only while the Game has set
   * no volume of its own, never mid-Game. Laptop only: publicPlan leaves them out. Absent: every slider at its default.
   */
  volumes?: Partial<Record<VolumeKey, number>>;
  cheatSheet: CheatSheet;
}

export type PlanCheck = { ok: true; plan: GamePlan } | { ok: false; errors: string[] };

const LIMITS = { rounds: 20, sponsors: 200, text: 200, detail: 1000, id: 64, rules: 30, bundle: 40 } as const;
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
  // Version 1 (one prize per Line or Quina, no card types, no reveal setting) is read as the current one: each prize
  // becomes a bundle of one headline prize. Version 2 had a `cardTypes` list: it only tells which type each round
  // kind took, and is dropped.
  const v1 = json.v === 1;
  const v2 = json.v === 2;
  keys(json, 'plan', v1
    ? ['v', 'edition', 'title', 'rounds', 'sponsors', 'schedule', 'cheatSheet']
    : ['v', 'edition', 'title', 'prizeReveal', 'rounds', 'sponsors', ...(v2 ? ['cardTypes'] : []), 'schedule', 'volumes', 'cheatSheet']);
  if (json.v !== PLAN_VERSION && !v1 && !v2) err('plan.v', `must be ${PLAN_VERSION}`);
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
    keys(r, path, v1 ? ['number', 'kind', 'line', 'bingo'] : ['number', 'kind', 'cardType', 'side', 'line', 'bingo']);
    const number = num(r, 'number', path, 1, LIMITS.rounds, { integer: true });
    if (number !== null && number !== i + 1) err(`${path}.number`, `must be ${i + 1} (rounds are numbered 1, 2, 3… in order)`);
    const kind = r.kind;
    if (!isRoundKind(kind)) err(`${path}.kind`, 'must be "normal", "special" or "desgraciat"');
    if (r.cardType !== undefined && !isCardTypeId(r.cardType)) err(`${path}.cardType`, 'must be a card type id from card-types.json, such as "normal" or "especial"');
    if (r.side !== undefined && !isSide(r.side)) err(`${path}.side`, `must be a card side, 1 to ${SIDE_MAX}`);
    rounds.push({
      number: number ?? i + 1,
      kind: isRoundKind(kind) ? kind : 'normal',
      // Filled below when the plan doesn't name one (from a version 2 plan's card types, else the kind's default).
      cardType: isCardTypeId(r.cardType) ? r.cardType : '',
      ...(isSide(r.side) ? { side: r.side } : {}),
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

  // A round that doesn't name its card type plays the first type a version 2 plan's `cardTypes` gave its kind, else
  // its kind's default.
  const oldTypes = v2 && Array.isArray(json.cardTypes) ? json.cardTypes.filter(isRec) : [];
  const oldTypeFor = (kind: RoundKind): string | undefined => {
    const t = oldTypes.find((c) => Array.isArray(c.rounds) && c.rounds.includes(kind) && isCardTypeId(c.type));
    return typeof t?.type === 'string' ? t.type : undefined;
  };
  for (const r of rounds) r.cardType ||= oldTypeFor(r.kind) ?? defaultCardType(r.kind);

  let schedule: SchedulePlan = { startAtMs: null, roundMinutes: 25, intervalMinutes: 3 };
  const sch = json.schedule;
  if (!isRec(sch)) err('plan.schedule', 'must be an object');
  else {
    keys(sch, 'plan.schedule', ['doorsAtMs', 'startAtMs', 'roundMinutes', 'intervalMinutes', 'throws']);
    const throws: PlannedThrow[] = [];
    if (sch.throws !== undefined) {
      list(sch, 'throws', 'plan.schedule', LIMITS.rounds).forEach((b, i) => {
        const path = `plan.schedule.throws[${i}]`;
        if (!isRec(b)) return err(path, 'must be an object');
        keys(b, path, ['afterRound', 'minutes']);
        const afterRound = num(b, 'afterRound', path, 1, LIMITS.rounds, { integer: true });
        const minutes = num(b, 'minutes', path, 1, 60);
        if (afterRound !== null && rounds.length && afterRound >= rounds.length) err(`${path}.afterRound`, `must be a round before the last (1–${rounds.length - 1})`);
        if (afterRound !== null && throws.some((o) => o.afterRound === afterRound)) err(`${path}.afterRound`, `repeats round ${afterRound}`);
        if (afterRound !== null && minutes !== null) throws.push({ afterRound, minutes });
      });
    }
    schedule = {
      ...(sch.doorsAtMs !== undefined ? { doorsAtMs: num(sch, 'doorsAtMs', 'plan.schedule', 0, 8.64e15, { integer: true }) ?? 0 } : {}),
      startAtMs: num(sch, 'startAtMs', 'plan.schedule', 0, 8.64e15, { nullable: true, integer: true }),
      roundMinutes: num(sch, 'roundMinutes', 'plan.schedule', 1, 240) ?? schedule.roundMinutes,
      intervalMinutes: num(sch, 'intervalMinutes', 'plan.schedule', 0, 120) ?? schedule.intervalMinutes,
      ...(throws.length ? { throws: throws.sort((a, b) => a.afterRound - b.afterRound) } : {}),
    };
    if (schedule.doorsAtMs != null && schedule.startAtMs != null && schedule.doorsAtMs > schedule.startAtMs) err('plan.schedule.doorsAtMs', 'must not be after startAtMs (the doors open before the first round)');
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

  let volumes: Partial<Record<VolumeKey, number>> | undefined;
  if (json.volumes !== undefined) {
    const vol = json.volumes;
    if (!isRec(vol)) err('plan.volumes', 'must be an object');
    else {
      volumes = {};
      for (const [key, value] of Object.entries(vol)) {
        if (!isVolumeKey(key)) err('plan.volumes', `unknown key "${key}"`);
        else if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > VOLUME_MAX[key]) err(`plan.volumes.${key}`, `must be a percent, 0–${VOLUME_MAX[key]}`);
        else volumes[key] = value;
      }
    }
  }

  if (errors.length) return { ok: false, errors };
  return { ok: true, plan: { v: PLAN_VERSION, edition: edition ?? '', title: title ?? '', prizeReveal, rounds, sponsors, schedule, ...(volumes ? { volumes } : {}), cheatSheet } };
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
  /** The card type it plays (printed on the cards, so never secret). */
  cardType: string;
  /** The card's side it plays (D178); absent means 1 (roundSide). */
  side?: number;
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
  schedule: SchedulePlan;
}

/** The public plan: `revealed` are the rounds whose prizes may be seen (revealedRounds). */
export function publicPlan(plan: GamePlan, revealed: readonly number[]): PublicPlan {
  const open = new Set(revealed);
  return {
    v: plan.v, edition: plan.edition, title: plan.title, prizeReveal: plan.prizeReveal,
    rounds: plan.rounds.map((r) => (open.has(r.number)
      ? { number: r.number, kind: r.kind, cardType: roundCardType(r), ...(r.side ? { side: r.side } : {}), revealed: true, line: r.line, bingo: r.bingo }
      : { number: r.number, kind: r.kind, cardType: roundCardType(r), ...(r.side ? { side: r.side } : {}), revealed: false })),
    sponsors: plan.sponsors, schedule: plan.schedule,
  };
}

/** The sponsor of a prize, if any. */
export function sponsorOf(plan: GamePlan, prize: Prize | null): Sponsor | null {
  if (!prize?.sponsorId) return null;
  return plan.sponsors.find((s) => s.id === prize.sponsorId) ?? null;
}

/** The card type a planned round plays: its own, else its kind's default (a round from before card types per round). */
export function roundCardType(round: { kind: RoundKind; cardType?: string }): string {
  return round.cardType || defaultCardType(round.kind);
}

/** The card side a planned round plays: its own, else 1. */
export function roundSide(round: { side?: number }): number {
  return round.side ?? DEFAULT_SIDE;
}

/** How a printed card type is priced (apps/cards card-types.json `priceRule`): by the regular rounds it still plays
 * (a normal card), or one fixed price (the especial card). */
export type CardPriceRule = 'perRegularRound' | 'fixed';

/** A card type's price as card-types.json gives it. */
export interface CardTypePrice {
  priceCents: number | null;
  /** Default: 'perRegularRound'. */
  priceRule?: CardPriceRule;
}

/**
 * What a card costs before round `roundNumber` (the projector's Interval screen, and before the start for round 1;
 * docs/event.md U5), in cents: 'perRegularRound' is the price × the plan's normal rounds from that one on (the coming
 * one included; the Desgraciat and the Especial never count), 'fixed' the price itself. null without a price.
 * `type` is the card type the coming round plays (its `cardType` in card-types.json).
 */
export function roundCardPrice(plan: Pick<GamePlan, 'rounds'>, roundNumber: number, type: CardTypePrice): number | null {
  if (type.priceCents == null) return null;
  if (type.priceRule === 'fixed') return type.priceCents;
  const regular = plan.rounds.filter((r) => r.kind === 'normal' && r.number >= roundNumber).length;
  return type.priceCents * regular;
}

/** A plan's side problems against the printed card types (Admin and the laptop's preflight show them; none blocks). */
export interface SideWarning {
  path: string;
  message: string;
}

/**
 * What doesn't fit between the plan's sides and card-types.json (D178): a round on a side its card type doesn't have, a
 * side no round plays, or a pool whose songs aren't there. `poolSongs`, when given, counts each pool's songs (the
 * repertoire's); a pool with none can't be shuffled.
 */
export function sideWarnings(plan: Pick<GamePlan, 'rounds'>, cardTypes: readonly CardTypeSides[], poolSongs?: Readonly<Record<string, number>>): SideWarning[] {
  const out: SideWarning[] = [];
  plan.rounds.forEach((r, i) => {
    const type = roundCardType(r);
    const side = roundSide(r);
    const pool = sidePool(cardTypes, type, side);
    if (pool == null) out.push({ path: `plan.rounds[${i}].side`, message: `card type "${type}" has no side ${side} in card-types.json` });
    else if (poolSongs && !poolSongs[pool]) out.push({ path: `plan.rounds[${i}].side`, message: `side ${side} plays pool ${pool}, which has no songs` });
  });
  for (const t of cardTypes) {
    if (!plan.rounds.some((r) => roundCardType(r) === t.type)) continue;
    for (const s of cardTypeSides(t)) {
      if (!plan.rounds.some((r) => roundCardType(r) === t.type && roundSide(r) === s.side)) {
        out.push({ path: 'plan.rounds', message: `no round plays side ${s.side} of card type "${t.type}"` });
      }
    }
  }
  return out;
}

/** The plan of round `number`, if planned. */
export function roundPlan(plan: GamePlan | null, number: number): RoundPlan | null {
  return plan?.rounds.find((r) => r.number === number) ?? null;
}
