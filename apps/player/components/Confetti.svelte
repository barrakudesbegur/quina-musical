<script lang="ts">
  // A light confetti burst on one canvas (one animated element, within the phone budget): 40 pieces in the
  // card colours, drifting down slowly for --dur-confetti. Not rendered with reduced motion. `tones` narrows it to some card
  // colours (the player's own winning card: its own colour, with gold and paper so it still reads as confetti).
  // `palette` names the colours' custom properties instead (the Desgraciat round's last card standing: greens).
  // The physics is shared with the projector's «Salvats!» (packages/ui/motion/paper-confetti.ts, D185).
  import { runPaperConfetti } from '../../../packages/ui/motion/paper-confetti.ts';

  let { pieces = 40, tones, palette }: { pieces?: number; tones?: readonly number[]; palette?: readonly string[] } = $props();
  let canvas: HTMLCanvasElement | undefined = $state();

  const ms = (text: string): number => {
    const v = parseFloat(text);
    if (!Number.isFinite(v)) return 0;
    return text.trim().endsWith('ms') ? v : v * 1000;
  };

  $effect(() => {
    const el = canvas;
    if (!el) return;
    const style = getComputedStyle(el);
    // Every card colour but black (9), which would vanish against the night sky.
    const names = palette?.length
      ? palette
      : tones?.length ? [...tones.filter((n) => n !== 9).map((n) => `--card-color-${n}`), '--color-accent', '--color-paper'] : [1, 2, 3, 4, 5, 6, 7, 8, 10].map((n) => `--card-color-${n}`);
    const colors = names.map((name) => style.getPropertyValue(name).trim()).filter(Boolean);
    const duration = ms(style.getPropertyValue('--dur-confetti')) || 6000;
    return runPaperConfetti(el, { count: pieces, colors }, duration);
  });
</script>

<canvas class="confetti" bind:this={canvas} aria-hidden="true"></canvas>
