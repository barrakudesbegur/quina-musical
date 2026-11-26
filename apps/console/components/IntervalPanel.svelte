<!--
  The Interval: the next round and its prizes to announce, and the guide countdown (rounds always start by hand). The
  round starts from the cluster's big «Comença la quina» (ThumbCluster, D195); the Interval music has its own panel at
  the column's top (IntervalMusic, D196).
-->
<script lang="ts">
  import { formatCountdown } from '../../../packages/rules/time.ts';
  import { getConsole } from '../context.ts';
  import { guideCountdown } from '../logic/countdown.ts';
  import { roundAt } from '../../../packages/ui/plan.ts';
  import { S } from '../strings.ts';
  import Icon from './Icon.svelte';
  import PrizeList from './PrizeList.svelte';

  const model = getConsole();
  const uid = $props.id();
  const interval = $derived(model.show.flow.interval);
  // The engine's round count (what the total counts is pending U163).
  const total = $derived(model.show.state?.game.roundsTotal ?? 0);
  const guide = $derived(guideCountdown(interval, model.show.now));
</script>

{#if interval}
  <section class="panel interval-panel" aria-labelledby="{uid}-title">
    <h2 class="panel__title" id="{uid}-title">{S.interval.title}</h2>
    <p class="interval-panel__next">{S.roundOf(roundAt(model.plan, interval.nextRound), model.plan, total)}</p>

    {#if guide}
      <p class="interval-panel__guide" data-state={guide.done ? 'over' : 'running'}>
        <Icon name="clock" />
        <span>{S.interval.guide}:</span>
        <strong role="timer">{guide.done ? S.interval.over(formatCountdown(guide.overSec)) : formatCountdown(guide.secondsLeft)}</strong>
      </p>
    {/if}

    <h3 class="panel__subtitle">{S.roundStart.announce}</h3>
    <PrizeList round={interval.nextRound} />
  </section>
{/if}
