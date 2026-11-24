// The Interval playlist's plan, pure: the Game's order of tracks, and every handover between two pieces of
// music. audio/interval.ts carries it out on the graph. Times are audio-clock seconds unless named `…Sec` in a
// track's own timeline.
//
// A handover happens on a downbeat `at` of the music playing (an Interval track, or the victory track or other
// bed it takes over from):
//   - the outgoing music's last beat goes into an echo synced to its beat, its dry signal stops on the one, and
//     the echo's repeats thin out (high-pass up) and fade over a few seconds;
//   - the incoming track's downbeat (`anchorSec`) sounds exactly on that one. With tempos close enough to overlap,
//     its bars before it rise under the outgoing music: a swell (gain up, high-pass down) or a filter opening
//     (low-pass up), while the outgoing music thins (high-pass up). With tempos apart, only its pickup plays
//     before the one, and its low-pass keeps opening for two of its bars after it, under the echo.
// Nothing is ever silent: the outgoing music plays dry until the one, and the incoming track is up by then.
import { INTERVAL } from '../config.ts';
import { mixSeed, mod, seededRandom } from '../rng.ts';
import type { IntervalTrack } from './tracks.ts';

type IntervalConfig = typeof INTERVAL;

// ---------------------------------------------------------------------------------------------- the order
/** A 32-bit seed from a Game id (FNV-1a), so a Game always gets the same order, also after a reload. */
export function gameSeed(gameId: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < gameId.length; i++) h = Math.imul(h ^ gameId.charCodeAt(i), 0x01000193) >>> 0;
  return h >>> 0;
}

/**
 * The playlist indexes of cycle `cycle` of a Game's order: every track once, shuffled from the Game's seed. A
 * cycle never starts with the track the one before it ended with.
 */
export function orderCycle(count: number, seed: number, cycle: number): number[] {
  let previousLast: number | null = null;
  let order: number[] = [];
  for (let k = 0; k <= cycle; k++) {
    const random = seededRandom(mixSeed(seed, k));
    order = Array.from({ length: count }, (_, i) => i);
    for (let i = count - 1; i > 0; i--) {
      const j = Math.floor(random() * (i + 1));
      [order[i], order[j]] = [order[j], order[i]];
    }
    if (count > 1 && order[0] === previousLast) [order[0], order[1]] = [order[1], order[0]];
    previousLast = order[count - 1] ?? null;
  }
  return order;
}

/** The playlist index of the `cursor`-th track started in a Game (0, 1, 2…): no repeat until all have played. */
export function trackAt(count: number, seed: number, cursor: number): number {
  if (count <= 0) throw new Error('an empty playlist');
  return orderCycle(count, seed, Math.floor(cursor / count))[mod(cursor, count)];
}

// ---------------------------------------------------------------------------------------------- grids
/** The music playing now, as a handover needs it: its downbeats and its beat, on the audio clock. */
export interface OutgoingMusic {
  /** Its first downbeat at or after `t`, or null: no grid, or none before its sound ends. */
  downbeatAfter(t: number): number | null;
  /** Its beat (the echo's delay), null without a grid. */
  beatSec: number | null;
  beatsPerBar: number;
}

/** An Interval track playing from `startAt`, `offsetSec` into its file. */
export function trackGrid(track: IntervalTrack, startAt: number, offsetSec: number): OutgoingMusic {
  const beatSec = track.downbeats.length >= 2 ? 60 / track.tempo.bpm : null;
  return {
    downbeatAfter(t) {
      const pos = offsetSec + (t - startAt);
      const d = track.downbeats.find((x) => x >= pos - 1e-6);
      return d == null || d > track.edges.endSec ? null : startAt + (d - offsetSec);
    },
    beatSec,
    beatsPerBar: track.tempo.beatsPerBar,
  };
}

/** A looping buffer (Hold music, the Winning song's hook loop): `bars` whole bars between its loop points. */
export interface LoopGridSource {
  /** When the buffer started, and from where in it. */
  startAt: number;
  offsetSec: number;
  /** The loop, in the buffer's timeline; `loopStartSec` is a downbeat. */
  loopStartSec: number;
  loopEndSec: number;
  bars: number;
  beatsPerBar: number;
}

/** The grid of a looping buffer: downbeats every bar from its loop start, the same after every wrap. */
export function loopGrid({ startAt, offsetSec, loopStartSec, loopEndSec, bars, beatsPerBar }: LoopGridSource): OutgoingMusic | null {
  const length = loopEndSec - loopStartSec;
  if (!(length > 0) || !(bars >= 1)) return null;
  const bar = length / bars;
  return {
    downbeatAfter(t) {
      const played = offsetSec + Math.max(0, t - startAt);
      const pos = played < loopEndSec ? played : loopStartSec + mod(played - loopStartSec, length);
      const k = Math.ceil((pos - loopStartSec) / bar - 1e-6);
      return Math.max(t, startAt) + (loopStartSec + k * bar - pos);
    },
    beatSec: bar / beatsPerBar,
    beatsPerBar,
  };
}

