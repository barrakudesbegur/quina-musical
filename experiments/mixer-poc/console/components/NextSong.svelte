<!--
  The next song (PRIVATE: presenters only), with its cover, and a countdown to its landing while a transition
  runs, so a presenter can say it on the hit.
-->
<script lang="ts">
  import { coverUrl } from '../../ui/data/catalog.ts';
  import { getConsole } from '../context.ts';
  import { landingCountdown, suspenseCountdown } from '../logic/countdown.ts';
  import { S } from '../strings.ts';
  import CountdownRing from './CountdownRing.svelte';
  import Icon from './Icon.svelte';

  const model = getConsole();
  const snap = $derived(model.show.state);
  const next = $derived(snap?.next ?? null);
  const landing = $derived(snap ? landingCountdown(snap, model.show.now) : null);
  const suspense = $derived(snap ? suspenseCountdown(snap, model.show.now) : null);
  let failedCover = $state<number | null>(null);
</script>

<!-- Nothing to show before a round's Queue exists. -->
{#if snap && (next || snap.queue.length > 0)}
  <section class="panel next-song" data-private="true" data-state={landing ? 'landing' : suspense ? 'suspense' : 'waiting'} aria-labelledby="next-song-title">
    <h2 class="panel__title" id="next-song-title">{S.nextSong.title} <span class="badge badge--private">{S.nextSong.private}</span></h2>
    {#if next}
      <div class="next-song__body">
        {#if failedCover === next.songId}
          <span class="next-song__cover next-song__cover--missing" aria-hidden="true"><Icon name="music" /></span>
        {:else}
          {#key next.songId}
            <img class="next-song__cover" src={coverUrl(next.songId)} alt="" width="96" height="96" onerror={() => (failedCover = next.songId)} />
          {/key}
        {/if}
        <div class="next-song__song">
          <p class="next-song__name">{next.title}</p>
          <p class="next-song__artist">{next.artist}</p>
          {#if snap.pending === 'next'}<p class="next-song__pending">{S.nextSong.decoding}</p>{/if}
          {#if suspense}<p class="next-song__suspense">{S.nextSong.suspenseOpen}</p>{/if}
        </div>
        {#if landing}
          <div class="next-song__landing">
            <span class="next-song__landing-label">{S.nextSong.landsIn}</span>
            <CountdownRing remaining={landing.remaining} seconds={landing.secondsLeft} label={S.nextSong.landsIn} />
          </div>
        {/if}
      </div>
    {:else}
      <p class="next-song__none">{S.nextSong.none}</p>
    {/if}
  </section>
{/if}
