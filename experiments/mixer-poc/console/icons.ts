// The console's icons: stroke-only SVG paths on a 24×24 grid, drawn in currentColor by Icon.svelte, so a
// theme recolours them with the text. Every icon sits next to a text label; they are decorative.

export const ICONS = {
  next: ['M5 5l10 7-10 7z', 'M19 5v14'],
  play: ['M7 4.5l12 7.5-12 7.5z'],
  hold: ['M12 3a3 3 0 0 1 3 3v6a3 3 0 0 1-6 0V6a3 3 0 0 1 3-3z', 'M19 11a7 7 0 0 1-14 0', 'M12 18v3'],
  suspense: ['M3 12h4l3-7 4 14 3-7h4'],
  back: ['M9 14L4 9l5-5', 'M4 9h11a5 5 0 0 1 0 10h-3'],
  claim: ['M4 4h16v16H4z', 'M8 12.5l3 3 5-6'],
  sound: ['M11 5L6 9H3v6h3l5 4z', 'M15.5 8.5a5 5 0 0 1 0 7', 'M18.5 5.5a9 9 0 0 1 0 13'],
  fanfare: ['M8 4h8v5a4 4 0 0 1-8 0z', 'M8 6H5a3 3 0 0 0 3 4', 'M16 6h3a3 3 0 0 1-3 4', 'M12 13v4', 'M8 20h8'],
  menu: ['M4 6h16', 'M4 12h16', 'M4 18h16'],
  close: ['M6 6l12 12', 'M18 6L6 18'],
  backspace: ['M21 5H8l-6 7 6 7h13z', 'M12 9l6 6', 'M18 9l-6 6'],
  check: ['M5 12.5l4.5 4.5L19 7'],
  cross: ['M6 6l12 12', 'M18 6L6 18'],
  eye: ['M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z', 'M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6z'],
  eyeOff: ['M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z', 'M3 3l18 18'],
  lock: ['M6 11h12v9H6z', 'M8 11V8a4 4 0 0 1 8 0v3'],
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
} as const satisfies Record<string, readonly string[]>;

export type IconName = keyof typeof ICONS;
