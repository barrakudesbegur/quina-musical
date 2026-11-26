// A relay of its own for the test: on a free port, serving the build, with a scratch cloud link folder so the
// laptop's real Game plan and journal copy are never touched.
import { spawn, type ChildProcess } from 'node:child_process';
import fs from 'node:fs';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';

export const REPO = path.resolve(import.meta.dirname, '../../..');
export const SHOW = path.join(REPO, 'apps', 'show');

/** The default repertoire is prepared on this machine (its analysis and decoded audio exist). */
export function hasPreparedRepertoire(): boolean {
  return fs.existsSync(path.join(REPO, 'data', 'out', 'analysis', 'index.json')) && fs.existsSync(path.join(REPO, 'data', 'cache'));
}

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

export interface Relay {
  url: string;
  ws: string;
  /** Its scratch cloud link folder (QUINA_LINK_DIR): the test's cloud link writes there too. */
  linkDir: string;
  log: () => string;
  stop: () => Promise<void>;
}

export async function startRelay(): Promise<Relay> {
  const port = await freePort();
  const linkDir = fs.mkdtempSync(path.join(os.tmpdir(), 'quina-e2e-link-'));
  const child: ChildProcess = spawn(process.execPath, ['relay/server.ts', '--dist', '--port', String(port)], {
    cwd: SHOW,
    stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env, QUINA_LINK_DIR: linkDir },
  });
  let output = '';
  child.stdout?.on('data', (d) => (output += d));
  child.stderr?.on('data', (d) => (output += d));
  const url = `http://127.0.0.1:${port}`;
  for (let i = 0; i < 100; i++) {
    try {
      if ((await fetch(`${url}/api/repertoire`)).ok) {
        return {
          url,
          ws: `ws://127.0.0.1:${port}/ws`,
          linkDir,
          log: () => output,
          stop: async () => {
            if (child.exitCode === null) {
              // SIGTERM, then SIGKILL if the relay is still waiting on a client (a page left open after a failure).
              const killer = setTimeout(() => child.kill('SIGKILL'), 5000);
              const exited = new Promise((resolve) => child.once('exit', resolve));
              child.kill();
              await exited;
              clearTimeout(killer);
            }
            fs.rmSync(linkDir, { recursive: true, force: true });
          },
        };
      }
    } catch {
      // not up yet
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  child.kill();
  throw new Error(`the relay did not start:\n${output}`);
}
