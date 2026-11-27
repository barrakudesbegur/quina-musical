<!--
  The Celebration's music: a suggested default the presenters can change without blocking anything. During
  the Check the pick is kept for the Celebration that may follow (`state.celebrationChoice`; a failed Check
  drops it); during the Celebration it switches the music live.
-->
<script lang="ts">
  import type { CelebrationMusic, WinKind } from '../../../packages/ui/flow.ts';
  import { getConsole } from '../context.ts';
  import { S } from '../strings.ts';
  import Icon from './Icon.svelte';
  import SegmentedControl from '../../../packages/ui/components/SegmentedControl.svelte';

  /** `current`: the engine's choice (the Celebration's music, or the Check's kept pick), else null (the suggestion shows). */
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
  <SegmentedControl
    labelledby="{uid}-title"
    weights={[1.5, 1, 1]}
    options={CHOICES.map((choice) => ({ id: choice, label: S.celebration.choices[choice], note: choice === suggested ? S.celebration.suggested : null }))}
    value={selected}
    disabled={!enabled}
    onchange={(choice) => model.act('celebrationMusic', { choice })}
  />
  {#if model.show.flow.scene === 'check'}<p class="note">{S.celebration.musicForLater}</p>{/if}
</section>
