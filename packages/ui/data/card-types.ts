// The card types come from the printed cards (apps/cards → card-types.json, next to cards.json): their name,
// pastel colour, printed title and price. The plan carries a copy (`plan.cardTypes`) because that's what reaches
// the projector and the phones; Admin refreshes the copy from the cards and never edits it. Pure.
import type { CardType, GamePlan, RoundKind } from '@quina/protocol';

export interface PrintedCardType {
  type: 'normal' | 'especial';
  name: string;
  color: string;
  title: string;
  priceCents: number | null;
}

const COLOR_RE = /^#[0-9a-f]{6}$/i;
/** Which round kinds take a type when the plan doesn't say yet (the engine's rule). */
const DEFAULT_ROUNDS: Record<PrintedCardType['type'], RoundKind[]> = { normal: ['normal'], especial: ['special'] };

/** The card types in card-types.json, or null when the file isn't what apps/cards writes. */
export function readPrintedCardTypes(json: unknown): PrintedCardType[] | null {
  if (!Array.isArray(json) || json.length === 0) return null;
  const out: PrintedCardType[] = [];
  for (const raw of json) {
    if (!raw || typeof raw !== 'object') return null;
    const c = raw as Record<string, unknown>;
    if (c.type !== 'normal' && c.type !== 'especial') return null;
    if (out.some((o) => o.type === c.type)) return null;
    if (typeof c.name !== 'string' || !c.name.trim() || typeof c.color !== 'string' || !COLOR_RE.test(c.color)) return null;
    const price = c.priceCents ?? null;
    if (price !== null && (typeof price !== 'number' || !Number.isInteger(price) || price < 0)) return null;
    out.push({ type: c.type, name: c.name.trim(), color: c.color.toLowerCase(), title: typeof c.title === 'string' ? c.title : '', priceCents: price });
  }
  return out;
}

/**
 * The plan with its card types copied from the printed ones, keeping which round kinds take each type (that
 * stays the plan's). Returns the same plan object when nothing changes, so callers can skip a save.
 */
export function withPrintedCardTypes(plan: GamePlan, printed: readonly PrintedCardType[]): GamePlan {
  const cardTypes: CardType[] = printed.map((p) => ({
    type: p.type,
    name: p.name,
    color: p.color,
    priceCents: p.priceCents,
    rounds: [...(plan.cardTypes.find((c) => c.type === p.type)?.rounds ?? DEFAULT_ROUNDS[p.type])],
  }));
  return JSON.stringify(cardTypes) === JSON.stringify(plan.cardTypes) ? plan : { ...plan, cardTypes };
}
