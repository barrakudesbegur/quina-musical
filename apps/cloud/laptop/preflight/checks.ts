// The preflight's checks: pure functions from facts (gathered by gather.ts) to a verdict, so each rule is tested
// on its own. FAIL is anything that would hurt the show; WARN is worth a look. Details are plain language for
// whoever sets the laptop up.
import {
  DEFAULT_CARD_TYPE, DEFAULT_POOL, DEFAULT_SIDE, VOICE_CUES, cardTypeSides, checkGamePlan, defaultCardType, isCardTypeId, roundCardPrice, sideWarnings,
  type CardTypePrice, type CardTypeSides, type RemoteStatus,
} from '@quina/protocol';

export type Status = 'pass' | 'warn' | 'fail';

export interface Check {
  group: 'Repertoire' | 'Laptop' | 'Network' | 'Cloud';
  name: string;
  status: Status;
  detail: string;
}

const check = (group: Check['group'], name: string, status: Status, detail: string): Check => ({ group, name, status, detail });

// ---- the repertoire -------------------------------------------------------------------------------------
/** A printed card as cards.json has it (D178): its sides, or, from before sides, its side 1's `lines`. */
export interface CardLike {
  id: number;
  type: string;
  sides?: { side: number; lines: { id: number }[][] }[];
  lines?: { id: number }[][];
}

/** card-types.json's types, as far as the cards go: their ids and printed sides. Null when it's missing or malformed. */
export function printedCardTypes(json: unknown): CardTypeSides[] | null {
  if (!Array.isArray(json) || json.length === 0) return null;
  const types = json.map((t: unknown) => (t && typeof t === 'object' ? (t as { type?: unknown; sides?: unknown }) : {}));
  if (!types.every((t) => isCardTypeId(t.type))) return null;
  return types.map((t) => ({ type: t.type as string, ...(Array.isArray(t.sides) ? { sides: t.sides as CardTypeSides['sides'] } : {}) }));
}

/** How many printed cards there are of each type. */
export function printedByType(cards: unknown): Map<string, number> | null {
  if (!Array.isArray(cards)) return null;
  const counts = new Map<string, number>();
  for (const card of cards as Partial<CardLike>[]) if (typeof card?.type === 'string') counts.set(card.type, (counts.get(card.type) ?? 0) + 1);
  return counts;
}

/** Each of the repertoire's songs and its pool (songs.json's per-song `pool`, D178; none: DEFAULT_POOL). */
export function songPools(songs: unknown): Map<number, string> {
  const pools = new Map<number, string>();
  if (!Array.isArray(songs)) return pools;
  for (const song of songs as { id?: unknown; pool?: unknown }[]) {
    if (Number.isInteger(song?.id)) pools.set(song.id as number, typeof song.pool === 'string' ? song.pool : DEFAULT_POOL);
  }
  return pools;
}

/** How many of the repertoire's songs each pool has. */
export function poolSongCounts(songs: unknown): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const pool of songPools(songs).values()) counts[pool] = (counts[pool] ?? 0) + 1;
  return counts;
}

/**
 * The printed cards against the repertoire (D178): every card has each side its type prints (card-types.json's
 * `sides`) and no other, each side 3 lines of 4, ids unique; every song on a side is in the repertoire, in that side's
 * pool (a round of that side shuffles only that pool) and PLAYABLE (analysed, with a valid hook), or that card could
 * never be completed. Every card's type must be one of card-types.json's (`types`), or no round could ever play it.
 * Without that file, the default types stand in, sides and pools go unchecked, and it warns, since screens can't name
 * the types. A side whose pool has no songs here was drawn from the whole repertoire (apps/cards does that for test
 * cards): it warns.
 */
