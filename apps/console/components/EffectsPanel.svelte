<!--
  The «Efectes» tab (Consola-Pestanyes; D-l): the sounds the engine plays on the PA, as two SoundPad grids (packages/ui,
  A9): the fanfares (stingers) in a gold column, the effects in a snow grid of four. Icons only, no words (the user's
  decision on the canvas, 2026-11-24; board "Consola · Efectes amb icones"): each cell's name is its accessible name
  and its tooltip. The D-pad's four effects show their arrow while a Wii remote is connected (D92). A tapped cell's
  light runs while its sound plays (pad-playing): the snapshot carries no playing effect yet, so the console shows its
  own tap's for CONSOLE.padPlayingMs.
-->
<script lang="ts">
  import { SFX_NAMES, STINGER_NAMES, type SoundName } from '@quina/protocol';
  import { onDestroy } from 'svelte';
  import { CONSOLE } from '../config.ts';
  import { getConsole } from '../context.ts';
  import { FX } from '../actions.ts';
  import { S, soundText } from '../strings.ts';
  import { dpadOf } from '../wii/guide.ts';
  import SoundIcon from './SoundIcon.svelte';
  import SoundPad from '../../../packages/ui/components/SoundPad.svelte';

  const model = getConsole();
  const uid = $props.id();
  const enabled = $derived(model.can('sfx'));
  const item = (name: SoundName) => {
    const dpad = dpadOf(name);
    return { id: name, label: soundText(name), wii: dpad ? { keys: [dpad], size: 'sm' as const } : null };
  };
  const stingers = STINGER_NAMES.map(item);
  const effects = SFX_NAMES.map(item);

  /** The cells sounding now (their tap's time), each cleared after CONSOLE.padPlayingMs. */
  let playing = $state<Record<string, number>>({});
  const timers = new Map<string, ReturnType<typeof setTimeout>>();

  function play(id: string): void {
    model.act('sfx', { name: id as SoundName });
    clearTimeout(timers.get(id));
    playing = { ...playing, [id]: performance.now() };
    timers.set(
      id,
      setTimeout(() => {
        const { [id]: _done, ...rest } = playing;
        playing = rest;
        timers.delete(id);
      }, CONSOLE.padPlayingMs),
    );
  }

  onDestroy(() => timers.forEach((t) => clearTimeout(t)));
</script>

{#snippet art(id: string)}<SoundIcon name={id as SoundName} />{/snippet}

<div class="sound-pad-tab">
  <section class="sound-pad-tab__group" data-group="stingers" aria-labelledby="{uid}-stingers">
    <h3 class="panel__label" id="{uid}-stingers">{S.sounds.stingers}</h3>
    <SoundPad {...FX.stingers} items={stingers} {art} {playing} disabled={!enabled} onplay={play} aria-labelledby="{uid}-stingers" />
  </section>
  <section class="sound-pad-tab__group" data-group="effects" aria-labelledby="{uid}-effects">
    <h3 class="panel__label" id="{uid}-effects">{S.sounds.effects}</h3>
    <SoundPad {...FX.effects} items={effects} {art} {playing} disabled={!enabled} onplay={play} aria-labelledby="{uid}-effects" />
  </section>
</div>