/** Two tempos close enough to overlap bars, after folding one ×2 or ÷2. */
export function temposMatch(bpmA: number, bpmB: number, tolerance: number = INTERVAL.matchedTempo): boolean {
  if (!(bpmA > 0) || !(bpmB > 0)) return false;
  return [1, 2, 0.5].some((fold) => Math.abs((bpmA * fold) / bpmB - 1) <= tolerance);
}

// ---------------------------------------------------------------------------------------------- the natural handover
/**
 * Where a track hands over by itself, in its own timeline: a downbeat in the last `minBeforeEndSec +
 * windowSec`…`minBeforeEndSec` seconds of its sound (no later than `intoFadeSec` into its closing fade), the
 * latest that starts a phrase, else the latest there, else the latest before it. Never before `minPlaySec`: a
 * short track takes its first downbeat after that.
 */
export function naturalHandoverSec(track: IntervalTrack, config: IntervalConfig = INTERVAL): number {
  const { startSec, endSec, fadeStartSec } = track.edges;
  const floor = Math.min(startSec + config.minPlaySec, endSec - 1);
  const latest = Math.max(floor, Math.min(endSec - config.minBeforeEndSec, fadeStartSec + config.intoFadeSec));
  const earliest = Math.max(floor, latest - config.windowSec);
  const firstIndex = track.downbeats.findIndex((d) => d >= startSec - 0.05);
  if (firstIndex < 0) return latest;
  const candidates = track.downbeats.map((d, i) => ({ d, i })).filter(({ d, i }) => i >= firstIndex && d <= latest + 1e-6);
  const inWindow = candidates.filter(({ d }) => d >= earliest - 1e-6);
  const phrase = inWindow.filter(({ i }) => (i - firstIndex) % config.phraseBars === 0);
  const pick = phrase.at(-1) ?? inWindow.at(-1) ?? candidates.filter(({ d }) => d >= floor - 1e-6).at(-1)
    ?? track.downbeats.map((d) => ({ d })).find(({ d }) => d >= floor - 1e-6 && d <= endSec - 1);
  return pick?.d ?? latest;
}

// ---------------------------------------------------------------------------------------------- a handover
export type EntryStyle = 'swell' | 'filter';
/** 'natural': a track's end; 'skip': the presenters' skip; 'start': the playlist takes over (from a bed or silence). */
export type HandoverKind = 'natural' | 'skip' | 'start';
/** in.*: the incoming track's fader (1 = its level), filters; out.*: the outgoing music's; echo.*: the echo-out's. */
export type AutomationTarget =
  | 'in.gain' | 'in.hpf' | 'in.lpf' | 'out.gain' | 'out.hpf' | 'echo.send' | 'echo.time' | 'echo.feedback' | 'echo.hpf' | 'echo.return';
/** Like Web Audio: 'set' jumps at `at`; 'linear' and 'exp' ramp from the previous point to `value` at `at`. */
export interface Automation {
  target: AutomationTarget;
  at: number;
  value: number;
  curve: 'set' | 'linear' | 'exp';
}

export interface HandoverRequest {
  kind: HandoverKind;
  now: number;
  /** The music playing now, or null (the playlist starts from silence). */
  out: OutgoingMusic | null;
  incoming: IntervalTrack;
  /** The style wanted; tempos apart always open a filter. */
  style: EntryStyle;
  /** 'natural': the downbeat to hand over on (naturalHandoverSec, on the audio clock). Else the next one is found. */
  at?: number;
}

export interface Handover {
  kind: HandoverKind;
  /** The one: the outgoing music's dry signal stops, the incoming track's `anchorSec` sounds. */
  at: number;
  style: EntryStyle;
  /** Tempos close enough to overlap bars. */
  matched: boolean;
  /** The incoming track starts at `startAt` from `offsetSec` into its file, so `anchorSec` sounds at `at`. */
  incoming: { slug: string; startAt: number; offsetSec: number; anchorSec: number };
  /** The outgoing music's echo-out: its delay, and when its send opens; null from silence. */
  echo: { delaySec: number; sendFrom: number } | null;
  automation: Automation[];
  /** When the outgoing music and its echo are silent and can be released. */
  releaseAt: number;
}

