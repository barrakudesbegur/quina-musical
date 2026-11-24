// The Desgraciat round, card by card (GLOSSARY: Desgraciat round, Fallen, Last standing). Pure functions,
// shared by anything that draws a player's card in that round. The rules:
// - Everyone stands. A card that plays the round stands until any of its 12 songs lands; then it has fallen
//   ("Assegut"), and the first such landing is the one that sank it.
// - Landings are the round's counted ones (undone ones removed), so Back stands a card up again.
// - Only the presenters call the last card standing: these functions never say a card won.
import type { PlayerCard } from './marks.ts';

/** A counted landing, as the public feed and the engine both carry it. */
export interface StandingLanding {
  /** Its Queue index: the landing order. */
  position: number;
  songId: number;
}

/** The landing that sank a card. */
export interface CardFall {
  songId: number;
  /** The landing's Queue position. */
  position: number;
}

/** The landing that sank `card`: the earliest counted landing of one of its songs. Null while it stands. */
export function cardFall(card: PlayerCard, landings: readonly StandingLanding[]): CardFall | null {
  const songs = new Set(card.lines.flat());
  let fall: CardFall | null = null;
  for (const l of landings) {
    if (songs.has(l.songId) && (!fall || l.position < fall.position)) fall = { songId: l.songId, position: l.position };
  }
  return fall;
}

/** The cards that fell at the landing in `position` (in the order given): those it sank, not those already seated. */
export function fellAt<C extends PlayerCard>(cards: readonly C[], landings: readonly StandingLanding[], position: number): C[] {
  return cards.filter((c) => cardFall(c, landings)?.position === position);
}

/** The cards still standing (in the order given). */
export function standingCards<C extends PlayerCard>(cards: readonly C[], landings: readonly StandingLanding[]): C[] {
  return cards.filter((c) => cardFall(c, landings) === null);
}
