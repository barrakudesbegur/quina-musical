// Player-app settings an admin sets for every phone: whether interface sounds start on (a player's own choice
// still wins) and a message banner. Only kept on this device until the Platform session's public feed can
// carry them. Pure: the shape, its defaults and a check that never throws.

export interface PlayerSettings {
  /** Interface sounds on by default (the brief's default: on). */
  soundsOnByDefault: boolean;
  /** A message shown on every phone; empty for none. */
  banner: string;
}

export const DEFAULT_PLAYER_SETTINGS: PlayerSettings = Object.freeze({ soundsOnByDefault: true, banner: '' });
export const BANNER_MAX_LENGTH = 140;

/** Read stored settings, falling back to the defaults field by field. */
export function readPlayerSettings(json: unknown): PlayerSettings {
  const rec = typeof json === 'object' && json !== null ? (json as Record<string, unknown>) : {};
  return {
    soundsOnByDefault: typeof rec.soundsOnByDefault === 'boolean' ? rec.soundsOnByDefault : DEFAULT_PLAYER_SETTINGS.soundsOnByDefault,
    banner: typeof rec.banner === 'string' ? rec.banner.slice(0, BANNER_MAX_LENGTH) : DEFAULT_PLAYER_SETTINGS.banner,
  };
}
