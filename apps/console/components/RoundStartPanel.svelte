<!--
  Round start: the round's prizes to announce, then "Barreja" (the Shuffle). The Shuffle's round is the one
  introduced (`newRound` with no fields); once it is drawn, Next plays the first song after the animation.
-->
<script lang="ts">
  import { getConsole } from '../context.ts';
  import { shuffleCountdown } from '../logic/countdown.ts';
  import { roundAt } from '../../../packages/ui/plan.ts';
  import { S } from '../strings.ts';
  import Icon from './Icon.svelte';
  import PrizeList from './PrizeList.svelte';
  import WiiBadge from './WiiBadge.svelte';

  const model = getConsole();
  const uid = $props.id();
  const flow = $derived(model.show.flow);
  const round = $derived(flow.intro?.round ?? flow.shuffle?.round ?? model.show.state?.round.number ?? 1);
  // The intro's kind when the plan lacks the round.
  const name = $derived(S.round(roundAt(model.plan, round, flow.intro?.round === round ? flow.intro.kind : undefined), model.plan));
  const shuffling = $derived(shuffleCountdown(flow.shuffle, model.show.now));
  const isDefault = $derived(model.defaultAction?.control === 'shuffle');
</script>

<section class="panel round-start" data-state={model.scene.introduced ? 'introduced' : shuffling ? 'shuffling' : 'shuffled'} aria-labelledby="{uid}-title">
  <h2 class="panel__title" id="{uid}-title">{name}</h2>
  <h3 class="panel__subtitle">{S.roundStart.announce}</h3>
  <PrizeList {round} />

  {#if model.scene.introduced}
    <button type="button" class="action action--big tone-primary" data-anim="press" data-default={isDefault || undefined} disabled={!model.can('newRound')} onclick={() => model.act('newRound')}>
      <Icon name="shuffle" /><span>{S.roundStart.shuffle}</span>
      {#if isDefault}<WiiBadge button="a" />{/if}
    </button>
    <p class="note">{S.roundStart.shuffleNote}</p>
  {:else if shuffling}
    <p class="round-start__shuffling" role="timer">{S.roundStart.shuffling(shuffling.secondsLeft)}</p>
  {:else}
    <p class="note">{S.roundStart.shuffled}</p>
  {/if}
</section>
