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
  },
  /** The device label ("Tauleta", "Mòbil admin"), set in the menu: it names who pressed what. */
  labelMaxLength: 24,
  /** How long a silent relay connection waits before the console says the device isn't paired. */
  pairingGraceMs: 3000,
  labelPresets: ['Tauleta', 'Mòbil admin'] as const,
  /** Long press: used only when the `--dur-hold-confirm` token can't be read. */
  holdConfirmFallbackMs: 900,
  /** Holding Parlem or Aguanta this long reaches its second level, Pausa or Suspens (logic/two-level.ts;
   *  ANIMATIONS.md › escalate-hold). Long enough that a firm tap never escalates, short enough to feel direct. */
  escalateHoldMs: 800,
  /** How long the "Mantén premut per confirmar" hint stays up (ANIMATIONS.md › hold-hint). */
  holdHintMs: 1500,
  /** A toast hides by itself after this long (ANIMATIONS.md › toast-in). */
  toastMs: 4000,
  /** At most this many toasts at once; the oldest goes first. */
  toastMax: 3,
  /** How many of this console's command ids are remembered, to recognise its own rejections. */
  sentLogSize: 64,
  /** The Claim number pad: card numbers are 1–9999 (the `claim` command's limits). */
  cardDigits: 4,
  cardMax: 9999,
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
});

export type Theme = 'light' | 'dark';
/** The user's call: light is probably easier to use on the night. */
export const DEFAULT_THEME: Theme = 'light';

/** Every command the console sends (its toasts name each one; strings.ts labels them all). */
export const CONSOLE_COMMANDS = [
  'next', 'back', 'hold', 'holdMusic', 'suspense', 'setPace', 'setGame', 'confirmLine', 'newRound', 'panic', 'sfx',
  'roundIntro', 'claim', 'checkStart', 'decide', 'winnerInfo', 'celebrationMusic', 'interval', 'endGame', 'pause',
  'intervalSkip', 'resumeAt', 'revealPrizes',
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
  /** Suspens needs 3 strong jolts inside 1.5 s while B is held (dancing shouldn't do it). */
  shake: { peakG: 2.6, resetG: 1.6, minGapMs: 110, count: 3, windowMs: 1500 },
  /** 1 or 2 held this long is Enrere. */
  backHoldMs: 1500,
  /** − or + held this long is Pausa (a shorter press is Parlem). */
  pauseHoldMs: 800,
  /** The D-pad's four effects. */
  dpad: { up: 'tada', right: 'orchestra-hit', down: 'sad-trombone', left: 'among-us' },
  rumble: { tap: [70], suspense: [90, 70, 90, 70, 260], pause: [250, 120, 250], back: [600], autoOn: [80, 80, 80], autoOff: [420] },
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
