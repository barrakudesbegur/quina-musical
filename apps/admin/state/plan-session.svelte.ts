// The plan being edited in Admin. Components edit `draft` directly (bind:value) or through the methods for
// edits that touch several places (reorder rounds, rename a sponsor). The session checks every change, saves
// a valid plan a moment after the last edit, keeps an invalid draft in memory (and warns before leaving the
// page) instead of saving it, and notices when another tab saved a different plan.
// Served from the cloud or the relay, the plan is theirs: the session shows nothing editable and saves nothing
// until it has loaded it (whats-left 7.1: a blank plan once replaced the cloud's), and every save names the
// version it is based on, so the cloud or the relay refuses it if their plan changed since.
import type { GamePlan } from '../../../packages/ui/plan.ts';
import type { PlanVersion } from '../../../packages/ui/data/cloud-plan.ts';
import { CA } from '../../../packages/ui/i18n/ca.ts';
import type { AdminPlanStore, SaveFailure, SaveResult } from '../data/admin-plan-store.ts';
import { checkPlanDraft } from '../logic/plan-check.ts';
import { blankPlan, removeSponsor, renameSponsor } from '../logic/plan-edit.ts';
import type { LoadFailure } from '../logic/status.ts';
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

/** Whether the plan is there to edit: loading it from the cloud or the relay, loaded, or it couldn't be loaded. */
export type LoadPhase = { kind: 'loading' } | { kind: 'ready' } | { kind: 'failed'; failure: LoadFailure };

const json = (plan: GamePlan | null) => JSON.stringify(plan);

export class PlanSession {
  readonly store: AdminPlanStore;
  /** Until 'ready' there is no plan to show or edit, and nothing is saved. */
  phase = $state.raw<LoadPhase>({ kind: 'ready' });
  /** The plan as edited: may be invalid. Meaningless until `phase` is ready. */
  draft = $state<GamePlan>(blankPlan(MANAGE_CONFIG.defaultEdition, CA.gameTitle, DEFAULT_RULES));
  check = $derived(checkPlanDraft($state.snapshot(this.draft)));
  /** The last plan saved (or loaded), as JSON. */
  savedJson = $state<string | null>(null);
  savedPlan = $state.raw<GamePlan | null>(null);
  status = $state.raw<SaveStatus>({ kind: 'saved', atMs: null });
  /** A different plan saved by another tab while this one had unsaved edits. */
  external = $state.raw<GamePlan | null>(null);
  /** A save was refused because the plan changed elsewhere since this page loaded it: no more saves until a reload. */
  stale = $state(false);
  /** The best valid plan right now: the draft when it is valid, else the last saved one; null before it loaded. */
  current = $derived(this.phase.kind !== 'ready' ? null : this.check.ok ? this.check.plan : this.savedPlan);
  errors = $derived(this.check.ok ? [] : this.check.errors);

  /** The outcome of the last save, shown once the draft matches it again. Not reactive on purpose. */
  private settled: SaveStatus = { kind: 'saved', atMs: null };
  private savingJson: string | null = null;
  private pristineJson = '';
  /** The version the draft is based on (the cloud's or the relay's savedAtMs; null: no plan there, or a local store). */
  private base: PlanVersion = null;
  /** The version of `external`. */
  private externalBase: PlanVersion = null;

  constructor(store: AdminPlanStore, fallback: GamePlan | null) {
    this.store = store;
    this.settled = store.kind === 'demo' ? { kind: 'demo' } : store.kind === 'unavailable' ? { kind: 'unavailable' } : { kind: 'saved', atMs: null };
    this.status = this.settled;
    // The cloud's and the relay's plan comes in `start()`; this browser's storage is here already.
    if (store.remote) this.phase = { kind: 'loading' };
    else this.adopt(store.load() ?? fallback, null);
  }

