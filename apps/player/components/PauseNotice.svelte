<script lang="ts">
  // The presenters' technical pause, in the drum's place (ANIMATIONS.md `pause`): the generic Notice's scene (E4) with
  // the meditating nino breathing (NINO_FOR.pause) over "Tornem de seguida". Historial, the cards and the drawers stay
  // as they are. `compact`: the strip size, when Ara shows the cards. Its container crossfades it in (AraHome);
  // reduced motion: the nino is still.
  import Nino from '../../../packages/ui/components/Nino.svelte';
  import Notice from '../../../packages/ui/components/Notice.svelte';
  import { ninoFor } from '../../../packages/ui/concepts.ts';
  import { S } from '../strings.ts';

  let { compact = false }: { compact?: boolean } = $props();
</script>

<Notice layout="scene" color="navy" class="pause-notice" data-size={compact ? 'strip' : 'full'} text={S.pause}>
  <Nino pose={ninoFor('pause', 0)} motion="breathe" class="pause-notice__nino" aria-hidden="true" />
</Notice>
