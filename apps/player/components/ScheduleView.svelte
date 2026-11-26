<script lang="ts">
  // The Horari drawer (the J2 look, D87; board Mobil-B-J2): the night on a line of dots (logic/timeline.ts), each row
  // with its time (when it started, or "~" when it should). It opens with "Venda de cartrons" (D152). Rounds: gold and
  // ticked once done, the current one on paper with "Ara", the rest still to come; tapping one stacks its prizes on
  // top. A planned Throw's descans follows its round ("Primer descans", D150), and the end ("Fi", replacing "Acabarem
  // cap a les…") closes the list. The doors, the descans and the end are quiet: italic, on a dashed dot, each with its
  // icon (a ticket, a cup, the finish flag). Above the list, only what helps now: "not started yet" before the Game,
  // and the Interval's countdown.
  import { formatClock } from '../../../packages/rules/time.ts';
  import type { PlayerApp } from '../model.svelte.ts';
  import { timelineKey, timelineOf, type TimelineRow } from '../logic/timeline.ts';
  import { roundKindOf } from '../logic/view.ts';
  import { S } from '../strings.ts';
  import Countdown from './Countdown.svelte';
  import Icon, { type IconName } from './Icon.svelte';
  import RoundMark from './RoundMark.svelte';

  let { app, onround }: { app: PlayerApp; onround: (round: number) => void } = $props();
  const rows = $derived(timelineOf(app.plan, app.state));
  const hasRounds = $derived(rows.some((r) => r.kind === 'round'));
  const timeOf = (row: TimelineRow): string => (row.atMs === null ? '' : `${row.predicted ? '~' : ''}${formatClock(row.atMs)}`);
  /** The quiet rows' icon and name. */
  const MOMENT_ICON: Record<Exclude<TimelineRow['kind'], 'round'>, IconName> = { doors: 'ticket', throw: 'cup', end: 'flag' };
  const momentName = (row: Exclude<TimelineRow, { kind: 'round' }>): string =>
    row.kind === 'doors' ? S.scheduleDoors : row.kind === 'throw' ? S.scheduleThrow(row.order) : S.scheduleEnd;
</script>

<section class="schedule">
  {#if app.scene === 'before'}<p class="schedule__note">{S.notStarted}</p>{/if}
  {#if app.scene === 'interval' && app.state?.interval}
    <p class="schedule__note">
      {S.nextRound(S.roundName(app.state.interval.nextRound, roundKindOf(app.state.interval.nextRound, app.state, app.plan)))}:
      <Countdown atMs={app.state.interval.guideEndMs} nowMs={app.cloudNow} label={S.startsIn} doneLabel={S.startsSoon} />
    </p>
  {/if}
  {#if hasRounds}
    <ol class="schedule__rounds">
      {#each rows as row (timelineKey(row))}
        {#if row.kind === 'round'}
          {@const name = S.roundTitle(row.number, row.roundKind)}
          {@const number = row.number}
          <li class="schedule__round" data-state={row.state} data-kind={row.roundKind}>
            <button type="button" class="schedule__round-button" aria-label={S.prizesOf(name)} onclick={() => onround(number)}>
              <span class="schedule__round-time">{timeOf(row)}</span>
              <span class="schedule__dot">
                {#if row.roundKind !== 'normal'}<RoundMark kind={row.roundKind} />{:else if row.state === 'done'}<Icon name="tick" />{/if}
              </span>
              <span class="schedule__round-name">{name}</span>
              {#if row.state === 'current'}<span class="schedule__round-state">{S.roundState.current}</span>{/if}
              <span class="schedule__chevron"><Icon name="chevron" /></span>
            </button>
          </li>
        {:else}
          <li class="schedule__moment" data-state={row.state} data-kind={row.kind}>
            <span class="schedule__round-time">{timeOf(row)}</span>
            <span class="schedule__dot"><Icon name={MOMENT_ICON[row.kind]} /></span>
            <span class="schedule__moment-name">{momentName(row)}</span>
          </li>
        {/if}
      {/each}
    </ol>
  {:else}
    <p class="schedule__empty">{S.noPlan}</p>
  {/if}
</section>
