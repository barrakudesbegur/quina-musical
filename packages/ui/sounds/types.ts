// The touch sounds' vocabulary (D206-D208; the spec in temp/design-canvas/ds/ui-sounds.md, the hooks in
// packages/ui/ANIMATIONS.md): the classes of control that sound alike, and the shape of a surface's sprite.

/** One kind of control, so the same gesture sounds the same everywhere on a surface. */
export type TouchClass =
  | 'big'
  | 'small'
  | 'switchOn'
  | 'switchOff'
  | 'digit'
  | 'backspace'
  | 'submit'
  | 'drawerOpen'
  | 'drawerClose'
  | 'tab'
  | 'chipAdd'
  | 'chipRemove'
  | 'holdDone'
  | 'refused'
  | 'corner'
  | 'floating'
  | 'iconPick';

/** The finger goes down (press) or lifts (release): a down-sample or an up-sample of the same recording. */
export type TouchVariant = 'press' | 'release';

/** A segment of the sprite file: [start, length], in ms. */
export type SpriteSegment = readonly [number, number];

export interface SpriteVariant {
  /** The recording's name in button-sounds (as on its playground). */
  readonly sound: string;
  /** Its samples' places in the file; each play picks one. */
  readonly at: readonly SpriteSegment[];
}

export interface ClassSprite {
  readonly press?: SpriteVariant;
  readonly release?: SpriteVariant;
  /** The playback rate's random range for each play: the pitch variation. */
  readonly rate: readonly [number, number];
  /** The rate's multiplier at the sample's start and at its end: a pitch slide (the drawers' and the refused thud's). */
  readonly bend?: readonly [number, number];
}

export interface SpriteMap {
  /** The surface's gain on the samples, which the build brought to one peak (−6 dBFS). */
  readonly gain: number;
  readonly classes: Partial<Record<TouchClass, ClassSprite>>;
}
