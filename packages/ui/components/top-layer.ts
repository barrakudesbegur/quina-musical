// The native modal <dialog>'s plumbing that Sheet (C3) and Dialog (C4) share (modern-web-guidance: dialog,
// light-dismiss-a-dialog, animate-to-from-top-layer). The browser gives the rest: the top layer, the inert page, focus
// containment and its return, Esc and the back gesture (`cancel`), `::backdrop`.

/** Waits until the element's running transitions and animations (its subtree's too) have finished, at most `maxMs`. */
export async function settled(element: Element, maxMs = 800): Promise<void> {
  // The closing styles were just set: read them, so their transitions exist before they are listed.
  getComputedStyle(element).translate;
  const running = element.getAnimations({ subtree: true });
  if (!running.length) return;
  await Promise.race([Promise.allSettled(running.map((a) => a.finished)), new Promise((r) => setTimeout(r, maxMs))]);
}

/**
 * Light dismiss where `closedby="any"` is missing (Safari, D219's other browser): a press and its release both on the
 * backdrop, outside the dialog's box (the pointer's position, not the target: the dialog is the target for its own
 * padding too). Returns the cleanup. Where `closedby` exists the browser does it, and this adds nothing.
 */
export function lightDismiss(dialog: HTMLDialogElement, dismiss: () => void): () => void {
  if ('closedBy' in HTMLDialogElement.prototype) return () => {};
  const outside = (e: PointerEvent): boolean => {
    const r = dialog.getBoundingClientRect();
    return e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom;
  };
  let pressedOutside = false;
  const down = (e: PointerEvent): void => {
    pressedOutside = outside(e);
  };
  const up = (e: PointerEvent): void => {
    if (pressedOutside && outside(e)) dismiss();
    pressedOutside = false;
  };
  dialog.addEventListener('pointerdown', down);
  dialog.addEventListener('pointerup', up);
  return () => {
    dialog.removeEventListener('pointerdown', down);
    dialog.removeEventListener('pointerup', up);
  };
}
