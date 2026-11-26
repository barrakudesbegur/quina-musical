// Set up a show laptop (the main one, or a spare), from a clone of the repo:
//   npm run setup:laptop [-- --repertoire default] [--skip-media]
// Safe to run again: each step checks first and does only what is missing. In order:
//   1. the prerequisites (Node, macOS, uv, Rubber Band, Google Chrome, disk space), with the exact install hints;
//   2. npm ci (only when package-lock.json changed since the last setup);
//   3. the Python venv for what the relay runs during the show (tools/prep/requirements-show.txt: the Blend renders);
//   4. the cloud link's pairing: apps/cloud/.env.link with the laptop's service token (never sent by chat or email);
//   5. the repertoire's prepared media, pulled from the cloud's private R2 (resumable: run it again after a cut);
//   6. the Game plan and its images, fetched with the laptop's token (no takeover of the laptop playing);
//   7. the preflight's Repertoire and Laptop checks.
// It only uses Node's own modules, so it runs before npm ci.
import { spawnSync, type SpawnSyncOptions } from 'node:child_process';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const REPO = path.resolve(import.meta.dirname, '../..');
const args = process.argv.slice(2);
const flag = (name: string): string | undefined => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
};
const REPERTOIRE = flag('--repertoire') ?? 'default';
const SKIP_MEDIA = args.includes('--skip-media');
const MIN_FREE_GB = 10;

const bold = (s: string) => (process.stdout.isTTY ? `\x1b[1m${s}\x1b[0m` : s);
const step = (n: number, title: string) => console.log(`\n${bold(`${n}. ${title}`)}`);
const ok = (line: string) => console.log(`   ok   ${line}`);
const todo = (line: string) => console.log(`   todo ${line}`);

function run(command: string, commandArgs: string[], options: SpawnSyncOptions = {}): boolean {
  console.log(`   $ ${command} ${commandArgs.join(' ')}`);
  return spawnSync(command, commandArgs, { cwd: REPO, stdio: 'inherit', ...options }).status === 0;
}

function quiet(command: string, commandArgs: string[], cwd = REPO): { ok: boolean; out: string } {
  const result = spawnSync(command, commandArgs, { cwd, encoding: 'utf8' });
  return { ok: result.status === 0, out: `${result.stdout ?? ''}${result.stderr ?? ''}`.trim() };
}

function stop(reason: string): never {
  console.log(`\n${bold('Stopped:')} ${reason}\nFix that, then run npm run setup:laptop again; finished steps are skipped.`);
  process.exit(1);
}

// ---- 1. prerequisites ------------------------------------------------------------------------------------
step(1, 'Prerequisites');
const missing: string[] = [];
const [major = 0, minor = 0] = process.versions.node.split('.').map(Number);
if (major > 23 || (major === 23 && minor >= 6)) ok(`Node ${process.versions.node}`);
else missing.push(`Node 23.6 or newer (this is ${process.versions.node}): brew install node`);
if (process.platform === 'darwin') ok('macOS');
else missing.push(`macOS (this is ${process.platform}): the show laptop's checks and the Rubber Band path assume a Mac`);
if (quiet('uv', ['--version']).ok) ok(quiet('uv', ['--version']).out);
else missing.push('uv (it installs the right Python by itself): brew install uv');
const rubberband = ['/opt/homebrew/opt/rubberband/lib/librubberband.dylib', '/usr/local/opt/rubberband/lib/librubberband.dylib'].find((f) => fs.existsSync(f));
if (rubberband) ok(`Rubber Band (${rubberband})`);
else missing.push('Rubber Band, for the Blend renders: brew install rubberband');
if (fs.existsSync('/Applications/Google Chrome.app')) ok('Google Chrome');
else missing.push('Google Chrome, for the show page in kiosk mode: https://www.google.com/chrome/');
const free = fs.statfsSync(REPO);
const freeGb = (free.bavail * free.bsize) / 1e9;
if (freeGb >= MIN_FREE_GB) ok(`${freeGb.toFixed(0)} GB free`);
else missing.push(`at least ${MIN_FREE_GB} GB free for the repertoire's media (${freeGb.toFixed(1)} GB now)`);
console.log('   (ffmpeg and the full Python requirements are only for preparing a repertoire, not for the show.)');
if (missing.length) {
  for (const m of missing) todo(m);
  stop('install what is missing.');
}

