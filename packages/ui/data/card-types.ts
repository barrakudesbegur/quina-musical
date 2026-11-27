// The printed card types come from the cards (apps/cards → card-types.json, next to cards.json): their name,
// pastel colour, printed title, price and sides. Each planned round names the one it plays (`RoundPlan.cardType`) and
// its side (`RoundPlan.side`), so screens take names and colours from here and which rounds a type plays from the
// plan's rounds. Pure.
import {
  isCardTypeId, isPoolId, isSide, roundCardPrice, roundCardType,
  type CardPriceRule, type CardTypeSide, type GamePlan, type RoundKind,
} from '@quina/protocol';
import { CA } from '../i18n/ca.ts';

/**
 * One printed side of a type, as apps/cards writes it: its number, its pool, and `checkLabel`, the side's whole name on
 * the screens (D266: «Normal 1–5», «Normal 6–10», «Desgraciat», «Especial», the words printed on it; typeSideLabel).
 * `label` ("1–5", "Desgraciat") and `heading` («QUINES 1–5») come along; no screen reads them.
 */
export interface PrintedCardTypeSide extends CardTypeSide {
  checkLabel: string;
}

export interface PrintedCardType {
  /** Its id ('normal', 'especial'…), as each card's `type` in cards.json. */
  type: string;
  /** "Cartró normal". */
  name: string;
  /** "Normal": the type alone, without a side (a wrong type's verdict and its big name in the console's Check). */
  shortName: string;
  color: string;
  title: string;
  priceCents: number | null;
  /** How the price counts (U5): 'perRegularRound' (a normal card: × the regular rounds still to play) or 'fixed' (the
   * especial card). card-types.json may leave it out: then 'perRegularRound', as @quina/protocol roundCardPrice reads it. */
  priceRule?: CardPriceRule;
  /** Its printed sides (D178, D226), each with its name (D266): the normal card's 1 (pool 1, «Normal 1–5») and 2 (pool
   * 2, «Normal 6–10»), the especial card's 1 (pool 1, «Desgraciat») and 2 (pool 2, «Especial»). */
  sides: readonly PrintedCardTypeSide[];
}

/** A type as a screen names it: card-types.json's name and colour, or a plain stand-in when it isn't listed. */
export interface CardTypeLabel {
  type: string;
  /** "Cartró normal"; "Cartró <id>" for a type nobody listed. */
  name: string;
  /** "Normal"; "<Id>" for a type nobody listed. */
  shortName: string;
  color: string;
  priceCents: number | null;
  /** card-types.json (or the fallback list) has it. */
  known: boolean;
}

const COLOR_RE = /^#[0-9a-f]{6}$/i;
/** The colour of a type no list has: a neutral paper tone, so it never passes for a real card's pastel. */
export const UNKNOWN_CARD_TYPE_COLOR = '#e8e4da';

/** A short name from a full one, for a type nobody lists: "Cartró plata" → "Plata". */
export function shortNameOf(name: string): string {
  const short = name.trim().replace(/^cartr[óo]\s+/i, '');
  return short ? short[0].toLocaleUpperCase('ca') + short.slice(1) : name.trim();
}

const isText = (value: unknown): value is string => typeof value === 'string' && value.trim() !== '';
const optionalText = (value: unknown): boolean => value === undefined || typeof value === 'string';

/** A type's sides from card-types.json, each with its Check label (D266); anything off, or a side without one, is null. */
function readSides(raw: unknown): PrintedCardTypeSide[] | null {
  if (!Array.isArray(raw) || !raw.length) return null;
  const sides: PrintedCardTypeSide[] = [];
  for (const s of raw) {
    if (!s || typeof s !== 'object') return null;
    const { side, pool, label, checkLabel, heading } = s as Record<string, unknown>;
    if (!isSide(side) || !isPoolId(pool) || sides.some((o) => o.side === side) || !isText(checkLabel) || !optionalText(label) || !optionalText(heading)) return null;
    sides.push({ side, pool, checkLabel: checkLabel.trim(), ...(typeof label === 'string' ? { label } : {}), ...(typeof heading === 'string' ? { heading } : {}) });
  }
  return sides;
}

/**
 * The card types in card-types.json, or null when the file isn't what apps/cards writes: every type with its short name
 * and its sides, every side with its Check label (D266; a file from before them reads as no types).
 */
