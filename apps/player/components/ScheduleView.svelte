<script lang="ts">
  // The Horari drawer (the J2 look, D87): the night's rounds on a line of dots, each with its time (when it started,
  // or "~" when it should), the current one on paper with "Ara". Tapping a round stacks its prizes on top. Above the
  // list, only what helps now: the Interval's countdown and the rough end of the night.
  import { formatClock } from '../../../packages/rules/time.ts';
  import type { PlayerApp } from '../model.svelte.ts';
  import { plannedStarts, prizeRounds, roundKindOf } from '../logic/view.ts';
  import { S } from '../strings.ts';
  import Countdown from './Countdown.svelte';
  import Icon from './Icon.svelte';
  import RoundMark from './RoundMark.svelte';

  let { app, onround }: { app: PlayerApp; onround: (round: number) => void } = $props();
  const starts = $derived(plannedStarts(app.plan));
  const rounds = $derived(prizeRounds(app.plan, app.state));
  const started = $derived(new Map((app.state?.rounds ?? []).map((r) => [r.number, r.startedAtMs] as const)));
  /** When it started, else when it should ("~10:40"), else nothing. */
  function timeOf(number: number): string {
    const at = started.get(number);
    if (at) return formatClock(at);
    const planned = starts?.get(number);
    return planned ? `~${formatClock(planned)}` : '';
  }
</script>

<section class="schedule">
  {#if app.scene === 'before'}<p class="schedule__note">{S.notStarted}</p>{/if}
  {#if app.scene === 'interval' && app.state?.interval}
    <p class="schedule__note">
      {S.nextRound(S.roundName(app.state.interval.nextRound, roundKindOf(app.state.interval.nextRound, app.state, app.plan)))}:
      <Countdown atMs={app.state.interval.guideEndMs} nowMs={app.cloudNow} label={S.startsIn} doneLabel={S.startsSoon} />
    </p>
  {/if}
  {#if app.state?.gameEndMs && app.scene !== 'after'}
    <p class="schedule__note">{S.endsAround(formatClock(app.state.gameEndMs))}</p>
  {/if}
  {#if rounds.length}
    <ol class="schedule__rounds">
      {#each rounds as round (round.number)}
        {@const name = S.roundTitle(round.number, round.kind)}
        <li class="schedule__round" data-state={round.state} data-kind={round.kind}>
          <button type="button" class="schedule__round-button" aria-label={S.prizesOf(name)} onclick={() => onround(round.number)}>
            <span class="schedule__round-time">{timeOf(round.number)}</span>
            <span class="schedule__dot"><RoundMark kind={round.kind} /></span>
            <span class="schedule__round-name">{name}</span>
            {#if round.state === 'current'}<span class="schedule__round-state">{S.roundState.current}</span>{/if}
            <span class="schedule__chevron"><Icon name="chevron" /></span>
          </button>
        </li>
      {/each}
    </ol>
  {:else}
    <p class="schedule__empty">{S.noPlan}</p>
  {/if}
</section>
