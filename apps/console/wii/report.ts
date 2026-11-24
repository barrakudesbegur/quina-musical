// A Wii Remote's input reports, parsed. Pure. Reports 0x30 (buttons) and 0x31 (buttons + accelerometer) are the
// two the console asks for; the first two bytes are the buttons in both, the next three the accelerometer's
// 8 high bits (x, y, z) in 0x31. Bit layout from the Wiimote's HID protocol (wiibrew.org).

export const WII_BUTTONS = ['left', 'right', 'down', 'up', 'plus', 'two', 'one', 'b', 'a', 'minus', 'home'] as const;
export type WiiButton = (typeof WII_BUTTONS)[number];

/** [byte index, bit mask] per button. */
const BITS: Record<WiiButton, readonly [number, number]> = {
  left: [0, 0x01],
  right: [0, 0x02],
  down: [0, 0x04],
  up: [0, 0x08],
  plus: [0, 0x10],
  two: [1, 0x01],
  one: [1, 0x02],
  b: [1, 0x04],
  a: [1, 0x08],
  minus: [1, 0x10],
  home: [1, 0x80],
};

export const REPORT = { buttons: 0x30, buttonsAccel: 0x31 } as const;

/** Acceleration in g on each axis (≈ 1 g on one axis at rest). */
export interface Accel {
  x: number;
  y: number;
  z: number;
}

export interface WiiReport {
  pressed: ReadonlySet<WiiButton>;
  accel: Accel | null;
}

export interface AccelCalibration {
  /** The raw value at 0 g. */
  zero: number;
  /** Raw counts per g. */
  perG: number;
}

/** A report's buttons (and acceleration, for 0x31), or null for a report this module doesn't read. */
export function parseReport(reportId: number, bytes: Uint8Array, cal: AccelCalibration): WiiReport | null {
  if ((reportId !== REPORT.buttons && reportId !== REPORT.buttonsAccel) || bytes.length < 2) return null;
  const pressed = new Set<WiiButton>();
  for (const b of WII_BUTTONS) {
    const [i, mask] = BITS[b];
    if (bytes[i] & mask) pressed.add(b);
  }
  const accel = reportId === REPORT.buttonsAccel && bytes.length >= 5 ? { x: (bytes[2] - cal.zero) / cal.perG, y: (bytes[3] - cal.zero) / cal.perG, z: (bytes[4] - cal.zero) / cal.perG } : null;
  return { pressed, accel };
}

/** Button edges between two reports. */
export function buttonChanges(before: ReadonlySet<WiiButton>, after: ReadonlySet<WiiButton>): { down: WiiButton[]; up: WiiButton[] } {
  return { down: WII_BUTTONS.filter((b) => after.has(b) && !before.has(b)), up: WII_BUTTONS.filter((b) => before.has(b) && !after.has(b)) };
}

export const magnitude = (a: Accel): number => Math.hypot(a.x, a.y, a.z);
