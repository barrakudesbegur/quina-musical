// The CSS order check: the same screens in development (Vite's dev server) and in the build must compute the same
// styles. Vite loads the stylesheets in another order in each (dev: as the modules run; the build: shared chunks
// first, per chunk), so two rules of equal weight in one cascade layer can flip between them. The layers
// (packages/ui/README.md › Cascade layers) make the order between layers explicit; this catches what's left.
//
//   npm run check:css                      build into a scratch folder, serve it and the dev server, compare (exit 1 on a difference)
//   npm run check:css -- --only console    only the screens whose name contains "console"
//   npm run check:css -- --shots <dir>     also save both sides' screenshots (<name>.dev.png, <name>.build.png)
//   npm run check:css -- --no-gallery      skip the gallery (/ds/, development only: it gets a build of its own here)
//   npm run check:css -- --save <dir>      also keep both sides' records (dev.json, build.json) for `diff` later
//   node tools/e2e/css-order/check.ts snap <relay url> <out.json> [--only …]   record one server's screens
//   node tools/e2e/css-order/check.ts diff <a.json> <b.json>                   compare two records (before/after a change)
//
// Every page runs on a frozen clock (Playwright's), stepped forward the same way on both sides, and its animations
// are cancelled before reading, so what differs is the cascade, not timing. Relays on free ports with a scratch cloud
// link folder; Chrome through Playwright, whose throwaway profile is deleted when it closes.
import { spawn, spawnSync, type ChildProcess } from 'node:child_process';
import fs from 'node:fs';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { chromium, type Browser } from '@playwright/test';
import { PAGES, type CheckPage } from './pages.ts';
import { PROPS, comparePages, dumpPage, formatComparison, type PageSnapshot } from './snapshot.ts';

const REPO = path.resolve(import.meta.dirname, '../../..');
const SHOW = path.join(REPO, 'apps', 'show');
/** The clock every page starts at: a show night, so the fixtures' times are the same on both sides. */
const CLOCK_START = new Date('2026-12-27T21:00:00+01:00');
/** Real time for the page's modules, fonts and data to load before the clock moves. */
const LOAD_MS = 2500;
/** Fake time stepped through once loaded: the boot, the fixtures' scripted events, the drawers opening. */
const RUN_MS = 6000;

const args = process.argv.slice(2);
const flag = (name: string) => args.includes(name);
const option = (name: string) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
};
const only = option('--only');
const selected = (gallery: boolean) => PAGES.filter((p) => (!only || p.name.includes(only)) && (gallery || !p.gallery));

async function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address() as net.AddressInfo;
      server.close(() => resolve(port));
    });
    server.on('error', reject);
  });
}

interface Server {
  url: string;
  stop: () => Promise<void>;
}

