// The player app's icons (D223): apps/player/icons/*.svg (the art's source, drawn from brand/ninos/figures/nino-afro.svg)
// rendered into the build's public folder, apps/player/public/icons/, at the fixed names the cloud serves (apps/cloud's
// static/_headers) and the manifest names (apps/player/public/player.webmanifest):
//
//   node tools/ninos/app-icons.ts
//
// It needs rsvg-convert (`brew install librsvg`). The PNGs are committed, so building the app never needs it.
// app.svg is full bleed with its art inside the maskable safe circle (the middle 80 %), so one drawing serves the
// plain icons, the maskable one (Android crops it to its launcher's shape) and Apple's (iOS rounds the corners).
import { execFileSync } from 'node:child_process';
import { mkdirSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const SRC = `${ROOT}apps/player/icons/`;
const OUT = `${ROOT}apps/player/public/icons/`;

/** [source SVG, PNG name, side in px]. */
const ICONS: readonly (readonly [string, string, number])[] = [
  ['app.svg', 'player-192.png', 192],
  ['app.svg', 'player-512.png', 512],
  ['app.svg', 'player-maskable-512.png', 512],
  ['app.svg', 'apple-touch-icon-180.png', 180],
  /** Monochrome, white on transparent: Android draws only its alpha (a notification's badge). */
  ['badge.svg', 'player-badge-96.png', 96],
];

mkdirSync(OUT, { recursive: true });
for (const [svg, png, side] of ICONS) {
  const from = SRC + svg;
  const to = OUT + png;
  execFileSync('rsvg-convert', ['--width', String(side), '--height', String(side), from, '--output', to]);
  console.log(`${svg} → apps/player/public/icons/${png} (${side} px, ${(statSync(to).size / 1024).toFixed(0)} KB)`);
}
