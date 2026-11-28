// The menu's «Anunciar Línia i Quina als mòbils» switch (D289): with it on, a phone shows «LÍNIA!» or «QUINA!» over a
// card that completes one; off, the card is only marked. The Game's setting `game.announceWins`, the same on every
// console, sent with `setGame { announceWins }` and journaled. Pure.
import type { GameSettings } from '@quina/protocol';

/** The default until the engine has said (an older journal lacks it): announced. */
export const ANNOUNCE_WINS_DEFAULT = true;

/** On or off now: `game.announceWins`, absent means on. */
export function announceWinsNow(game: Pick<GameSettings, 'announceWins'> | null | undefined): boolean {
  return game?.announceWins ?? ANNOUNCE_WINS_DEFAULT;
}

/** The `setGame` arguments that switch it to `on`. */
export function announceWinsArgs(on: boolean): { announceWins: boolean } {
  return { announceWins: on };
}
