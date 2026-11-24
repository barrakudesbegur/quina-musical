// A whole show night through the real Show on a fake clock (harness.ts), the way a listener hears it: 12 rounds
// over the real analysis data and the real cards, auto-advance at the Pace, the Line claimed and confirmed, the
// Bingo climb, the Celebrations and the Intervals, plus the occasional long Hold, Back and false Claim.
//
// The planner gets what the runtime stores would hold (audio/plan-inputs.ts), built from the files on disk:
//  - B's stems around its valid best/main hooks (data/stems, the parts audible before the hook, like StemStore);
//  - A's stem lanes from 1 s before the hook it landed on to 48 s after it, inside its stored window;
//  - both songs' stem bar levels (data/stems `bars`) and hook keys (data/keys);
//  - B's pre-verbs for its valid best/main hooks, and from its voice where its stems hold vocals;
//  - B's Blend render for every tempo-matchable pair (±8%), its bass and voice allowed like BlendStore does
//    (±4% and compatible keys, or the global keys);
//  - the Signatures that play (data/signatures): each song's automatic pick, unless it is vetoed or off.
// So every recipe can appear except what needs a presenter (Suspense, an override) or a render the relay would
// refuse. Hold music and the Interval playlist are picked by the runtime (audio/holdmusic.ts, interval/plan.ts):
// the night logs what the Show asks for, and holdMusicPicks / intervalPicks model the runtime's choices.
import fs from 'node:fs';
import path from 'node:path';
import { setup, analyses, allCards } from './harness.ts';
import type { Harness } from './harness.ts';
import { planTransition } from '../../engine/src/plan/planner.ts';
import type { BlendSource, LaneCoverage, OutgoingSong, SignatureSource } from '../../engine/src/plan/planner.ts';
import { checkSignaturesMeta, checkStemsMeta, stemWindowFor } from '../../engine/src/analysis.ts';
import type { Analysis, Hook, StemsMeta } from '../../engine/src/analysis.ts';
import { tempoMatch } from '../../engine/src/plan/tempo.ts';
import { compatible } from '../../engine/src/plan/keys.ts';
import type { KeyInfo } from '../../engine/src/plan/keys.ts';
import { INTERVAL, LAYERING, STEMS } from '../../engine/src/config.ts';
import { seededRandom } from '../../engine/src/rng.ts';
import { gameSeed, trackAt } from '../../engine/src/interval/plan.ts';
import type { Effect, HoldMood, ShowPlan } from '../../engine/src/show/show.ts';
import type { LanePart, StemName } from '../../engine/src/plan/events.ts';
import type { StemBars } from '../../engine/src/plan/moves.ts';
import type { PhaseName } from '../../engine/src/config.ts';
import { OUT } from '../../relay/pool.ts';

const DATA = OUT;
const readJson = (file: string): unknown => JSON.parse(fs.readFileSync(file, 'utf8'));
const isRecord = (x: unknown): x is Record<string, unknown> => typeof x === 'object' && x !== null && !Array.isArray(x);
const PARTS: readonly StemName[] = ['drums', 'bass', 'vocals'];
const LANE_PARTS: readonly LanePart[] = ['drums', 'bass', 'vocals', 'other'];
const isLanePart = (name: string): name is LanePart => LANE_PARTS.some((p) => p === name);

// ------------------------------------------------------------------------------------------ runtime inputs
/** What the audio stores would hold for one song, read once from data/. */
interface SongInputs {
  meta: StemsMeta | null;
  /** Hook id → the stems decoded around it (StemStore.summary). */
  stems: Record<string, { parts: StemName[] }> | null;
  bars: StemBars | null;
  keys: Readonly<Record<string, KeyInfo>> | null;
  globalKey: KeyInfo | null;
  /** Hooks whose pre-verb is rendered (PreverbStore.hooksFor), and from the voice (vocalHooksFor). */
  preverbs: string[];
  vocalPreverbs: string[];
  signatures: SignatureSource[];
}

const renderedHooks = (analysis: Analysis): Hook[] => analysis.hooks.filter((h) => h.valid && (h.tag === 'best' || h.tag === 'main'));

/** StemStore's check: the stem plays in the bars before the hook. */
function audibleBefore(meta: StemsMeta, part: StemName, hook: Hook): boolean {
  const bars = meta.bars?.[part];
  if (!bars) return true;
  const before = bars.slice(Math.max(0, hook.downbeatIndex - STEMS.teaseBarsChecked), hook.downbeatIndex);
  return before.length > 0 && before.reduce((a, b) => a + b, 0) / before.length >= STEMS.teaseMinBarDb;
}

