<!--
  The rarely used things, in a sheet from the right (the Consola-Menu board): a title with this device and the
  round, then cards in three columns (two, then one, on narrower screens):
  - this device (label, theme), the connections, the Wii remote (its status, Connectar, and the Comandament
    dialog), a QR to open the console on another phone;
  - the night (rounds in total, the night's expected end with its drift, start the night), the game (the
    technical pause, which is the Pausa, auto-advance in the final phase, the phones' «LÍNIA!»/«QUINA!» announce (D289), a Phase override), the tools (a Line
    confirmed without a Check);
  - the Game's Winners, plan B resume, and the Plan B cheat sheet (the laptop's keys and the setup
    checklist) behind a disclosure; last, «Proves» (TestsPanel), only while the relay runs with `--test`.
  The remote's card also has the shake gesture's switch (D144, D148; the Consola-Menu board). The night's card is
  followed by «Cartrons venuts» (CardsAdd, D234). Under the three columns, across them: «Sons automàtics» (AutoSounds,
  D237; the «Última volta» and voices switches live there now), «Prova de so» (SoundTest, D229) and the volume sliders
  (VolumeSliders; D139).
  Panic and "Acabar la nit" sit apart at the bottom, in a danger zone under a hazard stripe.
  The design system's Sheet (packages/ui/components, C3) from the right edge (origin side-right, hook menu-sheet): ✕
  «Tanca», Esc and a tap on the dimmed console outside it close it (light dismiss, the user's call of 28 Nov; the Wii
  dialog still doesn't, U188); it slides back out as it closes.
-->
<script lang="ts">
  import MiniButton from '../../../packages/ui/components/MiniButton.svelte';
  import { PHASE_NAMES, type PhaseName } from '@quina/protocol';
  import { untrack } from 'svelte';
  import { formatClock, formatDrift } from '../../../packages/rules/time.ts';
  import { CONSOLE, type Theme } from '../config.ts';
  import { getConsole, getWii } from '../context.ts';
  import { roundIntroArgs } from '../logic/show-data.ts';
  import { LINK_NAMES, driftTone, linksOf } from '../logic/status.ts';
  import { S } from '../strings.ts';
  import Icon from './Icon.svelte';
  import LanQr from './LanQr.svelte';
  import { ACTIONS, MINI } from '../actions.ts';
  import LongPressButton from '../../../packages/ui/components/LongPressButton.svelte';
  import ResumePanel from './ResumePanel.svelte';
  import SetupChecklist from './SetupChecklist.svelte';
  import TestsPanel from './TestsPanel.svelte';
  import Switch from '../../../packages/ui/components/Switch.svelte';
  import TextField from '../../../packages/ui/components/TextField.svelte';
  import SegmentedControl from '../../../packages/ui/components/SegmentedControl.svelte';
  import VolumeSliders from './VolumeSliders.svelte';
  import AutoSounds from './AutoSounds.svelte';
  import CardsAdd from './CardsAdd.svelte';
  import SoundTest from './SoundTest.svelte';
  import { autoSoundsNow } from '../logic/auto-sounds.ts';
  import { announceWinsArgs, announceWinsNow } from '../logic/announce-wins.ts';
  import { getConsoleSounds } from '../context.ts';
  import { touchPress, touchRelease } from '../../../packages/ui/sounds/touch.ts';
  import Sheet from '../../../packages/ui/components/Sheet.svelte';
  import WinnersList from './WinnersList.svelte';

  /** `onwii`: open the Comandament dialog (the menu closes). */
  let { open = $bindable(false), onwii }: { open: boolean; onwii: () => void } = $props();

  const model = getConsole();
  const wii = getWii();
  const sounds = getConsoleSounds();
  const uid = $props.id();
  let labelDraft = $state('');
  let planBOpen = $state(false);
  const snap = $derived(model.show.state);
  const flow = $derived(model.show.flow);
  const links = $derived(linksOf(model.show.connected, model.show.showOnline, wii.linkStatus));
  const THEMES: readonly Theme[] = ['light', 'dark'];
  // The engine's round count (what the total counts is pending U163).
  const subtitle = $derived(S.menu.subtitle(model.label, snap && snap.round.number >= 1 ? S.roundOf(snap.round, model.plan, snap.game.roundsTotal) : null));
  const startable = $derived(flow.scene === 'before' && model.can('roundIntro'));

  // Opening: fresh fields, and `menu-sheet`'s sound (☰ played its press, its release gives way to this).
  let shown = false;
  $effect(() => {
    if (open === shown) return;
    shown = open;
    if (!open) return;
    untrack(() => {
      labelDraft = model.label ?? '';
      planBOpen = false;
    });
    touchRelease('drawerOpen');
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

<Sheet
  bind:open
  class="menu-sheet"
  title={S.menu.title}
  {subtitle}
  origin="side-right"
  dismiss="any"
  closeLabel={S.menu.close}
  closeText
  closeSound={null}
  onclose={() => touchPress('drawerClose')}
>
    <div class="menu-sheet__column">
      <section class="menu-group" aria-labelledby="{uid}-device">
        <h3 class="menu-group__title" id="{uid}-device"><Icon name="device" />{S.menu.device}</h3>
        <form class="menu-group__row" onsubmit={saveLabel}>
          <TextField class="menu-group__name" label={S.menu.labelField} maxlength={CONSOLE.labelMaxLength} autocomplete="off" bind:value={labelDraft} />
          <MiniButton {...MINI.labelSave} type="submit" />
        </form>
        <SegmentedControl size="s" label={S.menu.labelField} options={CONSOLE.labelPresets.map((preset) => ({ id: preset, label: preset }))} value={model.label} onchange={(preset) => ((labelDraft = preset), model.setLabel(preset))} />
        <p class="note">{S.menu.labelNote}</p>
        <SegmentedControl size="s" label={S.menu.theme} options={THEMES.map((theme) => ({ id: theme, label: S.menu.themes[theme], icon: theme === 'light' ? 'sun' : 'moon' }))} value={model.theme} onchange={(theme) => model.setTheme(theme)} />
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
            <MiniButton {...MINI.wiiConnect} onclick={() => void wii.connect()} />
          {/if}
          <MiniButton {...MINI.wiiOpen} onclick={onwii} />
        </p>
        <p class="note">{S.menu.wiiNote}</p>
        <Switch label={S.wii.shake} note={`${S.wii.shakeNote}. ${S.wii.shakeDefault}`} checked={wii.shake} disabled={!wii.canSetShake} onchange={(on) => wii.setShake(on)} />
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
            <MiniButton {...MINI.roundsMinus} class="stepper__button" aria-label={S.menu.roundsMinus} disabled={!model.can('setGame') || snap.game.roundsTotal <= 1} onclick={() => model.act('setGame', { roundsTotal: snap.game.roundsTotal - 1 })} />
            <output class="stepper__value" aria-labelledby="{uid}-rounds">{snap.game.roundsTotal}</output>
            <MiniButton {...MINI.roundsPlus} class="stepper__button" aria-label={S.menu.roundsPlus} disabled={!model.can('setGame') || snap.game.roundsTotal >= 20} onclick={() => model.act('setGame', { roundsTotal: snap.game.roundsTotal + 1 })} />
          </div>
          <p class="menu-end">
            <span class="menu-end__text">
              <span class="menu-end__label">{S.menu.gameEnd}</span>
              <span class="menu-end__clock">{formatClock(snap.schedule.gameEndMs)}</span>
            </span>
            <span class="menu-end__drift" data-tone={driftTone(snap.schedule.gameDriftSec)}>{formatDrift(snap.schedule.gameDriftSec)}</span>
          </p>
        {/if}
        <MiniButton {...MINI.nightStart} class="menu-group__start" disabled={!startable} title={flow.scene !== 'before' ? S.menu.started : undefined} onclick={startNight} />
        <p class="note">{S.menu.startNote}</p>
      </section>

      {#if snap}
        <CardsAdd
          inPlay={snap.cards.inPlay}
          count={snap.cards.inPlayCount}
          rules={{ known: model.padRules.known, max: CONSOLE.cardMax }}
          disabled={!model.can('addCardsInPlay')}
          outcome={model.cardsAddOutcome}
          onadd={(ranges) => model.addCards(ranges)}
        />
      {/if}

      {#if snap}
        <section class="menu-group" aria-labelledby="{uid}-game">
          <h3 class="menu-group__title" id="{uid}-game"><Icon name="gauge" />{S.menu.game}</h3>
          <Switch label={S.menu.pause} note={S.menu.pauseNote} checked={flow.pause !== null} disabled={!model.can('pause')} onchange={(on) => model.act('pause', { on })} />
          <Switch label={S.pace.autoFinal} checked={snap.game.autoAdvanceFinal} disabled={!model.can('setGame')} onchange={(autoAdvanceFinal) => model.act('setGame', { autoAdvanceFinal })} />
          <Switch label={S.menu.announceWins} note={S.menu.announceWinsNote} checked={announceWinsNow(snap.game)} disabled={!model.can('setGame')} data-testid="announce-wins" onchange={(on) => model.act('setGame', announceWinsArgs(on))} />
          <span class="menu-group__field" id="{uid}-phase">{S.menu.phase}</span>
          <div class="choice-group" role="group" aria-labelledby="{uid}-phase">
            <MiniButton size="s" label={S.menu.phaseAuto} pressed={snap.game.phaseOverride === null} disabled={!model.can('setGame')} onclick={() => setPhase(null)} />
            {#each PHASE_NAMES as phase (phase)}
              <MiniButton size="s" label={S.phase[phase]} pressed={snap.game.phaseOverride === phase} disabled={!model.can('setGame')} onclick={() => setPhase(phase)} />
            {/each}
          </div>
        </section>

        <section class="menu-group" aria-labelledby="{uid}-tools">
          <h3 class="menu-group__title" id="{uid}-tools"><Icon name="check" />{S.menu.tools}</h3>
          <LongPressButton {...ACTIONS.confirmLine} disabled={snap.round.lineConfirmed || !model.can('confirmLine')} onconfirm={() => model.act('confirmLine')} />
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

      {#if open && model.testMode}<TestsPanel />{/if}
    </div>

    <section class="menu-group menu-ui-sounds" aria-label={S.menu.uiSounds}>
      <Switch
        label={S.menu.uiSounds}
        note={sounds.showLaptop ? S.menu.uiSoundsLaptop : S.menu.uiSoundsNote}
        checked={model.uiSounds && !sounds.showLaptop}
        disabled={sounds.showLaptop}
        onchange={(on) => model.setUiSounds(on)}
      />
    </section>
    {#if snap}
      <AutoSounds values={autoSoundsNow(snap.game)} disabled={!model.can('setAutoSound')} onchange={(key, on) => model.act('setAutoSound', { key, on })} />
      <SoundTest
        kind={snap.soundTest?.kind ?? null}
        enabled={model.can('soundTest')}
        volumes={snap.game.volumes}
        volumesEnabled={model.can('setVolume')}
        autoSounds={autoSoundsNow(snap.game)}
        onkind={(kind) => model.act('soundTest', { kind })}
        onvolume={(key, percent) => model.act('setVolume', { key, percent })}
      />
      <VolumeSliders />
    {/if}

  {#snippet footer()}
    <section class="menu-danger" aria-label={S.menu.danger}>
      <LongPressButton {...ACTIONS.panic} disabled={!model.can('panic')} onconfirm={() => model.act('panic')} />
      <span class="menu-danger__end">
        <LongPressButton {...ACTIONS.endNight} disabled={flow.scene === 'after' || !model.can('endGame')} onconfirm={() => model.act('endGame')} />
      </span>
    </section>
  {/snippet}
</Sheet>
