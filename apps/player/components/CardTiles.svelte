<script lang="ts">
  // The collapsed cards (§8 Y2, option A; D289, the user's go of 28 Nov; boards Mobil-Plegats-*): with 2+ cards playing
  // the round, Cartrons shows each as a tile (the design system's CardTile) two to a row, in the player's order. A tile
  // is its card's header (mark, name or number, the count) over its 4 × 3 map: marked songs carry the card's mark, the
  // song playing now CardCell's running dashes (`cell-playing`, in step on every tile that has it), and its header the
  // stripes, its own glow and the orange count (no ring on a tile). When a landing completes a row or the whole card
  // and the presenters announce wins (`announceWins`), «LÍNIA!» or «QUINA!» takes the map's place until the next landing
  // or the validation (`line-card`, `quina-card`); a full card's header keeps its stripes until the Quina is validated.
  // A tap opens the whole card over the home (CardPopover, `tile-open`). The first time tiles show, the new card (or the
  // first) opens by itself once (`tile-peek`), then a scribble says «Toca per veure'l!» until a tile is tapped
  // (`tile-scribble`): in the empty last cell (odd), under the tiles when there is room (even), else above the first
  // row pointing at the second tile (logic/collapsed.ts).
  import { untrack } from 'svelte';
  import CardTile from '../../../packages/ui/components/CardTile.svelte';
  import Scribble from '../../../packages/ui/components/Scribble.svelte';
  import { PLAYER_CONFIG } from '../config.ts';
  import { inStep } from '../device/in-step.ts';
  import type { PlayerApp } from '../model.svelte.ts';
  import { bigCardOf, peekTarget, quinaUnclaimed, scribbleSlot, teachStep, type ScribbleSlot } from '../logic/collapsed.ts';
  import { kernelTilt, type CardView } from '../logic/view.ts';
  import { S } from '../strings.ts';
  import CardMark from './CardMark.svelte';
  import CardPopover from './CardPopover.svelte';
  import Swatch from './Swatch.svelte';
  import './tiles.css';

  let { app, active = true }: { app: PlayerApp; /** Cartrons is the view shown (AraHome). */ active?: boolean } = $props();

  /** The song playing now (#74): the latest landing, while the round plays (not during a Check or a pause). */
  const playing = $derived(app.scene === 'play' && !app.paused ? (app.latest?.songId ?? null) : null);
  const winners = $derived(app.state?.winners ?? []);

  interface Tile {
    view: CardView;
    holds: boolean;
    big: string | null;
    stripes: boolean;
    cells: { marked: boolean; ring: boolean }[];
    songs: number[];
  }

  const tiles = $derived(
    app.playingViews.map((view): Tile => {
      const songs = view.card?.lines.flat() ?? [];
      const marked = view.marks?.marked.flat() ?? songs.map(() => false);
      const holds = playing !== null && songs.includes(playing);
      const wins = { round: app.round, winners, announce: app.announceWins };
      const big = bigCardOf({ card: view.card, marks: view.marks, latest: app.latest?.songId ?? null, ...wins });
      return {
        view,
        holds,
        big: big === 'quina' ? S.bigQuina : big === 'line' ? S.bigLine : null,
        stripes: holds || quinaUnclaimed({ marks: view.marks, ...wins }),
        cells: songs.map((songId, i) => ({ marked: Boolean(marked[i]), ring: Boolean(marked[i]) && songId === playing })),
        songs,
      };
    }),
  );

  // ---- the open card ----------------------------------------------------------------------------------------------
  let opened = $state<{ id: number; peek: boolean } | null>(null);
  let grid: HTMLElement | undefined = $state();
  const tileEl = (id: number) => grid?.querySelector<HTMLElement>(`.cards__item[data-card-id='${id}'] .card-tile`) ?? null;

  function openTile(id: number): void {
    app.noteTilesTaught('tapped');
    opened = { id, peek: false };
  }

  function closed(): void {
    if (opened?.peek) app.noteTilesTaught('peeked');
    opened = null;
  }

  // ---- T3: the peek once, then the scribble until a tile is tapped ------------------------------------------------
  const step = $derived(teachStep({ taught: app.data.tilesTaught, tiles: app.tiles, shown: active, busy: app.homeCovered, reduced: app.reducedMotion }));
  $effect(() => {
    if (step !== 'peek' || opened) return;
    const id = untrack(() => peekTarget(tiles.map((t) => t.view.saved.id), app.highlightCard));
    if (id === null) return;
    const t = setTimeout(() => (opened = { id, peek: true }), PLAYER_CONFIG.peekDelayMs);
    return () => clearTimeout(t);
  });

  /** Where the scribble goes: measured room under the tiles on the screen (at the top of the scroll). */
  let roomUnder = $state(0);
  let aboveEl: HTMLElement | undefined = $state();
  const slot = $derived<ScribbleSlot>(scribbleSlot(tiles.length, roomUnder, PLAYER_CONFIG.scribbleUnderPx));
  const scribbling = $derived(step === 'scribble' && !opened);

  function measure(): void {
    if (!grid) return;
    const box = grid.closest<HTMLElement>('.player__scroll') ?? (document.scrollingElement as HTMLElement | null);
    if (!box) return;
    const boxRect = box === document.scrollingElement ? { top: 0 } : box.getBoundingClientRect();
    const cs = getComputedStyle(box);
    // Where the tiles end at the top of the scroll, without the note above them (it moves them down while it shows).
    const lift = aboveEl ? aboveEl.offsetHeight + (parseFloat(getComputedStyle(grid).rowGap) || 0) : 0;
    const bottom = grid.getBoundingClientRect().bottom - boxRect.top + box.scrollTop - lift;
    roomUnder = box.clientHeight - (parseFloat(cs.paddingBottom) || 0) - bottom;
  }

  $effect(() => {
    if (!grid || !scribbling) return;
    untrack(measure);
    const ro = new ResizeObserver(() => measure());
    ro.observe(grid);
    addEventListener('resize', measure);
    return () => {
      ro.disconnect();
      removeEventListener('resize', measure);
    };
  });

  const scribbleColor = $derived(app.yourSong ? 'ink' : 'gold');

  // The playing song's dashes run in step on every tile that has it (`cell-playing`).
  $effect(() => {
    void tiles;
    if (!grid || playing === null) return;
    const el = grid;
    const raf = requestAnimationFrame(() => inStep(el));
    return () => cancelAnimationFrame(raf);
  });
