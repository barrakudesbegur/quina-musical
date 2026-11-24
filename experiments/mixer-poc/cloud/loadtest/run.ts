// Load test: 400 simulated phones follow the public feed while a scripted show plays through the real laptop link
// into the Worker under `wrangler dev`. Midway, every phone drops at once and reconnects with the app's jittered
// backoff (a 5G blip). It measures what the GameRoom did, checks every phone ends with the cloud's exact public
// state, and projects a show night against the Workers Free plan's daily limits.
//   npm run loadtest -- [--phones 400] [--rounds 3] [--songs 30] [--song-ms 500] [--report reports/loadtest.md]
// Local workerd is not Cloudflare's edge: the latencies are this machine's; the counts are what gets billed.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { PROTOCOL_VERSION } from '@quina/protocol';
import { CloudLink } from '../laptop/link.ts';
import type { EditionExport, RoomStats } from '../src/api.ts';
import { LINK } from '../src/config.ts';
import { followFeed, reconnectDelayMs, type PublicChange, type PublicView } from '@quina/protocol';
import { JournalBuilder } from '../test/support/journal-builder.ts';
import { startDevServer, type DevServer } from './dev-server.ts';
import { fakeRelay, type FakeRelay } from './fake-relay.ts';
import { FREE_PLAN, projectNight, NIGHT, type Measured } from './model.ts';

const args = process.argv.slice(2);
const option = (name: string, fallback: number): number => {
  const i = args.indexOf(name);
  return i >= 0 ? Number(args[i + 1]) : fallback;
};
const PHONES = option('--phones', 400);
const ROUNDS = option('--rounds', 3);
const SONGS = option('--songs', 30);
const SONG_MS = option('--song-ms', 500);
const reportIndex = args.indexOf('--report');
const REPORT = reportIndex >= 0 ? path.resolve(args[reportIndex + 1] as string) : null;
const v = PROTOCOL_VERSION;
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// ---- phones ------------------------------------------------------------------------------------------------
interface PhoneStats {
  connects: number;
  snapshots: number;
  deltas: number;
  resyncs: number;
  bytes: number;
  landingLatencyMs: number[];
}

class Phone {
  view: PublicView | null = null;
  readonly stats: PhoneStats = { connects: 0, snapshots: 0, deltas: 0, resyncs: 0, bytes: 0, landingLatencyMs: [] };
  private ws: WebSocket | null = null;
  private attempt = 0;
  private running = true;
  connectedAt: number[] = [];
  readonly url: string;

  constructor(url: string) {
    this.url = url;
  }

  connect(): void {
    if (!this.running) return;
    const ws = new WebSocket(this.url);
    this.ws = ws;
    ws.addEventListener('open', () => {
      this.attempt = 0;
      this.stats.connects += 1;
      this.connectedAt.push(Date.now());
    });
    ws.addEventListener('message', (event) => {
      const text = String(event.data);
      this.stats.bytes += text.length;
      const message: unknown = JSON.parse(text);
      const result = followFeed(this.view, message);
      if (result.kind === 'resync') {
        this.stats.resyncs += 1;
        this.view = null;
        ws.close();
        return;
      }
      if (result.kind !== 'ok') return;
      const m = message as { type: string; changes?: PublicChange[] };
      if (m.type === 'public.state') this.stats.snapshots += 1;
      else {
        this.stats.deltas += 1;
        for (const change of m.changes ?? []) if (change.kind === 'landed') this.stats.landingLatencyMs.push(Date.now() - change.landing.atMs);
      }
      this.view = result.view;
    });
    ws.addEventListener('close', () => {
      if (this.ws !== ws || !this.running) return;
      this.ws = null;
      setTimeout(() => this.connect(), reconnectDelayMs(this.attempt++));
    });
    ws.addEventListener('error', () => {});
  }

  /** The network drops: the socket dies and the app reconnects as usual. */
  drop(): void {
    this.view = null;
    this.ws?.close();
  }

  stop(): void {
    this.running = false;
    this.ws?.close();
  }

  get open(): boolean {
    return this.ws?.readyState === WebSocket.OPEN && this.view !== null;
  }
}

// ---- the scripted show -----------------------------------------------------------------------------------
function state(interval: { nextRound: number } | null): unknown {
  const now = Date.now();
  return {
    v,
    type: 'state',
    next: { songId: 1, title: 'private', artist: 'private' },
    possibleWinners: { line: [], bingo: [] },
    pause: null,
    interval: interval ? { sinceMs: now, nextRound: interval.nextRound, guideEndMs: now + 600_000 } : null,
    schedule: { roundEndMs: now + 1_000_000, gameEndMs: now + 3 * 3_600_000, roundDriftSec: 0, gameDriftSec: 0 },
  };
}

