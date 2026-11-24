// One Vite app with several pages. In development the relay (relay/server.ts) runs Vite as middleware, so
// the pages, /ws, /api and the audio share one origin on port 5174; `npm run build` writes dist/ and
// `npm start` serves that instead.
import fs from 'node:fs';
import path from 'node:path';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { defineConfig } from 'vite';

const root = import.meta.dirname;

/** Every page; console/ and stage/ (the UI session's apps) join automatically once they exist. */
const PAGES: Record<string, string> = {
  home: 'engine/index.html',
  show: 'engine/show.html',
  audition: 'engine/audition.html',
  test: 'engine/test.html',
  admin: 'admin/index.html',
  console: 'console/index.html',
  stage: 'stage/index.html',
};

const input = Object.fromEntries(
  Object.entries(PAGES)
    .map(([name, file]) => [name, path.join(root, file)] as const)
    .filter(([, file]) => fs.existsSync(file)),
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
