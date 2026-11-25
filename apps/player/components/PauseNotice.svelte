<script lang="ts">
  // The presenters' technical pause, in the drum's place (ANIMATIONS.md `pause`): the meditating nino breathing
  // over "Tornem de seguida". Historial, the cards and the drawers stay as they are. `compact`: the strip size,
  // when Ara shows the cards. Its container crossfades it in (AraHome); reduced motion: the nino is still.
  import { S } from '../strings.ts';

  let { compact = false }: { compact?: boolean } = $props();
</script>

<section class="pause-notice" data-size={compact ? 'strip' : 'full'} role="status">
  <span class="pause-notice__nino" aria-hidden="true"></span>
  <h2 class="pause-notice__title">{S.pause}</h2>
</section>
