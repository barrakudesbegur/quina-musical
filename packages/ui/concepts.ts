// The domain layer's shared half (components-v2.md § 11.2; D205, D210): what each game concept looks like on every
// surface that shows it. It is the only place that says "the Hold is cyan"; the generic components never name a
// concept, and each app's actions.ts spreads these into its controls with the note, sound and Wii key it adds.
// Plain data, so the plain-TypeScript projector can read it too. Ids are GLOSSARY.md's terms; labels come from
// i18n/ca.ts, never typed here. `icon` names the drawing in the one icon family (packages/ui/icons, H1); the throw
// songs' multicoloured stickers aren't line icons, so their concepts name none.
import { CA } from './i18n/ca.ts';
import type { PaletteColor, Pattern } from './components/types.ts';
import type { LineIconName } from './icons/line.ts';

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
  bingo: { color: 'gold', label: CA.bingo, icon: null },
  lastStanding: { color: 'live', label: CA.concepts.lastStanding, icon: 'star' },
  fallen: { color: 'slate', label: CA.concepts.fallen, icon: 'figure-seated' },
  standing: { color: 'green', label: CA.standing, icon: 'figure-standing' },
  throw: { color: 'pink', label: CA.concepts.throw, icon: null, pattern: 'stripes' },
  storm: { color: 'navy', label: CA.concepts.storm, icon: null, pattern: 'stripes' },
  break: { color: 'cyan', label: CA.concepts.break, icon: null },
} as const satisfies Record<string, ConceptLook>;

export type ConceptId = keyof typeof CONCEPTS;
