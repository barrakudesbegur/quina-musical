// What a generic component draws with an app's own pieces: today the Wii key badge, the console's. The app provides
// it once at its root (`provideDs`), so packages/ui never imports an app. Until WiiKey (B5) lands in packages/ui, it is
// the console's WiiBadge behind one shape. (Icons need no provider: the one family is packages/ui/icons.)
import { createContext, type Component } from 'svelte';
import type { WiiKeySpec } from './types.ts';

/** Draws a control's Wii keys; it shows nothing while no remote is connected. */
export type WiiRenderer = Component<{ spec: WiiKeySpec }>;

export interface DsProviders {
  wii?: WiiRenderer;
}

const [getDs, setDs, hasDs] = createContext<DsProviders>();

/** Called once at an app's root (and the gallery's). */
export function provideDs(providers: DsProviders): void {
  setDs(providers);
}

/** The app's pieces, or none (a component then draws no Wii key). */
export function useDs(): DsProviders {
  return hasDs() ? getDs() : {};
}