export function cardsCheck(cards: unknown, types: readonly CardTypeSides[] | null, pools: ReadonlyMap<number, string>, playableIds: ReadonlySet<number>): Check {
  if (!Array.isArray(cards) || cards.length === 0) return check('Repertoire', 'Cards', 'fail', 'no cards.json, or it is empty: the cards are not generated yet');
  const known = types ?? [...new Set(Object.values(DEFAULT_CARD_TYPE))].map((type) => ({ type }));
  const poolsHere = new Set(pools.values());
  const problems: string[] = [];
  const seen = new Set<number>();
  const unplayable = new Set<number>();
  const unpooled = new Set<string>();
  for (const raw of cards as CardLike[]) {
    if (!raw || !Number.isInteger(raw.id)) {
      problems.push('a card without an id');
      continue;
    }
    if (seen.has(raw.id)) problems.push(`card ${raw.id} twice`);
    seen.add(raw.id);
    const type = known.find((t) => t.type === raw.type);
    if (!type) problems.push(`card ${raw.id} has type ${JSON.stringify(raw.type)}, not in card-types.json (${known.map((t) => t.type).join(', ')})`);
    const printed = raw.sides?.length ? raw.sides : raw.lines ? [{ side: DEFAULT_SIDE, lines: raw.lines }] : null;
    if (!printed) {
      problems.push(`card ${raw.id} has no sides`);
      continue;
    }
    // Sides and pools only against a card-types.json: without one there's nothing to say what a type prints.
    const expected = types && type ? cardTypeSides(type) : null;
    for (const want of expected ?? []) if (!printed.some((s) => s.side === want.side)) problems.push(`card ${raw.id} has no side ${want.side}`);
    for (const face of printed) {
      const want = expected?.find((e) => e.side === face.side);
      if (expected && !want) {
        problems.push(`card ${raw.id} has a side ${face.side}, which its type doesn't print`);
        continue;
      }
      if (!Array.isArray(face.lines) || face.lines.length !== 3 || face.lines.some((l) => !Array.isArray(l) || l.length !== 4)) {
        problems.push(`card ${raw.id} side ${face.side} is not 3 lines of 4`);
        continue;
      }
      for (const song of face.lines.flat()) {
        const pool = pools.get(song?.id);
        if (pool === undefined) problems.push(`card ${raw.id} has song ${String(song?.id)}, not in the repertoire`);
        else {
          if (want && pool !== want.pool) {
            if (poolsHere.has(want.pool)) problems.push(`card ${raw.id} side ${face.side} has song ${song.id} from pool ${pool}, not pool ${want.pool}`);
            else unpooled.add(want.pool);
          }
          if (!playableIds.has(song.id)) unplayable.add(song.id);
        }
      }
    }
  }
  if (unplayable.size > 0) problems.push(`songs on cards that can't play (no analysis or hook): ${[...unplayable].sort((a, b) => a - b).join(', ')}`);
  if (problems.length > 0) return check('Repertoire', 'Cards', 'fail', `${problems.slice(0, 4).join('; ')}${problems.length > 4 ? ` (+${problems.length - 4} more)` : ''}`);
  const byType = [...(printedByType(cards) ?? [])].map(([t, n]) => `${n} ${t}`).join(', ');
  const detail = `${cards.length} cards (${byType}), every song on them playable`;
  if (!types) return check('Repertoire', 'Cards', 'warn', `${detail}; no card-types.json beside cards.json (apps/cards writes it): screens and phones can't name the card types`);
  if (unpooled.size > 0) {
    const list = [...unpooled].sort().map((p) => `pool ${p}`).join(', ');
    return check('Repertoire', 'Cards', 'warn', `${detail}; ${list} has no songs here, so those sides were drawn from the whole repertoire (test cards): a round of that side can't be played`);
  }
  return check('Repertoire', 'Cards', 'pass', `${detail}, each side from its pool`);
}

/** The songs: how many the repertoire has, and how many are ready to play. */
export function songsCheck(songIds: ReadonlySet<number>, playableIds: ReadonlySet<number>, missingAudio: readonly number[]): Check {
  if (playableIds.size === 0) return check('Repertoire', 'Songs', 'fail', 'no playable song: pull the prepared media (npm run media -- pull, or npm run setup:laptop), or prepare the repertoire (npm run prep in apps/show)');
  if (missingAudio.length > 0) return check('Repertoire', 'Songs', 'fail', `playable songs without their decoded audio: ${missingAudio.slice(0, 10).join(', ')}${missingAudio.length > 10 ? '…' : ''}`);
  const notReady = [...songIds].filter((id) => !playableIds.has(id));
  if (notReady.length > 0) return check('Repertoire', 'Songs', 'warn', `${playableIds.size} of ${songIds.size} playable; not ready: ${notReady.slice(0, 10).join(', ')}${notReady.length > 10 ? '…' : ''}`);
  return check('Repertoire', 'Songs', 'pass', `all ${playableIds.size} songs analysed, with their audio`);
}

