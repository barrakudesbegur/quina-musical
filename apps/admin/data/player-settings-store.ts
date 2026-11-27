// Player-app settings as this device last had them: the form starts from these, and served from the cloud it then takes
// what the phones have now (GET /api/notice and /api/sounds, data/cloud-player-settings.ts). Never throws.
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
