// The preflight's facts: files, macOS settings, the relay, the LAN, the cloud. Every outside call has a short
// timeout, and a fact that can't be gathered becomes a verdict, never an exception.
import { execFile } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import WebSocket from 'ws';
import { PROTOCOL_VERSION, SFX_NAMES, STINGER_NAMES } from '@quina/protocol';
import { playableSongs } from '../../../engine/src/analysis.ts';
import { loadPool, POC } from '../../../relay/pool.ts';
import { referenceFile, scan } from '../media-sync.ts';
import { poolRoots } from '../pool-roots.ts';
import * as checks from './checks.ts';

const run = promisify(execFile);

export interface PreflightOptions {
  pool?: string;
  /** The relay, for example http://127.0.0.1:5174. */
  relay: string;
  /** The cloud's https origin, or null when none is configured. */
  cloud: string | null;
  /** The Access service token headers. */
  headers: Record<string, string>;
  /** The cloud link's data folder (status.json, plan.json, the media reference). */
  dataDir: string;
  /** Trust the hash index instead of re-hashing every file. */
  fast: boolean;
  /** Only these groups (all when absent). */
  only?: readonly checks.Check['group'][];
}

const readJson = (file: string): unknown => {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return null;
  }
};

async function shell(cmd: string, args: string[]): Promise<string | null> {
  try {
    return (await run(cmd, args, { timeout: 15_000, maxBuffer: 16 << 20 })).stdout;
  } catch {
    return null;
  }
}

async function getJson(url: string, headers: Record<string, string> = {}, timeoutMs = 5000): Promise<{ ok: boolean; status?: number; body?: unknown; error?: string; ms: number }> {
  const t0 = Date.now();
  try {
    const response = await fetch(url, { headers, signal: AbortSignal.timeout(timeoutMs) });
    const body: unknown = response.headers.get('content-type')?.includes('json') ? await response.json() : await response.text();
    return { ok: response.ok, status: response.status, body, ms: Date.now() - t0 };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error), ms: Date.now() - t0 };
  }
}

/** Who is on the relay: connect briefly as an admin remote and read the first client list. */
function relayClients(relay: string): Promise<{ role: string }[] | null> {
  return new Promise((resolve) => {
    const ws = new WebSocket(`${relay.replace(/^http/, 'ws')}/ws`);
    const done = (value: { role: string }[] | null) => {
      clearTimeout(timer);
      ws.terminate();
      resolve(value);
    };
    const timer = setTimeout(() => done(null), 3000);
    ws.on('open', () => ws.send(JSON.stringify({ v: PROTOCOL_VERSION, type: 'hello', role: 'admin', clientId: 'preflight' })));
    ws.on('message', (data) => {
      const m = JSON.parse(String(data)) as { type?: string; clients?: { role: string; clientId: string }[] };
      if (m.type === 'relay.clients' && Array.isArray(m.clients)) done(m.clients.filter((c) => c.clientId !== 'preflight'));
    });
    ws.on('error', () => done(null));
  });
}

/** This laptop's address on the hotspot, if it has one. */
function lanAddress(): string | null {
  for (const list of Object.values(os.networkInterfaces())) for (const i of list ?? []) if (i.family === 'IPv4' && !i.internal) return i.address;
  return null;
}

export async function runPreflight(o: PreflightOptions): Promise<checks.Check[]> {
  const out: checks.Check[] = [];
  const pool = loadPool(o.pool);
  const want = (group: checks.Check['group']) => !o.only || o.only.includes(group);
  if (want('Pool')) out.push(...(await poolChecks(o, pool)));
  if (want('Laptop')) out.push(...(await laptopChecks()));
  if (want('Network')) out.push(...(await networkChecks(o, pool.name)));
  if (want('Cloud')) out.push(...(await cloudChecks(o)));
  return out;
}