function keysOf(songId: number): { hooks: Record<string, KeyInfo> | null; global: KeyInfo | null } {
  const file = path.join(DATA, 'keys', `${songId}.json`);
  if (!fs.existsSync(file)) return { hooks: null, global: null };
  const json = readJson(file);
  if (!isRecord(json)) return { hooks: null, global: null };
  // data/keys/<id>.json (tools/prep/keys.py): KeyInfo per hook, and the song's.
  const hooks = isRecord(json.hooks) ? (json.hooks as Record<string, KeyInfo>) : null;
  const global = isRecord(json.global) ? (json.global as KeyInfo) : null;
  return { hooks, global };
}

/** The Signatures that play, as the runtime loads them: the automatic pick (or the audition page's), none when off. */
function approvedSignatures(songId: number): SignatureSource[] {
  const file = path.join(DATA, 'signatures', `${songId}.json`);
  if (!fs.existsSync(file)) return [];
  const meta = checkSignaturesMeta(readJson(file));
  if (!meta || meta.off) return [];
  return meta.signatures.filter((s) => s.approved === true)
    .map((s) => ({ id: s.id, kind: s.kind, durationSec: s.durationSec, anchorSec: s.anchorSec, beats: s.beats, bpm: s.bpm, gainDb: s.gainDb }));
}

function songInputs(songId: number, analysis: Analysis): SongInputs {
  const file = path.join(DATA, 'stems', `${songId}.json`);
  const meta = fs.existsSync(file) ? checkStemsMeta(readJson(file)) : null;
  let stems: Record<string, { parts: StemName[] }> | null = null;
  let bars: StemBars | null = null;
  if (meta) {
    const out: Record<string, { parts: StemName[] }> = {};
    for (const hook of renderedHooks(analysis)) {
      const window = stemWindowFor(meta, Math.max(0, hook.downbeatSec - STEMS.leadSec), hook.downbeatSec + STEMS.tailSec);
      if (!window) continue;
      const parts = PARTS.filter((p) => meta.stems.includes(p) && audibleBefore(meta, p, hook));
      if (parts.length) out[hook.id] = { parts };
    }
    stems = Object.keys(out).length ? out : null;
    if (meta.bars) {
      const levels: Partial<Record<LanePart, readonly number[]>> = {};
      for (const [name, values] of Object.entries(meta.bars)) if (isLanePart(name)) levels[name] = values;
      bars = levels;
    }
  }
  const { hooks: keys, global: globalKey } = keysOf(songId);
  const preverbs = renderedHooks(analysis).map((h) => h.id);
  const vocalPreverbs = preverbs.filter((id) => stems?.[id]?.parts.includes('vocals'));
  return { meta, stems, bars, keys, globalKey, preverbs, vocalPreverbs, signatures: approvedSignatures(songId) };
}

const inputs = new Map<number, SongInputs>();
function inputsOf(songId: number): SongInputs | null {
  const analysis = analyses.get(songId);
  if (!analysis) return null;
  let known = inputs.get(songId);
  if (!known) {
    known = songInputs(songId, analysis);
    inputs.set(songId, known);
  }
  return known;
}

/** StemStore.laneSummary for the hook A landed on: 1 s before it to 48 s after it, inside its stored window. */
function laneSummary(songId: number, landedDownbeatIndex: number | null | undefined): LaneCoverage | null {
  const analysis = analyses.get(songId);
  const meta = inputsOf(songId)?.meta;
  const hook = analysis?.hooks.find((h) => h.downbeatIndex === landedDownbeatIndex);
  if (!analysis || !meta || !hook) return null;
  const around = stemWindowFor(meta, hook.downbeatSec, hook.downbeatSec + 1);
  if (!around) return null;
  const fromSec = Math.max(around.startSec, hook.downbeatSec - STEMS.laneLeadSec);
  const toSec = Math.min(around.endSec, analysis.source.durationSec, hook.downbeatSec + STEMS.laneTailSec);
  const stems = PARTS.filter((p) => meta.stems.includes(p));
  if (!stems.length || toSec <= fromSec) return null;
  return { fromSec, toSec, parts: stems.length === PARTS.length ? [...stems, 'other'] : stems };
}

