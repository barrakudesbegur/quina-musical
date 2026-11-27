// The console's tunables, in one place. Look values (colours, sizes, animation lengths) are CSS tokens in
// ui/tokens.css and console/theme.css instead; the timings here are behaviour, read by the logic.
import type { CommandName, SoundName } from '@quina/protocol';

export const CONSOLE = Object.freeze({
  /** localStorage keys (this device only). */
  storage: {
    label: 'quina.console.label.v1',
    theme: 'quina.console.theme.v1',
    checklist: 'quina.console.checklist.v1',
    /** The latest resume code (plan B), kept so a replacement laptop can be resumed from this device. */
    resume: 'quina.console.resume.v1',
    /** The Dempeus tab's «Al revés» during the finale: this tablet's own way of facing the stage. */
    finaleReversed: 'quina.console.finale-reversed.v1',
    /** The menu's «Sons de la tauleta» (U182): this device's touch sounds, on unless switched off. */
    uiSounds: 'quina.console.ui-sounds.v1',
  },
  /** The device label ("Tauleta", "Mòbil admin"), set in the menu: it names who pressed what. */
  labelMaxLength: 24,
  /** How long a silent relay connection waits before the console says the device isn't paired. */
  pairingGraceMs: 3000,
  labelPresets: ['Tauleta', 'Mòbil admin'] as const,
  /** Holding Parlem or Aguanta this long reaches its second level, Pausa or Suspens (logic/two-level.ts;
   *  ANIMATIONS.md › escalate-hold). Long enough that a firm tap never escalates, short enough to feel direct. */
  escalateHoldMs: 800,
  /**
   * The lock mirror (D234, logic/two-level-lock.ts): Parlem or Aguanta held on another console shows locked here once
   * the press has lasted `afterMs` (a tap elsewhere never flashes it; well under `escalateHoldMs`). Through the cloud
   * every console shares the link's clientId, so only the timing tells this console's hold from another's: one that
   * started more than `raceMs` before this console's own press of the button is another's (the lock shows, and the
   * press drops); after this console lets go, a lock that started before stays its own for `echoMs`, while the
   * engine's release is on its way.
   */
  lock: Object.freeze({ afterMs: 300, raceMs: 250, echoMs: 1500 }),
  /** An «Efectes» cell's light runs this long after its tap (ANIMATIONS.md › pad-playing): the snapshot has no playing
   *  effect yet; to replace with the engine's when Sound engine sends one. */
  padPlayingMs: 2000,
  /** A toast hides by itself after this long (ANIMATIONS.md › toast-in). */
  toastMs: 4000,
  /** At most this many toasts at once; the oldest goes first. */
  toastMax: 3,
  /** How many of this console's command ids are remembered, to recognise its own rejections. */
  sentLogSize: 64,
  /** The Claim number pad: card numbers are 1–9999, and one claim takes at most 10 (the `claim` command's limits). */
  cardDigits: 4,
  cardMax: 9999,
  claimMaxCards: 10,
  /** How many past landings Now playing lists. */
  recentLandings: 3,
  /** The auto-advance ring's last seconds, drawn in red (logic/now-ring.ts; ANIMATIONS.md › ring-last). */
  ringLastSec: 3,
  /**
   * The Desgraciat round's Dempeus tab, the motion Svelte runs in script (ANIMATIONS.md › standing-count,
   * standing-fall): the count's slide, how long a fallen chip stays red, its exit, the others' close-up (FLIP), the
   * stagger between fallen chips, and how many fallen chips animate at most (the rest vanish at once). Reduced
   * motion: no hold, no motion.
   */
  standing: Object.freeze({ countMs: 200, countShiftPx: 12, holdMs: 600, outMs: 250, outScale: 0.6, flipMs: 250, staggerMs: 30, maxAnimated: 20 }),
  /**
   * The Desgraciat's finale (logic/finale.ts; ANIMATIONS.md › The finale on stage). `sizes`: «Final a l'escenari» grows
   * from 20 standing down and is the biggest, recommended, from 10 down (the board's thresholds; the count includes
   * unsold cards). A start needs 2 finalists; the `finale` command takes at most 20. `freshMs`: a number just added stays
   * gold this long. The motion Svelte runs in script: a nino popping in, a removal or a fallen nino leaving, the stagger.
   */
  finale: Object.freeze({
    sizes: Object.freeze({ medium: 20, large: 10 }),
    minFinalists: 2,
    maxFinalists: 20,
    freshMs: 900,
    popMs: 300,
    outMs: 250,
    flipMs: 250,
    staggerMs: 60,
  }),
});