async function poolChecks(o: PreflightOptions, pool: ReturnType<typeof loadPool>): Promise<checks.Check[]> {
  const out: checks.Check[] = [];
  const songs = readJson(pool.songsJson);
  const poolSongIds = new Set(Array.isArray(songs) ? songs.map((s: { id: number }) => s.id) : []);
  let playable: number[] = [];
  try {
    playable = playableSongs(readJson(path.join(pool.dataDir, 'analysis', 'index.json'))).map((s) => s.id);
  } catch {
    // no index: no playable song
  }
  const missingAudio = playable.filter((id) => !fs.existsSync(path.join(pool.cacheDir, String(id), 'mix.flac')));
  out.push(checks.songsCheck(poolSongIds, new Set(playable), missingAudio));
  out.push(checks.cardsCheck(pool.cardsJson ? readJson(pool.cardsJson) : null, poolSongIds, new Set(playable)));

  const audios = path.resolve(POC, '../../client/public/audios');
  const missingSounds = [
    ...STINGER_NAMES.filter((n) => !fs.existsSync(path.join(audios, 'stingers', `${n}.mp3`))),
    ...SFX_NAMES.filter((n) => !fs.existsSync(path.join(audios, 'fx', `${n}.mp3`))),
  ];
  const holdIndex = readJson(path.join(POC, 'data', 'hold', 'index.json')) as { files?: { name: string; pcm: string }[] } | null;
  const hold = holdIndex?.files ?? [];
  out.push(...checks.soundsCheck(missingSounds, hold.length, hold.filter((h) => !fs.existsSync(path.resolve(POC, h.pcm))).map((h) => h.name)));

  let reference: { files: Record<string, { size: number; sha256: string }>; source: string } | null = null;
  if (o.cloud) {
    const remote = await getJson(`${o.cloud}/api/sync/${pool.name}/manifest`, o.headers);
    const files = (remote.body as { files?: Record<string, { size: number; sha256: string }> } | undefined)?.files;
    if (remote.ok && files && Object.keys(files).length > 0) reference = { files, source: "the cloud's manifest" };
  }
  if (!reference) {
    const local = readJson(referenceFile(o.dataDir, pool.name)) as { files?: Record<string, { size: number; sha256: string }> } | null;
    if (local?.files) reference = { files: local.files, source: 'the last push or pull on this laptop' };
  }
  // Re-hashing reads every byte (about 8 s for 6 GB); --fast trusts the index kept by size and mtime.
  const indexDir = o.fast ? o.dataDir : fs.mkdtempSync(path.join(os.tmpdir(), 'quina-preflight-'));
  const local = await scan(poolRoots(pool), indexDir);
  out.push(checks.mediaCheck(reference, local, !o.fast));
  return out;
}

async function laptopChecks(): Promise<checks.Check[]> {
  const out: checks.Check[] = [];
  if (process.platform === 'darwin') {
    const profile = await shell('system_profiler', ['SPAudioDataType', '-json']);
    out.push(checks.audioOutputCheck(profile ? JSON.parse(profile) : null));
    out.push(...checks.sleepChecks((await shell('pmset', ['-g'])) ?? '', (await shell('pmset', ['-g', 'assertions'])) ?? ''));
    out.push(checks.powerCheck((await shell('pmset', ['-g', 'batt'])) ?? ''));
  } else {
    out.push({ group: 'Laptop', name: 'macOS settings', status: 'warn', detail: `not macOS (${process.platform}): check the audio output and sleep by hand` });
  }
  const disk = fs.statfsSync(POC);
  out.push(checks.diskCheck(disk.bavail * disk.bsize));
  out.push(checks.browserCheck(((await shell('ps', ['-axo', 'command'])) ?? '').split('\n')));
  return out;
}

async function networkChecks(o: PreflightOptions, poolName: string): Promise<checks.Check[]> {
  const out: checks.Check[] = [];
  const relayAnswer = await getJson(`${o.relay}/api/pool`, {}, 3000);
  out.push(checks.relayCheck(poolName, { ok: relayAnswer.ok, name: (relayAnswer.body as { name?: string } | undefined)?.name, error: relayAnswer.error }));
  out.push(checks.showPageCheck(relayAnswer.ok ? await relayClients(o.relay) : null));
  const lan = lanAddress();
  const port = new URL(o.relay).port || '80';
  const lanUrl = lan ? `http://${lan}:${port}/console/` : null;
  const lanAnswer = lanUrl ? await getJson(lanUrl, {}, 3000) : null;
  out.push(checks.lanCheck(lanUrl, Boolean(lanAnswer?.ok)));
  return out;
}

async function cloudChecks(o: PreflightOptions): Promise<checks.Check[]> {
  const out: checks.Check[] = [];
  const plan = readJson(path.join(o.dataDir, 'plan.json'));
  const planEdition = (plan as { edition?: string } | null)?.edition ?? null;
  const link = readJson(path.join(o.dataDir, 'status.json')) as checks.LinkStatusFile | null;
  let cloudCurrent: { gameId: string; seq: number } | null = null;
  let edition: string | null = planEdition;
  if (!o.cloud) {
    out.push({ group: 'Cloud', name: 'Cloud', status: 'fail', detail: 'no cloud configured: set QUINA_CLOUD_URL in cloud/.env.link' });
  } else {
    const health = await getJson(`${o.cloud}/api/health`);
    edition = (health.body as { edition?: string } | undefined)?.edition ?? edition;
    out.push(checks.cloudCheck(o.cloud, { ok: health.ok, status: health.status, edition: edition ?? undefined, error: health.error }, planEdition));
    const t0 = Date.now();
    const ping = await getJson(`${o.cloud}/api/ping`, o.headers);
    const t1 = Date.now();
    const body = ping.body as { nowMs?: number; current?: { gameId: string; seq: number } | null } | undefined;
    cloudCurrent = body?.current ?? null;
    out.push(checks.cloudAuthCheck({ ok: ping.ok && typeof body?.nowMs === 'number', status: ping.status, rttMs: t1 - t0, offsetMs: (body?.nowMs ?? 0) - (t0 + t1) / 2, error: ping.error }));
  }
  out.push(checks.linkCheck(link, Date.now()));
  out.push(checks.gameCheck(link, cloudCurrent, edition));
  out.push(checks.planCheck(plan));
  return out;
}
