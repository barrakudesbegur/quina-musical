// The generic components name the remote's keys (`wii: { keys: ['minus', 'plus'], hold: true }`, B5); the console's
// WiiBadge still draws them by its groups ('talk' for − and +, 'back' for 1 and 2). This maps one to the other, until
// WiiKey moves into packages/ui. Pure.
import type { WiiKey } from '../../../packages/ui/components/types.ts';
import type { WiiDpad, WiiGroup } from '../../../packages/ui/wii/legend.ts';

export type WiiBadgeButton = Exclude<WiiGroup, 'dpad'> | WiiDpad | 'shake';

const PAIRS: Readonly<Record<string, WiiBadgeButton>> = {
  'minus+plus': 'talk',
  'one+two': 'back',
};

/** The badge that draws these keys, or null when it has no drawing for them. */
export function wiiBadgeButton(keys: readonly WiiKey[]): WiiBadgeButton | null {
  if (keys.length === 2) return PAIRS[[...keys].sort().join('+')] ?? null;
  if (keys.length !== 1) return null;
  const [key] = keys;
  switch (key) {
    case 'a':
    case 'b':
    case 'home':
    case 'up':
    case 'down':
    case 'left':
    case 'right':
    case 'shake':
      return key;
    default:
      return null;
  }
}
