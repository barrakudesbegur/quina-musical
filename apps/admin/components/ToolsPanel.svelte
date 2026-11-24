<!-- Tools: the hook audition page, the full JSON export (plan + the night's data, PRIVATE), and the Shuffle
     seeds (a stub until Admin can read the Game journal). -->
<script lang="ts">
  import type { ShowStore } from '../../ui/client/show.svelte.ts';
  import type { PlanSession } from '../state/plan-session.svelte.ts';
  import { exportFileName, fullExport, toJson } from '../logic/exports.ts';
  import { downloadText } from '../data/files.ts';
  import { MANAGE_CONFIG } from '../config.ts';
  import { S } from '../strings.ts';

  let { show, session }: { show: ShowStore; session: PlanSession } = $props();

  function downloadFull() {
    const plan = session.current;
    if (!plan) return;
    const now = Date.now();
    const data = fullExport(plan, show.state?.cards ?? null, show.state ? show.flow.winners : null, now);
    downloadText(exportFileName(plan.edition, 'complet', now), toJson(data));
  }
</script>

<section class="panel surface tools-audition" aria-labelledby="audition-title">
  <h2 class="panel__title" id="audition-title">{S.tools.auditionTitle}</h2>
  <p class="panel__help">{S.tools.auditionHelp}</p>
  <p><a href={MANAGE_CONFIG.auditionUrl} target="_blank" rel="noopener">{S.tools.auditionLink}</a></p>
</section>

<section class="panel surface tools-export" aria-labelledby="full-export-title">
  <h2 class="panel__title" id="full-export-title">{S.tools.fullExportTitle}</h2>
  <p class="panel__help">{S.tools.fullExportHelp}</p>
  <p class="notice notice--private">{S.tools.fullExportWarning}</p>
  {#if !show.state}<p class="notice notice--warn">{S.tools.fullExportNoShow}</p>{/if}
  {#if !session.current}<p class="notice notice--warn">{S.json.noPlan}</p>{/if}
  <div class="panel__actions">
    <button type="button" onclick={downloadFull} disabled={!session.current}>{S.tools.download}</button>
  </div>
</section>

<section class="panel surface tools-seeds" aria-labelledby="seeds-title">
  <h2 class="panel__title" id="seeds-title">{S.tools.seedsTitle}</h2>
  <p class="notice notice--pending">{S.tools.seedsPending}</p>
</section>
