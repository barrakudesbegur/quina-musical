// The automatic sounds (D237): the sounds the engine plays by itself, each switched on or off from the menu's «Sons
// automàtics» (`setAutoSound { key, on }`), in the protocol's order (AUTO_SOUNDS). Off is silent whatever its volume
// slider says. Read from `game.autoSounds`, the engine's only switches since 717cbf35. Pure.
import { AUTO_SOUNDS, AUTO_SOUNDS_DEFAULT, type AutoSound, type AutoSounds, type GameSettings } from '@quina/protocol';

/** The switches in the menu's order. */
export const AUTO_SOUND_ORDER: readonly AutoSound[] = AUTO_SOUNDS;

/** Each sound on or off now: the engine's `game.autoSounds`, all on until it has said (AUTO_SOUNDS_DEFAULT). */
export function autoSoundsNow(game: Pick<GameSettings, 'autoSounds'> | null | undefined): AutoSounds {
  return { ...AUTO_SOUNDS_DEFAULT, ...game?.autoSounds };
}
