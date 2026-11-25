// Checks on the card types before anything is written: card-types.json is the formal list of printed types, and
// every screen (and the Game plan's rounds, which each name the type they play) relies on it. A bad id or a card
// of an unlisted type would only show up on the night, so the generator refuses them here.

/**
 * A card type's id: lowercase letters and digits, starting with a letter, at most 24 long (a resume code carries
 * it, so no dashes). A copy of packages/protocol/vocabulary.ts `CARD_TYPE_ID_RE` (`isCardTypeId`): this package
 * builds on its own (CommonJS, rootDir src) and can't import it. Keep the two the same.
 */
export const CARD_TYPE_ID_RE = /^[a-z][a-z0-9]{0,23}$/;
const COLOR_RE = /^#[0-9a-f]{6}$/i;

export interface CardTypeSpec {
  type: string;
  name: string;
  color: string;
  title: string;
  priceCents: number | null;
  /** How the price counts (the user's U5, shown on the projector before each round): 'perRegularRound', the price ×
   * the regular rounds still to play (a normal card); 'fixed', the price itself (the especial card). Optional:
   * 'perRegularRound' when absent. The same values as @quina/protocol's CardPriceRule. */
  priceRule?: 'perRegularRound' | 'fixed';
}

/** Every problem with the card types (empty when they're fine): ids, duplicates, names, colours, prices. */
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
  }
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
