// The installable app's updates (D222; apps/player/README.md "Updates and offline"). Registers the service worker
// (/player-sw.js, scope /, updateViaCache 'none', so the browser never takes the worker from its HTTP cache), asks
// the server for a new one when the page opens (the registration itself), when it comes back to the foreground or
// gets the focus, and every few minutes while on screen. A new worker installs and takes control by itself; this
// then reloads the page into the new code at the first quiet moment (logic/update-gate.ts), with no button to press.
//
// Only where the cloud serves the app, at the site's root over HTTPS: never in development, a demo, or the laptop's
// /player/ pages (a LAN page over plain http can't have a worker anyway).
import { PLAYER_CONFIG } from '../config.ts';
import { checkDue, isNewVersion, reloadVerdict, type ReloadMoment } from '../logic/update-gate.ts';

const CONFIG = PLAYER_CONFIG.update;

/** What the app is doing, for the reload's gate. */
export type AppMoment = Pick<ReloadMoment, 'drawers' | 'padTyping' | 'bigMoment'>;

export interface UpdateOptions {
  moment: () => AppMoment;
  /** Reload into the new version (tests may watch it instead). */
  reload?: () => void;
}

/** Is this page the cloud's player, at the site's root (not the laptop's /player/ pages)? */
export const servedAtRoot = (pathname: string): boolean => !pathname.startsWith(PLAYER_CONFIG.devBase);

const isEditable = (el: Element | null): boolean =>
  el instanceof HTMLTextAreaElement || el instanceof HTMLSelectElement || (el instanceof HTMLInputElement && !['button', 'checkbox', 'radio', 'submit'].includes(el.type)) || (el instanceof HTMLElement && el.isContentEditable);

/** Start following the app's updates. Never throws: without a worker the app works as a plain page. */
export async function watchUpdates({ moment, reload = () => location.reload() }: UpdateOptions): Promise<void> {
  if (!('serviceWorker' in navigator) || !window.isSecureContext || !servedAtRoot(location.pathname)) return;
  const workers = navigator.serviceWorker;
  let hadController = workers.controller !== null;
  let registration: ServiceWorkerRegistration;
  try {
    registration = await workers.register(CONFIG.worker, { scope: CONFIG.scope, updateViaCache: 'none' });
  } catch (error) {
    console.warn('player: the service worker did not register', error);
    return;
  }

  // ---- asking for a new version ------------------------------------------------------------------------------
  let lastCheck: number | null = Date.now(); // register() just asked
  const check = () => {
    const now = Date.now();
    if (!checkDue(lastCheck, now, CONFIG.minCheckGapMs)) return;
    lastCheck = now;
    registration.update().catch(() => {}); // offline: the next check will do
  };
  window.addEventListener('focus', check);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') return check();
    pointers.clear(); // no finger stays on a page in the background
    tryReload();
  });
  setInterval(() => {
    if (document.visibilityState === 'visible') check();
  }, CONFIG.checkEveryMs);

  // ---- what the person is doing ------------------------------------------------------------------------------
  let lastInput = performance.now();
  const pointers = new Set<number>();
  const touched = () => (lastInput = performance.now());
  const options = { capture: true, passive: true } as const;
  window.addEventListener('pointerdown', (e) => (pointers.add(e.pointerId), touched()), options);
  for (const type of ['pointerup', 'pointercancel'] as const) window.addEventListener(type, (e) => (pointers.delete(e.pointerId), touched()), options);
  for (const type of ['keydown', 'input', 'scroll', 'wheel'] as const) window.addEventListener(type, touched, options);

  // ---- reloading into it -------------------------------------------------------------------------------------
  let waiting = false;
  let reloading = false;
  let poll: ReturnType<typeof setInterval> | null = null;
  function tryReload(): void {
    if (!waiting || reloading) return;
    const verdict = reloadVerdict(
      {
        ...moment(),
        hidden: document.visibilityState === 'hidden',
        pressing: pointers.size > 0,
        editing: isEditable(document.activeElement),
        sinceInputMs: performance.now() - lastInput,
      },
      CONFIG.quietMs,
    );
    if (verdict !== 'now') return;
    reloading = true;
    if (poll) clearInterval(poll);
    reload();
  }
  workers.addEventListener('controllerchange', () => {
    const fresh = isNewVersion(hadController);
    hadController = true;
    if (!fresh || waiting) return;
    waiting = true;
    poll = setInterval(tryReload, CONFIG.reloadPollMs);
    tryReload();
  });
}
