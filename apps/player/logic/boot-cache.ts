// The last public state this tab saw, kept in sessionStorage, so a reload opens on the show as it was a moment
// ago instead of flashing the before-the-night screen until the feed's first snapshot (the user, 27 Nov). It's the
// public feed's own data (nothing a phone couldn't already see), only for this tab, and only if recent: an older
// copy could show a round that has moved on, so the app waits for the feed instead. Pure: the store and the clock
// are passed in.
import type { PublicState } from '../feed/public.ts';
import type { StorageLike } from './storage.ts';

/** How old a saved state may be and still open the app (a reload, not yesterday's tab). */
export const BOOT_STATE_MAX_AGE_MS = 5 * 60_000;

interface Saved {
  edition: string;
  savedAtMs: number;
  state: PublicState;
}

export const bootKey = (edition: string): string => `quina-musical:${edition}:last-state`;

/** Keep the latest state for the next reload. A full or blocked store just skips it. */
export function saveBootState(store: StorageLike | null, edition: string, state: PublicState, nowMs: number): void {
  if (!store) return;
  try {
    store.setItem(bootKey(edition), JSON.stringify({ edition, savedAtMs: nowMs, state } satisfies Saved));
  } catch {
    // Quota or privacy mode: the next reload waits for the feed, as before.
  }
}

/** The saved state, if it's this edition's and recent enough; otherwise null (and a stale or broken copy is removed). */
export function loadBootState(store: StorageLike | null, edition: string, nowMs: number, maxAgeMs = BOOT_STATE_MAX_AGE_MS): PublicState | null {
  if (!store) return null;
  try {
    const raw = store.getItem(bootKey(edition));
    if (!raw) return null;
    const saved = JSON.parse(raw) as Partial<Saved> | null;
    const fresh =
      saved !== null &&
      typeof saved === 'object' &&
      saved.edition === edition &&
      typeof saved.savedAtMs === 'number' &&
      nowMs - saved.savedAtMs >= 0 &&
      nowMs - saved.savedAtMs <= maxAgeMs &&
      typeof saved.state === 'object' &&
      saved.state !== null &&
      typeof (saved.state as { scene?: unknown }).scene === 'string';
    if (fresh) return saved.state as PublicState;
    store.removeItem(bootKey(edition));
    return null;
  } catch {
    return null;
  }
}
