// An adversarial check of the laptop relay's lockdown (relay/server.ts), the Platform audit's re-verification:
//   npm run relay-audit
// It starts its own relay (not the one on 5174) with --lan and a test token. In that relay, Node's interface list
// is narrowed to loopback, so this machine's LAN address counts as a FOREIGN device: connections to it act
// as a phone or a stranger on the hotspot would. A fake show page on loopback emits private events. The check is
// what each kind of socket hears, and whether its commands and events get through. A second relay without --lan
// must not answer on the LAN address at all. Prints a table; exits 1 on any failure.
import { spawn, type ChildProcess } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import WebSocket from 'ws';
import { freePort } from '../loadtest/dev-server.ts';

const SHOW = path.resolve(import.meta.dirname, '../../show');
const TOKEN = 'AUDITTOKEN234567';
const v = 1;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const lan = Object.values(os.networkInterfaces()).flat().find((i) => i && i.family === 'IPv4' && !i.internal)?.address;
if (!lan) {
  console.error('relay audit: this machine has no LAN address (join a network first)');
  process.exit(1);
}

/** Start a relay; `foreign` narrows its interface list to loopback so the LAN address counts as a stranger. */
async function relay(port: number, flags: string[]): Promise<ChildProcess> {
  const patch = path.join(os.tmpdir(), 'quina-relay-audit-interfaces.mjs');
  fs.writeFileSync(patch, `import os from 'node:os';\nconst real = os.networkInterfaces;\nos.networkInterfaces = () => Object.fromEntries(Object.entries(real()).map(([n, l]) => [n, l.filter((i) => i.internal)]));\n`);
  const child = spawn(process.execPath, ['--import', patch, 'relay/server.ts', '--port', String(port), '--dist', '--token', TOKEN, ...flags], { cwd: SHOW, stdio: ['ignore', 'pipe', 'pipe'] });
  let output = '';
  child.stdout?.on('data', (d) => (output += d));
  child.stderr?.on('data', (d) => (output += d));
  for (let i = 0; i < 100; i++) {
    try {
      if ((await fetch(`http://127.0.0.1:${port}/api/pool`)).ok) return child;
    } catch {
      // not up yet
    }
    await sleep(100);
  }
  child.kill();
  throw new Error(`relay did not start:\n${output}`);
}

interface Peer {
  name: string;
  heard: { type?: string; [key: string]: unknown }[];
  ws: WebSocket;
  send(message: unknown): void;
}

function peer(name: string, url: string, hello: Record<string, unknown> | null): Promise<Peer> {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(url);
    const heard: Peer['heard'] = [];
    ws.on('message', (data) => heard.push(JSON.parse(String(data))));
    ws.on('open', () => {
      if (hello) ws.send(JSON.stringify({ v, type: 'hello', clientId: name, ...hello }));
      resolve({ name, heard, ws, send: (m) => ws.send(JSON.stringify(m)) });
    });
    ws.on('error', reject);
  });
}

const results: { check: string; ok: boolean; detail: string }[] = [];
const expect = (check: string, ok: boolean, detail: string) => results.push({ check, ok, detail });
const types = (p: Peer) => [...new Set(p.heard.map((m) => m.type))].sort().join(', ') || 'nothing';
const heardPrivate = (p: Peer) => p.heard.some((m) => m.type === 'state' || m.type === 'transition.scheduled' || m.type?.startsWith('journal.'));

