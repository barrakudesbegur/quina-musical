<!--
  The console's new pieces of 27 Nov (the console helper: D228, D229, D234, D237), drawn with the real components and
  presets, so the boards can be redrawn from them: the Descans' music picker, the menu's «Sons automàtics», «Prova de
  so» and «Cartrons venuts», and the design (not built: blocked on Sound engine) of a two-level button held on another
  console. Console only. Captions in English with GLOSSARY.md's terms; the words are UI content, so Catalan.
-->
<script lang="ts">
  import type { Snippet } from 'svelte';
  import { AUTO_SOUNDS_DEFAULT, parseCardRanges, type AutoSounds as AutoSoundValues, type BreakSet, type SoundTestKind, type VolumeKey } from '@quina/protocol';
  import SegmentedControl from '../../../packages/ui/components/SegmentedControl.svelte';
  import TwoLevelButton from '../../../packages/ui/components/TwoLevelButton.svelte';
  import { ACTIONS, BREAK_SET_OPTIONS } from '../../console/actions.ts';
  import AutoSounds from '../../console/components/AutoSounds.svelte';
  import CardsAdd from '../../console/components/CardsAdd.svelte';
  import SoundTest from '../../console/components/SoundTest.svelte';
  import { S } from '../../console/strings.ts';

  let { cell }: { cell: Snippet<[string, Snippet]> } = $props();

  // Live examples: a press changes them, as the engine's echo would.
  let set = $state<BreakSet>('breaks');
  let sounds = $state<AutoSoundValues>({ ...AUTO_SOUNDS_DEFAULT, drumTicks: false });
  let kind = $state<SoundTestKind | null>('songsParlem');
  let volumes = $state<Partial<Record<VolumeKey, number>>>({});
  let inPlay = $state('1-210, 400-440');
  const count = $derived(parseCardRanges(inPlay).length);
  /** Printed cards 1–500 (the catalogue loaded). */
  const rules = { known: (id: number) => id >= 1 && id <= 500, max: 9999 };
</script>

<section class="ds-gallery__section" aria-labelledby="cm">
  <h2 id="cm">Console · the break’s music, automatic sounds, sound test, cards sold (27 Nov)</h2>
  <p class="ds-prose">
    App pieces made of the families above (SegmentedControl, Switch, Slider, MiniButton, TextField, Notice). Each one
    shows the engine’s value; a press sends a command, and here it changes the example as the engine’s echo would.
  </p>

  <h3>D228 · The Descans’ music picker (in Ara sona, under «Salta la cançó»)</h3>
  <div class="ds-gallery__grid">
    {#snippet p1()}<SegmentedControl size="s" label={S.intervalMusic.pick} options={BREAK_SET_OPTIONS} bind:value={set} />{/snippet}
    {@render cell(`s · words only (Pausa’s ‖ would read as the Pausa itself) · now: ${set}`, p1)}
    {#snippet p2()}<SegmentedControl size="s" label={S.intervalMusic.pick} options={BREAK_SET_OPTIONS} value="breaks" disabled />{/snippet}
    {@render cell('disabled (offline)', p2)}
  </div>

  <h3>D237 · «Sons automàtics» (the menu, across its columns)</h3>
  <div class="ds-gallery__grid ds-console-menu__full">
    {#snippet a1()}<AutoSounds values={sounds} onchange={(key, on) => (sounds = { ...sounds, [key]: on })} />{/snippet}
    {@render cell('one Switch per sound, each with its note; «Tics del bombo» off', a1)}
    {#snippet a2()}<AutoSounds values={AUTO_SOUNDS_DEFAULT} disabled />{/snippet}
    {@render cell('disabled (offline): all on, the default', a2)}
  </div>

  <h3>D229 · «Prova de so» (the menu, above the volume sliders)</h3>
  <div class="ds-gallery__grid ds-console-menu__full">
    {#snippet t1()}<SoundTest {kind} enabled {volumes} volumesEnabled onkind={(k) => (kind = k)} onvolume={(key, percent) => (volumes = { ...volumes, [key]: percent })} />{/snippet}
    {@render cell(kind ? 'playing: «Sona ara · N de 16», what plays, ‹ Anterior · its slider · Següent ›, Atura (the speaker breathes)' : 'idle: «Comença la prova»', t1)}
    {#snippet t2()}<SoundTest kind={null} enabled={false} {volumes} volumesEnabled={false} onkind={() => {}} onvolume={() => {}} />{/snippet}
    {@render cell('unavailable: only before the first round, with nothing playing', t2)}
    {#snippet t3()}<SoundTest kind="ticks" enabled {volumes} volumesEnabled onkind={() => {}} onvolume={() => {}} />{/snippet}
    {@render cell('the last kind: «Següent» disabled (the test doesn’t wrap)', t3)}
  </div>

  <h3>D234 · «Cartrons venuts» (the menu, under «La nit»)</h3>
  <div class="ds-gallery__grid">
    {#snippet c1()}<CardsAdd {inPlay} {count} {rules} onadd={(ranges) => ((inPlay = ranges), true)} />{/snippet}
    {@render cell('type «441-450, 452» and «Afegeix»: the hint previews, then the green Notice confirms', c1)}
    {#snippet c2()}<CardsAdd inPlay="" count={0} {rules} disabled onadd={() => false} />{/snippet}
    {@render cell('none in play yet; «Afegeix» disabled (offline). In either, «4500» is not a printed card: the hint in red', c2)}
  </div>

  <h3>D234 · A two-level button held on another console (design only: blocked on Sound engine)</h3>
  <div class="ds-gallery__grid ds-console-menu__tall">
    {#snippet h1()}<TwoLevelButton {...ACTIONS.stay} iconPlacement="top" lead="mantén" disabled badge={{ icon: 'lock', label: 'La manté Mòbil admin' }} note="la manté Mòbil admin" />{/snippet}
    {@render cell('Aguanta held toward Suspens elsewhere: locked look (padlock, disabled, no pattern: R3) until let go', h1)}
    {#snippet h2()}<TwoLevelButton {...ACTIONS.hold} iconPlacement="top" lead="mantén" disabled badge={{ icon: 'lock', label: 'La manté Tauleta' }} note="la manté Tauleta" />{/snippet}
    {@render cell('Parlem held toward Pausa elsewhere', h2)}
  </div>
</section>

<style>
  /* The menu's full-width cards: one per row, as wide as the menu's three columns. */
  .ds-console-menu__full {
    grid-template-columns: minmax(0, 1fr);
  }

  /* The two-level buttons at the cluster's height, as in the buttons family. */
  .ds-console-menu__tall :global(.ds-gallery__stage > .two-level) {
    min-height: 12rem;
  }
</style>
