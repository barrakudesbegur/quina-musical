// One Vite build for every screen, rooted at apps/: the engine's pages (show/engine/*.html, served at /show/engine/,
// and /show/<page> through the relay), the old test remote (show/remote/), and every other app with an
// index.html (console/, stage/, player/, admin/…) joins by itself. In development the relay (relay/server.ts) runs
// Vite as middleware, so the pages, /ws, /api and the audio share one origin on port 5174; `npm run build` writes
// apps/show/dist/ and `npm start` builds it and serves that instead. Per-app builds can come later. Every build
// stamps dist/build.json with its sources (relay/build-stamp.ts), so the relay never serves a stale one.
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { build, defineConfig, type Plugin, type Rolldown } from 'vite';
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

/**
 * The player's service worker (D222): apps/player/sw/player-sw.ts, bundled on its own once the pages are written, as
 * one classic script at dist/player-sw.js (the cloud serves it at the root, no-cache). It gets the player page's own
 * files to keep for offline and an id of them, so any deploy that changes the player changes the worker's bytes, and
 * phones take the new version at their next update check. Never in development: the dev pages register no worker.
 */
function playerWorker(): Plugin {
  let precache: string[] = [];
  return {
    name: 'quina-player-worker',
    apply: 'build',
    generateBundle(_options, bundle) {
      const chunks = new Map(Object.values(bundle).filter((f): f is Rolldown.OutputChunk => f.type === 'chunk').map((c) => [c.fileName, c]));
      const entry = [...chunks.values()].find((c) => c.isEntry && c.name === 'player');
      if (!entry) throw new Error('player-sw: no player entry in the bundle');
      const files = new Set<string>();
      const walk = (chunk: Rolldown.OutputChunk) => {
        if (files.has(chunk.fileName)) return;
        files.add(chunk.fileName);
        for (const css of chunk.viteMetadata?.importedCss ?? []) files.add(css);
        for (const asset of chunk.viteMetadata?.importedAssets ?? []) files.add(asset);
        for (const name of chunk.imports) {
          const next = chunks.get(name);
          if (next) walk(next);
        }
      };
      walk(entry);
      // Chrome and Safari take the .woff2: its .woff twin would only weigh on the phone.
      precache = [...files].filter((f) => !(f.endsWith('.woff') && [...files].some((o) => o.startsWith(f.replace(/-[\w-]+\.woff$/, '-')) && o.endsWith('.woff2')))).sort();
    },
    async closeBundle() {
      const dist = path.join(show, 'dist');
      // Only what was written (a chunk that held only CSS is dropped after generateBundle).
      precache = precache.filter((f) => fs.existsSync(path.join(dist, f))).map((f) => `/${f}`);
      const html = path.join(dist, 'player/index.html');
      if (!fs.existsSync(html) || !precache.length) return;
      const page = fs.readFileSync(html);
      const buildId = createHash('sha256').update(page).update(precache.join('\n')).update(fs.readFileSync(path.join(root, 'player/sw/player-sw.ts'))).update(fs.readFileSync(path.join(root, 'player/sw/routing.ts'))).digest('hex').slice(0, 12);
      await build({
        configFile: false,
        root: path.join(root, 'player/sw'),
        publicDir: false,
        logLevel: 'warn',
        define: { __QUINA_BUILD__: JSON.stringify(buildId), __QUINA_PRECACHE__: JSON.stringify(precache) },
        build: {
          outDir: dist,
          emptyOutDir: false,
          target: 'es2023',
          lib: { entry: path.join(root, 'player/sw/player-sw.ts'), formats: ['iife'], name: 'quinaPlayerWorker', fileName: () => 'player-sw.js' },
        },
      });
    },
  };
}

export default defineConfig({
  root,
  // The player's installable app (D221, D223): its manifest and icons, copied to dist/ as they are and served at the
  // site's root (apps/cloud's static/_headers: no-cache). Audio, covers and data come from the relay, not from here.
  publicDir: path.join(root, 'player/public'),
  plugins: [svelte(), buildStamp(), playerWorker()],
  // A live show page must never reload itself because a file changed: no HMR (a manual reload picks up edits).
  server: { hmr: false, fs: { allow: [repo] } },
  build: {
    outDir: path.join(show, 'dist'),
    emptyOutDir: true,
    target: 'es2023',
    rolldownOptions: { input },
  },
});
