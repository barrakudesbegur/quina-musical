<!--
  The Futur tab, the crystal ball (D170; the Consola-Pestanyes-Noves board, frames f and g; PRIVATE: never the public
  feed, the projector or the phones). Hidden until a presenter taps «Mirar el futur», so the presenters stay curious
  too; it hides again for a new round, or with «Amagar». Revealed (hook reveal: it unblurs and fades in):
  - on the left, the songs left until the first possible Line and Quina, and the possible winners: the cards that get
    them first, with how far ahead (+4), unsold ones flagged; before the order arrives, the engine's cards that have a
    win now;
  - on the right, the songs to come in order (the engine's `upcoming`, asked for by HelperTabs), each with how far
    ahead it is (+N) and, on its tag, how many songs are left until the next win, or the win it brings («Línia ·
    #112 #204»). The list keeps its place across tab switches.
  In the Desgraciat round the left side is the countdown to one card standing (`lastStandingAt`) and the standing
  count's curve, with no possible winners (Dempeus says who is left); the list counts down to the last one standing.
-->
<script lang="ts">
  import MiniButton from '../../../packages/ui/components/MiniButton.svelte';
  import { MINI } from '../actions.ts';
  import { roundCardType, roundSide } from '@quina/protocol';
  import { songTitle } from '../../../packages/ui/data/catalog.ts';
  import { getConsole } from '../context.ts';
  import { keepScroll } from '../keep-scroll.ts';
  import { futureView, type SongsAhead } from '../logic/future.ts';
  import { standingFuture } from '../logic/standing.ts';
  import { forecastTargets, upcomingRows, type Target, type UpcomingTag } from '../logic/upcoming.ts';
  import { S } from '../strings.ts';
  import SongRow from './SongRow.svelte';

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
          side: roundSide(snap.round),
          counted: model.counted,
          possibleWinners: snap.possibleWinners,
          lineConfirmed: snap.round.lineConfirmed,
          forecast: model.forecast,
        })
      : null,
  );
  const desgraciat = $derived(snap?.round.kind === 'desgraciat');
  const standing = $derived(snap && desgraciat ? standingFuture(snap.future, snap.queue.position, snap.standing) : null);
  const tallest = $derived(standing ? Math.max(1, ...standing.curve.map((c) => c.standing)) : 1);
  const title = (songId: number | null) => (songId === null ? '' : (model.songInfo.get(songId)?.title ?? songTitle(null, songId)));

  /** The possible winners: who gets the first Line and Quina (with the order), else the engine's cards that have one now. */
  const winners = $derived.by(() => {
    const forecast = model.forecast;
    if (forecast) return [forecast.line, forecast.bingo].flatMap((w) => (w ? w.winners.map((x) => ({ ...x, kind: w.kind, n: w.n })) : []));
    return view ? [...view.winners.line, ...view.winners.bingo].map((c) => ({ cardId: c.cardId, rows: c.rows, songId: c.completedBy, notSold: c.notSold, kind: c.kind, n: 0 })) : [];
  });

  /** What the list counts down to: the forecast's wins; without the cards, the engine's own numbers (no card numbers). */
  const targets = $derived.by((): Target[] => {
    if (!snap) return [];
    const from = (kind: Target['kind'], at: number | null | undefined): Target[] => (at == null || at <= snap.queue.position ? [] : [{ kind, n: at - snap.queue.position, cardIds: [] }]);
    if (desgraciat) return from('standing', snap.future?.lastStandingAt);
    if (model.forecast) return forecastTargets(model.forecast);
    return [...(snap.round.lineConfirmed ? [] : from('line', snap.future?.lineAt)), ...from('bingo', snap.future?.bingoAt)];
  });
  const rows = $derived(model.upcomingSongs ? upcomingRows(model.upcomingSongs, targets) : null);

  const aheadText = (a: SongsAhead) =>
    a.state === 'now' ? (desgraciat ? S.future.lastNow : S.future.now) : a.state === 'done' ? S.future.done : a.state === 'in' ? S.future.inSongs(a.songs) : a.state === 'never' ? S.future.never : S.future.unknown;
  const tagText = (tag: NonNullable<UpcomingTag>) => (tag.kind === 'count' ? S.future.count(tag.toward, tag.left) : tag.wins.map((w) => S.future.win(w.kind, w.cardIds)).join(' · '));
</script>

{#if view}
  <div class="future" data-state={model.futureRevealed ? 'revealed' : 'hidden'} data-private="true">
    {#if !model.futureRevealed}
      <div class="future__hidden">
        <p class="future__hidden-note">{S.future.hiddenNote}</p>
        <MiniButton {...MINI.futureShow} class="future__show" aria-controls="{uid}-body" onclick={() => model.revealFuture(true)} />
      </div>
    {:else}
      <div class="future__body" id="{uid}-body" data-anim="reveal" data-testid={standing ? 'future-standing' : 'future'}>
        <section class="future__side" aria-label={standing ? S.future.untilLast : S.future.winners}>
          {#if standing}
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
          {:else}
            <div class="future__ahead">
              {#each [{ key: 'line', label: S.future.firstLine, ahead: view.line }, { key: 'bingo', label: S.future.bingo, ahead: view.bingo }] as box (box.key)}
                <p class="future__box" data-state={box.ahead.state}>
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
            {#if winners.length === 0}
              <p class="note">{S.future.none}</p>
            {:else}
              <ul class="candidate-list">
                {#each winners as c (c.kind + c.cardId)}
                  <li class="candidate-list__item" data-kind={c.kind} data-state={c.notSold ? 'not-sold' : 'sold'} aria-label={S.future.winnerLabel(c.cardId, S.future.kind[c.kind], c.n)}>
                    <strong class="candidate-list__card" aria-hidden="true">#{c.cardId}</strong>
                    <span class="candidate-list__what" aria-hidden="true">
                      {S.future.kind[c.kind]}{#if c.rows.length}&nbsp;· {S.future.rows(c.rows)}{/if}
                      {#if c.n === 0 && c.songId !== null}<span class="candidate-list__song"> {S.future.completedBy(title(c.songId))}</span>{/if}
                    </span>
                    {#if c.notSold}<span class="candidate-list__warn" title={S.future.notSoldLong}>{S.future.notSold}</span>{/if}
                    <span class="candidate-list__at" aria-hidden="true">{S.future.at(c.n)}</span>
                  </li>
                {/each}
              </ul>
            {/if}
          {/if}
        </section>

        <section class="future__upcoming" aria-labelledby="{uid}-upcoming">
          <header class="future__upcoming-head">
            <h3 class="panel__label" id="{uid}-upcoming">{S.future.upcoming}</h3>
            <MiniButton {...MINI.futureHide} class="future__hide" onclick={() => model.revealFuture(false)} />
          </header>
          {#if rows === null}
            <p class="note">{S.future.waiting}</p>
          {:else if rows.length === 0}
            <p class="note">{S.future.noneLeft}</p>
          {:else}
            <ul class="song-list" {@attach keepScroll(model.scrolls, 'future')}>
              {#each rows as row (row.n)}
                <SongRow songId={row.song.songId} title={row.song.title} artist="" state={row.tag?.kind === 'win' ? 'win' : null}>
                  {#snippet lead()}<span class="song-row__offset">{S.future.offset(row.n)}</span>{/snippet}
                  {#snippet aside()}
                    {#if row.tag}<span class="upcoming-tag" data-kind={row.tag.kind}>{tagText(row.tag)}</span>{/if}
                  {/snippet}
                </SongRow>
              {/each}
            </ul>
          {/if}
        </section>
      </div>
    {/if}
  </div>
{/if}