/** Plan a handover (see the top of this file). Every time is at or after `now`. */
export function planHandover(req: HandoverRequest, config: IntervalConfig = INTERVAL): Handover {
  const { kind, now, out, incoming } = req;
  const { startSec } = incoming.edges;
  const inBeat = 60 / incoming.tempo.bpm;
  const inBar = inBeat * incoming.tempo.beatsPerBar;
  const first = incoming.edges.firstDownbeatSec ?? startSec;
  const automation: Automation[] = [];
  const add = (target: AutomationTarget, at: number, value: number, curve: Automation['curve'] = 'set') => automation.push({ target, at, value, curve });
  const soon = now + 0.05;

  // From silence: the track fades in from where its sound starts.
  if (!out) {
    const at = req.at ?? soon;
    add('in.gain', at, 0);
    add('in.gain', at + config.fadeInSec, 1, 'linear');
    return { kind, at, style: req.style, matched: false, incoming: { slug: incoming.slug, startAt: at, offsetSec: startSec, anchorSec: startSec }, echo: null, automation, releaseAt: at };
  }

  const outBeat = out.beatSec;
  const outBar = outBeat != null ? outBeat * out.beatsPerBar : null;
  const matched = outBeat != null && incoming.downbeats.length >= 2 && temposMatch(60 / outBeat, incoming.tempo.bpm, config.matchedTempo);
  const pickup = Math.max(0, Math.min(config.pickupBeats * inBeat, first - startSec));
  // How long the incoming track plays before the one: bars that rise under the outgoing music, or its pickup.
  let overlap = matched && outBar != null
    ? Math.min(config.overlapSec.max, Math.max(kind === 'skip' ? 0 : config.overlapSec.min, (kind === 'skip' ? config.skipOverlapBars : config.overlapBars) * outBar))
    : pickup;
  const lead = kind === 'skip' ? config.skipLeadSec : overlap + config.skipLeadSec;
  const at = req.at ?? out.downbeatAfter(now + lead) ?? now + lead;
  overlap = Math.max(0, Math.min(overlap, at - soon));
  const style: EntryStyle = matched ? req.style : 'filter';

  // The incoming downbeat on the one: with bars overlapping, the first one that leaves room for them.
  let anchorSec = first;
  if (matched && overlap > 0) anchorSec = incoming.downbeats.find((d) => d >= first - 1e-6 && d - overlap >= startSec - 0.02) ?? first;
  const pre = matched ? overlap : Math.min(overlap, pickup);
  const offsetSec = Math.max(0, anchorSec - pre);
  const startAt = at - (anchorSec - offsetSec);

  // The incoming track.
  if (style === 'swell' && pre > 0.05) {
    add('in.gain', startAt, 10 ** (config.swellFromDb / 20));
    add('in.gain', at, 1, 'exp');
    add('in.hpf', startAt, config.swellHpfHz);
    add('in.hpf', at, 20, 'exp');
    add('in.lpf', startAt, config.filterOpenHz);
  } else {
    // Filter opening: fully open on the one with bars overlapping, else two of its bars after it.
    const openAt = matched && pre > 0.05 ? at : at + config.filterAfterBars * inBar;
    add('in.gain', startAt, 0);
    add('in.gain', startAt + Math.max(0.02, Math.min(pre * 0.25, 1.5)), 1, 'linear');
    add('in.hpf', startAt, 20);
    add('in.lpf', startAt, config.filterFromHz);
    add('in.lpf', openAt, config.filterOpenHz, 'exp');
  }

  // The outgoing music: thinner while the incoming one rises, its last beat into the echo, dry off on the one.
  const delaySec = (() => {
    const beat = outBeat ?? config.fallbackBeatSec;
    return beat > config.echoHalfBeatOverSec ? beat / 2 : beat;
  })();
  const sendFrom = Math.max(soon, at - delaySec);
  const thinFrom = Math.max(soon, Math.min(startAt, sendFrom));
  add('out.hpf', thinFrom, 20);
  add('out.hpf', at, config.outHpfHz, 'exp');
  add('echo.time', Math.max(now, sendFrom - 0.02), delaySec);
  add('echo.feedback', Math.max(now, sendFrom - 0.02), config.echoFeedback);
  add('echo.send', Math.max(now, sendFrom - 0.01), 0);
  add('echo.send', sendFrom, 1, 'linear');
  add('echo.send', at, 1);
  add('echo.send', at + config.cutSec, 0, 'linear');
  add('out.gain', at, 1);
  add('out.gain', at + config.cutSec, 0, 'linear');
  add('echo.hpf', at, config.echoHpfHz.from);
  add('echo.hpf', at + config.echoTailSec, config.echoHpfHz.to, 'exp');
  add('echo.return', at + config.echoTailSec * 0.4, 1);
  add('echo.return', at + config.echoTailSec, 0, 'linear');
  automation.sort((a, b) => a.at - b.at);
  return {
    kind, at, style, matched,
    incoming: { slug: incoming.slug, startAt, offsetSec, anchorSec },
    echo: { delaySec, sendFrom },
    automation,
    releaseAt: at + config.echoTailSec + 0.2,
  };
}

/** The value of `target` at `t` under `automation` (Web Audio's rules), from `initial` before its first point. */
export function valueAt(automation: readonly Automation[], target: AutomationTarget, t: number, initial: number): number {
  let value = initial;
  let from = { at: -Infinity, value: initial };
  for (const a of automation) {
    if (a.target !== target) continue;
    if (a.at > t) {
      if (a.curve === 'set') return value;
      const p = (t - from.at) / (a.at - from.at);
      if (!Number.isFinite(p) || p < 0) return value;
      return a.curve === 'linear' ? from.value + (a.value - from.value) * p : from.value * (a.value / from.value) ** p;
    }
    value = a.value;
    from = { at: a.at, value: a.value };
  }
  return value;
}
