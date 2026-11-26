// The two songs played by hand for the crowd's chaotic moments (the Consola-Llancament-Tempesta board): «Llançament»
// for a Throw (D138, `throw`) and the corn-seed «Tempesta» (D151, D155, `storm`; the name is provisional, U137). Both
// take the same taps: a tap starts the song, stops it while it plays and resumes it where it stopped; a hold (the
// two-level strip's gesture, logic/two-level.ts) plays it again from its hook. A tap on one while the other is on
// replaces it. Only on the tablet: no Wii button, and A never plays them. Where they show is the cluster's layout
// (logic/cluster-layout.ts). Pure.
//   - what each button says now, from the state's `throwSong`;
//   - its time while it's on (the board's bar), from `throwSong.posSec` at `sinceMs` and the show's clock.
import type { ShowState, ThrowInfo, ThrowSong } from '@quina/protocol';
import type { TwoLevelAction } from './two-level.ts';

export type { ThrowSong } from '@quina/protocol';

/**
 * - idle: neither song is on (`throwSong` null): a tap starts this one;
 * - playing, stopped: this song is on, playing or stopped by a tap (the next tap resumes it);
 * - other: the other song is on: a tap replaces it with this one.
 */
export type ThrowButtonState = 'idle' | 'playing' | 'stopped' | 'other';

export function throwButtonState(throwSong: ShowState['throwSong'] | undefined, song: ThrowSong): ThrowButtonState {
  if (!throwSong) return 'idle';
  if (throwSong.song !== song) return 'other';
  return throwSong.playing ? 'playing' : 'stopped';
}

export interface ThrowCommand {
  cmd: ThrowSong;
  args: { restart?: boolean };
}

/** What an action on a throw song's button sends: a tap toggles it, a hold restarts it from its hook (null: nothing). */
export function throwCommand(song: ThrowSong, action: TwoLevelAction): ThrowCommand | null {
  if (action === 'tap') return { cmd: song, args: {} };
  if (action === 'escalate') return { cmd: song, args: { restart: true } };
  return null;
}

/** A throw song's time on its button (the board's bar), counted from its hook: a tap starts it there. */
export interface ThrowProgress {
  /** Seconds since its hook, now. */
  atSec: number;
  /** From its hook to its end. */
  totalSec: number;
  /** How much of it has played (0..1). */
  fraction: number;
  /** Where its drop is (0..1), or null when it starts at its drop (the storm) or the drop isn't ahead of its hook. */
  dropAt: number | null;
}

/** Where the song on now is at `nowMs` (the show's clock): playing, it moves on from `posSec` at `sinceMs`; stopped, it
 * waits there. Kept inside its length. */
export function throwProgress(info: ThrowInfo, nowMs: number): ThrowProgress {
  const totalSec = Math.max(0, info.durationSec - info.startSec);
  const posSec = info.playing ? info.posSec + Math.max(0, nowMs - info.sinceMs) / 1000 : info.posSec;
  const atSec = Math.min(totalSec, Math.max(0, posSec - info.startSec));
  const drop = info.dropSec - info.startSec;
  return {
    atSec,
    totalSec,
    fraction: totalSec > 0 ? atSec / totalSec : 0,
    dropAt: drop > 0 && drop < totalSec ? drop / totalSec : null,
  };
}

/** A time on the button, as on a player: 0:42, 3:33 (whole seconds, rounded down so it never runs ahead). */
export function throwClock(sec: number): string {
  const whole = Math.max(0, Math.floor(sec));
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, '0')}`;
}
