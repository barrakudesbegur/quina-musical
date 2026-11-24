<!-- The technical pause ("Tornem de seguida"), over whatever scene is underneath. -->
<script lang="ts">
  import { formatCountdown } from '../../ui/rules/time.ts';
  import { getConsole } from '../context.ts';
  import { elapsedSec } from '../logic/countdown.ts';
  import { S } from '../strings.ts';
  import Icon from './Icon.svelte';

  const model = getConsole();
  const pause = $derived(model.show.flow.pause);
</script>

{#if pause}
  <section class="panel pause-panel" role="status" aria-labelledby="pause-title">
    <h2 class="panel__title" id="pause-title"><Icon name="pause" /> {S.pause.title}</h2>
    <p>{S.pause.since(formatCountdown(elapsedSec(pause.sinceMs, model.show.now)))}</p>
    <p class="pause-panel__note">{S.pause.note}</p>
    <button type="button" class="action tone-primary" data-anim="press" disabled={!model.can('pause')} onclick={() => model.act('pause', { on: false })}>
      <Icon name="play" /><span>{S.pause.end}</span>
    </button>
  </section>
{/if}
