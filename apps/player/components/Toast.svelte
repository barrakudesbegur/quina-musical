<script lang="ts">
  // A short notice just under the garland, the generic Toast (E3: a passing notice, not a control, §8 Y3) with its
  // preset (actions.ts › PLAYER_TOASTS). About a card (one a link added) it is green, with that card's mark; any other
  // is on paper. It drops in and fades out (ANIMATIONS.md `toast-drop`). The slot is the live region; the toast inside it says nothing by itself.
  import Toast from '../../../packages/ui/components/Toast.svelte';
  import { PLAYER_TOASTS } from '../actions.ts';
  import type { ToastNote } from '../model.svelte.ts';
  import CardMark from './CardMark.svelte';

  let { toast }: { toast: ToastNote | null } = $props();

  /** `toast-drop`'s exit: it fades out rising 6 px (only fading with reduced motion or Data Saver, D209). */
  function leave(node: Element) {
    const move = node.closest('[data-motion="full"]') !== null && !matchMedia('(prefers-reduced-motion: reduce)').matches;
    return { duration: 200, css: (t: number) => `opacity: ${t};${move ? ` translate: 0 ${(1 - t) * -6}px;` : ''}` };
  }
</script>

<div class="toast-slot" role="status" aria-live="polite" data-state={toast ? 'shown' : 'hidden'}>
  {#if toast}
    {@const identity = toast.identity}
    {#if identity !== null}
      {#snippet mark()}<CardMark {identity} decorative />{/snippet}
      <div class="toast-slot__note" out:leave><Toast {...PLAYER_TOASTS.card} role="none" data-anim="toast-drop" text={toast.text} {mark} /></div>
    {:else}
      <div class="toast-slot__note" out:leave><Toast {...PLAYER_TOASTS.info} role="none" data-anim="toast-drop" text={toast.text} /></div>
    {/if}
  {/if}
</div>
