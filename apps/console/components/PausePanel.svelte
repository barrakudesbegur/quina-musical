<!-- The technical pause ("Tornem de seguida"), over whatever scene is underneath. -->
<script lang="ts">
  import { formatCountdown } from '../../../packages/rules/time.ts';
  import { getConsole } from '../context.ts';
  import { elapsedSec } from '../logic/countdown.ts';
  import { S } from '../strings.ts';
  import Icon from './Icon.svelte';
  import WiiBadge from './WiiBadge.svelte';

  const model = getConsole();
  const pause = $derived(model.show.flow.pause);
  const isDefault = $derived(model.defaultAction?.control === 'endPause');
</script>

{#if pause}
  <section class="panel pause-panel" role="status" aria-labelledby="pause-title">
    <h2 class="panel__title" id="pause-title"><Icon name="pause" /> {S.pause.title}</h2>
    <p>{S.pause.since(formatCountdown(elapsedSec(pause.sinceMs, model.show.now)))}</p>
    <p class="pause-panel__note">{S.pause.note}</p>
    <button type="button" class="action" data-color="orange" data-anim="press" data-default={isDefault || undefined} data-ring={isDefault ? 'orange' : undefined} disabled={!model.can('pause')} onclick={() => model.act('pause', { on: false })}>
      <Icon name="play" /><span>{S.pause.end}</span>
      {#if isDefault}<WiiBadge button="a" size="sm" />{/if}
    </button>
  </section>
{/if}
