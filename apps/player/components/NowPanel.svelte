<script lang="ts">
  // The top of Ara, in the drum's place: what is happening now, by scene. In play: the drum with the song playing
  // now (Historial, right under it, lists the rest). `compact` shrinks the drum to a strip, so the player's cards
  // get the room; `stopped` freezes it while the phone is offline. (The Heat garland hangs across the top of every
  // screen: App.svelte.)
  import { formatClock } from '../../../packages/rules/time.ts';
  import type { PlayerApp } from '../model.svelte.ts';
  import { historyOf, plannedStarts, prizeRounds, roundKindOf, roundRule } from '../logic/view.ts';
  import { drumSongs } from '../logic/reel.ts';
  import { S } from '../strings.ts';
  import AddCardPrompt from './AddCardPrompt.svelte';
  import Countdown from './Countdown.svelte';
  import PrizeLines from './PrizeLines.svelte';
  import Reel from './Reel.svelte';
  import RoundMark from './RoundMark.svelte';
  import Shuffle from './Shuffle.svelte';

  let { app, compact = false, stopped = false }: { app: PlayerApp; compact?: boolean; stopped?: boolean } = $props();
  const prizes = $derived(prizeRounds(app.plan, app.state, app.data.cards.map((c) => c.id)));
  const focusPrizes = $derived(prizes.find((r) => r.number === app.focusRound) ?? null);
  const justPlayed = $derived(prizes.find((r) => r.number === app.round?.number) ?? null);
  const startAtMs = $derived(app.plan ? (plannedStarts(app.plan)?.get(app.plan.rounds[0]?.number ?? 1) ?? null) : null);
  const shuffle = $derived(app.state?.shuffle ?? null);
  const shuffling = $derived(shuffle !== null && app.cloudNow < shuffle.endAtMs);
  // The round being introduced (else the current one) and which cards it counts: said unless it's a regular round
  // playing the normal cards.
  const introduced = $derived(app.state?.intro ?? app.round);
  const rule = $derived(introduced ? roundRule(introduced, app.cardTypes) : null);
  const HOUR = 60 * 60_000;
  // The drum's tiles: this round's songs still to come, never a landed one (logic/reel.ts drumSongs).
  const history = $derived(historyOf(app.state));
  const drum = $derived(drumSongs(app.catalog?.songs.keys() ?? [], new Set(history?.landings.map((l) => l.songId) ?? []), history?.round ?? 0));
  const nextNumber = $derived(app.state?.interval?.nextRound ?? null);
  const nextName = $derived(nextNumber === null ? '' : S.roundName(nextNumber, roundKindOf(nextNumber, app.state, app.plan)));
</script>

<section class="now" data-scene={app.scene} data-size={compact ? 'strip' : 'full'}>
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
  {:else if app.scene === 'roundStart'}
    {#if app.focusRound !== null}<h2 class="now__heading" data-kind={app.focusKind}><RoundMark kind={app.focusKind} />{S.roundName(app.focusRound, app.focusKind)}</h2>{/if}
    {#if rule && !rule.usual}<p class="now__rule">{S.typeRule(rule.name)}</p>{/if}
    {#if shuffle}<Shuffle running={shuffling} />{/if}
    {#if focusPrizes}
      <h3 class="now__subheading">{S.prizesOf(S.roundName(focusPrizes.number, focusPrizes.kind))}</h3>
      <PrizeLines round={focusPrizes} />
    {/if}
  {:else if app.scene === 'interval'}
    <h2 class="now__heading">{S.interval}</h2>
    {#if app.state?.interval}
      <p class="now__next">{S.nextRound(nextName)}</p>
      <p class="now__countdown"><Countdown atMs={app.state.interval.guideEndMs} nowMs={app.cloudNow} label={S.startsIn} doneLabel={S.startsSoon} /></p>
    {/if}
    {#if focusPrizes}
      <h3 class="now__subheading">{S.prizesOf(S.roundName(focusPrizes.number, focusPrizes.kind))}</h3>
      <PrizeLines round={focusPrizes} />
    {/if}
    {#if justPlayed && justPlayed.lines.some((l) => l.won)}
      <h3 class="now__subheading">{S.lastWinners}</h3>
      <PrizeLines round={justPlayed} mine={app.data.cards} />
    {/if}
  {:else if app.scene === 'after'}
    <h2 class="now__heading">{S.thanks}</h2>
    <h3 class="now__subheading">{S.summary}</h3>
    <ul class="now__summary">
      {#each prizes.filter((r) => r.lines.some((l) => l.won)) as round (round.number)}
        <li class="now__summary-round">
          <h4 class="now__summary-title">{S.roundName(round.number, round.kind)}</h4>
          <PrizeLines {round} mine={app.data.cards} brief />
        </li>
      {/each}
    </ul>
    <p class="now__bye">{S.seeYou}</p>
  {:else}
    <Reel
      spin={app.state?.spin ?? null}
      latest={app.latest}
      catalog={app.catalog}
      songs={drum}
      nowMs={app.cloudNow}
      clockOffsetMs={app.cloudNow - app.localNow}
      reduced={app.reducedMotion}
      {compact}
      {stopped}
      ontick={() => app.blip('tick')}
    />
  {/if}
</section>
