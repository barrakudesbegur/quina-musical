// The generic components' visual vocabulary (components-v2.md: D205, D210). Props name what they produce, never a
// game concept: a palette colour, a style, a size, a pattern, a ring, the slots' content, the sound. Which concept
// looks like what is the domain layer's job (packages/ui/concepts.ts and each app's actions.ts).
import type { LineIconName } from '../icons/line.ts';
import type { TouchClass } from '../sounds/types.ts';

/** Every palette a `color` prop can name (packages/ui/ds/palette.css). Each component lists the ones it accepts. */
export type PaletteColor =
  | 'orange'
  | 'red'
  | 'green'
  | 'gold'
  | 'cyan'
  | 'purple'
  | 'pink'
  | 'navy'
  | 'grey'
  | 'slate'
  | 'periwinkle'
  | 'live'
  | 'snow'
  | 'ink'
  | 'white';

export const PALETTE_COLORS = [
  'orange',
  'red',
  'green',
  'gold',
  'cyan',
  'purple',
  'pink',
  'navy',
  'grey',
  'slate',
  'periwinkle',
  'live',
  'snow',
  'ink',
  'white',
] as const satisfies readonly PaletteColor[];

/** The on pattern (R3): drawn while the control is on, panning; never while it's off, disabled or locked. */
export type Pattern = 'none' | 'stripes' | 'dots';

/** The ring round the whole control (R1): the default action's orange, gold (recommended, the celebrate cue), the
 *  fail cue's red. One value, so two rings never stack. */
export type Ring = 'orange' | 'gold' | 'red';

/** An icon by the name of its drawing, from the one family (H1: packages/ui/icons/line.ts). */
export type IconName = LineIconName;

/** A UI sound by kind of control (packages/ui/sounds/): the press and release samples it plays. `null` is silent. */
export type UiSound = TouchClass;

/** A Wii remote key, named as the remote's own keys (B5); `shake` is the remote shaken three times. */
export type WiiKey = 'a' | 'b' | 'minus' | 'plus' | 'one' | 'two' | 'home' | 'up' | 'down' | 'left' | 'right' | 'shake';

/** The Wii keys a control shows (the `wii` slot): drawn only while a remote is connected. */
export interface WiiKeySpec {
  /** One key, or a pair pressed as one (− and +, 1 and 2). */
  readonly keys: readonly WiiKey[];
  /** The key must be held: a three-quarter ring round it. */
  readonly hold?: boolean;
  /** Held together with A (Suspens: B + A). */
  readonly withA?: boolean;
  readonly size?: 'md' | 'sm';
  /** Another way to do the same, drawn after these keys with «/» between (D-j: «×3 / B+A»). */
  readonly or?: WiiKeySpec;
}

export type ButtonColor = 'orange' | 'red' | 'green' | 'gold' | 'cyan' | 'purple' | 'pink' | 'navy' | 'grey';
export type ButtonVariant = 'solid' | 'soft' | 'plain' | 'dashed';
export type ButtonSize = 'xs' | 's' | 'm' | 'l';

/** Button's own props (A1), apart from the native button attributes it passes through. */
export interface ButtonLook {
  color?: ButtonColor;
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** The only route to a pill shape (D189, D-a): «+ Cartró» over the content. */
  floating?: boolean;
  pattern?: Pattern;
  ring?: Ring | null;
  /** The chip on the top edge: «RECOMANAT» (R11; with ring='gold'). */
  ribbon?: string | null;
  /** A toggle's state: set only on toggles («Seguides»); `aria-pressed`. */
  pressed?: boolean;
  disabled?: boolean;
  /** Working: the pressed look held, with stepping dots («Destapant…»). */
  busy?: boolean;
  /** The press and release sound; the default is a big button's ('big'); `null` is silent. */
  sound?: UiSound | null;
  icon?: IconName | null;
  iconPlacement?: 'start' | 'top';
  label: string;
  note?: string | null;
  wii?: WiiKeySpec | null;
}

