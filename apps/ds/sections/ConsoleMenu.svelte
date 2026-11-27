<!--
  The console's new pieces of 27 Nov (the console helpers: D228, D229, D234, D237), drawn with the real components and
  presets, so the boards can be redrawn from them: the Descans' music picker, the menu's «Sons automàtics», «Prova de
  so» (with a step whose automatic sound is off) and «Cartrons venuts» (on `addCardsInPlay`: the engine's answer and
  refusal), and a two-level button held on another console (the lock mirror, `twoLevelHeld`), as HoldModeButton draws
  it. Console only. Captions in English with GLOSSARY.md's terms; the words are UI content, so Catalan.
-->
<script lang="ts">
  import type { Snippet } from 'svelte';
  import { AUTO_SOUNDS_DEFAULT, formatCardRanges, parseCardRanges, type AutoSounds as AutoSoundValues, type BreakSet, type SoundTestKind, type VolumeKey } from '@quina/protocol';
  import SegmentedControl from '../../../packages/ui/components/SegmentedControl.svelte';
  import TwoLevelButton from '../../../packages/ui/components/TwoLevelButton.svelte';
  import { ACTIONS, BREAK_SET_OPTIONS } from '../../console/actions.ts';
  import AutoSounds from '../../console/components/AutoSounds.svelte';
  import CardsAdd from '../../console/components/CardsAdd.svelte';
  import SoundTest from '../../console/components/SoundTest.svelte';
  import { CONSOLE } from '../../console/config.ts';
  import { refusalError, type CardsAddOutcome } from '../../console/logic/cards-add.ts';
  import { S } from '../../console/strings.ts';

  let { cell }: { cell: Snippet<[string, Snippet]> } = $props();

  // Live examples: a press changes them, as the engine's echo would.
  let set = $state<BreakSet>('breaks');
  let sounds = $state<AutoSoundValues>({ ...AUTO_SOUNDS_DEFAULT, drumTicks: false });
  let kind = $state<SoundTestKind | null>('songsParlem');
  let volumes = $state<Partial<Record<VolumeKey, number>>>({});
  let inPlay = $state('1-210, 400-440');
  let outcome = $state.raw<CardsAddOutcome | null>(null);
  const count = $derived(parseCardRanges(inPlay).length);
  /** Printed cards 1–500 (the catalogue loaded). */
  const rules = { known: (id: number) => id >= 1 && id <= 500, max: 9999 };
  /** The catalogue not loaded: the engine checks the numbers. */
  const unknownCatalogue = { known: () => null, max: 9999 };

  /** The engine's `addCardsInPlay`, as the live example's echo: printed cards merge (`cards.lastAdd`), others refuse. */
  function engineAdd(ranges: string): boolean {
    const ids = parseCardRanges(ranges);
    const notPrinted = ids.filter((id) => id > 500);
    if (notPrinted.length) {
      outcome = { kind: 'refused', error: refusalError(formatCardRanges(notPrinted)) };
      return true;
    }
    const have = new Set(parseCardRanges(inPlay));
    const added = ids.filter((id) => !have.has(id));
    const alreadyIn = ids.filter((id) => have.has(id));
    inPlay = formatCardRanges([...have, ...added].sort((a, b) => a - b));
    outcome = { kind: 'added', added: formatCardRanges(added), addedCount: added.length, alreadyIn: formatCardRanges(alreadyIn), alreadyCount: alreadyIn.length };
    return true;
  }

  /** What HoldModeButton passes while the button is held on another console (D234). */
  const heldLook = (name: string) => ({ disabled: true, badge: { icon: 'lock' as const, label: S.cluster.heldElsewhereLong(name) }, note: S.cluster.heldElsewhere(name) });
  const mobilAdmin = CONSOLE.labelPresets[1];
  const tauleta = CONSOLE.labelPresets[0];
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
    {#snippet t3()}<SoundTest kind="ticks" enabled {volumes} volumesEnabled autoSounds={sounds} onkind={() => {}} onvolume={() => {}} />{/snippet}
    {@render cell('the last kind, «Bombo»: «Següent» disabled (the test doesn’t wrap). Its automatic sound, «Tics del bombo», is off above: the test plays it anyway, and the step says «apagat a Sons automàtics» (an orange note, NOTICES.autoSoundOff)', t3)}
  </div>

  <h3>D234 · «Cartrons venuts» (the menu, under «La nit»; `addCardsInPlay`, the engine merges)</h3>
  <div class="ds-gallery__grid">
    {#snippet c1()}<CardsAdd {inPlay} {count} {rules} {outcome} onadd={engineAdd} />{/snippet}
    {@render cell('live: type «441-450, 205» and «Afegeix»: the hint previews, then the engine’s answer (cards.lastAdd) empties the field and the green Notice says what joined and what was in already', c1)}
    {#snippet c2()}<CardsAdd inPlay="" count={0} {rules} disabled onadd={() => false} />{/snippet}
    {@render cell('empty: none in play yet; «Afegeix» disabled (offline, or nothing typed)', c2)}
    {#snippet c3()}<CardsAdd inPlay="1-210, 400-440" count={251} {rules} value="441-450, 205" onadd={() => false} />{/snippet}
    {@render cell('preview: what «Afegeix» would add, and how many are in play already', c3)}
    {#snippet c4()}<CardsAdd inPlay="1-210, 400-440" count={251} rules={unknownCatalogue} value="450, 4500-4502" outcome={{ kind: 'refused', error: refusalError('4500-4502') }} onadd={() => false} />{/snippet}
    {@render cell('error: the engine refused the add (invalid: 4500–4502 aren’t printed; here the catalogue isn’t loaded, so it couldn’t say before). The numbers stay; the hint is red until the field is typed in again. With the catalogue, the same red comes before sending, once the field is left or «Afegeix» pressed, never while typing', c4)}
    {#snippet c5()}<CardsAdd inPlay="1-210, 300-302, 400-440" count={254} {rules} outcome={{ kind: 'added', added: '300-302', addedCount: 3, alreadyIn: '205', alreadyCount: 1 }} onadd={() => false} />{/snippet}
    {@render cell('done: three joined, one was in already', c5)}
    {#snippet c6()}<CardsAdd inPlay="1-210, 400-450" count={261} {rules} outcome={{ kind: 'added', added: '', addedCount: 0, alreadyIn: '441-450', alreadyCount: 10 }} onadd={() => false} />{/snippet}
    {@render cell('done, nothing new: another console added them a moment before (the engine merges both)', c6)}
  </div>

  <h3>D234 · A two-level button held on another console (the lock mirror: `twoLevelHeld`)</h3>
  <p class="ds-prose">
    While another console holds Parlem or Aguanta (for 300 ms or more: a tap never flashes it), this console shows that
    button locked until it’s let go: disabled, the padlock in its top-left corner, «la manté &lt;console&gt;» as its
    note, no pattern (R3). The holder’s name is its device label; a console with no label reads «una altra consola».
  </p>
  <div class="ds-gallery__grid ds-console-menu__tall">
    {#snippet h1()}<TwoLevelButton {...ACTIONS.stay} iconPlacement="top" lead={S.cluster.holdFor} {...heldLook(mobilAdmin)} />{/snippet}
    {@render cell('Aguanta held toward Suspens on «Mòbil admin»', h1)}
    {#snippet h2()}<TwoLevelButton {...ACTIONS.hold} iconPlacement="top" lead={S.cluster.holdFor} active={1} {...heldLook(tauleta)} />{/snippet}
    {@render cell('Parlem on, held toward Pausa on the «Tauleta»: on, but locked, so no stripes', h2)}
    {#snippet h3()}<TwoLevelButton {...ACTIONS.stay} iconPlacement="top" lead={S.cluster.holdFor} {...heldLook(S.cluster.anotherConsole)} />{/snippet}
    {@render cell('a holder with no device label of its own', h3)}
    {#snippet h4()}<TwoLevelButton {...ACTIONS.hold} iconPlacement="top" lead={S.cluster.holdFor} {...heldLook('Portàtil taula de so')} />{/snippet}
    {@render cell('long name (R9): the note wraps', h4)}
  </div>
</section>

<style>
  @layer app {
  /* The menu's full-width cards: one per row, as wide as the menu's three columns. */
  .ds-console-menu__full {
    grid-template-columns: minmax(0, 1fr);
  }

  /* The two-level buttons at the cluster's height, as in the buttons family. */
  .ds-console-menu__tall :global(.ds-gallery__stage > .two-level) {
    min-height: 12rem;
  }
  }
</style>
