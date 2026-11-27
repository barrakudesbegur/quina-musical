// The installable player (D221, D223): the manifest the page links, its icons at the names the cloud serves, and
// its colours from the tokens.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { test } from 'node:test';

const PLAYER = new URL('../../../../player/', import.meta.url);
const read = (path: string) => fs.readFileSync(new URL(path, PLAYER));
const manifest = JSON.parse(String(read('public/player.webmanifest'))) as Record<string, unknown> & {
  icons: { src: string; sizes: string; type: string; purpose: string }[];
  related_applications: { platform: string; url: string }[];
};
const token = (name: string): string => {
  const css = String(fs.readFileSync(new URL('../../../../../packages/ui/tokens.css', import.meta.url)));
  const match = css.match(new RegExp(`--${name}:\\s*(#[0-9a-fA-F]{6})`));
  assert.ok(match, name);
  return match[1].toLowerCase();
};
/** A PNG's width and height, from its header. */
const pngSize = (bytes: Buffer): [number, number] => {
  assert.equal(bytes.subarray(1, 4).toString(), 'PNG');
  return [bytes.readUInt32BE(16), bytes.readUInt32BE(20)];
};

test('the manifest: its name, a stable id, standalone, and no start_url (an iPhone opens the page it was added from)', () => {
  assert.equal(manifest.name, 'Quina Musical');
  assert.equal(manifest.id, '/');
  assert.equal(manifest.scope, '/');
  assert.equal(manifest.display, 'standalone');
  assert.equal(manifest.lang, 'ca');
  assert.ok(!('start_url' in manifest));
  assert.equal(manifest.prefer_related_applications, false);
  assert.deepEqual(manifest.related_applications, [{ platform: 'webapp', url: '/player.webmanifest' }]);
});

test('the manifest’s colours are the night sky’s token, as the page’s theme-color', () => {
  const night = token('color-night');
  assert.equal(manifest.theme_color, night);
  assert.equal(manifest.background_color, night);
  assert.match(String(read('index.html')), new RegExp(`<meta name="theme-color" content="${night}"`));
});

test('the icons exist at the names and sizes the manifest and the cloud name', () => {
  const sizes: Record<string, number> = {
    'player-192.png': 192,
    'player-512.png': 512,
    'player-maskable-512.png': 512,
    'player-badge-96.png': 96,
    'apple-touch-icon-180.png': 180,
  };
  for (const [name, side] of Object.entries(sizes)) assert.deepEqual(pngSize(read(`public/icons/${name}`)), [side, side], name);
  for (const icon of manifest.icons) {
    const side = sizes[icon.src.replace('/icons/', '')];
    assert.ok(side, icon.src);
    assert.equal(icon.sizes, `${side}x${side}`);
    assert.equal(icon.type, 'image/png');
  }
  assert.ok(manifest.icons.some((i) => i.purpose === 'maskable'));
  assert.ok(manifest.icons.some((i) => i.purpose === 'any' && i.sizes === '192x192'));
  assert.ok(manifest.icons.some((i) => i.purpose === 'any' && i.sizes === '512x512'));
});

test('the player page links the manifest and the Apple icon at the site’s root', () => {
  const html = String(read('index.html'));
  assert.match(html, /<link rel="manifest" href="\/player\.webmanifest" \/>/);
  assert.match(html, /<link rel="apple-touch-icon" href="\/icons\/apple-touch-icon-180\.png" \/>/);
});
