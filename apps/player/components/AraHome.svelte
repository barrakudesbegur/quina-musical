<script lang="ts">
  // Ara, the home (D73, D218; boards Mobil-B-J2 ①②): the drum on top (or what the scene shows there, or the pause's
  // nino), the Historial | Cartrons switch, and the two views side by side, with the floating «+ Cartró» on Cartrons.
  // Always there, under the drawers. The motion (ANIMATIONS.md; the user's phone test, 27 Nov):
  // - `home-swipe`: a sideways swipe on the switch or the views changes the view, following the finger (the switch's
  //   indicator too); a tap on the switch slides the same way. The page's vertical scroll is the browser's, and a
  //   gesture is one or the other (the first 8 px decide). Each view keeps its own scroll position for the visit:
  //   while a swipe runs the page holds still, the coming view is drawn at its own scroll, and the garland and header,
  //   the drum and the switch go from the leaving view's place and look to the coming one's (logic/home-swipe.ts), so
  //   the swipe ends on the coming view's own layout and the page's scroll is set to it in the same frame.
  // - `drum-collapse`: scrolling Historial collapses the drum into the strip Cartrons shows, stuck to the top (home.css
  //   drives `--reel-collapse` from the page's scroll, `animation-timeline: scroll(root)`); the switch scrolls on.
  // - Reduced motion and Data Saver: nothing follows the finger; the view changes by a crossfade (a view transition).
  import { flushSync, onMount, untrack } from 'svelte';
  import Button from '../../../packages/ui/components/Button.svelte';
  import { touchRelease } from '../../../packages/ui/sounds/touch.ts';
  import { PLAYER } from '../actions.ts';
  import { PLAYER_CONFIG } from '../config.ts';
  import type { PlayerApp } from '../model.svelte.ts';
  import {
    SWIPE,
    dragPos,
    easeOut,
    otherView,
    planSwipe,
    reducedTarget,
    releaseTarget,
    releaseVelocity,
    settleMs,
    swipeAxis,
    swipeFrame,
    viewPos,
    type Sample,
    type SwipeFrame,
    type SwipePlan,
  } from '../logic/home-swipe.ts';
  import { ARA_VIEWS, type AraView } from '../logic/tabs.ts';
  import { S } from '../strings.ts';
  import CardsList from './CardsList.svelte';
  import HistoryList from './HistoryList.svelte';
  import NowPanel from './NowPanel.svelte';
  import PauseNotice from './PauseNotice.svelte';
  import ViewSwitch from './ViewSwitch.svelte';

  let { app }: { app: PlayerApp } = $props();

  /** The view laid out now; the model's choice catches up at the end of a swipe (and pulls this along when it changes). */
  let shown = $state<AraView>(untrack(() => app.araView));
  /** A swipe's current frame, while one runs. */
  let frame = $state<SwipeFrame | null>(null);
  /** The drum's measures for the collapse: where it reaches the top, its full height, the strip's. */
  let stickAt = $state(0);
  let fullHeight = $state(0);
  let alerts = $state(0);

  /** The top shows the drum (and so sticks and collapses); the other scenes and the pause just scroll. */
  const drum = $derived(!app.paused && !['before', 'roundStart', 'interval', 'after'].includes(app.scene));
  const reduced = $derived(app.reducedMotion);
  const pos = $derived(frame ? frame.pos : viewPos(shown));
  const canAdd = $derived(app.data.cards.length > 0 && app.data.cards.length < PLAYER_CONFIG.maxCards && !app.celebrationOpen);
  const addShare = $derived(frame ? frame.cartrons : shown === 'cartrons' ? 1 : 0);

  let root: HTMLElement | undefined = $state();
  let top: HTMLElement | undefined = $state();
  let switchBox: HTMLElement | undefined = $state();
  let track: HTMLElement | undefined = $state();
  /** Each view's scroll position, for this visit. */
  const saved: Record<AraView, number> = { historial: 0, cartrons: 0 };

  const remPx = () => parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
  const stripPx = () => 5.125 * remPx();
  const playerEl = () => root?.closest<HTMLElement>('.player') ?? null;
  const alertsEl = () => playerEl()?.querySelector<HTMLElement>(':scope > .player__alerts') ?? null;
  const headEls = () => [...(playerEl()?.querySelectorAll<HTMLElement>(':scope > .heat, :scope > .app-header') ?? [])];

  // ---- measures: the collapse's scroll range, kept up to date as the page above or the drum's words change size -----
  function measure(): void {
    if (!root) return;
    const a = alertsEl();
    alerts = a && getComputedStyle(a).display !== 'none' ? a.offsetHeight : 0;
    stickAt = root.getBoundingClientRect().top + scrollY - alerts;
    fullHeight = (top?.firstElementChild as HTMLElement | null)?.offsetHeight ?? 0;
  }
  onMount(() => {
    const player = playerEl();
    const watched = [root, top?.firstElementChild, alertsEl(), ...headEls(), player?.querySelector('.player__main')].filter(Boolean) as Element[];
    const ro = new ResizeObserver(() => measure());
    for (const el of watched) ro.observe(el);
    measure();
    addEventListener('resize', measure);
    return () => {
      ro.disconnect();
      removeEventListener('resize', measure);
    };
  });
  // The top's content is swapped by the pause and the scenes: watch the new one too.
  $effect(() => {
    void drum;
    void app.paused;
    const el = top?.firstElementChild;
    if (!el) return;
    const ro = new ResizeObserver(() => measure());
    ro.observe(el);
    return () => ro.disconnect();
  });

  // ---- a swipe's plan and frames -----------------------------------------------------------------------------------
  let plan: SwipePlan | null = null;
  let stride = $state(0);
  let settle = 0;
  let settling: { to: AraView; sound: boolean } | null = null;

  function makePlan(): SwipePlan | null {
    if (!root || !top || !switchBox || !track) return null;
    measure();
    const views = [...track.children] as HTMLElement[];
    const leaving = views.find((v) => v.dataset.view === shown);
    const coming = views.find((v) => v.dataset.view !== shown);
    const head = headEls();
    const headTop = head[0]?.getBoundingClientRect().top ?? 0;
    const headBottom = head.at(-1)?.getBoundingClientRect().bottom ?? headTop;
    const switchRect = switchBox.getBoundingClientRect();
    const gap = parseFloat(getComputedStyle(root).rowGap) || 0;
    stride = track.getBoundingClientRect().width + parseFloat(getComputedStyle(track).columnGap || '0');
    return planSwipe(shown, {
      scroll: scrollY,
      savedScroll: saved[otherView(shown)],
      viewport: innerHeight,
      pageHeight: document.documentElement.scrollHeight,
      alerts,
      headTop,
      headHeight: headBottom - headTop,
      homeTop: root.getBoundingClientRect().top,
      drum,
      fullHeight: drum ? fullHeight : switchRect.top - root.getBoundingClientRect().top - gap,
      stripHeight: drum ? stripPx() : switchRect.top - root.getBoundingClientRect().top - gap,
      gap,
      switchHeight: switchRect.height,
      leavingHeight: leaving?.offsetHeight ?? 0,
      comingHeight: coming?.offsetHeight ?? 0,
    });
  }

  function show(p: number): void {
    if (!plan) return;
    frame = swipeFrame(plan, p);
    for (const el of headEls()) el.style.translate = `0 ${frame.head}px`;
  }

  function clearFrame(): void {
    frame = null;
    plan = null;
    for (const el of headEls()) el.style.translate = '';
  }

  /** The swipe is over on `to`: lay that view out and set the page's scroll to its own, in this same frame. */
  function commit(to: AraView, sound: boolean): void {
    const toScroll = plan?.toScroll ?? saved[to];
    saved[shown] = scrollY;
    flushSync(() => {
      shown = to;
      clearFrame();
    });
    scrollTo({ top: toScroll, behavior: 'instant' });
    app.selectAraView(to);
    if (sound) touchRelease('tab');
  }

  /** Slide from `fromPos` to `to`'s place, eased, then commit (or just let go, when `to` is the view shown). */
  function slide(fromPos: number, to: AraView, ms: number, sound: boolean): void {
    cancelAnimationFrame(settle);
    settling = { to, sound };
    const toPos = viewPos(to);
    const t0 = performance.now();
    const step = (now: number) => {
      const k = easeOut(Math.min(1, (now - t0) / ms));
      show(fromPos + (toPos - fromPos) * k);
      if (k < 1) {
        settle = requestAnimationFrame(step);
        return;
      }
      settling = null;
      if (to === shown) clearFrame();
      else commit(to, sound);
    };
    settle = requestAnimationFrame(step);
  }

  /** Reduced motion and Data Saver: no slide; the whole home crossfades to the other view at its own scroll. */
  function crossfade(to: AraView): void {
    saved[shown] = scrollY;
    const update = () => {
      flushSync(() => {
        shown = to;
        clearFrame();
      });
      scrollTo({ top: saved[to], behavior: 'instant' });
      app.selectAraView(to);
    };
    if (!document.startViewTransition) return update();
    document.startViewTransition({ update, types: ['home-crossfade'] });
  }

  /** The switch (a tap, ← →) or the app itself: go to `to`. */
  function go(to: AraView): void {
    if (to === shown || drag?.axis === 'x') return;
    if (reduced) return crossfade(to);
    if (settling) return;
    plan = makePlan();
    if (!plan) return void commit(to, false);
    slide(viewPos(shown), to, SWIPE.tapMs, false);
  }

  // The model's choice changed by itself (a card just added shows Cartrons): follow it, animated.
  $effect(() => {
    const want = app.araView;
    untrack(() => {
      if (want !== shown && !drag && !settling) go(want);
    });
  });

  // ---- the gesture: one axis per drag (the browser keeps the vertical: `touch-action: pan-y`) ------------------------
  let drag: { id: number; x: number; y: number; axis: 'x' | 'y' | null; startPos: number; samples: Sample[] } | null = null;

  function down(e: PointerEvent): void {
    if (drag || !e.isPrimary || (e.pointerType === 'mouse' && e.button !== 0)) return;
    drag = { id: e.pointerId, x: e.clientX, y: e.clientY, axis: null, startPos: pos, samples: [] };
  }

  function move(e: PointerEvent): void {
    if (!drag || e.pointerId !== drag.id) return;
    if (drag.axis === null) {
      drag.axis = swipeAxis(e.clientX - drag.x, e.clientY - drag.y);
      if (drag.axis === 'y') return void (drag = null);
      if (drag.axis === null) return;
      // A swipe: it starts from here (no jump by the slop), and catches a settle still running.
      try {
        (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
      } catch {
        // A pointer the browser no longer tracks: the swipe still follows its moves.
      }
      drag.x = e.clientX;
      if (settling) {
        cancelAnimationFrame(settle);
        settling = null;
        drag.startPos = frame?.pos ?? viewPos(shown);
      } else {
        drag.startPos = viewPos(shown);
        if (!reduced) plan = makePlan();
      }
    }
    drag.samples.push({ t: e.timeStamp, x: e.clientX });
    if (drag.samples.length > 12) drag.samples.shift();
    if (!reduced && plan) show(dragPos(drag.startPos, e.clientX - drag.x, stride || innerWidth));
  }

  function up(e: PointerEvent): void {
    if (!drag || e.pointerId !== drag.id) return;
    const d = drag;
    drag = null;
    if (d.axis !== 'x') return;
    const velocity = releaseVelocity(d.samples);
    const dx = e.clientX - d.x;
    if (reduced) {
      const to = reducedTarget(shown, dx, stride || innerWidth, velocity);
      if (to !== shown) crossfade(to);
      return;
    }
    if (!plan) return;
    const at = frame?.pos ?? viewPos(shown);
    const to = releaseTarget(shown, at, velocity);
    const distance = Math.abs(viewPos(to) - at) * stride;
    slide(at, to, settleMs(distance, velocity), to !== shown);
  }

  function cancel(e: PointerEvent): void {
    if (!drag || e.pointerId !== drag.id) return;
    const d = drag;
    drag = null;
    if (d.axis === 'x' && frame) slide(frame.pos, shown, SWIPE.settleMinMs, false);
  }
</script>

<div
  class="ara"
  bind:this={root}
  data-view={shown}
  data-drum={drum || undefined}
  data-swiping={frame ? 'true' : undefined}
  data-anim="home-swipe"
  style:--ara-stick="{stickAt}px"
  style:--ara-full="{fullHeight}px"
  style:--ara-alerts="{alerts}px"
  style:--reel-collapse-range={drum && fullHeight ? `${Math.max(0, fullHeight - stripPx())}px` : undefined}
>
  <!-- The pause swaps in for the drum with a crossfade (ANIMATIONS.md `pause`, 300 ms). The drum's box sticks to the top
       and collapses (`drum-collapse`). -->
  {#key app.paused}
    <div
      class="ara__top"
      data-anim="pause"
      bind:this={top}
      style:translate={frame && frame.box ? `0 ${frame.box}px` : undefined}
      style:--reel-collapse={frame && drum ? frame.collapse : undefined}
    >
      {#if app.paused}
        <PauseNotice compact={shown === 'cartrons'} />
      {:else}
        <NowPanel {app} stopped={app.offline} />
      {/if}
    </div>
  {/key}
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div class="ara__swipe" onpointerdown={down} onpointermove={move} onpointerup={up} onpointercancel={cancel}>
    <div class="ara__switch" bind:this={switchBox} style:translate={frame && frame.switchY ? `0 ${frame.switchY}px` : undefined}>
      <ViewSwitch value={shown} progress={pos} onselect={go} />
    </div>
    <div class="ara__track" bind:this={track} style:translate={frame ? `${-frame.pos * stride}px 0` : undefined}>
      {#each ARA_VIEWS as view (view)}
        {@const active = view === shown}
        <div
          class="ara__view"
          role="tabpanel"
          aria-labelledby="ara-view-{view}"
          data-view={view}
          data-active={active || undefined}
          inert={!active}
          style:translate={frame ? `0 ${active ? frame.leavingY : frame.comingY}px` : undefined}
        >
          {#if view === 'cartrons'}
            <CardsList {app} {active} />
          {:else}
            <HistoryList {app} />
          {/if}
        </div>
      {/each}
    </div>
  </div>
  <!-- «+ Cartró» floats between the corners on Cartrons (D188, D218; `add-card-float`), the quiet preset. -->
  {#if canAdd}
    <div class="ara__add" style:--ara-add={addShare} data-shown={addShare > 0 || undefined} data-following={frame ? 'true' : undefined} inert={addShare < 0.5}>
      <Button {...PLAYER.addCardFloating} class="ara__add-button" aria-label={S.addCardLabel} aria-haspopup="dialog" onclick={() => app.open({ kind: 'pad' })} />
    </div>
  {/if}
</div>
