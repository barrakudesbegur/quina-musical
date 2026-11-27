<!--
  C3 · Sheet: the phone's stacked drawers and the console's menu (components-v2.md § 4, with the 27 Nov comments' D-n:
  #67, #68). The native <dialog> shown modal, so the browser keeps focus inside, makes the page (and the sheets under
  this one) inert, sends Esc and the phone's back gesture as `cancel`, and returns the focus on close. `dismiss='any'`
  also closes it on a tap outside (`closedby`, with lightDismiss() where Safari lacks it); 'closerequest' only on Esc
  (the console's menu, U188 open).

  Motion (ANIMATIONS.md `drawer-open`, `drawer-drag`, `drawer-close`, `drawer-stack`, `menu-sheet`): it rises out of
  `origin` by a transition from @starting-style; it follows the finger on its title bar, or on its content pulled
  down from the top (sheet-drag.ts decides a flick, a pull past 30 %, or a spring back); every close (✕, ‹, Esc, the
  backdrop, a drag) first slides it to its closed place, then calls close(), then `onclose`.

  Props say what it draws: `title`, `subtitle`, `origin` (the corner or edge it grows from), `depth` ('under': another
  sheet lies over it), `back` (a ‹ that closes this one; `onback` makes ‹, Esc and the back gesture a step back
  inside it instead), `closeText` (the ✕ shows its label too: the console's «Tanca»), `dismiss`, `draggable`, and the
  `closeSound`. `canClose` may hold it open (the pad asks first, D28) and is handed the way to go on. ✕ finishes with
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
  import Icon from '../icons/Icon.svelte';
  import { touchPress } from '../sounds/touch.ts';
  import { closeDuration, contentGesture, dragOffset, pullShare, releaseCloses, releaseVelocity, type DragSample } from './sheet-drag.ts';
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
    back?: boolean;
    onback?: () => void;
    canClose?: (proceed: () => void) => boolean;
    onclose?: () => void;
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
    back = false,
    onback,
    canClose,
    onclose,
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
  let dialog: HTMLDialogElement | undefined = $state();
  let body: HTMLDivElement | undefined = $state();
  let closing = $state<'self' | 'all' | null>(null);
  /** The entry has finished: a let-go springs back in its own (shorter) time. */
  let risen = $state(false);
  let offset = $state(0);
  let height = $state(1);
  let outMs = $state<number | null>(null);
  let drag: { y0: number; samples: DragSample[] } | null = null;
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

  $effect(() => (dialog && dismiss === 'any' ? lightDismiss(dialog, () => request('self')) : undefined));

  /** A close the player asked for (✕, ‹, Esc, the backdrop, a drag): the content may hold it open first. */
  function request(which: 'self' | 'all', fromDrag: number | null = null): void {
    if (closing) return;
    outMs = fromDrag;
    if (canClose && !canClose(() => void leave(which, true))) {
      offset = 0;
      outMs = null;
      return;
    }
    void leave(which, true);
  }

  /** Slides it to its closed place, then closes the dialog, then tells the owner. */
  async function leave(which: 'self' | 'all', heard: boolean): Promise<void> {
    if (closing || !dialog) return;
    closing = which;
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
    await settled(dialog);
    finish('self');
  }

  // ---- the drag (sheet-drag.ts; ANIMATIONS.md drawer-drag) -------------------------------------------------------
  function begin(y: number, t: number): void {
    if (!dialog) return;
    height = dialog.offsetHeight || 1;
    drag = { y0: y, samples: [{ y, t }] };
  }

  function move(y: number, t: number): void {
    if (!drag) return;
    drag.samples.push({ y, t });
    if (drag.samples.length > 12) drag.samples.shift();
    if (Math.abs(y - drag.y0) > 2) dragging = true;
    offset = dragOffset(y - drag.y0);
  }

  function end(): void {
    if (!drag) return;
    const v = releaseVelocity(drag.samples);
    drag = null;
    dragging = false;
    if (releaseCloses(offset, height, v)) {
      request('self', closeDuration(offset, height, v));
    } else offset = 0;
  }

  function onBarDown(e: PointerEvent): void {
    if (!canDrag || e.button !== 0 || (e.target as Element).closest('button')) return;
    begin(e.clientY, e.timeStamp);
    (e.currentTarget as Element).setPointerCapture(e.pointerId);
  }

  const onBarMove = (e: PointerEvent): void => move(e.clientY, e.timeStamp);

  // The content: a touch pulling down while it's scrolled to its top drags the sheet; anything else is its own scroll.
  // Non-passive, so the drag can stop the browser's scroll (touch events: a pointer would be cancelled by the pan).
  $effect(() => {
    const el = body;
    if (!el) return;
    let start: { x: number; y: number; mode: 'drag' | 'scroll' | null } | null = null;
    const down = (e: TouchEvent): void => {
      const touch = e.touches[0];
      start = canDrag && e.touches.length === 1 && touch ? { x: touch.clientX, y: touch.clientY, mode: null } : null;
    };
    const moveTouch = (e: TouchEvent): void => {
      const touch = e.touches[0];
      if (!start || !touch) return;
      if (start.mode === null) {
        start.mode = contentGesture(touch.clientY - start.y, touch.clientX - start.x, el.scrollTop);
        if (start.mode === 'drag') begin(touch.clientY, e.timeStamp);
      }
      if (start.mode !== 'drag') return;
      e.preventDefault();
      move(touch.clientY, e.timeStamp);
    };
    const up = (): void => {
      if (start?.mode === 'drag') end();
      start = null;
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
  data-dragging={dragging || undefined}
  data-settled={risen || undefined}
  data-anim={hook}
  style:--sheet-offset="{offset}px"
  style:--sheet-pull={pullShare(offset, height)}
  style:--sheet-out-drag={outMs === null ? undefined : `${outMs}ms`}
  aria-labelledby="{uid}-title"
  oncancel={(e) => {
    e.preventDefault();
    if (onback) onback();
    else request('self');
  }}
  onclose={onNativeClose}
>
  <div class="sheet__bar" role="presentation" onpointerdown={onBarDown} onpointermove={onBarMove} onpointerup={end} onpointercancel={end}>
    {#if draggable}<span class="sheet__handle" aria-hidden="true"></span>{/if}
    {#if onback || back}
      <button
        type="button"
        class="sheet__corner sheet__back ds-pushable"
        aria-label={backLabel}
        data-touch="small"
        data-touch-release={onback ? undefined : 'none'}
        onclick={() => (onback ? onback() : request('self'))}
      >
        <span class="ds-piece"><Icon name="chevron-left" alone /></span>
      </button>
    {/if}
    <h1 class="sheet__title" id="{uid}-title">{title}</h1>
    {#if subtitle}<span class="sheet__subtitle">{subtitle}</span>{/if}
    <button
      type="button"
      class="sheet__corner sheet__close ds-pushable"
      aria-label={closeText ? undefined : closeLabel}
      data-touch="small"
      data-touch-release="none"
      onclick={() => request(closeAll ? 'all' : 'self')}
    >
      <span class="ds-piece"><Icon name="close" alone={!closeText} />{#if closeText}<span class="sheet__corner-text">{closeLabel}</span>{/if}</span>
    </button>
  </div>
  <div class="sheet__body" bind:this={body}>
    {@render children()}
  </div>
  {#if footer}<div class="sheet__footer">{@render footer()}</div>{/if}
</dialog>
