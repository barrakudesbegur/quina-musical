// The Claim number pad: the digits typed so far, as a string. Pure.

export const PAD_DIGITS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'] as const;
export type PadDigit = (typeof PAD_DIGITS)[number];
export type PadKey = PadDigit | 'back' | 'clear';

export interface PadLimits {
  maxDigits: number;
  max: number;
}

const isDigit = (key: string): key is PadDigit => (PAD_DIGITS as readonly string[]).includes(key);

/** The digits after pressing `key`. No leading zero, at most `maxDigits`. */
export function padPress(digits: string, key: PadKey, { maxDigits }: PadLimits): string {
  if (key === 'clear') return '';
  if (key === 'back') return digits.slice(0, -1);
  if (digits.length >= maxDigits) return digits;
  if (key === '0' && digits === '') return digits;
  return digits + key;
}

/** The card number typed, or null when it isn't a valid one (1..max). */
export function padValue(digits: string, { max }: PadLimits): number | null {
  if (!/^[1-9][0-9]*$/.test(digits)) return null;
  const n = Number(digits);
  return n >= 1 && n <= max ? n : null;
}

/** A physical key as a pad key: digits, Backspace, Delete. Enter and Escape are the dialog's. */
export function padKeyFromKeyboard(key: string): PadKey | null {
  if (isDigit(key)) return key;
  if (key === 'Backspace') return 'back';
  if (key === 'Delete') return 'clear';
  return null;
}
