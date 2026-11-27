// The controls family's props (components-v2.md § 3, B1–B10, with the 27 Nov comments' rules in comments-27nov.md).
// Like types.ts, they say what a control draws, never a game concept; a control's look comes from its real inputs
// (its value, its validity, `disabled`), never from a `state` prop (D-c). The presets that name the concepts live in
// each app's actions.ts.
import type { IconName, PaletteColor, UiSound } from './types.ts';

/** B1 · Switch. `row`: the label, then the track at the end (the menus); `inline`: the track after the words, in a
 *  line of text; `embedded`: a drawing only, inside a control that is itself the toggle («Seguides»). */
export type SwitchLayout = 'row' | 'inline' | 'embedded';

/** The sounds of turning it on and off; `null` is silent (the phone's «Sons» plays its own). */
export interface SwitchSound {
  readonly on: UiSound;
  readonly off: UiSound;
}

/** B2 · one option of a SegmentedControl. */
export interface SegmentOption<T extends string = string> {
  readonly id: T;
  readonly label: string;
  readonly icon?: IconName | null;
  /** A second line under the label («suggerida»). */
  readonly note?: string | null;
  readonly disabled?: boolean;
}

export type SegmentSize = 's' | 'm' | 'l';

/** B3 · one tab. */
export interface TabSpec<T extends string = string> {
  readonly id: T;
  readonly label: string;
  readonly icon: IconName;
  /** A count after the label («Premis, 3»). */
  readonly badge?: string | number | null;
}

/** B4 · Chip. */
export type ChipColor = Extract<PaletteColor, 'grey' | 'ink' | 'green' | 'red' | 'orange' | 'cyan' | 'purple' | 'gold' | 'live' | 'slate'>;
export type ChipVariant = 'subtle' | 'solid';
export type ChipSize = 's' | 'm';
export type ChipDot = 'on' | 'off' | 'live';

/** B8 · one IconPicker option: a mark, whether it can be picked, and a tag on it (the owner's name). */
export interface IconPickerOption<T extends string | number = number> {
  readonly value: T;
  /** The option's accessible name («Barret»). */
  readonly label: string;
  readonly disabled?: boolean;
  /** A short tag over the option's foot (the card's owner, #54); it joins the accessible name. */
  readonly tag?: string | null;
}

/** B7 · the keys a NumberPad draws besides the digits. */
export type PadKey = '0' | '1' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | 'back' | 'enter';
