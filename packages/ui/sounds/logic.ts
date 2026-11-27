// The touch sounds' rules, pure (D206-D208; temp/design-canvas/ds/ui-sounds.md): which sample plays, at what rate,
// whether anything may play, and how many voices may sound at once. The audio and the DOM live in sprite-player.ts
// and delegate.ts.
import type { ClassSprite, SpriteSegment, TouchVariant } from './types.ts';

/** Hostnames that mean "this page runs on the show laptop itself", whose audio output is the PA (D207). */
const LOOPBACK = new Set(['localhost', '127.0.0.1', '::1', '[::1]']);

/** A page opened from the laptop itself (the relay's loopback address) never plays touch sounds or cues. */
export function isShowLaptop(hostname: string): boolean {
  const host = hostname.toLowerCase();
  return LOOPBACK.has(host) || host.endsWith('.localhost') || /^127\.\d+\.\d+\.\d+$/.test(host);
}

/**
 * One of a variant's samples at random, never the one that played last when there is another: the same key twice
 * in a row still sounds a little different (the package's main idea, and why it records several).
 */
export function pickSample(count: number, last: number | null, random: () => number): number {
  if (count <= 1) return 0;
  if (last === null || last < 0 || last >= count) return Math.min(count - 1, Math.floor(random() * count));
  const pick = Math.min(count - 2, Math.floor(random() * (count - 1)));
  return pick >= last ? pick + 1 : pick;
}

/** The playback rate for one play: uniform in the class's range. */
export function rateFor(range: readonly [number, number], random: () => number): number {
  const [low, high] = range;
  return low + (high - low) * random();
}

/** The rate at the sample's start and end: the pitch bend (none: the same rate throughout). */
export function bendRates(rate: number, bend: readonly [number, number] | undefined): readonly [number, number] {
  return bend ? [rate * bend[0], rate * bend[1]] : [rate, rate];
}

/** How long a sample takes to play at a rate that slides linearly from `from` to `to` (the source's `ms`). */
export function playedMs(ms: number, from: number, to: number): number {
  // Source time = ∫ rate dt, with the rate linear in t: ms = T × (from + to) / 2.
  return (2 * ms) / (from + to);
}

export interface PlayGate {
  /** The surface's switch. */
  enabled: boolean;
  /** The page is hidden (a background tab, the screen off). */
  hidden: boolean;
  /** This page runs on the show laptop. */
  showLaptop: boolean;
  /** The audio context runs (the first touch unlocked it) and the sprite is decoded. */
  ready: boolean;
  /** A game cue is playing (the phone's): touch sounds give way. */
  cueBusy: boolean;
}

/** Whether a touch sound may play now. */
export function mayPlay(gate: PlayGate): boolean {
  return gate.enabled && !gate.hidden && !gate.showLaptop && gate.ready && !gate.cueBusy;
}

/** The segment a class plays for a variant, if it has one. */
export function segmentsFor(sprite: ClassSprite | undefined, variant: TouchVariant): readonly SpriteSegment[] {
  return sprite?.[variant]?.at ?? [];
}

/** At most this many touch voices at once: quick typing overlaps one key's release with the next key's press. */
export const MAX_VOICES = 3;
/** The same class and variant again within this long is a double event: dropped. */
export const REPEAT_MS = 30;

export interface Voice {
  key: string;
  startMs: number;
  endMs: number;
}

export type VoiceDecision = { play: false } | { play: true; stop: number[] };

/**
 * Whether a new voice plays, and which of the voices still sounding to stop for it (the oldest first). Times are
 * the audio clock's, in ms.
 */
export function admitVoice(voices: readonly Voice[], key: string, nowMs: number, max = MAX_VOICES): VoiceDecision {
  const live = voices.map((v, i) => ({ v, i })).filter(({ v }) => v.endMs > nowMs);
  if (live.some(({ v }) => v.key === key && nowMs - v.startMs < REPEAT_MS)) return { play: false };
  const excess = live.length - (max - 1);
  const stop = excess > 0 ? [...live].sort((a, b) => a.v.startMs - b.v.startMs).slice(0, excess).map(({ i }) => i) : [];
  return { play: true, stop };
}

/** The tablet's switch, stored on the device: on unless switched off (U182). */
export function storedSoundsOn(stored: string | null): boolean {
  return stored !== '0';
}

/** The value to store for the tablet's switch. */
export const storedSoundsValue = (on: boolean): string => (on ? '1' : '0');
