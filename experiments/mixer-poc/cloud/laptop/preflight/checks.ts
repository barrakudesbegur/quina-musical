// The preflight's checks: pure functions from facts (gathered by gather.ts) to a verdict, so each rule is tested
// on its own. FAIL is anything that would hurt the show; WARN is worth a look. Details are plain language for
// whoever sets the laptop up.

export type Status = 'pass' | 'warn' | 'fail';

export interface Check {
  group: 'Pool' | 'Laptop' | 'Network' | 'Cloud';
  name: string;
  status: Status;
  detail: string;
}

const check = (group: Check['group'], name: string, status: Status, detail: string): Check => ({ group, name, status, detail });

// ---- the pool ---------------------------------------------------------------------------------------------
export interface CardLike {
  id: number;
  type: string;
  lines: { id: number }[][];
}

/**
 * The printed cards against the pool: every card 3 lines of 4 songs, ids unique, every song in the pool, and
 * every song on a card PLAYABLE (analysed, with a valid hook), or that card could never be completed.
 */
export function cardsCheck(cards: unknown, poolSongIds: ReadonlySet<number>, playableIds: ReadonlySet<number>): Check {
  if (!Array.isArray(cards) || cards.length === 0) return check('Pool', 'Cards', 'fail', 'no cards.json, or it is empty: the cards are not generated yet');
  const problems: string[] = [];
  const seen = new Set<number>();
  const unplayable = new Set<number>();
  let special = 0;
  for (const raw of cards as CardLike[]) {
    if (!raw || !Number.isInteger(raw.id) || !Array.isArray(raw.lines)) {
      problems.push('a card without an id or lines');
      continue;
    }
    if (seen.has(raw.id)) problems.push(`card ${raw.id} twice`);
    seen.add(raw.id);
    if (raw.type === 'special') special += 1;
    const songs = raw.lines.flat();
    if (raw.lines.length !== 3 || raw.lines.some((l) => !Array.isArray(l) || l.length !== 4)) problems.push(`card ${raw.id} is not 3 lines of 4`);
    for (const song of songs) {
      if (!poolSongIds.has(song?.id)) problems.push(`card ${raw.id} has song ${String(song?.id)}, not in the pool`);
      else if (!playableIds.has(song.id)) unplayable.add(song.id);
    }
  }
  if (unplayable.size > 0) problems.push(`songs on cards that can't play (no analysis or hook): ${[...unplayable].sort((a, b) => a - b).join(', ')}`);
  if (problems.length > 0) return check('Pool', 'Cards', 'fail', `${problems.slice(0, 4).join('; ')}${problems.length > 4 ? ` (+${problems.length - 4} more)` : ''}`);
  return check('Pool', 'Cards', 'pass', `${cards.length} cards (${special} special), every song on them playable`);
}

/** The songs: how many the pool has, and how many are ready to play. */
export function songsCheck(poolSongIds: ReadonlySet<number>, playableIds: ReadonlySet<number>, missingAudio: readonly number[]): Check {
  if (playableIds.size === 0) return check('Pool', 'Songs', 'fail', 'no playable song: run the preparation (npm run prep)');
  if (missingAudio.length > 0) return check('Pool', 'Songs', 'fail', `playable songs without their decoded audio: ${missingAudio.slice(0, 10).join(', ')}${missingAudio.length > 10 ? '…' : ''}`);
  const notReady = [...poolSongIds].filter((id) => !playableIds.has(id));
  if (notReady.length > 0) return check('Pool', 'Songs', 'warn', `${playableIds.size} of ${poolSongIds.size} playable; not ready: ${notReady.slice(0, 10).join(', ')}${notReady.length > 10 ? '…' : ''}`);
  return check('Pool', 'Songs', 'pass', `all ${playableIds.size} songs analysed, with their audio`);
}

/** Every fanfare and effect the console can play, and the Hold music, on disk. */
export function soundsCheck(missingSounds: readonly string[], holdCount: number, missingHold: readonly string[]): Check[] {
  return [
    missingSounds.length > 0
      ? check('Pool', 'Fanfares and effects', 'fail', `missing: ${missingSounds.join(', ')}`)
      : check('Pool', 'Fanfares and effects', 'pass', 'every sound the console can play is there'),
    holdCount === 0 || missingHold.length > 0
      ? check('Pool', 'Hold music', 'fail', holdCount === 0 ? 'no Hold music prepared (analysis/hold.py)' : `missing decoded files: ${missingHold.join(', ')}`)
      : check('Pool', 'Hold music', 'pass', `${holdCount} tracks`),
  ];
}

