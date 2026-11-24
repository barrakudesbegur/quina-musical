// The console's tunables, in one place. Look values (colours, sizes, animation lengths) are CSS tokens in
// ui/tokens.css and console/theme.css instead; the timings here are behaviour, read by the logic.
import type { CommandName } from '@quina/protocol';

export const CONSOLE = Object.freeze({
  /** localStorage keys (this device only). */
  storage: {
    label: 'quina.console.label.v1',
    theme: 'quina.console.theme.v1',
    checklist: 'quina.console.checklist.v1',
    /** The latest resume code (plan B), kept so a replacement laptop can be resumed from this device. */
    resume: 'quina.console.resume.v1',
  },
  /** The device label: what the header shows ("Tauleta", "Mòbil admin"). */
  labelMaxLength: 24,
  /** How long a silent relay connection waits before the console says the device isn't paired. */
  pairingGraceMs: 3000,
  labelPresets: ['Tauleta', 'Mòbil admin'] as const,
  /** Long press: used only when the `--dur-hold-confirm` token can't be read. */
  holdConfirmFallbackMs: 900,
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
});

export type Theme = 'light' | 'dark';
/** The user's call: light is probably easier to use on the night. */
export const DEFAULT_THEME: Theme = 'light';

/** Every command the console sends (its toasts name each one; strings.ts labels them all). */
export const CONSOLE_COMMANDS = [
  'next', 'back', 'hold', 'holdMusic', 'suspense', 'setPace', 'setGame', 'confirmLine', 'newRound', 'panic', 'sfx',
  'roundIntro', 'claim', 'checkStart', 'decide', 'winnerInfo', 'celebrationMusic', 'interval', 'endGame', 'pause',
  'intervalSkip', 'resumeAt',
] as const satisfies readonly CommandName[];
export type ConsoleCommand = (typeof CONSOLE_COMMANDS)[number];
