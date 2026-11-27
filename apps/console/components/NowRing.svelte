<!--
  The ring next to "Ara sona" (the Consola-Anell board): the console's recipe over the generic Ring (E1). The show
  state comes from logic/now-ring.ts; ring-looks.ts says how each one looks (an orange ring emptying to the next
  auto-advance, the last seconds red with a halo, a spinning record, the Suspense's gold ring with the drum, the
  breathing «press Següent» disc, a Hold's full ring with the pause sign, a Check's disc, the Pause's hazard stripes),
  and the corner badge names the mode. This file keeps only the words: the timer's spoken label and the numbers.
-->
<script lang="ts">
  import Ring from '../../../packages/ui/components/Ring.svelte';
  import type { RingView } from '../logic/now-ring.ts';
  import { RING_BADGES, RING_LOOKS } from '../ring-looks.ts';
  import { S } from '../strings.ts';

  let { view }: { view: RingView } = $props();

  const L = S.nowPlaying.ring.label;
  const seconds = $derived(view.countdown && !view.countdown.done ? view.countdown.secondsLeft : null);
  const label = $derived.by(() => {
    switch (view.state) {
      case 'auto':
      case 'autoLast':
        return seconds === null ? L.waiting : L.auto(seconds);
      case 'spinning':
        return L.spinning(seconds);
      case 'suspense':
        return L.suspense(seconds);
      case 'talk':
      case 'stay':
        return L.held;
      case 'finaleWinner':
        return S.finale.ringLabel;
      default:
        return L[view.state];
    }
  });
  const counting = $derived(view.state === 'auto' || view.state === 'autoLast' || view.state === 'suspense');
</script>

<Ring
  {...RING_LOOKS[view.state]}
  class="now-ring"
  progress={counting && view.countdown ? view.countdown.remaining : null}
  value={seconds === null ? null : String(seconds)}
  unit=" s"
  badge={view.badge ? RING_BADGES[view.badge] : null}
  {label}
  faceKey={view.state}
/>