  /** Start loading (cloud, relay), autosaving and listening for other tabs and pushes. Returns the cleanup. */
  start(): () => void {
    const stopEffects = $effect.root(() => {
      $effect(() => {
        // Nothing to save before the plan loaded, after a refused stale save, or while another device's plan waits
        // for the person to pick (resolveConflict).
        if (this.phase.kind !== 'ready' || this.stale || this.external) return;
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
    const unsubscribe = this.store.subscribe((plan, version) => this.onStored(plan, version));
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (this.hasUnsavedEdits()) e.preventDefault();
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    void this.load();
    return () => {
      stopEffects();
      unsubscribe();
      window.removeEventListener('beforeunload', onBeforeUnload);
    };
  }

  /**
   * Load the plan from the cloud or the relay (again, after a failure: the retry). A push that arrives first, or an
   * answer that arrives after the timeout, loads it just the same (onStored).
   */
  async load(): Promise<void> {
    if (!this.store.remote || this.phase.kind === 'ready') return;
    this.phase = { kind: 'loading' };
    let timer: ReturnType<typeof setTimeout> | undefined;
    const timeout = new Promise<'timeout'>((resolve) => {
      timer = setTimeout(() => resolve('timeout'), MANAGE_CONFIG.planLoadTimeoutMs);
    });
    const got = await Promise.race([this.store.loadRemote(), timeout]);
    clearTimeout(timer);
    // A push (or this answer, through the store's subscribers) may have loaded it meanwhile.
    if (this.isReady()) return;
    if (got === 'timeout') this.phase = { kind: 'failed', failure: { cause: 'timeout', seconds: MANAGE_CONFIG.planLoadTimeoutMs / 1000 } };
    else if (got.ok) this.adopt(got.plan, got.savedAtMs);
    else this.phase = { kind: 'failed', failure: { cause: 'answer', detail: got.detail } };
  }

  private isReady(): boolean {
    return this.phase.kind === 'ready';
  }

  /**
   * The plan as loaded becomes the draft. With no plan anywhere yet, a blank one, which counts as saved: it is only
   * sent once someone edits it.
   */
  private adopt(plan: GamePlan | null, version: PlanVersion): void {
    const initial = plan ?? blankPlan(MANAGE_CONFIG.defaultEdition, CA.gameTitle, DEFAULT_RULES);
    this.draft = structuredClone(initial);
    this.savedPlan = plan;
    // As the autosave compares it: the checked draft (a blank plan gains its defaults there).
    const checked = checkPlanDraft(initial);
    this.savedJson = json(checked.ok ? checked.plan : initial);
    this.base = version;
    this.pristineJson = JSON.stringify($state.snapshot(this.draft));
    this.phase = { kind: 'ready' };
  }

  /** Edits that would be lost on leaving: an edited invalid draft, or a valid one not saved yet. */
  hasUnsavedEdits(): boolean {
    if (this.store.kind === 'demo' || this.phase.kind !== 'ready') return false;
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
    // Their plan is the one there now: whichever wins, saves are based on it again (a refused stale save included).
    this.base = this.externalBase;
    this.stale = false;
    if (choice === 'theirs') {
      this.draft = structuredClone(theirs);
      this.savedPlan = theirs;
      this.savedJson = json(theirs);
      this.settled = { kind: 'saved', atMs: null };
    } else {
      // Pretend theirs is what was saved (and based on): the draft now differs from it and autosave writes it.
      this.savedJson = json(theirs);
    }
  }

  private persist(plan: GamePlan, planJson: string): void {
    if (this.store.kind === 'unavailable') {
      this.status = this.settled = { kind: 'unavailable' };
      return;
    }
    this.savingJson = planJson;
    const outcome = this.store.save(plan, this.base);
    if (outcome instanceof Promise) {
      // The cloud: the status stays 'pending' until it answers.
      void outcome.then((result) => this.finishSave(plan, planJson, result));
    } else {
      this.finishSave(plan, planJson, outcome);
    }
  }

  private finishSave(plan: GamePlan, planJson: string, result: SaveResult): void {
    this.savingJson = null;
    if (!result.ok) {
      // Keep the draft and say why; the next edit tries again, unless the plan changed elsewhere (reload).
      this.status = this.settled = { kind: 'failed', reason: result.reason, detail: result.detail };
      if (result.reason === 'stale') this.stale = true;
      return;
    }
    if (result.savedAtMs !== undefined) this.base = result.savedAtMs;
    this.settled = this.store.kind === 'demo' ? { kind: 'demo' } : { kind: 'saved', atMs: Date.now() };
    // The store may have kept a different plan (the cloud turns inline logos into media paths): adopt it,
    // unless the draft moved on meanwhile.
    const saved = result.saved ?? plan;
    const savedJson = json(saved);
    if (saved !== plan && this.check.ok && json(this.check.plan) === planJson) this.draft = structuredClone(saved);
    this.savedPlan = saved;
    this.savedJson = savedJson;
    this.pristineJson = JSON.stringify($state.snapshot(this.draft));
  }

  /** The store changed: the plan loading, this page's own save (ignored), or another tab's or device's. */
  private onStored(plan: GamePlan | null, version: PlanVersion): void {
    if (this.phase.kind !== 'ready') return this.adopt(plan, version);
    if (!plan) return;
    const theirs = json(plan);
    if (theirs === this.savingJson) return;
    if (theirs === this.savedJson) {
      // The same plan under a newer version (the link wrote it again): later saves are based on that.
      this.base = version;
      return;
    }
    const check = this.check;
    const clean = check.ok && json(check.plan) === this.savedJson;
    // Nothing edited since the page opened (for example the cloud's first answer): just take it.
    const untouched = JSON.stringify($state.snapshot(this.draft)) === this.pristineJson;
    if (clean || untouched) {
      this.draft = structuredClone(plan);
      this.savedPlan = plan;
      this.savedJson = theirs;
      this.base = version;
      this.settled = { kind: 'saved', atMs: null };
      this.pristineJson = JSON.stringify($state.snapshot(this.draft));
    } else {
      this.external = plan;
      this.externalBase = version;
    }
  }
}
