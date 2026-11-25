<!--
  The ring next to "Ara sona" (the Consola-Anell board), drawn from logic/now-ring.ts:
  - auto: an orange ring empties to the next auto-advance, the seconds in the middle; autoLast: the last
    seconds in red with a halo (hook ring-last: the number ticks each second);
  - spinning: a segmented orange ring turns around a spinning record (hook ring-spin);
  - suspense: a gold ring empties to the auto-release, with the drum and the seconds;
  - manual / manualFinal: an orange disc with Següent's icon that breathes (hook ring-manual);
  - talk (blue) / stay (purple): a full ring with a pause sign; checking: a green disc with the rosette;
    checkFailed: a red disc with a cross; paused: hazard stripes with a pause sign;
  - waiting: the empty ring with "—".
  The badge on the corner names the mode. Each state's centre fades in when the state changes (ring-state).
-->
<script lang="ts">
  import type { IconName } from '../icons.ts';
  import type { RingBadge, RingView } from '../logic/now-ring.ts';
  import { S } from '../strings.ts';
  import Icon from './Icon.svelte';

  let { view }: { view: RingView } = $props();

  const uid = $props.id();
  const L = S.nowPlaying.ring.label;
  const seconds = $derived(view.countdown && !view.countdown.done ? view.countdown.secondsLeft : null);
  const offset = $derived(view.countdown ? 100 - Math.min(1, Math.max(0, view.countdown.remaining)) * 100 : 100);
  const label = $derived.by(() => {
    switch (view.state) {
      case 'auto':
      case 'autoLast':
        return seconds === null ? L.waiting : L.auto(seconds);
      case 'spinning':
        return L.spinning(seconds);
      case 'suspense':
        return L.suspense(seconds);
      case 'talk':
      case 'stay':
        return L.held;
      default:
        return L[view.state];
    }
  });
  const BADGE_ICON: Record<NonNullable<RingBadge>, IconName> = { auto: 'auto', autoOff: 'autoOff', final: 'flag', talk: 'hold', stay: 'stay', held: 'pause' };
  const counting = $derived(view.state === 'auto' || view.state === 'autoLast' || view.state === 'suspense');
  const disc = $derived(view.state === 'manual' || view.state === 'manualFinal' || view.state === 'lastStanding' || view.state === 'checking' || view.state === 'checkFailed');
  const paused = $derived(view.state === 'talk' || view.state === 'stay' || view.state === 'paused');
  const anim = $derived(
    ['countdown-ring', view.state === 'spinning' ? 'ring-spin' : null, view.state === 'autoLast' ? 'ring-last' : null, disc && (view.state.startsWith('manual') || view.state === 'lastStanding') ? 'ring-manual' : null]
      .filter(Boolean)
      .join(' '),
  );
</script>

<span class="now-ring" data-anim={anim} data-state={view.state} role="timer" aria-label={label} title={label}>
  <svg class="now-ring__svg" viewBox="0 0 112 112" aria-hidden="true" focusable="false">
    {#if view.state === 'paused'}
      <defs>
        <pattern id="{uid}-hazard" width="12" height="12" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <rect width="12" height="12" class="now-ring__hazard-a" />
          <rect width="6" height="12" class="now-ring__hazard-b" />
        </pattern>
      </defs>
    {/if}
    {#if view.state === 'autoLast'}<circle class="now-ring__halo" cx="56" cy="56" r="55" />{/if}
    <circle class="now-ring__track" cx="56" cy="56" r="46" />
    {#if counting}
      <circle class="now-ring__fill" cx="56" cy="56" r="46" pathLength="100" stroke-dasharray="100" stroke-dashoffset={offset} transform="rotate(-90 56 56)" />
    {:else if view.state === 'spinning'}
      <g class="now-ring__spin">
        <circle class="now-ring__segments" cx="56" cy="56" r="46" pathLength="120" stroke-dasharray="6.2 3.8" />
      </g>
      <g class="now-ring__record">
        <circle class="now-ring__record-disc" cx="56" cy="56" r="24" />
        <circle class="now-ring__record-groove" cx="56" cy="56" r="17" />
        <circle class="now-ring__record-label" cx="56" cy="56" r="8" />
        <circle class="now-ring__record-hole" cx="56" cy="56" r="2.5" />
        <path class="now-ring__record-shine" d="M41 47a17 17 0 0 1 8-8" />
      </g>
    {:else if paused}
      <circle class="now-ring__full" cx="56" cy="56" r="46" stroke={view.state === 'paused' ? `url(#${uid}-hazard)` : undefined} />
      <rect class="now-ring__bar" x="38" y="36" width="13" height="40" rx="4" />
      <rect class="now-ring__bar" x="61" y="36" width="13" height="40" rx="4" />
    {:else if disc}
      <circle class="now-ring__disc" cx="56" cy="56" r="31" />
    {/if}
  </svg>

  {#key view.state}
    <span class="now-ring__centre" data-anim="ring-state">
      {#if view.state === 'auto' || view.state === 'autoLast'}
        {#key seconds}
          <span class="now-ring__value" data-tick={view.state === 'autoLast' || undefined}>{seconds ?? '—'}{#if seconds !== null}<span class="now-ring__unit"> s</span>{/if}</span>
        {/key}
      {:else if view.state === 'suspense'}
        <Icon name="suspense" />
        <span class="now-ring__value now-ring__value--small">{seconds ?? '—'}{#if seconds !== null}<span class="now-ring__unit"> s</span>{/if}</span>
      {:else if view.state === 'manual' || view.state === 'manualFinal'}
        <span class="now-ring__pulse"><Icon name="next" outline /></span>
      {:else if view.state === 'lastStanding'}
        <span class="now-ring__pulse"><Icon name="claim" outline /></span>
      {:else if view.state === 'checking'}
        <Icon name="claim" outline />
      {:else if view.state === 'checkFailed'}
        <Icon name="cross" outline />
      {:else if view.state === 'waiting'}
        <span class="now-ring__value">—</span>
      {/if}
    </span>
  {/key}

  {#if view.badge}
    <span class="now-ring__badge" data-badge={view.badge} title={S.nowPlaying.ring.badge[view.badge]}>
      <Icon name={BADGE_ICON[view.badge]} /><span class="visually-hidden">{S.nowPlaying.ring.badge[view.badge]}</span>
    </span>
  {/if}
</span>
