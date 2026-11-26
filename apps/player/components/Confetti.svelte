<script lang="ts">
  // A light confetti burst on one canvas (one animated element, within the phone budget): 40 pieces in the
  // card colours, drifting down slowly for --dur-confetti. Not rendered with reduced motion. `tones` narrows it to some card
  // colours (the player's own winning card: its own colour, with gold and paper so it still reads as confetti).
  // `palette` names the colours' custom properties instead (the Desgraciat round's last card standing: greens).
  let { pieces = 40, tones, palette }: { pieces?: number; tones?: readonly number[]; palette?: readonly string[] } = $props();
  let canvas: HTMLCanvasElement | undefined = $state();

  const ms = (text: string): number => {
    const v = parseFloat(text);
    if (!Number.isFinite(v)) return 0;
    return text.trim().endsWith('ms') ? v : v * 1000;
  };

  $effect(() => {
    const el = canvas;
    const ctx = el?.getContext('2d');
    if (!el || !ctx) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = el.clientWidth;
    const h = el.clientHeight;
    el.width = Math.round(w * dpr);
    el.height = Math.round(h * dpr);
    ctx.scale(dpr, dpr);
    const style = getComputedStyle(el);
    // Every card colour but black (9), which would vanish against the night sky.
    const names = palette?.length
      ? palette
      : tones?.length ? [...tones.filter((n) => n !== 9).map((n) => `--card-color-${n}`), '--color-accent', '--color-paper'] : [1, 2, 3, 4, 5, 6, 7, 8, 10].map((n) => `--card-color-${n}`);
    const colors = names.map((name) => style.getPropertyValue(name).trim()).filter(Boolean);
    const duration = ms(style.getPropertyValue('--dur-confetti')) || 6000;
    // Paper, not stones (the user: "should fall very slow"): a short burst up and out, then the air holds the pieces
    // back, so each drifts down at a slow fall speed, swaying side to side and flipping as it goes.
    const drag = 2.6;
    const fall = h * 0.11;
    const bits = Array.from({ length: pieces }, () => ({
      x: w * (0.35 + Math.random() * 0.3),
      y: h * 0.35,
      vx: (Math.random() - 0.5) * w * 1.4,
      vy: -h * (0.5 + Math.random() * 0.6),
      fall: fall * (0.7 + Math.random() * 0.6),
      sway: w * (0.015 + Math.random() * 0.025),
      swayHz: 0.4 + Math.random() * 0.5,
      phase: Math.random() * Math.PI * 2,
      rot: Math.random() * Math.PI,
      vr: (Math.random() - 0.5) * 6,
      size: 6 + Math.random() * 6,
      color: colors[Math.floor(Math.random() * colors.length)] ?? 'gold',
    }));
    const start = performance.now();
    let last = start;
    let raf = 0;
    const frame = (now: number) => {
      const t = (now - start) / 1000;
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const left = 1 - (now - start) / duration;
      ctx.clearRect(0, 0, w, h);
      if (left <= 0) return;
      // Visible in full until the last third, then fading out.
      ctx.globalAlpha = Math.min(1, left * 3);
      const hold = 1 - Math.exp(-drag * dt);
      for (const b of bits) {
        b.vx -= b.vx * hold;
        b.vy += (b.fall - b.vy) * hold;
        b.x += b.vx * dt;
        b.y += b.vy * dt;
        ctx.save();
        ctx.translate(b.x + Math.sin(t * b.swayHz * Math.PI * 2 + b.phase) * b.sway, b.y);
        ctx.rotate(b.rot + b.vr * t);
        // The flip: the piece turns its edge to us and back, as paper does.
        ctx.scale(1, Math.cos(t * b.swayHz * Math.PI * 2 + b.phase));
        ctx.fillStyle = b.color;
        ctx.fillRect(-b.size / 2, -b.size / 4, b.size, b.size / 2);
        ctx.restore();
      }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  });
</script>

<canvas class="confetti" bind:this={canvas} aria-hidden="true"></canvas>
