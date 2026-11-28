<!--
  Always visible, in three panels (they stack on a phone):
  - the round: "Quina N" (or "Quina Especial", or "Desgraciat", the Quina del Desgraciat's short name: D251) and the
    real Heat, with the Phase marked on it (HeatMeter); before the night (no round yet) the bar is empty and unnamed;
  - the time: the clock, the round's and the night's expected ends (flag, moon), and the Drift chip (not before the
    night: there is no round to be late in);
  - the links: the connection chips and the menu. This device's label lives in the menu; it still names
    who pressed what.
-->
<script lang="ts">
  import IconButton from '../../../packages/ui/components/IconButton.svelte';
  import { ICONS } from '../actions.ts';
  import { clockParts, formatClock, formatDrift } from '../../../packages/rules/time.ts';
  import { getConsole, getWii } from '../context.ts';
  import { HEAT_BANDS } from '../logic/engine-rules.ts';
  import { phaseZones } from '../logic/phase-zones.ts';
  import { HEADER_CHIPS, driftTone, headerChips, heatPercent, linksOf, roundOnScreen } from '../logic/status.ts';
  import { S } from '../strings.ts';
  import ConnChip from './ConnChip.svelte';
  import HeatMeter from './HeatMeter.svelte';
  import Icon from './Icon.svelte';

  let { onmenu }: { onmenu: () => void } = $props();

  const ZONES = phaseZones(HEAT_BANDS);
  const model = getConsole();
  const wii = getWii();
  const snap = $derived(model.show.state);
  const flow = $derived(model.show.flow);
  const round = $derived(roundOnScreen(snap, flow));
  /** Before the night: no Heat, no Phase and no Drift yet (the engine's are a placeholder round's). */
  const before = $derived(flow.scene === 'before');
  const clock = $derived(clockParts(model.show.now));
  const chips = $derived(headerChips(linksOf(model.show.connected, model.show.showOnline, wii.linkStatus)));
</script>

<header class="header" data-scene={flow.scene} data-stale={!model.online || undefined}>
  <div class="header__panel header__panel--round">
    <p class="header__round">{round ? S.roundShort(round, model.plan) : S.header.noRound}</p>
    {#if snap}
      <HeatMeter percent={before ? null : heatPercent(snap.heat)} phase={before ? null : snap.phase} zones={ZONES} fixed={snap.game.phaseOverride !== null} climbing={snap.cards.climbingTo} />
    {/if}
  </div>

  <div class="header__panel header__panel--time">
    <p class="header__clock">
      <span class="visually-hidden">{S.header.clock}: </span>
      {#if clock}<time>{clock.time}<span class="header__period"> {clock.period}</span></time>{:else}—{/if}
    </p>
    {#if snap}
      <p class="header__ends">
        <span class="header__end" title={S.header.roundEnd}>
          <Icon name="flag" /><span class="visually-hidden">{S.header.roundEnd}: </span>{formatClock(snap.schedule.roundEndMs)}
        </span>
        <span class="header__end header__end--night" title={S.header.gameEnd}>
          <Icon name="moon" /><span class="visually-hidden">{S.header.gameEnd}: </span>{formatClock(snap.schedule.gameEndMs)}
        </span>
      </p>
      {#if !before}
        <p class="header__drift" data-tone={driftTone(snap.schedule.roundDriftSec)} title={S.header.drift}>
          <span class="visually-hidden">{S.header.drift}: </span>{formatDrift(snap.schedule.roundDriftSec)}
        </p>
      {/if}
    {/if}
  </div>

  <div class="header__panel header__panel--links">
    <ul class="header__links" aria-label={S.links.title}>
      {#each HEADER_CHIPS as id (id)}
        <!-- The phones' count has no source yet: "Mòbils —". -->
        <ConnChip {id} label={S.links.chips[id]} link={chips[id]} value={id === 'feed' ? null : undefined} />
      {/each}
    </ul>
    {#if model.show.demo}<span class="header__demo">{S.header.demo(model.show.demo)}</span>{/if}
    <IconButton {...ICONS.menu} class="header__menu" aria-haspopup="dialog" onclick={onmenu} />
  </div>
</header>
