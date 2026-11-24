// The projector stage's tunables: the one place for the numbers the stage uses. Geometry is in the
// reference box (1440×1080, the 4:3 projector), which is scaled to fit any screen and letterboxed. Look
// values (colours, type, durations of CSS motion) are not here: they are CSS custom properties in
// ui/tokens.css and stage/stage.css. Timings here are the ones the pure timing logic needs.

export const STAGE = Object.freeze({
  /** The Heat shown before the first `heat.sample` starts: a calm glow. */
  heatNeutral: 0.2,
  /** How many of the engine's Heat samples the stage keeps. */
  heatSamplesKept: 8,
  /** The reference box every scene is laid out in (px). */
  box: Object.freeze({ width: 1440, height: 1080 }),
  /**
   * The drum's band: the full width of the screen, from the top of the box, about 60 % of its height. In the
   * show page the real drum shows through it; standalone, a labelled placeholder fills it.
   */
  drumBand: Object.freeze({ top: 0, height: 640 }),
  /** How many songs the play scene shows (the brief: only the last 3). */
  recentSongs: 3,
  /** Lights in the Heat garland. All are always on; only their colour and glow follow the Heat. */
  garlandLights: 22,
  /** How often the garland repaints. Heat eases over ~20 s, so 4 Hz is plenty. */
  heatRepaintMs: 250,
  /** No optional DOM writes this close before a landing (ANIMATIONS.md budget). */
  quietBeforeLandingMs: 300,
  /** Interval: each prize stays this long before the next one rotates in (`interval-rotate`). */
  prizeRotationMs: 8000,
  /** Interval and after: sponsor thanks rotation. */
  sponsorRotationMs: 5000,
  /** Rough countdowns: a clock time above this many minutes, rounded minutes below. */
  countdown: Object.freeze({ clockAboveMin: 90, fineBelowMin: 10, coarseStepMin: 5 }),
  /** `suspense`: the "?" breathes once per this period, speeding up towards the auto-release. */
  suspenseBreath: Object.freeze({ slowMs: 1600, fastMs: 800 }),
  /** `link-lost`: the relay must be gone this long before the dot turns red. */
  linkLostAfterMs: 3000,
  /** The Check marks a step when its snippet ends (ANIMATIONS.md `check-step`), or when it starts. */
  checkMarkAt: 'end' as 'end' | 'start',
  /**
   * Ninos stickers, by where they show: URLs of the game-style versions (flat colour, sticker border) of
   * `brand/ninos/`, kept in `assets/` and bundled by Vite. A null sticker is left out (its plaque centres its
   * text instead). `checkFailed`: the nino-espatxarrat (from `brand/ninos/figures/nino-espatxarrat.svg`)
   * tumbling onto a failed Check's plaque (`check-result`).
   */
  stickers: Object.freeze({ checkFailed: new URL('./assets/nino-espatxarrat.svg', import.meta.url).href as string | null }),
  shuffle: Object.freeze({
    /** Where the grid of covers lies, in the box (px). */
    area: Object.freeze({ x: 40, y: 40, width: 1360, height: 1000 }),
    /** Share of the Shuffle window for each step: grid appears, jiggles, covers fly, the drum settles. */
    split: Object.freeze({ appear: 1, jiggle: 2, fly: 5, settle: 1 }),
    /** One cover's flight into the drum. */
    perCoverMs: 600,
    /** Blank tiles to shuffle when the catalog (cards.json) is missing. */
    fallbackTiles: 60,
  }),
  confetti: Object.freeze({
    /** Pieces per burst; a Bingo gets two bursts, one after the other (at most 150 animated at once). */
    line: Object.freeze([120]),
    bingo: Object.freeze([100, 100]),
    /** Colour tones a piece may take (stage.css maps them to palette tokens). */
    tones: 5,
  }),
  /** `credits`: the after-the-Game roll's speed. */
  creditsPxPerSec: 40,
  /** The player app, for the QR before the Game and in the Interval (never during play). */
  playerApp: Object.freeze({ origin: 'https://quina.barrakudesbegur.org', label: 'quina.barrakudesbegur.org' }),
  catalogUrl: '/cards/cards.json',
} as const);
