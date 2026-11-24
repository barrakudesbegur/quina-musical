<!--
  The rarely used things, tucked away in a drawer: this device (label, theme), start and end the night,
  the Schedule, the technical pause, a Phase override, a Line confirmed without a Check, plan B resume, Panic, the
  connections, Wii pairing, and a QR to open the console on another phone.
-->
<script lang="ts">
  import { PHASE_NAMES, type PhaseName } from '@quina/protocol';
  import { formatClock, formatDrift } from '../../ui/rules/time.ts';
  import { CONSOLE, type Theme } from '../config.ts';
  import { getConsole } from '../context.ts';
  import { roundPrizes } from '../logic/show-data.ts';
  import { LINK_NAMES, linksOf } from '../logic/status.ts';
  import { S } from '../strings.ts';
  import Icon from './Icon.svelte';
  import LanQr from './LanQr.svelte';
  import LongPressButton from './LongPressButton.svelte';
  import ResumePanel from './ResumePanel.svelte';
  import Switch from './Switch.svelte';

  let { open = $bindable(false) }: { open: boolean } = $props();

  const model = getConsole();
  const uid = $props.id();
  let dialog: HTMLDialogElement | undefined = $state();
  let labelDraft = $state('');
  const snap = $derived(model.show.state);
  const flow = $derived(model.show.flow);
  const links = $derived(linksOf(model.show.connected, model.show.showOnline));
  const THEMES: readonly Theme[] = ['light', 'dark'];

  $effect(() => {
    if (!dialog) return;
    if (open && !dialog.open) {
      labelDraft = model.label ?? '';
      dialog.showModal();
    } else if (!open && dialog.open) {
      dialog.close();
    }
  });

  function saveLabel(e: SubmitEvent): void {
    e.preventDefault();
    model.setLabel(labelDraft);
  }

  function startNight(): void {
    const first = roundPrizes(model.plan, 1);
    model.act('roundIntro', first.status === 'ok' ? { number: 1, kind: first.prizes.kind } : { number: 1 });
    open = false;
  }

  const setPhase = (phaseOverride: PhaseName | null) => model.act('setGame', { phaseOverride });
</script>

