// Browser niceties, each feature-detected so nothing depends on it:
// - a Screen Wake Lock, re-acquired when the page becomes visible again (the browser drops it when hidden);
// - vibration, only as a bonus (iPhone Safari has none);
// - motion preferences: reduced motion, and Data Saver on phones, both mean the still fallbacks.

/** Keep the screen on while the app is visible. Returns a function that stops it. */
export function keepScreenOn(): () => void {
  if (typeof navigator === 'undefined' || typeof document === 'undefined' || !('wakeLock' in navigator)) return () => {};
  let sentinel: WakeLockSentinel | null = null;
  let stopped = false;
  const request = async () => {
    if (stopped || sentinel || document.visibilityState !== 'visible') return;
    try {
      sentinel = await navigator.wakeLock.request('screen');
      sentinel.addEventListener('release', () => {
        sentinel = null;
      });
    } catch {
      // Refused (battery saver, not a secure context): the screen simply follows the phone's settings.
      sentinel = null;
    }
  };
  const onVisibility = () => void request();
  document.addEventListener('visibilitychange', onVisibility);
  void request();
  return () => {
    stopped = true;
    document.removeEventListener('visibilitychange', onVisibility);
    void sentinel?.release().catch(() => {});
    sentinel = null;
  };
}

/** A short vibration where supported (Android); a no-op elsewhere. */
export function vibrate(pattern: readonly number[]): void {
  try {
    if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') navigator.vibrate([...pattern]);
  } catch {
    // not allowed without a user gesture on some browsers
  }
}

type ConnectionInfo = EventTarget & { saveData?: boolean };

/** Reduced motion or Data Saver. Calls `onChange` when either changes; returns the current value and a stop. */
export function watchReducedMotion(onChange: (reduced: boolean) => void): { reduced: boolean; stop: () => void } {
  if (typeof window === 'undefined') return { reduced: false, stop: () => {} };
  const query = typeof window.matchMedia === 'function' ? window.matchMedia('(prefers-reduced-motion: reduce)') : null;
  const connection = (navigator as Navigator & { connection?: ConnectionInfo }).connection ?? null;
  const read = () => Boolean(query?.matches) || Boolean(connection?.saveData);
  const update = () => onChange(read());
  query?.addEventListener?.('change', update);
  connection?.addEventListener?.('change', update);
  return {
    reduced: read(),
    stop: () => {
      query?.removeEventListener?.('change', update);
      connection?.removeEventListener?.('change', update);
    },
  };
}
