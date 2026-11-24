<script lang="ts">
  // A card's identity chip: its mark icon in its colour (CardMark), as on its marked songs.
  import { markName } from '../logic/marks-identity.ts';
  import { S } from '../strings.ts';
  import CardMark from './CardMark.svelte';

  let { color }: { color: number } = $props();
</script>

<span class="swatch" data-color={color} role="img" aria-label={S.markLabel(markName(color))}><CardMark identity={color} decorative /></span>