</script>

<div class="tiles" bind:this={grid} data-scribble={scribbling ? slot : undefined}>
  {#if scribbling && slot === 'above'}
    <div class="tiles__note" data-slot="above" bind:this={aboveEl}><Scribble words={S.tileHint} point="down" color={scribbleColor} data-anim="tile-scribble" /></div>
  {/if}
  <ul class="tiles__list">
    {#each tiles as tile, i (tile.view.saved.id)}
      {@const v = tile.view}
      {@const label = v.saved.name ?? S.cardNumber(v.saved.id)}
      {@const count = v.remaining !== null ? S.remaining(v.remaining) : null}
      <li class="cards__item" data-card-id={v.saved.id} data-highlight={app.highlightCard === v.saved.id ? 'true' : undefined}>
        <CardTile
          identity={v.saved.color}
          {label}
          cells={tile.cells}
          count={v.remaining}
          countLabel={count ?? undefined}
          countColor={tile.holds ? 'orange' : 'paper'}
          stamp={tile.big}
          stripes={tile.stripes}
          glow={app.highlightCard === v.saved.id ? 'gold' : tile.holds ? 'own' : null}
          aria-label={S.tile(v.saved.name ? `${v.saved.name}, ${S.cardNumber(v.saved.id)}` : S.cardNumber(v.saved.id), count, tile.holds, tile.big)}
          aria-haspopup="dialog"
          data-playing={tile.holds || undefined}
          data-anim={tile.big ? (tile.big === S.bigQuina ? 'quina-card' : 'line-card') : 'collapsed-grid'}
          data-type={v.card?.type ?? 'unknown'}
          onclick={() => openTile(v.saved.id)}
        >
          {#snippet mark()}<Swatch color={v.saved.color} />{/snippet}
          {#snippet cellMark(c: number)}
            {@const songId = tile.songs[c]}
            <!-- The tilt on the kernel's box, the beat's bob (`mark-bob`, its `rotate`) on the HTML box inside it, as CardGrid. -->
            <span
              class="card-tile__mark"
              data-anim={app.freshMarks.has(`${v.saved.id}:${songId}`) ? 'mark-in' : undefined}
              style:--tilt="{kernelTilt(v.saved.id, songId)}deg"
              style:--stagger="{i * PLAYER_CONFIG.markStaggerMs}ms"
            ><span class="card-tile__bob" data-bob><CardMark identity={v.saved.color} decorative /></span></span>
          {/snippet}
        </CardTile>
      </li>
    {/each}
  </ul>
  {#if scribbling && slot === 'cell'}
    <div class="tiles__note" data-slot="cell"><Scribble words={S.tileHint} point="left" color={scribbleColor} data-anim="tile-scribble" /></div>
  {/if}
  {#if scribbling && slot === 'under'}
    <div class="tiles__note" data-slot="under"><Scribble words={S.tileHint} point="up" color={scribbleColor} data-anim="tile-scribble" /></div>
  {/if}
</div>

{#if opened}
  {#key opened.id}
    <CardPopover {app} cardId={opened.id} origin={tileEl(opened.id)} peek={opened.peek} onclosed={closed} />
  {/key}
{/if}