/** Every fanfare and effect the console can play, and the Hold music, on disk. */
export function soundsCheck(missingSounds: readonly string[], holdCount: number, missingHold: readonly string[]): Check[] {
  return [
    missingSounds.length > 0
      ? check('Repertoire', 'Fanfares and effects', 'fail', `missing: ${missingSounds.join(', ')}`)
      : check('Repertoire', 'Fanfares and effects', 'pass', 'every sound the console can play is there'),
    holdCount === 0 || missingHold.length > 0
      ? check('Repertoire', 'Hold music', 'fail', holdCount === 0 ? 'no Hold music prepared (tools/prep/hold.py)' : `missing decoded files: ${missingHold.join(', ')}`)
      : check('Repertoire', 'Hold music', 'pass', `${holdCount} tracks`),
  ];
}

/** The files against the reference manifest (the cloud's, or the last push/pull here): present and same SHA-256. */
export function mediaCheck(reference: { files: Record<string, { size: number; sha256: string }>; source: string } | null, local: ReadonlyMap<string, { size: number; sha256: string }>, rehashed: boolean): Check {
  if (!reference) return check('Repertoire', 'Media files', 'warn', `${local.size} files here, no reference to compare with: run "npm run media -- push" once`);
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
    return check('Repertoire', 'Media files', 'fail', `${list.slice(0, 3).join('; ')}${list.length > 3 ? ` (+${list.length - 3} more)` : ''}; against ${reference.source}`);
  }
  return check('Repertoire', 'Media files', 'pass', `${Object.keys(reference.files).length} files match ${reference.source} (${how})`);
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
  // The engine plays the whole show 6 dB lower inside (D157), so the sound check sets the PA higher than last year's.
  return check('Laptop', 'Audio output', 'pass', `${name} (${transport || 'unknown'}). At the sound check, turn the PA up about 6 dB: the show plays 6 dB lower inside than last year`);
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

/** The laptop clock's offset that's worth a look, and the one that would play the doors cues at the wrong time (D203). */
const CLOCK_WARN_MS = 2000;
const CLOCK_FAIL_MS = 60_000;
const CLOCK_FIX = 'the doors cues follow the plan\'s start time by this clock: set it automatically (System Settings → General → Date & Time)';

/**
 * The laptop clock against Apple's time server (`sntp -t 3 time.apple.com`), with or without the cloud: the voice's
 * doors cues count down to the plan's start by this clock (D203). FAIL past a minute; WARN past 2 s, or when there's
 * no internet to check it (compare it with a phone). Reading macOS's "set automatically" switch needs admin rights.
 */
export function clockCheck(sntpOutput: string | null): Check {
  const match = sntpOutput ? /^\s*([+-]?\d+(?:\.\d+)?)\s+\+\/-/m.exec(sntpOutput) : null;
  if (!match) return check('Laptop', 'Clock', 'warn', 'could not ask time.apple.com (no internet?): compare the laptop clock with a phone, to the second');
  const offsetMs = Math.round(Number(match[1]) * 1000);
  // sntp's offset is what the clock must move: positive, the laptop is behind.
  const detail = `${offsetMs >= 0 ? 'behind' : 'ahead'} time.apple.com by ${Math.abs(offsetMs)} ms`;
  if (Math.abs(offsetMs) > CLOCK_FAIL_MS) return check('Laptop', 'Clock', 'fail', `${detail}: ${CLOCK_FIX}`);
  if (Math.abs(offsetMs) > CLOCK_WARN_MS) return check('Laptop', 'Clock', 'warn', `${detail}: ${CLOCK_FIX}`);
  return check('Laptop', 'Clock', 'pass', detail);
}

/** A command's outcome, for the checks that tell a missing setting from a failed read. */
export interface CommandResult {
  ok: boolean;
  stdout: string;
  stderr: string;
}

/**
 * macOS «Reduce motion», from `defaults read com.apple.universalaccess reduceMotion`: on, the projector's drum spins
 * in its calm mode (`prefers-reduced-motion: reduce`), which the phones' drum (D237) doesn't model. WARN when it
 * prints 1; a missing key (or domain) is the default, off.
 */
export function reduceMotionCheck(read: CommandResult): Check {
  const value = read.ok ? read.stdout.trim() : null;
  if (value === '1') return check('Laptop', 'Reduce motion', 'warn', "on: the projector's drum would spin in its calm mode and stop matching the phones'. Turn off Reduce motion: System Settings → Accessibility → Display");
  if (value === '0') return check('Laptop', 'Reduce motion', 'pass', 'off');
  if (!read.ok && /does not exist|Could not find key|not found/.test(read.stderr)) return check('Laptop', 'Reduce motion', 'pass', 'off (never set)');
  return check('Laptop', 'Reduce motion', 'warn', "couldn't read it (defaults): check System Settings → Accessibility → Display → Reduce motion is off");
}

