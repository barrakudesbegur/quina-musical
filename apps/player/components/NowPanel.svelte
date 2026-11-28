<script lang="ts">
  // The top of Ara, in the drum's place: what is happening now, by scene. In play: the drum with the song playing
  // now (Historial, right under it, lists the rest). `compact` shrinks the drum to a strip, so the player's cards
  // get the room; `stopped` freezes it while the phone is offline. (The Heat garland hangs across the top of every
  // screen: App.svelte.)
  import { DEFAULT_SIDE, defaultCardType } from '../feed/public.ts';
  import { formatClock } from '../../../packages/rules/time.ts';
  import type { PlayerApp } from '../model.svelte.ts';
  import { plannedStarts, prizeRounds, roundNameOf } from '../logic/view.ts';
  import { roundOrder, roundSongs } from '../logic/drum.ts';
  import { ninoFor, type NinoMoment } from '../../../packages/ui/concepts.ts';
  import { ninoUrl } from '../../../packages/ui/ninos.ts';
  import SponsorList from '../../../packages/ui/components/SponsorList.svelte';
  import { S } from '../strings.ts';
  import Countdown from './Countdown.svelte';
  import ClockText from './ClockText.svelte';
  import PrizeLines from './PrizeLines.svelte';
  import Reel from './Reel.svelte';
  import RoundMark from './RoundMark.svelte';
  import Shuffle from './Shuffle.svelte';

  /** The scene's nino for this round (NINO_FOR; the user's canvas comment #86): a different one from round to round. */
  const sticker = (moment: NinoMoment, seed: number | null | undefined): string | undefined =>
    seed === null || seed === undefined ? undefined : `url("${ninoUrl(ninoFor(moment, seed))}")`;

  let {
    app,
    compact = false,
    stopped = false,
    marks = [],
    onpick,
  }: {
    app: PlayerApp;
    compact?: boolean;
    stopped?: boolean;
    /** The phone's cards holding the song playing now (their identities), for the drum's strip (§8 Y2). */
    marks?: readonly number[];
    /** A tap on the drum goes to the first of those cards (`drum-pick`). */
    onpick?: () => void;
  } = $props();
  const prizes = $derived(prizeRounds(app.plan, app.state, app.data.cards.map((c) => c.id)));
  const focusPrizes = $derived(prizes.find((r) => r.number === app.focusRound) ?? null);
  const justPlayed = $derived(prizes.find((r) => r.number === app.round?.number) ?? null);
  const startAtMs = $derived(app.plan ? (plannedStarts(app.plan)?.get(app.plan.rounds[0]?.number ?? 1) ?? null) : null);
  const shuffle = $derived(app.state?.shuffle ?? null);
  const shuffling = $derived(shuffle !== null && app.cloudNow < shuffle.endAtMs);
  const HOUR = 60 * 60_000;
  // The drum (§8 Y1, D237): the projector's tiles in the projector's order, the round's songs (those printed on its card
  // type's side) in drumOrder from its public drumSeed (logic/drum.ts).
  const round = $derived(app.round);
  const songs = $derived(round ? roundSongs(app.catalog, round.cardType ?? defaultCardType(round.kind), round.side ?? DEFAULT_SIDE) : []);
  const order = $derived(round ? roundOrder(songs, round.drumSeed, round.number) : []);
  const sponsors = $derived((app.plan?.sponsors ?? []).map((s) => ({ name: s.name, logo: s.logo })));
  const nextNumber = $derived(app.state?.interval?.nextRound ?? null);
  const nextName = $derived(nextNumber === null ? '' : roundNameOf(nextNumber, app.state, app.plan));
</script>

<!-- «Gràcies als col·laboradors» (boards M31, M32): every sponsor's logo, big, in a list that scrolls; a tap opens it
     larger (G4's SponsorList, the user's canvas comment #90). -->
{#snippet thanks()}
  {#if sponsors.length}
    <h3 class="now__subheading">{S.thanksSponsors}</h3>
    <SponsorList {sponsors} label={S.thanksSponsors} layout="row" />
  {/if}
{/snippet}

<section
  class="now"
  data-scene={app.scene}
  data-size={compact ? 'strip' : 'full'}
  style:--player-sticker-round={sticker('roundIntro', app.focusRound)}
  style:--player-sticker-interval={sticker('break', nextNumber)}
  style:--player-sticker-stand-up={sticker('standUp', app.focusRound)}
>
  {#if app.scene === 'before'}
    <!-- With no cards, the call to add them is the views' empty state under the switch (EmptyCards, D290). -->
    <h2 class="now__heading">{S.welcome}</h2>
    {#if startAtMs}
      <p class="now__when">
        {#if startAtMs - app.cloudNow > 0 && startAtMs - app.cloudNow < HOUR}
          <Countdown atMs={startAtMs} nowMs={app.cloudNow} label={(t) => `${S.startsAround(formatClock(startAtMs))} (${t})`} doneLabel={S.startsAround(formatClock(startAtMs))} />
        {:else}
          <ClockText text={S.startsAround(formatClock(startAtMs))} />
        {/if}
      </p>
    {/if}
  {:else if app.scene === 'roundStart'}
    {#if app.focusRound !== null}<h2 class="now__heading" data-kind={app.focusKind}><RoundMark kind={app.focusKind} />{S.roundName({ number: app.focusRound, kind: app.focusKind }, app.plan)}</h2>{/if}
    {#if shuffle}<Shuffle running={shuffling} />{/if}
    {#if focusPrizes}
      <h3 class="now__subheading">{S.prizesOf(S.roundName(focusPrizes, app.plan))}</h3>
      <PrizeLines round={focusPrizes} />
    {/if}
  {:else if app.scene === 'interval'}
    <h2 class="now__heading">{S.interval}</h2>
    {#if app.state?.interval}
      <p class="now__next">{S.nextRound(nextName)}</p>
      <p class="now__countdown"><Countdown atMs={app.state.interval.guideEndMs} nowMs={app.cloudNow} label={S.startsIn} doneLabel={S.startsSoon} /></p>
    {/if}
    {#if focusPrizes}
      <h3 class="now__subheading">{S.prizesOf(S.roundName(focusPrizes, app.plan))}</h3>
      <PrizeLines round={focusPrizes} />
    {/if}
    {#if justPlayed && justPlayed.lines.some((l) => l.won)}
      <h3 class="now__subheading">{S.lastWinners}</h3>
      <PrizeLines round={justPlayed} mine={app.data.cards} />
    {/if}
    {@render thanks()}
  {:else if app.scene === 'after'}
    <h2 class="now__heading">{S.thanks}</h2>
    <h3 class="now__subheading">{S.summary}</h3>
    <ul class="now__summary">
      {#each prizes.filter((r) => r.lines.some((l) => l.won)) as round (round.number)}
        <li class="now__summary-round">
          <h4 class="now__summary-title">{S.roundName(round, app.plan)}</h4>
          <PrizeLines {round} mine={app.data.cards} brief />
        </li>
      {/each}
    </ul>
    {@render thanks()}
    <p class="now__bye">{S.seeYou}</p>
  {:else}
    <Reel
      spin={app.state?.spin ?? null}
      latest={app.latest}
      catalog={app.catalog}
      {order}
      landings={round?.landings ?? []}
      nowMs={app.cloudNow}
      clockOffsetMs={app.cloudNow - app.localNow}
      reduced={app.reducedMotion}
      {compact}
      {stopped}
      {marks}
      {onpick}
    />
  {/if}
</section>
