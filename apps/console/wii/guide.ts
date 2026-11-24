// The remote's guide as this console maps it: the shared legend (packages/ui/wii/legend.ts) with the D-pad's
// effects and the Enrere hold from the console's config. The Comandament dialog and Admin's printed cheat
// sheet both read it, so the sheet always matches the remote. Pure.
import { wiiLegend, type WiiDpad, type WiiLegendItem } from '../../../packages/ui/wii/legend.ts';
import type { SoundName } from '@quina/protocol';
import { WII } from '../config.ts';
import { soundText } from '../strings.ts';

const DPAD: readonly WiiDpad[] = ['up', 'right', 'down', 'left'];

export function consoleWiiLegend(): WiiLegendItem[] {
  const dpad = Object.fromEntries(DPAD.map((d) => [d, soundText(WII.dpad[d])])) as Record<WiiDpad, string>;
  return wiiLegend({ dpad, backHoldMs: WII.backHoldMs });
}

/** The D-pad direction that plays a sound, if any (its pad on the SoundPad shows that arrow). */
export function dpadOf(name: SoundName): WiiDpad | null {
  return DPAD.find((d) => WII.dpad[d] === name) ?? null;
}