/** The relay on a free port: Vite's dev server, or a build (`--dist-dir`). Its cloud link folder is a scratch one. */
async function startRelay(distDir?: string): Promise<Server> {
  const port = await freePort();
  const linkDir = fs.mkdtempSync(path.join(os.tmpdir(), 'quina-css-link-'));
  const extra = distDir ? ['--dist', '--dist-dir', distDir] : [];
  const child: ChildProcess = spawn(process.execPath, ['relay/server.ts', '--port', String(port), ...extra], {
    cwd: SHOW,
    stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env, QUINA_LINK_DIR: linkDir },
  });
  let output = '';
  child.stdout?.on('data', (d) => (output += d));
  child.stderr?.on('data', (d) => (output += d));
  const url = `http://127.0.0.1:${port}`;
  const stop = async () => {
    if (child.exitCode === null) {
      const exited = new Promise((resolve) => child.once('exit', resolve));
      const killer = setTimeout(() => child.kill('SIGKILL'), 5000);
      child.kill();
      await exited;
      clearTimeout(killer);
    }
    fs.rmSync(linkDir, { recursive: true, force: true });
  };
  for (let i = 0; i < 200; i++) {
    if (child.exitCode !== null) break;
    try {
      if ((await fetch(`${url}/api/repertoire`)).ok) return { url, stop };
    } catch {
      // not up yet
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  await stop();
  throw new Error(`the relay did not start:\n${output}`);
}

/** The production build, into a scratch folder (apps/show/dist is left alone). */
function buildInto(outDir: string): void {
  const r = spawnSync('npx', ['vite', 'build', '--outDir', outDir, '--emptyOutDir', '--logLevel', 'warn'], { cwd: SHOW, stdio: 'inherit' });
  if (r.status !== 0) throw new Error('vite build failed');
}

/** The gallery alone, built the way the screens are (it's never part of the real build: development only). */
function buildGalleryInto(outDir: string): void {
  const r = spawnSync('npx', ['vite', 'build', '--outDir', outDir, '--emptyOutDir', '--logLevel', 'warn'], {
    cwd: SHOW,
    stdio: 'inherit',
    env: { ...process.env, QUINA_BUILD_GALLERY: '1' },
  });
  if (r.status !== 0) throw new Error('vite build (gallery) failed');
}

async function snapshot(browser: Browser, base: string, page: CheckPage, shot?: string): Promise<PageSnapshot> {
  const context = await browser.newContext({ viewport: { width: page.width, height: page.height }, serviceWorkers: 'block' });
  const tab = await context.newPage();
  try {
    await tab.clock.install({ time: CLOCK_START });
    await tab.clock.pauseAt(CLOCK_START);
    const url = base + page.path;
    await tab.goto(url, { waitUntil: 'load' });
    await tab.waitForTimeout(LOAD_MS);
    await tab.evaluate(() => document.fonts.ready.then(() => undefined));
    await tab.clock.runFor(RUN_MS);
    if (page.click) {
      await tab.click(page.click);
      await tab.clock.runFor(RUN_MS);
    }
    if (page.focus) {
      // Focus by the keyboard's path, so :focus-visible matches as it does for a presenter's or a player's tab key.
      await tab.focus(page.focus);
      await tab.keyboard.press('Shift');
      await tab.clock.runFor(1000);
    }
    // Finish what's still running and let the page react (an element that leaves when its animation ends), so neither
    // side's real loading time decides what's on screen; the looping ones are cancelled by the dump.
    for (let i = 0; i < 3; i++) {
      await tab.evaluate(() => {
        for (const a of document.getAnimations()) if (Number.isFinite(a.effect?.getComputedTiming().endTime ?? Infinity)) a.finish();
      });
      await tab.waitForTimeout(100);
      await tab.clock.runFor(500);
    }
    await tab.waitForTimeout(200);
    const dump = await tab.evaluate(dumpPage, PROPS);
    if (shot) await tab.screenshot({ path: shot, animations: 'disabled' });
    return { name: page.name, url: page.path, ...dump };
  } finally {
    await context.close();
  }
}

async function snapshotAll(browser: Browser, base: string, pages: readonly CheckPage[], shots?: { dir: string; label: string }): Promise<PageSnapshot[]> {
  const out: PageSnapshot[] = [];
  for (const page of pages) {
    out.push(await snapshot(browser, base, page, shots ? path.join(shots.dir, `${page.name}.${shots.label}.png`) : undefined));
    process.stdout.write('.');
  }
  process.stdout.write('\n');
  return out;
}

/** Compares two sides page by page; prints the differences and returns how many pages differ. */
function report(a: PageSnapshot[], b: PageSnapshot[], labels: [string, string]): number {
  let failing = 0;
  for (const pa of a) {
    const pb = b.find((p) => p.name === pa.name);
    if (!pb) {
      console.log(`✗ ${pa.name}: not in ${labels[1]}`);
      failing++;
      continue;
    }
    for (const [label, side] of [[labels[0], pa], [labels[1], pb]] as const) {
      // A worktree whose node_modules links to another checkout: Vite refuses the font files (server.fs.allow).
      if (side.fontErrors?.length) console.log(`! ${pa.name}: fonts failed to load in ${label} (${side.fontErrors.join(', ')}): the widths can't compare`);
    }
    const c = comparePages(pa, pb);
    if (!c.diffs.length && !c.onlyA.length && !c.onlyB.length) {
      console.log(`✓ ${pa.name}`);
      continue;
    }
    failing++;
    console.log(`✗ ${pa.name} (${pa.url}): ${c.diffs.length} values differ, ${c.onlyA.length + c.onlyB.length} elements unmatched\n${formatComparison(c, labels)}`);
  }
  return failing;
}

async function launch(): Promise<Browser> {
  // The installed Chrome (as the e2e test locally); Playwright gives it a throwaway profile and deletes it on close.
  return chromium.launch({ channel: process.env.PLAYWRIGHT_BROWSERS === 'bundled' ? undefined : 'chrome' });
}

async function main(): Promise<number> {
  const [command] = args;
  if (command === 'diff') {
    const [, fileA, fileB] = args;
    if (!fileA || !fileB) throw new Error('usage: check.ts diff <a.json> <b.json>');
    const read = (f: string) => JSON.parse(fs.readFileSync(f, 'utf8')) as PageSnapshot[];
    return report(read(fileA), read(fileB), [path.basename(fileA, '.json'), path.basename(fileB, '.json')]) ? 1 : 0;
  }
  if (command === 'snap') {
    const [, base, outFile] = args;
    if (!base || !outFile) throw new Error('usage: check.ts snap <relay url> <out.json>');
    const browser = await launch();
    try {
      const shots = option('--shots');
      if (shots) fs.mkdirSync(shots, { recursive: true });
      const snaps = await snapshotAll(browser, base, selected(true), shots ? { dir: shots, label: path.basename(outFile, '.json') } : undefined);
      fs.writeFileSync(outFile, JSON.stringify(snaps));
    } finally {
      await browser.close();
    }
    return 0;
  }

  const started = Date.now();
  const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'quina-css-order-'));
  const shots = option('--shots');
  if (shots) fs.mkdirSync(shots, { recursive: true });
  const servers: Server[] = [];
  let browser: Browser | undefined;
  try {
    const withGallery = !flag('--no-gallery') && selected(true).some((p) => p.gallery);
    buildInto(path.join(scratch, 'dist'));
    if (withGallery) buildGalleryInto(path.join(scratch, 'gallery'));
    const dev = await startRelay();
    servers.push(dev);
    const build = await startRelay(path.join(scratch, 'dist'));
    servers.push(build);
    const galleryBuild = withGallery ? await startRelay(path.join(scratch, 'gallery')) : undefined;
    if (galleryBuild) servers.push(galleryBuild);
    browser = await launch();
    const screens = selected(false);
    const galleryPages = withGallery ? selected(true).filter((p) => p.gallery) : [];
    const shotsFor = (label: string) => (shots ? { dir: shots, label } : undefined);
    const devSnaps = await snapshotAll(browser, dev.url, [...screens, ...galleryPages], shotsFor('dev'));
    const buildSnaps = [
      ...(await snapshotAll(browser, build.url, screens, shotsFor('build'))),
      ...(galleryBuild ? await snapshotAll(browser, galleryBuild.url, galleryPages, shotsFor('build')) : []),
    ];
    const save = option('--save');
    if (save) {
      fs.mkdirSync(save, { recursive: true });
      fs.writeFileSync(path.join(save, 'dev.json'), JSON.stringify(devSnaps));
      fs.writeFileSync(path.join(save, 'build.json'), JSON.stringify(buildSnaps));
    }
    const failing = report(devSnaps, buildSnaps, ['dev', 'build']);
    console.log(`${devSnaps.length} screens, ${failing} differ (${Math.round((Date.now() - started) / 1000)} s)`);
    return failing ? 1 : 0;
  } finally {
    await browser?.close();
    for (const s of servers) await s.stop();
    fs.rmSync(scratch, { recursive: true, force: true });
  }
}

process.exitCode = await main();