const port = await freePort();
const server = await relay(port, ['--lan']);
const local = `ws://127.0.0.1:${port}/ws`;
const remote = `ws://${lan}:${port}/ws`;
try {
  // The laptop's own pages: the show page and the cloud link.
  const show = await peer('show', local, { role: 'show' });
  const cloud = await peer('cloud', local, { role: 'cloud' });
  // The strangers on the hotspot, and the paired devices.
  const peers = {
    noHello: await peer('lan-no-hello', remote, null),
    noToken: await peer('lan-tablet-no-token', remote, { role: 'tablet' }),
    badToken: await peer('lan-tablet-bad-token', remote, { role: 'tablet', token: 'WRONGTOKEN234567' }),
    fakeShow: await peer('lan-fake-show', remote, { role: 'show', token: TOKEN }),
    fakeCloud: await peer('lan-fake-cloud', remote, { role: 'cloud', token: TOKEN }),
    tablet: await peer('lan-tablet', remote, { role: 'tablet', token: TOKEN }),
    drum: await peer('lan-drum', remote, { role: 'drum', token: TOKEN }),
    localTablet: await peer('local-tablet', local, { role: 'tablet' }),
  };
  await sleep(300);
  for (const p of [show, cloud, ...Object.values(peers)]) p.heard.length = 0;

  // The show page emits private things.
  show.send({ v, type: 'state', seq: 1, atMs: Date.now(), next: { songId: 42, title: 'SECRET NEXT', artist: 'x' }, possibleWinners: { line: [{ cardId: 7 }], bingo: [] }, resume: { text: 'Q1N-SECRET-3' } });
  show.send({ v, type: 'transition.scheduled', id: 't', to: 42, drum: { removeId: null, targetId: 42, minLaps: 1 }, spinStartAtMs: Date.now(), landAtMs: Date.now() + 5000 });
  show.send({ v, type: 'journal.entry', entry: { gameId: 'g', seq: 1, atMs: 1, kind: 'round.started', queue: [42, 1, 2] } });
  // Strangers try to drive the show, forge events, and read the journal.
  peers.noHello.send({ v, type: 'cmd', cmd: 'next', reqId: 'stranger-1' });
  peers.noToken.send({ v, type: 'cmd', cmd: 'next', reqId: 'stranger-2' });
  peers.badToken.send({ v, type: 'cmd', cmd: 'next', reqId: 'stranger-3' });
  peers.fakeShow.send({ v, type: 'journal.entry', entry: { gameId: 'g', seq: 2, atMs: 2, kind: 'song.landed', round: 1, position: 0, songId: 42 } });
  peers.fakeShow.send({ v, type: 'cmd', cmd: 'next', reqId: 'stranger-4' });
  peers.fakeCloud.send({ v, type: 'cmd', cmd: 'getJournal', reqId: 'stranger-5' });
  peers.drum.send({ v, type: 'cmd', cmd: 'next', reqId: 'drum-1' });
  peers.tablet.send({ v, type: 'cmd', cmd: 'getJournal', reqId: 'tablet-journal' });
  peers.tablet.send({ v, type: 'cmd', cmd: 'hold', reqId: 'tablet-hold', on: true });
  await sleep(800);

  for (const p of [peers.noHello, peers.noToken, peers.badToken, peers.fakeShow, peers.fakeCloud]) {
    expect(`${p.name} hears nothing private`, !heardPrivate(p), `heard: ${types(p)}`);
  }
  const reachedShow = (reqId: string) => show.heard.some((m) => m.reqId === reqId);
  for (const reqId of ['stranger-1', 'stranger-2', 'stranger-3', 'stranger-4', 'stranger-5', 'drum-1', 'tablet-journal']) {
    expect(`command ${reqId} doesn't reach the show`, !reachedShow(reqId), reachedShow(reqId) ? 'REACHED the show' : 'blocked');
  }
  expect('a paired tablet drives the show', reachedShow('tablet-hold'), reachedShow('tablet-hold') ? 'its hold reached the show' : 'its hold was blocked');
  const forged = [cloud, peers.tablet, peers.localTablet].some((p) => p.heard.some((m) => m.type === 'journal.entry' && (m.entry as { seq?: number })?.seq === 2));
  expect("a forged 'show' event goes nowhere", !forged, forged ? 'FORWARDED' : 'dropped');
  expect('the journal goes to the cloud link only', cloud.heard.some((m) => m.type === 'journal.entry') && !Object.values(peers).some((p) => p.heard.some((m) => m.type?.startsWith('journal.'))), `cloud heard: ${types(cloud)}`);
  expect('a paired tablet gets the state (consoles are private)', peers.tablet.heard.some((m) => m.type === 'state'), `heard: ${types(peers.tablet)}`);
  expect('the paired drum gets its Spin events', peers.drum.heard.some((m) => m.type === 'transition.scheduled'), `heard: ${types(peers.drum)}`);
  expect("the laptop's own tablet needs no token", peers.localTablet.heard.some((m) => m.type === 'state'), `heard: ${types(peers.localTablet)}`);

  // HTTP from the hotspot.
  const status = async (p: string) => {
    try {
      return (await fetch(`http://${lan}:${port}${p}`)).status;
    } catch (error) {
      return String(error);
    }
  };
  for (const p of ['/api/pool', '/api/override/1', '/cloud/current', '/cloud/journal/g.jsonl', '/cloud/resume.json']) {
    const s = await status(p);
    expect(`LAN GET ${p} is refused`, s === 403, String(s));
  }
  const plan = await status('/cloud/plan.json');
  expect('LAN GET /cloud/plan.json is allowed (public)', plan !== 403, String(plan));
  for (const p of [show, cloud, ...Object.values(peers)]) p.ws.close();
} finally {
  server.kill();
}

// Without --lan, the LAN address doesn't answer at all.
const port2 = await freePort();
const closed = await relay(port2, []);
try {
  let answered = 'no answer';
  try {
    answered = String((await fetch(`http://${lan}:${port2}/api/pool`, { signal: AbortSignal.timeout(2000) })).status);
  } catch {
    // refused: right
  }
  expect('without --lan, the LAN address does not answer', answered === 'no answer', answered);
} finally {
  closed.kill();
}

const width = Math.max(...results.map((r) => r.check.length));
console.log(`\nRelay lockdown audit (a stranger at ${lan}, the laptop at 127.0.0.1)\n`);
for (const r of results) console.log(`  ${r.ok ? 'PASS' : 'FAIL'}  ${r.check.padEnd(width)}  ${r.detail}`);
const failed = results.filter((r) => !r.ok).length;
console.log(`\n  ${failed ? `${failed} FAILED` : 'all passed'} (${results.length} checks)\n`);
process.exitCode = failed ? 1 : 0;
