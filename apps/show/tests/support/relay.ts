// A relay of its own for the tests (relay-gate, relay-show-states): spawned on a free port with a test token and a
// scratch cloud link folder, and sockets on this laptop that say hello as any role.
import { spawn, type ChildProcess } from 'node:child_process';
import fs from 'node:fs';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import WebSocket from 'ws';
import { PROTOCOL_VERSION, type Role } from '@quina/protocol';
import { SHOW } from '../../relay/repertoire.ts';

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
  ws: string;
  output: () => string;
  stop: () => Promise<void>;
}

/** A relay of its own on a free port: a test token (nothing written to data/cache) and a scratch cloud link folder. */
export async function startRelay(flags: string[]): Promise<Relay> {
  const port = await freePort();
  const linkDir = fs.mkdtempSync(path.join(os.tmpdir(), 'quina-relay-'));
  const child: ChildProcess = spawn(process.execPath, ['relay/server.ts', '--port', String(port), '--token', 'GATETESTTOKEN2345', '--repertoire', 'default', ...flags], {
    cwd: SHOW, stdio: ['ignore', 'pipe', 'pipe'], env: { ...process.env, QUINA_LINK_DIR: linkDir },
  });
  let output = '';
  child.stdout?.on('data', (d) => (output += d));
  child.stderr?.on('data', (d) => (output += d));
  const stop = async () => {
    if (child.exitCode === null) {
      const exited = new Promise((resolve) => child.once('exit', resolve));
      child.kill();
      await exited;
    }
    fs.rmSync(linkDir, { recursive: true, force: true });
  };
  for (let i = 0; i < 200; i++) {
    try {
      if ((await fetch(`http://127.0.0.1:${port}/api/repertoire`)).ok) return { ws: `ws://127.0.0.1:${port}/ws`, output: () => output, stop };
    } catch {
      // not up yet
    }
    if (child.exitCode !== null) break;
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  await stop();
  throw new Error(`the relay did not start:\n${output}`);
}

export interface Peer {
  heard: Record<string, unknown>[];
  send: (message: Record<string, unknown>) => void;
  /** Wait until it has heard a message that passes `predicate`. */
  hears: (predicate: (m: Record<string, unknown>) => boolean, what: string) => Promise<Record<string, unknown>>;
  close: () => void;
}

/** A socket on this laptop (no token needed) that says hello as `role`. */
export function peer(url: string, role: Role, clientId: string): Promise<Peer> {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(url);
    const heard: Record<string, unknown>[] = [];
    const waiters: (() => void)[] = [];
    ws.on('message', (data) => {
      heard.push(JSON.parse(String(data)));
      for (const w of waiters.splice(0)) w();
    });
    ws.on('error', reject);
    ws.on('open', () => {
      ws.send(JSON.stringify({ v: PROTOCOL_VERSION, type: 'hello', role, clientId }));
      const hears: Peer['hears'] = (predicate, what) => new Promise((done, fail) => {
        const timer = setTimeout(() => fail(new Error(`${clientId} never heard ${what}; heard ${heard.map((m) => m.type).join(', ')}`)), 5000);
        const check = () => {
          const found = heard.find(predicate);
          if (found) {
            clearTimeout(timer);
            done(found);
          } else waiters.push(check);
        };
        check();
      });
      resolve({ heard, send: (m) => ws.send(JSON.stringify(m)), hears, close: () => ws.close() });
    });
  });
}

export const cmd = (name: string, reqId: string, fields: Record<string, unknown> = {}) => ({ v: PROTOCOL_VERSION, type: 'cmd', cmd: name, reqId, ...fields });
