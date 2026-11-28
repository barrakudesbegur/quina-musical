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
import { CACHE, DATA, loadRepertoire, MEDIA, OUT, REPO, type Repertoire } from '../../../show/relay/repertoire.ts';
import { distProblem } from '../../../show/relay/build-stamp.ts';
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

/** As `shell`, but keeping a failure's stderr (to tell a setting never set from a failed read). */
async function command(cmd: string, args: string[]): Promise<checks.CommandResult> {
  try {
    const { stdout, stderr } = await run(cmd, args, { timeout: 15_000 });
    return { ok: true, stdout, stderr };
  } catch (error) {
    const e = error as { stdout?: string; stderr?: string; message?: string };
    return { ok: false, stdout: e.stdout ?? '', stderr: e.stderr ?? e.message ?? '' };
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
 * hello with its client list, replays each remote host's last `remote.status`, and sends the show page's last
 * `state` (the private one: an admin hears it, as every console does); wait a moment after the list for those.
 */
function relayView(relay: string): Promise<{ clients: { role: string }[]; remote: RemoteStatus | null; state: checks.ShowStateLike | null } | null> {
  return new Promise((resolve) => {
    const ws = new WebSocket(`${relay.replace(/^http/, 'ws')}/ws`);
    let clients: { role: string }[] | null = null;
    const remotes: RemoteStatus[] = [];
    let state: checks.ShowStateLike | null = null;
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
      resolve(clients ? { clients, remote, state } : null);
    };
    const timer = setTimeout(done, 3000);
    let settle: NodeJS.Timeout | undefined;
    ws.on('open', () => ws.send(JSON.stringify({ v: PROTOCOL_VERSION, type: 'hello', role: 'admin', clientId: 'preflight' })));
    ws.on('message', (data) => {
      const m = JSON.parse(String(data)) as { type?: string; clients?: { role: string; clientId: string }[] };
      if (m.type === 'state') state = m as checks.ShowStateLike;
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

/** This laptop's address on the hotspot, if it has one: the default route's interface's (checks.lanAddressFrom). */
async function lanAddress(): Promise<checks.LanAddress | null> {
  let route: string | null = null;
  try {
    route = (await run('route', ['-n', 'get', 'default'], { timeout: 2000 })).stdout;
  } catch {
    // no default route, or no `route`: the first address
  }
  return checks.lanAddressFrom(route, os.networkInterfaces());
}

/** The relay as the Network and Cloud checks see it: its answer to /api/repertoire, and who is on it (null when down). */
interface RelayFacts {
  answer: Awaited<ReturnType<typeof getJson>>;
  view: Awaited<ReturnType<typeof relayView>>;
}

async function relayFacts(relay: string): Promise<RelayFacts> {
  const answer = await getJson(`${relay}/api/repertoire`, {}, 3000);
  return { answer, view: answer.ok ? await relayView(relay) : null };
}

export async function runPreflight(o: PreflightOptions): Promise<checks.Check[]> {
  const out: checks.Check[] = [];
  const repertoire = loadRepertoire(o.repertoire);
  const want = (group: checks.Check['group']) => !o.only || o.only.includes(group);
  const relay = want('Network') || want('Cloud') ? await relayFacts(o.relay) : null;
  if (want('Repertoire')) out.push(...(await repertoireChecks(o, repertoire)));
  if (want('Laptop')) out.push(...(await laptopChecks(o)));
  if (want('Network') && relay) out.push(...(await networkChecks(o, repertoire.name, relay)));
  if (want('Cloud') && relay) out.push(...(await cloudChecks(o, repertoire, relay.view)));
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
  const { pools, problems: poolProblems } = checks.songPools(songs);
  const songIds = new Set(pools.keys());
  let playableEntries: { id: number; hooks: unknown[] }[] = [];
  try {
    playableEntries = playableSongs(readJson(path.join(repertoire.dataDir, 'analysis', 'index.json')));
  } catch {
    // no index: no playable song
  }
  const playable = playableEntries.map((s) => s.id);
  const missingAudio = playable.filter((id) => !fs.existsSync(path.join(repertoire.cacheDir, String(id), 'mix.flac')));
  out.push(checks.songsCheck(songIds, new Set(playable), missingAudio, poolProblems));
  const hooks = checks.provisionalHooksCheck(playableEntries);
  if (hooks) out.push(hooks);
  const printed = printedCards(repertoire);
  out.push(checks.cardsCheck(printed.cards, checks.printedCardTypes(printed.types), pools, new Set(playable)));
  const cardTypes = checks.cardTypesCheck(printed.types);
  if (cardTypes) out.push(cardTypes);

  const missingSounds = [
    ...STINGER_NAMES.filter((n) => !fs.existsSync(path.join(MEDIA, 'stingers', `${n}.mp3`))),
    ...SFX_NAMES.filter((n) => !fs.existsSync(path.join(MEDIA, 'fx', `${n}.mp3`))),
  ];
  const holdIndex = readJson(path.join(OUT, 'hold', 'index.json')) as { files?: { name: string; pcm: string }[] } | null;
  const hold = holdIndex?.files ?? [];
  out.push(...checks.soundsCheck(missingSounds, hold.length, hold.filter((h) => !fs.existsSync(path.resolve(REPO, h.pcm))).map((h) => h.name)));
  out.push(checks.voicesCheck(readJson(path.join(OUT, 'voice', 'index.json')), (name) => fs.existsSync(path.join(CACHE, 'voice', `${name}.flac`))));

  // The cloud's manifest; when it can't be fetched, this laptop's copy (its last push or pull), named with its date:
  // a copy from before a push elsewhere would read as missing files (checks.mediaCheck makes that a WARN).
  let reference: checks.MediaReference | null = null;
  let cloudProblem: string | null = null;
  if (o.cloud) {
    const remote = await getJson(`${o.cloud}/api/sync/manifests/${repertoire.name}`, o.headers);
    const files = (remote.body as { files?: Record<string, { size: number; sha256: string }> } | undefined)?.files;
    if (remote.ok && files && Object.keys(files).length > 0) reference = { files, source: "the cloud's manifest" };
    else cloudProblem = remote.error ? `no answer: ${remote.error}` : !remote.ok ? `HTTP ${remote.status}` : 'it lists no files';
  }
  if (!reference) {
    const file = referenceFile(o.dataDir, repertoire.name);
    const copy = readJson(file) as { files?: Record<string, { size: number; sha256: string }> } | null;
    if (copy?.files) reference = { files: copy.files, source: "this laptop's copy", savedAtMs: fs.statSync(file).mtimeMs };
  }
  // Re-hashing reads every byte (about 8 s for 6 GB); --fast trusts the index kept by size and mtime.
  const indexDir = o.fast ? o.dataDir : fs.mkdtempSync(path.join(os.tmpdir(), 'quina-preflight-'));
  try {
    const local = await scan(repertoireRoots(repertoire), indexDir);
    out.push(checks.mediaCheck(reference, local, !o.fast, cloudProblem));
  } finally {
    if (!o.fast) fs.rmSync(indexDir, { recursive: true, force: true });
  }
  return out;
}

async function laptopChecks(o: PreflightOptions): Promise<checks.Check[]> {
  const out: checks.Check[] = [];
  if (process.platform === 'darwin') {
    const profile = await shell('system_profiler', ['SPAudioDataType', '-json']);
    out.push(checks.audioOutputCheck(profile ? JSON.parse(profile) : null));
    const displays = await shell('system_profiler', ['SPDisplaysDataType', '-json']);
    out.push(checks.displaysCheck(displays ? JSON.parse(displays) : null, o.laptopOnly === true));
    out.push(checks.reduceMotionCheck(await command('defaults', ['read', 'com.apple.universalaccess', 'reduceMotion'])));
    out.push(...checks.sleepChecks((await shell('pmset', ['-g'])) ?? '', (await shell('pmset', ['-g', 'assertions'])) ?? ''));
    out.push(checks.powerCheck((await shell('pmset', ['-g', 'batt'])) ?? ''));
    out.push(checks.clockCheck(await shell('sntp', ['-t', '3', 'time.apple.com'])));
  } else {
    out.push({ group: 'Laptop', name: 'macOS settings', status: 'warn', detail: `not macOS (${process.platform}): check the audio output and sleep by hand` });
  }
  const disk = fs.statfsSync(DATA);
  out.push(checks.diskCheck(disk.bavail * disk.bsize));
  out.push(checks.distCheck(distProblem(path.join(REPO, 'apps/show/dist'), REPO)));
  const processes = ((await shell('ps', ['-axo', 'command'])) ?? '').split('\n');
  out.push(checks.browserCheck(processes));
  out.push(checks.chromeProfilesCheck(processes, o.laptopOnly === true));
  return out;
}

async function networkChecks(o: PreflightOptions, repertoireName: string, { answer: relayAnswer, view }: RelayFacts): Promise<checks.Check[]> {
  const out: checks.Check[] = [];
  out.push(checks.relayCheck(repertoireName, { ok: relayAnswer.ok, name: (relayAnswer.body as { name?: string } | undefined)?.name, error: relayAnswer.error }));
  out.push(checks.showPageCheck(view?.clients ?? null));
  out.push(checks.consoleCheck(view?.clients ?? null, o.laptopOnly === true));
  const audioClock = checks.audioClockCheck(view?.clients ?? null, view?.state ?? null, Date.now());
  if (audioClock) out.push(audioClock);
  if (view) out.push(checks.wiiRemoteCheck(view.remote, Date.now()));
  const lan = await lanAddress();
  const port = new URL(o.relay).port || '80';
  const lanUrl = lan ? `http://${lan.address}:${port}/console/` : null;
  const lanAnswer = lanUrl ? await getJson(lanUrl, {}, 3000) : null;
  out.push(checks.lanCheck(lanUrl, Boolean(lanAnswer?.ok), o.laptopOnly === true, lan));
  return out;
}

async function cloudChecks(o: PreflightOptions, repertoire: Repertoire, view: RelayFacts['view']): Promise<checks.Check[]> {
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
  const rounds = (plan as { rounds?: unknown[] } | null)?.rounds;
  const show: checks.ShowPageView | null = view
    ? { connected: view.clients.filter((c) => c.role === 'show').length, state: view.state, roundsInPlan: Array.isArray(rounds) ? rounds.length : null }
    : null;
  out.push(checks.gameCheck(link, cloudCurrent, edition, show));
  out.push(checks.planCheck(plan, checks.printedByType(printedCards(repertoire).cards)));
  const prices = checks.cardPricesCheck(printedCards(repertoire).types, plan);
  if (prices) out.push(prices);
  const songs = readJson(repertoire.songsJson);
  const sides = checks.sidesCheck(plan, printedCards(repertoire).types, checks.poolSongCounts(songs), checks.sharedSongCount(songs));
  if (sides) out.push(sides);
  return out;
}
