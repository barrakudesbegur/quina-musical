// Start the Worker locally with `wrangler dev` (workerd, the real wrangler.jsonc) on a free port, with its own
// throwaway state and the dev Access bypass. Used by the end-to-end tests and the load test.
import { spawn, type ChildProcess } from 'node:child_process';
import fs from 'node:fs';
import net from 'node:net';
import os from 'node:os';
import { createRequire } from 'node:module';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');

export interface DevServer {
  port: number;
  http: string;
  ws: string;
  stop(): Promise<void>;
}

export async function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      server.close(() => (address && typeof address === 'object' ? resolve(address.port) : reject(new Error('no port'))));
    });
  });
}

/**
 * Start `wrangler dev`; resolves once /api/health answers. `port` lets a test start it on a port chosen earlier.
 * `media` keeps the R2 binding (a local bucket) for the media sync; without it the Worker runs as a cloud with no
 * bucket. `assets` serves another static folder than dist/.
 */
export async function startDevServer({ port, persistTo, media = false, assets }: { port?: number; persistTo?: string; media?: boolean; assets?: string } = {}): Promise<DevServer> {
  const chosen = port ?? (await freePort());
  const inspector = await freePort(); // its own debugger port, so several dev servers can run at once (parallel tests)
  const state = persistTo ?? fs.mkdtempSync(path.join(os.tmpdir(), 'quina-cloud-'));
  // Wrangler's own entry point, wherever npm put it (the workspace hoists it to the repo's node_modules).
  const wrangler = path.join(path.dirname(createRequire(import.meta.url).resolve('wrangler/package.json')), 'bin', 'wrangler.js');
  const config: string[] = [];
  /** Config copies written for this server, removed when it stops. */
  const copies: string[] = [];
  if (!media) {
    // A copy of wrangler.jsonc beside it (its paths stay right) without the R2 binding: most tests run without
    // the bucket, as a cloud that has none (the sync answers 503).
    // One per dev server: tests start several at once.
    const file = path.join(ROOT, `wrangler.no-media-test.${chosen}.jsonc`);
    const source = fs.readFileSync(path.join(ROOT, 'wrangler.jsonc'), 'utf8');
    const text = source.replace(/\n  "r2_buckets": [^\n]*\n/, '\n');
    if (text === source) throw new Error('wrangler.jsonc has no r2_buckets line to switch off');
    fs.writeFileSync(file, text);
    copies.push(file);
    config.push('--config', file);
  }
  // Another static folder than dist/ (tools/e2e assembles its own build, so a deploy's dist/ is never touched).
  if (assets) config.push('--assets', assets);
  const child: ChildProcess = spawn(
    process.execPath,
    [wrangler, 'dev', ...config, '--port', String(chosen), '--inspector-port', String(inspector), '--ip', '127.0.0.1', '--persist-to', state, '--var', 'ACCESS_DEV:true', '--log-level', 'warn', '--show-interactive-dev-session=false'],
    { cwd: ROOT, stdio: ['ignore', 'pipe', 'pipe'], env: { ...process.env, WRANGLER_SEND_METRICS: 'false', CI: '1' } },
  );
  let output = '';
  child.stdout?.on('data', (d) => (output += d));
  child.stderr?.on('data', (d) => (output += d));
  const http = `http://127.0.0.1:${chosen}`;
  const deadline = Date.now() + 60_000;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) throw new Error(`wrangler dev exited (${child.exitCode}):\n${output}`);
    try {
      const response = await fetch(`${http}/api/health`);
      if (response.ok) break;
    } catch {
      // not up yet
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  if (Date.now() >= deadline) {
    child.kill('SIGTERM');
    throw new Error(`wrangler dev did not start:\n${output}`);
  }
  return {
    port: chosen,
    http,
    ws: `ws://127.0.0.1:${chosen}`,
    stop: () =>
      new Promise((resolve) => {
        const done = () => {
          for (const at of copies) fs.rmSync(at, { force: true });
          resolve();
        };
        if (child.exitCode !== null) return done();
        child.once('exit', done);
        child.kill('SIGTERM');
        setTimeout(() => child.kill('SIGKILL'), 5000).unref();
      }),
  };
}
