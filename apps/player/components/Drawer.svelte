<script lang="ts" module>
  // Where a drawer sits in the stack, set by App's DrawerFrame (logic/drawers.ts). A drawer opened inside another
  // drawer's content (the pad's leave question) sits on top of it.
  import type { DrawerOrigin } from '../logic/drawers.ts';
  export interface DrawerPlace {
    /** How many drawers lie over this one (0: it's the top one). */
    depth: number;
    /** Another drawer lies under this one: "‹" closes this one, ✕ closes them all. */
    stacked: boolean;
    origin: DrawerOrigin;
    closeAll: (() => void) | null;
  }
  export const DRAWER_PLACE = Symbol('drawer-place');
</script>

<script lang="ts">
  // A drawer (D73, D87: the J2 look) on the native <dialog>, shown modal, so focus stays inside, the drawers under it
  // and the home screen are inert, and Esc or the phone's back gesture ask it to close. The motion is
  // ANIMATIONS.md `drawer-open`, `drawer-drag`, `drawer-close` and `drawer-stack`: it opens from its corner or the
  // bottom edge, follows the finger when its handle or title bar is dragged down, and slides away when it closes.
  // `canClose` lets the content hold it open first (the pad asks before leaving with a number typed); it gets the
  // way to go on closing (the same "‹" or ✕), for when the player confirms.
  import { getContext, setContext, type Snippet } from 'svelte';
  import { dragCloses } from '../logic/drawers.ts';
  import { S } from '../strings.ts';
  import Icon from './Icon.svelte';

  let {
    title,
    name,
    onclose,
    canClose,
    onback,
    children,
  }: {
    title: string;
    name: string;
    onclose: () => void;
    canClose?: (proceed: () => void) => boolean;
    /** A step inside the drawer to go back from (the pad's camera, D141): "‹", Esc and the back gesture do this instead. */
    onback?: () => void;
    children: Snippet;
  } = $props();

  const outer = getContext<DrawerPlace | undefined>(DRAWER_PLACE);
  const place: DrawerPlace = outer ?? { depth: 0, stacked: false, origin: 'bottom', closeAll: null };
  // A drawer opened from this one's content lies over it.
  setContext<DrawerPlace>(DRAWER_PLACE, { depth: 0, stacked: true, origin: 'bottom', closeAll: null });

  let dialog: HTMLDialogElement | undefined = $state();
  let closing = $state<'top' | 'all' | null>(null);
  let dragY = $state(0);
  let dragging = $state(false);
  let drag: { id: number; y0: number; last: { y: number; t: number }; v: number } | null = null;

  $effect(() => {
    if (dialog && !dialog.open) dialog.showModal();
  });

  /** Close (the top one, or every drawer): asks the content first, then slides away, then tells the app. */
  function requestClose(which: 'top' | 'all'): void {
    if (closing) return;
    if (canClose && !canClose(() => slideAway(which))) {
      dragY = 0;
      return;
    }
    slideAway(which);
  }

  function slideAway(which: 'top' | 'all'): void {
    if (closing) return;
    closing = which;
    // No animation to wait for (reduced motion): close at once.
    if (!dialog || getComputedStyle(dialog).animationName === 'none') finish();
  }

  function finish(): void {
    if (closing === 'all' && place.closeAll) place.closeAll();
    else onclose();
  }

  function onAnimationEnd(e: AnimationEvent): void {
    if (e.target === dialog && closing) finish();
  }

  /** A tap on the backdrop (outside the drawer's box) closes it. */
  function onClick(e: MouseEvent): void {
    if (e.target !== dialog || !dialog) return;
    const r = dialog.getBoundingClientRect();
    if (e.clientY < r.top || e.clientX < r.left || e.clientX > r.right) requestClose('top');
  }

  function onPointerDown(e: PointerEvent): void {
    if (closing || place.depth > 0 || (e.target as Element).closest('button')) return;
    drag = { id: e.pointerId, y0: e.clientY, last: { y: e.clientY, t: e.timeStamp }, v: 0 };
    (e.currentTarget as Element).setPointerCapture(e.pointerId);
  }

  function onPointerMove(e: PointerEvent): void {
    if (!drag || e.pointerId !== drag.id) return;
    const dy = Math.max(0, e.clientY - drag.y0);
    const dt = e.timeStamp - drag.last.t;
    if (dt > 0) drag.v = (e.clientY - drag.last.y) / dt;
    drag.last = { y: e.clientY, t: e.timeStamp };
    if (dy > 2) dragging = true;
    dragY = dy;
  }

  function onPointerUp(e: PointerEvent): void {
    if (!drag || e.pointerId !== drag.id) return;
    const { v } = drag;
    drag = null;
    dragging = false;
    if (dialog && dragCloses(dragY, dialog.offsetHeight, v)) requestClose('top');
    else dragY = 0;
  }
</script>

<dialog
  class="drawer drawer--{name}"
  bind:this={dialog}
  data-origin={place.origin}
  data-depth={place.depth > 0 ? 'under' : 'top'}
  data-state={closing ? 'closing' : 'open'}
  data-dragging={dragging ? 'true' : undefined}
  style:--drag-y="{dragY}px"
  data-anim={closing ? 'drawer-close' : dragging ? 'drawer-drag' : 'drawer-open'}
  oncancel={(e) => {
    e.preventDefault();
    if (onback) onback();
    else requestClose('top');
  }}
  onclick={onClick}
  onanimationend={onAnimationEnd}
  aria-labelledby="drawer-title-{name}"
>
  <div class="drawer__top" role="presentation" onpointerdown={onPointerDown} onpointermove={onPointerMove} onpointerup={onPointerUp} onpointercancel={onPointerUp}>
    <span class="drawer__grab" aria-hidden="true"></span>
    <header class="drawer__header">
      {#if onback}
        <button type="button" class="drawer__button drawer__back" aria-label={S.back} onclick={onback}><Icon name="back" /></button>
      {:else if place.stacked}
        <button type="button" class="drawer__button drawer__back" aria-label={S.back} onclick={() => requestClose('top')}><Icon name="back" /></button>
      {/if}
      <h2 class="drawer__title" id="drawer-title-{name}">{title}</h2>
      <button type="button" class="drawer__button drawer__close" aria-label={S.close} onclick={() => requestClose(place.stacked && place.closeAll ? 'all' : 'top')}><Icon name="close" /></button>
    </header>
  </div>
  <div class="drawer__body">
    {@render children()}
  </div>
</dialog>
