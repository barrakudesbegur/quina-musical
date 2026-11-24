// Where Admin keeps the Game plan. It wraps a shared PlanStore (ui/data/plan-store.ts: localStorage today,
// the cloud later) and adds two things Admin needs:
// - Inline logos. The shared validator doesn't accept data-URL logos yet, so a plan carrying them would read
//   as "no plan" on every screen. planForStorage keeps them in a side store (by sponsor id) and stores the
//   plan with `logo: null` for them; load() puts them back. Once the shared validator accepts inline logos,
//   the plan is stored whole and the side store stays empty, with no change here.
// - Defined failures. save() never throws: it reports a full storage (big logos), storage the browser
//   refuses (private mode), or anything else, so the page can keep the draft and say why.
import type { GamePlan } from '../../ui/plan.ts';
import { LocalPlanStore, type PlanStore } from '../../ui/data/plan-store.ts';
import { planForStorage, planFromStorage } from '../logic/plan-check.ts';
import { MANAGE_CONFIG } from '../config.ts';

export interface LogoStore {
  load(): Record<string, string>;
  /** Replaces every stored logo. May throw (a full storage). */
  save(logos: Record<string, string>): void;
}

export type SaveFailure = 'quota' | 'error';
export type SaveResult = { ok: true } | { ok: false; reason: SaveFailure; detail: string };

/** A full localStorage, in every browser's spelling. */
export function isQuotaError(e: unknown): boolean {
  if (typeof e !== 'object' || e === null) return false;
  const { name, code } = e as { name?: unknown; code?: unknown };
  return name === 'QuotaExceededError' || name === 'NS_ERROR_DOM_QUOTA_REACHED' || code === 22 || code === 1014;
}

/** Whether this browser lets the page write localStorage (private modes and blocked site data don't). */
export function storageWritable(): boolean {
  try {
    const probe = 'quina.manage.probe';
    localStorage.setItem(probe, '1');
    localStorage.removeItem(probe);
    return true;
  } catch {
    return false;
  }
}

export class LocalLogoStore implements LogoStore {
  private readonly key: string;

  constructor(key: string = MANAGE_CONFIG.storage.logos) {
    this.key = key;
  }

  load(): Record<string, string> {
    try {
      const raw = localStorage.getItem(this.key);
      const json: unknown = raw ? JSON.parse(raw) : {};
      if (typeof json !== 'object' || json === null || Array.isArray(json)) return {};
      return Object.fromEntries(Object.entries(json).filter((e): e is [string, string] => typeof e[1] === 'string'));
    } catch {
      return {};
    }
  }

  save(logos: Record<string, string>): void {
    if (Object.keys(logos).length) localStorage.setItem(this.key, JSON.stringify(logos));
    else localStorage.removeItem(this.key);
  }
}

/** Demo mode and tests: nothing leaves the page. */
export class MemoryPlanStore implements PlanStore {
  private plan: GamePlan | null;
  private readonly listeners = new Set<(plan: GamePlan | null) => void>();

  constructor(plan: GamePlan | null = null) {
    this.plan = plan;
  }

  load(): GamePlan | null {
    return this.plan;
  }

  save(plan: GamePlan): void {
    this.plan = plan;
    for (const l of this.listeners) l(plan);
  }

  subscribe(listener: (plan: GamePlan | null) => void): () => void {
    this.listeners.add(listener);
    return () => void this.listeners.delete(listener);
  }
}

export class MemoryLogoStore implements LogoStore {
  private logos: Record<string, string> = {};

  load(): Record<string, string> {
    return { ...this.logos };
  }

  save(logos: Record<string, string>): void {
    this.logos = { ...logos };
  }
}

/**
 * Where saves end up: this browser's storage (`local`), nowhere beyond the page because it is a demo
 * (`demo`), or nowhere because the browser refuses storage (`unavailable`: the page must say so).
 */
export type StoreKind = 'local' | 'demo' | 'unavailable';

export class AdminPlanStore {
  readonly plans: PlanStore;
  readonly logos: LogoStore;
  readonly kind: StoreKind;

  constructor(plans: PlanStore, logos: LogoStore, kind: StoreKind) {
    this.plans = plans;
    this.logos = logos;
    this.kind = kind;
  }

  /** The browser's stored plan (localStorage), or an in-memory copy of it in demo mode. */
  static forPage(demo: boolean): AdminPlanStore {
    const local = new AdminPlanStore(new LocalPlanStore(), new LocalLogoStore(), storageWritable() ? 'local' : 'unavailable');
    if (!demo && local.kind === 'local') return local;
    // Demo pages (and browsers that refuse storage) start from whatever is stored, and never write it.
    return new AdminPlanStore(new MemoryPlanStore(local.load()), new MemoryLogoStore(), demo ? 'demo' : 'unavailable');
  }

  /** The stored plan with its logos, or null. Never throws. */
  load(): GamePlan | null {
    try {
      const plan = this.plans.load();
      return plan ? planFromStorage(plan, this.logos.load()) : null;
    } catch {
      return null;
    }
  }

  /** Store a valid plan. Logos go first: they are the big part, so a full storage shows up there. */
  save(plan: GamePlan): SaveResult {
    const { plan: stored, logos } = planForStorage(plan);
    let logoFailure: SaveResult | null = null;
    try {
      this.logos.save(logos);
    } catch (e) {
      logoFailure = failure(e);
    }
    try {
      // Without its logos, the plan itself is small: keep the other edits even when the logos didn't fit.
      this.plans.save(stored);
    } catch (e) {
      return failure(e);
    }
    return logoFailure ?? { ok: true };
  }

  /** Called with the joined plan when it changes (another tab, or this page's own save). */
  subscribe(listener: (plan: GamePlan | null) => void): () => void {
    return this.plans.subscribe(() => listener(this.load()));
  }
}

function failure(e: unknown): SaveResult {
  if (isQuotaError(e)) return { ok: false, reason: 'quota', detail: '' };
  return { ok: false, reason: 'error', detail: e instanceof Error ? e.message : String(e) };
}
