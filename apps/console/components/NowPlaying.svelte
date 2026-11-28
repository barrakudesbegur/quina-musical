<!--
  Now playing: the cover, title and artist, and the ring that shows what happens next (NowRing, from
  logic/now-ring.ts): the auto-advance countdown, a Spin, a Suspense, "press Següent", or why the show waits.
  Under the artist, a chip says that state in words (with how long a Hold or pause has lasted), and who
  started the last Spin (this device's label names it). While Hold music (or a failed Check's error music)
  plays instead of the song, the panel names that music instead.
-->
<script lang="ts">
  import { CONSOLE } from '../config.ts';
  import { formatCountdown } from '../../../packages/rules/time.ts';
  import { getConsole } from '../context.ts';
  import { elapsedSec } from '../logic/countdown.ts';
  import { nowRing } from '../logic/now-ring.ts';
  import { S } from '../strings.ts';
  import SongTile from '../../../packages/ui/components/SongTile.svelte';
  import Icon from './Icon.svelte';
  import NowRing from './NowRing.svelte';
  import { registerMorphRoot } from '../morph.ts';

  const model = getConsole();
  let root = $state<HTMLElement | null>(null);
  $effect(() => {
    registerMorphRoot('now', root);
    return () => registerMorphRoot('now', null);
  });
  const uid = $props.id();
  const snap = $derived(model.show.state);
  const ring = $derived(snap ? nowRing({ state: snap, flow: model.show.flow, nowMs: model.show.now, lastSec: CONSOLE.ringLastSec }) : null);
  /** The music playing instead of the song, if any. */
  const music = $derived(!ring?.holdMusic ? null : ring.state === 'checkFailed' ? 'error' : ring.state === 'paused' ? 'pause' : 'hold');
  const since = $derived(ring?.sinceMs != null ? formatCountdown(elapsedSec(ring.sinceMs, model.show.now)) : '0:00');
  const chip = $derived.by(() => {
    if (!ring) return null;
    const C = S.nowPlaying.ring.chip;
    switch (ring.state) {
      case 'spinning':
        return C.spinning(ring.countdown && !ring.countdown.done ? ring.countdown.secondsLeft : null);
      case 'suspense':
      case 'manual':
      case 'manualFinal':
      case 'checkFailed':
        return C[ring.state];
      case 'talk':
        // After a Review was discarded the round is back in plain Parlem, and the ring says why (D122, D142).
        return snap?.hold?.reason === 'discarded' ? C.discarded : C.talk(since);
      case 'stay':
      case 'paused':
        return C[ring.state](since);
      case 'checking':
        return C.checking(ring.cardId);
      case 'lastStanding':
        return C.lastStanding(ring.cardId);
      case 'finaleWinner':
        return ring.cardId === null ? null : S.finale.ringWinner(ring.cardId);
      default:
        return null;
    }
  });
</script>

{#if snap && ring}
  {@const name = music ? (music === 'error' ? S.nowPlaying.errorMusic : music === 'pause' ? S.intervalMusic.sets.pausa : S.nowPlaying.holdMusic) : (snap.current?.title ?? S.nowPlaying.nothing)}
  <section bind:this={root} class="panel now-playing" data-testid="now-playing" data-song-id={snap.current?.songId ?? ''} data-state={snap.status} data-ring-state={ring.state} aria-labelledby="{uid}-title">
    <!-- The design system's SongTile, `feature` (D5): a long title stops at two lines (#81). Hold or error music shows
         the note on its tile instead of a cover. -->
    <SongTile
      layout="feature"
      class="now-playing__tile"
      songId={music ? null : (snap.current?.songId ?? null)}
      title={name}
      artist={music ? null : (snap.current?.artist ?? null)}
      morph={!music && snap.current !== null}
      data-music={music ?? undefined}
    >
      {#snippet head()}<h2 class="panel__label" id="{uid}-title">{S.nowPlaying.title}</h2>{/snippet}
      {#snippet meta()}
        {#if chip}
          <p class="now-playing__chip" data-state={ring.state}>
            {#if ring.state === 'manual' || ring.state === 'manualFinal'}<Icon name="next" />{:else if ring.state === 'lastStanding'}<Icon name="claim" />{:else if ring.state === 'finaleWinner'}<Icon name="star" />{/if}<span>{chip}</span>
          </p>
        {/if}
        {#if model.lastSpin}
          <p class="now-playing__by" data-by={model.lastSpin.by ?? 'auto'}>{S.nowPlaying.lastSpinBy(model.lastSpin.by)}</p>
        {/if}
      {/snippet}
      {#snippet trailing()}
        <div class="now-playing__ring">
          <NowRing view={ring} />
        </div>
      {/snippet}
    </SongTile>
  </section>
{/if}