<dialog bind:this={dialog} class="dialog drawer" aria-labelledby="{uid}-title" onclose={() => (open = false)}>
  <header class="dialog__head">
    <h2 class="panel__title" id="{uid}-title">{S.menu.title}</h2>
    <button type="button" class="dialog__close" onclick={() => (open = false)}><Icon name="close" /><span>{S.menu.close}</span></button>
  </header>

  <section class="drawer__section" aria-labelledby="{uid}-device">
    <h3 class="panel__subtitle" id="{uid}-device">{S.menu.device}</h3>
    <form class="drawer__row" onsubmit={saveLabel}>
      <label class="field" for="{uid}-label">
        <span class="field__label">{S.menu.labelField}</span>
        <input id="{uid}-label" type="text" maxlength={CONSOLE.labelMaxLength} autocomplete="off" bind:value={labelDraft} />
      </label>
      <button type="submit" class="action" data-anim="press">{S.menu.labelSave}</button>
    </form>
    <p class="note">{S.menu.labelNote}</p>
    <div class="choice-group" role="group" aria-label={S.menu.labelField}>
      {#each CONSOLE.labelPresets as preset (preset)}
        <button type="button" class="choice" data-anim="press" aria-pressed={model.label === preset} onclick={() => ((labelDraft = preset), model.setLabel(preset))}>{preset}</button>
      {/each}
    </div>
    <div class="choice-group" role="group" aria-label={S.menu.theme}>
      {#each THEMES as theme (theme)}
        <button type="button" class="choice" data-anim="press" aria-pressed={model.theme === theme} onclick={() => model.setTheme(theme)}>
          <Icon name={theme === 'light' ? 'sun' : 'moon'} /><span>{S.menu.themes[theme]}</span>
        </button>
      {/each}
    </div>
  </section>

  <section class="drawer__section" aria-labelledby="{uid}-night">
    <h3 class="panel__subtitle" id="{uid}-night">{S.menu.night}</h3>
    <button type="button" class="action tone-primary" data-anim="press" disabled={flow.scene !== 'before' || !model.can('roundIntro')} onclick={startNight}>
      <Icon name="play" /><span>{S.menu.start}</span>
    </button>
    <p class="note">{S.menu.startNote}</p>
    <LongPressButton label={S.menu.end} note={S.menu.endNote} icon="power" tone="danger" disabled={flow.scene === 'after' || !model.can('endGame')} onconfirm={() => model.act('endGame')} />
  </section>

  {#if snap}
    <section class="drawer__section" aria-labelledby="{uid}-schedule">
      <h3 class="panel__subtitle" id="{uid}-schedule">{S.menu.schedule}</h3>
      <div class="drawer__row stepper">
        <span class="stepper__label" id="{uid}-rounds">{S.menu.roundsTotal}</span>
        <button type="button" class="stepper__button" data-anim="press" aria-label={S.menu.roundsMinus} disabled={!model.can('setGame') || snap.game.roundsTotal <= 1} onclick={() => model.act('setGame', { roundsTotal: snap.game.roundsTotal - 1 })}>
          <Icon name="minus" />
        </button>
        <output class="stepper__value" aria-labelledby="{uid}-rounds">{snap.game.roundsTotal}</output>
        <button type="button" class="stepper__button" data-anim="press" aria-label={S.menu.roundsPlus} disabled={!model.can('setGame') || snap.game.roundsTotal >= 20} onclick={() => model.act('setGame', { roundsTotal: snap.game.roundsTotal + 1 })}>
          <Icon name="plus" />
        </button>
      </div>
      <p>{S.menu.gameEnd(formatClock(snap.schedule.gameEndMs), formatDrift(snap.schedule.gameDriftSec))}</p>
    </section>

    <section class="drawer__section" aria-labelledby="{uid}-pause">
      <h3 class="panel__subtitle" id="{uid}-pause">{S.menu.pause}</h3>
      <Switch label={S.menu.pause} on={flow.pause !== null} disabled={!model.can('pause')} onchange={(on) => model.act('pause', { on })} />
    </section>

    <section class="drawer__section" aria-labelledby="{uid}-phase">
      <h3 class="panel__subtitle" id="{uid}-phase">{S.menu.phase}</h3>
      <div class="choice-group" role="group" aria-labelledby="{uid}-phase">
        <button type="button" class="choice" data-anim="press" aria-pressed={snap.game.phaseOverride === null} disabled={!model.can('setGame')} onclick={() => setPhase(null)}>{S.menu.phaseAuto}</button>
        {#each PHASE_NAMES as phase (phase)}
          <button type="button" class="choice" data-anim="press" aria-pressed={snap.game.phaseOverride === phase} disabled={!model.can('setGame')} onclick={() => setPhase(phase)}>{S.phase[phase]}</button>
        {/each}
      </div>
    </section>

    <section class="drawer__section" aria-labelledby="{uid}-tools">
      <h3 class="panel__subtitle" id="{uid}-tools">{S.menu.tools}</h3>
      <LongPressButton label={S.menu.confirmLine} note={S.menu.confirmLineNote} icon="check" tone="accent" disabled={snap.round.lineConfirmed || !model.can('confirmLine')} onconfirm={() => model.act('confirmLine')} />
    </section>
  {/if}

  {#if open}<ResumePanel />{/if}

  <section class="drawer__section" aria-labelledby="{uid}-panic">
    <h3 class="panel__subtitle" id="{uid}-panic">{S.menu.panic}</h3>
    <LongPressButton label={S.menu.panic} note={S.menu.panicNote} icon="alert" tone="danger" disabled={!model.can('panic')} onconfirm={() => model.act('panic')} />
  </section>

  <section class="drawer__section" aria-labelledby="{uid}-links">
    <h3 class="panel__subtitle" id="{uid}-links">{S.links.title}</h3>
    <dl class="link-list">
      {#each LINK_NAMES as name (name)}
        <div class="link-list__item" data-state={links[name]}><dt>{S.links.names[name]}</dt><dd>{S.links.states[links[name]]}</dd></div>
      {/each}
    </dl>
    <h4 class="panel__subtitle">{S.menu.wii}</h4>
    <p class="note">{S.menu.wiiNote}</p>
  </section>

  <section class="drawer__section" aria-labelledby="{uid}-lan">
    <h3 class="panel__subtitle" id="{uid}-lan">{S.menu.lan}</h3>
    {#if open}<LanQr />{/if}
  </section>
</dialog>