async function playShow(relay: FakeRelay, storm: () => Promise<void>): Promise<JournalBuilder> {
  const b = new JournalBuilder(`load-${Date.now().toString(36)}`, Date.now(), Date.now);
  let emitted = 0;
  // Live: each entry goes out once, as the engine emits it.
  const sent = () => {
    relay.journal(b.entries.slice(emitted));
    emitted = b.entries.length;
  };
  b.cards('1-400').settings();
  sent();
  for (let round = 1; round <= ROUNDS; round++) {
    b.startRound(round % 4 === 0 ? 'special' : 'normal');
    relay.emit({ v, type: 'shuffle.scheduled', round, kind: 'normal', startAtMs: Date.now(), endAtMs: Date.now() + 1000, songCount: 77 });
    sent();
    for (let song = 0; song < SONGS; song++) {
      const start = Date.now();
      relay.emit({ v, type: 'transition.scheduled', id: `t${round}-${song}`, to: 0, drum: { removeId: null, targetId: 0, minLaps: 1 }, spinStartAtMs: start, landAtMs: start + SONG_MS * 0.8 });
      await sleep(SONG_MS * 0.8);
      b.land(1);
      sent();
      relay.emit({ v, type: 'transition.landed', id: `t${round}-${song}`, songId: 0, position: song, atMs: Date.now() });
      relay.emit(state(null));
      if (round === 2 && song === Math.floor(SONGS / 2)) await storm();
      if (song === Math.floor((SONGS * 2) / 3)) {
        const claim = b.claim(17 + round, 'line');
        b.scene('check');
        sent();
        relay.emit({ v, type: 'check.scheduled', check: { claimId: claim, cardId: 17 + round, kind: 'line', outcome: 'complete', row: 0, otherRows: [], steps: [], startAtMs: Date.now(), endAtMs: Date.now() + 1000 } });
        b.decide(claim, 'valid').confirmLine().scene('celebration').scene('play');
        sent();
      }
      await sleep(SONG_MS * 0.2);
    }
    const bingo = b.claim(100 + round, 'bingo');
    b.scene('check').decide(bingo, 'valid').scene('celebration').scene('interval', round + 1);
    sent();
    relay.emit(state({ nextRound: round + 1 }));
    await sleep(LINK.stateEveryMs * 2);
  }
  return b;
}

// ---- run ---------------------------------------------------------------------------------------------------
function percentile(values: number[], p: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length))] as number;
}

async function waitFor(what: string, check: () => boolean, timeoutMs = 60_000): Promise<number> {
  const start = Date.now();
  while (!check()) {
    if (Date.now() - start > timeoutMs) throw new Error(`timed out waiting for ${what}`);
    await sleep(50);
  }
  return Date.now() - start;
}

