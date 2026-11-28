<!-- Connection to the cloud or the show's laptop, and whether the plan is saved (words: logic/status.ts). -->
<script lang="ts">
  import type { ShowStore } from '../../../packages/ui/client/show.svelte.ts';
  import { formatClock } from '../../../packages/rules/time.ts';
  import type { PlanSession } from '../state/plan-session.svelte.ts';
  import { connBadge, saveBadge } from '../logic/status.ts';

  let { show, session }: { show: ShowStore; session: PlanSession } = $props();

  /** Once connected, a lost connection reads as "no connection", not "connecting". */
  let wasConnected = $state(false);
  $effect(() => {
    if (show.connected) wasConnected = true;
  });

  const conn = $derived(
    connBadge({ demo: show.demo, connected: show.connected, wasConnected, showOnline: show.showOnline, where: session.store.kind }),
  );
  const save = $derived(
    saveBadge({ phase: session.phase.kind, status: session.status, where: session.store.kind, hasSavedPlan: session.savedPlan !== null, clock: formatClock }),
  );
</script>

<div class="status-bar" role="status" aria-live="polite">
  <span class="badge status-bar__conn" data-status={conn.status}>{conn.text}</span>
  <span class="badge status-bar__save" data-status={save.status}>{save.text}</span>
</div>

<style>
  @layer app {
  .status-bar {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-2);
  }
  }
</style>
