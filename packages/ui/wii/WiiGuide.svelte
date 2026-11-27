<!--
  The Wii remote's guide: the drawing (WiiRemote) next to the legend, one row per button group with a dot in
  the group's colour that carries the button's own label, so it reads in black and white too (the printed
  cheat sheet). Used by the console's Comandament dialog and Admin's cheat sheet. Sizes come from the
  container: `--wii-height` for the drawing, and the text inherits the page's font size. `extra`: something drawn in
  a row, after its note (the console's switch on the shake's row).
-->
<script lang="ts">
  import type { Snippet } from 'svelte';
  import { WII_COLOURS, type WiiLegendItem } from './legend.ts';
  import WiiRemote from './WiiRemote.svelte';

  interface Props {
    items: readonly WiiLegendItem[];
    /** A closing line under the legend. */
    footer?: string | null;
    /** Under the side view ("de costat"). */
    sideLabel?: string | null;
    extra?: Snippet<[WiiLegendItem]>;
  }

  let { items, footer = null, sideLabel = null, extra }: Props = $props();
</script>

<div class="wii-guide">
  <WiiRemote {sideLabel} />
  <div class="wii-guide__text">
    <ul class="wii-guide__legend">
      {#each items as item (item.id)}
        <li class="wii-guide__item" data-group={item.group} data-item={item.id}>
          <span class="wii-guide__dot" style:--wii-colour={WII_COLOURS[item.group]} aria-hidden="true">
            {#if item.group === 'dpad'}
              <svg viewBox="0 0 24 24" focusable="false"><path d="M9 3h6v6h6v6h-6v6H9v-6H3V9h6z" /></svg>
            {:else}
              {item.key}
            {/if}
          </span>
          <span class="wii-guide__words">
            <strong class="wii-guide__title">{item.title}</strong>
            <span class="wii-guide__note">
              {item.note}
              {#if item.shake}
                <svg class="wii-guide__shake" viewBox="0 0 28 20" aria-hidden="true" focusable="false"><path d="M2 10c3-6 5-6 8 0s5 6 8 0 5-6 8 0" /></svg>
              {/if}
            </span>
            {@render extra?.(item)}
          </span>
        </li>
      {/each}
    </ul>
    {#if footer}<p class="wii-guide__footer">{footer}</p>{/if}
  </div>
</div>

<style>
  @layer components {
  .wii-guide {
    display: flex;
    flex-wrap: wrap;
    align-items: flex-start;
    gap: 1.25rem 2rem;
  }
  .wii-guide__text {
    display: grid;
    flex: 1 1 18rem;
    gap: 1rem;
    min-width: 0;
  }
  .wii-guide__legend {
    display: grid;
    gap: 0.875rem;
    margin: 0;
    padding: 0;
    list-style: none;
  }
  .wii-guide__item {
    display: grid;
    grid-template-columns: 4rem minmax(0, 1fr);
    align-items: start;
    gap: 0.75rem;
  }
  .wii-guide__dot {
    display: inline-flex;
    justify-self: center;
    align-items: center;
    justify-content: center;
    min-width: 2.25rem;
    height: 2.25rem;
    padding: 0 0.375rem;
    border: 3px solid var(--color-ink, #17132b);
    border-radius: 999px;
    background: var(--wii-colour);
    color: var(--color-ink, #17132b);
    font-size: 0.875rem;
    font-weight: 900;
    line-height: 1;
    white-space: nowrap;
    print-color-adjust: exact;
    -webkit-print-color-adjust: exact;
  }
  .wii-guide__dot svg {
    width: 1.125rem;
    height: 1.125rem;
    fill: var(--color-ink, #17132b);
  }
  .wii-guide__words {
    display: grid;
    gap: 0.125rem;
    min-width: 0;
  }
  .wii-guide__title {
    font-weight: 900;
    line-height: 1.2;
  }
  .wii-guide__note {
    color: var(--wii-muted, inherit);
    font-size: 0.9em;
    font-weight: 700;
    line-height: 1.3;
  }
  .wii-guide__shake {
    display: inline-block;
    width: 1.5em;
    height: 1em;
    vertical-align: -0.15em;
    fill: none;
    stroke: currentColor;
    stroke-width: 3;
    stroke-linecap: round;
  }
  .wii-guide__footer {
    margin: 0;
    color: var(--wii-muted, inherit);
    font-size: 0.875em;
    font-weight: 700;
  }
  }
</style>
