<script lang="ts">
  // Ara: what is happening now, by scene. In play: the reel and the current song, the two before it, the Heat.
  import { songTitle } from '../../ui/data/catalog.ts';
  import { formatClock } from '../../ui/rules/time.ts';
  import type { PlayerApp } from '../model.svelte.ts';
  import { plannedStarts, prizeRounds } from '../logic/view.ts';
  import { S } from '../strings.ts';
  import AddCardPrompt from './AddCardPrompt.svelte';
  import Countdown from './Countdown.svelte';
  import Cover from './Cover.svelte';
  import Heat from './Heat.svelte';
  import HowToPlay from './HowToPlay.svelte';
  import PrizeLines from './PrizeLines.svelte';
  import Reel from './Reel.svelte';
  import Shuffle from './Shuffle.svelte';

  let { app }: { app: PlayerApp } = $props();
  const prizes = $derived(prizeRounds(app.plan, app.state));
  const focusPrizes = $derived(prizes.find((r) => r.number === app.focusRound) ?? null);
  const justPlayed = $derived(prizes.find((r) => r.number === app.round?.number) ?? null);
  const previous = $derived(app.round ? [...app.round.landings].sort((a, b) => b.position - a.position).slice(1, 3) : []);
  const startAtMs = $derived(app.plan ? (plannedStarts(app.plan)?.get(app.plan.rounds[0]?.number ?? 1) ?? null) : null);
  const shuffle = $derived(app.state?.shuffle ?? null);
  const shuffling = $derived(shuffle !== null && app.cloudNow < shuffle.endAtMs);
  const special = $derived((app.state?.intro?.kind ?? app.round?.kind) === 'special');
  const HOUR = 60 * 60_000;
</script>

<section class="now" data-scene={app.scene}>
  {#if app.scene === 'before'}
    <h2 class="now__heading">{S.welcome}</h2>
    {#if !app.data.cards.length}
      <AddCardPrompt onadd={() => app.open({ kind: 'pad' })} />
    {/if}
    {#if startAtMs}
      <p class="now__when">
        {#if startAtMs - app.cloudNow > 0 && startAtMs - app.cloudNow < HOUR}
          <Countdown atMs={startAtMs} nowMs={app.cloudNow} label={(t) => `${S.startsAround(formatClock(startAtMs))} (${t})`} doneLabel={S.startsAround(formatClock(startAtMs))} />
        {:else}
          {S.startsAround(formatClock(startAtMs))}
        {/if}
      </p>
    {/if}
    <HowToPlay />
    <div class="now__links">
      <button type="button" class="big-button" onclick={() => app.selectTab('premis')}>{S.seePrizes}</button>
      <button type="button" class="big-button" onclick={() => app.selectTab('programa')}>{S.seeSchedule}</button>
    </div>
  {:else if app.scene === 'roundStart'}
    {#if app.focusRound !== null}<h2 class="now__heading">{S.round(app.focusRound)}</h2>{/if}
    {#if special}<p class="now__rule">{S.specialRule}</p>{/if}
    {#if shuffle}<Shuffle running={shuffling} />{/if}
    {#if focusPrizes}
      <h3 class="now__subheading">{S.prizesOf(focusPrizes.number)}</h3>
      <PrizeLines round={focusPrizes} />
    {/if}
  {:else if app.scene === 'interval'}
    <h2 class="now__heading">{S.interval}</h2>
    {#if app.state?.interval}
      <p class="now__next">{S.nextRound(app.state.interval.nextRound)}</p>
      <p class="now__countdown"><Countdown atMs={app.state.interval.guideEndMs} nowMs={app.cloudNow} label={S.startsIn} doneLabel={S.startsSoon} /></p>
    {/if}
    {#if focusPrizes}
      <h3 class="now__subheading">{S.prizesOf(focusPrizes.number)}</h3>
      <PrizeLines round={focusPrizes} />
    {/if}
    {#if justPlayed && justPlayed.lines.some((l) => l.winners.length)}
      <h3 class="now__subheading">{S.lastWinners}</h3>
      <PrizeLines round={justPlayed} mine={app.views} />
    {/if}
  {:else if app.scene === 'after'}
    <h2 class="now__heading">{S.thanks}</h2>
    <h3 class="now__subheading">{S.summary}</h3>
    <ul class="now__summary">
      {#each prizes.filter((r) => r.lines.some((l) => l.winners.length)) as round (round.number)}
        <li class="now__summary-round">
          <h4 class="now__summary-title">{S.round(round.number)}</h4>
          <PrizeLines {round} mine={app.views} />
        </li>
      {/each}
    </ul>
    <p class="now__bye">{S.seeYou}</p>
  {:else}
    <Reel
      spin={app.state?.spin ?? null}
      latest={app.latest}
      catalog={app.catalog}
      nowMs={app.cloudNow}
      clockOffsetMs={app.cloudNow - app.localNow}
      reduced={app.reducedMotion}
      ontick={() => app.blip('tick')}
    />
    {#if previous.length}
      <section class="now__previous">
        <h3 class="now__subheading">{S.previous}</h3>
        <ol class="song-list">
          {#each previous as l (l.position)}
            <li class="song-list__item">
              <Cover songId={l.songId} size="sm" />
              <span class="song-list__title">{songTitle(app.catalog, l.songId)}</span>
            </li>
          {/each}
        </ol>
      </section>
    {/if}
    {#if app.heat !== null}<Heat value={app.heat} />{/if}
  {/if}
</section>
