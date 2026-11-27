<!-- What became of the last command a button sent: not sent (and why), sent, or rejected by the engine. -->
<script lang="ts">
  import type { CommandRecord } from '../logic/command-log.ts';
  import { S } from '../strings.ts';

  let { record }: { record: CommandRecord | null } = $props();

  const text = $derived.by(() => {
    if (!record) return '';
    if (record.status !== 'rejected') return S.command[record.status];
    const reason = (record.reason && S.command.reasons[record.reason]) || record.reason || '';
    return S.command.rejected(record.detail ? `${reason} (${record.detail})` : reason);
  });
</script>

{#if record}
  <p class="command-status" data-status={record.status} role="status">{text}</p>
{/if}

<style>
  @layer app {
  .command-status {
    font-size: var(--text-sm);
    color: var(--color-text-muted);
  }
  .command-status[data-status='rejected'],
  .command-status[data-status='offline'],
  .command-status[data-status='noShow'] {
    color: var(--color-accent);
  }
  }
</style>
