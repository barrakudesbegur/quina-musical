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
  cardColors: 8,
  /** A card's optional name ("Àvia"). */
  maxNameLength: 20,

  /** Where the dev pages serve the app (production serves it at the domain's root). */
  devBase: '/player/',
  /** The printed cards (public: they are printed). The relay serves them here in development. */
  catalogUrl: '/cards/cards.json',
  catalogRetryMs: [2000, 5000, 15000, 30000] as readonly number[],
  coverBase: '/covers/',
  /** Production serves small WebP covers (the deploy step converts them); the laptop's dev relay has the JPEGs. */
  coverExt: 'webp',
  coverExtDev: 'jpg',

  /** Feed: the offline notice, the reconnection pill. Backoff and resume jitter come from PUBLIC_FEED. */
  offlineNoticeAfterMs: PUBLIC_FEED.offlineNoticeAfterMs,
  reconnectPillAfterMs: 3000,
  reconnectedPillMs: 1000,
  /** Back in the foreground, reconnect (after PUBLIC_FEED.resumeJitterMs of jitter) when the socket is down or
   * the page was hidden at least this long: a mobile socket may be dead without a close event. */
  visibleStaleAfterMs: 10_000,

  /** Reel: cards per second at full speed, the ramps, and the Suspense coast. */
  reelSpeed: 12,
  reelRampUpMs: 600,
  reelRampDownMs: 1500,
  reelCoastSpeed: 3,
  /** Ticks as cards pass, at most this many per second. */
  reelTickMaxPerSec: 10,

  /** How long a toast stays. */
  toastMs: 3500,
  /** The app clock's refresh (countdowns, Heat). */
  tickMs: 250,
  /** Animations: at most this many elements animate at once on a phone (ui/ANIMATIONS.md budget). */
  maxAnimated: 24,
  markStaggerMs: 80,

  /** Sounds: −24 dBFS peak, one at a time. */
  soundPeakGain: 0.063,
  vibrateNearWin: [30, 40, 30] as readonly number[],

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
  /** Our own service worker, if one is ever added (it must not be called sw.js, last year's name). */
  ourWorker: /\/player-sw\.js$/,
  /** Our own caches, if any. */
  ourCachePrefix: 'quina-player-',
  localKeys: [] as readonly string[],
  sessionKeys: ['spa-redirect', 'adminAuth'] as readonly string[],
  databases: ['workbox-expiration'] as readonly string[],
  /** Last year's card links: /?c=123. */
  cardParam: 'c',
});

export type PlayerConfig = typeof PLAYER_CONFIG;
