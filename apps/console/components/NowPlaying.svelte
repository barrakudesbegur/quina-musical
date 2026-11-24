<!-- Now playing, with a ring counting down to the next auto-advance, and the last few landings. -->
<script lang="ts">
  import { CONSOLE } from '../config.ts';
  import { getConsole } from '../context.ts';
  import { autoAdvanceCountdown, autoAdvanceStatus } from '../logic/countdown.ts';
  import { S } from '../strings.ts';
  import CountdownRing from './CountdownRing.svelte';

  const model = getConsole();
  const snap = $derived(model.show.state);
  const auto = $derived(snap ? autoAdvanceCountdown(snap, model.show.now) : null);
  const why = $derived(snap ? autoAdvanceStatus(snap) : 'waiting');
  const recent = $derived(snap ? snap.landings.slice(0, -1).slice(-CONSOLE.recentLandings).reverse() : []);
  const autoText = $derived(
    { running: S.nowPlaying.autoIn, off: S.nowPlaying.autoOff, offFinal: S.nowPlaying.autoOffFinal, held: S.nowPlaying.autoHeld, spinning: S.nowPlaying.spinning, waiting: S.nowPlaying.idle }[why],
  );
</script>

{#if snap}
  <section class="panel now-playing" data-state={snap.status} aria-labelledby="now-playing-title">
    <h2 class="panel__title" id="now-playing-title">{S.nowPlaying.title}</h2>
    <div class="now-playing__body">
      <CountdownRing remaining={auto?.remaining ?? 0} seconds={auto?.secondsLeft ?? null} label={autoText} />
      <div class="now-playing__song">
        {#if snap.current}
          <p class="now-playing__name">{snap.current.title}</p>
          <p class="now-playing__artist">{snap.current.artist}</p>
        {:else}
          <p class="now-playing__name">{snap.holdMusic ? S.nowPlaying.holdMusic : S.nowPlaying.nothing}</p>
        {/if}
        {#if snap.queue.position >= 0}
          <p class="now-playing__position">{S.nowPlaying.position(snap.queue.position + 1, snap.queue.length)}</p>
        {/if}
        {#if model.lastSpin}
          <p class="now-playing__by" data-by={model.lastSpin.by ?? 'auto'}>{S.nowPlaying.lastSpinBy(model.lastSpin.by)}</p>
        {/if}
        <p class="now-playing__auto" data-auto={why}>{why === 'spinning' || why === 'held' ? autoText : `${S.status[snap.status]} · ${autoText}`}</p>
      </div>
    </div>
    {#if recent.length}
      <div class="now-playing__recent">
        <h3 class="panel__subtitle">{S.nowPlaying.recent}</h3>
        <ol class="recent-list">
          {#each recent as landing (landing.position + ':' + landing.atMs)}
            <li class="recent-list__item" data-state={landing.undone ? 'undone' : 'counted'}>
              <span class="recent-list__position">{landing.position + 1}.</span>
              {landing.title}{#if landing.undone}<span class="recent-list__undone"> · {S.nowPlaying.undone}</span>{/if}
            </li>
          {/each}
        </ol>
      </div>
    {/if}
  </section>
{/if}
