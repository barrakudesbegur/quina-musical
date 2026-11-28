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
import { LAYER_STATEMENT } from '../../packages/ui/layers.ts';

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
/** The CSS order check (tools/e2e/css-order) builds the gallery too, into a scratch folder of its own, to compare it
 *  with the dev server's: QUINA_BUILD_GALLERY=1. Never in a real build. */
const galleryBuild = Boolean(process.env.QUINA_BUILD_GALLERY);
const galleryPage: Record<string, string> = galleryBuild ? { ds: 'ds/index.html' } : {};

/**
 * The gallery's build only (QUINA_BUILD_GALLERY): each stylesheet module's CSS starts with a rule naming its file,
 * `ds-source { --ds-source: "packages/ui/tokens.css" }` (an element no page has), after its @charset and @imports. In
 * development every module is a <style> with Vite's id, so the gallery's Tokens section (apps/ds/sections/tokens.ts)
 * knows each rule's file; the build bundles them into a few sheets, and these marks keep that knowledge. With the CSS
 * left unminified, a declaration reads as written in both, so the section lists the same tokens and values.
 */
function galleryCssSources(): Plugin {
  const STYLE = /\.(css|svelte)$/;
  const LEAD = /^(?:\s+|\/\*[\s\S]*?\*\/|@(?:charset|import)\b[^;]*;)*/;
  return {
    name: 'quina-gallery-css-sources',
    apply: 'build',
    transform(code, id) {
      const [file = '', query = ''] = id.split('?');
      const css = file.endsWith('.css') ? !/(^|&)(raw|url)\b/.test(query) : /(^|&)type=style\b/.test(query);
      if (!STYLE.test(file) || !css || file.includes('/node_modules/') || !file.startsWith(`${repo}/`)) return null;
      const lead = code.match(LEAD)?.[0] ?? '';
      const mark = `ds-source { --ds-source: ${JSON.stringify(path.relative(repo, file))}; }\n`;
      return { code: lead + mark + code.slice(lead.length), map: null };
    },
  };
}

/**
 * The cascade layers' order (packages/ui/layers.ts), first thing in every page's <head>, before any stylesheet: in
 * development Vite adds each module's CSS as it runs, and the build links its chunks shared ones first, so the first
 * stylesheet differs between the two. Declared here, the order is the same in both, whatever loads first.
 */
function cascadeLayers(): Plugin {
  return {
    name: 'quina-css-layers',
    transformIndexHtml: () => [{ tag: 'style', children: LAYER_STATEMENT, injectTo: 'head-prepend' }],
  };
}

/** The build's stamp: the sources' hashes as the build starts, written into dist/ (the build's outDir) once it's done. */
function buildStamp(): Plugin {
  let files: Record<string, string> = {};
  let outDir = path.join(show, 'dist');
  return {
    name: 'quina-build-stamp',
    apply: 'build',
    configResolved(config) {
      outDir = config.build.outDir;
    },
    buildStart() {
      files = sourceHashes(repo);
    },
    closeBundle() {
      writeStamp(outDir, files);
    },
  };
}

const input = Object.fromEntries(
  Object.entries({ ...SHOW_PAGES, ...appPages, ...galleryPage }).map(([name, file]) => [name, path.join(root, file)] as const),
);

/**
 * The player's service worker (D222): apps/player/sw/player-sw.ts, bundled on its own once the pages are written, as
 * one classic script at dist/player-sw.js (the cloud serves it at the root, no-cache). It gets the player page's own
 * files to keep for offline and an id of them, so any deploy that changes the player changes the worker's bytes, and
 * phones take the new version at their next update check. Never in development: the dev pages register no worker.
 */
function playerWorker(): Plugin {
  let precache: string[] = [];
  let dist = path.join(show, 'dist');
  return {
    name: 'quina-player-worker',
    apply: 'build',
    configResolved(config) {
      dist = config.build.outDir;
    },
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
  plugins: [cascadeLayers(), svelte(), buildStamp(), playerWorker(), ...(galleryBuild ? [galleryCssSources()] : [])],
  // A live show page must never reload itself because a file changed: no HMR (a manual reload picks up edits).
  server: { hmr: false, fs: { allow: [repo] } },
  build: {
    outDir: path.join(show, 'dist'),
    emptyOutDir: true,
    target: 'es2023',
    // The gallery's build keeps its CSS as written (galleryCssSources), as the dev server serves it.
    ...(galleryBuild ? { cssMinify: false } : {}),
    rolldownOptions: { input },
  },
});
