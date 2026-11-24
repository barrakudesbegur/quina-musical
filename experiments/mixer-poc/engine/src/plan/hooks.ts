// Which hook of B to land: early phases use `best`; later ones rotate best/main, avoiding the hook
// this song used last time and hooks too close to the end of the file for the clip.
import type { Analysis, Hook } from '../analysis.ts';

/** An earlier landing, as far as hook rotation cares. */
export interface HookLanding {
  songId: number;
  hookId: string;
}

/** Valid hooks that leave at least `minTailSec` of the song after their downbeat. */
export function usableHooks(analysis: Analysis, minTailSec: number = 8): Hook[] {
  const duration = analysis.source.durationSec;
  return analysis.hooks.filter(
    (h) => h.valid && h.downbeatSec != null && h.downbeatSec > 0.05 && h.downbeatSec < duration - minTailSec,
  );
}

/**
 * @param phase    which hook tags this Phase may land (default: best)
 * @param history  earlier landings, oldest first
 * @returns null when the song has no usable hook
 */
export function pickHook(
  analysis: Analysis,
  phase: { readonly hookTags?: readonly string[] },
  history: readonly HookLanding[] = [],
  random: () => number = Math.random,
  { minTailSec = 12 }: { minTailSec?: number } = {},
): Hook | null {
  let pool = usableHooks(analysis, minTailSec);
  if (!pool.length) pool = usableHooks(analysis, 1);
  if (!pool.length) return null;
  const lastUsed = [...history].reverse().find((h) => h.songId === analysis.songId)?.hookId;
  const byTag = (tags: readonly string[]) => pool.filter((h) => tags.includes(h.tag));
  let candidates = byTag(phase.hookTags || ['best']);
  if (candidates.length > 1 && lastUsed) candidates = candidates.filter((h) => h.id !== lastUsed);
  if (!candidates.length) candidates = byTag(['best']).length ? byTag(['best']) : pool;
  // Prefer `best` slightly even when main hooks are allowed.
  const weights = candidates.map((h) => (h.tag === 'best' ? 2 : 1));
  let r = random() * weights.reduce((a, b) => a + b, 0);
  for (let i = 0; i < candidates.length; i++) {
    r -= weights[i];
    if (r <= 0) return candidates[i];
  }
  return candidates[candidates.length - 1];
}
