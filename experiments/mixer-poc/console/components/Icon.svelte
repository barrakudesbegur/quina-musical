<!-- A decorative stroke icon in currentColor. Always paired with a visible text label. -->
<script lang="ts">
  import { ICONS, type IconName } from '../icons.ts';

  let { name }: { name: IconName } = $props();
</script>

<svg class="icon icon--{name}" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
  {#each ICONS[name] as d (d)}
    <path {d} />
  {/each}
</svg>