/** BlendStore: B's 8 bars before its hook rendered at A's tempo, for every pair within ±8%. */
function blendFor(aSongId: number, aHookId: string | null, hookId: string): BlendSource | null {
  const bSongId = Number(hookId.split('-')[0]);
  const A = analyses.get(aSongId);
  const B = analyses.get(bSongId);
  if (!A || !B || !Number.isInteger(bSongId)) return null;
  const match = tempoMatch(A.tempo.bpm, B.tempo.bpm);
  if (match.pairClass === 'none') return null;
  const a = inputsOf(aSongId);
  const b = inputsOf(bSongId);
  const aKey = (aHookId == null ? undefined : a?.keys?.[aHookId]) ?? a?.globalKey;
  const bKey = b?.keys?.[hookId] ?? b?.globalKey;
  const allowed = match.pairClass === 'tight' && compatible(aKey, bKey, { minConfidence: LAYERING.minKeyConfidence });
  const barSec = (60 / A.tempo.bpm) * (B.tempo.beatsPerBar || 4);
  const parts = b?.meta?.stems ?? [];
  return {
    aSongId, hookId, toBpm: A.tempo.bpm, firstDownbeatSec: 0.1, hookSec: 0.1 + LAYERING.renderBars * barSec, barSec,
    bass: parts.includes('bass') && allowed, vocals: parts.includes('vocals') && allowed,
  };
}

/**
 * plannerWithInputs (audio/plan-inputs.ts) over the files. `seen` keeps, by plan id, the outgoing song as the
 * planner saw it (its deck, landed hook and lanes), for the landing invariants.
 */
function plannerWithFiles(seen: Map<string, OutgoingSong | null>): typeof planTransition {
  return (request) => {
    const { A, B } = request;
    const a = A ? inputsOf(A.songId) : null;
    const b = inputsOf(B.songId);
    const outgoing = A && { ...A, lanes: A.lanes ?? laneSummary(A.songId, A.landedDownbeatIndex), stemBars: A.stemBars ?? a?.bars ?? null, keys: A.keys ?? a?.keys ?? null };
    const plan = planTransition({
      ...request,
      A: outgoing,
      B: { ...B, stemBars: B.stemBars ?? b?.bars ?? null, preverbs: B.preverbs ?? b?.preverbs ?? null, vocalPreverbs: B.vocalPreverbs ?? b?.vocalPreverbs ?? null, keys: B.keys ?? b?.keys ?? null },
    });
    if (request.id != null) seen.set(request.id, outgoing);
    return plan;
  };
}

// ------------------------------------------------------------------------------------------ the night
/** One landing as the room heard it. */
export interface NightTransition {
  round: number;
  /** Landings so far in this round (0 = the round's first). */
  index: number;
  phase: PhaseName;
  plan: ShowPlan;
  /** The outgoing song as the planner saw it; null when the build came from silence. */
  A: OutgoingSong | null;
}

/** What the Show asked of the runtime's music beds. */
export interface NightMusic {
  round: number;
  kind: 'holdMusic' | 'celebration' | 'interval';
  mood: HoldMood | 'celebration' | 'interval';
  /** Audio clock. */
  at: number;
}

export interface NightLog {
  seed: number;
  transitions: NightTransition[];
  music: NightMusic[];
  /** Seconds of Interval music per Interval (from its start to the next round's first Spin). */
  intervalSec: number[];
  /** Rounds that ended in a Bingo. */
  rounds: number;
}

export interface NightOptions {
  seed: number;
  rounds?: number;
  cardsInPlay?: string;
  /** The Show's clock step. The runtime ticks every 25 ms; a coarser step only delays auto-presses a little. */
  tickSec?: number;
}

/**
 * Runs a night: every round auto-advances at its Pace (22 s in the first, 14 s after), the presenters press
 * Next by hand in final, claim the first possible Line and Bingo a few seconds after it lands, confirm them, and
 * move on; now and then they hold for a minute (Hold music), press Back, or check a false Claim.
 */
