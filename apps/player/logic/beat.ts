// The beat of the song heard now, for `mark-bob` (ANIMATIONS.md, the user, 28 Nov: the card marks bob like a head on
// the beat). The feed's `PublicState.beat` (Sound engine's BeatInfo, projected by the cloud): the tempo as heard, the
// bar's length, and a bar's first beat on the cloud's clock (the one the phone already offsets for the drum); null when
// no song is heard. `songBeat` is the only place in the app that reads it. Pure: the browser's side (pinning each bob,
// bobbing only what shows) is device/bob.ts.
import type { PublicBeat, PublicLanding, PublicState } from '../feed/public.ts';

export type { PublicBeat };

export const BOB = {
  /** A side never comes faster than this (per minute): above it a side takes two beats (or a bar in 3/4). */
  maxSidesPerMinute: 140,
  /** Re-set the CSS only when the phase moves more than this (the clock's offset wobbles by a millisecond a tick). */
  toleranceMs: 4,
  /** The keyframes' name (player.css), whose animations device/bob.ts pins. */
  animation: 'player-mark-bob',
  /** The demo's beat (`&bpm=`, development and demos only): the bar it builds. */
  demoBeatsPerBar: 4,
} as const;

const isNum = (x: unknown): x is number => typeof x === 'number' && Number.isFinite(x);

/** A usable beat, or null (absent, null, or a field that isn't a positive number). */
function checked(beat: unknown): PublicBeat | null {
  if (typeof beat !== 'object' || beat === null) return null;
  const { bpm, beatsPerBar, downbeatAtMs } = beat as Record<string, unknown>;
  if (!isNum(bpm) || bpm <= 0 || !isNum(downbeatAtMs)) return null;
  const bar = isNum(beatsPerBar) && Number.isInteger(beatsPerBar) && beatsPerBar >= 1 ? beatsPerBar : 4;
  return { bpm, beatsPerBar: bar, downbeatAtMs };
}

/**
 * The adapter: the beat of the song heard now, from the feed (`state.beat`); absent or null, no bob. A demo's `&bpm=`
 * (`demoBpm`, honoured only in development and demos by main.ts) stands in for a feed that has none: a 4-beat bar
 * whose downbeat is the latest landing, so it goes through the same path.
 */
export function songBeat(state: PublicState | null, latest: PublicLanding | null, demoBpm: number | null = null): PublicBeat | null {
  const sent = checked(state?.beat);
  if (sent) return sent;
  if (demoBpm === null || !latest) return null;
  return checked({ bpm: demoBpm, beatsPerBar: BOB.demoBeatsPerBar, downbeatAtMs: latest.atMs });
}

/** How many beats one side of the swing takes: one, or for a fast pulse the fewest that divide the bar (2 or a bar of
 *  3) and bring a side under `maxSidesPerMinute`, so a side always starts on a beat and on the bar's downbeat. */
export function beatsPerSide(bpm: number, beatsPerBar: number): number {
  const options = [1, ...[2, 3, 4, 6, 8].filter((n) => n <= beatsPerBar && beatsPerBar % n === 0)];
  if (!options.includes(beatsPerBar)) options.push(beatsPerBar);
  return options.find((n) => bpm / n <= BOB.maxSidesPerMinute) ?? options.at(-1) ?? 1;
}

/** The bob's CSS: a full left-right cycle (`--beat-period`) and its delay (`--beat-delay`), both in ms. */
export interface BobTiming {
  periodMs: number;
  /** In the document timeline's time, for animations whose start time is pinned to its zero (device/bob.ts): in
   *  (−period, 0] while the song plays, positive (the downbeat's own timeline time) while it is still ahead. */
  delayMs: number;
  /** The downbeat is still ahead: nothing moves until then. */
  ahead: boolean;
}

/** The clocks a timing is computed against. */
export interface BobClock {
  /** The cloud's clock minus the local one (ms): `app.cloudNow - app.localNow`, the drum's. */
  offsetMs: number;
  /** Local `Date.now()` now. */
  localNowMs: number;
  /** The document timeline's time now (`performance.now()`: the same origin). */
  timelineNowMs: number;
}

const mod = (a: number, n: number) => ((a % n) + n) % n;

/**
 * The beat → the bob's period and delay, or null (no beat: no bob). The animations' start time is pinned to the
 * timeline's zero, so the delay is the downbeat's place on that timeline: its phase (a negative delay in one period)
 * while the song plays; the downbeat's own time while it is ahead (they start exactly on it).
 */
export function bobTiming(beat: PublicBeat | null, clock: BobClock): BobTiming | null {
  if (!beat) return null;
  const periodMs = (2 * beatsPerSide(beat.bpm, beat.beatsPerBar) * 60_000) / beat.bpm;
  // The downbeat on the local clock, then on the document timeline.
  const downbeatLocal = beat.downbeatAtMs - clock.offsetMs;
  const downbeatTimeline = downbeatLocal - (clock.localNowMs - clock.timelineNowMs);
  const ahead = downbeatTimeline > clock.timelineNowMs;
  const phase = mod(downbeatTimeline, periodMs);
  const delayMs = ahead ? downbeatTimeline : phase === 0 ? 0 : phase - periodMs;
  return { periodMs: round(periodMs), delayMs: round(delayMs), ahead };
}

const round = (ms: number) => Math.round(ms * 10) / 10;

/** Keep the timing on screen unless the new one differs: another period, the downbeat no longer ahead, or sides that
 *  start more than `toleranceMs` away from the shown ones. A new downbeat whose sides start on the same beats changes
 *  nothing, even half a cycle away (the engine re-sends its latest downbeat: in 3/4 a bar later is half a cycle, and
 *  the swing would jump to the other side). */
export function keepTiming(shown: BobTiming | null, next: BobTiming | null, toleranceMs: number = BOB.toleranceMs): BobTiming | null {
  if (!shown || !next) return next;
  if (shown.periodMs !== next.periodMs || shown.ahead !== next.ahead) return next;
  const side = next.periodMs / 2;
  const d = mod(next.delayMs - shown.delayMs, side);
  return Math.min(d, side - d) > toleranceMs ? next : shown;
}

/** The CSS custom properties for a timing. */
export function bobStyle(timing: BobTiming): { period: string; delay: string } {
  return { period: `${timing.periodMs}ms`, delay: `${timing.delayMs}ms` };
}

/** What lets the marks bob: a song heard (its beat), in `play`, with no Check, Celebration or Pausa, the phone not
 *  offline and the laptop's link up (when it drops, the cloud keeps its last beat, which may no longer be what plays).
 *  Reduced motion is the CSS's (player.css). */
export function bobOn(input: { scene: string; paused: boolean; offline: boolean; linkOnline: boolean; celebrationOpen: boolean; timing: BobTiming | null }): boolean {
  return input.timing !== null && input.scene === 'play' && !input.paused && !input.offline && input.linkOnline && !input.celebrationOpen;
}
