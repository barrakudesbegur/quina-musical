<!--
  Pace (the Consola-Joc board): the label above the presets, and Lock and Auto (auto-advance) as toggles in a
  narrow column on the right. The presets are named by speed ("Ràpid") with their seconds small and faded
  underneath (a preset without a name in strings.ts shows only its seconds); −/+ by PACE_FINE_STEP_SEC sit at
  the ends. The round's recommended preset is drawn with a dashed border (title "Recomanat"), whatever is
  selected. The current value is named next to the label only when it isn't a preset. At the title row's end,
  «Cançons noves: 22 s»: a song's first play in the Game gets the Pace × 22/14 (D174). While the engine bends
  the Pace to recover the Schedule, an orange notice says how much each song changes. Auto-advance in the
  final phase is in the menu.
-->
<script lang="ts">
  import MiniButton from '../../../packages/ui/components/MiniButton.svelte';
  import { MINI } from '../actions.ts';
  import { PACE_FINE_STEP_SEC, PACE_PRESETS_SEC } from '@quina/protocol';
  import { getConsole } from '../context.ts';
  import { DEFAULT_PACE_SEC } from '../logic/engine-rules.ts';
  import { recommendedPreset, recoveryNotice } from '../logic/pace-panel.ts';
  import Notice from '../../../packages/ui/components/Notice.svelte';
  import { S } from '../strings.ts';
  import { NOTICES } from '../actions.ts';
  import Icon from './Icon.svelte';

  const model = getConsole();
  const uid = $props.id();
  const snap = $derived(model.show.state);
  const paceOk = $derived(model.can('setPace'));
  const gameOk = $derived(model.can('setGame'));
  // The snapshot's default Pace when the engine reports it, else the shared rule.
  const recommended = $derived(snap ? recommendedPreset(snap.pace.defaultSec ?? DEFAULT_PACE_SEC, PACE_PRESETS_SEC) : null);
  const notice = $derived(snap ? recoveryNotice(snap.pace) : null);
  const onPreset = $derived(snap ? (PACE_PRESETS_SEC as readonly number[]).includes(snap.pace.sec) : false);
  const presets = PACE_PRESETS_SEC.map((sec) => ({ sec, name: S.pace.names[sec] ?? null }));
</script>

{#if snap}
  <section class="panel pace" aria-labelledby="{uid}-title">
    <div class="pace__body">
      <div class="pace__main">
        <h2 class="panel__label pace__title" id="{uid}-title">
          <Icon name="gauge" />{S.pace.title}
          <output class="pace__value" class:visually-hidden={onPreset} aria-live="polite">{S.pace.value(snap.pace.sec)}</output>
          <span class="pace__first" title={S.pace.firstPlayNote} data-testid="pace-first-play">{S.pace.firstPlay} <b>{S.pace.value(Math.round(snap.pace.firstPlaySec))}</b></span>
        </h2>
        <div class="pace__row" role="group" aria-label={S.pace.presets}>
          <MiniButton {...MINI.paceMinus} class="pace__step" disabled={!paceOk} aria-label={S.pace.minusLabel(PACE_FINE_STEP_SEC)} onclick={() => model.act('setPace', { delta: -PACE_FINE_STEP_SEC })} />
          {#each presets as preset (preset.sec)}
            {@const isRecommended = preset.sec === recommended}
            <MiniButton
              class="pace__preset"
              label={preset.name ?? S.pace.value(preset.sec)}
              sub={preset.name ? S.pace.value(preset.sec) : null}
              variant={isRecommended ? 'dashed' : 'solid'}
              data-pace={preset.sec}
              data-named={preset.name !== null || undefined}
              title={isRecommended ? S.pace.recommended : undefined}
              aria-label={S.pace.presetLabel(preset.name, preset.sec, isRecommended)}
              pressed={snap.pace.sec === preset.sec}
              disabled={!paceOk}
              onclick={() => model.act('setPace', { pace: preset.sec })}
            />
          {/each}
          <MiniButton {...MINI.pacePlus} class="pace__step" disabled={!paceOk} aria-label={S.pace.plusLabel(PACE_FINE_STEP_SEC)} onclick={() => model.act('setPace', { delta: PACE_FINE_STEP_SEC })} />
        </div>
      </div>
      <div class="pace__toggles">
        <MiniButton {...MINI.lock} class="pace__toggle" data-toggle="lock" pressed={snap.pace.locked} title={S.pace.lockNote} disabled={!paceOk} onclick={() => model.act('setPace', { locked: !snap.pace.locked })} />
        <MiniButton {...MINI.auto} class="pace__toggle" data-toggle="auto" pressed={snap.game.autoAdvance} title={S.pace.autoNote} disabled={!gameOk} onclick={() => model.act('setGame', { autoAdvance: !snap.game.autoAdvance })} />
      </div>
    </div>
    {#if notice}
      <Notice {...NOTICES.recovery} class="pace__notice" text={S.pace.recovery(notice)} />
    {/if}
  </section>
{/if}
