// One Vite build for every screen, rooted at apps/: the engine's pages (show/engine/*.html, served at /show/engine/,
// and /show/<page> through the relay), the old test remote (show/remote/), and every other app with an
// index.html (console/, stage/, player/, admin/…) joins by itself. In development the relay (relay/server.ts) runs
// Vite as middleware, so the pages, /ws, /api and the audio share one origin on port 5174; `npm run build` writes
// apps/show/dist/ and `npm start` builds it and serves that instead. Per-app builds can come later. Every build
// stamps dist/build.json with its sources (relay/build-stamp.ts), so the relay never serves a stale one.
import path from 'node:path';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { defineConfig, type Plugin } from 'vite';
import { pageApps, sourceHashes, writeStamp } from './relay/build-stamp.ts';

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
/** Every other app with an index.html (build-stamp.ts's NOT_PAGES leaves out the rest: `ds`, the design system's
 *  gallery, is development only, so the dev server serves /ds/ and no phone ever downloads it). */
const appPages = Object.fromEntries(pageApps(root).map((name) => [name, `${name}/index.html`] as const));

/** The build's stamp: the sources' hashes as the build starts, written into dist/ once it's done. */
function buildStamp(): Plugin {
  let files: Record<string, string> = {};
  return {
    name: 'quina-build-stamp',
    apply: 'build',
    buildStart() {
      files = sourceHashes(repo);
    },
    closeBundle() {
      writeStamp(path.join(show, 'dist'), files);
    },
  };
}

const input = Object.fromEntries(
  Object.entries({ ...SHOW_PAGES, ...appPages }).map(([name, file]) => [name, path.join(root, file)] as const),
);

export default defineConfig({
  root,
  // Audio, covers and data come from the relay, not from a Vite public folder.
  publicDir: false,
  plugins: [svelte(), buildStamp()],
  // A live show page must never reload itself because a file changed: no HMR (a manual reload picks up edits).
  server: { hmr: false, fs: { allow: [repo] } },
  build: {
    outDir: path.join(show, 'dist'),
    emptyOutDir: true,
    target: 'es2023',
    rolldownOptions: { input },
  },
});
