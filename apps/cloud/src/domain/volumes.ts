// The volume sliders a fresh Game starts with (D139): the plan's `volumes`. The sliders live on the tablet: the
// engine journals them in the Game's settings, and the cloud folds the newest into the plan, so a rehearsal's tuning
// carries to the next Game (the night's `&fresh=1`) and the edition file can take it back. Only the journal changes
// them: a plan saved from Admin or the laptop keeps the cloud's, so a stale copy can't undo a slider move. Pure.
import { VOLUME_KEYS, type GamePlan, type JournalEntry, type VolumeKey } from '@quina/protocol';

export type PlanVolumes = Partial<Record<VolumeKey, number>>;

/**
 * The newest volumes among these entries (settings.changed, round.started and round.resumed carry the settings), and
 * when they were journalled; null when none carries any. Keys the protocol doesn't know are left out.
 */
export function journalledVolumes(entries: readonly JournalEntry[]): { volumes: PlanVolumes; atMs: number } | null {
  let found: { volumes: PlanVolumes; atMs: number } | null = null;
  for (const entry of entries) {
    const volumes = 'settings' in entry ? entry.settings.volumes : undefined;
    if (volumes && (!found || entry.atMs >= found.atMs)) found = { volumes: inOrder(volumes), atMs: entry.atMs };
  }
  return found;
}

/** The plan with `volumes` folded into its own, or null when that changes nothing. */
export function withVolumes(plan: GamePlan, volumes: PlanVolumes): GamePlan | null {
  const merged = inOrder({ ...plan.volumes, ...volumes });
  if (JSON.stringify(merged) === JSON.stringify(inOrder(plan.volumes ?? {}))) return null;
  return { ...plan, volumes: merged };
}

/** A plan saved from Admin or the laptop, with the volumes the cloud already has (none when it has none). */
export function keepingVolumes(plan: GamePlan, current: GamePlan | null): GamePlan {
  const { volumes: _ignored, ...rest } = plan;
  return current?.volumes ? { ...rest, volumes: current.volumes } : rest;
}

/** The known keys only, in VOLUME_KEYS order, so the same volumes always serialize the same. */
function inOrder(volumes: Partial<Record<string, number>>): PlanVolumes {
  const out: PlanVolumes = {};
  for (const key of VOLUME_KEYS) {
    const percent = volumes[key];
    if (typeof percent === 'number') out[key] = percent;
  }
  return out;
}
