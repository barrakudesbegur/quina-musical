// The plan being edited in Admin. Components edit `draft` directly (bind:value) or through the methods for
// edits that touch several places (reorder rounds, rename a sponsor). The session checks every change, saves
// a valid plan a moment after the last edit, keeps an invalid draft in memory (and warns before leaving the
// page) instead of saving it, and notices when another tab saved a different plan.
import type { GamePlan } from '../../ui/plan.ts';
import { CA } from '../../ui/i18n/ca.ts';
import type { AdminPlanStore, SaveFailure } from '../data/admin-plan-store.ts';
import { checkPlanDraft } from '../logic/plan-check.ts';
import { blankPlan, removeSponsor, renameSponsor } from '../logic/plan-edit.ts';
import { MANAGE_CONFIG } from '../config.ts';
import { DEFAULT_RULES } from '../strings.ts';

export type SaveStatus =
  /** `atMs` null: as loaded, nothing saved from this page yet. */
  | { kind: 'saved'; atMs: number | null }
  | { kind: 'pending' }
  | { kind: 'invalid'; count: number }
  | { kind: 'failed'; reason: SaveFailure; detail: string }
  | { kind: 'demo' }
  | { kind: 'unavailable' };

const json = (plan: GamePlan | null) => JSON.stringify(plan);

export class PlanSession {
  readonly store: AdminPlanStore;
  /** The plan as edited: may be invalid. */
  draft = $state<GamePlan>(blankPlan(MANAGE_CONFIG.defaultEdition, CA.gameTitle, DEFAULT_RULES));
  check = $derived(checkPlanDraft($state.snapshot(this.draft)));
  /** The last plan saved (or loaded), as JSON. */
  savedJson = $state<string | null>(null);
  savedPlan = $state.raw<GamePlan | null>(null);
  status = $state.raw<SaveStatus>({ kind: 'saved', atMs: null });
  /** A different plan saved by another tab while this one had unsaved edits. */
  external = $state.raw<GamePlan | null>(null);
  /** The best valid plan right now: the draft when it is valid, else the last saved one. */
  current = $derived(this.check.ok ? this.check.plan : this.savedPlan);
  errors = $derived(this.check.ok ? [] : this.check.errors);

  /** The outcome of the last save, shown once the draft matches it again. Not reactive on purpose. */
  private settled: SaveStatus = { kind: 'saved', atMs: null };
  private savingJson: string | null = null;
  private pristineJson: string;

  constructor(store: AdminPlanStore, fallback: GamePlan | null) {
    this.store = store;
    const stored = store.load();
    const initial = stored ?? fallback;
    if (initial) {
      this.draft = structuredClone(initial);
      this.savedJson = json(initial);
      this.savedPlan = initial;
    }
    this.settled = store.kind === 'demo' ? { kind: 'demo' } : store.kind === 'unavailable' ? { kind: 'unavailable' } : { kind: 'saved', atMs: null };
    this.status = this.settled;
    this.pristineJson = JSON.stringify($state.snapshot(this.draft));
  }

  /** Start autosaving and listening for other tabs. Returns the cleanup. */
  start(): () => void {
    const stopEffects = $effect.root(() => {
      $effect(() => {
        const check = this.check;
        if (!check.ok) {
          this.status = { kind: 'invalid', count: check.errors.length };
          return;
        }
        const next = json(check.plan);
        if (next === this.savedJson) {
          this.status = this.settled;
          return;
        }
        this.status = { kind: 'pending' };
        const timer = setTimeout(() => this.persist(check.plan, next), MANAGE_CONFIG.autosaveDelayMs);
        return () => clearTimeout(timer);
      });
    });
    const unsubscribe = this.store.subscribe((plan) => this.onStored(plan));
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (this.hasUnsavedEdits()) e.preventDefault();
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => {
      stopEffects();
      unsubscribe();
      window.removeEventListener('beforeunload', onBeforeUnload);
    };
  }

  /** Edits that would be lost on leaving: an edited invalid draft, or a valid one not saved yet. */
  hasUnsavedEdits(): boolean {
    if (this.store.kind === 'demo') return false;
    const check = this.check;
    if (!check.ok) return JSON.stringify($state.snapshot(this.draft)) !== this.pristineJson;
    return json(check.plan) !== this.savedJson || this.status.kind === 'failed' || this.store.kind === 'unavailable';
  }

  /** Replace the whole draft (an import). It saves like any edit. */
  replace(plan: GamePlan): void {
    this.draft = structuredClone(plan);
  }

  /** Apply a pure edit to the whole plan (reorder rounds, add a sponsor…). */
  update(edit: (plan: GamePlan) => GamePlan): void {
    this.draft = edit($state.snapshot(this.draft));
  }

  renameSponsor(oldId: string, newId: string): void {
    this.update((p) => renameSponsor(p, oldId, newId));
  }

  /** Remove a sponsor; its prizes keep their titles. Returns how many prizes lost their sponsor. */
  removeSponsor(id: string): number {
    let cleared = 0;
    this.update((p) => {
      const r = removeSponsor(p, id);
      cleared = r.cleared;
      return r.plan;
    });
    return cleared;
  }

  /** The other tab's plan wins, or this page's draft does (it is then saved over it). */
  resolveConflict(choice: 'theirs' | 'mine'): void {
    const theirs = this.external;
    if (!theirs) return;
    this.external = null;
    if (choice === 'theirs') {
      this.draft = structuredClone(theirs);
      this.savedPlan = theirs;
      this.savedJson = json(theirs);
      this.settled = { kind: 'saved', atMs: null };
    } else {
      // Pretend theirs is what was saved: the draft now differs from it and autosave writes it.
      this.savedJson = json(theirs);
    }
  }

  private persist(plan: GamePlan, planJson: string): void {
    if (this.store.kind === 'unavailable') {
      this.status = this.settled = { kind: 'unavailable' };
      return;
    }
    this.savingJson = planJson;
    const result = this.store.save(plan);
    this.savingJson = null;
    if (!result.ok) {
      // Keep the draft and say why; the next edit tries again.
      this.status = this.settled = { kind: 'failed', reason: result.reason, detail: result.detail };
      return;
    }
    this.settled = this.store.kind === 'demo' ? { kind: 'demo' } : { kind: 'saved', atMs: Date.now() };
    this.savedPlan = plan;
    this.savedJson = planJson;
    this.pristineJson = JSON.stringify($state.snapshot(this.draft));
  }

  /** The store changed: this page's own save (ignored), or another tab's. */
  private onStored(plan: GamePlan | null): void {
    if (!plan) return;
    const theirs = json(plan);
    if (theirs === this.savingJson || theirs === this.savedJson) return;
    const check = this.check;
    const clean = check.ok && json(check.plan) === this.savedJson;
    if (clean) {
      this.draft = structuredClone(plan);
      this.savedPlan = plan;
      this.savedJson = theirs;
      this.settled = { kind: 'saved', atMs: null };
    } else {
      this.external = plan;
    }
  }
}
