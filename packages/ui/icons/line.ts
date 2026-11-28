// The line icons (H1 `line` style): one registry for the phone, the console and the board generator. Each icon is
// drawn on a 24×24 grid and named after its drawing, never after the concept that shows it (components-v2 H1), so
// any concept can reuse a drawing; the apps map their own names onto these (apps/console/icons.ts,
// apps/player/components/Icon.svelte). Icon.svelte draws them; icons.css holds the stroke system, so a path here
// carries geometry only, never a stroke width.
//
// Pure data. A path is a stroke in currentColor; an `IconPart` says otherwise:
// - `fill`: filled and stroked in currentColor (a solid triangle, a button on a remote);
// - `solid`: filled in currentColor with no stroke (dots, the Especial's star);
// - `accent`: a stroke in the button's own colour inside a big button (the outline look);
// - `paper` / `ink` / `inkSolid`: a two-tone icon in paper and ink whatever the text colour (the finish flag);
// - `transform`: an SVG transform for that part; `clip`: drawn inside the icon's `paper` part;
// - `behind`: the part lies behind the others: every part that isn't `behind` cuts a gap out of it, its own outline
//   plus a gap (an SVG mask, `icon__cut` in icons.css), so two lines that cross never touch (the crossed swords).

export interface IconPart {
  d: string;
  part?: 'fill' | 'solid' | 'accent' | 'paper' | 'ink' | 'inkSolid';
  transform?: string;
  clip?: true;
  behind?: true;
}
export type IconPath = string | IconPart;

const fill = (d: string): IconPart => ({ d, part: 'fill' });
const behind = (d: string): IconPart => ({ d, behind: true });
const solid = (d: string): IconPart => ({ d, part: 'solid' });
/** A circle as a path (every part is a `<path>`, so one rule styles them all). */
const circle = (cx: number, cy: number, r: number): string => `M${cx - r} ${cy}a${r} ${r} 0 1 0 ${2 * r} 0a${r} ${r} 0 1 0 ${-2 * r} 0z`;
/** A rounded rectangle as a path. */
const roundRect = (x: number, y: number, w: number, h: number, r: number): string =>
  `M${x + r} ${y}h${w - 2 * r}a${r} ${r} 0 0 1 ${r} ${r}v${h - 2 * r}a${r} ${r} 0 0 1 ${-r} ${r}h${-(w - 2 * r)}a${r} ${r} 0 0 1 ${-r} ${-r}v${-(h - 2 * r)}a${r} ${r} 0 0 1 ${r} ${-r}z`;

/** The finish flag's waving cloth and its 5 × 4 squares (every other one inked). */
const FLAG_CLOTH = 'M3 5c3-1.6 6-1.6 9 0s6 1.6 9 0v14.4c-3 1.6-6 1.6-9 0s-6-1.6-9 0z';
const FLAG_CHECKS = Array.from({ length: 20 }, (_, i) => [i % 5, Math.floor(i / 5)] as const)
  .filter(([c, r]) => (r + c) % 2 === 0)
  .map(([c, r]) => `M${3 + c * 3.6} ${5 + r * 3.6}h3.6v3.6h-3.6z`)
  .join('');