/** The files against the reference manifest (the cloud's, or the last push/pull here): present and same SHA-256. */
export function mediaCheck(reference: { files: Record<string, { size: number; sha256: string }>; source: string } | null, local: ReadonlyMap<string, { size: number; sha256: string }>, rehashed: boolean): Check {
  if (!reference) return check('Pool', 'Media files', 'warn', `${local.size} files here, no reference to compare with: run "npm run media -- push" once`);
  const missing: string[] = [];
  const changed: string[] = [];
  for (const [path, file] of Object.entries(reference.files)) {
    const here = local.get(path);
    if (!here) missing.push(path);
    else if (here.sha256 !== file.sha256 || here.size !== file.size) changed.push(path);
  }
  const how = rehashed ? 'every file re-hashed' : 'hashes from the index (--fast)';
  if (missing.length > 0 || changed.length > 0) {
    const list = [...missing.map((p) => `missing ${p}`), ...changed.map((p) => `different ${p}`)];
    return check('Pool', 'Media files', 'fail', `${list.slice(0, 3).join('; ')}${list.length > 3 ? ` (+${list.length - 3} more)` : ''}; against ${reference.source}`);
  }
  return check('Pool', 'Media files', 'pass', `${Object.keys(reference.files).length} files match ${reference.source} (${how})`);
}

// ---- the laptop -------------------------------------------------------------------------------------------
interface AudioDevice {
  _name?: string;
  coreaudio_default_audio_output_device?: string;
  coreaudio_device_transport?: string;
  coreaudio_output_source?: string;
}

/** The default audio output, from `system_profiler SPAudioDataType -json`. Wireless outputs add seconds of delay. */
export function audioOutputCheck(profile: unknown): Check {
  const devices = ((profile as { SPAudioDataType?: { _items?: AudioDevice[] }[] })?.SPAudioDataType ?? []).flatMap((item) => item._items ?? []);
  const output = devices.find((d) => d.coreaudio_default_audio_output_device === 'spaudio_yes');
  if (!output) return check('Laptop', 'Audio output', 'fail', 'no default audio output found');
  const transport = (output.coreaudio_device_transport ?? '').replace('coreaudio_device_type_', '');
  const name = `${output._name ?? '?'}${output.coreaudio_output_source && output.coreaudio_output_source !== output._name ? ` (${output.coreaudio_output_source})` : ''}`;
  if (transport === 'bluetooth' || transport === 'airplay') return check('Laptop', 'Audio output', 'fail', `${name} is ${transport}: its delay breaks the landings on the beat. Use the headphone jack, USB or HDMI`);
  if (transport === 'virtual') return check('Laptop', 'Audio output', 'warn', `${name} is a virtual device: is the PA really fed from it?`);
  if (transport === 'builtin' && /speaker/i.test(name)) return check('Laptop', 'Audio output', 'warn', `${name}: the laptop's own speakers. Plug the PA in (headphone jack, USB or HDMI)`);
  return check('Laptop', 'Audio output', 'pass', `${name} (${transport || 'unknown'})`);
}

/** Sleep, from `pmset -g` and `pmset -g assertions`: the laptop and its display must never sleep during the show. */
export function sleepChecks(pmset: string, assertions: string): Check[] {
  const setting = (key: string): { minutes: number; prevented: boolean } | null => {
    const match = new RegExp(`^\\s*${key}\\s+(\\d+)(.*)$`, 'm').exec(pmset);
    return match ? { minutes: Number(match[1]), prevented: /prevented/.test(match[2] ?? '') } : null;
  };
  const asserted = (name: string) => new RegExp(`^\\s*${name}\\s+1\\s*$`, 'm').test(assertions);
  const verdict = (label: string, key: string, assertion: string, fix: string): Check => {
    const s = setting(key);
    if (s && s.minutes === 0) return check('Laptop', label, 'pass', 'never');
    if (s?.prevented || asserted(assertion)) return check('Laptop', label, 'pass', `prevented now (setting: ${s?.minutes ?? '?'} min)`);
    return check('Laptop', label, 'fail', `after ${s?.minutes ?? '?'} min idle. ${fix}`);
  };
  return [
    verdict('System sleep', 'sleep', 'PreventUserIdleSystemSleep', 'Run "caffeinate -dis" in a terminal for the whole show'),
    verdict('Display sleep', 'displaysleep', 'PreventUserIdleDisplaySleep', 'The projector would go dark: run "caffeinate -dis"'),
  ];
}

