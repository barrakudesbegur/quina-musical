<!--
  C3 · Sheet: the phone's stacked drawers and the console's menu (components-v2.md § 4, with the 27 Nov comments' D-n:
  #67, #68). The native <dialog> shown modal, so the browser keeps focus inside, makes the page (and the sheets under
  this one) inert, sends Esc and the phone's back gesture as `cancel`, and returns the focus on close. `dismiss='any'`
  also closes it on a tap outside (`closedby`, with lightDismiss() where Safari lacks it: the drawers and the console's
  menu); 'closerequest' only on Esc.

  Motion (ANIMATIONS.md `drawer-open`, `drawer-drag`, `drawer-close`, `drawer-stack`, `menu-sheet`): it rises out of
  `origin` by a transition from @starting-style; it follows the finger on its title bar, or on its content pulled
  down from the top (sheet-drag.ts decides a flick, a pull past 30 %, or a spring back); every close (✕, ‹, Esc, the
  backdrop, a drag) first slides it to its closed place, then calls close(), then `onclose`.

  Props say what it draws: `title`, `subtitle`, `origin` (the corner or edge it grows from), `depth` ('under': another
  sheet lies over it), `back` (a ‹ that closes this one; `onback` makes ‹, Esc and the back gesture a step back
  inside it instead), `closeText` (the ✕ shows its label too: the console's «Tanca»), `dismiss`, `draggable`, `drag`
  ('free', or 'stiff' for a sheet that holds a form: a strong rubber band and a long pull to close, §8 Y3), and the
  `closeSound`. A touch that starts inside `[data-own-gesture]` (a list's grip) is never the sheet's drag. `canClose` may hold it open (the pad asks first, D28) and is handed the way to go on. ✕ finishes with
  `closeAll` when given (a stacked drawer's ✕ closes them all). Slots: `children` (scrolls), `footer` (sticky, D188).
  The app's own closes (after «Desar», a Celebration) unmount it: silent and at once, as ANIMATIONS.md says.
-->
<script lang="ts" module>
  /** Where a sheet grows from: a corner button's corner, the bottom edge, or (the console's menu) the right edge. */
  export type SheetOrigin = 'bottom' | 'left' | 'right' | 'side-right';
</script>

<script lang="ts">
  import { tick, untrack, type Snippet } from 'svelte';
  import type { HTMLDialogAttributes } from 'svelte/elements';
  import IconButton from './IconButton.svelte';
  import MiniButton from './MiniButton.svelte';
  import { touchPress } from '../sounds/touch.ts';
  import {
    barAxis,
    closeDuration,
    contentGesture,
    dragOffset,
    handsOver,
    pullShare,
    releaseCloses,
    releaseVelocity,
    stiffOffset,
    stiffReleaseCloses,
    type DragSample,
  } from './sheet-drag.ts';
  import { lightDismiss, settled } from './top-layer.ts';
  import type { UiSound } from './types.ts';
  import './sheet.css';

  type Props = Omit<HTMLDialogAttributes, 'title' | 'children' | 'class' | 'open'> & {
    title: string;
    subtitle?: string | null;
    origin?: SheetOrigin;
    depth?: 'top' | 'under';
    /** Shown while true; set it false to close it with its motion (bindable). */
    open?: boolean;
    dismiss?: 'any' | 'closerequest';
    /** Drags to close (the phone's sheets); the side sheet never does. */
    draggable?: boolean;
    /** How the drag feels: 'free' (follows the finger), 'stiff' (a form: a rubber band, a long pull closes it). */
    drag?: 'free' | 'stiff';
    back?: boolean;
    onback?: () => void;
    canClose?: (proceed: () => void) => boolean;
    onclose?: () => void;
    /** Its exit starts (the one under it may step forward meanwhile: drawer-stack). */
    onleave?: (which: 'self' | 'all') => void;
    closeAll?: (() => void) | null;
    closeLabel: string;
    backLabel?: string;
    closeText?: boolean;
    closeSound?: UiSound | null;
    class?: string;
    children: Snippet;
    footer?: Snippet;
  };

  let {
    title,
    subtitle = null,
    origin = 'bottom',
    depth = 'top',
    open = $bindable(true),
    dismiss = 'any',
    draggable = origin !== 'side-right',
    drag: dragFeel = 'free',
    back = false,
    onback,
    canClose,
    onclose,
    onleave,
    closeAll = null,
    closeLabel,
    backLabel = '',
    closeText = false,
    closeSound = 'drawerClose',
    class: className = '',
    children,
    footer,
    ...rest
  }: Props = $props();

  const uid = $props.id();
  /** The ‹ and ✕ (IconButton, A7): navy on the phone's sheet, the surface on the console's side sheet. */
  const cornerColor = $derived(origin === 'side-right' ? 'surface' : 'navy');
  const cornerSize = $derived(origin === 'side-right' ? 's' : 'm');
  let dialog: HTMLDialogElement | undefined = $state();
  let body: HTMLDivElement | undefined = $state();
  let closing = $state<'self' | 'all' | null>(null);
  /** The entry has finished: from then on its moves take the stack's time (drawer-stack), not the rise's. */
  let risen = $state(false);
  /** Let go without closing: it springs back to rest in the spring's own time (drawer-drag). */
  let springing = $state(false);
  let offset = $state(0);
  let height = $state(1);
  let outMs = $state<number | null>(null);
  let drag: { y0: number; samples: DragSample[]; raw: number } | null = null;
  let dragging = $state(false);
  const canDrag = $derived(draggable && depth === 'top' && closing === null);

  $effect(() => {
    if (!dialog) return;
    if (open && !dialog.open) {
      closing = null;
      offset = 0;
      outMs = null;
      risen = false;
      dialog.showModal();
      const shown = dialog;
      void settled(shown).then(() => {
        if (shown.open) risen = true;
      });
    } else if (!open && dialog.open && !closing) {
      untrack(() => void leave('self', false));
    }
  });

  $effect(() => (dialog && dismiss === 'any' ? lightDismiss(dialog, () => requestClose('self')) : undefined));

  /**
   * A close the player asked for (✕, ‹, Esc, the backdrop, a drag): the content may hold it open first. `all` finishes
   * with `closeAll`. Exported, so a sheet opened from this one's content can ask it to close too (its ✕).
   */
  export function requestClose(which: 'self' | 'all', fromDrag: number | null = null): void {
    if (closing) return;
    outMs = fromDrag;
    if (canClose && !canClose(() => void leave(which, true))) {
      springBack();
      outMs = null;
      return;
    }
    void leave(which, true);
  }

  /** Slides it to its closed place, then closes the dialog, then tells the owner. */
  async function leave(which: 'self' | 'all', heard: boolean): Promise<void> {
    if (closing || !dialog) return;
    closing = which;
    onleave?.(which);
    // The close's sound as it starts to slide (not for the app's own closes).
    if (heard && closeSound) touchPress(closeSound);
    const shown = dialog;
    await tick();
    await settled(shown);
    if (shown.open) shown.close();
    finish(which);
  }

  function finish(which: 'self' | 'all'): void {
    open = false;
    if (which === 'all' && closeAll) closeAll();
    else onclose?.();
  }

  /** The browser closed it by itself (a second Esc it wouldn't let us hold): it still leaves with its motion. */
  async function onNativeClose(): Promise<void> {
    if (closing || !dialog) return;
    closing = 'self';
    onleave?.('self');
    await settled(dialog);
    finish('self');
  }

  // ---- the drag (sheet-drag.ts; ANIMATIONS.md drawer-drag) -------------------------------------------------------
  function begin(y: number, t: number): void {
    if (!dialog) return;
    height = dialog.offsetHeight || 1;
    springing = false;
    drag = { y0: y, samples: [{ y, t }], raw: 0 };
  }

  /** Follows the finger; `band`: above its rest it resists (the title bar) rather than stopping at it. */
  function move(y: number, t: number, band = true): void {
    if (!drag) return;
    drag.samples.push({ y, t });
    if (drag.samples.length > 12) drag.samples.shift();
    if (Math.abs(y - drag.y0) > 2) dragging = true;
    drag.raw = band ? y - drag.y0 : Math.max(0, y - drag.y0);
    offset = dragFeel === 'stiff' ? stiffOffset(drag.raw, height) : band ? dragOffset(drag.raw) : drag.raw;
  }

  function end(): void {
    if (!drag) return;
    const v = releaseVelocity(drag.samples);
    const closes = dragFeel === 'stiff' ? stiffReleaseCloses(drag.raw, height) : releaseCloses(offset, height, v);
    drag = null;
    dragging = false;
    if (closes) requestClose('self', closeDuration(offset, height, v));
    else springBack();
  }

  function springBack(): void {
    if (offset === 0) return;
    springing = true;
    offset = 0;
    if (dialog) void settled(dialog).then(() => (springing = false));
  }

  // The title bar (a finger or the mouse): the axis locks after a few px; sideways is never a drag.
  let barStart: { x: number; y: number; t: number } | null = null;

  function onBarDown(e: PointerEvent): void {
    if (!canDrag || e.button !== 0 || (e.target as Element).closest('button')) return;
    barStart = { x: e.clientX, y: e.clientY, t: e.timeStamp };
    (e.currentTarget as Element).setPointerCapture(e.pointerId);
  }

  function onBarMove(e: PointerEvent): void {
    if (barStart) {
      const axis = barAxis(e.clientY - barStart.y, e.clientX - barStart.x);
      if (axis === null) return;
      const from = barStart;
      barStart = null;
      if (axis === 'x') return;
      begin(from.y, from.t);
    }
    move(e.clientY, e.timeStamp);
  }

  function onBarUp(): void {
    barStart = null;
    end();
  }

  // The content (a touch): pulling down while it's scrolled to its top drags the sheet; anything else is its own
  // scroll. The two hand over within one gesture: a scroll back up that reaches the top and goes on pulling becomes the
  // drag, and the sheet pushed back up past its rest scrolls the content again (by hand: the browser won't resume a
  // scroll whose moves were taken). Non-passive, so the drag can keep the browser from scrolling.
  $effect(() => {
    const el = body;
    if (!el) return;
    let touch: { x: number; y: number; lastY: number; mode: 'drag' | 'scroll' | 'by-hand' | null } | null = null;
    const down = (e: TouchEvent): void => {
      const t = e.touches[0];
      // A control with a drag of its own (a list's grip, card-reorder) keeps the whole gesture (§8 Y3).
      const own = e.target instanceof Element && e.target.closest('[data-own-gesture]') !== null;
      touch = canDrag && !own && e.touches.length === 1 && t ? { x: t.clientX, y: t.clientY, lastY: t.clientY, mode: null } : null;
    };
    const moveTouch = (e: TouchEvent): void => {
      const t = e.touches[0];
      if (!touch || !t) return;
      const y = t.clientY;
      const step = y - touch.lastY;
      touch.lastY = y;
      if (touch.mode === null) {
        touch.mode = contentGesture(y - touch.y, t.clientX - touch.x, el.scrollTop);
        if (touch.mode === null) return;
        if (touch.mode === 'drag') begin(y, e.timeStamp);
      } else if (touch.mode !== 'drag' && handsOver(el.scrollTop, step)) {
        touch.mode = 'drag';
        begin(y, e.timeStamp);
      }
      if (touch.mode === 'scroll') return;
      if (e.cancelable) e.preventDefault();
      if (touch.mode === 'by-hand') {
        // A move the browser lets us take is scrolled by hand; one it won't (its own scroll is running) scrolls itself.
        if (e.cancelable) el.scrollTop -= step;
        return;
      }
      if (drag && y < drag.y0 && el.scrollHeight > el.clientHeight) {
        // Pushed back past its rest: the content scrolls again from here.
        drag = null;
        dragging = false;
        offset = 0;
        touch.mode = 'by-hand';
        return;
      }
      move(y, e.timeStamp, false);
      // The browser's own scroll is running (it took the gesture first): the content stays at its top while the sheet
      // moves, so the two never move at once.
      if (!e.cancelable) el.scrollTop = 0;
    };
    const up = (): void => {
      if (touch?.mode === 'drag') end();
      touch = null;
    };
    el.addEventListener('touchstart', down, { passive: true });
    el.addEventListener('touchmove', moveTouch, { passive: false });
    el.addEventListener('touchend', up);
    el.addEventListener('touchcancel', up);
    return () => {
      el.removeEventListener('touchstart', down);
      el.removeEventListener('touchmove', moveTouch);
      el.removeEventListener('touchend', up);
      el.removeEventListener('touchcancel', up);
    };
  });

  const hook = $derived(
    origin === 'side-right' ? 'menu-sheet' : closing ? 'drawer-close' : dragging ? 'drawer-drag' : depth === 'under' ? 'drawer-stack' : 'drawer-open',
  );
</script>

<dialog
  bind:this={dialog}
  {...rest}
  class="sheet {className}"
  {...{ closedby: dismiss }}
  data-origin={origin}
  data-depth={depth}
  data-state={closing ? 'closing' : 'open'}
  data-draggable={canDrag || undefined}
  data-drag={canDrag ? dragFeel : undefined}
  data-dragging={dragging || undefined}
  data-settled={risen || undefined}
  data-springing={springing || undefined}
  data-anim={hook}
  style:--sheet-offset="{offset}px"
  style:--sheet-pull={pullShare(offset, height)}
  style:--sheet-out-drag={outMs === null ? undefined : `${outMs}ms`}
  aria-labelledby="{uid}-title"
  oncancel={(e) => {
    e.preventDefault();
    if (onback) onback();
    else requestClose('self');
  }}
  onclose={onNativeClose}
>
  <div class="sheet__bar" role="presentation" onpointerdown={onBarDown} onpointermove={onBarMove} onpointerup={onBarUp} onpointercancel={onBarUp}>
    {#if draggable}<span class="sheet__handle" aria-hidden="true"></span>{/if}
    {#if onback || back}
      <IconButton
        class="sheet__corner sheet__back"
        icon="chevron-left"
        label={backLabel}
        color={cornerColor}
        size={cornerSize}
        data-touch-release={onback ? undefined : 'none'}
        onclick={() => (onback ? onback() : requestClose('self'))}
      />
    {/if}
    <h1 class="sheet__title" id="{uid}-title">{title}</h1>
    {#if subtitle}<span class="sheet__subtitle">{subtitle}</span>{/if}
    {#if closeText}
      <MiniButton class="sheet__corner sheet__close" icon="close" label={closeLabel} data-touch-release="none" onclick={() => requestClose(closeAll ? 'all' : 'self')} />
    {:else}
      <IconButton
        class="sheet__corner sheet__close"
        icon="close"
        label={closeLabel}
        color={cornerColor}
        size={cornerSize}
        data-touch-release="none"
        onclick={() => requestClose(closeAll ? 'all' : 'self')}
      />
    {/if}
  </div>
  <div class="sheet__body" bind:this={body}>
    {@render children()}
  </div>
  {#if footer}<div class="sheet__footer">{@render footer()}</div>{/if}
</dialog>
