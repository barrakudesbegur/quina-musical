<script lang="ts">
  // A card's colour chip (--card-color-N).
  import { S } from '../strings.ts';

  let { color }: { color: number } = $props();
</script>

<span class="swatch" data-color={color} style:--card-color="var(--card-color-{color})" role="img" aria-label={S.colourLabel(color)}></span>
