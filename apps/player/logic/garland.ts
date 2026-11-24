// The Heat garland's shape: a wire hanging in swags and evenly spaced lights hanging from it, each tilted half
// the wire's slope. Pure geometry; the look (colour, glow, twinkle) is CSS on the Heat value.

export interface GarlandShape {
  /** The design width in px; the wire stretches with the screen, the lights keep their px height. */
  width: number;
  swags: number;
  bulbs: number;
  /** The wire's height at the hooks, and how far each swag sags below it, in px. */
  top: number;
  sag: number;
}

export interface GarlandLight {
  /** Across the width, 0..1. */
  x: number;
  /** Where the light hangs from the wire, in px from the top. */
  y: number;
  /** Tilt in degrees. */
  angle: number;
}

export interface GarlandLayout {
  /** An SVG path in a `width` × (top + sag) box: one quadratic curve per swag (a parabola, sagging `sag`). */
  wire: string;
  lights: GarlandLight[];
}

const round = (v: number, digits = 2) => Math.round(v * 10 ** digits) / 10 ** digits;

export function garlandLayout({ width, swags, bulbs, top, sag }: GarlandShape): GarlandLayout {
  const n = Math.max(1, Math.round(swags));
  const seg = width / n;
  const curves = Array.from({ length: n }, (_, i) => `Q${round(seg * (i + 0.5))} ${round(top + 2 * sag)} ${round(seg * (i + 1))} ${top}`);
  const lights = Array.from({ length: Math.max(0, Math.round(bulbs)) }, (_, i) => {
    const px = ((i + 0.5) * width) / bulbs;
    const t = (px % seg) / seg;
    const slope = (sag * 4 * (1 - 2 * t)) / seg;
    return { x: round(px / width, 4), y: round(top + sag * 4 * t * (1 - t)), angle: round(((Math.atan(slope) * 180) / Math.PI) * 0.5, 1) };
  });
  return { wire: `M0 ${top}${curves.join('')}`, lights };
}
