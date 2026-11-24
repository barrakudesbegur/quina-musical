// Assemble the static files the Worker serves (wrangler.jsonc `assets.directory` = dist/), at deploy time:
//   npm run assets -- [--quick] [--pool default] [--ui ../show/dist]
// It copies static/ (committed: the kill switch for last year's service worker, _headers, a placeholder page).
// Unless --quick, it then adds, as agreed with the UI session:
//   - the UI build (`npm run build` in apps/show): the player at the root (the SPA fallback serves it for
//     /26/123), console/, admin/, assets/; never stage/ (the projector runs on the laptop);
//   - the pool's printed cards: cards/cards.json;
//   - the pool's covers, small, as JPEG XL with a JPEG fallback (the user's choice: JXL, never WebP):
//     covers/<songId>.jxl and covers/<songId>.jpg, both at most 256 px a side (sips, then cjxl; cached in
//     .assets-cache/). Pages use <picture><source type="image/jxl" srcset=".jxl"><img src=".jpg"></picture>.
// dist/ and .assets-cache/ are gitignored: the built UI and the album covers never go into the public repo.
// Static files are free and never run the Worker.
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { loadPool } from '../../show/relay/pool.ts';

const ROOT = path.resolve(import.meta.dirname, '..');
const OUT = path.join(ROOT, 'dist');
const CACHE = path.join(ROOT, '.assets-cache', 'covers');
/** Covers: the longest side in px, the JPEG fallback's quality, and the JXL distance (1 = visually lossless). */
const COVER = Object.freeze({ sizePx: 256, jpegQuality: 80, jxlDistance: 1.5, jxlEffort: 7 });

const args = process.argv.slice(2);
const flag = (name: string): string | undefined => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
};
const quick = args.includes('--quick');
const uiDir = path.resolve(ROOT, flag('--ui') ?? '../show/dist');

const kb = (bytes: number) => `${(bytes / 1024).toFixed(0)} KB`;
const sizeOf = (dir: string): number =>
  fs.existsSync(dir) ? fs.readdirSync(dir, { recursive: true, withFileTypes: true }).filter((e) => e.isFile()).reduce((sum, e) => sum + fs.statSync(path.join(e.parentPath, e.name)).size, 0) : 0;
const warnings: string[] = [];

fs.rmSync(OUT, { recursive: true, force: true });
fs.cpSync(path.join(ROOT, 'static'), OUT, { recursive: true });
const lines = [`static/ → dist/`];

if (!quick) {
  // ---- the UI build ------------------------------------------------------------------------------------------
  const ui: [from: string, to: string][] = [
    ['player/index.html', 'index.html'],
    ['console', 'console'],
    ['admin', 'admin'],
    ['assets', 'assets'],
  ];
  for (const [from, to] of ui) {
    const source = path.join(uiDir, from);
    if (!fs.existsSync(source)) {
      warnings.push(`no ${path.relative(ROOT, source)}: build the UI first (npm run build in apps/show)`);
      continue;
    }
    fs.cpSync(source, path.join(OUT, to), { recursive: true });
    lines.push(`${path.relative(ROOT, source)} → dist/${to}`);
  }

  // ---- the pool: cards and covers ----------------------------------------------------------------------------
  const pool = loadPool(flag('--pool'));
  if (pool.cardsJson && fs.existsSync(pool.cardsJson)) {
    fs.mkdirSync(path.join(OUT, 'cards'), { recursive: true });
    fs.copyFileSync(pool.cardsJson, path.join(OUT, 'cards', 'cards.json'));
    lines.push(`cards (pool ${pool.name}) → dist/cards/cards.json`);
  } else {
    warnings.push(`pool ${pool.name} has no cards.json yet`);
  }

  const covers = fs.existsSync(pool.coversDir) ? fs.readdirSync(pool.coversDir).filter((f) => /^\d+\.(jpe?g|png|webp)$/i.test(f)) : [];
  if (covers.length === 0) warnings.push(`pool ${pool.name} has no covers in ${pool.coversDir}`);
  else {
    for (const tool of ['sips', 'cjxl']) {
      try {
        execFileSync(tool, tool === 'sips' ? ['--help'] : ['--version'], { stdio: 'ignore' });
      } catch {
        throw new Error(`covers need ${tool} (${tool === 'cjxl' ? 'brew install jpeg-xl' : 'macOS'}), or run with --quick`);
      }
    }
    fs.mkdirSync(CACHE, { recursive: true });
    fs.mkdirSync(path.join(OUT, 'covers'), { recursive: true });
    let encoded = 0;
    const settings = `${COVER.sizePx}px-q${COVER.jpegQuality}-d${COVER.jxlDistance}e${COVER.jxlEffort}`;
    for (const file of covers) {
      const source = path.join(pool.coversDir, file);
      const id = file.split('.')[0] as string;
      const stat = fs.statSync(source);
      // The cache key is the source's size and time and the settings, so a changed cover is encoded again.
      const key = path.join(CACHE, `${pool.name}-${id}-${stat.size}-${Math.floor(stat.mtimeMs)}-${settings}`);
      if (!fs.existsSync(`${key}.jxl`) || !fs.existsSync(`${key}.jpg`)) {
        const size = String(COVER.sizePx);
        // One resize to a lossless PNG, then each format from it (the JXL never re-encodes a JPEG).
        execFileSync('sips', ['-Z', size, '-s', 'format', 'png', source, '--out', `${key}.tmp.png`], { stdio: 'ignore' });
        execFileSync('sips', ['-s', 'format', 'jpeg', '-s', 'formatOptions', String(COVER.jpegQuality), `${key}.tmp.png`, '--out', `${key}.tmp.jpg`], { stdio: 'ignore' });
        execFileSync('cjxl', [`${key}.tmp.png`, `${key}.tmp.jxl`, '-d', String(COVER.jxlDistance), '-e', String(COVER.jxlEffort), '--quiet'], { stdio: 'ignore' });
        fs.renameSync(`${key}.tmp.jpg`, `${key}.jpg`);
        fs.renameSync(`${key}.tmp.jxl`, `${key}.jxl`);
        fs.rmSync(`${key}.tmp.png`, { force: true });
        encoded += 1;
      }
      fs.copyFileSync(`${key}.jxl`, path.join(OUT, 'covers', `${id}.jxl`));
      fs.copyFileSync(`${key}.jpg`, path.join(OUT, 'covers', `${id}.jpg`));
    }
    const ofType = (ext: string) => fs.readdirSync(path.join(OUT, 'covers')).filter((f) => f.endsWith(ext)).reduce((sum, f) => sum + fs.statSync(path.join(OUT, 'covers', f)).size, 0);
    lines.push(`${covers.length} covers (pool ${pool.name}, ${encoded} encoded now) → dist/covers/<id>.jxl (${kb(ofType('.jxl'))}) and .jpg (${kb(ofType('.jpg'))}), from ${kb(sizeOf(pool.coversDir))}`);
  }
}

console.log(`static assets: ${lines.join('; ')}. dist/ is ${kb(sizeOf(OUT))}.`);
for (const warning of warnings) console.warn(`  warning: ${warning}`);
