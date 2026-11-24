<!--
  The Celebration's music: a suggested default the presenters can change without blocking anything. The
  engine takes the change only once the Celebration has started; before that it shows what will play.
-->
<script lang="ts">
  import type { CelebrationMusic, WinKind } from '../../ui/flow.ts';
  import { getConsole } from '../context.ts';
  import { S } from '../strings.ts';
  import Icon from './Icon.svelte';

  /** `current`: the engine's choice during the Celebration, else null (the suggestion for `kind` shows). */
  let { kind, current }: { kind: WinKind; current: CelebrationMusic | null } = $props();

  const model = getConsole();
  const uid = $props.id();
  const CHOICES: readonly CelebrationMusic[] = ['winningSong', 'victory', 'holdMusic'];
  const suggested = $derived<CelebrationMusic>(kind === 'line' ? 'winningSong' : 'victory');
  const selected = $derived(current ?? suggested);
  const enabled = $derived(model.can('celebrationMusic'));
</script>

<section class="celebration-music" aria-labelledby="{uid}-title">
  <h3 class="panel__subtitle" id="{uid}-title"><Icon name="music" /> {S.celebration.music}</h3>
  <div class="choice-group" role="group" aria-labelledby="{uid}-title">
    {#each CHOICES as choice (choice)}
      <button type="button" class="choice" data-anim="press" aria-pressed={selected === choice} disabled={!enabled} onclick={() => model.act('celebrationMusic', { choice })}>
        {S.celebration.choices[choice]}{#if choice === suggested}<span class="choice__note"> · {S.celebration.suggested}</span>{/if}
      </button>
    {/each}
  </div>
  {#if !enabled && model.show.flow.scene === 'check'}<p class="note">{S.celebration.musicInCelebration}</p>{/if}
</section>
