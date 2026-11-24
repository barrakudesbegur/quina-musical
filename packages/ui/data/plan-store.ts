// Where the screens get the Game plan. Admin saves it, and the console, projector and phones read it. Every
// source implements one PlanStore interface; `planStoreForPage()` picks it from where the page is served:
// - the cloud's /api/plan on the cloud hostname;
// - the cloud link's /cloud/plan.json on the show laptop, falling back to this browser's localStorage;
// - localStorage plus the sample plan in demo mode (`?demo=`).
import { checkGamePlan, type GamePlan } from '../plan.ts';
import { SAMPLE_PLAN } from '../fixtures/plan.ts';
import { CloudPlanStore } from './cloud-plan.ts';
import { isLocalHost } from '../client/endpoints.ts';

export interface PlanStore {
  load(): GamePlan | null;
  save(plan: GamePlan): void;
  /** Called with the new plan whenever it changes (also from another tab). Returns an unsubscribe function. */
  subscribe(listener: (plan: GamePlan | null) => void): () => void;
}

export const PLAN_STORAGE_KEY = 'quina.plan.v1';

function safeStorage(): Storage | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null;
  }
}

/** The plan in this browser's localStorage. An invalid stored plan reads as null, never throws. */
export class LocalPlanStore implements PlanStore {
  private readonly listeners = new Set<(plan: GamePlan | null) => void>();

  load(): GamePlan | null {
    const raw = safeStorage()?.getItem(PLAN_STORAGE_KEY);
    if (!raw) return null;
    try {
      const check = checkGamePlan(JSON.parse(raw));
      return check.ok ? check.plan : null;
    } catch {
      return null;
    }
  }

  save(plan: GamePlan): void {
    safeStorage()?.setItem(PLAN_STORAGE_KEY, JSON.stringify(plan));
    for (const l of this.listeners) l(plan);
  }

  subscribe(listener: (plan: GamePlan | null) => void): () => void {
    this.listeners.add(listener);
    const onStorage = (e: StorageEvent) => {
      if (e.key === PLAN_STORAGE_KEY) listener(this.load());
    };
    if (typeof window !== 'undefined') window.addEventListener('storage', onStorage);
    return () => {
      this.listeners.delete(listener);
      if (typeof window !== 'undefined') window.removeEventListener('storage', onStorage);
    };
  }
}

/**
 * The plan on the show laptop: the cloud link writes the cloud's plan to `/cloud/plan.json` (served read-only
 * by the relay), and it wins over this browser's stored copy, which stays the offline fallback. It refreshes
 * on demand (`refresh()`), and the page calls that at start and when it regains focus.
 */
export class LaptopPlanStore implements PlanStore {
  private laptop: GamePlan | null = null;
  private laptopJson: string | null = null;
  private readonly local: PlanStore;
  private readonly fetchImpl: (url: string) => Promise<{ ok: boolean; json(): Promise<unknown> }>;
  private readonly listeners = new Set<(plan: GamePlan | null) => void>();

  constructor(fetchImpl: (url: string) => Promise<{ ok: boolean; json(): Promise<unknown> }>, local: PlanStore = new LocalPlanStore()) {
    this.fetchImpl = fetchImpl;
    this.local = local;
  }

  load(): GamePlan | null {
    return this.laptop ?? this.local.load();
  }

  /** Saving stays local (Admin on the laptop's network): the cloud's copy comes back through the link. */
  save(plan: GamePlan): void {
    this.local.save(plan);
  }

  subscribe(listener: (plan: GamePlan | null) => void): () => void {
    this.listeners.add(listener);
    const unsubscribeLocal = this.local.subscribe(() => listener(this.load()));
    return () => {
      this.listeners.delete(listener);
      unsubscribeLocal();
    };
  }

  /** Fetch `/cloud/plan.json`; subscribers hear about it when it changed. Never throws. */
  async refresh(): Promise<GamePlan | null> {
    try {
      const res = await this.fetchImpl('/cloud/plan.json');
      if (!res.ok) return this.load();
      const check = checkGamePlan(await res.json());
      const plan = check.ok ? check.plan : null;
      const json = JSON.stringify(plan);
      if (json !== this.laptopJson) {
        this.laptopJson = json;
        this.laptop = plan;
        for (const l of this.listeners) l(this.load());
      }
    } catch {
      // No link folder (no cloud link running) or offline: the stored copy stands.
    }
    return this.load();
  }
}

/**
 * The plan source for a screen, by where the page is served from:
 * - **Demo:** local storage, with the sample plan as fallback.
 * - **The laptop or its network:** `/cloud/plan.json` first, then local storage.
 * - **The cloud hostname:** `/api/plan`.
 * The laptop and cloud stores refresh now and whenever the page regains focus.
 */
export function planStoreForPage(): PlanStore {
  const demo = typeof location !== 'undefined' && new URLSearchParams(location.search).has('demo');
  if (demo || typeof location === 'undefined' || typeof fetch === 'undefined') return new LocalPlanStore();
  const noStore = (url: string, init?: RequestInit) => fetch(url, { cache: 'no-store', credentials: 'same-origin', ...init });
  const store = isLocalHost(location.hostname) ? new LaptopPlanStore((url) => noStore(url)) : new CloudPlanStore((url, init) => noStore(url, init));
  void store.refresh();
  if (typeof window !== 'undefined') window.addEventListener('focus', () => void store.refresh());
  return store;
}

/** The page's plan: the stored one, or the sample plan in demo mode (`?demo=`) when none is stored. */
export function loadPlanForPage(store: PlanStore = new LocalPlanStore(), demo = typeof location !== 'undefined' && new URLSearchParams(location.search).has('demo')): GamePlan | null {
  return store.load() ?? (demo ? SAMPLE_PLAN : null);
}