/** Free disk space where the show writes (the journal, the Blend renders). */
export function diskCheck(freeBytes: number): Check {
  const gb = freeBytes / 1e9;
  if (gb < 1) return check('Laptop', 'Disk', 'fail', `${gb.toFixed(1)} GB free: make room before the show`);
  if (gb < 5) return check('Laptop', 'Disk', 'warn', `${gb.toFixed(1)} GB free`);
  return check('Laptop', 'Disk', 'pass', `${gb.toFixed(0)} GB free`);
}

/**
 * Hooks bulk-approved as provisional (hooks_auto.py --provisional, D227): a song whose best valid hook carries
 * `provisional: true` lands on a hook nobody has chosen yet. It only warns: the show plays them; the user decides each on
 * the audition page, and the flag goes. Null with no playable songs (songsCheck says so).
 */
export function provisionalHooksCheck(songs: readonly { id: number; hooks: readonly unknown[] }[]): Check | null {
  if (songs.length === 0) return null;
  const isBestProvisional = (h: unknown) => Boolean(h) && typeof h === 'object' && (h as { tag?: unknown }).tag === 'best' && Boolean((h as { valid?: unknown }).valid) && (h as { provisional?: unknown }).provisional === true;
  const ids = songs.filter((s) => s.hooks.some(isBestProvisional)).map((s) => s.id);
  if (ids.length === 0) return check('Repertoire', 'Hooks', 'pass', "every song's best hook was chosen on the audition page");
  const shown = ids.slice(0, 12).join(', ') + (ids.length > 12 ? '…' : '');
  return check('Repertoire', 'Hooks', 'warn', `${ids.length} of ${songs.length} songs land on a provisional hook, not chosen yet: decide them on the audition page (songs ${shown})`);
}

/**
 * The voice cues (D198, D202–D204): every cue and lead (chime, fanfare) in data/out/voice/index.json with its file in
 * data/cache/voice/ (FAIL: the cue would play silence), and WARN while any is a placeholder, not the user's recording.
 * `index`: the index's JSON (null: none); `hasFile(name)`: whether its prepared file exists.
 */
export function voicesCheck(index: unknown, hasFile: (name: string) => boolean): Check {
  const names = [...VOICE_CUES, 'chime', 'fanfare'];
  const voices = index && typeof index === 'object' && Array.isArray((index as { voices?: unknown }).voices) ? ((index as { voices: unknown[] }).voices as { name?: unknown; placeholder?: unknown }[]) : null;
  if (!voices) return check('Repertoire', 'Voices', 'fail', 'no data/out/voice/index.json: prepare them with tools/prep/voices.py (or pull the media)');
  const listed = new Map(voices.filter((v) => typeof v?.name === 'string').map((v) => [v.name as string, v.placeholder === true]));
  const missing = names.filter((n) => !listed.has(n) || !hasFile(n));
  if (missing.length) return check('Repertoire', 'Voices', 'fail', `${missing.length} voice cue(s) missing or without their file: ${missing.join(', ')}`);
  const placeholders = names.filter((n) => listed.get(n));
  if (placeholders.length) return check('Repertoire', 'Voices', 'warn', `${placeholders.length} of ${names.length} voice cues are still placeholders, not the user's recordings`);
  return check('Repertoire', 'Voices', 'pass', `all ${names.length} voice cues recorded`);
}

/** How to rebuild the show the relay serves (`npm start` serves apps/show/dist). */
export const DIST_FIX = 'cd apps/show && npm run build, then restart the relay';

/**
 * The show's build, apps/show/dist, what the relay serves with `npm start`: built from exactly the sources checked out
 * (Sound engine's build stamp, dist/build.json, f89d972). On 27 Nov a production test ran a build two days old, with no
 * Pausa, no paced Check and no voices. `problem`: distProblem's reason, or null when the stamp matches.
 */
export function distCheck(problem: string | null): Check {
  if (problem) return check('Laptop', 'Show build', 'fail', `apps/show/${problem}: ${DIST_FIX}`);
  return check('Laptop', 'Show build', 'pass', 'apps/show/dist was built from the sources checked out');
}

/** The show page's browser, from the process list: it must play sound without a click. */
/**
 * Chrome must keep the show page's timers running even when its window isn't in front: a throttled page starves
 * the engine's lookahead (a hidden tab's timers fire once a minute after five minutes).
 */
