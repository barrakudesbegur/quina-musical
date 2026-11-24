// The printed card types come from the cards (apps/cards → card-types.json, next to cards.json): their name,
// pastel colour, printed title and price. Each planned round names the one it plays (`RoundPlan.cardType`), so
// screens take names and colours from here and which rounds a type plays from the plan's rounds. Pure.
import { isCardTypeId, roundCardType, type RoundKind } from '@quina/protocol';
import { CA } from '../i18n/ca.ts';

export interface PrintedCardType {
  /** Its id ('normal', 'especial'…), as each card's `type` in cards.json. */
  type: string;
  name: string;
  color: string;
  title: string;
  priceCents: number | null;
}

/** A type as a screen names it: card-types.json's name and colour, or a plain stand-in when it isn't listed. */
export interface CardTypeLabel {
  type: string;
  /** "Cartró normal"; "Cartró <id>" for a type nobody listed. */
  name: string;
  color: string;
  priceCents: number | null;
  /** card-types.json (or the fallback list) has it. */
  known: boolean;
}

const COLOR_RE = /^#[0-9a-f]{6}$/i;
/** The colour of a type no list has: a neutral paper tone, so it never passes for a real card's pastel. */
export const UNKNOWN_CARD_TYPE_COLOR = '#e8e4da';

/** The card types in card-types.json, or null when the file isn't what apps/cards writes. */
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
    out.push({ type: c.type, name: c.name.trim(), color: c.color.toLowerCase(), title: typeof c.title === 'string' ? c.title : '', priceCents: price });
  }
  return out;
}

/**
 * The plan's old copy of the card types (`GamePlan.cardTypes`, deprecated), as printed types. Only a fallback for
 * when card-types.json didn't load; plan version 3 drops the field, and then this and its one caller go.
 */
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
    ? { type, name: known.name, color: known.color, priceCents: known.priceCents, known: true }
    : { type, name: CA.cardType(type), color: UNKNOWN_CARD_TYPE_COLOR, priceCents: null, known: false };
}

/** Where a card type plays tonight. */
export interface CardTypeRounds {
  type: string;
  /** The regular rounds it plays, by number, in play order. */
  regularRounds: number[];
  /** It plays the Quina Especial. */
  special: boolean;
}

/** Each type the rounds play (in the order a round first plays it), with the rounds it plays. */
export function roundsByCardType(rounds: readonly { number: number; kind: RoundKind; cardType?: string }[]): CardTypeRounds[] {
  const out = new Map<string, CardTypeRounds>();
  for (const r of [...rounds].sort((a, b) => a.number - b.number)) {
    const type = roundCardType(r);
    const entry = out.get(type) ?? { type, regularRounds: [], special: false };
    if (r.kind === 'special') entry.special = true;
    else entry.regularRounds.push(r.number);
    out.set(type, entry);
  }
  return [...out.values()];
}
