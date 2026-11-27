<!--
  The controls family in the gallery (components-v2.md § 3, B1–B10; comments-27nov.md). Every component in every
  layout, size and state, set through its real inputs (a value, its validity, `disabled`), never a `state` prop (D-c).
  Content is neutral (#42): the gallery shows components, never a screen's story. Captions in English with
  GLOSSARY.md's terms; the controls' words are UI content, so Catalan.
-->
<script lang="ts">
  import type { Snippet } from 'svelte';
  import Switch from '../../packages/ui/components/Switch.svelte';

  let { phone }: { phone: boolean } = $props();

  // Live examples: a press changes them, as in the apps.
  let on = $state(true);
  let off = $state(false);
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
