// Keep the screen on while the page is visible: a Screen Wake Lock, re-acquired when the page becomes visible
// again (the browser drops it when hidden). Feature-detected: without it (not a secure context, as the hotspot's
// plain http on an iPad; battery saver), the screen simply follows the device's own settings. Used by the player
// app, the console and the projector's stage (apps/stage/stage.ts, so the show page that mounts it too).

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
