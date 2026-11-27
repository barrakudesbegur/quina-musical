// The projector stage's tunables: the one place for the numbers the stage uses. Geometry is in the
// reference box (1440×1080, the 4:3 projector), which is scaled to fit any screen and letterboxed. Look
// values (colours, type, durations of CSS motion) are not here: they are CSS custom properties in
// ui/tokens.css and stage/stage.css. Timings here are the ones the pure timing logic needs.
import type { NinoMoment } from '../../packages/ui/concepts.ts';
import type { NinoPose } from '../../packages/ui/ninos.ts';

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
  /**
   * The Heat garland across the top (the S2 board on Projector-Joc: 1440 × 120, 4 swags, 34 bulbs, hung 26 px above
   * the box's top edge, so the hooks are off screen). Its lights play the patterns of packages/ui/motion/garland.ts,
   * with a flame behind every `flameEvery`-th bulb when very hot (17).
   */
  garland: Object.freeze({ width: 1440, height: 120, swags: 4, bulbs: 34, top: -14, sag: 62, flameEvery: 2 }),
  /** How often the garland repaints. Heat eases over ~20 s, so 4 Hz is plenty. */
  heatRepaintMs: 250,
  /** No optional DOM writes this close before a landing (ANIMATIONS.md budget). */
  quietBeforeLandingMs: 300,
  /** Rough countdowns: a clock time above this many minutes, rounded minutes below. */
  countdown: Object.freeze({ clockAboveMin: 90, fineBelowMin: 10, coarseStepMin: 5 }),
  /** `suspense`: the "?" breathes once per this period, speeding up towards the auto-release. */
  suspenseBreath: Object.freeze({ slowMs: 1600, fastMs: 800 }),
  /** `link-lost`: the relay must be gone this long before the dot turns red. */
  linkLostAfterMs: 3000,
  /** The Check marks a step when its snippet ends (ANIMATIONS.md `check-step`), or when it starts. */
  checkMarkAt: 'end' as 'end' | 'start',
  /**
   * `check-type`: the card-type badge gets its ✓ this long after the Check starts, once the plate and badge
   * have dropped in (never after the first snippet starts; the engine leaves 1.5 s before it).
   */
  checkTypeLeadMs: 900,
  /** `check-unreveal`: how long a step back's lifted mark stays (its lift-off is `--stage-dur-unreveal`, 240 ms). */
  checkUnrevealMs: 300,
  /**
   * Ninos stickers, by where they show: the moment whose pool they come from (packages/ui/concepts.ts › NINO_FOR; the
   * stickers are packages/ui/assets/ninos). Each scene picks with ninoFor(moment, seed), the seed changing from one
   * occurrence to the next (the card number, the round number), so the same figure doesn't come back every time
   * (the user's canvas comment #86). A null moment leaves the sticker out (its plaque centres its text instead).
   * - `checkFailed`: the squashed ninos beside a failed Check's big ✗ (`check-result`), by card number.
   * - `before`: the sitting nino on the QR's top-right corner before the Game.
   * - `interval`: the two ninos either side of the Interval's countdown, by the coming round.
   * - The Desgraciat round: `standUp`, a hands-up nino beside the round's name at its intro ("everyone stand up"; its
   *   Celebration's ninos are `finale.celebration`); `checkFallen`, the sitting nino beside a fallen card's big ✗
   *   (`check-fallen`: the card sat down).
   */
  stickers: Object.freeze({
    checkFailed: 'failedCheck' as NinoMoment | null,
    checkFallen: 'fallen' as NinoMoment | null,
    standUp: 'standUp' as NinoMoment | null,
    before: 'before' as NinoMoment | null,
    interval: 'break' as NinoMoment | null,
  }),
  /**
   * The Desgraciat's finale on stage (board Projector-Desgraciat-Final; ANIMATIONS.md › The finale on stage):
   * - `band`: the drum's band while it's on, smaller and higher so the stage fits under the title (the show page's drum
   *   follows `--stage-band-*`);
   * - each finalist's nino is their pose (packages/rules/finale.ts `FINALE_POSES`), tinted by its hue; the winner wears
   *   `winner`, the party nino;
   * - `confetti`: «Salvats!»'s slow paper confetti (D185), from the ribbon, in the look of `STAGE.paper`;
   * - `celebration`: the «QUINA POTRA!» Celebration's three stickers, from the moment's pool by round.
   */
  finale: Object.freeze({
    band: Object.freeze({ top: 70, height: 330 }),
    winner: 'confeti' as NinoPose,
    confetti: Object.freeze({ count: 180, durationMs: 9000, origin: Object.freeze({ x: 0.5, y: 0.56 }), spread: 0.5 }),
    celebration: Object.freeze({ stickers: 'lastStanding' as NinoMoment | null }),
  }),
  /**
   * The sponsor strip before the Game and in the Interval (G4; the user's canvas comment #88): `sponsor-pan`'s speed,
   * and one tile's step (240 px tile + 24 px gap in sponsors.css; only used until the row is measured). Under reduced
   * motion it pages instead (`sponsor-pages`): tiles per page (as many as fit the 1344 px row) and how long a page shows.
   */
  sponsorPanPxPerSec: 60,
  sponsorTileStepPx: 264,
  sponsorsPerPage: 5,
  sponsorPageMs: 8000,
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
  /**
   * The projector's paper confetti (D185: the phones' particles, packages/ui/motion/paper-confetti.ts), on one canvas:
   * a slow fall of about 55 px/s on the 1080 px box, bigger pieces than the phones', the finale's colours with an ink
   * outline. «Salvats!» (`finale.confetti`) and every Celebration's rain (`confetti`) share it.
   */
  paper: Object.freeze({
    fallShare: 0.05,
    size: Object.freeze({ min: 12, max: 22 }),
    colors: Object.freeze(['#FFC531', '#3EE07F', '#FF6FB5', '#4FC3FF', '#FFF6E5', '#FF8A1F']),
    outline: '#17132B',
  }),
  /** Each Celebration's paper rain (ANIMATIONS.md `celebrate`): from a little above the middle, across the whole width. */
  confetti: Object.freeze({
    line: Object.freeze({ count: 120, durationMs: 14000, origin: Object.freeze({ x: 0.5, y: 0.3 }), spread: 1 }),
    bingo: Object.freeze({ count: 200, durationMs: 14000, origin: Object.freeze({ x: 0.5, y: 0.3 }), spread: 1 }),
    standing: Object.freeze({ count: 200, durationMs: 14000, origin: Object.freeze({ x: 0.5, y: 0.3 }), spread: 1 }),
  }),
  /** `credits`: the after-the-Game roll's speed. */
  creditsPxPerSec: 40,
  /** The player app, for the QR before the Game (never in play, nor in the Interval: the user's review). */
  playerApp: Object.freeze({ origin: 'https://quina.barrakudesbegur.org', label: 'quina.barrakudesbegur.org' }),
  catalogUrl: '/cards/cards.json',
} as const);
