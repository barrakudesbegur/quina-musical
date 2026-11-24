// The Celebration's 'winningSong' music: the Winning song's hook looped in whole bars on its own grid. Pure:
// it picks the region from the song's analysis; audio/celebration.ts plays it.
import type { Analysis, Hook } from '../analysis.ts';

export interface HookLoop {
  hookId: string;
  /** Where playback starts: the hook's pickup, so its first syllable is not clipped. */
  startSec: number;
  /** The loop: from the hook's downbeat to the downbeat `bars` bars later. */
  loopStartSec: number;
  loopEndSec: number;
  bars: number;
  /** The hook's loudness trim. */
  gainDb: number;
}

const TAG_ORDER = ['best', 'main'];
const rank = (h: Hook) => {
  const i = TAG_ORDER.indexOf(h.tag);
  return i < 0 ? TAG_ORDER.length : i;
};

/** The song's best valid hook: 'best', then 'main', then any, in song order. */
export function bestHook(analysis: Analysis): Hook | null {
  const valid = analysis.hooks.filter((h) => h.valid);
  return valid.reduce<Hook | null>((best, h) => (best == null || rank(h) < rank(best) ? h : best), null);
}

/**
 * The loop for `hookId` (the hook the song landed on), or its best hook when that one is unknown. At most
 * `bars` bars, fewer near the song's end; null when even `minBars` do not fit.
 */
export function hookLoop(analysis: Analysis, hookId: string | null, { bars, minBars }: { bars: number; minBars: number }): HookLoop | null {
  const hook = analysis.hooks.find((h) => h.valid && h.id === hookId) ?? bestHook(analysis);
  if (!hook) return null;
  const downbeats = analysis.downbeats;
  const i = hook.downbeatIndex;
  const n = Math.min(bars, downbeats.length - 1 - i);
  if (i < 0 || n < minBars) return null;
  const loopStartSec = downbeats[i];
  return {
    hookId: hook.id,
    startSec: Math.max(0, loopStartSec - (hook.pickupSec || 0)),
    loopStartSec,
    loopEndSec: downbeats[i + n],
    bars: n,
    gainDb: hook.gainToTargetDb ?? analysis.loudness?.gainToTargetDb ?? 0,
  };
}
