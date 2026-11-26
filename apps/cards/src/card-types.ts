// Checks on the card types before anything is written: card-types.json is the formal list of printed types, and
// every screen (and the Game plan's rounds, which each name the type they play) relies on it. A bad id, a bad side or
// a card of an unlisted type would only show up on the night, so the generator refuses them here.

/**
 * A card type's id: lowercase letters and digits, starting with a letter, at most 24 long (a resume code carries
 * it, so no dashes). A copy of packages/protocol/vocabulary.ts `CARD_TYPE_ID_RE` (`isCardTypeId`): this package
 * builds on its own (CommonJS, rootDir src) and can't import it. Keep the two the same.
 */
export const CARD_TYPE_ID_RE = /^[a-z][a-z0-9]{0,23}$/;
const COLOR_RE = /^#[0-9a-f]{6}$/i;
/** A pool's id ("1", "2"): a copy of the protocol's `POOL_ID_RE` (`isPoolId`), for the same reason. */
export const POOL_ID_RE = /^[a-z0-9]{1,8}$/;
/** The most sides a type may have: a copy of the protocol's `SIDE_MAX`. */
export const SIDE_MAX = 9;

/**
 * One printed side of a type (D101, D102, D178): its number (1, 2…), the pool its 12 songs are drawn from (sides.ts),
 * and its label ("1–5", the Quines it plays: D171, D193), which the Check shows after the type's short name (D163,
 * "Normal 1–5"). The same shape as the protocol's CardTypeSide.
 */
export interface CardTypeSideSpec {
  side: number;
  pool: string;
  label?: string;
}

export interface CardTypeSpec {
  type: string;
  /** Its full name ("Cartró normal"). */
  name: string;
  /** Its name in a label with its side (D163: "Normal 1–5", "Especial"). */
  shortName: string;
  color: string;
  title: string;
  priceCents: number | null;
  /** How the price counts (the user's U5, shown on the projector before each round): 'perRegularRound', the price ×
   * the regular rounds still to play (a normal card); 'fixed', the price itself (the especial card). Optional:
   * 'perRegularRound' when absent. The same values as @quina/protocol's CardPriceRule. */
  priceRule?: 'perRegularRound' | 'fixed';
  /** Its printed sides, numbered 1, 2… in order: the normal card has two, the especial card one. */
  sides: readonly CardTypeSideSpec[];
}

/** Every problem with the card types (empty when they're fine): ids, duplicates, names, colours, prices, sides. */
export function cardTypeProblems(types: readonly CardTypeSpec[]): string[] {
  const problems: string[] = [];
  if (!types.length) problems.push('there are no card types');
  const seen = new Set<string>();
  for (const t of types) {
    if (!CARD_TYPE_ID_RE.test(t.type)) problems.push(`card type "${t.type}": the id must be lowercase letters and digits, starting with a letter, at most 24`);
    if (seen.has(t.type)) problems.push(`card type "${t.type}" is listed twice`);
    seen.add(t.type);
    if (!t.name.trim()) problems.push(`card type "${t.type}" has no name`);
    if (!COLOR_RE.test(t.color)) problems.push(`card type "${t.type}": the colour must look like "#cfe8ff"`);
    if (t.priceCents !== null && (!Number.isInteger(t.priceCents) || t.priceCents < 0)) problems.push(`card type "${t.type}": the price must be whole cents, or null`);
    if (t.priceRule !== undefined && t.priceRule !== 'perRegularRound' && t.priceRule !== 'fixed') problems.push(`card type "${t.type}": the price rule must be "perRegularRound" or "fixed"`);
    if (!t.shortName.trim()) problems.push(`card type "${t.type}" has no short name`);
    problems.push(...sideProblems(t));
  }
  return problems;
}

/** A type's side problems: numbered 1, 2… in order (a round names one by its number), each on a valid pool, and
 * labelled when there are several (the Check's label tells them apart, D163). */
function sideProblems(t: CardTypeSpec): string[] {
  const where = `card type "${t.type}"`;
  if (!t.sides.length) return [`${where} has no sides`];
  if (t.sides.length > SIDE_MAX) return [`${where} has more than ${SIDE_MAX} sides`];
  const problems: string[] = [];
  t.sides.forEach((s, i) => {
    if (s.side !== i + 1) problems.push(`${where}: its sides must be numbered 1, 2… in order (side ${i + 1} is ${s.side})`);
    if (!POOL_ID_RE.test(s.pool)) problems.push(`${where}, side ${s.side}: the pool must be lowercase letters and digits, at most 8 ("1", "2")`);
    if (t.sides.length > 1 && !s.label?.trim()) problems.push(`${where}, side ${s.side}: a type with several sides needs a label on each ("1–5")`);
  });
  return problems;
}

/** Every card whose `type` isn't in the card types, as "card 12: type \"gold\"" (empty when all are listed). */
export function unlistedCardTypes(cards: readonly { id: number; type: string }[], types: readonly CardTypeSpec[]): string[] {
  const listed = new Set(types.map((t) => t.type));
  return cards.filter((c) => !listed.has(c.type)).map((c) => `card ${c.id}: type "${c.type}" is not in the card types`);
}

/** Throw with every problem at once, so they can all be fixed before generating again. */
export function assertCardTypes(cards: readonly { id: number; type: string }[], types: readonly CardTypeSpec[]): void {
  const problems = [...cardTypeProblems(types), ...unlistedCardTypes(cards, types)];
  if (problems.length) throw new Error(`The card types are not valid:\n- ${problems.join('\n- ')}`);
}
