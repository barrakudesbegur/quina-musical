// The preflight's facts: files, macOS settings, the relay, the LAN, the cloud. Every outside call has a short
// timeout, and a fact that can't be gathered becomes a verdict, never an exception.
import { execFile } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import WebSocket from 'ws';
import { PROTOCOL_VERSION, SFX_NAMES, STINGER_NAMES, readRemoteStatus, type RemoteStatus } from '@quina/protocol';
import { playableSongs } from '../../../show/engine/src/analysis.ts';
import { DATA, loadRepertoire, MEDIA, OUT, REPO, type Repertoire } from '../../../show/relay/repertoire.ts';
import { CLOUD_PLAN_FILE } from '../../../show/relay/plan.ts';
import { referenceFile, scan } from '../media-sync.ts';
import { repertoireRoots } from '../repertoire-roots.ts';
import * as checks from './checks.ts';

const run = promisify(execFile);

export interface PreflightOptions {
  repertoire?: string;
  /** The relay, for example http://127.0.0.1:5174. */
  relay: string;
  /** The cloud's https origin, or null when none is configured. */
  cloud: string | null;
  /** The Access service token headers. */
  headers: Record<string, string>;
  /** The cloud link's data folder (status.json, cloud-plan.json, the media reference). */
  dataDir: string;
  /** Trust the hash index instead of re-hashing every file. */
  fast: boolean;
  /** Without the tablet: the tech drives from the console on the laptop's own screen (runbook: "Without the tablet"). */
  laptopOnly?: boolean;
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

/**
 * Who is on the relay, and the Wii remote's last status: connect briefly as an admin remote. The relay answers the
 * hello with its client list and replays each remote host's last `remote.status`; wait a moment after the list
 * for those.
 */
function relayView(relay: string): Promise<{ clients: { role: string }[]; remote: RemoteStatus | null } | null> {
  return new Promise((resolve) => {
    const ws = new WebSocket(`${relay.replace(/^http/, 'ws')}/ws`);
    let clients: { role: string }[] | null = null;
    const remotes: RemoteStatus[] = [];
    const done = () => {
      clearTimeout(timer);
      clearTimeout(settle);
      ws.terminate();
      // Several hosts: a connected remote first, else the latest change; its drops summed over every host.
      const chosen = [...remotes].sort((a, b) => Number(b.connected) - Number(a.connected) || b.sinceMs - a.sinceMs)[0] ?? null;
      const counted = remotes.filter((r) => r.drops !== undefined);
      const dropTimes = remotes.map((r) => r.lastDropMs).filter((t): t is number => typeof t === 'number');
      const remote: RemoteStatus | null = chosen && counted.length
        ? { ...chosen, drops: counted.reduce((sum, r) => sum + (r.drops ?? 0), 0), lastDropMs: dropTimes.length ? Math.max(...dropTimes) : null }
        : chosen;
      resolve(clients ? { clients, remote } : null);
    };
    const timer = setTimeout(done, 3000);
    let settle: NodeJS.Timeout | undefined;
    ws.on('open', () => ws.send(JSON.stringify({ v: PROTOCOL_VERSION, type: 'hello', role: 'admin', clientId: 'preflight' })));
    ws.on('message', (data) => {
      const m = JSON.parse(String(data)) as { type?: string; clients?: { role: string; clientId: string }[] };
      const remote = readRemoteStatus(m);
      if (remote) remotes.push(remote);
      if (m.type === 'relay.clients' && Array.isArray(m.clients)) {
        clients = m.clients.filter((c) => c.clientId !== 'preflight');
        settle ??= setTimeout(done, 400);
      }
    });
    ws.on('error', done);
  });
}

/** This laptop's address on the hotspot, if it has one. */
function lanAddress(): string | null {
  for (const list of Object.values(os.networkInterfaces())) for (const i of list ?? []) if (i.family === 'IPv4' && !i.internal) return i.address;
  return null;
}

export async function runPreflight(o: PreflightOptions): Promise<checks.Check[]> {
  const out: checks.Check[] = [];
  const repertoire = loadRepertoire(o.repertoire);
  const want = (group: checks.Check['group']) => !o.only || o.only.includes(group);
  if (want('Repertoire')) out.push(...(await repertoireChecks(o, repertoire)));
  if (want('Laptop')) out.push(...(await laptopChecks(o)));
  if (want('Network')) out.push(...(await networkChecks(o, repertoire.name)));
  if (want('Cloud')) out.push(...(await cloudChecks(o, repertoire)));
  return out;
}

/** The repertoire's printed cards (cards.json) and their types (card-types.json beside it), as apps/cards writes them. */
function printedCards(repertoire: Repertoire): { cards: unknown; types: unknown } {
  if (!repertoire.cardsJson) return { cards: null, types: null };
  return { cards: readJson(repertoire.cardsJson), types: readJson(path.join(path.dirname(repertoire.cardsJson), 'card-types.json')) };
}

async function repertoireChecks(o: PreflightOptions, repertoire: Repertoire): Promise<checks.Check[]> {
  const out: checks.Check[] = [];
  const songs = readJson(repertoire.songsJson);
  const pools = checks.songPools(songs);
  const songIds = new Set(pools.keys());
  let playable: number[] = [];
  try {
    playable = playableSongs(readJson(path.join(repertoire.dataDir, 'analysis', 'index.json'))).map((s) => s.id);
  } catch {
    // no index: no playable song
  }
  const missingAudio = playable.filter((id) => !fs.existsSync(path.join(repertoire.cacheDir, String(id), 'mix.flac')));
  out.push(checks.songsCheck(songIds, new Set(playable), missingAudio));
  const printed = printedCards(repertoire);
  out.push(checks.cardsCheck(printed.cards, checks.printedCardTypes(printed.types), pools, new Set(playable)));

  const missingSounds = [
    ...STINGER_NAMES.filter((n) => !fs.existsSync(path.join(MEDIA, 'stingers', `${n}.mp3`))),
    ...SFX_NAMES.filter((n) => !fs.existsSync(path.join(MEDIA, 'fx', `${n}.mp3`))),
  ];
  const holdIndex = readJson(path.join(OUT, 'hold', 'index.json')) as { files?: { name: string; pcm: string }[] } | null;
  const hold = holdIndex?.files ?? [];
  out.push(...checks.soundsCheck(missingSounds, hold.length, hold.filter((h) => !fs.existsSync(path.resolve(REPO, h.pcm))).map((h) => h.name)));

  let reference: { files: Record<string, { size: number; sha256: string }>; source: string } | null = null;
  if (o.cloud) {
    const remote = await getJson(`${o.cloud}/api/sync/${repertoire.name}/manifest`, o.headers);
    const files = (remote.body as { files?: Record<string, { size: number; sha256: string }> } | undefined)?.files;
    if (remote.ok && files && Object.keys(files).length > 0) reference = { files, source: "the cloud's manifest" };
  }
  if (!reference) {
    const local = readJson(referenceFile(o.dataDir, repertoire.name)) as { files?: Record<string, { size: number; sha256: string }> } | null;
    if (local?.files) reference = { files: local.files, source: 'the last push or pull on this laptop' };
  }
  // Re-hashing reads every byte (about 8 s for 6 GB); --fast trusts the index kept by size and mtime.
  const indexDir = o.fast ? o.dataDir : fs.mkdtempSync(path.join(os.tmpdir(), 'quina-preflight-'));
  const local = await scan(repertoireRoots(repertoire), indexDir);
  out.push(checks.mediaCheck(reference, local, !o.fast));
  return out;
}

async function laptopChecks(o: PreflightOptions): Promise<checks.Check[]> {
  const out: checks.Check[] = [];
  if (process.platform === 'darwin') {
    const profile = await shell('system_profiler', ['SPAudioDataType', '-json']);
    out.push(checks.audioOutputCheck(profile ? JSON.parse(profile) : null));
    const displays = await shell('system_profiler', ['SPDisplaysDataType', '-json']);
    out.push(checks.displaysCheck(displays ? JSON.parse(displays) : null, o.laptopOnly === true));
    out.push(...checks.sleepChecks((await shell('pmset', ['-g'])) ?? '', (await shell('pmset', ['-g', 'assertions'])) ?? ''));
    out.push(checks.powerCheck((await shell('pmset', ['-g', 'batt'])) ?? ''));
  } else {
    out.push({ group: 'Laptop', name: 'macOS settings', status: 'warn', detail: `not macOS (${process.platform}): check the audio output and sleep by hand` });
  }
  const disk = fs.statfsSync(DATA);
  out.push(checks.diskCheck(disk.bavail * disk.bsize));
  out.push(checks.browserCheck(((await shell('ps', ['-axo', 'command'])) ?? '').split('\n')));
  return out;
}

async function networkChecks(o: PreflightOptions, repertoireName: string): Promise<checks.Check[]> {
  const out: checks.Check[] = [];
  const relayAnswer = await getJson(`${o.relay}/api/repertoire`, {}, 3000);
  out.push(checks.relayCheck(repertoireName, { ok: relayAnswer.ok, name: (relayAnswer.body as { name?: string } | undefined)?.name, error: relayAnswer.error }));
  const view = relayAnswer.ok ? await relayView(o.relay) : null;
  out.push(checks.showPageCheck(view?.clients ?? null));
  out.push(checks.consoleCheck(view?.clients ?? null, o.laptopOnly === true));
  if (view) out.push(checks.wiiRemoteCheck(view.remote, Date.now()));
  const lan = lanAddress();
  const port = new URL(o.relay).port || '80';
  const lanUrl = lan ? `http://${lan}:${port}/console/` : null;
  const lanAnswer = lanUrl ? await getJson(lanUrl, {}, 3000) : null;
  out.push(checks.lanCheck(lanUrl, Boolean(lanAnswer?.ok), o.laptopOnly === true));
  return out;
}

async function cloudChecks(o: PreflightOptions, repertoire: Repertoire): Promise<checks.Check[]> {
  const out: checks.Check[] = [];
  // The cloud's plan as the link keeps it ({ savedAtMs, plan }); the relay serves the newest to the screens.
  const plan = (readJson(path.join(o.dataDir, CLOUD_PLAN_FILE)) as { plan?: unknown } | null)?.plan ?? null;
  const planEdition = (plan as { edition?: string } | null)?.edition ?? null;
  const link = readJson(path.join(o.dataDir, 'status.json')) as checks.LinkStatusFile | null;
  let cloudCurrent: { gameId: string; seq: number } | null = null;
  let edition: string | null = planEdition;
  if (!o.cloud) {
    out.push({ group: 'Cloud', name: 'Cloud', status: 'fail', detail: 'no cloud configured: set QUINA_CLOUD_URL in apps/cloud/.env.link' });
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
    // Today's usage against the free plan's daily limits, as the cloud counts it.
    const stats = await getJson(`${o.cloud}/api/stats`, o.headers);
    out.push(checks.usageCheck(stats.ok ? (stats.body as checks.CloudStats) : null, Date.now()));
  }
  out.push(checks.linkCheck(link, Date.now()));
  out.push(checks.gameCheck(link, cloudCurrent, edition));
  out.push(checks.planCheck(plan, checks.printedByType(printedCards(repertoire).cards)));
  const prices = checks.cardPricesCheck(printedCards(repertoire).types, plan);
  if (prices) out.push(prices);
  const sides = checks.sidesCheck(plan, printedCards(repertoire).types, checks.poolSongCounts(readJson(repertoire.songsJson)));
  if (sides) out.push(sides);
  return out;
}
