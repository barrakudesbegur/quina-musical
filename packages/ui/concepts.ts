// The domain layer's shared half (components-v2.md § 11.2; D205, D210): what each game concept looks like on every
// surface that shows it. It is the only place that says "the Hold is cyan"; the generic components never name a
// concept, and each app's actions.ts spreads these into its controls with the note, sound and Wii key it adds.
// Plain data, so the plain-TypeScript projector can read it too. Ids are GLOSSARY.md's terms; labels come from
// i18n/ca.ts, never typed here. `icon` names the drawing in the one icon family (packages/ui/icons, H1); the throw
// songs' multicoloured stickers aren't line icons, so their concepts name none.
import { CA } from './i18n/ca.ts';
import type { PaletteColor, Pattern } from './components/types.ts';
import type { LineIconName } from './icons/line.ts';
import type { NinoPose } from './ninos.ts';

/** A drawing in the one icon family (H1), by what it shows. */
export type Drawing = LineIconName;

export interface ConceptLook {
  readonly color: PaletteColor;
  readonly label: string;
  /** Null: the concept shows no line icon (a ribbon, a title, a sticker). */
  readonly icon: Drawing | null;
  /** The on pattern its controls draw while on (R3). */
  readonly pattern?: Pattern;
}

export const CONCEPTS = {
  hold: { color: 'cyan', label: CA.concepts.hold, icon: 'mic' },
  pause: { color: 'cyan', label: CA.concepts.pause, icon: 'pause' },
  stay: { color: 'purple', label: CA.concepts.stay, icon: 'hand' },
  suspense: { color: 'gold', label: CA.concepts.suspense, icon: 'drum' },
  back: { color: 'red', label: CA.concepts.back, icon: 'undo' },
  next: { color: 'orange', label: CA.concepts.next, icon: 'skip' },
  claim: { color: 'green', label: CA.concepts.claim, icon: 'rosette' },
  checkReveal: { color: 'orange', label: CA.concepts.checkReveal, icon: 'play' },
  review: { color: 'grey', label: CA.concepts.review, icon: 'magnifier' },
  celebration: { color: 'gold', label: CA.concepts.celebration, icon: 'star' },
  checkFail: { color: 'red', label: CA.concepts.checkFail, icon: 'close' },
  line: { color: 'gold', label: CA.line, icon: null },
  /** Orange, not gold (27 Nov): the console's tickets already told the Line and the Bingo apart by their ribbons. */
  bingo: { color: 'orange', label: CA.bingo, icon: null },
  lastStanding: { color: 'live', label: CA.concepts.lastStanding, icon: 'star' },
  fallen: { color: 'slate', label: CA.concepts.fallen, icon: 'figure-seated' },
  standing: { color: 'green', label: CA.standing, icon: 'figure-standing' },
  throw: { color: 'pink', label: CA.concepts.throw, icon: null, pattern: 'stripes' },
  storm: { color: 'navy', label: CA.concepts.storm, icon: null, pattern: 'stripes' },
  break: { color: 'cyan', label: CA.concepts.break, icon: null },
} as const satisfies Record<string, ConceptLook>;

export type ConceptId = keyof typeof CONCEPTS;

/**
 * Which ninos each moment shows (components-v2.md F1 and § 11; the user's canvas comment #86, D-u): a small pool per
 * moment, so the same figure doesn't come back every time. The newest set leads each pool (the user: "the newer ones
 * look better"). A moment whose pose carries a meaning keeps it alone: the sitting nino on the QR's corner and on a
 * card that sat down (D72), the meditating one breathing through the Pause, the party nino for the finale's winner.
 * The finalists' poses are packages/rules/finale.ts › FINALE_POSES. A screen picks with ninoFor(moment, seed).
 */
export const NINO_FOR = {
  /** Before the Game, on the QR's corner: it sits there. */
  before: ['sentat'],
  roundIntro: ['afro', 'rosa', 'capita', 'cuiner', 'alt-2'],
  /** The Desgraciat round's intro: "everyone stand up". */
  standUp: ['mans-adalt', 'ballet', 'sardana-alt'],
  lineCelebration: ['astronauta', 'basket', 'bikini', 'salt-cames-obertes'],
  bingoCelebration: ['angel', 'ballet-2', 'confeti', 'mans-adalt'],
  validCheck: ['xocantla', 'rosa'],
  /** The Break, either side of its countdown (two at once). */
  break: ['meditant', 'sardana', 'snorkel', 'peix', 'mag', 'sardana-alt', 'cuiner'],
  pause: ['meditant'],
  /** Beside the big ✗, sized by its width: the squashed ninos that lie flat (the dizzy one is too tall there). */
  failedCheck: ['espatxarrat', 'caiguent'],
  /** A card that sat down in the Desgraciat round (D72). */
  fallen: ['sentat'],
  /** «QUINA POTRA!»: the last one standing's Celebration (three at once). */
  lastStanding: ['mans-adalt', 'confeti', 'salt-cames-obertes', 'ballet', 'afro'],
  finaleWinner: ['confeti'],
  legacy: ['confeti'],
  endOfNight: ['fent-una-torre', 'dimoni', 'ballet-2'],
} as const satisfies Record<string, readonly NinoPose[]>;

export type NinoMoment = keyof typeof NINO_FOR;

/**
 * The moment's nino for a seed that changes from one occurrence to the next (a round number, a card number, a count):
 * consecutive seeds never give the same pose twice in a row while the pool has more than one.
 */
export function ninoFor(moment: NinoMoment, seed: number): NinoPose {
  const pool: readonly NinoPose[] = NINO_FOR[moment];
  const i = Math.abs(Math.trunc(Number.isFinite(seed) ? seed : 0)) % pool.length;
  return pool[i];
}

/** `count` different ninos of a moment at once (the Break's two, «QUINA POTRA!»'s three), starting at the seed's. */
export function ninosFor(moment: NinoMoment, seed: number, count: number): NinoPose[] {
  const pool: readonly NinoPose[] = NINO_FOR[moment];
  const start = Math.abs(Math.trunc(Number.isFinite(seed) ? seed : 0));
  return Array.from({ length: Math.min(count, pool.length) }, (_, k) => pool[(start + k) % pool.length]);
}
