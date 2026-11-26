// The console's icons, on a 24×24 grid, drawn in currentColor by Icon.svelte so a theme recolours them with
// the text. Most paths are strokes; a `fill` part is filled with the stroke colour too, and an `accent` part
// takes the button's colour inside a big button. The paths of the in-play
// icons are the approved console boards' (Consola-Joc). Every icon sits next to a text label, or carries one.

/** A filled shape, or a detail drawn in the button's own colour. */
export interface IconPart {
  d: string;
  part: 'fill' | 'accent';
}
export type IconPath = string | IconPart;

const fill = (d: string): IconPart => ({ d, part: 'fill' });

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
  /**
   * Comprovar: an outline verification rosette, a smooth regular wavy ring (r(θ) = R + a·cos(nθ), 10 bumps),
   * with a check inside; one colour, no fill (the Consola-Joc board's path).
   */
  claim: [
    'M12 4.2C12.41 4.2 12.83 3.94 13.31 3.7C13.8 3.46 14.33 3.29 14.78 3.44C15.23 3.59 15.56 4.04 15.81 4.52C16.06 5 16.25 5.45 16.58 5.69C16.92 5.93 17.41 5.97 17.94 6.06C18.47 6.15 19 6.33 19.28 6.71C19.56 7.09 19.56 7.65 19.48 8.19C19.4 8.72 19.29 9.2 19.42 9.59C19.54 9.98 19.92 10.3 20.3 10.69C20.68 11.07 21 11.53 21 12C21 12.47 20.68 12.93 20.3 13.31C19.92 13.7 19.54 14.02 19.42 14.41C19.29 14.8 19.4 15.28 19.48 15.81C19.56 16.35 19.56 16.91 19.28 17.29C19 17.67 18.47 17.85 17.94 17.94C17.41 18.03 16.92 18.07 16.58 18.31C16.25 18.55 16.06 19 15.81 19.48C15.56 19.96 15.23 20.41 14.78 20.56C14.33 20.71 13.8 20.54 13.31 20.3C12.83 20.06 12.41 19.8 12 19.8C11.59 19.8 11.17 20.06 10.69 20.3C10.2 20.54 9.67 20.71 9.22 20.56C8.77 20.41 8.44 19.96 8.19 19.48C7.94 19 7.75 18.55 7.42 18.31C7.08 18.07 6.59 18.03 6.06 17.94C5.53 17.85 5 17.67 4.72 17.29C4.44 16.91 4.44 16.35 4.52 15.81C4.6 15.28 4.71 14.8 4.58 14.41C4.46 14.02 4.08 13.7 3.7 13.31C3.32 12.93 3 12.47 3 12C3 11.53 3.32 11.07 3.7 10.69C4.08 10.3 4.46 9.98 4.58 9.59C4.71 9.2 4.6 8.72 4.52 8.19C4.44 7.65 4.44 7.09 4.72 6.71C5 6.33 5.53 6.15 6.06 6.06C6.59 5.97 7.08 5.93 7.42 5.69C7.75 5.45 7.94 5 8.19 4.52C8.44 4.04 8.77 3.59 9.22 3.44C9.67 3.29 10.2 3.46 10.69 3.7C11.17 3.94 11.59 4.2 12 4.2Z',
    'M8.8 12.3l2.2 2.2 4.3-4.6',
  ],
  /** Efectes: a speaker. */
  sound: ['M4 9h4l5-4v14l-5-4H4z', 'M17 9a4 4 0 0 1 0 6'],
  fanfare: ['M8 4h8v5a4 4 0 0 1-8 0z', 'M8 6H5a3 3 0 0 0 3 4', 'M16 6h3a3 3 0 0 1-3 4', 'M12 13v4', 'M8 20h8'],
  /** Auto-advance off: the auto arrows struck through. */
  autoOff: ['M19 8.5A8 8 0 0 0 5.5 7', 'M5 15.5A8 8 0 0 0 18.5 17', 'M5.5 3v4h4', 'M18.5 21v-4h-4', 'M4 4l16 16'],
  menu: ['M4 6h16', 'M4 12h16', 'M4 18h16'],
  close: ['M6 6l12 12', 'M18 6L6 18'],
  backspace: ['M21 5H8l-6 7 6 7h13z', 'M12 9l6 6', 'M18 9l-6 6'],
  check: ['M5 12.5l4.5 4.5L19 7'],
  cross: ['M6 6l12 12', 'M18 6L6 18'],
  /** «Seguides»: reveal in a row (two play heads). */
  seguides: ['M4 6l7 6-7 6z', 'M13 6l7 6-7 6z'],
  /** «Revisió manual»: a magnifier. */
  search: ['M10.5 4a6.5 6.5 0 1 0 0 13a6.5 6.5 0 1 0 0-13z', 'M15.5 15.5L21 21'],
  /** «Descarta el cartró»: a bin. */
  trash: ['M4 7h16', 'M9 7V4h6v3', 'M6 7l1 13h10l1-13', 'M10 11v6', 'M14 11v6'],
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
  /** «Des del principi» on the throw songs' strip: back to the start (Consola-Llancament-Tempesta). */
  restart: ['M4 12a8 8 0 1 0 2.4-5.7', 'M4 4v4.6h4.6'],
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
  /** The menu's groups (Consola-Menu): this device, the connections, plan B resume, the cheat sheet. */
  device: ['M7 3h10a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z', 'M11 18h2'],
  wifi: ['M2.5 9a14 14 0 0 1 19 0', 'M5.5 12.5a9.5 9.5 0 0 1 13 0', 'M8.6 16a5 5 0 0 1 6.8 0', 'M12 19.5h.01'],
  lifebuoy: ['M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z', 'M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8z', 'M5.6 5.6l3.6 3.6', 'M14.8 14.8l3.6 3.6', 'M18.4 5.6l-3.6 3.6', 'M9.2 14.8l-3.6 3.6'],
  keyboard: ['M3 7h18v10H3z', 'M7 11h.01', 'M11 11h.01', 'M15 11h.01', 'M8 14h8'],
  chevron: ['M9 6l6 6-6 6'],
  /** The Wii remote: its body, the cross, the A and the 1 and 2. */
  /** The Desgraciat round: a card still standing, and one that sat down (the Dempeus tab). */
  standing: ['M12 2.3a2.3 2.3 0 1 0 0 4.6a2.3 2.3 0 1 0 0-4.6z', 'M12 8v6.5', 'M12 14.5l-3 6.5', 'M12 14.5l3 6.5', 'M6.5 10.5L12 9l5.5 1.5'],
  seated: ['M10 2.3a2.3 2.3 0 1 0 0 4.6a2.3 2.3 0 1 0 0-4.6z', 'M10 8v6h6l1.5 6.5', 'M10 10.5l4.5 1.5', 'M5 12.5V21', 'M5 16.5h5'],
  remote: ['M9.5 2h5A2.5 2.5 0 0 1 17 4.5v15a2.5 2.5 0 0 1-2.5 2.5h-5A2.5 2.5 0 0 1 7 19.5v-15A2.5 2.5 0 0 1 9.5 2z', 'M12 4.8v3M10.5 6.3h3', fill('M10.6 11a1.4 1.4 0 1 0 2.8 0a1.4 1.4 0 1 0-2.8 0z'), 'M12 15.5v.01M12 18.5v.01'],
} as const satisfies Record<string, readonly IconPath[]>;

export type IconName = keyof typeof ICONS;

/** A path's `d`. */
export const pathOf = (p: IconPath): string => (typeof p === 'string' ? p : p.d);
/** A path's part class ("icon__fill", "icon__accent"), or undefined for a plain stroke. */
export const partClass = (p: IconPath): string | undefined => (typeof p === 'string' ? undefined : `icon__${p.part}`);