export function runNight({ seed, rounds = 12, cardsInPlay = '1-200', tickSec = 0.05 }: NightOptions): NightLog {
  const random = seededRandom(seed ^ 0x5bd1e995);
  const between = (lo: number, hi: number) => lo + (hi - lo) * random();
  // The Blend's bass and voice check A's landed hook: the Show's current song, once the harness has made it.
  const landedHook = { of: (): string | null => null };
  const blend = (aSongId: number, hookId: string) => blendFor(aSongId, landedHook.of(), hookId);
  const outgoing = new Map<string, OutgoingSong | null>();
  const h = setup({
    seed, cards: allCards, cardsInPlay,
    env: { plan: plannerWithFiles(outgoing), stems: (id) => inputsOf(id)?.stems ?? null, signatures: (id) => inputsOf(id)?.signatures ?? [], blend },
  });
  const show = h.show;
  landedHook.of = () => show.current?.hookId ?? null;
  const clock = h.clock;
  const log: NightLog = { seed, transitions: [], music: [], intervalSec: [], rounds: 0 };
  let round = 1;
  let index = 0;
  let intervalFrom: number | null = null;

  const scan = (effects: readonly Effect[]) => {
    for (const e of effects) {
      if (e.type === 'landed') {
        log.transitions.push({ round, index: index++, phase: e.plan.phase, plan: e.plan, A: outgoing.get(e.planId) ?? null });
      } else if (e.type === 'holdMusic' || e.type === 'songToHoldMusic') {
        log.music.push({ round, kind: 'holdMusic', mood: e.mood, at: clock.t });
      } else if (e.type === 'celebrationMusic' && e.choice === 'victory') {
        log.music.push({ round, kind: 'celebration', mood: 'celebration', at: clock.t });
      } else if (e.type === 'intervalMusic') {
        log.music.push({ round, kind: 'interval', mood: 'interval', at: clock.t });
        intervalFrom ??= clock.t;
      } else if (e.type === 'startTransition' && intervalFrom != null) {
        log.intervalSec.push(clock.t - intervalFrom);
        intervalFrom = null;
      }
    }
  };
  const send: Harness['send'] = (cmd, ...args) => {
    const out = h.send(cmd, ...args);
    scan(out);
    return out;
  };
  /** Runs the clock for `seconds`, or until `stop` holds (checked after every tick). */
  const run = (seconds: number, stop: () => boolean = () => false) => {
    const end = clock.t + seconds;
    while (clock.t < end - 1e-9) {
      clock.t = Math.min(end, clock.t + tickSec);
      scan(show.tick());
      if (stop()) return true;
    }
    return false;
  };
  const landed = () => log.transitions.length;

  send('unlock');
  for (; round <= rounds; round++) {
    index = 0;
    if (round > 1) {
      // The Interval plays out, the round is introduced, the public Shuffle, the first Spin.
      run(between(100, 160));
      send('roundIntro');
      run(between(15, 30));
      send('newRound');
    }
    send('next');
    const holdAt = random() < 0.35 ? Math.floor(between(5, 40)) : -1;
    const backAt = random() < 0.25 ? Math.floor(between(5, 40)) : -1;
    const falseClaimAt = random() < 0.25 ? Math.floor(between(3, 30)) : -1;
    let bingo = false;
    for (let guard = 0; !bingo && guard < 200; guard++) {
      // Until the next landing (auto-advance runs at the Pace; in final the presenters press Next).
      const before = landed();
      for (let wait = 0; landed() === before && wait < 40; wait++) {
        if (run(5, () => landed() > before)) break;
        if (show.status === 'playing' && show.timers.autoAt == null && !show.transition) send('next');
        if (show.status === 'hold' && !show.transition) send('hold', { on: false });
      }
      if (landed() === before) throw new Error(`night ${seed}: round ${round} stalled at position ${show.position} (${show.status}, ${show.scene})`);
      const t = log.transitions.at(-1);
      if (!t) continue;
      const winners = show.possibleWinners();
      const lineDone = show.round.lineConfirmed;
      const cardId = (lineDone ? winners.bingo : winners.line)[0]?.cardId;
      if (cardId != null) {
        // A Claim a few seconds after the landing, its Check, the verdict, the Celebration.
        run(between(2, 6));
        send('claim', { cardId, kind: lineDone ? 'bingo' : 'line' });
        const claim = show.claims.at(-1);
        if (!claim) throw new Error('no claim');
        run(90, () => show.claims.find((c) => c.claimId === claim.claimId)?.status === 'checked');
        run(between(1, 4));
        send('decide', { claimId: claim.claimId, valid: true });
        if (lineDone) {
          bingo = true;
          // The Celebration flows into the Interval by itself.
          run(70, () => show.scene === 'interval');
        } else {
          run(between(10, 25));
          send('next');
        }
        continue;
      }
      if (index === falseClaimAt) {
        // A false Claim: its Check fails, the error Hold music, then the presenters move on.
        run(between(2, 5));
        const card = allCards.find((c) => c.type === 'normal' && c.id <= 200 && !winners.line.some((w) => w.cardId === c.id));
        if (card) {
          send('claim', { cardId: card.id, kind: lineDone ? 'bingo' : 'line' });
          const claim = show.claims.at(-1);
          if (claim) {
            run(90, () => show.claims.find((c) => c.claimId === claim.claimId)?.status === 'checked');
            send('decide', { claimId: claim.claimId, valid: false });
            run(between(6, 15));
            send('hold', { on: false });
          }
        }
      } else if (index === holdAt) {
        // The presenters talk for a minute: Hold, then Hold music.
        run(between(1, 4));
        send('hold', { on: true });
        run(between(45, 75));
        send('hold', { on: false });
      } else if (index === backAt) {
        // Back: the song is undone, the error Hold music, then the same song lands again. The undone landing
        // stays in the log: the room heard it.
        run(between(2, 5));
        send('back');
        run(between(5, 12));
        send('hold', { on: false });
      }
    }
    if (!bingo) throw new Error(`night ${seed}: round ${round} never reached its Bingo`);
    log.rounds++;
  }
  return log;
}

