<!--
  The Futur tab, the crystal ball (PRIVATE: never the public feed, the projector or the phones). Hidden until a
  presenter taps "Mirar el futur", so the presenters stay curious too; it hides again for a new round. Revealed
  (hook reveal: it unblurs and fades in, the bars grow with a stagger): how many cards have each number of
  marked songs, the songs left until the first possible Line and Quina, and the possible winners. What the
  console can't know shows "—" (logic/future.ts says why). In the Desgraciat round: the songs left until one card
  stands (`lastStandingAt`) and a small chart of the standing count after each of the next songs (`standingCurve`);
  no possible winners (the Dempeus tab says who is left).
-->
<script lang="ts">
  import { roundCardType } from '@quina/protocol';
  import { getConsole } from '../context.ts';
  import { futureView, type SongsAhead } from '../logic/future.ts';
  import { standingFuture } from '../logic/standing.ts';
  import { songTitleOf } from '../logic/show-data.ts';
  import { S } from '../strings.ts';
  import Icon from './Icon.svelte';

  const model = getConsole();
  const uid = $props.id();
  const snap = $derived(model.show.state);
  const view = $derived(
    snap
      ? futureView({
          engine: snap.future,
          position: snap.queue.position,
          printed: model.catalog?.cards ?? null,
          inPlay: model.inPlay,
          cardType: roundCardType(snap.round),
          counted: model.counted,
          possibleWinners: snap.possibleWinners,
          lineConfirmed: snap.round.lineConfirmed,
        })
      : null,
  );
  const desgraciat = $derived(snap?.round.kind === 'desgraciat');
  const standing = $derived(snap && desgraciat ? standingFuture(snap.future, snap.queue.position, snap.standing) : null);
  const tallest = $derived(standing ? Math.max(1, ...standing.curve.map((c) => c.standing)) : 1);
  const widest = $derived(view?.bars ? Math.max(1, ...view.bars.map((b) => b.cards)) : 1);
  const candidates = $derived(view ? [...view.winners.line, ...view.winners.bingo] : []);
  const title = (songId: number | null) => songTitleOf(songId, snap, model.catalog) ?? (songId === null ? '' : String(songId));
  const aheadText = (a: SongsAhead) =>
    a.state === 'now' ? (desgraciat ? S.future.lastNow : S.future.now) : a.state === 'done' ? S.future.done : a.state === 'in' ? S.future.inSongs(a.songs) : a.state === 'never' ? S.future.never : S.future.unknown;
</script>

{#if view}
  <div class="future" data-state={model.futureRevealed ? 'revealed' : 'hidden'} data-private="true">
    {#if !model.futureRevealed}
      <div class="future__hidden">
        <p class="future__hidden-note">{S.future.hiddenNote}</p>
        <button type="button" class="mini future__show" data-anim="press" aria-controls="{uid}-body" onclick={() => model.revealFuture(true)}>
          <Icon name="eye" /><span>{S.future.show}</span>
        </button>
      </div>
    {:else if standing}
      <div class="future__body future__body--standing" id="{uid}-body" data-anim="reveal" data-testid="future-standing">
        <div class="future__ahead">
          <p class="future__box" data-state={standing.ahead.state}>
            <span class="future__box-label">{S.future.untilLast}</span>
            <span class="future__box-value">{aheadText(standing.ahead)}</span>
          </p>
        </div>
        {#if standing.curve.length}
          <section class="future__chart" aria-labelledby="{uid}-curve">
            <h3 class="panel__label" id="{uid}-curve">{S.future.curve}</h3>
            <ol class="standing-curve" style:--n={standing.curve.length}>
              {#each standing.curve as point, i (point.song)}
                <li class="standing-curve__bar" style:--i={i} style:--share={point.standing / tallest} title={S.future.curveBar(point.song, point.standing)} aria-label={S.future.curveBar(point.song, point.standing)}>
                  <span class="standing-curve__fill" aria-hidden="true"></span>
                </li>
              {/each}
            </ol>
            <p class="standing-curve__axis" aria-hidden="true"><span>{S.future.curveFirst}</span><span>{S.future.curveLast(standing.curve.length)}</span></p>
          </section>
        {/if}
        <p class="note">{S.future.noWinnersHere}</p>
      </div>
    {:else}
      <div class="future__body" id="{uid}-body" data-anim="reveal">
        <section class="future__chart" aria-labelledby="{uid}-chart">
          <h3 class="panel__label" id="{uid}-chart">{S.future.chart}</h3>
          {#if view.bars}
            <ol class="mark-bars">
              {#each view.bars as bar, i (bar.marked)}
                <li class="mark-bars__row" data-rank={Math.min(i, 3)} style:--i={i} aria-label={S.future.barLabel(bar.marked, bar.cards)}>
                  <span class="mark-bars__label" aria-hidden="true">{S.future.bar(bar.marked)}</span>
                  <span class="mark-bars__track" aria-hidden="true"><span class="mark-bars__fill" style:--share={bar.cards / widest}></span></span>
                  <span class="mark-bars__count" aria-hidden="true">{bar.cards}</span>
                </li>
              {/each}
            </ol>
            {#if view.validCount !== null}<p class="note">{S.future.validCount(view.validCount)}</p>{/if}
          {:else}
            <p class="future__unknown">{S.future.unknown}</p>
            {#if view.gap}<p class="note">{S.future.gaps[view.gap]}</p>{/if}
          {/if}
        </section>

        <section class="future__side" aria-label={S.future.winners}>
          <div class="future__ahead">
            {#each [{ key: 'line', label: S.future.firstLine, ahead: view.line }, { key: 'bingo', label: S.future.bingo, ahead: view.bingo }] as box (box.key)}
              <p class="future__box" data-state={box.ahead.state} title={box.ahead.state === 'unknown' ? S.future.exactPending : undefined}>
                <span class="future__box-label">{box.label}</span>
                <span class="future__box-value">{aheadText(box.ahead)}</span>
                {#if box.ahead.state === 'unknown' && box.ahead.atLeast !== null && box.ahead.atLeast > 0}
                  <span class="future__box-note">{S.future.atLeast(box.ahead.atLeast)}</span>
                {/if}
              </p>
            {/each}
          </div>

          <h3 class="panel__label">{S.future.winners}</h3>
          {#if model.inPlay.error}<p class="note note--warning">{S.future.inPlayError}</p>
          {:else if model.inPlay.ids === null}<p class="note">{S.future.noCardsInPlay}</p>{/if}
          {#if candidates.length === 0}
            <p class="note">{S.future.none}</p>
          {:else}
            <ul class="candidate-list">
              {#each candidates as c (c.kind + c.cardId)}
                <li class="candidate-list__item" data-kind={c.kind} data-state={c.notSold ? 'not-sold' : 'sold'}>
                  <strong class="candidate-list__card">#{c.cardId}</strong>
                  <span class="candidate-list__what">
                    {S.future.kind[c.kind]}{#if c.rows.length}&nbsp;· {S.future.rows(c.rows)}{/if}
                    {#if c.completedBy !== null}<span class="candidate-list__song"> {S.future.completedBy(title(c.completedBy))}</span>{/if}
                  </span>
                  {#if c.notSold}<span class="candidate-list__warn" title={S.future.notSoldLong}>{S.future.notSold}</span>{/if}
                </li>
              {/each}
            </ul>
          {/if}
        </section>
      </div>
    {/if}
  </div>
{/if}
