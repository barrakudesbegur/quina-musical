<!--
  Now playing: the cover, title and artist, and a ring counting down to the next auto-advance. A small green
  badge on the ring's corner says auto-advance applies; the ring's label says why it isn't running. Under the
  artist, who started the last Spin (this device's label names it), and a note when the final phase stopped
  auto-advance by itself.
-->
<script lang="ts">
  import { getConsole } from '../context.ts';
  import { autoAdvanceCountdown, autoAdvanceStatus, autoModeOn } from '../logic/countdown.ts';
  import { S } from '../strings.ts';
  import CountdownRing from './CountdownRing.svelte';
  import Cover from './Cover.svelte';
  import Icon from './Icon.svelte';

  const model = getConsole();
  const uid = $props.id();
  const snap = $derived(model.show.state);
  const auto = $derived(snap ? autoAdvanceCountdown(snap, model.show.now) : null);
  const why = $derived(snap ? autoAdvanceStatus(snap) : 'waiting');
  const autoOn = $derived(snap ? autoModeOn(snap) : false);
  const autoText = $derived(
    { running: S.nowPlaying.autoIn, off: S.nowPlaying.autoOff, offFinal: S.nowPlaying.autoOffFinal, held: S.nowPlaying.autoHeld, spinning: S.nowPlaying.spinning, waiting: S.nowPlaying.idle }[why],
  );
</script>

{#if snap}
  <section class="panel now-playing" data-state={snap.status} aria-labelledby="{uid}-title">
    <Cover songId={snap.current?.songId ?? null} size="lg" />
    <div class="now-playing__song">
      <h2 class="panel__label" id="{uid}-title">{S.nowPlaying.title}</h2>
      {#if snap.current}
        <p class="now-playing__name">{snap.current.title}</p>
        <p class="now-playing__artist">{snap.current.artist}</p>
      {:else}
        <p class="now-playing__name">{snap.holdMusic ? S.nowPlaying.holdMusic : S.nowPlaying.nothing}</p>
      {/if}
      {#if model.lastSpin}
        <p class="now-playing__by" data-by={model.lastSpin.by ?? 'auto'}>{S.nowPlaying.lastSpinBy(model.lastSpin.by)}</p>
      {/if}
      {#if why === 'offFinal'}<p class="now-playing__note">{S.nowPlaying.autoOffFinal}</p>{/if}
    </div>
    <div class="now-playing__ring">
      <CountdownRing remaining={auto?.remaining ?? 0} seconds={auto?.secondsLeft ?? null} label={autoText} unit="s" />
      {#if autoOn}
        <span class="auto-badge" title={S.nowPlaying.autoBadge}>
          <Icon name="auto" /><span class="visually-hidden">{S.nowPlaying.autoBadge}</span>
        </span>
      {/if}
    </div>
  </section>
{/if}
