// One Vite build for every screen, rooted at apps/: the engine's pages (show/engine/*.html, served at /show/engine/,
// and /show/<page> through the relay), the old test remote (show/remote/), and every other app with an
// index.html (console/, stage/, player/, admin/…) joins by itself. In development the relay (relay/server.ts) runs
// Vite as middleware, so the pages, /ws, /api and the audio share one origin on port 5174; `npm run build` writes
// apps/show/dist/ and `npm start` serves that instead. Per-app builds can come later.
import fs from 'node:fs';
import path from 'node:path';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { defineConfig } from 'vite';

const show = import.meta.dirname;
/** apps/: the build's root, so each app keeps its own URL (/console/, /player/…). */
const root = path.resolve(show, '..');
/** The repo: packages/ and the workspace's node_modules live outside the build root. */
const repo = path.resolve(root, '..');

/** The engine's pages, and the old test remote. */
const SHOW_PAGES: Record<string, string> = {
  home: 'show/engine/index.html',
  show: 'show/engine/show.html',
  audition: 'show/engine/audition.html',
  test: 'show/engine/test.html',
  remote: 'show/remote/index.html',
};
/** Apps that are not pages of this build. `ds`, the design system's gallery, is development only: the dev server
 *  serves /ds/, the build leaves it out, so no phone ever downloads it. */
const NOT_PAGES = new Set(['show', 'cloud', 'cards', 'ds', 'node_modules', 'dist']);
const appPages = Object.fromEntries(
  fs.readdirSync(root, { withFileTypes: true })
    .filter((d) => d.isDirectory() && !d.name.startsWith('.') && !NOT_PAGES.has(d.name) && fs.existsSync(path.join(root, d.name, 'index.html')))
    .map((d) => [d.name, `${d.name}/index.html`] as const),
);

const input = Object.fromEntries(
  Object.entries({ ...SHOW_PAGES, ...appPages }).map(([name, file]) => [name, path.join(root, file)] as const),
);

export default defineConfig({
  root,
  // Audio, covers and data come from the relay, not from a Vite public folder.
  publicDir: false,
  plugins: [svelte()],
  // A live show page must never reload itself because a file changed: no HMR (a manual reload picks up edits).
  server: { hmr: false, fs: { allow: [repo] } },
  build: {
    outDir: path.join(show, 'dist'),
    emptyOutDir: true,
    target: 'es2023',
    rolldownOptions: { input },
  },
});
