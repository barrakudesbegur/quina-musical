// Relay: the pages, the audio and a dumb WebSocket hub. No game logic lives here; the show page owns the state.
//   node relay/server.ts [--port 5174] [--host 0.0.0.0] [--dist] [--pool NAME|PATH]
// Pages are a Vite app (vite.config.ts): in development Vite runs here as middleware, so everything shares
// one origin; with --dist the relay serves the built dist/ instead (`npm run build` first).
// The build is rooted at apps/ (vite.config.ts): the engine's pages are /show/engine/*, and /show/<page> still works.
// The pool (--pool, else $QUINA_POOL, else "default"; relay/pool.ts reads data/pools/<name>.json) decides
// what the song routes serve; the URLs are the same for every pool. <cache> and <data> are its cacheDir and
// dataDir (data/cache/ and data/out/ for the default pool):
//   /audio/<id>.flac → <cache>/<id>/mix.flac, /stems/<id>/<stem>.<startSample>.flac → <cache>/<id>/stems/,
//   /signatures/<id>/<sigId>.flac → <cache>/<id>/signatures/, /snippets/<id>.flac → <cache>/<id>/snippet.flac
//   (a Check's 3 s from the song's best hook, tools/prep/snippets.py), /stretch/<id>/<render>/<part>.flac →
//   <cache>/stretch/ (POST /api/stretch renders B's bars before a hook at A's tempo), /analysis/* →
//   <data>/analysis/, /data/* → <data>/ (stems, keys, signatures, snippets, report.md, ...), /covers/<id>.jpg → its
//   coversDir, /cards/* → the folder of its cardsJson, GET/POST /api/override/<id> → its overridesDir (the
//   audition page saves there, then analyze.py and signatures.py re-derive the song), GET /api/pool → { name }.
// Not part of a pool: /fx/<name>.mp3 and /stingers/<name>.mp3 (data/media), /holdaudio/<name>.flac (data/cache/hold,
// Hold music decoded by tools/prep/hold.py) and /data/hold/* (data/out/hold, its loops), /intervalaudio/<slug>.flac
// (data/cache/interval, the Interval playlist decoded by tools/prep/interval.py) and /data/interval/*
// (data/out/interval, its tracks), /cloud/* (data/link, the cloud link's folder), /ws (WebSocket).
// Pool media is revalidated (ETag) instead of cached for a day: the same URL means another file in another pool.
// The hub forwards commands (@quina/protocol) to the show engine and the engine's events to everyone else.
import crypto from 'node:crypto';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { WebSocketServer, type WebSocket } from 'ws';
import {
  PROTOCOL_VERSION, REMOTE_STATUS_TYPE, ROLES, publicPlan, readRemoteStatus, remoteStatusMessage, revealedRounds,
  type RelayClients, type RelayPlan, type RemoteStatusMessage, type Role, type ShowState,
} from '@quina/protocol';
import { LaptopPlan, type CurrentPlan } from './plan.ts';
import { CACHE, DEFAULT_POOL, LINK, MEDIA, OUT, POOL_ENV, PREP, REPO, SHOW, display, loadPool, type Pool } from './pool.ts';

const DIST = path.join(SHOW, 'dist');
const args = process.argv.slice(2);
const argValue = (name: string, fallback: string): string => {
  const i = args.indexOf(name);
  return i >= 0 && args[i + 1] ? args[i + 1] : fallback;
};
const PORT = Number(argValue('--port', process.env.PORT || '5174'));
// Only this laptop by default; the hotspot's devices (tablet, admin phone, a split drum) need `--lan`.
const LAN = args.includes('--lan');
const HOST = argValue('--host', LAN ? '0.0.0.0' : '127.0.0.1');
const USE_DIST = args.includes('--dist');
const POOL: Pool = poolOrExit(argValue('--pool', process.env[POOL_ENV] || DEFAULT_POOL));
const ANALYSIS_DIR = path.join(POOL.dataDir, 'analysis');

