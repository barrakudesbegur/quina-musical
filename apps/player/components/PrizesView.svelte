<script lang="ts">
  // The Premis drawer: every round's Line and Quina prizes from the plan (the Desgraciat round's single bundle, the last
  // card standing's), and which were already won (never by which card); one round's only when opened from Horari.
  // Its content is being redesigned from the prizes model and real data (U30); this is the previous content.
  import type { PlayerApp } from '../model.svelte.ts';
  import { prizeRounds } from '../logic/view.ts';
  import { S } from '../strings.ts';
  import PrizeLines from './PrizeLines.svelte';
  import RoundMark from './RoundMark.svelte';

  let { app, round: only }: { app: PlayerApp; round?: number } = $props();
  const all = $derived(prizeRounds(app.plan, app.state, app.data.cards.map((c) => c.id)));
  const rounds = $derived(only === undefined ? all : all.filter((r) => r.number === only));
</script>

<section class="prizes">
  {#if !rounds.length}
    <p class="prizes__empty">{S.noPlan}</p>
  {/if}
  <ol class="prizes__list">
    {#each rounds as round (round.number)}
      <!-- A round whose bundles show takes the whole width (a hamper is long); a locked one is a small tile, two by two. -->
      <li class="prize-round" data-state={round.state} data-kind={round.kind} data-open={!round.lockedUntil || round.lines.some((l) => l.won)}>
        <h3 class="prize-round__title">
          <RoundMark kind={round.kind} />
          {S.roundName(round, app.plan)}
          {#if S.roundState[round.state]}<span class="prize-round__state">{S.roundState[round.state]}</span>{/if}
        </h3>
        <PrizeLines {round} mine={app.data.cards} />
      </li>
    {/each}
  </ol>
</section>
