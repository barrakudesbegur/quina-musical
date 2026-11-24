// One Vite app with several pages (new top-level apps with an index.html join the build by themselves). In development the relay (relay/server.ts) runs Vite as middleware, so
// the pages, /ws, /api and the audio share one origin on port 5174; `npm run build` writes dist/ and
// `npm start` serves that instead.
import fs from 'node:fs';
import path from 'node:path';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { defineConfig } from 'vite';

const root = import.meta.dirname;

/** The engine's pages, plus every `<dir>/index.html` at the top (admin/, console/, stage/, player/, manage/…). */
const ENGINE_PAGES: Record<string, string> = {
  home: 'engine/index.html',
  show: 'engine/show.html',
  audition: 'engine/audition.html',
  test: 'engine/test.html',
};
const NOT_PAGES = new Set(['engine', 'node_modules', 'dist', 'cache', 'reference', 'data', 'analysis', 'tests', 'docs', 'reports', 'research_notes', 'protocol', 'relay']);
const appPages = Object.fromEntries(
  fs.readdirSync(root, { withFileTypes: true })
    .filter((d) => d.isDirectory() && !d.name.startsWith('.') && !NOT_PAGES.has(d.name) && fs.existsSync(path.join(root, d.name, 'index.html')))
    .map((d) => [d.name, `${d.name}/index.html`] as const),
);

const input = Object.fromEntries(
  Object.entries({ ...ENGINE_PAGES, ...appPages }).map(([name, file]) => [name, path.join(root, file)] as const),
);

export default defineConfig({
  root,
  // Audio, covers and data come from the relay, not from a Vite public folder.
  publicDir: false,
  plugins: [svelte()],
  // A live show page must never reload itself because a file changed: no HMR (a manual reload picks up edits).
  server: { hmr: false },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    target: 'es2023',
    rolldownOptions: { input },
  },
});
