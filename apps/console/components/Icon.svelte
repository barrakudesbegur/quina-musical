<!--
  A decorative icon in currentColor. Always paired with a visible text label (or one for assistive technology).
  `outline`: the big buttons' sticker look, the same paths drawn first as a thick ink line underneath (the
  accent detail stays clean).
-->
<script lang="ts">
  import { ICONS, partClass, pathOf, type IconName, type IconPath } from '../icons.ts';

  let { name, outline = false }: { name: IconName; outline?: boolean } = $props();
  const paths: readonly IconPath[] = $derived(ICONS[name]);
</script>

<svg class="icon icon--{name}" class:icon--outline={outline} viewBox="0 0 24 24" aria-hidden="true" focusable="false">
  {#if outline}
    <g class="icon__under">
      {#each paths as p, i (i)}
        {#if partClass(p) !== 'icon__accent'}<path d={pathOf(p)} />{/if}
      {/each}
    </g>
  {/if}
  {#each paths as p, i (i)}
    <path d={pathOf(p)} class={partClass(p)} />
  {/each}
</svg>