function poolOrExit(spec: string): Pool {
  try {
    return loadPool(spec);
  } catch (error) {
    console.error(`relay: ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  }
}

const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.md': 'text/markdown; charset=utf-8',
  '.flac': 'audio/flac',
  '.mp3': 'audio/mpeg',
  '.jpg': 'image/jpeg',
  '.png': 'image/png',
  '.jxl': 'image/jxl',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.ogg': 'audio/ogg',
  '.wav': 'audio/wav',
  '.m4a': 'audio/mp4',
  '.woff2': 'font/woff2',
};

const LONG_CACHE = 'public, max-age=86400';
/** Pool files: the browser asks again every time and gets a 304 while the file (ETag) is the same. */
const REVALIDATE = 'no-cache';

/** Media and data the pages load at run time, longest prefix first. The pages themselves come from Vite (or dist/). */
const MOUNTS: [prefix: string, dir: string | null, cache: string][] = [
  ['/covers/', POOL.coversDir, REVALIDATE],
  ['/fx/', path.join(MEDIA, 'fx'), 'public, max-age=3600'],
  ['/stingers/', path.join(MEDIA, 'stingers'), 'public, max-age=3600'],
  ['/analysis/', ANALYSIS_DIR, 'no-store'],
  ['/data/hold/', path.join(OUT, 'hold'), 'no-store'],
  ['/data/interval/', path.join(OUT, 'interval'), 'no-store'],
  ['/data/', POOL.dataDir, 'no-store'],
  // The whole apps/cards output folder, as before; a pool without cards serves none (the engine falls back).
  ['/cards/', POOL.cardsJson && path.dirname(POOL.cardsJson), 'no-store'],
  // The laptop's cloud link folder, read-only (data/link/): the Game plan from Admin (plan.json), the journal
  // copy (current, journal/<gameId>.jsonl) and Admin's manual resume (resume.json). The show page's boot check
  // and the LAN screens read it; only the link writes it.
  ['/cloud/', LINK, 'no-store'],
];

/**
 * Admin's uploaded images (sponsor logos, prize pictures) as the cloud link keeps them (data/link/media/, fetched
 * for the plan's /media/ paths), so the projector shows them with no internet. Like the cloud, a .jxl with no
 * JPEG XL answers with the fallback's bytes, so a <picture> never breaks.
 */
function mediaTarget(key: string, ext: string): StaticTarget {
  const dir = path.join(LINK, 'media');
  const file = path.join(dir, `${key}.${ext}`);
  if (ext !== 'jxl' || fs.existsSync(file)) return { file, cache: 'public, max-age=31536000, immutable' };
  const fallback = ['png', 'jpg', 'webp'].map((e) => path.join(dir, `${key}.${e}`)).find((f) => fs.existsSync(f));
  return { file: fallback ?? file, cache: 'public, max-age=300' };
}

interface StaticTarget {
  file: string;
  cache: string;
}

function safeDecode(s: string): string {
  try {
    return decodeURIComponent(s);
  } catch {
    return s;
  }
}

/** A route of the pool with nothing behind it (no cards): always 404. */
const MISSING: StaticTarget = { file: '', cache: 'no-store' };

function resolveStatic(urlPath: string): StaticTarget | null {
  const cache = POOL.cacheDir;
  const audio = urlPath.match(/^\/audio\/(\d+)\.flac$/);
  if (audio) return { file: path.join(cache, audio[1], 'mix.flac'), cache: REVALIDATE };
  const stem = urlPath.match(/^\/stems\/(\d+)\/(drums|bass|vocals)\.(\d+)\.flac$/);
  if (stem) return { file: path.join(cache, stem[1], 'stems', `${stem[2]}.${stem[3]}.flac`), cache: REVALIDATE };
  const signature = urlPath.match(/^\/signatures\/(\d+)\/(\d+-[a-z]+-\d+)\.flac$/);
  if (signature) return { file: path.join(cache, signature[1], 'signatures', `${signature[2]}.flac`), cache: REVALIDATE };
  const snippet = urlPath.match(/^\/snippets\/(\d+)\.flac$/);
  if (snippet) return { file: path.join(cache, snippet[1], 'snippet.flac'), cache: REVALIDATE };
  const stretched = safeDecode(urlPath).match(/^\/stretch\/(\d+)\/(\d+-[a-z]+-\d+@[0-9.]+)\/(drums|bass|vocals|other|mix)\.flac$/);
  if (stretched) return { file: path.join(cache, 'stretch', stretched[1], stretched[2], `${stretched[3]}.flac`), cache: REVALIDATE };
  const hold = urlPath.match(/^\/holdaudio\/([A-Za-z0-9._-]+)\.flac$/);
  if (hold) return { file: path.join(CACHE, 'hold', `${hold[1]}.flac`), cache: LONG_CACHE };
  const interval = urlPath.match(/^\/intervalaudio\/([a-z0-9][a-z0-9-]*)\.flac$/);
  if (interval) return { file: path.join(CACHE, 'interval', `${interval[1]}.flac`), cache: REVALIDATE };
  if (urlPath === '/data/hold-report.md') return { file: path.join(OUT, 'hold-report.md'), cache: 'no-store' };
  const media = urlPath.match(/^\/media\/([0-9a-f]{32})\.(png|jpg|webp|jxl)$/);
  if (media) return mediaTarget(media[1] as string, media[2] as string);
  for (const [prefix, dir, cacheControl] of MOUNTS) {
    if (!urlPath.startsWith(prefix)) continue;
    return dir ? insideDir(dir, urlPath.slice(prefix.length), cacheControl) : MISSING;
  }
  return null;
}

/** A file under `dir`, or null if the path would leave it. */
function insideDir(dir: string, relUrl: string, cache: string): StaticTarget | null {
  let rel = safeDecode(relUrl);
  if (rel === '' || rel.endsWith('/')) rel += 'index.html';
  const file = path.resolve(dir, rel);
  if (!file.startsWith(dir + path.sep) && file !== dir) return null;
  return { file, cache };
}

/** Serve a file with range support. Resolves false when it does not exist. */
async function serveFile(req: http.IncomingMessage, res: http.ServerResponse, { file, cache }: StaticTarget): Promise<boolean> {
  let stat: fs.Stats;
  try {
    stat = await fsp.stat(file);
    if (stat.isDirectory()) return serveFile(req, res, { file: path.join(file, 'index.html'), cache });
  } catch {
    return false;
  }
  // Weak validator: which file (pools share URLs), its size and its mtime.
  const etag = `"${crypto.createHash('sha1').update(file).digest('hex').slice(0, 12)}-${stat.size.toString(36)}-${Math.floor(stat.mtimeMs).toString(36)}"`;
  const headers = {
    'content-type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream',
    'cache-control': cache,
    'accept-ranges': 'bytes',
    etag,
  };
  if (req.headers['if-none-match'] === etag) {
    res.writeHead(304, { 'cache-control': cache, etag }).end();
    return true;
  }
  const range = req.headers.range?.match(/^bytes=(\d*)-(\d*)$/);
  if (range) {
    const start = range[1] ? Number(range[1]) : stat.size - Number(range[2]);
    const end = range[1] && range[2] ? Math.min(Number(range[2]), stat.size - 1) : stat.size - 1;
    res.writeHead(206, { ...headers, 'content-range': `bytes ${start}-${end}/${stat.size}`, 'content-length': end - start + 1 });
    fs.createReadStream(file, { start, end }).pipe(res);
    return true;
  }
  res.writeHead(200, { ...headers, 'content-length': stat.size });
  if (req.method === 'HEAD') res.end();
  else fs.createReadStream(file).pipe(res);
  return true;
}

/** A request from this machine (the show page, the preflight), not from the hotspot's LAN. */
const isLoopback = (address: string | undefined): boolean => address === '127.0.0.1' || address === '::1' || address === '::ffff:127.0.0.1';
/** This machine, by loopback or by one of its own LAN addresses (the show page opened at the LAN URL). */
function isThisMachine(address: string | undefined): boolean {
  if (isLoopback(address)) return true;
  const plain = address?.replace(/^::ffff:/, '');
  return Object.values(os.networkInterfaces()).flat().some((i) => i?.address === plain);
}

/**
 * The relay token: LAN devices (tablet, admin phone, a split drum) send it in their hello; this laptop's own
 * pages need none. Kept in cache/ so a restart doesn't unpair the tablets; `--token` or QUINA_RELAY_TOKEN
 * override it.
 */
const TOKEN = relayToken();
function relayToken(): string {
  const given = argValue('--token', process.env.QUINA_RELAY_TOKEN ?? '');
  if (given) return given;
  const file = path.join(CACHE, 'relay-token');
  try {
    const stored = fs.readFileSync(file, 'utf8').trim();
    if (/^[A-Za-z0-9]{12,64}$/.test(stored)) return stored;
  } catch {}
  const alphabet = 'ABCDEFGHJKMNPQRSTVWXYZ23456789';
  const fresh = Array.from(crypto.getRandomValues(new Uint8Array(16)), (b) => alphabet[b % alphabet.length]).join('');
  try {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, fresh + '\n', { mode: 0o600 });
  } catch {}
  return fresh;
}

const notFound = (res: http.ServerResponse) => res.writeHead(404, { 'content-type': 'text/plain' }).end('not found');

function readBody(req: http.IncomingMessage, limit = 1 << 20): Promise<string> {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks: Buffer[] = [];
    req.on('data', (chunk: Buffer) => {
      size += chunk.length;
      if (size > limit) reject(new Error('body too large'));
      else chunks.push(chunk);
    });
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

const PYTHON = path.join(PREP, '.venv/bin/python');

/** Run an analysis script on this relay's pool. */
function runAnalysis(script: string, argv: string[]): Promise<{ code: number | null; output: string }> {
  return new Promise((resolve) => {
    const child = spawn(PYTHON, [path.join(PREP, script), '--pool', POOL.manifest, ...argv], { cwd: REPO });
    let output = '';
    child.stdout.on('data', (d) => (output += d));
    child.stderr.on('data', (d) => (output += d));
    child.on('error', (error) => (output += String(error)));
    child.on('close', (code) => resolve({ code, output: output.split('\n').filter((l) => !/warn/i.test(l)).join('\n').trim() }));
  });
}

/** Re-apply a song's overrides: the analysis, then the Signature approvals. */
async function rederive(songId: number): Promise<{ code: number | null; output: string }> {
  const song = ['--derive-only', '--song', String(songId)];
  const analysis = await runAnalysis('analyze.py', song);
  if (analysis.code !== 0) return analysis;
  const signatures = await runAnalysis('signatures.py', song);
  return { code: signatures.code, output: [analysis.output, signatures.output].filter(Boolean).join('\n') };
}

// ---- stretch renders (tools/prep/stretch.py), one at a time: B's bars before a hook at A's tempo, with stems.
interface StretchRequest {
  song: number;
  hook: string;
  toBpm: number;
  bars: number;
  afterBars: number;
}
type StretchResult = { ok: true; [key: string]: unknown } | { ok: false; reason: string; code?: number | null; log?: string };

let stretchQueue: Promise<unknown> = Promise.resolve();
function stretchRender({ song, hook, toBpm, bars, afterBars }: StretchRequest): Promise<StretchResult> {
  const run = () =>
    new Promise<StretchResult>((resolve) => {
      const argv = [path.join(PREP, 'stretch.py'), '--pool', POOL.manifest, '--song', String(song), '--hook', hook,
        '--to-bpm', String(toBpm), '--bars', String(bars), '--after-bars', String(afterBars), '--stems', '--json'];
      const child = spawn(PYTHON, argv, { cwd: REPO });
      let out = '';
      let err = '';
      const timer = setTimeout(() => child.kill('SIGKILL'), 60_000);
      child.stdout.on('data', (d) => (out += d));
      child.stderr.on('data', (d) => (err += d));
      child.on('close', (code) => {
        clearTimeout(timer);
        if (code !== 0) return resolve({ ok: false, code, reason: code === 2 ? 'unreachable' : 'failed', log: err.split('\n').slice(-5).join('\n') });
        try {
          const r = JSON.parse(out);
          const dir = path.basename(r.dir);
          const parts = ['drums', 'bass', 'vocals', 'other', 'mix'].filter((p) => fs.existsSync(path.join(r.dir, `${p}.flac`)));
          resolve({ ok: true, song, hookId: r.hookId, dir, parts, partGain: r.partGain, ratio: r.ratio, effectiveBpm: r.effectiveBpm,
            request: r.request, beatsPerBar: r.output?.beatsPerBar?.[0] ?? 4, warnings: r.warnings ?? [], seconds: r.seconds });
        } catch (error) {
          resolve({ ok: false, reason: 'badOutput', log: String(error) });
        }
      });
    });
  const job = stretchQueue.then(run, run);
  stretchQueue = job;
  return job;
}

function isStretchRequest(b: unknown): b is StretchRequest {
  if (!b || typeof b !== 'object') return false;
  const r = b as Record<string, unknown>;
  const int = (v: unknown, min: number, max: number) => Number.isInteger(v) && (v as number) >= min && (v as number) <= max;
  return int(r.song, 1, 1e6) && typeof r.hook === 'string' && /^\d+-[a-z]+-\d+$/.test(r.hook) &&
    typeof r.toBpm === 'number' && Number.isFinite(r.toBpm) && r.toBpm > 30 && r.toBpm < 300 &&
    int(r.bars, 1, 16) && int(r.afterBars, 0, 4);
}

/**
 * GET and PUT /api/plan: the laptop's Game plan (relay/plan.ts). This laptop's pages, or a device paired with
 * the relay token (`authorization: Bearer <token>`). PUT saves Admin's plan on the laptop when there is no cloud
 * (checked like the cloud checks it); the cloud link uploads it once the cloud is back, if it is still the newest.
 * The answers match the cloud's /api/plan, plus `savedAtMs`.
 */
async function handlePlanApi(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
  const json = (status: number, body: unknown): void => void res.writeHead(status, { 'content-type': 'application/json', 'cache-control': 'no-store' }).end(JSON.stringify(body));
  if (!isThisMachine(req.socket.remoteAddress) && !hasToken(req.headers.authorization)) return json(403, { ok: false, errors: ['pair this device with the relay token first'] });
  if (req.method === 'GET') return json(200, PLAN.current());
  if (req.method !== 'PUT') return json(405, { ok: false, errors: ['GET or PUT'] });
  let body: unknown;
  try {
    body = JSON.parse(await readBody(req, 512 * 1024));
  } catch (error) {
    return json(400, { ok: false, errors: [`not a JSON plan of at most 512 KB: ${String(error)}`] });
  }
  const saved = PLAN.saveLocal(body, Date.now());
  json(saved.ok ? 200 : 400, saved);
}

/** Whether an `authorization` header carries the relay token. */
function hasToken(header: string | undefined): boolean {
  const given = Buffer.from(header?.match(/^Bearer (.+)$/)?.[1] ?? '');
  const token = Buffer.from(TOKEN);
  return given.length === token.length && crypto.timingSafeEqual(given, token);
}

async function handleApi(req: http.IncomingMessage, res: http.ServerResponse, url: URL): Promise<boolean> {
  const json = (status: number, body: unknown) => res.writeHead(status, { 'content-type': 'application/json' }).end(JSON.stringify(body));
  // Which pool this relay serves: song ids only mean something within a pool (e.g. for keys of stored Games).
  if (url.pathname === '/api/pool' && req.method === 'GET') {
    json(200, { name: POOL.name });
    return true;
  }
  if (url.pathname === '/api/stretch' && req.method === 'POST') {
    try {
      const b: unknown = JSON.parse(await readBody(req, 4096));
      if (!isStretchRequest(b)) json(400, { ok: false, reason: 'invalid' });
      else json(200, await stretchRender(b));
    } catch (error) {
      json(400, { ok: false, reason: 'invalid', log: String(error) });
    }
    return true;
  }
  const match = url.pathname.match(/^\/api\/override\/(\d+)$/);
  if (!match) return false;
  const id = Number(match[1]);
  const file = path.join(POOL.overridesDir, `${id}.json`);
  if (req.method === 'GET') {
    try {
      json(200, JSON.parse(await fsp.readFile(file, 'utf8')));
    } catch {
      json(200, {});
    }
    return true;
  }
  if (req.method === 'POST') {
    try {
      const body: unknown = JSON.parse(await readBody(req));
      const isEmpty = !body || typeof body !== 'object' || Object.keys(body).length === 0;
      if (isEmpty) await fsp.rm(file, { force: true });
      else {
        await fsp.mkdir(POOL.overridesDir, { recursive: true });
        await fsp.writeFile(file, JSON.stringify(body, null, 2) + '\n');
      }
      const result = await rederive(id);
      const analysis: unknown = JSON.parse(await fsp.readFile(path.join(ANALYSIS_DIR, `${id}.json`), 'utf8'));
      json(200, { ok: result.code === 0, log: result.output, analysis });
    } catch (error) {
      json(400, { ok: false, error: String(error) });
    }
    return true;
  }
  return false;
}

// ---- pages: Vite in development, dist/ with --dist ---------------------------------------------------------
const server = http.createServer();

type Middleware = (req: http.IncomingMessage, res: http.ServerResponse, next: () => void) => void;
let pages: Middleware;
if (USE_DIST) {
  if (!fs.existsSync(path.join(DIST, 'show/engine/show.html'))) {
    console.error('dist/ is missing or incomplete: run `npm run build` first.');
    process.exit(1);
  }
  pages = (req, res, next) => {
    const target = insideDir(DIST, new URL(req.url ?? '/', 'http://local').pathname.slice(1), 'no-store');
    if (!target) return next();
    serveFile(req, res, target).then((found) => found || next(), next);
  };
} else {
  const { createServer } = await import('vite');
  const vite = await createServer({
    configFile: path.join(SHOW, 'vite.config.ts'),
    appType: 'mpa',
    server: { middlewareMode: true, hmr: false },
  });
  pages = vite.middlewares;
}

server.on('request', async (req: http.IncomingMessage, res: http.ServerResponse) => {
  const url = new URL(req.url ?? '/', 'http://local');
  if (url.pathname === '/' || url.pathname === '/show') return res.writeHead(302, { location: '/show/' }).end();
  if (url.pathname === '/admin') return res.writeHead(302, { location: '/admin/' }).end();
  // The Game plan: any paired screen may read it, and Admin may save one with no cloud (plan B).
  if (url.pathname === '/api/plan') return handlePlanApi(req, res);
  if (url.pathname === '/cloud/plan.json' && (req.method === 'GET' || req.method === 'HEAD')) {
    const { plan } = PLAN.current();
    if (!plan) return notFound(res);
    // This laptop's pages and paired devices get the whole plan; anyone else on the hotspot only what phones may
    // see (plan.ts publicPlan: no locked round's prizes, no cheat sheet), the rounds revealed as the show says.
    const whole = isThisMachine(req.socket.remoteAddress) || hasToken(req.headers.authorization);
    const body = whole ? plan : publicPlan(plan, revealedRounds(plan, lastState?.prizes?.revealed ?? []));
    return res.writeHead(200, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' }).end(req.method === 'HEAD' ? undefined : JSON.stringify(body));
  }
  // The APIs rewrite hooks and render audio: only this laptop's own pages (show, audition) may call them.
  if (url.pathname.startsWith('/api/')) {
    if (!isThisMachine(req.socket.remoteAddress)) return res.writeHead(403, { 'content-type': 'text/plain' }).end('only on the show laptop');
    if (await handleApi(req, res, url)) return;
  }
  // The cloud link's folder holds the journal (the Queue, winners' names) and Admin's resume: only this laptop's
  // own pages may read it (the show page's boot check). The Game plan is public and the LAN screens need it.
  if (url.pathname.startsWith('/cloud/') && url.pathname !== '/cloud/plan.json' && !isThisMachine(req.socket.remoteAddress)) {
    return res.writeHead(403, { 'content-type': 'text/plain' }).end('only on the show laptop');
  }
  const target = resolveStatic(url.pathname);
  if (target) {
    if (!(await serveFile(req, res, target))) notFound(res);
    return;
  }
  // The engine's pages live at /show/engine/<page> (the build is rooted at apps/); /show/<page> keeps working.
  if (isEnginePath(url.pathname)) req.url = '/show/engine/' + req.url!.slice('/show/'.length);
  pages(req, res, () => notFound(res));
});

/**
 * /show/<page> for an engine page or file (apps/show/engine/<page>): /show/ itself, show.html, audition.html…
 * Anything else under /show/ is left alone: the test remote (/show/remote/) and Vite's own files (in development
 * Vite serves apps/show/node_modules/vite/… as /show/node_modules/…).
 */
function isEnginePath(pathname: string): boolean {
  if (!pathname.startsWith('/show/') || pathname.startsWith('/show/engine/')) return false;
  let rest: string;
  try {
    rest = decodeURIComponent(pathname.slice('/show/'.length));
  } catch {
    return false;
  }
  if (rest === '') return true;
  if (rest.split('/').includes('..')) return false;
  return fs.existsSync(path.join(SHOW, 'engine', rest));
}

// ---- WebSocket hub ---------------------------------------------------------------------------------------
// Who may say what. The show page and the cloud link run on this laptop (`show` and `cloud` are accepted only
// from it); the hotspot's devices pair with the relay token. A socket without a valid hello hears nothing.
// - Events come only from the show socket. The Game journal (journal.entry, journal.entries: the Queue, seeds,
//   names) goes to the cloud link only; every other event goes to the paired remotes and the link.
// - Commands come only from paired remotes and the link, and go to the show; `getJournal` only from the link.
interface Client {
  role: Role | 'unknown';
  clientId: string;
}
const clients = new Map<WebSocket, Client>();
/** The laptop's Game plan (cloud-plan.json or local-plan.json in the link folder, the newest), pushed on change. */
const PLAN = new LaptopPlan(LINK, (current) => broadcast(planMessage(current)));
PLAN.start();
const wss = new WebSocketServer({ noServer: true });
let lastState: ShowState | null = null;
const LOCAL_ROLES: readonly Role[] = ['show', 'cloud'];
const LISTENERS: readonly Role[] = ['tablet', 'admin', 'drum', 'cloud'];
const COMMANDERS: readonly Role[] = ['tablet', 'admin', 'cloud'];
const JOURNAL_EVENTS = new Set(['journal.entry', 'journal.entries']);

/** Whether `client` should receive a show event of this type. */
const receives = (client: Client, type: unknown): boolean =>
  client.role !== 'unknown' && LISTENERS.includes(client.role) && (!JOURNAL_EVENTS.has(String(type)) || client.role === 'cloud');

// Only /ws upgrades belong to the hub.
server.on('upgrade', (req, socket, head) => {
  if (new URL(req.url ?? '/', 'http://local').pathname !== '/ws') return socket.destroy();
  wss.handleUpgrade(req, socket, head, (ws) => wss.emit('connection', ws, req));
});

wss.on('connection', (socket: WebSocket, req: http.IncomingMessage) => {
  const local = isThisMachine(req.socket.remoteAddress);
  const self: Client = { role: 'unknown', clientId: '' };
  clients.set(socket, self);
  socket.on('message', (data) => {
    let message: Record<string, unknown>;
    try {
      const parsed: unknown = JSON.parse(String(data));
      if (!parsed || typeof parsed !== 'object') return;
      message = parsed as Record<string, unknown>;
    } catch {
      return;
    }
    if (message.v !== PROTOCOL_VERSION) return; // wrong or missing protocol version
    if (message.type === 'hello') {
      const role = (ROLES as readonly unknown[]).includes(message.role) ? (message.role as Role) : null;
      const paired = local || message.token === TOKEN;
      self.role = role && (LOCAL_ROLES.includes(role) ? local : paired) ? role : 'unknown';
      self.clientId = String(message.clientId ?? '');
      if (self.role === 'unknown') return; // unpaired: it hears nothing
      if (lastState && receives(self, 'state')) socket.send(JSON.stringify(lastState));
      socket.send(JSON.stringify(planMessage(PLAN.current())));
      if (isConsole(self)) for (const [clientId, status] of remoteStatuses) if (clientId !== self.clientId) socket.send(JSON.stringify(status));
      broadcast(clientList());
      return;
    }
    // A console that hosts the Wii Remote reports it: kept per host, sent to the other paired consoles only.
    if (message.type === REMOTE_STATUS_TYPE) {
      if (!isConsole(self)) return;
      const status = readRemoteStatus(message);
      if (!status) return;
      rememberRemote(socket, self.clientId, { connected: status.connected, battery: status.battery, sinceMs: status.sinceMs });
      return;
    }
    const isCommand = message.type === 'cmd';
    if (isCommand) {
      if (self.role === 'unknown' || !COMMANDERS.includes(self.role)) return;
      if (message.cmd === 'getJournal' && self.role !== 'cloud') return;
    } else if (self.role !== 'show') return;
    if (message.type === 'state') lastState = message as unknown as ShowState;
    const text = JSON.stringify(message);
    for (const [other, info] of clients) {
      if (other === socket || other.readyState !== other.OPEN) continue;
      if (isCommand ? info.role !== 'show' : !receives(info, message.type)) continue;
      other.send(text);
    }
  });
  socket.on('close', () => {
    clients.delete(socket);
    // The host's remote goes with its socket: the other consoles see it disconnected.
    if (remoteHosts.get(self.clientId) === socket) {
      remoteHosts.delete(self.clientId);
      rememberRemote(null, self.clientId, { connected: false, battery: null, sinceMs: Date.now() });
    }
    broadcast(clientList());
  });
});

/** Paired consoles: the presenters' tablets and Admin (never the drum, the show page or the cloud link). */
function isConsole(client: Client): boolean {
  return client.role === 'tablet' || client.role === 'admin';
}

/** The last `remote.status` of each host console, replayed to every console that says hello. */
const remoteStatuses = new Map<string, RemoteStatusMessage>();
/** Which socket each host reported from, so only its own close marks its remote disconnected. */
const remoteHosts = new Map<string, WebSocket>();

/** Keep a host's status and send it to the other paired consoles. Private: never to the link, so never to phones. */
function rememberRemote(from: WebSocket | null, clientId: string, status: { connected: boolean; battery: number | null; sinceMs: number }): void {
  const message: RemoteStatusMessage = { ...remoteStatusMessage(status), clientId };
  remoteStatuses.set(clientId, message);
  if (from) remoteHosts.set(clientId, from);
  const text = JSON.stringify(message);
  for (const [socket, info] of clients) if (socket !== from && isConsole(info) && socket.readyState === socket.OPEN) socket.send(text);
}

/** One line about the pool's preparation, for the start-up log. */
function poolStatus(): string {
  try {
    const index: unknown = JSON.parse(fs.readFileSync(path.join(ANALYSIS_DIR, 'index.json'), 'utf8'));
    const songs = index && typeof index === 'object' && 'songs' in index && Array.isArray(index.songs) ? index.songs : [];
    return `${songs.length} songs analysed in ${display(ANALYSIS_DIR)}${POOL.cardsJson ? '' : '; no cards (cardsJson)'}`;
  } catch {
    return `not prepared yet: no ${display(path.join(ANALYSIS_DIR, 'index.json'))} (npm run prep -- --pool ${POOL.name})`;
  }
}

function clientList(): RelayClients {
  return { v: PROTOCOL_VERSION, type: 'relay.clients', clients: [...clients.values()].map(({ role, clientId }) => ({ role, clientId })) };
}

/** The Game plan for the screens (protocol RelayPlan): on hello and whenever the laptop's newest copy changes. */
function planMessage(current: CurrentPlan): RelayPlan {
  return { v: PROTOCOL_VERSION, type: 'relay.plan', plan: current.plan, savedAtMs: current.savedAtMs };
}

/** To every paired socket: the show page (its stage), the remotes and the cloud link. */
function broadcast(message: RelayClients | RelayPlan) {
  const text = JSON.stringify(message);
  for (const [socket, info] of clients) if (info.role !== 'unknown' && socket.readyState === socket.OPEN) socket.send(text);
}

server.listen(PORT, HOST, () => {
  const lan = Object.values(os.networkInterfaces()).flat().find((i) => i && i.family === 'IPv4' && !i.internal)?.address;
  const mode = USE_DIST ? 'dist/' : 'Vite dev';
  console.log(`show relay (${mode}) on http://localhost:${PORT}/show/  (audition: /show/audition.html, Admin: /admin/)`);
  if (LAN && lan) {
    console.log(`Console for the presenters (pairs with the token): http://${lan}:${PORT}/console/?t=${TOKEN}`);
    console.log(`  (dev test remote: http://${lan}:${PORT}/show/remote/?t=${TOKEN})`);
  }
  else console.log('This laptop only. Start with --lan to let the hotspot\'s tablets and phones pair.');
  console.log(`pool ${POOL.name} (${display(POOL.manifest)}): ${poolStatus()}`);
});
