// The console's icons, on a 24×24 grid, drawn in currentColor by Icon.svelte so a theme recolours them with
// the text. Most paths are strokes; a `fill` part is filled with the stroke colour too, and an `accent` part
// takes the button's colour inside a big button (the check in the Claim rosette). The paths of the in-play
// icons are the approved console boards' (Consola-Joc). Every icon sits next to a text label, or carries one.

/** A filled shape, or a detail drawn in the button's own colour. */
export interface IconPart {
  d: string;
  part: 'fill' | 'accent';
}
export type IconPath = string | IconPart;

const fill = (d: string): IconPart => ({ d, part: 'fill' });
const accent = (d: string): IconPart => ({ d, part: 'accent' });

export const ICONS = {
  next: [fill('M5 5l10 7-10 7z'), 'M19 5v14'],
  play: ['M7 4.5l12 7.5-12 7.5z'],
  /** Parlem (Hold): a microphone. */
  hold: ['M12 3a3 3 0 0 1 3 3v6a3 3 0 0 1-6 0V6a3 3 0 0 1 3-3z', 'M5 11a7 7 0 0 0 14 0', 'M12 18v3'],
  /** Aguanta (Stay): a raised hand. */
  stay: [
    'M8 13V5.5a1.5 1.5 0 0 1 3 0V11',
    'M11 11V4a1.5 1.5 0 0 1 3 0v7',
    'M14 11V5.5a1.5 1.5 0 0 1 3 0V14c0 4-2.5 7-6 7-2.5 0-4-1.2-5.5-3.5L3.8 14.8a1.5 1.5 0 0 1 2.5-1.6L8 15',
  ],
  /** Suspens: a drum with its sticks. */
  suspense: [
    'M4 9a8 3 0 1 0 16 0a8 3 0 1 0-16 0z',
    'M4 9v7c0 1.7 3.6 3 8 3s8-1.3 8-3V9',
    'M8 11.6v7',
    'M16 11.6v7',
    'M3 3l6 4.5',
    'M21 3l-6 4.5',
  ],
  back: ['M9 14L4 9l5-5', 'M4 9h10a6 6 0 0 1 0 12h-3'],
  /** Comprovar cartró: a verification rosette with a check. */
  claim: [
    fill('M12 2.5l2.3 1.6 2.8-.2 1 2.6 2.4 1.5-.7 2.7 1 2.6-2.2 1.7-.5 2.8-2.8.4-1.9 2.1-2.4-1.4-2.4 1.4-1.9-2.1-2.8-.4-.5-2.8-2.2-1.7 1-2.6-.7-2.7 2.4-1.5 1-2.6 2.8.2z'),
    accent('M8.2 12.3l2.6 2.6 5-5.3'),
  ],
  /** Efectes: a speaker. */
  sound: ['M4 9h4l5-4v14l-5-4H4z', 'M17 9a4 4 0 0 1 0 6'],
  fanfare: ['M8 4h8v5a4 4 0 0 1-8 0z', 'M8 6H5a3 3 0 0 0 3 4', 'M16 6h3a3 3 0 0 1-3 4', 'M12 13v4', 'M8 20h8'],
  menu: ['M4 6h16', 'M4 12h16', 'M4 18h16'],
  close: ['M6 6l12 12', 'M18 6L6 18'],
  backspace: ['M21 5H8l-6 7 6 7h13z', 'M12 9l6 6', 'M18 9l-6 6'],
  check: ['M5 12.5l4.5 4.5L19 7'],
  cross: ['M6 6l12 12', 'M18 6L6 18'],
  eye: ['M2.5 12S6 5 12 5s9.5 7 9.5 7-3.5 7-9.5 7-9.5-7-9.5-7z', 'M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6z'],
  eyeOff: ['M2.5 12S6 5 12 5s9.5 7 9.5 7-3.5 7-9.5 7-9.5-7-9.5-7z', 'M3 3l18 18'],
  lock: ['M7 11h10a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-6a2 2 0 0 1 2-2z', 'M8 11V7a4 4 0 0 1 8 0v4'],
  /** Auto-advance: two separate arrows chasing each other, with clear gaps (never a full circle). */
  auto: ['M19 8.5A8 8 0 0 0 5.5 7', 'M5 15.5A8 8 0 0 0 18.5 17', 'M5.5 3v4h4', 'M18.5 21v-4h-4'],
  /** Ritme: a gauge. */
  gauge: ['M12 13l4-4', 'M3.5 17a9 9 0 1 1 17 0'],
  /** Futur: a crystal ball on its stand. */
  crystal: ['M12 3a7 7 0 1 0 0 14a7 7 0 1 0 0-14z', 'M7 20h10', 'M9 17l-1 3', 'M15 17l1 3', 'M9.5 8a3 3 0 0 1 3-2'],
  /** Premis: a gift. */
  gift: [
    'M5.5 9h13a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2z',
    'M2.5 9h19',
    'M12 9v11',
    'M12 9c-2-4-6-5-6-2s4 2 6 2c2 0 6 1 6-2s-4-2-6 2',
  ],
  /** The round's expected end: a flag. */
  flag: ['M5 21V4', 'M5 4h11l-2 4 2 4H5'],
  /** Schedule recovery: a stopwatch. */
  timer: ['M12 5a8 8 0 1 0 0 16a8 8 0 1 0 0-16z', 'M12 9v4l2 2', 'M9 2h6'],
  reload: ['M21 12a9 9 0 1 1-3-6.7', 'M21 4v5h-5'],
  minus: ['M5 12h14'],
  plus: ['M12 5v14', 'M5 12h14'],
  sun: ['M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8z', 'M12 2v2', 'M12 20v2', 'M2 12h2', 'M20 12h2', 'M4.9 4.9l1.4 1.4', 'M17.7 17.7l1.4 1.4', 'M4.9 19.1l1.4-1.4', 'M17.7 6.3l1.4-1.4'],
  moon: ['M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z'],
  music: ['M9 18V5l11-2v13', 'M9 18a3 3 0 1 1-6 0 3 3 0 0 1 6 0z', 'M20 16a3 3 0 1 1-6 0 3 3 0 0 1 6 0z'],
  alert: ['M12 3l10 18H2z', 'M12 10v4', 'M12 17.5v.5'],
  power: ['M12 3v9', 'M6.3 6.3a8 8 0 1 0 11.4 0'],
  shuffle: ['M3 6h4l10 12h4', 'M3 18h4l3-3.6', 'M14 9.6L17 6h4', 'M18 3l3 3-3 3', 'M18 15l3 3-3 3'],
  pause: ['M8 5v14', 'M16 5v14'],
  star: ['M12 3l2.8 5.8 6.2.9-4.5 4.4 1 6.2L12 17.4l-5.5 2.9 1-6.2L3 9.7l6.2-.9z'],
  clock: ['M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z', 'M12 7v5l3 2'],
} as const satisfies Record<string, readonly IconPath[]>;

export type IconName = keyof typeof ICONS;

/** A path's `d`. */
export const pathOf = (p: IconPath): string => (typeof p === 'string' ? p : p.d);
/** A path's part class ("icon__fill", "icon__accent"), or undefined for a plain stroke. */
export const partClass = (p: IconPath): string | undefined => (typeof p === 'string' ? undefined : `icon__${p.part}`);
