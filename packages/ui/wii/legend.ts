// The Wii remote's guide: what each button group does, in the order the drawing reads (top to bottom, then
// B on the side, with its Suspens rows), and each group's colour. The console's Comandament dialog, its badges and the
// printed cheat sheet all use it, so they say and colour the same thing. The mapping itself is the console's
// (apps/console/wii/mapping.ts); the D-pad's effects, the Enrere hold and the Suspens window come in from its config.
// Pure.
import { CA } from '../i18n/ca.ts';

export const WII_GROUPS = ['a', 'b', 'talk', 'back', 'home', 'dpad'] as const;
/** a: A · b: B (the trigger) · talk: − and + · back: 1 and 2 · home: HOME · dpad: the cross. */
export type WiiGroup = (typeof WII_GROUPS)[number];
export type WiiDpad = 'up' | 'right' | 'down' | 'left';

/** Each group's colour (the Consola-Comandament board), as a token with the board's value as fallback. */
export const WII_COLOURS: Readonly<Record<WiiGroup, string>> = {
  a: 'var(--color-orange, #ff8200)',
  b: 'var(--color-gold, #ffc531)',
  talk: 'var(--color-ice, #5cc8ff)',
  back: 'var(--color-red, #e8363d)',
  home: 'var(--color-green, #23a55a)',
  dpad: 'var(--color-lilac, #b57bff)',
};

/** One row of the guide. B has several (D144–D148): Aguanta, Suspens with A, the shake, and Suspens with manual advance. */
export type WiiLegendId = WiiGroup | 'bA' | 'shake' | 'bManual';

export interface WiiLegendItem {
  /** Unique per row. */
  id: WiiLegendId;
  group: WiiGroup;
  /** The button's own label, drawn in its coloured dot ("A", "− +"). */
  key: string;
  title: string;
  note: string;
  /** The note mentions the shake (a small wave is drawn next to it). */
  shake: boolean;
}

export interface WiiLegendInput {
  /** The display names of the D-pad's four effects. */
  dpad: Readonly<Record<WiiDpad, string>>;
  /** How long 1 or 2 must be held for Enrere. */
  backHoldMs: number;
  /** Entering Suspens: how many vibrations, over how long (the console's WII.suspenseWindow). */
  suspenseWindow: { windowMs: number; pulses: number };
}

/** "1,5": seconds with a decimal comma, without trailing zeros. */
export const secondsText = (ms: number): string => String(Math.round(ms / 100) / 10).replace('.', ',');

export function wiiLegend({ dpad, backHoldMs, suspenseWindow }: WiiLegendInput): WiiLegendItem[] {
  const t = CA.wii;
  const item = (id: WiiLegendId, group: WiiGroup, title: string, note: string, shake = false, key: string = t.keys[group]): WiiLegendItem => ({ id, group, key, title, note, shake });
  const window = secondsText(suspenseWindow.windowMs);
  return [
    item('a', 'a', t.a.title, t.a.note),
    item('b', 'b', t.b.title, t.b.note),
    item('bA', 'b', t.bA.title, t.bA.note(suspenseWindow.pulses, window), false, t.bA.key),
    item('shake', 'b', t.shake.title, t.shake.note, true),
    item('bManual', 'b', t.bManual.title, t.bManual.note(suspenseWindow.pulses, window)),
    item('talk', 'talk', t.talk.title, t.talk.note),
    item('back', 'back', t.back.title(secondsText(backHoldMs)), t.back.note),
    item('home', 'home', t.home.title, t.home.note),
    item('dpad', 'dpad', t.dpad.title, t.dpad.note(dpad)),
  ];
}
