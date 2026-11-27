// Player-app settings an admin sets for every phone (D227): whether interface sounds start on (a player's own choice
// still wins) and a message banner, with its on/off. This device keeps the last ones (data/player-settings-store.ts);
// Admin served from the cloud sends them to the phones (data/cloud-player-settings.ts: PUT /api/sounds and PUT
// /api/notice, which the public feed carries to every phone). Pure: the shape, its defaults, a check that never
// throws, and the bodies the cloud takes.

export interface PlayerSettings {
  /** Interface sounds on by default (the brief's default: on). */
  soundsOnByDefault: boolean;
  /** The message for every phone, kept while it is off. */
  banner: string;
  /** The message shows on the phones (and isn't empty). */
  bannerOn: boolean;
}

export const DEFAULT_PLAYER_SETTINGS: PlayerSettings = Object.freeze({ soundsOnByDefault: true, banner: '', bannerOn: false });
/** Admin's limit for the message; the cloud takes up to 200 characters (apps/cloud config `maxNoticeLength`). */
export const BANNER_MAX_LENGTH = 140;

/** Read stored settings, falling back to the defaults field by field. */
export function readPlayerSettings(json: unknown): PlayerSettings {
  const rec = typeof json === 'object' && json !== null ? (json as Record<string, unknown>) : {};
  return {
    soundsOnByDefault: typeof rec.soundsOnByDefault === 'boolean' ? rec.soundsOnByDefault : DEFAULT_PLAYER_SETTINGS.soundsOnByDefault,
    banner: typeof rec.banner === 'string' ? rec.banner.slice(0, BANNER_MAX_LENGTH) : DEFAULT_PLAYER_SETTINGS.banner,
    bannerOn: typeof rec.bannerOn === 'boolean' ? rec.bannerOn : DEFAULT_PLAYER_SETTINGS.bannerOn,
  };
}

/** PUT /api/notice's body: the trimmed message while it's on, else null (the phones show none). */
export function noticeBody(settings: PlayerSettings): { notice: string | null } {
  const text = settings.banner.trim().slice(0, BANNER_MAX_LENGTH);
  return { notice: settings.bannerOn && text ? text : null };
}

/** PUT /api/sounds's body. */
export const soundsBody = (settings: PlayerSettings): { soundsDefault: boolean } => ({ soundsDefault: settings.soundsOnByDefault });

/** Where a send to the phones is: nothing sent since the last edit, on its way, done, or refused (`status` 0: no
 * answer from the cloud). */
export type SendState = { kind: 'idle' } | { kind: 'sending' } | { kind: 'sent' } | { kind: 'failed'; status: number };