export const LINE_ICONS = {
  // ---- moving through the show
  skip: [fill('M5 5l10 7-10 7z'), 'M19 5v14'],
  play: ['M7 4.5l12 7.5-12 7.5z'],
  pause: ['M8 5v14', 'M16 5v14'],
  /** Two play heads: reveal in a row (Seguides). */
  'fast-forward': ['M4 6l7 6-7 6z', 'M13 6l7 6-7 6z'],
  /** Back one step: a hooked arrow (Enrere). */
  undo: ['M9 14L4 9l5-5', 'M4 9h10a6 6 0 0 1 0 12h-3'],
  /** Two arrows chasing each other with clear gaps, never a full circle (auto-advance). */
  cycle: ['M19 8.5A8 8 0 0 0 5.5 7', 'M5 15.5A8 8 0 0 0 18.5 17', 'M5.5 3v4h4', 'M18.5 21v-4h-4'],
  /**
   * The cycle struck through. The strike runs from top right to bottom left, across both arrows; along the other
   * diagonal it ran through the arrows' gaps and the icon read as broken (#91).
   */
  'cycle-off': ['M19 8.5A8 8 0 0 0 5.5 7', 'M5 15.5A8 8 0 0 0 18.5 17', 'M5.5 3v4h4', 'M18.5 21v-4h-4', 'M20 4L4 20'],
  reload: ['M21 12a9 9 0 1 1-3-6.7', 'M21 4v5h-5'],
  /** Back to the start. */
  restart: ['M4 12a8 8 0 1 0 2.4-5.7', 'M4 4v4.6h4.6'],
  shuffle: ['M3 6h4l10 12h4', 'M3 18h4l3-3.6', 'M14 9.6L17 6h4', 'M18 3l3 3-3 3', 'M18 15l3 3-3 3'],
  swap: ['M4 8h15', 'M16 5l3 3-3 3', 'M20 16H5', 'M8 13l-3 3 3 3'],

  // ---- the presenters' moves
  mic: ['M12 3a3 3 0 0 1 3 3v6a3 3 0 0 1-6 0V6a3 3 0 0 1 3-3z', 'M5 11a7 7 0 0 0 14 0', 'M12 18v3'],
  /** A raised hand: three fingers 4 units wide, so they stay open at the family's stroke and in the outline look. */
  hand: [
    'M6.5 12.5V6a2 2 0 0 1 4 0v5',
    'M10.5 11V4.2a2 2 0 0 1 4 0V11',
    'M14.5 11.5V6.5a2 2 0 0 1 4 0V14c0 4.2-2.9 7.2-6.8 7.2-2.6 0-4.4-1.2-5.9-3.6L3.3 14.2a1.7 1.7 0 0 1 2.9-1.8L6.5 13',
  ],
  /** A drum with its sticks. */
  drum: ['M4 9a8 3 0 1 0 16 0a8 3 0 1 0-16 0z', 'M4 9v7c0 1.7 3.6 3 8 3s8-1.3 8-3V9', 'M8 11.6v7', 'M16 11.6v7', 'M3 3l6 4.5', 'M21 3l-6 4.5'],
  /** A verification rosette (r(θ) = R + a·cos(nθ), 10 bumps) with a check inside. */
  rosette: [
    'M12 4.2C12.41 4.2 12.83 3.94 13.31 3.7C13.8 3.46 14.33 3.29 14.78 3.44C15.23 3.59 15.56 4.04 15.81 4.52C16.06 5 16.25 5.45 16.58 5.69C16.92 5.93 17.41 5.97 17.94 6.06C18.47 6.15 19 6.33 19.28 6.71C19.56 7.09 19.56 7.65 19.48 8.19C19.4 8.72 19.29 9.2 19.42 9.59C19.54 9.98 19.92 10.3 20.3 10.69C20.68 11.07 21 11.53 21 12C21 12.47 20.68 12.93 20.3 13.31C19.92 13.7 19.54 14.02 19.42 14.41C19.29 14.8 19.4 15.28 19.48 15.81C19.56 16.35 19.56 16.91 19.28 17.29C19 17.67 18.47 17.85 17.94 17.94C17.41 18.03 16.92 18.07 16.58 18.31C16.25 18.55 16.06 19 15.81 19.48C15.56 19.96 15.23 20.41 14.78 20.56C14.33 20.71 13.8 20.54 13.31 20.3C12.83 20.06 12.41 19.8 12 19.8C11.59 19.8 11.17 20.06 10.69 20.3C10.2 20.54 9.67 20.71 9.22 20.56C8.77 20.41 8.44 19.96 8.19 19.48C7.94 19 7.75 18.55 7.42 18.31C7.08 18.07 6.59 18.03 6.06 17.94C5.53 17.85 5 17.67 4.72 17.29C4.44 16.91 4.44 16.35 4.52 15.81C4.6 15.28 4.71 14.8 4.58 14.41C4.46 14.02 4.08 13.7 3.7 13.31C3.32 12.93 3 12.47 3 12C3 11.53 3.32 11.07 3.7 10.69C4.08 10.3 4.46 9.98 4.58 9.59C4.71 9.2 4.6 8.72 4.52 8.19C4.44 7.65 4.44 7.09 4.72 6.71C5 6.33 5.53 6.15 6.06 6.06C6.59 5.97 7.08 5.93 7.42 5.69C7.75 5.45 7.94 5 8.19 4.52C8.44 4.04 8.77 3.59 9.22 3.44C9.67 3.29 10.2 3.46 10.69 3.7C11.17 3.94 11.59 4.2 12 4.2Z',
    'M8.8 12.3l2.2 2.2 4.3-4.6',
  ],
  trophy: ['M8 4h8v5a4 4 0 0 1-8 0z', 'M8 6H5a3 3 0 0 0 3 4', 'M16 6h3a3 3 0 0 1-3 4', 'M12 13v4', 'M8 20h8'],
  /** Three steps in one outline, with a star over the top one (the finale on the stage). */
  podium: ['M2.5 21.5v-4.5h6.5V13.5h6v4.5h6.5v3.5z', 'M12 1L13.18 3.98L16.37 4.18L13.9 6.22L14.7 9.32L12 7.6L9.3 9.32L10.1 6.22L7.63 4.18L10.82 3.98Z'],
  'figure-standing': ['M12 2.3a2.3 2.3 0 1 0 0 4.6a2.3 2.3 0 1 0 0-4.6z', 'M12 8v6.5', 'M12 14.5l-3 6.5', 'M12 14.5l3 6.5', 'M6.5 10.5L12 9l5.5 1.5'],
  'figure-seated': ['M10 2.3a2.3 2.3 0 1 0 0 4.6a2.3 2.3 0 1 0 0-4.6z', 'M10 8v6h6l1.5 6.5', 'M10 10.5l4.5 1.5', 'M5 12.5V21', 'M5 16.5h5'],

  // ---- sound and music
  speaker: ['M4 9h4l5-4v14l-5-4H4z', 'M17 9a4 4 0 0 1 0 6'],
  'speaker-loud': ['M4 9h4l5-4v14l-5-4H4z', 'M17 9a4 4 0 0 1 0 6', 'M19.5 6.5a7.5 7.5 0 0 1 0 11'],
  'speaker-mute': ['M4 9h4l5-4v14l-5-4H4z', 'M16.5 9.5l5 5', 'M21.5 9.5l-5 5'],
  /** Two beamed notes: music playing (the Ara tab, a throw song's time strip). */
  music: ['M9 18V5l11-2v13', 'M9 18a3 3 0 1 1-6 0 3 3 0 0 1 6 0z', 'M20 16a3 3 0 1 1-6 0 3 3 0 0 1 6 0z'],

  // ---- the plain UI set
  close: ['M6 6l12 12', 'M18 6L6 18'],
  check: ['M5 12.5l4.5 4.5L19 7.5'],
  plus: ['M12 5v14', 'M5 12h14'],
  minus: ['M5 12h14'],
  menu: ['M4 6h16', 'M4 12h16', 'M4 18h16'],
  'chevron-right': ['M9 5l7 7-7 7'],
  'chevron-left': ['M15 5l-7 7 7 7'],
  /** The phone's hint to a card off screen (card-hint, §8 Y2). */
  'arrow-up': ['M12 20V5', 'M6 11l6-6 6 6'],
  'arrow-down': ['M12 4v15', 'M6 13l6 6 6-6'],
  /** ⌫: the ✗ sits in the box's middle, well clear of its right edge at any stroke (#49). */
  backspace: ['M22.5 4.5H8.5L1.5 12l7 7.5h14z', 'M13 9.5l5 5', 'M18 9.5l-5 5'],
  /** ↵ on a keypad. */
  enter: ['M19 5v7a3 3 0 0 1-3 3H6', 'M10 11l-4 4 4 4'],
  pencil: ['M4 20h4L19 9l-4-4L4 16z', 'M13.5 6.5l4 4'],
  trash: ['M4 7h16', 'M9 7V4h6v3', 'M6 7l1 13h10l1-13', 'M10 11v6', 'M14 11v6'],
  lock: ['M7 11h10a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-6a2 2 0 0 1 2-2z', 'M8 11V7a4 4 0 0 1 8 0v4'],
  eye: ['M2.5 12S6 5 12 5s9.5 7 9.5 7-3.5 7-9.5 7-9.5-7-9.5-7z', 'M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6z'],
  'eye-off': ['M2.5 12S6 5 12 5s9.5 7 9.5 7-3.5 7-9.5 7-9.5-7-9.5-7z', 'M3 3l18 18'],
  magnifier: ['M10.5 4a6.5 6.5 0 1 0 0 13a6.5 6.5 0 1 0 0-13z', 'M15.5 15.5L21 21'],
  /** A plain cog: one outline and a hole. */
  cog: [
    'M9.97 4.68V2h4.06v2.68l1.72.71 1.89-1.89 2.86 2.86-1.89 1.89.71 1.72H22v4.06h-2.68l-.71 1.72 1.89 1.89-2.86 2.86-1.89-1.89-1.72.71V22H9.97v-2.68l-1.72-.71-1.89 1.89-2.86-2.86 1.89-1.89-.71-1.72H2V9.97h2.68l.71-1.72L3.5 6.36 6.36 3.5l1.89 1.89Z',
    circle(12, 12, 3.1),
  ],
  /** A drag handle: two columns of dots. */
  grip: [solid(`${circle(9, 6, 1.9)}${circle(15, 6, 1.9)}${circle(9, 12, 1.9)}${circle(15, 12, 1.9)}${circle(9, 18, 1.9)}${circle(15, 18, 1.9)}`)],
  warning: ['M12 3l10 18H2z', 'M12 10v4', 'M12 17.5v.5'],
  power: ['M12 3v9', 'M6.3 6.3a8 8 0 1 0 11.4 0'],
  sun: ['M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8z', 'M12 2v2', 'M12 20v2', 'M2 12h2', 'M20 12h2', 'M4.9 4.9l1.4 1.4', 'M17.7 17.7l1.4 1.4', 'M4.9 19.1l1.4-1.4', 'M17.7 6.3l1.4-1.4'],
  moon: ['M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z'],

  // ---- time
  clock: ['M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z', 'M12 7v5l3 2'],
  /** A clock with a circular arrow going back (last year's card). */
  'clock-back': ['M4.6 13.4A7.6 7.6 0 1 0 6.3 6.8', 'M3.6 3.8v4.4H8', 'M12 8v4.4l3 1.8'],
  stopwatch: ['M12 5a8 8 0 1 0 0 16a8 8 0 1 0 0-16z', 'M12 9v4l2 2', 'M9 2h6'],
  calendar: ['M6 5h12a2.5 2.5 0 0 1 2.5 2.5v10a2.5 2.5 0 0 1-2.5 2.5H6a2.5 2.5 0 0 1-2.5-2.5v-10A2.5 2.5 0 0 1 6 5z', 'M3.5 10h17', 'M8 3v4', 'M16 3v4'],
  gauge: ['M12 13l4-4', 'M3.5 17a9 9 0 1 1 17 0'],
  /** A crystal ball on its stand (the future). */
  'crystal-ball': ['M12 3a7 7 0 1 0 0 14a7 7 0 1 0 0-14z', 'M7 20h10', 'M9 17l-1 3', 'M15 17l1 3', 'M9.5 8a3 3 0 0 1 3-2'],

  // ---- things
  gift: [
    'M5.5 9h13a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2z',
    'M2.5 9h19',
    'M12 9v11',
    'M12 9c-2-4-6-5-6-2s4 2 6 2c2 0 6 1 6-2s-4-2-6 2',
  ],
  /** A card's grid, 4 × 3 (the console's Cerca › Cartró). */
  grid: ['M4 5h16v14H4z', 'M4 9.7h16', 'M4 14.3h16', 'M8 5v14', 'M12 5v14', 'M16 5v14'],
  /** A card's grid, 3 × 3 in a rounded frame (the phone's Cartrons). */
  'grid-rounded': ['M6 4h12a3 3 0 0 1 3 3v10a3 3 0 0 1-3 3H6a3 3 0 0 1-3-3V7a3 3 0 0 1 3-3z', 'M3 9.5h18', 'M3 14.5h18', 'M9 4v16', 'M15 4v16'],
  chart: ['M4 4v16h16', 'M8 16v-5', 'M12 16V8', 'M16 16v-3'],
  flag: ['M5 21V4', 'M5 4h11l-2 4 2 4H5'],
  /** The finish flag: no pole, a waving cloth with square checks, in paper and ink on any colour. */
  'flag-finish': [{ d: FLAG_CLOTH, part: 'paper' }, { d: FLAG_CHECKS, part: 'inkSolid', clip: true }, { d: FLAG_CLOTH, part: 'ink' }],
  /** A ticket notched on both sides with its tear-off line, tilted so it reads as one even at a dot's size. */
  ticket: [
    {
      d: 'M4 5h16a1 1 0 0 1 1 1v3.5a2.5 2.5 0 0 0 0 5V18a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1v-3.5a2.5 2.5 0 0 0 0-5V6a1 1 0 0 1 1-1z',
      transform: 'rotate(-20 12 12)',
    },
    { d: 'M15 8.5v1.5M15 14v1.5', transform: 'rotate(-20 12 12)' },
  ],
  /**
   * Two swords crossed, tips up (the throws, D138; U170 option A drawn as a line icon, D245). Each: a blade 3.8 wide
   * with a pointed tip, a guard across it, the grip and a round pommel; they cross on the blades, clear of the guards.
   * The front one (tip top left) cuts a gap out of the back one, so the outlines never cross.
   */
  'crossed-swords': [
    behind('M7.16 14.16L16.76 4.56L20.6 3.4L19.44 7.24L9.84 16.84'),
    behind('M6.1 13.1L10.9 17.9'),
    behind('M8.5 15.5L5 19'),
    behind(circle(3.7, 20.3, 1)),
    'M16.84 14.16L7.24 4.56L3.4 3.4L4.56 7.24L14.16 16.84',
    'M17.9 13.1L13.1 17.9',
    'M15.5 15.5L19 19',
    circle(20.3, 20.3, 1),
  ],
  /**
   * A cloud raining three corn kernels (the corn-seed storm, D151; U170 option A drawn as a line icon, D245): three
   * bumps on a flat base, and the house kernel (the corn card mark's outline) small and filled, falling apart.
   */
  'cloud-corn': [
    'M6.2 11H17.4A3.2 3.2 0 0 0 15.44 5.27A4 4 0 0 0 7.6 6.21A2.6 2.6 0 0 0 6.2 11z',
    fill('M5.63 15.73C6.28 15.42 7.01 15.63 7.32 16.42C7.64 17.23 7.55 18.27 7 18.54C6.45 18.8 5.57 18.24 5.14 17.49C4.71 16.76 4.99 16.05 5.63 15.73z'),
    fill('M12 18.18C12.72 18.18 13.28 18.69 13.22 19.54C13.15 20.4 12.61 21.3 12 21.3C11.39 21.3 10.85 20.4 10.78 19.54C10.72 18.69 11.28 18.18 12 18.18z'),
    fill('M18.37 15.73C19.01 16.05 19.29 16.76 18.86 17.49C18.43 18.24 17.55 18.8 17 18.54C16.45 18.27 16.36 17.23 16.68 16.42C16.99 15.63 17.72 15.42 18.37 15.73z'),
  ],
  /** A steaming cup (a break). */
  cup: ['M4 9h13v5a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5z', 'M17 11h1.5a2.5 2.5 0 0 1 0 5H17', 'M8 3v3', 'M12 3v3'],
  star: ['M12 3l2.8 5.8 6.2.9-4.5 4.4 1 6.2L12 17.4l-5.5 2.9 1-6.2L3 9.7l6.2-.9z'],
  /** The Especial's star on the phone: filled, rounder points, no outline (the user, 25 Nov). */
  'star-solid': [
    solid('M12 2.2c.6 0 1 .4 1.3 1l2.2 4.6 5 .7c1.2.2 1.6 1.6.8 2.4l-3.6 3.6.9 5c.2 1.2-1.1 2.1-2.2 1.5L12 18.7 7.6 21c-1.1.6-2.4-.3-2.2-1.5l.9-5-3.6-3.6c-.8-.8-.4-2.2.8-2.4l5-.7 2.2-4.6c.3-.6.7-1 1.3-1z'),
  ],
  /** The Desgraciat round's face: eyes and a frown, no circle (D23). */
  'sad-face': ['M8 8.5v2.2', 'M16 8.5v2.2', 'M7 18c1.4-2.4 3-3.4 5-3.4s3.6 1 5 3.4'],
  lifebuoy: ['M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z', 'M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8z', 'M5.6 5.6l3.6 3.6', 'M14.8 14.8l3.6 3.6', 'M18.4 5.6l-3.6 3.6', 'M9.2 14.8l-3.6 3.6'],

  // ---- devices and connections
  camera: ['M4 8.5a2 2 0 0 1 2-2h2l1.5-2h5l1.5 2h2a2 2 0 0 1 2 2V17a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2z', circle(12, 12.6, 3.6)],
  'camera-off': ['M9.5 4.5h5l1.5 2h2a2 2 0 0 1 2 2V16', 'M17 19H6a2 2 0 0 1-2-2V8.5a2 2 0 0 1 2-2h1', 'M10 10a3.6 3.6 0 0 0 4.6 5', 'M3 3l18 18'],
  tablet: ['M7 3h10a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z', 'M11 18h2'],
  /** A phone with an arrow coming down into it: install the app (the player's Ajustos, D221). */
  'phone-arrow-down': ['M7.5 2.5h9a2 2 0 0 1 2 2v15a2 2 0 0 1-2 2h-9a2 2 0 0 1-2-2v-15a2 2 0 0 1 2-2z', 'M12 6.5v8', 'M8.75 11.25L12 14.5l3.25-3.25', 'M10.5 18h3'],
  /** ⋯ in a ring, as iOS Safari's page menu by the address bar (the iPhone's install steps, D221). */
  dots: [circle(12, 12, 9.5), solid(circle(7.75, 12, 1.35)), solid(circle(12, 12, 1.35)), solid(circle(16.25, 12, 1.35))],
  /** A tray with an arrow going up out of it: the iPhone's Share button. */
  share: ['M8.5 9.5H7a1.5 1.5 0 0 0-1.5 1.5v8.5A1.5 1.5 0 0 0 7 21h10a1.5 1.5 0 0 0 1.5-1.5V11A1.5 1.5 0 0 0 17 9.5h-1.5', 'M12 2.75V14', 'M8.5 6.25L12 2.75l3.5 3.5'],
  /** A plus in a rounded square: the iPhone's «Add to Home Screen». */
  'plus-square': ['M7 3.5h10A3.5 3.5 0 0 1 20.5 7v10a3.5 3.5 0 0 1-3.5 3.5H7A3.5 3.5 0 0 1 3.5 17V7A3.5 3.5 0 0 1 7 3.5z', 'M12 8v8', 'M8 12h8'],
  wifi: ['M2.5 9a14 14 0 0 1 19 0', 'M5.5 12.5a9.5 9.5 0 0 1 13 0', 'M8.6 16a5 5 0 0 1 6.8 0', 'M12 19.5h.01'],
  'wifi-off': ['M2 8.5a15 15 0 0 1 20 0', 'M5.5 12a10 10 0 0 1 13 0', 'M9 15.5a5 5 0 0 1 6 0', 'M3 3l18 18', fill(circle(12, 19, 1.2))],
  keyboard: ['M3 7h18v10H3z', 'M7 11h.01', 'M11 11h.01', 'M15 11h.01', 'M8 14h8'],
  /** A QR code, softened as the pad's QR button draws it (QrButton): three rounded finders, each with its dot, and a few
   *  dots in the fourth corner (the phone's «Escanejar el QR», 28 Nov). */
  'qr-code': [
    roundRect(3, 3, 7, 7, 2),
    roundRect(14, 3, 7, 7, 2),
    roundRect(3, 14, 7, 7, 2),
    solid(roundRect(5.5, 5.5, 2, 2, 0.6)),
    solid(roundRect(16.5, 5.5, 2, 2, 0.6)),
    solid(roundRect(5.5, 16.5, 2, 2, 0.6)),
    solid(roundRect(13, 13, 3, 3, 0.9)),
    solid(roundRect(18, 13, 3, 3, 0.9)),
    solid(roundRect(18, 18, 3, 3, 0.9)),
    solid(roundRect(13, 18, 3, 3, 0.9)),
  ],
  /** «#», as a card's number is written (#57): the phone's «Escriure el número» (28 Nov). */
  hash: ['M10 4l-2 16', 'M16 4l-2 16', 'M4.5 9h15', 'M4.5 15h15'],
  /** The Wii remote: its body, the cross, the A and the 1 and 2. */
  'wii-remote': [
    'M9.5 2h5A2.5 2.5 0 0 1 17 4.5v15a2.5 2.5 0 0 1-2.5 2.5h-5A2.5 2.5 0 0 1 7 19.5v-15A2.5 2.5 0 0 1 9.5 2z',
    'M12 4.8v3M10.5 6.3h3',
    fill('M10.6 11a1.4 1.4 0 1 0 2.8 0a1.4 1.4 0 1 0-2.8 0z'),
    'M12 15.5v.01M12 18.5v.01',
  ],
} as const satisfies Record<string, readonly IconPath[]>;

export type LineIconName = keyof typeof LINE_ICONS;

/** A path's `d`. */
export const pathOf = (p: IconPath): string => (typeof p === 'string' ? p : p.d);
/** A path's part class ("icon__fill", "icon__accent"…), or undefined for a plain stroke. */
export const partClass = (p: IconPath): string | undefined => (typeof p === 'string' || !p.part ? undefined : `icon__${p.part}`);
/** Whether a part lies behind the others (`behind`): it's drawn through the gap the others cut. */
export const isBehind = (p: IconPath): boolean => typeof p !== 'string' && p.behind === true;
/** Parts that the outline look draws its ink line under (two-tone and accent parts keep their own look). */
export const outlined = (p: IconPath): boolean => typeof p === 'string' || p.part === undefined || p.part === 'fill' || p.part === 'solid';