async function main(): Promise<void> {
  console.log(`load test: ${PHONES} phones, ${ROUNDS} rounds × ${SONGS} songs at ${SONG_MS} ms`);
  const server: DevServer = await startDevServer();
  const relay = await fakeRelay();
  const link = new CloudLink({
    relayUrl: relay.url,
    cloudUrl: `${server.ws}/ws/show`,
    cloudHeaders: {},
    dataDir: fs.mkdtempSync(path.join(os.tmpdir(), 'quina-load-')),
    clientId: 'laptop-load',
    log: () => {},
  });
  const phones = Array.from({ length: PHONES }, (_, i) => new Phone(`${server.ws}/feed?cards=${(i % 400) + 1},${((i * 7) % 400) + 1}`));
  let stormReconnectMs = 0;
  let stormSpreadMs = 0;
  try {
    link.start();
    await waitFor('the link', () => link.status().cloud === 'online');
    const connectStart = Date.now();
    for (const [i, phone] of phones.entries()) {
      phone.connect();
      if (i % 50 === 49) await sleep(100); // phones arrive over ~1 s, as doors open
    }
    const connectMs = await waitFor('every phone to connect', () => phones.every((p) => p.open));
    console.log(`  ${PHONES} phones connected in ${connectMs + (Date.now() - connectStart - connectMs)} ms`);

    const storm = async () => {
      console.log('  storm: every phone drops at once');
      const at = Date.now();
      for (const phone of phones) phone.drop();
      stormReconnectMs = await waitFor('every phone back after the storm', () => phones.every((p) => p.open));
      const back = phones.map((p) => (p.connectedAt.at(-1) ?? at) - at);
      stormSpreadMs = Math.max(...back) - Math.min(...back);
      console.log(`  storm: all back in ${stormReconnectMs} ms (spread over ${stormSpreadMs} ms)`);
    };
    const show = await playShow(relay, storm);
    await waitFor('the cloud to have the whole journal', () => link.status().ackSeq === show.entries.length);
    await sleep(1000);

    const stats = (await (await fetch(`${server.http}/api/stats`)).json()) as RoomStats;
    const exported = (await (await fetch(`${server.http}/api/export`)).json()) as EditionExport;
    const expected = JSON.stringify(exported.publicState);
    const matching = phones.filter((p) => JSON.stringify(p.view?.state) === expected).length;
    const totals = phones.reduce(
      (t, p) => ({
        connects: t.connects + p.stats.connects,
        snapshots: t.snapshots + p.stats.snapshots,
        deltas: t.deltas + p.stats.deltas,
        resyncs: t.resyncs + p.stats.resyncs,
        bytes: t.bytes + p.stats.bytes,
      }),
      { connects: 0, snapshots: 0, deltas: 0, resyncs: 0, bytes: 0 },
    );
    const latencies = phones.flatMap((p) => p.stats.landingLatencyMs);
    const songs = ROUNDS * SONGS;
    const journal = exported.games.find((g) => g.gameId === exported.currentGameId)?.entries.length ?? 0;
    const linkMessages = stats.messagesIn - stats.phoneMessagesIn;

    const measured: Measured = {
      songs,
      journalEntries: journal,
      linkMessagesPerSong: linkMessages / songs,
      rowsWrittenPerSong: stats.rowsWritten / songs,
      rowsReadPerSong: stats.rowsRead / songs,
      broadcastsPerSong: stats.broadcasts / songs,
      bytesPerPhonePerSong: totals.bytes / PHONES / songs,
      snapshotBytes: JSON.stringify(exported.publicState).length,
    };
    const night = projectNight(measured, NIGHT);

    const lines = [
      `# Cloud load test, ${new Date().toISOString().slice(0, 10)}`,
      '',
      `${PHONES} simulated phones followed the public feed while a scripted show played ${ROUNDS} rounds × ${SONGS} songs (a landing every ${SONG_MS} ms) through the real laptop link into the Worker under \`wrangler dev\` (workerd, the real wrangler.jsonc). In round 2 every phone dropped at once and came back with the app's jittered backoff. Produced by \`npm run loadtest\` (loadtest/run.ts); the projection model is loadtest/model.ts.`,
      '',
      '## What happened',
      '',
      '| | |',
      '|---|---|',
      `| Phones that ended with exactly the cloud's public state | **${matching} / ${PHONES}** |`,
      `| Gaps seen by phones (a delta out of order → resync) | ${totals.resyncs} |`,
      `| Phone connections (first + after the storm) | ${totals.connects} (GameRoom accepted ${stats.phonesAccepted}) |`,
      `| Storm: every phone back after | ${(stormReconnectMs / 1000).toFixed(1)} s, reconnections spread over ${(stormSpreadMs / 1000).toFixed(1)} s |`,
      `| Landing → phone (local machine) | median ${percentile(latencies, 50)} ms, p95 ${percentile(latencies, 95)} ms, max ${percentile(latencies, 100)} ms |`,
      `| Journal entries in the cloud | ${journal} of ${show.entries.length} (${stats.uploads} uploads, ${stats.duplicates} duplicates, ${stats.conflicts} conflicts, ${stats.refused} refused) |`,
      `| Messages from the laptop | ${linkMessages} (${measured.linkMessagesPerSong.toFixed(1)} per song) |`,
      `| Messages from phones | ${stats.phoneMessagesIn} |`,
      `| Messages to phones | ${stats.messagesOut} (${stats.broadcasts} broadcasts) |`,
      `| SQLite rows written / read | ${stats.rowsWritten} / ${stats.rowsRead} (${measured.rowsWrittenPerSong.toFixed(2)} written per song) |`,
      `| Data per phone | ${(totals.bytes / PHONES / 1024).toFixed(1)} KB for ${songs} songs; the full public state is ${(measured.snapshotBytes / 1024).toFixed(1)} KB |`,
      '',
      `## A show night against the Free plan (per day, resetting 00:00 UTC)`,
      '',
      `Assumptions: ${NIGHT.phones} phones, ${NIGHT.hours} h of show, ${NIGHT.rounds} rounds × ${NIGHT.songsPerRound} songs, each phone reconnecting ${NIGHT.reconnectsPerPhonePerHour} times an hour (screen locks, network changes; worst case ${NIGHT.worstReconnectsPerPhonePerHour}), ${NIGHT.adminRequests} admin API calls, plus a same-day rehearsal of ${NIGHT.rehearsalPhones} phones for ${NIGHT.rehearsalHours} h. The per-song costs are the measured ones above.`,
      '',
      '| Limit | Free plan | Show night | Worst case | Used (worst) |',
      '|---|---|---|---|---|',
      ...night.rows.map((r) => `| ${r.label} | ${r.limit.toLocaleString('en')} | ${Math.round(r.typical).toLocaleString('en')} | ${Math.round(r.worst).toLocaleString('en')} | ${((r.worst / r.limit) * 100).toFixed(1)}% |`),
      '',
      ...night.notes.map((n) => `- ${n}`),
      '',
      `Free plan limits as published by Cloudflare (Durable Objects pricing and Workers limits pages, read ${new Date().toISOString().slice(0, 10)}): ${FREE_PLAN.source}`,
      '',
    ];
    const report = lines.join('\n');
    console.log(`\n${report}`);
    if (REPORT) {
      fs.mkdirSync(path.dirname(REPORT), { recursive: true });
      fs.writeFileSync(REPORT, report);
      console.log(`report written to ${path.relative(process.cwd(), REPORT)}`);
    }
    const ok = matching === PHONES && totals.resyncs === 0 && journal === show.entries.length && stats.conflicts === 0 && stats.refused === 0;
    if (!ok) {
      console.error('LOAD TEST FAILED: see the table above');
      process.exitCode = 1;
    }
  } finally {
    for (const phone of phones) phone.stop();
    link.stop();
    await relay.close();
    await server.stop();
  }
}

await main();
