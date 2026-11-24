// Start the Worker locally with `wrangler dev` (workerd, the real wrangler.jsonc) on a free port, with its own
// throwaway state and the dev Access bypass. Used by the end-to-end tests and the load test.
import { spawn, type ChildProcess } from 'node:child_process';
import fs from 'node:fs';
import net from 'node:net';
import os from 'node:os';
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
 * `media` turns on a local R2 bucket for the media sync (wrangler.jsonc keeps it off until the real bucket exists).
 */
export async function startDevServer({ port, persistTo, media = false }: { port?: number; persistTo?: string; media?: boolean } = {}): Promise<DevServer> {
  const chosen = port ?? (await freePort());
  const inspector = await freePort(); // its own debugger port, so several dev servers can run at once (parallel tests)
  const state = persistTo ?? fs.mkdtempSync(path.join(os.tmpdir(), 'quina-cloud-'));
  const wrangler = path.join(ROOT, 'node_modules', '.bin', 'wrangler');
  const config: string[] = [];
  if (media) {
    // A copy of wrangler.jsonc beside it (its paths stay right), with the R2 binding switched on.
    const file = path.join(ROOT, 'wrangler.media-test.jsonc');
    const text = fs.readFileSync(path.join(ROOT, 'wrangler.jsonc'), 'utf8').replace('// "r2_buckets"', '"r2_buckets"');
    if (!text.includes('\n  "r2_buckets"')) throw new Error('wrangler.jsonc has no commented r2_buckets line to switch on');
    fs.writeFileSync(file, text);
    config.push('--config', file);
  }
  const child: ChildProcess = spawn(
    wrangler,
    ['dev', ...config, '--port', String(chosen), '--inspector-port', String(inspector), '--ip', '127.0.0.1', '--persist-to', state, '--var', 'ACCESS_DEV:true', '--log-level', 'warn', '--show-interactive-dev-session=false'],
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
        if (child.exitCode !== null) return resolve();
        child.once('exit', () => resolve());
        child.kill('SIGTERM');
        setTimeout(() => child.kill('SIGKILL'), 5000).unref();
      }),
  };
}
