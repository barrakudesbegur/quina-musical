// Admin's tunables, in one place. Look values live in ui/tokens.css and words in strings.ts; this file only
// holds numbers and keys that change behaviour.

export const MANAGE_CONFIG = Object.freeze({
  /** The edition a brand-new plan starts with (the year tag in the cards' QR links). */
  defaultEdition: '26',
  /** Wait this long after the last edit before saving a valid plan. */
  autosaveDelayMs: 600,
  /** localStorage keys Admin owns (the plan itself uses ui/data/plan-store.ts's key). */
  storage: Object.freeze({
    /** Sponsor logos as data URLs, kept beside the plan until the shared validator accepts them inline. */
    logos: 'quina.manage.logos.v1',
    /** Player-app settings, local only until the cloud exists. */
    playerSettings: 'quina.manage.playerSettings.v1',
  }),
  /** Where the relay serves the printed cards (apps/cards' cards.json). */
  cardsUrl: '/cards/cards.json',
  /** The hook audition page (the relay maps /show/* to engine/*). */
  auditionUrl: '/show/audition.html',
  /** How many sent commands the feedback log keeps. */
  commandLogSize: 30,
});

/** The logo clean-up pipeline (logic/logo-pixels.ts). Colour distances are on a 0–255 scale. */
export const LOGO_CONFIG = Object.freeze({
  /** Pixels this close to the background colour become fully transparent. */
  tolerance: 28,
  /** Pixels between `tolerance` and `tolerance + softness` fade out gradually (the soft edge). */
  softness: 24,
  /** Slider limits for both. */
  toleranceMax: 120,
  softnessMax: 80,
  /** Side of the square patch averaged at each corner to detect the background. */
  cornerPatch: 4,
  /** Corners closer than this are the same background colour. */
  cornerAgreeDistance: 32,
  /** A pixel with less alpha than this is empty when trimming. */
  alphaFloor: 8,
  /** The cleaned logo fits inside this box, keeping its aspect. Smaller logos are not enlarged. */
  maxWidth: 512,
  maxHeight: 256,
  /** Huge uploads are scaled down to this longest side before the pixel work. */
  maxSourceSide: 2048,
  /** A cleaned logo bigger than this (decoded bytes) is rejected: it would fill the browser's storage. */
  maxBytes: 200 * 1024,
});
