<!--
  A finalist's nino in the Desgraciat's finale (packages/rules/finale.ts › finaleLook, the same on the projector): one
  of the poses the screens ship, tinted by its hue; the winner's is the party nino (nino-confeti). Decorative: the
  card number is always beside it.
-->
<script lang="ts">
  import type { FinalePose } from '../../../packages/rules/finale.ts';
  import alt2 from '../../../packages/ui/assets/ninos/nino-alt-2.svg';
  import sardana from '../../../packages/ui/assets/ninos/nino-sardana.svg';
  import handsUp from '../../../packages/ui/assets/ninos/nino-mans-adalt.svg';
  import party from '../../../packages/ui/assets/ninos/nino-confeti.svg';

  let { pose, hue, winner = false }: { pose: FinalePose; hue: number; winner?: boolean } = $props();
  const POSES: Record<FinalePose, string> = { 'alt-2': alt2, sardana, 'mans-adalt': handsUp };
</script>

<img class="nino" src={winner ? party : POSES[pose]} alt="" draggable="false" style:--nino-hue="{winner ? 0 : hue}deg" />
