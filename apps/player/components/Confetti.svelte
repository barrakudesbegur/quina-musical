<script lang="ts">
  // The phone's confetti: the generic Confetti (G3) in the card colours. `tones` narrows it to some card colours (the
  // player's own winning card: its own colour, with gold and paper so it still reads as confetti); `palette` names the
  // colours' custom properties instead (the Desgraciat round's last card standing: greens). Every card colour but black
  // (9), which would vanish against the night sky.
  import Confetti from '../../../packages/ui/components/Confetti.svelte';

  let { pieces = 40, tones, palette }: { pieces?: number; tones?: readonly number[]; palette?: readonly string[] } = $props();
  const colors = $derived(
    palette?.length
      ? palette
      : tones?.length
        ? [...tones.filter((n) => n !== 9).map((n) => `--card-color-${n}`), '--color-accent', '--color-paper']
        : [1, 2, 3, 4, 5, 6, 7, 8, 10].map((n) => `--card-color-${n}`),
  );
</script>

<Confetti count={pieces} {colors} />