export function readPrintedCardTypes(json: unknown): PrintedCardType[] | null {
  if (!Array.isArray(json) || json.length === 0) return null;
  const out: PrintedCardType[] = [];
  for (const raw of json) {
    if (!raw || typeof raw !== 'object') return null;
    const c = raw as Record<string, unknown>;
    if (!isCardTypeId(c.type)) return null;
    if (out.some((o) => o.type === c.type)) return null;
    if (typeof c.name !== 'string' || !c.name.trim() || typeof c.color !== 'string' || !COLOR_RE.test(c.color)) return null;
    const price = c.priceCents ?? null;
    if (price !== null && (typeof price !== 'number' || !Number.isInteger(price) || price < 0)) return null;
    const rule = c.priceRule ?? 'perRegularRound';
    if (rule !== 'perRegularRound' && rule !== 'fixed') return null;
    const sides = readSides(c.sides);
    if (!sides) return null;
    if (!isText(c.shortName)) return null;
    out.push({ type: c.type, name: c.name.trim(), shortName: c.shortName.trim(), color: c.color.toLowerCase(), title: typeof c.title === 'string' ? c.title : '', priceCents: price, priceRule: rule, sides });
  }
  return out;
}

/**
 * The card types a screen names things with: card-types.json's when it loaded, else none (every type is then named
 * by cardTypeLabel's stand-in, "Cartró <id>"). The plan carries no copy any more (plan version 3).
 */
export function knownCardTypes(printed: readonly PrintedCardType[] | null | undefined): readonly PrintedCardType[] {
  return printed ?? [];
}

/** How a screen names a type: its listed name and colour, or "Cartró <id>" in a neutral colour. */
export function cardTypeLabel(type: string, types: readonly PrintedCardType[]): CardTypeLabel {
  const known = types.find((t) => t.type === type);
  return known
    ? { type, name: known.name, shortName: known.shortName, color: known.color, priceCents: known.priceCents, known: true }
    : { type, name: CA.cardType(type), shortName: shortNameOf(type), color: UNKNOWN_CARD_TYPE_COLOR, priceCents: null, known: false };
}

/**
 * How every screen names a card type's side (D163, D266): that side's `checkLabel`, the words printed on it, «Normal
 * 1–5», «Normal 6–10», «Desgraciat», «Especial». The Check's chip and badge, the claim's peek, the finale's pad and
 * Admin's side picker all take it from here. A type nobody lists, or a side its type doesn't print, is named by the type
 * alone (its short name, or the stand-in's).
 */
export function typeSideLabel(type: string, side: number, types: readonly PrintedCardType[]): string {
  const known = types.find((t) => t.type === type);
  if (!known) return cardTypeLabel(type, types).shortName;
  return known.sides.find((s) => s.side === side)?.checkLabel ?? known.shortName;
}

/** Where a card type plays tonight. */
export interface CardTypeRounds {
  type: string;
  /** The regular rounds it plays, by their Quina number ("Quina 4": plan.ts quinaNumber), in play order (not the Quina
   * Especial or the Quina del Desgraciat, which have none). */
  regularRounds: number[];
  /** It plays the Quina Especial. */
  special: boolean;
  /** It plays the Quina del Desgraciat (named, not numbered, like the Especial). */
  desgraciat: boolean;
}

/** Each type the rounds play (in the order a round first plays it), with the rounds it plays. */
export function roundsByCardType(rounds: readonly { number: number; kind: RoundKind; cardType?: string }[]): CardTypeRounds[] {
  const out = new Map<string, CardTypeRounds>();
  // In play order, each normal round's Quina number is the count of normal rounds so far (plan.ts quinaNumber).
  let quina = 0;
  for (const r of [...rounds].sort((a, b) => a.number - b.number)) {
    const type = roundCardType(r);
    const entry = out.get(type) ?? { type, regularRounds: [], special: false, desgraciat: false };
    if (r.kind === 'special') entry.special = true;
    else if (r.kind === 'desgraciat') entry.desgraciat = true;
    else entry.regularRounds.push(++quina);
    out.set(type, entry);
  }
  return [...out.values()];
}

/** The card to buy before a round, and what it costs then (the user's U5: the Interval screen, and before the start for
 * round 1). */
export interface ComingRoundPrice {
  round: number;
  /** The card type that round plays. */
  type: string;
  /** Its name and colour, as every screen shows it. */
  label: CardTypeLabel;
  /** What a card bought now costs, in cents (@quina/protocol roundCardPrice: a normal card × the regular rounds still to
   * play, the especial card its fixed price). */
  cents: number;
}

/** The price to show before round `roundNumber`, or null when the round isn't planned or its type has no price set. */
export function comingRoundPrice(plan: Pick<GamePlan, 'rounds'> | null, roundNumber: number, printed: readonly PrintedCardType[]): ComingRoundPrice | null {
  const round = plan?.rounds.find((r) => r.number === roundNumber);
  if (!plan || !round) return null;
  const type = roundCardType(round);
  const known = printed.find((t) => t.type === type);
  if (!known) return null;
  const cents = roundCardPrice(plan, roundNumber, { priceCents: known.priceCents, priceRule: known.priceRule });
  return cents === null ? null : { round: roundNumber, type, label: cardTypeLabel(type, printed), cents };
}
