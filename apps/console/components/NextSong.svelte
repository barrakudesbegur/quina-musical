<!--
  The next song (PRIVATE: presenters only; the dashed frame marks it), with its cover, and while a transition
  runs the seconds to its landing, big, so a presenter can say it on the hit.
-->
<script lang="ts">
  import { getConsole } from '../context.ts';
  import { landingCountdown, suspenseCountdown } from '../logic/countdown.ts';
  import { S } from '../strings.ts';
  import { registerMorphRoot } from '../morph.ts';
  import Cover from './Cover.svelte';

  const model = getConsole();
  let root = $state<HTMLElement | null>(null);
  $effect(() => {
    registerMorphRoot('next', root);
    return () => registerMorphRoot('next', null);
  });
  const uid = $props.id();
  const snap = $derived(model.show.state);
  const next = $derived(snap?.next ?? null);
  const landing = $derived(snap ? landingCountdown(snap, model.show.now) : null);
  const suspense = $derived(snap ? suspenseCountdown(snap, model.show.now) : null);
  /** The finale has its winner: no more songs land (D180), so the next one isn't shown. */
  const finaleOver = $derived(snap?.finale?.winner != null);
</script>

<!-- Nothing to show before a round's Queue exists. -->
{#if snap && (next || snap.queue.length > 0)}
  <section bind:this={root} class="panel panel--private next-song" data-testid="next-song" data-song-id={next?.songId ?? ''} data-private="true" data-state={landing ? 'landing' : suspense ? 'suspense' : 'waiting'} aria-labelledby="{uid}-title">
    {#if next && !finaleOver}
      <Cover songId={next.songId} morph="cover" />
      <div class="next-song__song">
        <h2 class="panel__label" id="{uid}-title">{S.nextSong.title}<span class="visually-hidden"> ({S.nextSong.private})</span></h2>
        <p class="next-song__name" data-morph="title">{next.title}</p>
        <p class="next-song__artist" data-morph="artist">{next.artist}</p>
        {#if snap.pending === 'next'}<p class="next-song__pending">{S.nextSong.decoding}</p>{/if}
      </div>
      {#if landing}
        <p class="next-song__landing" role="timer" aria-label={S.nextSong.landsIn(landing.secondsLeft)}>
          <span class="next-song__seconds" aria-hidden="true">{S.nextSong.seconds(landing.secondsLeft)}</span>
          <span class="next-song__to-land" aria-hidden="true">{S.nextSong.toLand}</span>
        </p>
      {:else if suspense}
        <p class="next-song__landing next-song__landing--suspense">{S.nextSong.suspenseOpen}</p>
      {/if}
    {:else}
      <div class="next-song__song">
        <h2 class="panel__label" id="{uid}-title">{S.nextSong.title}</h2>
        <p class="next-song__none">{finaleOver ? S.finale.nextDone : S.nextSong.none}</p>
      </div>
    {/if}
  </section>
{/if}
