<!--
  A9 · SoundPad: a grid of sound cells, one board (components-v2.md § 2 › A9, rebuilt as a grid by D-l, #34). One ink
  line between the cells, never a gap plus two borders, with rounded inner corners; each cell reads as a soft bump and
  becomes a dip when pressed (hook pad-press); no colour bar. While a cell's sound plays, a light runs round its inner
  ring (hook pad-playing, by stroke-dashoffset). The component is the grid, not a cell.

  Props say what it draws: `items` (each an id, its name, never drawn: the cell's accessible name and tooltip, D35; and
  its remote key, `wii`), `art` (a snippet that draws an item's picture), `color` (the cells' fill: snow, or gold for
  the fanfares), `columns` (the grid fills its last row with blank cells, so the board stays whole), `playing` (the
  ids sounding now, each with the time it started: a new time restarts its lap), `disabled`, `sound` (silent by
  default: the effect on the PA is the feedback), and `onplay(id)`.
-->
<script lang="ts">
  import type { Snippet } from 'svelte';
  import type { HTMLAttributes } from 'svelte/elements';
  import { useDs } from './providers.ts';
  import type { SoundPadItem, UiSound } from './types.ts';
  import './sound-pad.css';

  type Props = Omit<HTMLAttributes<HTMLDivElement>, 'children' | 'class' | 'onplay'> & {
    items: readonly SoundPadItem[];
    art: Snippet<[string]>;
    color?: 'snow' | 'gold';
    columns?: number;
    playing?: Readonly<Record<string, number>>;
    disabled?: boolean;
    sound?: UiSound | null;
    onplay: (id: string) => void;
    class?: string;
  };

  let { items, art, color = 'snow', columns = 4, playing = {}, disabled = false, sound = null, onplay, class: className = '', ...rest }: Props = $props();

  const { wii: Wii } = useDs();
  /** Blank cells that fill the last row. */
  const fillers = $derived((columns - (items.length % columns)) % columns);
</script>

<div {...rest} class="sound-pad {className}" role="group" data-color={color} style="--sound-pad-columns: {columns}">
  {#each items as item (item.id)}
    <button
      type="button"
      class="sound-pad__cell"
      data-sound={item.id}
      data-playing={item.id in playing || undefined}
      data-anim="pad-press{item.id in playing ? ' pad-playing' : ''}"
      data-touch={sound ?? 'none'}
      aria-label={item.label}
      title={item.label}
      {disabled}
      onclick={() => onplay(item.id)}
    >
      <span class="sound-pad__art" aria-hidden="true">{@render art(item.id)}</span>
      {#key playing[item.id]}
        <svg class="sound-pad__light" aria-hidden="true" focusable="false"><rect pathLength="100" /></svg>
      {/key}
      {#if item.wii && Wii}<span class="sound-pad__wii" aria-hidden="true"><Wii spec={item.wii} /></span>{/if}
    </button>
  {/each}
  {#each { length: fillers } as _, i (i)}<span class="sound-pad__cell sound-pad__cell--blank" aria-hidden="true"></span>{/each}
</div>