/** Power, from `pmset -g batt`. */
export function powerCheck(batt: string): Check {
  if (/AC Power/.test(batt)) return check('Laptop', 'Power', 'pass', 'plugged in');
  const percent = /(\d+)%/.exec(batt)?.[1];
  return check('Laptop', 'Power', 'warn', `on battery${percent ? ` (${percent}%)` : ''}: plug the laptop in`);
}

/** Free disk space where the show writes (the journal, the Blend renders). */
export function diskCheck(freeBytes: number): Check {
  const gb = freeBytes / 1e9;
  if (gb < 1) return check('Laptop', 'Disk', 'fail', `${gb.toFixed(1)} GB free: make room before the show`);
  if (gb < 5) return check('Laptop', 'Disk', 'warn', `${gb.toFixed(1)} GB free`);
  return check('Laptop', 'Disk', 'pass', `${gb.toFixed(0)} GB free`);
}

/** The show page's browser, from the process list: it must play sound without a click. */
export function browserCheck(processes: readonly string[]): Check {
  const chrome = processes.filter((p) => /Google Chrome\.app\/Contents\/MacOS\/Google Chrome(\s|$)/.test(p));
  if (chrome.length === 0) return check('Laptop', 'Browser', 'warn', 'Chrome is not running: open the show page with the kiosk command (night runbook)');
  if (chrome.some((p) => p.includes('--autoplay-policy=no-user-gesture-required'))) {
    return check('Laptop', 'Browser', 'pass', `Chrome with autoplay allowed${chrome.some((p) => p.includes('--kiosk')) ? ', in kiosk mode' : ''}`);
  }
  return check('Laptop', 'Browser', 'warn', 'Chrome runs without --autoplay-policy=no-user-gesture-required: the show page needs a click before it plays');
}

// ---- the network and the cloud ----------------------------------------------------------------------------
export function relayCheck(pool: string, answer: { ok: boolean; name?: string; error?: string }): Check {
  if (!answer.ok) return check('Network', 'Relay', 'fail', `not running (${answer.error ?? 'no answer'}): start it with "npm start" in experiments/mixer-poc`);
  if (answer.name !== pool) return check('Network', 'Relay', 'fail', `it serves pool "${answer.name}", not "${pool}": restart it with --pool ${pool}`);
  return check('Network', 'Relay', 'pass', `up, pool ${pool}`);
}

export function showPageCheck(clients: readonly { role: string }[] | null): Check {
  if (!clients) return check('Network', 'Show page', 'warn', "couldn't ask the relay who is connected");
  if (!clients.some((c) => c.role === 'show')) return check('Network', 'Show page', 'warn', 'the show page is not open (or not connected to the relay)');
  const others = clients.filter((c) => c.role !== 'show').map((c) => c.role);
  return check('Network', 'Show page', 'pass', `connected${others.length ? `; also on the relay: ${others.join(', ')}` : ''}`);
}

export function lanCheck(url: string | null, reachable: boolean): Check {
  if (!url) return check('Network', 'Console on the LAN', 'warn', 'no network: join the phone hotspot (USB tethering alone gives the tablet no way in)');
  if (!reachable) return check('Network', 'Console on the LAN', 'fail', `${url} doesn't answer: check the relay and the firewall`);
  return check('Network', 'Console on the LAN', 'pass', `${url} (if the tablet can't open it, the hotspot isolates its clients: see the runbook)`);
}

export function cloudCheck(cloud: string, answer: { ok: boolean; status?: number; edition?: string; error?: string }, planEdition: string | null): Check {
  if (!answer.ok) return check('Cloud', 'Cloud', 'fail', `${cloud} unreachable (${answer.error ?? answer.status}). The show can still run offline (Plan B), but phones get nothing`);
  if (planEdition && answer.edition !== planEdition) return check('Cloud', 'Cloud', 'fail', `the cloud serves edition ${answer.edition}, the Game plan is for ${planEdition}`);
  return check('Cloud', 'Cloud', 'pass', `${cloud}, edition ${answer.edition}`);
}

