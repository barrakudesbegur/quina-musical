<script lang="ts">
  // Horari (first called "Programa"): progress ("Quina 4 de 12"), the countdown to the next round, the expected end, every round's
  // rough start time. The special round's dot carries a star, the Desgraciat round's a sad face (RoundMark).
  // Self-contained, so it can sit in a tab or a drawer.
  import { formatClock } from '../../../packages/rules/time.ts';
  import type { PlayerApp } from '../model.svelte.ts';
  import { plannedStarts, prizeRounds, progress, roundKindOf } from '../logic/view.ts';
  import { S } from '../strings.ts';
  import Countdown from './Countdown.svelte';
  import RoundMark from './RoundMark.svelte';

  let { app }: { app: PlayerApp } = $props();
  const where = $derived(progress(app.plan, app.state));
  const starts = $derived(plannedStarts(app.plan));
  const rounds = $derived(prizeRounds(app.plan, app.state));
</script>

<section class="schedule">
  <h2 class="schedule__heading">{S.scheduleTitle}</h2>
  <p class="schedule__progress">
    {#if app.scene === 'before' || !where}{S.notStarted}{:else}{S.roundOf(where.current, where.total)}{/if}
  </p>
  {#if app.scene === 'interval' && app.state?.interval}
    <p class="schedule__countdown">
      {S.nextRound(S.roundName(app.state.interval.nextRound, roundKindOf(app.state.interval.nextRound, app.state, app.plan)))}:
      <Countdown atMs={app.state.interval.guideEndMs} nowMs={app.cloudNow} label={S.startsIn} doneLabel={S.startsSoon} />
    </p>
  {/if}
  {#if app.state?.gameEndMs && app.scene !== 'after'}
    <p class="schedule__end">{S.endsAround(formatClock(app.state.gameEndMs))}</p>
  {/if}
  {#if rounds.length}
    <ol class="schedule__rounds">
      {#each rounds as round (round.number)}
        <li class="schedule__round" data-state={round.state} data-kind={round.kind}>
          <RoundMark kind={round.kind} />
          <span class="schedule__round-name">{S.roundName(round.number, round.kind)}{round.kind === 'special' ? ` · ${S.specialRound}` : ''}</span>
          {#if S.roundState[round.state]}<span class="schedule__round-state">{S.roundState[round.state]}</span>{/if}
          {#if starts?.get(round.number) && round.state !== 'done'}<span class="schedule__round-time">{S.around(formatClock(starts.get(round.number)))}</span>{/if}
        </li>
      {/each}
    </ol>
  {:else}
    <p class="schedule__empty">{S.noPlan}</p>
  {/if}
</section>
