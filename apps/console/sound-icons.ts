// The sound pad's icons: the user wants icons on the Efectes pads, no words (the canvas, 2026-11-24; board
// "Consola · Efectes amb icones", where the word version stays for reference). Each pad's name is still its
// accessible name and its tooltip. Drawn on a 24×24 grid like icons.ts, but in several colours: every shape
// names a tone by the palette's colour names (D210), and console.css maps each tone to a token (`.sound-icon__…`), so a
// theme can recolour them. No LED strip (D-l: the colour bar meant nothing). Pure data.
import type { SoundName } from '@quina/protocol';

/** A colour role, mapped to a token in console.css. */
export type SoundTone =
  | 'ink' | 'paper' | 'gold' | 'goldLight' | 'orange' | 'red' | 'green' | 'cyan' | 'cyanLight' | 'purple' | 'pink' | 'slate';

export interface SoundShape {
  tag: 'path' | 'circle' | 'rect' | 'ellipse';
  /** Its geometry attributes, as in SVG. */
  geo: Readonly<Record<string, string | number>>;
  /** Filled with this tone; none when absent. */
  fill?: SoundTone;
  /** Outlined with this tone, or not outlined. */
  stroke: SoundTone | null;
  /** The outline's width, when not the default 2.2. */
  strokeWidth?: number;
}

export interface SoundIcon {
  shapes: readonly SoundShape[];
}

/** The default outline width on the 24×24 grid. */
export const SOUND_STROKE = 2.2;

