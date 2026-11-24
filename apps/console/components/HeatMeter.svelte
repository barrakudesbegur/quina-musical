<!--
  The real Heat as a wide bar, with a mark where each Phase starts and the Phase names under it, each in its
  own column; the current one in the text colour and bold. A small ▼ on top of the bar points at the current
  Heat. The zones come from the engine's Heat bands (logic/phase-zones.ts); without
  them only the current Phase is named. The label always names the engine's Phase, never one read off the bar.
-->
<script lang="ts">
  import type { PhaseName, WinKind } from '@quina/protocol';
  import { zoneColumns, zoneMarks, type PhaseZone } from '../logic/phase-zones.ts';
  import { S } from '../strings.ts';

  interface Props {
    /** 0..100, or null without cards in play. */
    percent: number | null;
    phase: PhaseName;
    zones: readonly PhaseZone[] | null;
    /** A presenter fixed the Phase from the menu. */
    fixed: boolean;
    climbing: WinKind;
  }

  let { percent, phase, zones, fixed, climbing }: Props = $props();
  const text = $derived(S.header.heatText(percent, S.phase[phase], S.climbing[climbing], fixed));
</script>

<div class="heat" data-state={percent === null ? 'none' : 'on'} data-phase={phase} data-fixed={fixed || undefined}>
  <div class="heat__track" style:--heat={(percent ?? 0) / 100}>
    <div class="heat__bar" role="meter" aria-label={S.header.heat} aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent ?? 0} aria-valuetext={text}>
      <span class="heat__fill"></span>
      {#each zones ? zoneMarks(zones) : [] as at (at)}
        <span class="heat__mark" style:left="{at * 100}%"></span>
      {/each}
    </div>
    {#if percent !== null}
      <span class="heat__rail" data-anim="heat-pointer" aria-hidden="true">
        <svg class="heat__pointer" viewBox="0 0 18 13" focusable="false"><path d="M2.5 2h13L9 11z" /></svg>
      </span>
    {/if}
  </div>
  {#if zones}
    <div class="heat__zones" style:grid-template-columns={zoneColumns(zones)} aria-hidden="true">
      {#each zones as zone (zone.phase)}
        <span class="heat__zone" data-current={zone.phase === phase || undefined} title={zone.phase === phase && fixed ? S.header.phaseFixed : undefined}>
          {S.phase[zone.phase]}
        </span>
      {/each}
    </div>
  {:else}
    <p class="heat__zones heat__zones--single" aria-hidden="true">
      <span class="heat__zone" data-current title={fixed ? S.header.phaseFixed : undefined}>{S.phase[phase]}</span>
    </p>
  {/if}
</div>
