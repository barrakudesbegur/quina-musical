<!-- Before the night: when it starts, the first round's prizes, how to start, and the setup checklist. -->
<script lang="ts">
  import { formatClock } from '../../../packages/rules/time.ts';
  import { getConsole } from '../context.ts';
  import { CA, S } from '../strings.ts';
  import PrizeList from './PrizeList.svelte';
  import SetupChecklist from './SetupChecklist.svelte';

  const model = getConsole();
  const uid = $props.id();
  const startAt = $derived(model.plan?.schedule.startAtMs ?? null);
</script>

<section class="panel before-panel" aria-labelledby="{uid}-title">
  <h2 class="panel__title" id="{uid}-title">{S.before.title}</h2>
  {#if startAt}<p>{S.before.startAt(formatClock(startAt))}</p>{/if}
  <p class="note">{S.before.howToStart}</p>
  <h3 class="panel__subtitle">{CA.round(1)}</h3>
  <PrizeList round={1} />
  <SetupChecklist />
</section>