export const SHOW_CHROME_FLAGS = ['--disable-background-timer-throttling', '--disable-renderer-backgrounding', '--disable-backgrounding-occluded-windows'] as const;

export function browserCheck(processes: readonly string[]): Check {
  const chrome = processes.filter((p) => /Google Chrome\.app\/Contents\/MacOS\/Google Chrome(\s|$)/.test(p));
  if (chrome.length === 0) return check('Laptop', 'Browser', 'warn', 'Chrome is not running: open the show page with the kiosk command (night runbook)');
  // The show's own Chrome: the kiosk command's profile or the show page's address.
  const show = chrome.find((p) => p.includes('--user-data-dir=/tmp/quina-show') || /\/show\/(\?|show\.html|\s|"|$)/.test(p) || p.includes('--kiosk'));
  if (!show) return check('Laptop', 'Browser', 'warn', "Chrome runs, but not the show's: open the show page with the kiosk command (night runbook)");
  const missing = SHOW_CHROME_FLAGS.filter((f) => !show.includes(f));
  if (missing.length) return check('Laptop', 'Browser', 'fail', `the show's Chrome runs without ${missing.join(' ')}: a covered or minimised window would stall the show. Quit it and start it with the kiosk command (night runbook)`);
  if (!show.includes('--autoplay-policy=no-user-gesture-required')) {
    return check('Laptop', 'Browser', 'warn', "the show's Chrome runs without --autoplay-policy=no-user-gesture-required: the show page needs a click before it plays");
  }
  return check('Laptop', 'Browser', 'pass', `the show's Chrome: no background throttling, autoplay allowed${show.includes('--kiosk') ? ', in kiosk mode' : ''}`);
}

// ---- the network and the cloud ----------------------------------------------------------------------------
/** What the preflight reads from the cloud's /api/stats (src/domain/usage.ts UsageReport, and the link). */
export interface CloudStats {
  phonesConnected: number;
  today: {
    billedRequests: number;
    rowsRead: number;
    rowsWritten: number;
    phonesPeak: number;
    limits: { requests: number; rowsRead: number; rowsWritten: number };
    shares: { requests: number; rowsRead: number; rowsWritten: number };
    level: 'ok' | 'warn' | 'fail';
    resetAtMs: number;
  };
  link: { online: boolean; lastSeenAgoMs: number | null; journalDelayMs: number | null };
}

/** The cloud's daily usage against the free plan: WARN from 60 % of a limit, FAIL from 85 %, with when it resets. */
export function usageCheck(stats: CloudStats | null, nowMs: number): Check {
  if (!stats?.today) return check('Cloud', 'Daily usage', 'warn', "couldn't read the cloud's usage (/api/stats)");
  const t = stats.today;
  const pct = (share: number) => `${Math.round(share * 100)} %`;
  const reset = new Date(t.resetAtMs).toLocaleTimeString('ca-ES', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Madrid' });
  const inMin = Math.max(0, Math.round((t.resetAtMs - nowMs) / 60_000));
  const detail =
    `requests ${pct(t.shares.requests)} (${t.billedRequests.toLocaleString('en')} of ${t.limits.requests.toLocaleString('en')}), ` +
    `rows written ${pct(t.shares.rowsWritten)}, rows read ${pct(t.shares.rowsRead)}; ` +
    `${stats.phonesConnected} phones now, ${t.phonesPeak} at most today; resets at ${reset} (in ${Math.floor(inMin / 60)} h ${inMin % 60} min)` +
    (stats.link.journalDelayMs !== null ? `; the journal reached the cloud ${(stats.link.journalDelayMs / 1000).toFixed(1)} s late` : '');
  if (t.level === 'fail') return check('Cloud', 'Daily usage', 'fail', `${detail}. Near the free plan's daily limit: phones may stop updating. Upgrade to Workers Paid now (deploy plan step 5), or wait for the reset`);
  if (t.level === 'warn') return check('Cloud', 'Daily usage', 'warn', `${detail}. Watch it: past 85 % upgrade to Workers Paid (deploy plan step 5)`);
  return check('Cloud', 'Daily usage', 'pass', detail);
}

export function relayCheck(repertoire: string, answer: { ok: boolean; name?: string; error?: string }): Check {
  if (!answer.ok) return check('Network', 'Relay', 'fail', `not running (${answer.error ?? 'no answer'}): start it with "npm start" in apps/show`);
  if (answer.name !== repertoire) return check('Network', 'Relay', 'fail', `it serves repertoire "${answer.name}", not "${repertoire}": restart it with --repertoire ${repertoire}`);
  return check('Network', 'Relay', 'pass', `up, repertoire ${repertoire}`);
}

export function showPageCheck(clients: readonly { role: string }[] | null): Check {
  if (!clients) return check('Network', 'Show page', 'warn', "couldn't ask the relay who is connected");
  if (!clients.some((c) => c.role === 'show')) return check('Network', 'Show page', 'warn', 'the show page is not open (or not connected to the relay)');
  const others = clients.filter((c) => c.role !== 'show').map((c) => c.role);
  return check('Network', 'Show page', 'pass', `connected${others.length ? `; also on the relay: ${others.join(', ')}` : ''}`);
}

/**
 * The tablet's way in: the console's LAN address. With `laptopOnly` (the presenters don't use the tablet, and the
 * tech drives from the laptop's own screen) it isn't needed, so a missing one only warns.
 */
export function lanCheck(url: string | null, reachable: boolean, laptopOnly = false): Check {
  if (!url) return check('Network', 'Console on the LAN', 'warn', 'no network: join the phone hotspot (USB tethering alone gives the tablet no way in)');
  if (!reachable && laptopOnly) return check('Network', 'Console on the LAN', 'warn', `${url} doesn't answer: fine without the tablet, but start the relay with "npm start -- --lan" if the tech's phone should reach the console`);
  if (!reachable) return check('Network', 'Console on the LAN', 'fail', `${url} doesn't answer: start the relay with "npm start -- --lan" (it listens only on this laptop otherwise), and check the firewall`);
  return check('Network', 'Console on the LAN', 'pass', `${url} (if the tablet can't open it, the hotspot isolates its clients: see the runbook)`);
}

/**
 * A console on the relay (tablet or admin role). Without the tablet (`laptopOnly`) the tech drives from the
 * console on the laptop's own screen, so it must be open; with the tablet, it may not be connected yet.
 */
export function consoleCheck(clients: readonly { role: string }[] | null, laptopOnly: boolean): Check {
  if (!clients) return check('Network', 'Console', 'warn', "couldn't ask the relay who is connected");
  const consoles = clients.filter((c) => c.role === 'tablet' || c.role === 'admin').length;
  if (consoles > 0) return check('Network', 'Console', 'pass', `${consoles} connected`);
  if (laptopOnly) return check('Network', 'Console', 'fail', 'no console: open it on the laptop\'s own screen (runbook: "Without the tablet")');
  return check('Network', 'Console', 'warn', 'no console connected yet: open it on the tablet (runbook step 6)');
}

interface DisplayLike {
  _name?: string;
  spdisplays_connection_type?: string;
  spdisplays_main?: string;
  spdisplays_mirror?: string;
  spdisplays_online?: string;
}

/**
 * The projector, from `system_profiler SPDisplaysDataType -json`: connected, and a separate display. Mirrored, the
 * laptop's screen goes up on the projector: with the console there (`laptopOnly`), the next song and the possible
 * winners would be on screen for everyone, so that fails; otherwise it only warns (the terminals, the pairing token).
 */
export function displaysCheck(profile: unknown, laptopOnly: boolean): Check {
  const gpus = (profile as { SPDisplaysDataType?: { spdisplays_ndrvs?: DisplayLike[] }[] } | null)?.SPDisplaysDataType;
  if (!Array.isArray(gpus)) return check('Laptop', 'Projector', 'warn', "couldn't read the displays (system_profiler)");
  const displays = gpus.flatMap((g) => g.spdisplays_ndrvs ?? []).filter((d) => d.spdisplays_online !== 'spdisplays_no');
  const external = displays.filter((d) => d.spdisplays_connection_type !== 'spdisplays_internal');
  if (external.length === 0) return check('Laptop', 'Projector', 'warn', 'no projector connected: plug it in by HDMI, as a separate display (not mirrored)');
  const names = external.map((d) => d._name ?? 'display').join(', ');
  if (displays.some((d) => d.spdisplays_mirror === 'spdisplays_on')) {
    if (laptopOnly) return check('Laptop', 'Projector', 'fail', `${names} mirrors the laptop's screen: the console (the next song, possible winners) would be on the projector. System Settings → Displays → use it as a separate display`);
    return check('Laptop', 'Projector', 'warn', `${names} mirrors the laptop's screen (terminals, the tablet's pairing token): use it as a separate display`);
  }
  const main = displays.find((d) => d.spdisplays_main === 'spdisplays_yes');
  return check('Laptop', 'Projector', 'pass', `${names}, a separate display${main ? ` (main display: ${main._name ?? '?'})` : ''}`);
}

/** As the console warns (apps/console/config.ts WII): batteries below this, and this many drops in its window. */
const WII_BATTERY_LOW = 0.2;
const WII_DROPS_WARN = 2;

/**
 * The Wii remote, as the relay last heard from the console that hosts it (it pairs with this laptop's Chrome).
 * Optional: the console does everything it does, so nothing here fails. It has no signal strength, but the host
 * counts its drops over the last 10 minutes (`drops`, summed over hosts): from 2, it's at the edge of its range.
 * The runbook's walk test is still the range check.
 */
export function wiiRemoteCheck(status: RemoteStatus | null, nowMs: number): Check {
  if (!status) return check('Network', 'Wii remote', 'warn', 'no Wii remote connected (optional: the console does everything it does). It pairs with the console on this laptop (night runbook, step 7)');
  const minutes = Math.max(0, Math.round((nowMs - status.sinceMs) / 60_000));
  const battery = status.battery === null ? 'battery unknown' : `battery ${Math.round(status.battery * 100)}%`;
  const lastDrop = typeof status.lastDropMs === 'number' ? `, the latest ${Math.max(0, Math.round((nowMs - status.lastDropMs) / 60_000))} min ago` : '';
  const drops = status.drops === undefined ? '' : status.drops === 0 ? ', no drops in the last 10 min' : `, ${status.drops} drop${status.drops === 1 ? '' : 's'} in the last 10 min${lastDrop}`;
  if (!status.connected) return check('Network', 'Wii remote', 'warn', `disconnected ${minutes} min ago${drops}: check its batteries and its range from the stage (night runbook, step 7: the range test)`);
  if ((status.drops ?? 0) >= WII_DROPS_WARN) return check('Network', 'Wii remote', 'warn', `connected, but it dropped ${status.drops} times in the last 10 min${lastDrop}: it's at the edge of its range. Move the laptop nearer the stage (night runbook, step 7)`);
  if (status.battery !== null && status.battery < WII_BATTERY_LOW) return check('Network', 'Wii remote', 'warn', `connected, but ${battery}: change the batteries`);
  return check('Network', 'Wii remote', 'pass', `connected for ${minutes} min, ${battery}${drops}. Its range: the night runbook's range test (step 7)`);
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
  if (Math.abs(offset) > CLOCK_FAIL_MS) return check('Cloud', 'Laptop sign-in', 'fail', `${detail}: ${CLOCK_FIX}`);
  if (Math.abs(offset) > CLOCK_WARN_MS) return check('Cloud', 'Laptop sign-in', 'warn', `${detail}: ${CLOCK_FIX}`);
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
  if (!status) return check('Cloud', 'Cloud link', 'fail', 'not running: start it with "npm run link" in apps/cloud');
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

/**
 * The Game plan the link keeps: it must pass checkGamePlan (as the relay and the screens read it), and every
 * round's card type must have printed cards (`printed`, by type; null when there's no cards.json, which the
 * cards check already fails), or that round could never be won.
 */
export function planCheck(plan: unknown, printed: ReadonlyMap<string, number> | null): Check {
  if (!plan || typeof plan !== 'object') return check('Cloud', 'Game plan', 'warn', 'no Game plan on this laptop (prizes, sponsors): save one in Admin with the link running');
  const read = checkGamePlan(plan);
  if (!read.ok) return check('Cloud', 'Game plan', 'fail', `the plan doesn't pass the protocol's check (the screens would ignore it): ${read.errors.slice(0, 3).join('; ')}`);
  const { title, rounds, edition } = read.plan;
  const typeOf = (r: (typeof rounds)[number]) => r.cardType ?? defaultCardType(r.kind);
  const unprinted = rounds.filter((r) => printed && !printed.get(typeOf(r)));
  if (unprinted.length > 0) {
    return check('Cloud', 'Game plan', 'fail', unprinted.map((r) => `round ${r.number} plays "${typeOf(r)}" cards, but no printed card has that type`).join('; '));
  }
  const perType = new Map<string, number>();
  for (const r of rounds) perType.set(typeOf(r), (perType.get(typeOf(r)) ?? 0) + 1);
  const types = [...perType].map(([type, n]) => `${n} ${type}`).join(', ');
  return check('Cloud', 'Game plan', 'pass', `"${title}", ${rounds.length} rounds${types ? ` (${types})` : ''}, edition ${edition}`);
}

const euros = (cents: number) => `${(cents / 100).toFixed(2).replace('.', ',')} €`;
const PRICE_RULES = ['perRegularRound', 'fixed'];

/**
 * The card prices (U5), from card-types.json (`types`) for every card type a planned round plays: the projector
 * shows the coming round's price at the Interval (and round 1's before the start), worked out by the protocol's
 * roundCardPrice. A missing price only warns (no price shows); an unknown rule fails (the screens would misread it).
 * Null when there's no valid plan to check against (the plan check says why).
 */
export function cardPricesCheck(types: unknown, plan: unknown): Check | null {
  const read = plan ? checkGamePlan(plan) : null;
  if (!read?.ok) return null;
  const listed = Array.isArray(types) ? (types as ({ type?: unknown } & Partial<CardTypePrice>)[]) : [];
  const played = [...new Set(read.plan.rounds.map((r) => r.cardType ?? defaultCardType(r.kind)))];
  const unknownRule = played.filter((id) => {
    const rule = listed.find((t) => t.type === id)?.priceRule;
    return rule !== undefined && !PRICE_RULES.includes(rule);
  });
  if (unknownRule.length) return check('Cloud', 'Card prices', 'fail', `card-types.json: unknown priceRule for ${unknownRule.join(', ')} (perRegularRound or fixed)`);
  const priced: string[] = [];
  const missing: string[] = [];
  for (const id of played) {
    const type = listed.find((t) => t.type === id);
    if (!type || typeof type.priceCents !== 'number') {
      missing.push(id);
      continue;
    }
    const first = read.plan.rounds.find((r) => (r.cardType ?? defaultCardType(r.kind)) === id);
    const before = first ? roundCardPrice(read.plan, first.number, { priceCents: type.priceCents, priceRule: type.priceRule }) : null;
    priced.push(type.priceRule === 'fixed' ? `${id} ${euros(type.priceCents)}` : `${id} ${euros(type.priceCents)} a round${before !== null && first ? ` (${euros(before)} before round ${first.number})` : ''}`);
  }
  if (missing.length) return check('Cloud', 'Card prices', 'warn', `no price in card-types.json for ${missing.join(', ')}: the projector shows none before its rounds${priced.length ? `; ${priced.join('; ')}` : ''}`);
  return check('Cloud', 'Card prices', 'pass', priced.join('; '));
}

/**
 * The plan's card sides against card-types.json (D178), by the protocol's sideWarnings: a round on a side its card
 * type hasn't printed, or whose pool has no songs here, FAILs (that round can't be played); a printed side that no
 * round plays only WARNs. Null when there's no valid plan or no card-types.json (their own checks say why).
 */
export function sidesCheck(plan: unknown, types: unknown, poolSongs: Readonly<Record<string, number>>): Check | null {
  const read = plan ? checkGamePlan(plan) : null;
  if (!read?.ok || !Array.isArray(types) || types.length === 0) return null;
  const warnings = sideWarnings(read.plan, types as CardTypeSides[], poolSongs).map((w) => {
    const index = /^plan\.rounds\[(\d+)\]/.exec(w.path)?.[1];
    const round = index === undefined ? null : read.plan.rounds[Number(index)];
    return { blocking: round !== null, message: round ? `round ${round.number}: ${w.message}` : w.message };
  });
  const list = (ws: typeof warnings) => `${ws.slice(0, 3).map((w) => w.message).join('; ')}${ws.length > 3 ? ` (+${ws.length - 3} more)` : ''}`;
  const blocking = warnings.filter((w) => w.blocking);
  if (blocking.length) return check('Cloud', 'Card sides', 'fail', list(blocking));
  if (warnings.length) return check('Cloud', 'Card sides', 'warn', list(warnings));
  const pools = Object.entries(poolSongs).sort(([a], [b]) => a.localeCompare(b)).map(([pool, n]) => `pool ${pool}: ${n} songs`).join(', ');
  return check('Cloud', 'Card sides', 'pass', `every round's side is printed, and every printed side is played${pools ? ` (${pools})` : ''}`);
}

/** Exit status: 1 when anything failed. */
export const exitCode = (checks: readonly Check[]): number => (checks.some((c) => c.status === 'fail') ? 1 : 0);