// ---- 2. npm ci -------------------------------------------------------------------------------------------
step(2, 'Node packages');
const lock = createHash('sha256').update(fs.readFileSync(path.join(REPO, 'package-lock.json'))).digest('hex');
const stamp = path.join(REPO, 'node_modules', '.quina-setup-lock');
if (fs.existsSync(stamp) && fs.readFileSync(stamp, 'utf8') === lock) ok('installed (package-lock.json unchanged)');
else {
  if (!run('npm', ['ci'])) stop('npm ci failed.');
  fs.writeFileSync(stamp, lock);
  ok('installed');
}

// ---- 3. Python for the show ------------------------------------------------------------------------------
step(3, 'Python for the Blend renders');
const venvPython = path.join(REPO, 'tools/prep/.venv/bin/python');
if (!fs.existsSync(venvPython) && !run('uv', ['venv', '--python', '3.13', 'tools/prep/.venv'])) stop('could not create tools/prep/.venv.');
if (!run('uv', ['pip', 'install', '--quiet', '--python', venvPython, '-r', 'tools/prep/requirements-show.txt'])) stop('could not install tools/prep/requirements-show.txt.');
const probe = quiet(venvPython, ['-c', 'import numpy, soundfile; from steps import rubberband as rb; print(rb.backend())'], path.join(REPO, 'tools/prep'));
if (probe.ok) ok(`numpy, soundfile and Rubber Band load (${probe.out.split('\n').pop()})`);
else stop(`the Blend renders' Python does not load:\n${probe.out}`);

// ---- 4. the cloud link's pairing -------------------------------------------------------------------------
step(4, "The cloud link's pairing (apps/cloud/.env.link)");
const envLink = path.join(REPO, 'apps/cloud/.env.link');
if (!fs.existsSync(envLink)) {
  todo('apps/cloud/.env.link is missing. It holds the laptop\'s service token (quina-laptop) and the cloud URL.');
  console.log(`   Get it from the organizers' password manager (a secure note "quina .env.link"), or AirDrop it from the
   main show laptop. Never by chat or email: anyone with it can act as the show laptop. Save it as
   ${envLink}
   then: chmod 600 apps/cloud/.env.link`);
  stop('pair the link.');
}
if ((fs.statSync(envLink).mode & 0o077) !== 0) {
  fs.chmodSync(envLink, 0o600);
  ok('.env.link made private to this user (600)');
}
const env = Object.fromEntries(
  fs.readFileSync(envLink, 'utf8').split('\n').filter((l) => /^[A-Z_]+=/.test(l)).map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1).trim()]),
);
for (const key of ['QUINA_CLOUD_URL', 'CF_ACCESS_CLIENT_ID', 'CF_ACCESS_CLIENT_SECRET']) if (!env[key]) stop(`.env.link has no ${key}.`);
ok(`paired with ${env.QUINA_CLOUD_URL}`);

// ---- 5. the repertoire's media ---------------------------------------------------------------------------
step(5, `The repertoire's media (${REPERTOIRE}), from the cloud's private R2`);
if (SKIP_MEDIA) ok('skipped (--skip-media)');
else if (!run('npm', ['run', 'media', '-w', '@quina/cloud', '--', 'pull', '--repertoire', REPERTOIRE])) stop('the media pull failed; run setup again to resume it.');

// ---- 6. the Game plan ------------------------------------------------------------------------------------
step(6, 'The Game plan and its images');
if (!run('npm', ['run', 'media', '-w', '@quina/cloud', '--', 'plan'])) stop('could not fetch the Game plan.');

// ---- 7. preflight ----------------------------------------------------------------------------------------
step(7, 'Preflight: the repertoire and this laptop');
const preflight = run('npm', ['run', 'preflight', '-w', '@quina/cloud', '--', '--only', 'Repertoire,Laptop', '--repertoire', REPERTOIRE, '--fast']);

console.log(`\n${bold(preflight ? 'This laptop is set up.' : 'Set up, but the preflight found problems (above).')}
On the night (docs/night-runbook.md): in apps/show, npm start -- --lan; in apps/cloud, npm run link; the show page
in Chrome; then the full preflight with everything running: npm run preflight -w @quina/cloud.
At the sound check: the show plays 6 dB lower inside than last year (D157), so turn the PA up about 6 dB.`);
process.exit(preflight ? 0 : 1);
