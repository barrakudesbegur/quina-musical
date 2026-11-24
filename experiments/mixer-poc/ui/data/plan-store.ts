// Where the screens get the Game plan. Admin saves it, and the console, projector and phones read it.
// Today this is the browser's localStorage on the show laptop's origin, which is enough for one machine and
// for development. When the cloud backend lands, a cloud store implements the same interface and the
// screens don't change. `?demo=` pages fall back to the sample plan.
import { checkGamePlan, type GamePlan } from '../plan.ts';
import { SAMPLE_PLAN } from '../fixtures/plan.ts';

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

/** The page's plan: the stored one, or the sample plan in demo mode (`?demo=`) when none is stored. */
export function loadPlanForPage(store: PlanStore = new LocalPlanStore(), demo = typeof location !== 'undefined' && new URLSearchParams(location.search).has('demo')): GamePlan | null {
  return store.load() ?? (demo ? SAMPLE_PLAN : null);
}
