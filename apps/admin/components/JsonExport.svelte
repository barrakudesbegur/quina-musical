<!-- Export the current valid plan as JSON (the import's own format): download it or copy it. The text is
     also shown, so it can be copied by hand where the clipboard is refused. -->
<script lang="ts">
  import type { PlanSession } from '../state/plan-session.svelte.ts';
  import { exportFileName, toJson } from '../logic/exports.ts';
  import { copyText, downloadText } from '../data/files.ts';
  import { S } from '../strings.ts';

  let { session }: { session: PlanSession } = $props();

  const plan = $derived(session.current);
  const text = $derived(plan ? toJson(plan) : '');
  let copied = $state<boolean | null>(null);

  async function copy() {
    copied = await copyText(text);
  }
</script>

<section class="panel surface json-export" aria-labelledby="export-title">
  <h2 class="panel__title" id="export-title">{S.json.exportTitle}</h2>
  <p class="panel__help">{S.json.exportHelp}</p>
  {#if !plan}
    <p class="notice notice--warn">{S.json.noPlan}</p>
  {:else}
    {#if !session.check.ok}<p class="notice notice--warn">{S.json.exportStale}</p>{/if}
    <div class="panel__actions">
      <button type="button" data-color="orange" onclick={() => downloadText(exportFileName(plan.edition, 'pla', Date.now()), text)}>{S.json.download}</button>
      <button type="button" onclick={copy}>{S.json.copy}</button>
      <span role="status" class="panel__help">
        {#if copied === true}{S.json.copied}{:else if copied === false}{S.json.copyFailed}{/if}
      </span>
    </div>
    <details class="json-export__details" open={copied === false}>
      <summary>{S.json.preview}</summary>
      <label class="field">
        <span class="visually-hidden">{S.json.preview}</span>
        <textarea class="json-export__text" rows="12" readonly value={text} onfocus={(e) => e.currentTarget.select()}></textarea>
      </label>
    </details>
  {/if}
</section>

<style>
  .json-export__text {
    font-family: var(--font-mono, monospace);
    font-size: var(--text-xs);
  }
</style>