/** What a preset in the domain layer may set on a Button: everything but its state. */
export type ButtonPreset = Pick<ButtonLook, 'color' | 'variant' | 'size' | 'floating' | 'pattern' | 'icon' | 'iconPlacement' | 'label' | 'note' | 'sound' | 'wii' | 'ring' | 'ribbon'>;

/** E3 · Toast: the palettes a toast takes, and its two looks. */
export type ToastColor = Extract<PaletteColor, 'green' | 'navy' | 'orange' | 'red'>;

/** What a preset in the domain layer sets on a Toast: its look, never its words. */
export interface ToastPreset {
  readonly color: ToastColor;
  readonly variant: 'solid' | 'paper';
  readonly icon: IconName | null;
  readonly urgent?: boolean;
}

/** G2 · Plate: the palettes a plate takes (§ 11: gold the round's name, orange «CARTRÓ #57», slate a failed Check,
 *  periwinkle a Review, live «Salvats!», snow / red / gold the finalists). */
export type PlateColor = Extract<PaletteColor, 'gold' | 'orange' | 'slate' | 'periwinkle' | 'live' | 'snow' | 'red'>;

/** G1 · StickerTitle's ramp (projector px: hero 280, hero-2 170, xl 150, l 112, m 76, s 60, xs 48). */
export type StickerTitleSize = 'hero' | 'hero-2' | 'xl' | 'l' | 'm' | 's' | 'xs';

/** E1 · Ring: what it draws (components-v2.md § 6; Ring.svelte). The console's show states map onto these in
 *  apps/console/ring-looks.ts; the generic never names a state. */
export type RingColor = Extract<PaletteColor, 'orange' | 'red' | 'gold' | 'cyan' | 'purple' | 'green' | 'periwinkle' | 'slate'>;

export interface RingLook {
  /** progress: the arc empties with `progress`; full: a whole ring; segments: 12 turning dashes; none: the track. */
  readonly arc: 'progress' | 'full' | 'segments' | 'none';
  readonly color: RingColor;
  /** The gold-and-ink striped ring (the Pause). */
  readonly pattern?: 'hazard' | null;
  /** The faint outer halo (the last seconds). */
  readonly halo?: boolean;
  /** The centre: the value and unit; an icon (with the value small under it, if any); a coloured disc with an icon;
   *  the spinning record; the two pause bars. */
  readonly face: 'number' | 'icon' | 'disc' | 'record' | 'bars';
  readonly icon?: IconName | null;
  /** The centre breathes (ring-manual). */
  readonly pulse?: boolean;
  /** A new value ticks in (ring-last). */
  readonly tick?: boolean;
  /** A thicker arc (the Suspense's 9 against 8). */
  readonly bold?: boolean;
  /** The centre's icon one step bigger (the Check's rosette). */
  readonly iconLarge?: boolean;
}

export interface RingBadgeLook {
  readonly icon: IconName;
  readonly color: Extract<PaletteColor, 'green' | 'periwinkle' | 'red' | 'cyan' | 'purple' | 'ink'>;
  readonly label: string;
}

/** TwoLevelButton's second level (A3): the strip at its foot, in the body's own palette (D-k). */
export interface Level2 {
  label: string;
  icon?: IconName | null;
  /** The remote's keys for it, at the strip's right end (D94). */
  wii?: WiiKeySpec | null;
}

/** A time bar drawn inside a TwoLevelButton's body (a Throw song's position): its fill, the two times, a mark. */
export interface Meter {
  /** How far, 0..1. */
  fraction: number;
  /** The time so far, and the length («0:44», «3:33»). */
  start: string;
  end: string;
  /** A mark on the bar (the drop), at 0..1, with its word over it. */
  marker?: { at: number; label: string } | null;
  /** The state's icon before the time (music notes while it plays, the pause bars while stopped). */
  icon?: IconName | null;
}

/** A SoundPad cell (A9): its id, its name (never drawn: the accessible name and tooltip, D35), its remote key. */
export interface SoundPadItem {
  id: string;
  label: string;
  wii?: WiiKeySpec | null;
}
