<!--
  The rarely used things, in a sheet from the right (the Consola-Menu board): a title with this device and the
  round, then cards in three columns (two, then one, on narrower screens):
  - this device (label, theme), the connections, the Wii remote (its status, Connectar, and the Comandament
    dialog), a QR to open the console on another phone;
  - the night (rounds in total, the night's expected end with its drift, start the night), the game (the
    technical pause, which is the Pausa, auto-advance in the final phase, a Phase override), the tools (a Line
    confirmed without a Check);
  - the Game's Winners, plan B resume, and the Plan B cheat sheet (the laptop's keys and the setup
    checklist) behind a disclosure.
  Panic and "Acabar la nit" sit apart at the bottom, in a danger zone under a hazard stripe.
  The sheet slides in (hook menu-sheet).
-->
<script lang="ts">
  import { PHASE_NAMES, type PhaseName } from '@quina/protocol';
  import { formatClock, formatDrift } from '../../../packages/rules/time.ts';
  import { CONSOLE, type Theme } from '../config.ts';
  import { getConsole, getWii } from '../context.ts';
  import { roundIntroArgs } from '../logic/show-data.ts';
  import { LINK_NAMES, driftTone, linksOf } from '../logic/status.ts';
  import { S } from '../strings.ts';
  import Icon from './Icon.svelte';
  import LanQr from './LanQr.svelte';
  import LongPressButton from './LongPressButton.svelte';
  import ResumePanel from './ResumePanel.svelte';
  import SetupChecklist from './SetupChecklist.svelte';
  import Switch from './Switch.svelte';
  import WinnersList from './WinnersList.svelte';

  /** `onwii`: open the Comandament dialog (the menu closes). */
  let { open = $bindable(false), onwii }: { open: boolean; onwii: () => void } = $props();

  const model = getConsole();
  const wii = getWii();
  const uid = $props.id();
  let dialog: HTMLDialogElement | undefined = $state();
  let labelDraft = $state('');
  let planBOpen = $state(false);
  const snap = $derived(model.show.state);
  const flow = $derived(model.show.flow);
  const links = $derived(linksOf(model.show.connected, model.show.showOnline, wii.linkStatus));
  const THEMES: readonly Theme[] = ['light', 'dark'];
  const subtitle = $derived(S.menu.subtitle(model.label, snap ? snap.round.number : null, snap?.game.roundsTotal ?? 0));
  const startable = $derived(flow.scene === 'before' && model.can('roundIntro'));

  $effect(() => {
    if (!dialog) return;
    if (open && !dialog.open) {
      labelDraft = model.label ?? '';
      planBOpen = false;
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
    model.act('roundIntro', roundIntroArgs(model.plan, 1));
    open = false;
  }

  const setPhase = (phaseOverride: PhaseName | null) => model.act('setGame', { phaseOverride });
</script>

<dialog bind:this={dialog} class="dialog menu-sheet" data-anim="menu-sheet" aria-labelledby="{uid}-title" onclose={() => (open = false)}>
  <header class="menu-sheet__head">
    <h2 class="menu-sheet__title" id="{uid}-title">{S.menu.title}</h2>
    {#if subtitle}<span class="menu-sheet__subtitle">{subtitle}</span>{/if}
    <button type="button" class="mini menu-sheet__close" data-anim="press" onclick={() => (open = false)}><Icon name="close" /><span>{S.menu.close}</span></button>
  </header>

  <div class="menu-sheet__body">
    <div class="menu-sheet__column">
      <section class="menu-group" aria-labelledby="{uid}-device">
        <h3 class="menu-group__title" id="{uid}-device"><Icon name="device" />{S.menu.device}</h3>
        <form class="menu-group__row" onsubmit={saveLabel}>
          <label class="field" for="{uid}-label">
            <span class="field__label">{S.menu.labelField}</span>
            <input id="{uid}-label" type="text" maxlength={CONSOLE.labelMaxLength} autocomplete="off" bind:value={labelDraft} />
          </label>
          <button type="submit" class="mini" data-anim="press">{S.menu.labelSave}</button>
        </form>
        <div class="choice-group" role="group" aria-label={S.menu.labelField}>
          {#each CONSOLE.labelPresets as preset (preset)}
            <button type="button" class="choice" data-anim="press" aria-pressed={model.label === preset} onclick={() => ((labelDraft = preset), model.setLabel(preset))}>{preset}</button>
          {/each}
        </div>
        <p class="note">{S.menu.labelNote}</p>
        <div class="choice-group" role="group" aria-label={S.menu.theme}>
          {#each THEMES as theme (theme)}
            <button type="button" class="choice" data-anim="press" aria-pressed={model.theme === theme} onclick={() => model.setTheme(theme)}>
              <Icon name={theme === 'light' ? 'sun' : 'moon'} /><span>{S.menu.themes[theme]}</span>
            </button>
          {/each}
        </div>
      </section>

      <section class="menu-group" aria-labelledby="{uid}-links">
        <h3 class="menu-group__title" id="{uid}-links"><Icon name="wifi" />{S.links.title}</h3>
        <dl class="link-list">
          {#each LINK_NAMES as name (name)}
            <div class="link-list__item" data-state={links[name]}><dt>{S.links.names[name]}</dt><dd>{S.links.states[links[name]]}</dd></div>
          {/each}
        </dl>
      </section>

      <section class="menu-group menu-wii" data-state={wii.status} aria-labelledby="{uid}-wii">
        <h3 class="menu-group__title" id="{uid}-wii"><Icon name="remote" />{S.wii.title}</h3>
        <p class="menu-wii__row">
          <span class="wii-status" data-state={wii.status}>{S.wii.status[wii.status]}</span>
          {#if wii.status === 'disconnected' || wii.status === 'lost'}
            <button type="button" class="mini tone-primary" data-anim="press" onclick={() => void wii.connect()}>{S.wii.connect}</button>
          {/if}
          <button type="button" class="mini" data-anim="press" onclick={onwii}>{S.wii.open}</button>
        </p>
        <p class="note">{S.menu.wiiNote}</p>
      </section>

      <section class="menu-group" aria-labelledby="{uid}-lan">
        <h3 class="menu-group__title menu-group__title--plain" id="{uid}-lan">{S.menu.lan}</h3>
        {#if open}<LanQr />{/if}
      </section>
    </div>

    <div class="menu-sheet__column">
      <section class="menu-group" aria-labelledby="{uid}-night">
        <h3 class="menu-group__title" id="{uid}-night"><Icon name="moon" />{S.menu.night}</h3>
        {#if snap}
          <div class="menu-group__row stepper">
            <span class="stepper__label" id="{uid}-rounds">{S.menu.roundsTotal}</span>
            <button type="button" class="stepper__button" data-anim="press" aria-label={S.menu.roundsMinus} disabled={!model.can('setGame') || snap.game.roundsTotal <= 1} onclick={() => model.act('setGame', { roundsTotal: snap.game.roundsTotal - 1 })}>
              <Icon name="minus" />
            </button>
            <output class="stepper__value" aria-labelledby="{uid}-rounds">{snap.game.roundsTotal}</output>
            <button type="button" class="stepper__button" data-anim="press" aria-label={S.menu.roundsPlus} disabled={!model.can('setGame') || snap.game.roundsTotal >= 20} onclick={() => model.act('setGame', { roundsTotal: snap.game.roundsTotal + 1 })}>
              <Icon name="plus" />
            </button>
          </div>
          <p class="menu-end">
            <span class="menu-end__text">
              <span class="menu-end__label">{S.menu.gameEnd}</span>
              <span class="menu-end__clock">{formatClock(snap.schedule.gameEndMs)}</span>
            </span>
            <span class="menu-end__drift" data-tone={driftTone(snap.schedule.gameDriftSec)}>{formatDrift(snap.schedule.gameDriftSec)}</span>
          </p>
        {/if}
        <button type="button" class="mini menu-group__start" data-anim="press" disabled={!startable} title={flow.scene !== 'before' ? S.menu.started : undefined} onclick={startNight}>
          <Icon name="play" /><span>{S.menu.start}</span>
        </button>
        <p class="note">{S.menu.startNote}</p>
      </section>

      {#if snap}
        <section class="menu-group" aria-labelledby="{uid}-game">
          <h3 class="menu-group__title" id="{uid}-game"><Icon name="gauge" />{S.menu.game}</h3>
          <Switch label={S.menu.pause} note={S.menu.pauseNote} on={flow.pause !== null} disabled={!model.can('pause')} onchange={(on) => model.act('pause', { on })} />
          <Switch label={S.pace.autoFinal} on={snap.game.autoAdvanceFinal} disabled={!model.can('setGame')} onchange={(autoAdvanceFinal) => model.act('setGame', { autoAdvanceFinal })} />
          <!-- R2-Q18: the presenters can turn off the automatic "Final Lap!" fanfare (the Efectes pad still plays it by hand). -->
          <Switch label={S.menu.finalLap} note={S.menu.finalLapNote} on={snap.game.finalLapStinger} disabled={!model.can('setGame')} onchange={(finalLapStinger) => model.act('setGame', { finalLapStinger })} />
          <span class="menu-group__field" id="{uid}-phase">{S.menu.phase}</span>
          <div class="choice-group" role="group" aria-labelledby="{uid}-phase">
            <button type="button" class="choice" data-anim="press" aria-pressed={snap.game.phaseOverride === null} disabled={!model.can('setGame')} onclick={() => setPhase(null)}>{S.menu.phaseAuto}</button>
            {#each PHASE_NAMES as phase (phase)}
              <button type="button" class="choice" data-anim="press" aria-pressed={snap.game.phaseOverride === phase} disabled={!model.can('setGame')} onclick={() => setPhase(phase)}>{S.phase[phase]}</button>
            {/each}
          </div>
        </section>

        <section class="menu-group" aria-labelledby="{uid}-tools">
          <h3 class="menu-group__title" id="{uid}-tools"><Icon name="check" />{S.menu.tools}</h3>
          <LongPressButton label={S.menu.confirmLine} note={S.menu.confirmLineNote} icon="check" tone="ok" disabled={snap.round.lineConfirmed || !model.can('confirmLine')} onconfirm={() => model.act('confirmLine')} />
        </section>
      {/if}
    </div>

    <div class="menu-sheet__column">
      <section class="menu-group" aria-labelledby="{uid}-winners">
        <h3 class="menu-group__title" id="{uid}-winners"><Icon name="fanfare" />{S.menu.winners}</h3>
        {#if open}<WinnersList />{/if}
      </section>

      {#if open}<ResumePanel />{/if}

      <section class="menu-group menu-group--disclosure">
        <button type="button" class="menu-plan-b" aria-expanded={planBOpen} aria-controls="{uid}-plan-b" onclick={() => (planBOpen = !planBOpen)}>
          <Icon name="keyboard" />
          <span class="menu-plan-b__text">
            <span class="menu-plan-b__title">{S.menu.planB}</span>
            <span class="menu-plan-b__note">{S.menu.planBNote}</span>
          </span>
          <Icon name="chevron" />
        </button>
        <div class="menu-plan-b__body" id="{uid}-plan-b" hidden={!planBOpen}>
          <h4 class="menu-group__field">{S.cheatSheet.keys}</h4>
          <dl class="key-list">
            {#each S.showKeys as k (k.keys)}
              <div class="key-list__item"><dt><kbd>{k.keys}</kbd></dt><dd>{k.action}</dd></div>
            {/each}
          </dl>
          <SetupChecklist />
        </div>
      </section>
    </div>
  </div>

  <section class="menu-danger" aria-label={S.menu.danger}>
    <LongPressButton label={S.menu.panic} note={S.menu.panicNote} icon="alert" tone="danger" disabled={!model.can('panic')} onconfirm={() => model.act('panic')} />
    <span class="menu-danger__end">
      <LongPressButton label={S.menu.end} note={S.menu.endNote} icon="power" tone="danger" disabled={flow.scene === 'after' || !model.can('endGame')} onconfirm={() => model.act('endGame')} />
    </span>
  </section>
</dialog>