/** The service token and the clocks, from an authenticated ping: round trip, and the laptop's clock against the cloud's. */
export function cloudAuthCheck(answer: { ok: boolean; status?: number; rttMs?: number; offsetMs?: number; error?: string }): Check {
  if (!answer.ok) {
    if (answer.status === 403) return check('Cloud', 'Laptop sign-in', 'fail', 'refused (403): check CF_ACCESS_CLIENT_ID and CF_ACCESS_CLIENT_SECRET in cloud/.env.link');
    return check('Cloud', 'Laptop sign-in', 'fail', `no answer (${answer.error ?? answer.status})`);
  }
  const rtt = Math.round(answer.rttMs ?? 0);
  const offset = Math.round(answer.offsetMs ?? 0);
  const detail = `round trip ${rtt} ms, laptop clock ${offset >= 0 ? 'behind' : 'ahead'} by ${Math.abs(offset)} ms`;
  if (Math.abs(offset) > 2000) return check('Cloud', 'Laptop sign-in', 'warn', `${detail}: set the clock automatically (System Settings → General → Date & Time)`);
  if (rtt > 1500) return check('Cloud', 'Laptop sign-in', 'warn', `${detail}: a slow connection`);
  return check('Cloud', 'Laptop sign-in', 'pass', detail);
}

export interface LinkStatusFile {
  updatedAtMs: number;
  cloud: string;
  gameId: string | null;
  journalled: number;
  ackSeq: number;
  pending: number;
  uploader: { kind: string; reason?: string };
}

/** The laptop's cloud link, from the status file it writes every few seconds. */
export function linkCheck(status: LinkStatusFile | null, nowMs: number): Check {
  if (!status) return check('Cloud', 'Cloud link', 'fail', 'not running: start it with "npm run link" in experiments/mixer-poc/cloud');
  const age = Math.round((nowMs - status.updatedAtMs) / 1000);
  if (age > 60) return check('Cloud', 'Cloud link', 'fail', `silent for ${age} s: is "npm run link" still running?`);
  if (status.uploader.kind === 'stopped') return check('Cloud', 'Cloud link', 'fail', `uploads stopped: ${status.uploader.reason ?? '?'}`);
  if (status.cloud !== 'online') return check('Cloud', 'Cloud link', 'fail', `cloud ${status.cloud}${status.cloud === 'replaced' ? ': another laptop took over' : ''}`);
  if (status.pending > 0) return check('Cloud', 'Cloud link', 'warn', `online, ${status.pending} journal entries still to upload`);
  return check('Cloud', 'Cloud link', 'pass', 'online, journal in sync');
}

/** Which Game the laptop and the cloud are on, and the edition. */
export function gameCheck(link: LinkStatusFile | null, cloudCurrent: { gameId: string; seq: number } | null, edition: string | null): Check {
  const here = link?.gameId ? `Game ${link.gameId}, ${link.journalled} entries here` : 'no Game on this laptop yet';
  const there = cloudCurrent ? `the cloud's current Game ${cloudCurrent.gameId} (${cloudCurrent.seq} entries)` : 'none in the cloud';
  const detail = `edition ${edition ?? '?'}; ${here}; ${there}`;
  if (!edition) return check('Cloud', 'Game', 'warn', `${detail}: no edition known (no cloud and no Game plan)`);
  if (link?.gameId && cloudCurrent && link.gameId !== cloudCurrent.gameId) return check('Cloud', 'Game', 'warn', `${detail}. Different Games: a rehearsal? The night starts with a fresh show page (?fresh=1)`);
  return check('Cloud', 'Game', 'pass', detail);
}

export function planCheck(plan: unknown): Check {
  if (!plan || typeof plan !== 'object') return check('Cloud', 'Game plan', 'warn', 'no Game plan on this laptop (prizes, sponsors): save one in Admin with the link running');
  const p = plan as { title?: string; rounds?: unknown[]; edition?: string };
  return check('Cloud', 'Game plan', 'pass', `"${p.title ?? '?'}", ${p.rounds?.length ?? 0} rounds, edition ${p.edition ?? '?'}`);
}

/** Exit status: 1 when anything failed. */
export const exitCode = (checks: readonly Check[]): number => (checks.some((c) => c.status === 'fail') ? 1 : 0);
