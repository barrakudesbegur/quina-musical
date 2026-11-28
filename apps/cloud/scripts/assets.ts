// Assemble the static files the Worker serves (wrangler.jsonc `assets.directory` = dist/), at deploy time:
//   npm run assets -- [--quick] [--repertoire NAME] [--ui ../show/dist] [--out dist]
// A deploy names its repertoire (QUINA_REPERTOIRE=2026 npm run deploy, or --repertoire): the cards and covers on the
// QR domain are never a default's. Only dist/ needs it; a test's own --out (tools/e2e) falls back to the night's
// (relay/repertoire.ts NIGHT_REPERTOIRE).
// It copies static/ (committed: the kill switch for last year's service worker, _headers, a placeholder page).
// Unless --quick, it then adds, as agreed with the UI session:
//   - the UI build (`npm run build` in apps/show): the player at the root (the SPA fallback serves it for
//     /26/123), console/, admin/, assets/; never stage/ (the projector runs on the laptop);
//   - the player's PWA (D221, D222), at the root: player-sw.js, player.webmanifest and icons/ (static/_headers
//     never lets phones keep them);
//   - the repertoire's printed cards: cards/cards.json, and card-types.json from the same folder (each type's name,
//     colour, title and price; rounds name the type they play);
//   - the repertoire's covers, small, as JPEG XL with a JPEG fallback (the user's choice: JXL, never WebP):
//     covers/<songId>.jxl and covers/<songId>.jpg, both at most 256 px a side (sips, then cjxl; cached in
//     .assets-cache/). Pages use <picture><source type="image/jxl" srcset=".jxl"><img src=".jpg"></picture>.
// dist/ and .assets-cache/ are gitignored: the built UI and the album covers never go into the public repo.
// Static files are free and never run the Worker.
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { loadRepertoire, NIGHT_REPERTOIRE, REPERTOIRE_ENV } from '../../show/relay/repertoire.ts';

const ROOT = path.resolve(import.meta.dirname, '..');

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
/** Where to assemble them: dist/ (what wrangler.jsonc serves and deploys), or elsewhere for a test (tools/e2e). */
const OUT = path.resolve(ROOT, flag('--out') ?? 'dist');

const kb = (bytes: number) => `${(bytes / 1024).toFixed(0)} KB`;
const sizeOf = (dir: string): number =>
  fs.existsSync(dir) ? fs.readdirSync(dir, { recursive: true, withFileTypes: true }).filter((e) => e.isFile()).reduce((sum, e) => sum + fs.statSync(path.join(e.parentPath, e.name)).size, 0) : 0;
const warnings: string[] = [];

const deploying = !quick && OUT === path.join(ROOT, 'dist');
if (deploying && !flag('--repertoire') && !process.env[REPERTOIRE_ENV]) {
  console.error(`name the repertoire this deploy serves: ${REPERTOIRE_ENV}=${NIGHT_REPERTOIRE} npm run deploy (or npm run assets -- --repertoire ${NIGHT_REPERTOIRE})`);
  process.exit(1);
}
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

  // ---- the player's PWA (D221, D222): its worker, manifest and icons, from the UI build's public folder ---------
  const pwa = ['player-sw.js', 'player.webmanifest', 'icons'];
  const missing = pwa.filter((name) => !fs.existsSync(path.join(uiDir, name)));
  for (const name of pwa.filter((name) => !missing.includes(name))) fs.cpSync(path.join(uiDir, name), path.join(OUT, name), { recursive: true });
  if (missing.length < pwa.length) lines.push(`the player's PWA (${pwa.filter((name) => !missing.includes(name)).join(', ')}) → dist/`);
  if (missing.length > 0) warnings.push(`the UI build has no ${missing.join(', ')}: phones can't install the player (D221)`);

  // ---- the repertoire: cards and covers ----------------------------------------------------------------------
  const repertoire = loadRepertoire(flag('--repertoire'));
  if (repertoire.cardsJson && fs.existsSync(repertoire.cardsJson)) {
    fs.mkdirSync(path.join(OUT, 'cards'), { recursive: true });
    fs.copyFileSync(repertoire.cardsJson, path.join(OUT, 'cards', 'cards.json'));
    lines.push(`cards (repertoire ${repertoire.name}) → dist/cards/cards.json`);
    // Beside cards.json, as apps/cards writes it and the relay serves it (/cards/ is that folder).
    const types = path.join(path.dirname(repertoire.cardsJson), 'card-types.json');
    if (fs.existsSync(types)) {
      fs.copyFileSync(types, path.join(OUT, 'cards', 'card-types.json'));
      lines.push('dist/cards/card-types.json');
    } else {
      warnings.push(`repertoire ${repertoire.name} has no card-types.json beside its cards.json: phones show no card type names`);
    }
  } else {
    warnings.push(`repertoire ${repertoire.name} has no cards.json yet`);
  }

  const covers = fs.existsSync(repertoire.coversDir) ? fs.readdirSync(repertoire.coversDir).filter((f) => /^\d+\.(jpe?g|png|webp)$/i.test(f)) : [];
  if (covers.length === 0) warnings.push(`repertoire ${repertoire.name} has no covers in ${repertoire.coversDir}`);
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
      const source = path.join(repertoire.coversDir, file);
      const id = file.split('.')[0] as string;
      const stat = fs.statSync(source);
      // The cache key is the source's size and time and the settings, so a changed cover is encoded again.
      const key = path.join(CACHE, `${repertoire.name}-${id}-${stat.size}-${Math.floor(stat.mtimeMs)}-${settings}`);
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
    lines.push(`${covers.length} covers (repertoire ${repertoire.name}, ${encoded} encoded now) → dist/covers/<id>.jxl (${kb(ofType('.jxl'))}) and .jpg (${kb(ofType('.jpg'))}), from ${kb(sizeOf(repertoire.coversDir))}`);
  }
}

console.log(`static assets: ${lines.join('; ')}. dist/ is ${kb(sizeOf(OUT))}.`);
for (const warning of warnings) console.warn(`  warning: ${warning}`);
