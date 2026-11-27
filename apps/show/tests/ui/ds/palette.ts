// Test helper: the palette as the CSS defines it (packages/ui/tokens.css and ds/palette.css), resolved to hex, so the
// tests check what the browser will paint, not a copy of it. Pure string work on the stylesheets.
import { readFileSync } from 'node:fs';

const UI = new URL('../../../../../packages/ui/', import.meta.url);
export const TOKENS_CSS = readFileSync(new URL('tokens.css', UI), 'utf8');
export const PALETTE_CSS = readFileSync(new URL('ds/palette.css', UI), 'utf8');

/** `--color-x: #hex` in :root (only literal hex values, and var() chains to them). */
function rootTokens(): Map<string, string> {
  const root = TOKENS_CSS.slice(TOKENS_CSS.indexOf(':root {'), TOKENS_CSS.indexOf('\n}', TOKENS_CSS.indexOf(':root {')));
  const map = new Map<string, string>();
  for (const m of root.matchAll(/(--[\w-]+):\s*([^;]+);/g)) map.set(m[1], m[2].trim());
  return map;
}

const TOKENS = rootTokens();

/** A value to hex, following var(--token) (and its fallback) through :root. */
export function resolve(value: string, depth = 0): string | null {
  const v = value.trim();
  if (/^#[0-9a-f]{6}$/i.test(v)) return v.toLowerCase();
  const m = /^var\((--[\w-]+)(?:,\s*(.+))?\)$/.exec(v);
  if (!m || depth > 8) return null;
  const token = TOKENS.get(m[1]);
  if (token) return resolve(token, depth + 1);
  return m[2] ? resolve(m[2], depth + 1) : null;
}

/** The slots one `data-color` block sets: { solid: '--color-orange', … } (as written). */
export function paletteBlock(color: string): Record<string, string> | null {
  const start = PALETTE_CSS.indexOf(`:where([data-color='${color}']) {`);
  if (start < 0) return null;
  const body = PALETTE_CSS.slice(start, PALETTE_CSS.indexOf('}', start));
  const out: Record<string, string> = {};
  for (const m of body.matchAll(/--palette-([\w-]+):\s*([^;]+);/g)) out[m[1]] = m[2].trim();
  return out;
}

/** A palette's fill and the text on it (its contrast slot, ink by default), in hex. */
export function fillAndText(color: string): { fill: string | null; text: string | null } {
  const block = paletteBlock(color) ?? {};
  return { fill: block.solid ? resolve(block.solid) : null, text: resolve(block.contrast ?? 'var(--color-ink)') };
}

function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** WCAG 2 contrast ratio. */
export function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}
