<!--
  «Prova de so» in the menu (D229; logic/sound-test.ts): for setting up the PA before the night. «Comença la prova»
  plays the first kind of sound on a loop at its slider's level (`soundTest { kind }`); then the panel shows what plays
  («Sona ara · 3 de 16», the slider's name and what the test plays of it), «Anterior» and «Següent» either side of that
  sound's own volume slider (a drag moves it live, `setVolume`), and «Atura la prova» (`kind: null`). The engine allows
  it only before the first round's intro with nothing playing, and ends it on any scene change or Panic; the state's
  `soundTest` is the truth, so every console shows the same test. Across the menu's columns, above the volume sliders.
  Motion: ANIMATIONS.md › sound-test-playing. Hooks: data-testid="sound-test", "sound-test-slider".
-->
<script lang="ts">
  import type { SoundTestKind, VolumeKey } from '@quina/protocol';
  import MiniButton from '../../../packages/ui/components/MiniButton.svelte';
  import { MINI } from '../actions.ts';
  import { soundTestPlace, SOUND_TEST_ORDER } from '../logic/sound-test.ts';
  import { S } from '../strings.ts';
  import Icon from './Icon.svelte';
  import VolumeSlider from './VolumeSlider.svelte';

  interface Props {
    /** The kind playing (the state's `soundTest.kind`), or null. */
    kind: SoundTestKind | null;
    /** `soundTest` can be sent now (the scene allows it). */
    enabled: boolean;
    volumes: Partial<Record<VolumeKey, number>> | undefined;
    volumesEnabled: boolean;
    /** Play a kind, or stop the test (null). */
    onkind: (kind: SoundTestKind | null) => void;
    onvolume: (key: VolumeKey, percent: number) => void;
  }

  let { kind, enabled, volumes, volumesEnabled, onkind, onvolume }: Props = $props();
  const uid = $props.id();
  const place = $derived(kind ? soundTestPlace(kind) : null);
</script>

<section class="menu-group sound-test" aria-labelledby="{uid}-title" data-testid="sound-test" data-playing={kind ? 'true' : undefined}>
  <h3 class="menu-group__title" id="{uid}-title"><Icon name="soundTest" />{S.soundTest.title}</h3>
  {#if kind && place}
    <div class="sound-test__now" aria-live="polite">
      <p class="sound-test__kicker"><span class="sound-test__speaker"><Icon name="soundTest" /></span>{S.soundTest.playing} · {S.soundTest.position(place.number, place.count)}</p>
      {#key kind}
        <p class="sound-test__name">{S.volumes.keys[kind].label}</p>
        <p class="note sound-test__plays">{S.soundTest.plays[kind]}</p>
      {/key}
    </div>
    <div class="sound-test__row">
      <MiniButton {...MINI.soundTestPrev} disabled={!enabled || !place.prev} onclick={() => place.prev && onkind(place.prev)} />
      <div class="sound-test__slider">
        <VolumeSlider key={kind} {volumes} disabled={!volumesEnabled} bare testid="sound-test-slider" {onvolume} />
      </div>
      <MiniButton {...MINI.soundTestNext} disabled={!enabled || !place.next} onclick={() => place.next && onkind(place.next)} />
    </div>
    <MiniButton {...MINI.soundTestStop} class="sound-test__stop" disabled={!enabled} onclick={() => onkind(null)} />
  {:else}
    <p class="note">{S.soundTest.note}</p>
    <MiniButton {...MINI.soundTestStart} class="sound-test__start" disabled={!enabled} onclick={() => onkind(SOUND_TEST_ORDER[0])} />
    {#if !enabled}<p class="note">{S.soundTest.unavailable}</p>{/if}
  {/if}
</section>

<style>
  .sound-test {
    grid-column: 1 / -1;
  }

  .sound-test__now {
    display: grid;
    gap: 2px;
  }

  .sound-test__kicker {
    display: flex;
    align-items: center;
    gap: 6px;
    margin: 0;
    font-size: var(--text-xs);
    font-weight: var(--font-weight-strong);
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--color-text-muted);
  }

  .sound-test__speaker {
    display: inline-flex;
    color: var(--color-text);
  }

  .sound-test__name {
    margin: 0;
    font-size: var(--text-lg);
    font-weight: var(--font-weight-strong);
    color: var(--color-text);
    text-wrap: balance;
  }

  .sound-test__plays {
    margin: 0;
  }

  /* «Anterior», the slider, «Següent» in one line; the slider takes the room between. */
  .sound-test__row {
    display: flex;
    align-items: center;
    gap: var(--space-3);
  }

  .sound-test__slider {
    flex: 1;
    min-width: 0;
  }

  /* MiniButtons: their own components' elements. */
  .sound-test :global(.sound-test__start),
  .sound-test :global(.sound-test__stop) {
    align-self: flex-start;
  }

  /* sound-test-playing: the name and what plays cross-fade as the kind changes (opacity, so either way). */
  .sound-test__name,
  .sound-test__plays {
    animation: sound-test-in 160ms var(--ease-out) both;
  }

  @keyframes sound-test-in {
    from {
      opacity: 0;
    }
  }

  @media (prefers-reduced-motion: no-preference) {
    .sound-test__speaker {
      animation: sound-test-breath 1.2s ease-in-out infinite;
    }
  }

  @keyframes sound-test-breath {
    50% {
      opacity: 0.4;
    }
  }
</style>
