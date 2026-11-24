// What a show night costs against the Workers Free plan's daily limits, from the load test's measured per-song
// costs and a few stated assumptions about the night. Pure arithmetic, so the assumptions are easy to change.
import { CLOUD, LINK } from '../src/config.ts';

/** The Workers Free plan, per day (resetting 00:00 UTC), as published by Cloudflare. */
export const FREE_PLAN = Object.freeze({
  workerRequests: 100_000,
  doRequests: 100_000,
  durationGBs: 13_000,
  rowsRead: 5_000_000,
  rowsWritten: 100_000,
  source:
    'Workers 100,000 requests/day; Durable Objects 100,000 requests/day, 13,000 GB-s/day (128 MB per object, billed only while not idle under the Hibernation API), 5 million SQLite rows read/day, 100,000 rows written/day, 5 GB stored. A WebSocket connection is one request; incoming WebSocket messages are billed 20:1, outgoing ones are free; each RPC call is one request; each alarm is one request and each setAlarm() one row written. Static assets are free and unlimited.',
});

/** The night, as assumed. */
export const NIGHT = Object.freeze({
  phones: 400,
  /** From doors open to the last Bingo. */
  hours: 4,
  rounds: 12,
  songsPerRound: 45,
  /** Reconnections per phone per hour: switching apps, network handovers (the app keeps the screen on). */
  reconnectsPerPhonePerHour: 12,
  /** A pessimistic night: a reconnection every 2 minutes per phone. */
  worstReconnectsPerPhonePerHour: 30,
  /** Admin and console API calls (export, stats). */
  adminRequests: 200,
  /** The laptop link reconnecting (5G drops, hotspot switches). */
  laptopReconnects: 50,
  /** A rehearsal the same day (UTC) with a few phones. */
  rehearsalPhones: 20,
  rehearsalHours: 2,
  rehearsalSongs: 90,
  /** Extra `state` messages per song while a console listens through the cloud, at the show's real pace. */
  consoleStatesPerSong: 10,
  /** GameRoom active time per event (a message, a connection, an alarm): typical and pessimistic. */
  activeMsPerEvent: 10,
  worstActiveMsPerEvent: 100,
});

/** What the load test measured, per song played. */
export interface Measured {
  songs: number;
  journalEntries: number;
  linkMessagesPerSong: number;
  rowsWrittenPerSong: number;
  rowsReadPerSong: number;
  broadcastsPerSong: number;
  bytesPerPhonePerSong: number;
  snapshotBytes: number;
}

export interface Row {
  label: string;
  limit: number;
  typical: number;
  worst: number;
}

export function projectNight(m: Measured, n: typeof NIGHT): { rows: Row[]; notes: string[] } {
  const hours = n.hours + n.rehearsalHours;
  const songs = n.rounds * n.songsPerRound + n.rehearsalSongs;
  const connects = (rate: number) => n.phones * (1 + rate * n.hours) + n.rehearsalPhones * (1 + rate * n.rehearsalHours) + n.laptopReconnects;
  // The laptop: what it sends per song, plus a keepalive when it has said nothing for a while (an upper bound),
  // plus, while a console listens through the cloud, more `state` than a fast load test shows: at the show's pace
  // (about 15 s a song) assume up to `consoleStatesPerSong` more, coalesced by the link.
  const linkMessages = songs * (m.linkMessagesPerSong + n.consoleStatesPerSong) + (hours * 3_600_000) / LINK.keepaliveMs;
  // The silence alarm runs about once per CLOUD.showSilenceMs while the laptop is connected.
  const alarms = (hours * 3_600_000) / CLOUD.showSilenceMs;
  const doRequests = (rate: number) => connects(rate) + Math.ceil(linkMessages / 20) + alarms + n.adminRequests;
  const workerRequests = (rate: number) => connects(rate) + n.adminRequests;
  const rowsWritten = songs * m.rowsWrittenPerSong + alarms;
  // Every wake reads the snapshot; assume the worst, that every event wakes the GameRoom. Exports read everything.
  const events = (rate: number) => connects(rate) + linkMessages + alarms + n.adminRequests;
  const rowsRead = (rate: number) => songs * m.rowsReadPerSong + events(rate) + (n.adminRequests / 10) * (songs * 1.5);
  const duration = (rate: number, ms: number) => (events(rate) * ms * 0.128) / 1000;

  const typical = n.reconnectsPerPhonePerHour;
  const worst = n.worstReconnectsPerPhonePerHour;
  const rows: Row[] = [
    { label: 'Worker requests', limit: FREE_PLAN.workerRequests, typical: workerRequests(typical), worst: workerRequests(worst) },
    { label: 'Durable Object requests', limit: FREE_PLAN.doRequests, typical: doRequests(typical), worst: doRequests(worst) },
    { label: 'Duration (GB-s)', limit: FREE_PLAN.durationGBs, typical: duration(typical, n.activeMsPerEvent), worst: duration(worst, n.worstActiveMsPerEvent) },
    { label: 'SQLite rows written', limit: FREE_PLAN.rowsWritten, typical: rowsWritten, worst: rowsWritten * 2 },
    { label: 'SQLite rows read', limit: FREE_PLAN.rowsRead, typical: rowsRead(typical), worst: rowsRead(worst) },
  ];
  // How often each phone could reconnect before the tighter request limit is reached.
  const fixed = doRequests(0) - connects(0);
  const perRate = n.phones * n.hours + n.rehearsalPhones * n.rehearsalHours;
  const headroom = (FREE_PLAN.doRequests - fixed - n.phones - n.rehearsalPhones - n.laptopReconnects) / perRate;
  const notes = [
    `Phone connections dominate: ${Math.round(connects(typical)).toLocaleString('en')} on a typical night. The requests limit is reached only if every phone reconnects about ${Math.floor(headroom)} times an hour (once every ${(60 / headroom).toFixed(1)} min) for the whole night.`,
    `The laptop sent ${m.linkMessagesPerSong.toFixed(1)} messages per song in the test (journal uploads, Spin events, coalesced states for the consoles); counting ${n.consoleStatesPerSong} more states per song at the show's pace, and keepalives, that is ${Math.round(linkMessages).toLocaleString('en')} messages, billed as ${Math.ceil(linkMessages / 20).toLocaleString('en')} requests. Phones send nothing.`,
    (() => {
      // The snapshot grows with the Game: scale the measured one to the night's last round; on average a
      // reconnection happens halfway through.
      const endSnapshot = (m.snapshotBytes * n.rounds * n.songsPerRound) / m.songs;
      const live = (m.bytesPerPhonePerSong * n.rounds * n.songsPerRound) / 1024;
      const reconnections = (n.reconnectsPerPhonePerHour * n.hours * endSnapshot) / 2 / 1024;
      return `Each phone downloads about ${live.toFixed(0)} KB of live updates over the night, plus one snapshot per reconnection (about ${(endSnapshot / 1024).toFixed(0)} KB by the last round), so about ${(live + reconnections).toFixed(0)} KB in all on a typical night. Outgoing messages are free.`;
    })(),
    `Duration assumes ${n.activeMsPerEvent} ms of activity per event (${n.worstActiveMsPerEvent} ms pessimistic) and that idle time costs nothing (Hibernation API, no timers in the GameRoom).`,
    'If a limit is hit anyway, only phones and remote consoles stop until 00:00 UTC (01:00 in Catalonia in winter); the show itself never depends on the cloud (ADR 0003). The fix on the spot is the Workers Paid plan (5 USD/month), see docs/deploy-plan.md.',
  ];
  return { rows, notes };
}
