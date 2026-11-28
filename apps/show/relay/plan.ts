// The laptop's copy of the Game plan, for the screens on its network (console, stage, Admin) with or without the
// cloud. Two files in the cloud link's folder (data/link/), each `{ savedAtMs, plan }`:
//   cloud-plan.json  the cloud's plan, written by the cloud link (apps/cloud/laptop/link.ts) on every change;
//   local-plan.json  a plan saved on the laptop's network with no cloud (PUT /api/plan on the relay).
// The newest `savedAtMs` wins (the cloud's on a tie). The relay serves it as /cloud/plan.json and pushes it to
// every paired screen as `relay.plan`; once the cloud is back, the link uploads a newer local plan to it.
// The newest plan's `savedAtMs` is its version, as in the cloud: a save names the version it was based on
// (`x-quina-plan-base`, spelt as apps/cloud/src/domain/plan-versions.ts and Admin spell it) and is refused when the
// laptop's plan is another one by then (whats-left 7.1).
import fs from 'node:fs';
import path from 'node:path';
import { checkGamePlan, type GamePlan } from '@quina/protocol';

export const CLOUD_PLAN_FILE = 'cloud-plan.json';
export const LOCAL_PLAN_FILE = 'local-plan.json';

/** A plan as one of the two files keeps it. */
export interface StoredPlan {
  savedAtMs: number;
  plan: GamePlan | null;
}

/** What the screens get: the newest plan, and when it was saved (null: no plan anywhere yet). */
export interface CurrentPlan {
  plan: GamePlan | null;
  savedAtMs: number | null;
}

/** Read one of the two files; a missing, broken or invalid file reads as null (never throws). */
export function readStoredPlan(file: string): StoredPlan | null {
  try {
    return parseStoredPlan(JSON.parse(fs.readFileSync(file, 'utf8')));
  } catch {
    return null;
  }
}

/** Check a stored plan's shape, and the plan inside with the protocol's checkGamePlan. */
export function parseStoredPlan(value: unknown): StoredPlan | null {
  if (!value || typeof value !== 'object') return null;
  const { savedAtMs, plan } = value as Record<string, unknown>;
  if (typeof savedAtMs !== 'number' || !Number.isFinite(savedAtMs)) return null;
  if (plan === null) return { savedAtMs, plan: null };
  const check = checkGamePlan(plan);
  return check.ok ? { savedAtMs, plan: check.plan } : null;
}

/** The newer of the cloud's and the local copy; the cloud's wins a tie. */
export function newestPlan(cloud: StoredPlan | null, local: StoredPlan | null): CurrentPlan {
  const pick = !local ? cloud : !cloud ? local : local.savedAtMs > cloud.savedAtMs ? local : cloud;
  return pick ? { plan: pick.plan, savedAtMs: pick.savedAtMs } : { plan: null, savedAtMs: null };
}

/** Write a file whole, then rename it, so a reader never sees half a file. */
function writeWhole(file: string, value: unknown): void {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(`${file}.tmp`, `${JSON.stringify(value, null, 2)}\n`, { flush: true });
  fs.renameSync(`${file}.tmp`, file);
}

/** The header a save names its base version in: the savedAtMs it loaded, or `none`. */
export const PLAN_BASE_HEADER = 'x-quina-plan-base';

/** The header's version (null: `none`), or undefined when it is missing or not one. */
export function parsePlanBase(header: string | string[] | undefined): number | null | undefined {
  if (typeof header !== 'string') return undefined;
  const value = header.trim();
  if (value === 'none') return null;
  return /^\d{1,16}$/.test(value) ? Number(value) : undefined;
}

/** `stale`: based on another version than the laptop's plan now (`savedAtMs`). */
export type LocalSave =
  | { ok: true; plan: GamePlan; savedAtMs: number }
  | { ok: false; errors: string[]; stale?: false }
  | { ok: false; errors: string[]; stale: true; savedAtMs: number | null };

/**
 * The laptop's plan: the newest of the two files, followed as they change (polled, so it works before the link
 * has made the folder and across its renames). `onChange` hears every change of the newest plan.
 */
export class LaptopPlan {
  private readonly dir: string;
  private readonly onChange: (current: CurrentPlan) => void;
  private currentPlan: CurrentPlan = { plan: null, savedAtMs: null };
  private currentJson = JSON.stringify(this.currentPlan);
  private watching = false;

  constructor(dir: string, onChange: (current: CurrentPlan) => void) {
    this.dir = dir;
    this.onChange = onChange;
    this.reload();
  }

  current(): CurrentPlan {
    return this.currentPlan;
  }

  /** Follow both files (every `intervalMs`) until `stop()`. */
  start(intervalMs = 500): void {
    if (this.watching) return;
    this.watching = true;
    for (const name of [CLOUD_PLAN_FILE, LOCAL_PLAN_FILE]) fs.watchFile(path.join(this.dir, name), { interval: intervalMs, persistent: false }, () => this.reload());
  }

  stop(): void {
    if (!this.watching) return;
    this.watching = false;
    for (const name of [CLOUD_PLAN_FILE, LOCAL_PLAN_FILE]) fs.unwatchFile(path.join(this.dir, name));
  }

  /**
   * Save a plan made on the laptop's network, based on version `base` (what Admin loaded; null: there was none):
   * refused if the laptop's plan is another version now. Checked like the cloud checks it, and for the same edition
   * as the cloud's copy when there is one. It becomes the newest plan at once.
   */
  saveLocal(json: unknown, nowMs: number, base: number | null): LocalSave {
    this.reload(); // the link may have written the cloud's copy since the last poll
    const own = this.currentPlan.savedAtMs;
    if (base !== own) return { ok: false, stale: true, savedAtMs: own, errors: [`plan: changed since this save's version (${base ?? 'none'}); it is ${own ?? 'none'} now: load it again`] };
    const check = checkGamePlan(json, { write: true });
    if (!check.ok) return check;
    const cloud = readStoredPlan(path.join(this.dir, CLOUD_PLAN_FILE));
    if (cloud?.plan && cloud.plan.edition !== check.plan.edition) return { ok: false, errors: [`plan.edition: the cloud's plan is for edition ${cloud.plan.edition}`] };
    // Never older than the copy it replaces, even if this laptop's clock is behind.
    const savedAtMs = Math.max(nowMs, (this.currentPlan.savedAtMs ?? 0) + 1);
    writeWhole(path.join(this.dir, LOCAL_PLAN_FILE), { savedAtMs, plan: check.plan } satisfies StoredPlan);
    this.reload();
    return { ok: true, plan: check.plan, savedAtMs };
  }

  /** Read both files again; tell `onChange` if the newest plan changed. */
  reload(): void {
    const next = newestPlan(readStoredPlan(path.join(this.dir, CLOUD_PLAN_FILE)), readStoredPlan(path.join(this.dir, LOCAL_PLAN_FILE)));
    const json = JSON.stringify(next);
    if (json === this.currentJson) return;
    this.currentPlan = next;
    this.currentJson = json;
    this.onChange(next);
  }
}
