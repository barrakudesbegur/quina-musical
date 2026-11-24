<!--
  The Interval: the next round and its prizes to announce, the guide countdown (rounds always start by
  hand), the Interval music (no protocol yet), and Start round.
-->
<script lang="ts">
  import { formatCountdown } from '../../ui/rules/time.ts';
  import { getConsole } from '../context.ts';
  import { guideCountdown } from '../logic/countdown.ts';
  import { roundPrizes } from '../logic/show-data.ts';
  import { S } from '../strings.ts';
  import Icon from './Icon.svelte';
  import PrizeList from './PrizeList.svelte';

  const model = getConsole();
  const uid = $props.id();
  const interval = $derived(model.show.flow.interval);
  const total = $derived(model.show.state?.game.roundsTotal ?? 0);
  const guide = $derived(guideCountdown(interval, model.show.now));
  const planned = $derived(interval ? roundPrizes(model.plan, interval.nextRound) : null);

  function start(): void {
    if (!interval) return;
    model.act('roundIntro', planned?.status === 'ok' ? { number: interval.nextRound, kind: planned.prizes.kind } : { number: interval.nextRound });
  }
</script>

{#if interval}
  <section class="panel interval-panel" aria-labelledby="{uid}-title">
    <h2 class="panel__title" id="{uid}-title">{S.interval.title}</h2>
    <p class="interval-panel__next">{S.interval.next(interval.nextRound, total)}</p>

    {#if guide}
      <p class="interval-panel__guide" data-state={guide.done ? 'over' : 'running'}>
        <Icon name="clock" />
        <span>{S.interval.guide}:</span>
        <strong role="timer">{guide.done ? S.interval.over(formatCountdown(guide.overSec)) : formatCountdown(guide.secondsLeft)}</strong>
      </p>
    {/if}

    <h3 class="panel__subtitle">{S.roundStart.announce}</h3>
    <PrizeList round={interval.nextRound} />

    <fieldset class="interval-panel__music" disabled>
      <legend class="panel__subtitle"><Icon name="music" /> {S.interval.music}</legend>
      <button type="button" class="action"><Icon name="next" /><span>{S.interval.skip}</span></button>
      <label class="field field--inline" for="{uid}-volume">
        <span class="field__label">{S.interval.volume}</span>
        <input id="{uid}-volume" type="range" min="0" max="100" value="70" />
      </label>
      <p class="note">{S.interval.musicNote}</p>
    </fieldset>

    <button type="button" class="action action--big tone-primary" data-anim="press" disabled={!model.can('roundIntro')} onclick={start}>
      <Icon name="play" /><span>{S.interval.start}</span>
    </button>
    <p class="note">{S.interval.startNote}</p>
  </section>
{/if}
