// Every tunable of the player app in one place. Logic modules import their numbers from here, so a change at
// the rehearsal is one edit. Nothing here touches the DOM.
import { PUBLIC_FEED } from './feed/public.ts';

export const PLAYER_CONFIG = Object.freeze({
  /** This year's tag, as in the cards' QR links (quina.barrakudesbegur.org/26/123). */
  edition: '26',
  /** The most cards one phone follows (the cloud feed's `?cards=` takes up to 30). */
  maxCards: PUBLIC_FEED.maxCardsPerPhone,
  /** Card ids a number pad or a link may name. */
  cardIdMin: 1,
  cardIdMax: PUBLIC_FEED.maxCardNumber,
  /** How many card identities exist (--card-color-N plus mark icon N); new cards take the next free one. */
  cardColors: 10,
  /** A card's optional name ("Àvia"). */
  maxNameLength: 20,
  /** The add-card QR scan (D141): how often the camera's picture is read at most (no work every frame), the side
   * of the picture jsQR reads (smaller is faster), and how long the "not this year's card" note stays. */
  qrReadEveryMs: 200,
  qrReadSize: 480,
  qrOtherNoteMs: 3000,

  /** Where the dev pages serve the app (production serves it at the domain's root). */
  devBase: '/player/',
  /** The printed cards (public: they are printed). The relay serves them here in development. */
  catalogUrl: '/cards/cards.json',
  catalogRetryMs: [2000, 5000, 15000, 30000] as readonly number[],
  coverBase: '/covers/',
  /** Production serves each cover as JPEG XL plus a JPEG fallback (the deploy step makes both, ≤ 256 px); the
   * laptop's dev relay has only the JPEGs. Never WebP (the user's decision). */
  coverJxl: true,

  /** Feed: the offline notice, the reconnection pill. Backoff and resume jitter come from PUBLIC_FEED. */
  offlineNoticeAfterMs: PUBLIC_FEED.offlineNoticeAfterMs,
  reconnectPillAfterMs: 3000,
  reconnectedPillMs: 1000,
  /** Back in the foreground, reconnect (after PUBLIC_FEED.resumeJitterMs of jitter) when the socket is down or
   * the page was hidden at least this long: a mobile socket may be dead without a close event. */
  visibleStaleAfterMs: 10_000,

  /** How long a toast stays. */
  toastMs: 3500,
  /** The app clock's refresh (countdowns, Heat). */
  tickMs: 250,
  /** Animations: at most this many elements animate at once on a phone (ui/ANIMATIONS.md budget). */
  maxAnimated: 24,
  markStaggerMs: 80,
  /** The Desgraciat round: cards falling on the same landing follow each other by this much (`card-fall`); cards
   * standing up as it starts, by this much (`stand-up`). */
  fallStaggerMs: 120,
  standUpStaggerMs: 80,
  /** How long a fresh cell, fall or stand-up keeps its animation hook (longer than the longest of them). */
  freshMs: 2000,

  /** The Heat garland across the top: its shape, in px of the 390 px design width (it stretches to the screen).
   * Its lights play the patterns of packages/ui/motion/garland.ts: one animated lamp per bulb (13), or 3 groups in
   * `party`, with a flame behind every `flameEvery`-th bulb when very hot (4). With no Heat yet (before the Game,
   * between feeds) it glows calm at `idleHeat`, as decoration only. */
  garland: Object.freeze({ width: 390, height: 62, bulbs: 13, swags: 2, top: 6, sag: 16, idleHeat: 0.1, flameEvery: 3 }),

  /** Sounds: −24 dBFS peak, one at a time. */
  soundPeakGain: 0.063,
  /** The Desgraciat round: one of the player's cards sat down (Android only; nothing depends on it). */
  vibrateFall: [60] as readonly number[],
  /** A song lands on one of the phone's cards (§8 Y1): a da-dum, longer than a touch's 10 ms. */
  vibrateYourSong: [70, 50, 70] as readonly number[],
  /** A card saved on «Afegir cartró» (`pad-saved`, §8 Y3): a short double tick. */
  vibrateAdded: [16, 60, 24] as readonly number[],
  /** `pad-saved`: its buttons take taps this long after «Desar», so a double tap never lands on them. */
  padSavedArmMs: 240,

  /** The installable app's updates (D222; apps/player/README.md "Updates and offline"): the service worker at the
   * site's root, how often the page asks for a new one while it's on screen (and at most how often a focus asks), and
   * how long without a touch, key or scroll counts as a quiet moment to reload into a new version (checked every
   * `reloadPollMs` while one waits; logic/update-gate.ts). */
  update: Object.freeze({ worker: '/player-sw.js', scope: '/', checkEveryMs: 5 * 60_000, minCheckGapMs: 30_000, quietMs: 4000, reloadPollMs: 1000 }),

  /** Storage keys (localStorage, this origin). */
  storageKey: 'quina.player.v1',
  cleanupKey: 'quina.player.cleanup',
});

/**
 * Last year's leftovers on quina.barrakudesbegur.org (client/vite.config.ts and client/src): a
 * vite-plugin-pwa service worker at /sw.js with a runtime cache 'songs-cache' (Workbox keeps its expiration
 * data in the 'workbox-expiration' IndexedDB), and two sessionStorage keys. It used no localStorage.
 */
export const LEGACY = Object.freeze({
  /** Our own service worker (D222: apps/player/sw/player-sw.ts; never sw.js, last year's name and now its kill switch). */
  ourWorker: /\/player-sw\.js$/,
  /** Our own worker's caches (apps/player/sw/routing.ts SW_CACHE_PREFIX). */
  ourCachePrefix: 'quina-player-',
  localKeys: [] as readonly string[],
  sessionKeys: ['spa-redirect', 'adminAuth'] as readonly string[],
  databases: ['workbox-expiration'] as readonly string[],
  /** Last year's card links: /?c=123. */
  cardParam: 'c',
});

export type PlayerConfig = typeof PLAYER_CONFIG;
