<!--
  Pace: the current value, Lock and Auto (auto-advance) as toggles, −/+ by PACE_FINE_STEP_SEC around the
  presets, and the round's recommended preset always marked (green outline and a "recomanat" badge on its own
  button, whatever is selected). While the engine bends the Pace to recover the Schedule, an orange notice
  says how much each song changes. Auto-advance in the final phase is in the menu.
-->
<script lang="ts">
  import { PACE_FINE_STEP_SEC, PACE_PRESETS_SEC } from '@quina/protocol';
  import { getConsole } from '../context.ts';
  import { defaultPaceFor } from '../logic/engine-rules.ts';
  import { recommendedPreset, recoveryNotice } from '../logic/pace-panel.ts';
  import { S } from '../strings.ts';
  import Icon from './Icon.svelte';

  const model = getConsole();
  const uid = $props.id();
  const snap = $derived(model.show.state);
  const paceOk = $derived(model.can('setPace'));
  const gameOk = $derived(model.can('setGame'));
  const recommended = $derived(snap ? recommendedPreset(snap.round.number, PACE_PRESETS_SEC, defaultPaceFor) : null);
  const notice = $derived(snap ? recoveryNotice(snap.pace) : null);
</script>

{#if snap}
  <section class="panel pace" aria-labelledby="{uid}-title">
    <div class="pace__head">
      <h2 class="panel__label pace__title" id="{uid}-title">
        <Icon name="gauge" />{S.pace.title}
        <output class="pace__value" aria-live="polite">{S.pace.value(snap.pace.sec)}</output>
      </h2>
      <button type="button" class="mini pace__toggle" data-toggle="lock" data-anim="press" aria-pressed={snap.pace.locked} title={S.pace.lockNote} disabled={!paceOk} onclick={() => model.act('setPace', { locked: !snap.pace.locked })}>
        <Icon name="lock" /><span>{S.pace.lock}</span>
      </button>
      <button type="button" class="mini pace__toggle" data-toggle="auto" data-anim="press" aria-pressed={snap.game.autoAdvance} title={S.pace.autoNote} disabled={!gameOk} onclick={() => model.act('setGame', { autoAdvance: !snap.game.autoAdvance })}>
        <Icon name="auto" /><span>{S.pace.auto}</span>
      </button>
    </div>
    <div class="pace__row" role="group" aria-label={S.pace.presets}>
      <button type="button" class="mini pace__step" data-anim="press" disabled={!paceOk} aria-label={S.pace.minusLabel(PACE_FINE_STEP_SEC)} onclick={() => model.act('setPace', { delta: -PACE_FINE_STEP_SEC })}>
        <Icon name="minus" />
      </button>
      {#each PACE_PRESETS_SEC as pace (pace)}
        <button
          type="button"
          class="mini pace__preset"
          data-anim="press"
          data-recommended={pace === recommended || undefined}
          aria-pressed={snap.pace.sec === pace}
          disabled={!paceOk}
          onclick={() => model.act('setPace', { pace })}
        >
          {S.pace.value(pace)}
          {#if pace === recommended}<span class="pace__badge"><span class="visually-hidden">, </span>{S.pace.recommended}</span>{/if}
        </button>
      {/each}
      <button type="button" class="mini pace__step" data-anim="press" disabled={!paceOk} aria-label={S.pace.plusLabel(PACE_FINE_STEP_SEC)} onclick={() => model.act('setPace', { delta: PACE_FINE_STEP_SEC })}>
        <Icon name="plus" />
      </button>
    </div>
    {#if notice}
      <p class="pace__notice" role="status"><Icon name="timer" /><span>{S.pace.recovery(notice)}</span></p>
    {/if}
  </section>
{/if}
