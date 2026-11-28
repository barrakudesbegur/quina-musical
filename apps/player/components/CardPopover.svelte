<script lang="ts">
  // A collapsed card opened (D289, board Mobil-Plegats-A-Graella ⑤): the whole card (CardPanel, the normal grid: never
  // «LÍNIA!» or «QUINA!») over the dimmed home. The native <dialog> shown modal (modern-web-guidance: dialog,
  // light-dismiss-a-dialog, platform-controls-dismiss-dialog): the top layer, the page inert, the focus kept inside and
  // given back to the tile; a tap outside (`closedby="any"`, Safari: lightDismiss), Esc and the phone's Back close it.
  // It stays open while songs land, so a player watching a card never loses it (the card updates in place).
  // Motion (ANIMATIONS.md `tile-open`, `tile-peek`): it grows out of its tile and shrinks back into it (transform and
  // opacity, WAAPI, from the tile's box); `peek` opens it by itself with a closing countdown (a ring that empties over
  // the hold, and «Es tanca»), which a touch on the card stops. Reduced motion: a fade, and never a peek.
  import { onMount } from 'svelte';
  import { lightDismiss } from '../../../packages/ui/components/top-layer.ts';
  import { touchRelease } from '../../../packages/ui/sounds/touch.ts';
  import { PLAYER_CONFIG } from '../config.ts';
  import { inStep } from '../device/in-step.ts';
  import type { PlayerApp } from '../model.svelte.ts';
  import { standUpPlace } from '../logic/desgraciat.ts';
  import { S } from '../strings.ts';
  import CardPanel from './CardPanel.svelte';

  let {
    app,
    cardId,
    origin,
    peek = false,
    onclosed,
  }: {
    app: PlayerApp;
    cardId: number;
    /** The tile it opens out of (and closes back into). */
    origin: HTMLElement | null;
    /** It opened by itself (`tile-peek`): it closes by itself after the hold, unless touched. */
    peek?: boolean;
    /** It has closed: `byItself` when the peek's countdown ran out. */
    onclosed: (byItself: boolean) => void;
  } = $props();

  let dialog: HTMLDialogElement | undefined = $state();
  let card: HTMLElement | undefined = $state();
  /** The peek's countdown runs (until a touch on the card, or the end). */
  let counting = $state(false);
  let closing = false;
  let timer: ReturnType<typeof setTimeout> | undefined;

  const index = $derived(app.playingViews.findIndex((v) => v.saved.id === cardId));
  const view = $derived(index >= 0 ? app.playingViews[index] : null);
  const playing = $derived(app.scene === 'play' && !app.paused ? (app.latest?.songId ?? null) : null);
  const ease = 'cubic-bezier(0.2, 0.8, 0.2, 1)';

  /** The tile's box as a transform of the card's: the card starts (or ends) there, at the tile's width. */
  function fromTile(): Keyframe | null {
    if (!origin || !card) return null;
    const a = origin.getBoundingClientRect();
    const b = card.getBoundingClientRect();
    if (!b.width) return null;
    const s = a.width / b.width;
    return { transform: `translate(${a.left - b.left}px, ${a.top - b.top}px) scale(${s})`, opacity: 0.35 };
  }

  onMount(() => {
    if (!dialog) return;
    dialog.showModal();
    // The focus rests on the card (its close button is the first stop for a keyboard or a screen reader).
    card?.focus({ preventScroll: true });
    touchRelease('drawerOpen');
    if (!app.reducedMotion) {
      const from = fromTile();
      if (from && card) card.animate([{ ...from, transformOrigin: '0 0' }, { transform: 'none', opacity: 1, transformOrigin: '0 0' }], { duration: PLAYER_CONFIG.tileOpenMs, easing: ease });
    }
    if (peek) {
      counting = true;
      timer = setTimeout(() => void close(true), PLAYER_CONFIG.tileOpenMs + PLAYER_CONFIG.peekHoldMs);
    }
    const undoDismiss = lightDismiss(dialog, () => void close(false));
    // Its playing song's dashes in step with the tiles' under it (`cell-playing`).
    const el = dialog;
    requestAnimationFrame(() => inStep(el));
    return () => {
      clearTimeout(timer);
      undoDismiss();
    };
  });

  /** Shrink back into the tile (a fade with reduced motion), then close and say so. */
  async function close(byItself: boolean): Promise<void> {
    if (closing || !dialog) return;
    closing = true;
    clearTimeout(timer);
    counting = false;
    if (!byItself) touchRelease('drawerClose');
    dialog.dataset.state = 'closing';
    const to = app.reducedMotion ? { opacity: 0 } : fromTile();
    if (card && to) {
      const anim = card.animate([{ transform: 'none', opacity: 1, transformOrigin: '0 0' }, { ...to, opacity: 0, transformOrigin: '0 0' }], {
        duration: PLAYER_CONFIG.tileCloseMs,
        easing: 'cubic-bezier(0.4, 0, 1, 1)',
        fill: 'forwards',
      });
      await anim.finished.catch(() => undefined);
    }
    dialog.close();
    onclosed(byItself);
  }

  /** A touch on the card stops the peek's countdown: the player is looking at it. */
  function hold(): void {
    if (!counting) return;
    clearTimeout(timer);
    counting = false;
  }

  // A new song playing: its dashes join the tiles' step.
  $effect(() => {
    void playing;
    const el = dialog;
    if (!el) return;
    const raf = requestAnimationFrame(() => inStep(el));
    return () => cancelAnimationFrame(raf);
  });

  // The card leaves the round's playing cards (a round of another type starts): nothing to show.
  $effect(() => {
    if (!view) void close(false);
  });
</script>

<dialog
  class="card-pop"
  bind:this={dialog}
  aria-label={view ? (view.saved.name ?? S.cardNumber(view.saved.id)) : undefined}
  {...{ closedby: 'any' }}
  data-anim="tile-open"
  oncancel={(e) => {
    e.preventDefault();
    void close(false);
  }}
>
  <!-- Its way out for screen readers (the focus starts here); a tap outside, Esc and Back close it too. -->
  <button type="button" class="card-pop__close visually-hidden" onclick={() => void close(false)}>{S.closeCard}</button>
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div class="card-pop__card" bind:this={card} tabindex="-1" onpointerdown={hold}>
    {#if view}
      <CardPanel
        {view}
        catalog={app.catalog}
        catalogFailed={app.catalogFailed}
        fresh={app.freshMarks}
        stagger={0}
        fall={app.falls.get(view.saved.id) ?? null}
        standUp={standUpPlace(index, app.standUp)}
        {playing}
      />
    {/if}
  </div>
  {#if counting}
    <p class="card-pop__countdown" data-anim="tile-peek" style:--peek-hold="{PLAYER_CONFIG.peekHoldMs}ms" style:--peek-delay="{PLAYER_CONFIG.tileOpenMs}ms">
      <svg class="card-pop__arc" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
        <circle class="card-pop__arc-track" cx="12" cy="12" r="9" />
        <circle class="card-pop__arc-left" cx="12" cy="12" r="9" pathLength="100" />
      </svg>
      <span>{S.peekClosing}</span>
    </p>
  {/if}
</dialog>
