<!--
  G3 · Confetti (components-v2.md § 8): the slow paper confetti (D185) on one canvas, the shared physics of
  packages/ui/motion/paper-confetti.ts. Props say what it draws: `count`, `colors` (the CSS custom properties to read,
  one palette: tokens, never raw hex), `fall` (the drift, a share of the height per second; default the phones' 0.11),
  `origin` and `spread` (the burst), `duration` (ms; default --dur-confetti). Decorative; the owner leaves it out with
  reduced motion (one animated element, within the phone's budget).
-->
<script lang="ts">
  import { runPaperConfetti } from '../motion/paper-confetti.ts';
  import './confetti.css';

  let {
    count = 40,
    colors = ['--color-gold', '--color-orange', '--color-red', '--color-green', '--color-cyan', '--color-pink', '--color-snow'],
    fall = null,
    origin = null,
    spread = null,
    duration = null,
    class: className = '',
  }: {
    count?: number;
    colors?: readonly string[];
    fall?: number | null;
    origin?: { x: number; y: number } | null;
    spread?: number | null;
    duration?: number | null;
    class?: string;
  } = $props();

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
    const palette = colors.map((name) => style.getPropertyValue(name).trim()).filter(Boolean);
    const time = duration ?? (ms(style.getPropertyValue('--dur-confetti')) || 6000);
    return runPaperConfetti(
      el,
      { count, colors: palette, ...(fall === null ? {} : { fallShare: fall }), ...(origin ? { origin } : {}), ...(spread === null ? {} : { spread }) },
      time,
    );
  });
</script>

<canvas class="confetti {className}" bind:this={canvas} aria-hidden="true"></canvas>
