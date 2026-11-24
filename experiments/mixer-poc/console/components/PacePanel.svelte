<!-- Pace: presets, −/+ by PACE_FINE_STEP_SEC, lock, auto-advance and auto-advance in the final phase. -->
<script lang="ts">
  import { PACE_FINE_STEP_SEC, PACE_PRESETS_SEC } from '@quina/protocol';
  import { getConsole } from '../context.ts';
  import { S } from '../strings.ts';
  import Icon from './Icon.svelte';
  import Switch from './Switch.svelte';

  const model = getConsole();
  const snap = $derived(model.show.state);
  const paceOk = $derived(model.can('setPace'));
  const gameOk = $derived(model.can('setGame'));
</script>

{#if snap}
  <section class="panel pace" aria-labelledby="pace-title">
    <h2 class="panel__title" id="pace-title">{S.pace.title}</h2>
    <div class="pace__row">
      <button type="button" class="pace__step" data-anim="press" disabled={!paceOk} aria-label={S.pace.minusLabel(PACE_FINE_STEP_SEC)} onclick={() => model.act('setPace', { delta: -PACE_FINE_STEP_SEC })}>
        <Icon name="minus" /><span aria-hidden="true">{S.pace.minus(PACE_FINE_STEP_SEC)}</span>
      </button>
      <output class="pace__value" aria-live="polite">{S.pace.value(snap.pace.sec)}</output>
      <button type="button" class="pace__step" data-anim="press" disabled={!paceOk} aria-label={S.pace.plusLabel(PACE_FINE_STEP_SEC)} onclick={() => model.act('setPace', { delta: PACE_FINE_STEP_SEC })}>
        <Icon name="plus" /><span aria-hidden="true">{S.pace.plus(PACE_FINE_STEP_SEC)}</span>
      </button>
    </div>
    <div class="pace__presets" role="group" aria-label={S.pace.presets}>
      {#each PACE_PRESETS_SEC as pace (pace)}
        <button type="button" class="pace__preset" data-anim="press" aria-pressed={snap.pace.sec === pace} disabled={!paceOk} onclick={() => model.act('setPace', { pace })}>
          {S.pace.value(pace)}
        </button>
      {/each}
    </div>
    <p class="pace__detail">
      {S.pace.detail(snap.pace.spinSec, snap.pace.slotSec)}{#if snap.pace.nudge !== 1}&nbsp;· {S.pace.nudge(snap.pace.nudge)}{/if}
    </p>
    <div class="pace__switches">
      <Switch label={S.pace.lock} note={S.pace.lockNote} on={snap.pace.locked} disabled={!paceOk} onchange={(locked) => model.act('setPace', { locked })} />
      <Switch label={S.pace.auto} on={snap.game.autoAdvance} disabled={!gameOk} onchange={(autoAdvance) => model.act('setGame', { autoAdvance })} />
      <Switch label={S.pace.autoFinal} on={snap.game.autoAdvanceFinal} disabled={!gameOk} onchange={(autoAdvanceFinal) => model.act('setGame', { autoAdvanceFinal })} />
    </div>
  </section>
{/if}
