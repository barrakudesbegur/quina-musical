<!-- Connection to the relay and the show, and whether the plan is saved. -->
<script lang="ts">
  import type { ShowStore } from '../../../packages/ui/client/show.svelte.ts';
  import { formatClock } from '../../../packages/rules/time.ts';
  import type { PlanSession } from '../state/plan-session.svelte.ts';
  import { S } from '../strings.ts';

  let { show, session }: { show: ShowStore; session: PlanSession } = $props();

  /** Once connected, a lost connection reads as "no connection", not "connecting". */
  let wasConnected = $state(false);
  $effect(() => {
    if (show.connected) wasConnected = true;
  });

  const conn = $derived.by((): { text: string; status: 'ok' | 'warn' | 'error' | 'calm' } => {
    if (show.demo) return { text: S.conn.demo(show.demo), status: 'calm' };
    if (!show.connected) return { text: wasConnected ? S.conn.offline : S.conn.connecting, status: 'error' };
    if (!show.showOnline) return { text: S.conn.noShow, status: 'warn' };
    return { text: S.conn.online, status: 'ok' };
  });

  const save = $derived.by((): { text: string; status: 'ok' | 'warn' | 'error' | 'calm' } => {
    const s = session.status;
    switch (s.kind) {
      case 'saved':
        return { text: s.atMs ? S.save.saved(formatClock(s.atMs)) : S.save.loaded, status: 'ok' };
      case 'pending':
        return { text: S.save.pending, status: 'calm' };
      case 'invalid':
        return { text: S.save.invalid(s.count), status: 'warn' };
      case 'failed':
        return { text: s.reason === 'quota' ? S.save.quota : S.save.error(s.detail), status: 'error' };
      case 'demo':
        return { text: S.save.demo, status: 'calm' };
      case 'unavailable':
        return { text: S.save.unavailable, status: 'error' };
    }
  });
</script>

<div class="status-bar" role="status" aria-live="polite">
  <span class="badge status-bar__conn" data-status={conn.status}>{conn.text}</span>
  <span class="badge status-bar__save" data-status={save.status}>{save.text}</span>
</div>

<style>
  .status-bar {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-2);
  }
</style>
