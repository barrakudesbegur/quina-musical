<!--
  The Estat tab (D170, D173; the Consola-Pestanyes-Noves board, frame a): the round's state, always visible, nothing of
  the future. On the left, how many cards miss each number of songs for a Line (for the Quina once the Line is
  confirmed), the bars growing in with a stagger (hook reveal's bars); on the right, the round's played songs.
  What the console can't count shows "—" and why (logic/future.ts chartView).
-->
<script lang="ts">
  import { roundCardType, roundSide } from '@quina/protocol';
  import { getConsole } from '../context.ts';
  import { chartView } from '../logic/future.ts';
  import { S } from '../strings.ts';
  import PlayedList from './PlayedList.svelte';

  const model = getConsole();
  const uid = $props.id();
  const snap = $derived(model.show.state);
  const chart = $derived(
    snap
      ? chartView({
          engine: snap.future,
          printed: model.catalog?.cards ?? null,
          inPlay: model.inPlay,
          cardType: roundCardType(snap.round),
          side: roundSide(snap.round),
          counted: model.counted,
          lineConfirmed: snap.round.lineConfirmed,
        })
      : null,
  );
  const widest = $derived(chart?.bars ? Math.max(1, ...chart.bars.map((b) => b.cards)) : 1);
</script>

{#if chart}
  <div class="state-tab" data-private="true">
    <section class="state-tab__chart" aria-labelledby="{uid}-chart">
      <h3 class="panel__label" id="{uid}-chart">{S.estat.chart(chart.kind)}</h3>
      {#if chart.bars}
        <ol class="miss-bars">
          {#each chart.bars as bar, i (bar.missing)}
            <li class="miss-bars__row" data-missing={bar.orMore ? 'more' : bar.missing} style:--i={i} aria-label={S.estat.rowLabel(bar.missing, bar.orMore, bar.cards)}>
              <span class="miss-bars__label" aria-hidden="true">{S.estat.row(bar.missing, bar.orMore)}</span>
              <span class="miss-bars__track" aria-hidden="true"><span class="miss-bars__fill" style:--share={bar.cards / widest}></span></span>
              <span class="miss-bars__count" aria-hidden="true">{bar.cards}</span>
            </li>
          {/each}
        </ol>
        {#if chart.validCount !== null}<p class="note">{S.estat.validCount(chart.validCount)}</p>{/if}
      {:else}
        <p class="state-tab__unknown">{S.estat.unknown}</p>
        {#if chart.gap}<p class="note">{S.estat.gaps[chart.gap]}</p>{/if}
      {/if}
    </section>
    <PlayedList sub={S.played.newest} scrollKey="state" />
  </div>
{/if}
