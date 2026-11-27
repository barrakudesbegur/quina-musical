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