export type Theme = 'light' | 'dark';
/** The user's call: light is probably easier to use on the night. */
export const DEFAULT_THEME: Theme = 'light';

/** Every command the console sends (its toasts name each one; strings.ts labels them all). */
export const CONSOLE_COMMANDS = [
  'next', 'back', 'hold', 'holdMusic', 'suspense', 'setPace', 'setGame', 'confirmLine', 'newRound', 'panic', 'sfx',
  'roundIntro', 'claim', 'checkStart', 'checkNext', 'checkBack', 'checkAuto', 'checkReview', 'reviewEnd', 'winnerInfo',
  'celebrationMusic', 'interval', 'endGame', 'pause',
  'intervalSkip', 'resumeAt', 'revealPrizes', 'setVolume', 'throw', 'storm', 'finale', 'finaleCue', 'getUpcoming',
  'intervalSet', 'setAutoSound', 'soundTest', 'addCardsInPlay', 'twoLevelHold',
] as const satisfies readonly CommandName[];
export type ConsoleCommand = (typeof CONSOLE_COMMANDS)[number];

/**
 * The Wii Remote (optional): pairs with the show laptop over WebHID (desktop Chrome). Button mapping in
 * wii/mapping.ts; these are its numbers. Rumble patterns are on/off durations in ms, starting with on.
 */
export const WII = Object.freeze({
  vendorId: 0x057e,
  /** Raw accelerometer value at 0 g, and counts per g (the remotes' usual calibration). */
  accel: { zero: 128, perG: 26 },
  /** Suspens needs 3 strong jolts inside 1.5 s while B is held (dancing shouldn't do it). Each jolt vibrates (D144). */
  shake: { peakG: 2.6, resetG: 1.6, minGapMs: 110, count: 3, windowMs: 1500 },
  /** The shake gesture is on until someone turns it off (D148): the Game's `remoteShake`, the same on every console. */
  shakeOn: true,
  /**
   * Entering Suspens from the remote (D144–D148): B held then A held, or B alone with «Avanç manual», starts it at once;
   * `pulses` vibrations follow, evenly spaced, the last at the end of `windowMs`. Letting go of A (or of B, with manual
   * advance) before then cancels it; after it, it can't be undone. 1.5 s, a vibration every half second (D148; it may
   * change once the user tries the remote).
   */
  suspenseWindow: { windowMs: 1500, pulses: 3 },
  /** 1 or 2 held this long is Enrere (undo a landing); in a Check a shorter press steps back one reveal (D127, D134). */
  backHoldMs: 1500,
  /** A held this long, in a Check, reveals in a row («Seguides», D107) until it's let go. */
  aHoldMs: 600,
  /** − or + held this long is Pausa (a shorter press is Parlem). */
  pauseHoldMs: 800,
  /** The D-pad's four effects. */
  dpad: { up: 'tada', right: 'orchestra-hit', down: 'sad-trombone', left: 'among-us' },
  /**
   * `suspenseStep`: one of the window's vibrations before the last; `suspenseOn`: the last one, as the Suspens can no
   * longer be undone (or the shake's third jolt), followed by `rumbleLoop.suspenseOn` for as long as it's on;
   * `suspenseCancel`: a Suspens let go inside its window; `jolt`: one shake counted; `stop`: the motor off.
   */
  rumble: {
    tap: [70],
    pause: [250, 120, 250],
    back: [600],
    autoOn: [80, 80, 80],
    autoOff: [420],
    suspenseStep: [90],
    suspenseOn: [180],
    suspenseCancel: [40, 90, 40],
    jolt: [60],
    stop: [],
  },
  /** A gentler vibration after a rumble, repeated until the next one (D145: "oscillating or below full power"): the
   * motor is only on or off, so short pulses with long gaps feel softer. */
  rumbleLoop: { suspenseOn: [35, 165] },
  /** How often held buttons are checked (Enrere's long press). */
  tickMs: 50,
  /** How often the battery is asked for, and under which level the dialog warns. */
  batteryEveryMs: 60_000,
  /** The rolling window the host counts the remote's drops in (its range: wii/drops.ts), and from how many the
   * console warns. */
  dropWindowMs: 10 * 60_000,
  dropWarnAt: 2,
  batteryLow: 0.2,
  /** LED 1 lit: this remote is connected. */
  leds: 0x10,
} as const satisfies { dpad: Record<'up' | 'right' | 'down' | 'left', SoundName> } & Record<string, unknown>);
