<!--
  The controls family in the gallery (components-v2.md § 3, B1–B10; comments-27nov.md). Every component in every
  layout, size and state, set through its real inputs (a value, its validity, `disabled`), never a `state` prop (D-c).
  Content is neutral (#42): the gallery shows components, never a screen's story. Captions in English with
  GLOSSARY.md's terms; the controls' words are UI content, so Catalan.
-->
<script lang="ts">
  import type { Snippet } from 'svelte';
  import SegmentedControl from '../../packages/ui/components/SegmentedControl.svelte';
  import Switch from '../../packages/ui/components/Switch.svelte';

  let { phone }: { phone: boolean } = $props();

  // Live examples: a press changes them, as in the apps.
  let on = $state(true);
  let off = $state(false);
  let two = $state<'a' | 'b'>('a');
  let three = $state<'x' | 'y' | 'z'>('x');
  let view = $state<'list' | 'grid'>('grid');
</script>

{#snippet cell(caption: string, body: Snippet)}
  <figure class="ds-gallery__cell">
    <div class="ds-gallery__stage" lang="ca">{@render body()}</div>
    <figcaption>{caption}</figcaption>
  </figure>
{/snippet}

<section class="ds-gallery__section" aria-labelledby="b1">
  <h2 id="b1">B1 · Switch</h2>
  <p class="ds-prose">
    An on/off setting: <code>checked</code> (from the parent; a press asks for the opposite through <code>onchange</code>),
    <code>label</code>, <code>note</code>, <code>icon</code>, <code>layout</code> (row | inline | embedded), <code>onText</code> /
    <code>offText</code>, <code>disabled</code>, <code>sound</code>. The knob is centred by the track’s layout (#35). A setting has no
    stripes: they mark a temporary «on» (R3), such as «Seguides», the pressed Button that embeds a switch (#36).
  </p>
  <div class="ds-gallery__grid">
    {#snippet s1()}<Switch label="Avanç automàtic a la fase final" checked={off} onchange={(v) => (off = v)} />{/snippet}
    {@render cell('row · off', s1)}
    {#snippet s2()}<Switch label="Música de fons automàtica" note="Comença sola als 2 minuts" checked={on} onchange={(v) => (on = v)} />{/snippet}
    {@render cell('row · on, with a note', s2)}
    {#snippet s3()}<Switch layout="inline" icon="swap" label="Al revés" checked={on} onchange={(v) => (on = v)} />{/snippet}
    {@render cell('inline, with an icon', s3)}
    {#snippet s4()}<Switch label="Sacsejar per fer Suspens" note="Amb B premut, 3 cops" checked={false} disabled />{/snippet}
    {@render cell('disabled', s4)}
    {#snippet s5()}<span class="ds-gallery__strip"><Switch layout="embedded" label="Seguides" checked={false} onText="Sí" offText="No" /></span>{/snippet}
    {@render cell('embedded · off: a drawing inside a toggle', s5)}
    {#snippet s6()}<span class="ds-gallery__strip"><Switch layout="embedded" label="Seguides" checked onText="Sí" offText="No" /></span>{/snippet}
    {@render cell('embedded · on', s6)}
    {#snippet s7()}<Switch label="Un nom molt llarg per a un ajust que no hi cap en una sola línia de cap manera" checked={off} onchange={(v) => (off = v)} />{/snippet}
    {@render cell('a long label wraps (R6); the track keeps its size', s7)}
  </div>
  {#if phone}<p class="ds-gallery__note">The phone’s track is 56×32, slate while off.</p>{/if}
</section>

<section class="ds-gallery__section" aria-labelledby="b2">
  <h2 id="b2">B2 · SegmentedControl</h2>
  <p class="ds-prose">
    One of a few options in place: <code>options</code> (<code>id</code>, <code>label</code>, <code>icon</code>, <code>note</code>,
    <code>disabled</code>), <code>value</code>, <code>size</code> (s | m | l), <code>weights</code>, <code>semantics</code> (radio | tabs),
    <code>disabled</code>, <code>sound</code>. The gold thumb slides to the chosen option (segment-slide: anchor positioning); one Tab
    stop, the arrows, Home and End choose.
  </p>
  <div class="ds-gallery__grid ds-gallery__grid--wide">
    {#snippet g1()}<SegmentedControl label="Tipus" options={[{ id: 'a', label: 'Línia' }, { id: 'b', label: 'Quina' }]} bind:value={two} />{/snippet}
    {@render cell('radio · m: two words', g1)}
    {#snippet g2()}<SegmentedControl label="Vista" semantics="tabs" options={[{ id: 'list', label: 'Historial', icon: 'clock' }, { id: 'grid', label: 'Cartrons', icon: 'grid-rounded' }]} bind:value={view} />{/snippet}
    {@render cell('tabs · m: icon + label (switches the view below)', g2)}
    {#snippet g3()}<SegmentedControl size="s" label="Tema" options={[{ id: 'x', label: 'Clar', icon: 'sun' }, { id: 'y', label: 'Fosc', icon: 'moon' }, { id: 'z', label: 'Auto', disabled: true }]} bind:value={three} />{/snippet}
    {@render cell('s, with a disabled option (skipped by the arrows)', g3)}
    {#snippet g4()}<SegmentedControl label="Música" weights={[1.5, 1, 1]} options={[{ id: 'x', label: 'Cançó guanyadora', note: 'suggerida' }, { id: 'y', label: 'Victòria' }, { id: 'z', label: 'Música de fons' }]} bind:value={three} />{/snippet}
    {@render cell('weights 1.5 : 1 : 1, an option with a note', g4)}
    {#snippet g5()}<SegmentedControl size="l" label="Opció" options={[{ id: 'a', label: 'Una', icon: 'music' }, { id: 'b', label: 'Una altra', icon: 'star' }]} bind:value={two} />{/snippet}
    {@render cell('l (64 px)', g5)}
    {#snippet g6()}<SegmentedControl label="Tipus" disabled options={[{ id: 'a', label: 'Línia' }, { id: 'b', label: 'Quina' }]} value="a" />{/snippet}
    {@render cell('disabled', g6)}
    {#snippet g7()}<SegmentedControl label="Tria" options={[{ id: 'a', label: 'All I Want for Christmas Is You' }, { id: 'b', label: 'SUPERESTRELLA' }]} bind:value={two} />{/snippet}
    {@render cell('long labels: one line, an ellipsis (R9)', g7)}
  </div>
</section>
