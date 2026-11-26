// Paper confetti (D185: "the confeti falls too fast, should fall very slow"): the physics the phones' Celebration and
// the projector's «Salvats!» both draw on one canvas. A short burst up and out, then the air holds each piece back, so
// it drifts down at its own slow fall speed, swaying side to side and flipping as paper does. The physics is pure (the
// random source comes in); `drawPaper` only paints a frame on a 2D context the caller owns.

export interface PaperPiece {
  x: number;
  y: number;
  vx: number;
  vy: number;
  /** Its own terminal fall speed (px/s). */
  fall: number;
  sway: number;
  swayHz: number;
  phase: number;
  rot: number;
  vr: number;
  size: number;
  color: string;
}

export interface PaperOptions {
  count: number;
  /** The canvas's size in CSS px. */
  width: number;
  height: number;
  colors: readonly string[];
  /** Where the burst starts, as shares of the canvas (default: a little above the middle, the phones'). */
  origin?: { x: number; y: number };
  /** The pieces' sideways spread at the start, as a share of the width (default 0.3, the phones'). */
  spread?: number;
  /** The slow fall, as a share of the canvas height per second (default 0.11, the phones' 6 s drift). */
  fallShare?: number;
  /** A piece's size range in px (default 6–12, the phones'). */
  size?: { min: number; max: number };
  random?: () => number;
}

/** How hard the air holds the pieces back (per second): high, so the burst is short and the drift long. */
export const PAPER_DRAG = 2.6;

/** The burst: `count` pieces thrown up and out from `origin`. */
export function paperPieces(o: PaperOptions): PaperPiece[] {
  const random = o.random ?? Math.random;
  const { width: w, height: h } = o;
  const origin = o.origin ?? { x: 0.5, y: 0.35 };
  const spread = o.spread ?? 0.3;
  const fall = h * (o.fallShare ?? 0.11);
  const size = o.size ?? { min: 6, max: 12 };
  return Array.from({ length: Math.max(0, Math.floor(o.count)) }, () => ({
    x: w * (origin.x + (random() - 0.5) * spread),
    y: h * origin.y,
    vx: (random() - 0.5) * w * 1.4,
    vy: -h * (0.5 + random() * 0.6),
    fall: fall * (0.7 + random() * 0.6),
    sway: w * (0.015 + random() * 0.025),
    swayHz: 0.4 + random() * 0.5,
    phase: random() * Math.PI * 2,
    rot: random() * Math.PI,
    vr: (random() - 0.5) * 6,
    size: size.min + random() * (size.max - size.min),
    color: o.colors.length ? o.colors[Math.floor(random() * o.colors.length)] : 'gold',
  }));
}

/** Advance every piece by `dt` seconds (in place: one canvas, hundreds of pieces, 60 times a second). */
export function stepPaper(pieces: PaperPiece[], dt: number): void {
  const hold = 1 - Math.exp(-PAPER_DRAG * Math.max(0, dt));
  for (const b of pieces) {
    b.vx -= b.vx * hold;
    b.vy += (b.fall - b.vy) * hold;
    b.x += b.vx * dt;
    b.y += b.vy * dt;
  }
}

/** How visible the confetti is `elapsedMs` into its `durationMs`: in full until the last third, then fading out. */
export function paperAlpha(elapsedMs: number, durationMs: number): number {
  const left = 1 - elapsedMs / Math.max(1, durationMs);
  return left <= 0 ? 0 : Math.min(1, left * 3);
}

/** Paint one frame, `tSec` into the confetti: each piece swaying, turning, and flipping its edge to us and back. */
export function drawPaper(ctx: CanvasRenderingContext2D, pieces: readonly PaperPiece[], tSec: number, alpha: number, outline: string | null = null): void {
  ctx.globalAlpha = alpha;
  for (const b of pieces) {
    const wave = tSec * b.swayHz * Math.PI * 2 + b.phase;
    ctx.save();
    ctx.translate(b.x + Math.sin(wave) * b.sway, b.y);
    ctx.rotate(b.rot + b.vr * tSec);
    ctx.scale(1, Math.cos(wave));
    ctx.fillStyle = b.color;
    ctx.fillRect(-b.size / 2, -b.size / 4, b.size, b.size / 2);
    if (outline) {
      ctx.strokeStyle = outline;
      ctx.lineWidth = Math.max(1, b.size / 8);
      ctx.strokeRect(-b.size / 2, -b.size / 4, b.size, b.size / 2);
    }
    ctx.restore();
  }
  ctx.globalAlpha = 1;
}

/**
 * Run a confetti burst on `canvas` for `durationMs` (sized to the canvas's CSS box, at most 2× for sharpness), then
 * clear it. Returns a stop function. The caller decides whether to run it at all (reduced motion: never).
 */
export function runPaperConfetti(canvas: HTMLCanvasElement, options: Omit<PaperOptions, 'width' | 'height'>, durationMs: number, outline: string | null = null): () => void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return () => undefined;
  const dpr = Math.min(2, globalThis.devicePixelRatio || 1);
  const width = canvas.clientWidth;
  const height = canvas.clientHeight;
  canvas.width = Math.round(width * dpr);
  canvas.height = Math.round(height * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  const pieces = paperPieces({ ...options, width, height });
  const start = performance.now();
  let last = start;
  let raf = 0;
  const frame = (now: number) => {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    const alpha = paperAlpha(now - start, durationMs);
    ctx.clearRect(0, 0, width, height);
    if (alpha <= 0) return;
    stepPaper(pieces, dt);
    drawPaper(ctx, pieces, (now - start) / 1000, alpha, outline);
    raf = requestAnimationFrame(frame);
  };
  raf = requestAnimationFrame(frame);
  return () => {
    cancelAnimationFrame(raf);
    ctx.clearRect(0, 0, width, height);
  };
}