export const SOUND_ICONS: Readonly<Record<SoundName, SoundIcon>> = {
  'mkwii-final-lap': {
    shapes: [
      { tag: 'path', geo: { d: "M5 21V3.5" }, stroke: 'ink', strokeWidth: 2.4 },
      { tag: 'rect', geo: { x: 5, y: 4, width: 15, height: 10 }, fill: 'paper', stroke: 'ink', strokeWidth: 2 },
      { tag: 'path', geo: { d: "M5 4h3.75v2.5H5zM12.5 4h3.75v2.5H12.5zM8.75 6.5h3.75V9H8.75zM16.25 6.5H20V9h-3.75zM5 9h3.75v2.5H5zM12.5 9h3.75v2.5H12.5zM8.75 11.5h3.75V14H8.75zM16.25 11.5H20V14h-3.75z" }, fill: 'ink', stroke: null },
    ],
  },
  'mkwii-mission-clear': {
    shapes: [
      { tag: 'path', geo: { d: "M7 4h10v5a5 5 0 0 1-10 0z" }, fill: 'paper', stroke: 'ink' },
      { tag: 'path', geo: { d: "M7 6H4a3 3 0 0 0 3 4M17 6h3a3 3 0 0 1-3 4M12 14v3M8 21h8M9 17.5h6V21H9z" }, stroke: 'ink' },
    ],
  },
  'mkwii-mission-failure': {
    shapes: [
      { tag: 'path', geo: { d: "M7 4h10v5a5 5 0 0 1-10 0z" }, fill: 'paper', stroke: 'ink' },
      { tag: 'path', geo: { d: "M7 6H4a3 3 0 0 0 3 4M17 6h3a3 3 0 0 1-3 4M12 14v3M8 21h8M9 17.5h6V21H9z" }, stroke: 'ink' },
      { tag: 'path', geo: { d: "M11 4l1.6 3-2 2 1.4 3" }, stroke: 'red', strokeWidth: 2 },
    ],
  },
  'mkwii-low-place-fanfare': {
    shapes: [
      { tag: 'path', geo: { d: "M3 20h18M4 20v-5h5v5M9 20V9h6v11M15 20v-7h5v7" }, fill: 'paper', stroke: 'ink' },
      { tag: 'path', geo: { d: "M17.5 16.5v1" }, stroke: 'ink' },
      { tag: 'path', geo: { d: "M12 12v2" }, stroke: 'ink' },
    ],
  },
  'among-us': {
    shapes: [
      { tag: 'path', geo: { d: "M7 20v-9a5 5 0 0 1 10 0v9h-3v-3h-4v3z" }, fill: 'red', stroke: 'ink' },
      { tag: 'rect', geo: { x: 11, y: 8, width: 7, height: 4, rx: 2 }, fill: 'cyanLight', stroke: 'ink' },
      { tag: 'path', geo: { d: "M7 12H5v5h2" }, stroke: 'ink' },
    ],
  },
  'anime-wow': {
    shapes: [
      { tag: 'path', geo: { d: "M12 2l1.8 5.2L19 9l-5.2 1.8L12 16l-1.8-5.2L5 9l5.2-1.8z" }, fill: 'gold', stroke: 'ink' },
      { tag: 'path', geo: { d: "M19 14l.9 2.1L22 17l-2.1.9L19 20l-.9-2.1L16 17l2.1-.9z" }, fill: 'paper', stroke: 'ink' },
    ],
  },
  'boom': {
    shapes: [
      { tag: 'path', geo: { d: "M12 2l2 5 5-2-2 5 5 2-5 2 2 5-5-2-2 5-2-5-5 2 2-5-5-2 5-2-2-5 5 2z" }, fill: 'orange', stroke: 'ink' },
    ],
  },
  'bum-bum-buaaa': {
    shapes: [
      { tag: 'ellipse', geo: { cx: 12, cy: 9, rx: 8, ry: 3 }, fill: 'paper', stroke: 'ink' },
      { tag: 'path', geo: { d: "M4 9v7c0 1.7 3.6 3 8 3s8-1.3 8-3V9M8 11.6v7M16 11.6v7M3 3l6 4.5M21 3l-6 4.5" }, stroke: 'ink' },
    ],
  },
  'buzzer': {
    shapes: [
      { tag: 'rect', geo: { x: 3, y: 14, width: 18, height: 6, rx: 2 }, fill: 'paper', stroke: 'ink' },
      { tag: 'path', geo: { d: "M6 14a6 6 0 0 1 12 0z" }, fill: 'red', stroke: 'ink' },
      { tag: 'path', geo: { d: "M9 4l1.5 2M15 4l-1.5 2M12 2.5v2.5" }, stroke: 'ink' },
    ],
  },
  'correct': {
    shapes: [
      { tag: 'circle', geo: { cx: 12, cy: 12, r: 9 }, fill: 'green', stroke: 'ink' },
      { tag: 'path', geo: { d: "M7.5 12.5l3 3 6-6.5" }, stroke: 'paper', strokeWidth: 2.6 },
    ],
  },
  'duck-quack': {
    shapes: [
      { tag: 'path', geo: { d: "M4 14c0 4 3 6 8 6s8-2 8-5c0-2-1.5-3-3-3h-3a4 4 0 1 0-6-3.5c0 1.5.7 2.6 1.6 3.3C6.5 12 4 12 4 14z" }, fill: 'gold', stroke: 'ink' },
      { tag: 'path', geo: { d: "M15 8.5h4l-2 2" }, fill: 'orange', stroke: 'ink' },
      { tag: 'circle', geo: { cx: 12.3, cy: 7.5, r: 0.9 }, fill: 'ink', stroke: null },
    ],
  },
  'fear-melody': {
    shapes: [
      { tag: 'path', geo: { d: "M5 21V10a7 7 0 0 1 14 0v11l-2.3-2-2.4 2-2.3-2-2.3 2-2.4-2z" }, fill: 'paper', stroke: 'ink' },
      { tag: 'circle', geo: { cx: 9.5, cy: 10, r: 1.2 }, fill: 'ink', stroke: null },
      { tag: 'circle', geo: { cx: 14.5, cy: 10, r: 1.2 }, fill: 'ink', stroke: null },
      { tag: 'ellipse', geo: { cx: 12, cy: 14.5, rx: 1.6, ry: 2 }, fill: 'ink', stroke: null },
    ],
  },
  'heaven': {
    shapes: [
      { tag: 'ellipse', geo: { cx: 12, cy: 6, rx: 6, ry: 2 }, stroke: 'gold', strokeWidth: 2.4 },
      { tag: 'path', geo: { d: "M12 10v11M6 12l-2.5 6M18 12l2.5 6M8.5 11l-1 8M15.5 11l1 8" }, stroke: 'gold', strokeWidth: 2 },
    ],
  },
  'horn': {
    shapes: [
      { tag: 'path', geo: { d: "M3 10v4h3l9 5V5L6 10z" }, fill: 'paper', stroke: 'ink' },
      { tag: 'path', geo: { d: "M18 8.5a4 4 0 0 1 0 7M20.5 6a7.5 7.5 0 0 1 0 12" }, stroke: 'ink' },
    ],
  },
  'metal-gear-alert': {
    shapes: [
      { tag: 'path', geo: { d: "M12 3l10 17H2z" }, fill: 'gold', stroke: 'ink' },
      { tag: 'path', geo: { d: "M12 9v5" }, stroke: 'ink', strokeWidth: 2.8 },
      { tag: 'circle', geo: { cx: 12, cy: 17, r: 1.3 }, fill: 'ink', stroke: null },
    ],
  },
  'orchestra-hit': {
    shapes: [
      { tag: 'path', geo: { d: "M9 18V5l11-2v13" }, stroke: 'ink' },
      { tag: 'circle', geo: { cx: 6, cy: 18, r: 3 }, fill: 'purple', stroke: 'ink' },
      { tag: 'circle', geo: { cx: 17, cy: 16, r: 3 }, fill: 'purple', stroke: 'ink' },
      { tag: 'path', geo: { d: "M2 4l2 1.5M2 9h2.5" }, stroke: 'ink' },
    ],
  },
  'sad-trombone': {
    shapes: [
      { tag: 'circle', geo: { cx: 12, cy: 12, r: 9 }, fill: 'gold', stroke: 'ink' },
      { tag: 'path', geo: { d: "M8.5 9.5v1.5M15.5 9.5v1.5" }, stroke: 'ink' },
      { tag: 'path', geo: { d: "M8 17c1.2-1.8 2.5-2.6 4-2.6s2.8.8 4 2.6" }, stroke: 'ink' },
      { tag: 'path', geo: { d: "M16 12.5c.6 1 .6 2 0 2.6" }, stroke: 'cyan', strokeWidth: 2 },
    ],
  },
  'spongebob-boowomp': {
    shapes: [
      { tag: 'rect', geo: { x: 5, y: 3, width: 14, height: 15, rx: 2 }, fill: 'goldLight', stroke: 'ink' },
      { tag: 'circle', geo: { cx: 9, cy: 8, r: 1.6 }, fill: 'paper', stroke: 'ink' },
      { tag: 'circle', geo: { cx: 15, cy: 8, r: 1.6 }, fill: 'paper', stroke: 'ink' },
      { tag: 'path', geo: { d: "M9 14c1.8-1.2 4.2-1.2 6 0" }, stroke: 'ink' },
      { tag: 'path', geo: { d: "M12 19v3M10 20.5l2 1.5 2-1.5" }, stroke: 'ink' },
    ],
  },
  'spongebob-fail': {
    shapes: [
      { tag: 'rect', geo: { x: 5, y: 3, width: 14, height: 15, rx: 2 }, fill: 'goldLight', stroke: 'ink' },
      { tag: 'path', geo: { d: "M7.8 6.8l2.4 2.4M10.2 6.8l-2.4 2.4M13.8 6.8l2.4 2.4M16.2 6.8l-2.4 2.4" }, stroke: 'ink' },
      { tag: 'path', geo: { d: "M9 14.5h6" }, stroke: 'ink' },
      { tag: 'path', geo: { d: "M8 18v3M16 18v3" }, stroke: 'ink' },
    ],
  },
  'tada': {
    shapes: [
      { tag: 'path', geo: { d: "M4 20l4-11 7 7z" }, fill: 'pink', stroke: 'ink' },
      { tag: 'path', geo: { d: "M13 4l1 2M18 3l-1 3M20 9l-3 1M15 8c1-1 2-1 3 0" }, stroke: 'ink' },
      { tag: 'circle', geo: { cx: 20.5, cy: 5, r: 1 }, fill: 'gold', stroke: null },
      { tag: 'circle', geo: { cx: 11, cy: 3, r: 1 }, fill: 'cyan', stroke: null },
    ],
  },
};
