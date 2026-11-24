<!--
  Always visible, in three groups that wrap in portrait:
  - round: the round name and scene, then the Phase and the real Heat;
  - time: the clock, then the round's expected end and the Drift;
  - links: the connection chips, then the device label and the menu.
-->
<script lang="ts">
  import { formatClock, formatDrift } from '../../../packages/rules/time.ts';
  import { getConsole } from '../context.ts';
  import { LINK_NAMES, heatPercent, linksOf, roundOnScreen } from '../logic/status.ts';
  import { CA, S } from '../strings.ts';
  import ConnChip from './ConnChip.svelte';
  import Icon from './Icon.svelte';

  let { onmenu }: { onmenu: () => void } = $props();

  const model = getConsole();
  const snap = $derived(model.show.state);
  const flow = $derived(model.show.flow);
  const round = $derived(roundOnScreen(snap, flow));
  const heat = $derived(heatPercent(snap?.heat));
  const links = $derived(linksOf(model.show.connected, model.show.showOnline));
</script>

<header class="header" data-scene={flow.scene} data-stale={!model.online || undefined}>
  <div class="header__group header__group--round">
    <p class="header__primary">
      <span class="header__round">{round ? S.header.round(round.number, round.special) : S.header.noRound}</span>
      <span class="header__scene">{CA.scene[flow.scene]}</span>
    </p>
    <p class="header__secondary">
      {#if snap}
        <span class="header__phase" data-phase={snap.phase}>
          {S.header.phase}: <strong>{S.phase[snap.phase]}</strong>{#if snap.game.phaseOverride}&nbsp;({S.header.phaseFixed}){/if}
          · {S.climbing[snap.cards.climbingTo]}
        </span>
        <span class="heat" data-state={heat === null ? 'none' : 'on'}>
          <span class="heat__label">{S.header.heat}</span>
          <span class="heat__bar" aria-hidden="true"><span class="heat__fill" style:--heat={(heat ?? 0) / 100}></span></span>
          <span class="heat__value">{heat ?? S.links.unknownShort}</span>
        </span>
      {/if}
    </p>
  </div>

  <div class="header__group header__group--time">
    <p class="header__primary">
      <span class="visually-hidden">{S.header.clock}</span>
      <time class="header__clock">{formatClock(model.show.now)}</time>
    </p>
    <p class="header__secondary">
      {#if snap}
        <span>{S.header.roundEnd} <strong>{formatClock(snap.schedule.roundEndMs)}</strong></span>
        <span class="header__drift" data-late={snap.schedule.roundDriftSec >= 30 || undefined}>{S.header.drift}: <strong>{formatDrift(snap.schedule.roundDriftSec)}</strong></span>
      {/if}
    </p>
  </div>

  <div class="header__group header__group--links">
    <ul class="header__links" aria-label={S.links.title}>
      {#each LINK_NAMES as name (name)}
        <ConnChip {name} link={links[name]} />
      {/each}
    </ul>
    <p class="header__secondary header__device">
      {#if model.show.demo}<span class="header__demo">{S.header.demo(model.show.demo)}</span>{/if}
      <span class="header__label" data-state={model.label ? 'set' : 'unset'}>
        <span class="visually-hidden">{S.header.device}: </span>{model.label ?? S.header.noLabel}
      </span>
      <button type="button" class="header__menu" onclick={onmenu}>
        <Icon name="menu" /><span>{S.header.menu}</span>
      </button>
    </p>
  </div>
</header>