// ------------------------------------------------------------------------------------------ the runtime's music
/** One Hold-music start as audio/holdmusic.ts would play it: the track and the loop. */
export interface HoldPick {
  round: number;
  mood: string;
  track: string;
  loop: number;
}

interface HoldTrackFile {
  name: string;
  mood: string;
  loops: number;
  preferred: boolean;
}

function holdTracks(): HoldTrackFile[] {
  const index = readJson(path.join(DATA, 'hold', 'index.json'));
  if (!isRecord(index) || !Array.isArray(index.files)) return [];
  const out: HoldTrackFile[] = [];
  for (const f of index.files) {
    if (!isRecord(f) || typeof f.name !== 'string') continue;
    const meta = readJson(path.join(DATA, 'hold', `${f.name}.json`));
    if (!isRecord(meta)) continue;
    const loops = Array.isArray(meta.loops) ? meta.loops : [];
    const mood = meta.category === 'celebration' ? 'celebration' : meta.category === 'error' ? 'error' : 'hold';
    out.push({ name: f.name, mood, loops: Math.max(1, loops.length), preferred: loops.some((l) => isRecord(l) && l.preferred === true) });
  }
  return out;
}

/**
 * The tracks and loops HoldMusic.pick and start() choose for a night's requests: the tracks of a mood take turns
 * (per mood), a track plays its preferred loop or its loops take turns; a mood without a track plays the
 * synthesized placeholder (one loop). A request while Hold music already plays (`switch` to the same mood) is
 * still a new start in this model, which overcounts reuse a little.
 */
export function holdMusicPicks(music: readonly NightMusic[]): HoldPick[] {
  const tracks = holdTracks();
  const turns = new Map<string, number>();
  const next = new Map<string, number>();
  const picks: HoldPick[] = [];
  for (const m of music) {
    if (m.kind === 'interval') continue;
    const fitting = tracks.filter((t) => t.mood === m.mood);
    if (!fitting.length) {
      picks.push({ round: m.round, mood: m.mood, track: 'placeholder', loop: 0 });
      continue;
    }
    const turn = turns.get(m.mood) ?? 0;
    turns.set(m.mood, turn + 1);
    const track = fitting[turn % fitting.length];
    const k = next.get(track.name) ?? 0;
    next.set(track.name, k + 1);
    picks.push({ round: m.round, mood: m.mood, track: track.name, loop: track.preferred ? 0 : k % track.loops });
  }
  return picks;
}

/**
 * The Interval tracks a night plays (audio/interval.ts): the Game's shuffled order (interval/plan.ts trackAt),
 * each track until its natural handover near its end, through every Interval's music.
 */
export function intervalPicks(log: NightLog): string[] {
  const index = readJson(path.join(DATA, 'interval', 'index.json'));
  if (!isRecord(index) || !Array.isArray(index.tracks)) return [];
  const tracks = index.tracks.flatMap((t) => (isRecord(t) && typeof t.slug === 'string' && typeof t.durationSec === 'number' ? [{ slug: t.slug, sec: t.durationSec }] : []));
  if (!tracks.length) return [];
  const seed = gameSeed(`night-${log.seed}`);
  const played: string[] = [];
  let cursor = 0;
  for (const span of log.intervalSec) {
    let left = span;
    while (left > 0) {
      const track = tracks[trackAt(tracks.length, seed, cursor++)];
      played.push(track.slug);
      left -= Math.max(INTERVAL.minPlaySec, track.sec - INTERVAL.minBeforeEndSec - INTERVAL.windowSec / 2);
    }
  }
  return played;
}
