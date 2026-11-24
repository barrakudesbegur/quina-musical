// Player-app settings, kept only on this device until the Platform session's public feed can carry them
// to the phones. Never throws.
import { MANAGE_CONFIG } from '../config.ts';
import { DEFAULT_PLAYER_SETTINGS, readPlayerSettings, type PlayerSettings } from '../logic/player-settings.ts';

const KEY = MANAGE_CONFIG.storage.playerSettings;

export function loadPlayerSettings(): PlayerSettings {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? readPlayerSettings(JSON.parse(raw)) : { ...DEFAULT_PLAYER_SETTINGS };
  } catch {
    return { ...DEFAULT_PLAYER_SETTINGS };
  }
}

/** False when the browser refused to store them. */
export function savePlayerSettings(settings: PlayerSettings): boolean {
  try {
    localStorage.setItem(KEY, JSON.stringify(readPlayerSettings(settings)));
    return true;
  } catch {
    return false;
  }
}
