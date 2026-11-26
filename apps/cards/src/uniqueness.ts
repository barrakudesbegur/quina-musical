// No two printed cards and no two printed lines are the same (requirements › songs-and-cards, docs/event.md): every
// new card is checked against every card and every line drawn so far, across all card types. Since cards have sides
// (D178), that holds per pool: a side is checked against every side drawn from the same pool in the whole print run
// (`DrawnByPool`), since a round plays one pool and only those sides ever meet. Self-contained (no imports), so the
// tests run it as it is.

/** A card (one of its sides) as far as uniqueness goes: its lines of songs, by id. */
export interface LinedCard {
  id: number;
  lines: readonly (readonly { id: number }[])[];
}

/** A line's identity: its songs, whatever their order on the card. */
export const lineKey = (line: readonly { id: number }[]): string =>
  line
    .map((s) => s.id)
    .sort((a, b) => a - b)
    .join(',');

/** A card's identity: all its songs, whatever their lines. */
export const cardKey = (card: Pick<LinedCard, 'lines'>): string =>
  card.lines
    .flat()
    .map((s) => s.id)
    .sort((a, b) => a - b)
    .join(',');

/** The cards and lines drawn so far: where each line first appeared ("#123 line 2"). */
export class Drawn {
  private readonly cards = new Set<string>();
  private readonly lines = new Map<string, string>();

  /** The card repeats no card and no line drawn so far, and no line of its own. */
  fits(card: Pick<LinedCard, 'lines'>): boolean {
    if (this.cards.has(cardKey(card))) return false;
    const own = card.lines.map(lineKey);
    return new Set(own).size === own.length && own.every((k) => !this.lines.has(k));
  }

  add(card: LinedCard): void {
    this.cards.add(cardKey(card));
    card.lines.forEach((line, i) => {
      const k = lineKey(line);
      if (!this.lines.has(k)) this.lines.set(k, `#${card.id} line ${i + 1}`);
    });
  }
}

/** How many draws a card gets before the run fails. */
export const DRAW_ATTEMPTS = 200;

/**
 * Card `id`: the first of `make(0)`, `make(1)`… that fits what's drawn so far, added to it. It throws when none of
 * `attempts` fits: the pool is too small for that many cards without a repeated line, so nothing must be printed.
 */
export function drawUnique<C extends LinedCard>(make: (attempt: number) => C, drawn: Drawn, attempts = DRAW_ATTEMPTS): C {
  for (let i = 0; i < attempts; i++) {
    const card = make(i);
    if (!drawn.fits(card)) continue;
    drawn.add(card);
    return card;
  }
  const id = make(0).id;
  throw new Error(`card #${id}: ${attempts} draws all repeat a card or a line already drawn. Use more songs or fewer cards.`);
}

/** One record of what's drawn for each pool, for the whole print run. */
export class DrawnByPool {
  private readonly pools = new Map<string, Drawn>();

  /** The record of one pool's sides. */
  of(pool: string): Drawn {
    let drawn = this.pools.get(pool);
    if (!drawn) this.pools.set(pool, (drawn = new Drawn()));
    return drawn;
  }

  /** drawUnique against the pool's record. */
  draw<C extends LinedCard>(pool: string, make: (attempt: number) => C, attempts = DRAW_ATTEMPTS): C {
    return drawUnique(make, this.of(pool), attempts);
  }
}

/** Every line printed more than once: its songs, and the cards and lines that repeat it. Empty when all are unique. */
export function repeatedLines(cards: readonly LinedCard[]): { songs: string; first: string; repeat: string }[] {
  const seen = new Map<string, string>();
  const out: { songs: string; first: string; repeat: string }[] = [];
  for (const card of cards)
    card.lines.forEach((line, i) => {
      const k = lineKey(line);
      const where = `#${card.id} line ${i + 1}`;
      const first = seen.get(k);
      if (first) out.push({ songs: k, first, repeat: where });
      else seen.set(k, where);
    });
  return out;
}

/** Every card printed more than once (the same 12 songs), by id pairs. */
export function repeatedCards(cards: readonly LinedCard[]): [number, number][] {
  const seen = new Map<string, number>();
  const out: [number, number][] = [];
  for (const card of cards) {
    const k = cardKey(card);
    const first = seen.get(k);
    if (first !== undefined) out.push([first, card.id]);
    else seen.set(k, card.id);
  }
  return out;
}
