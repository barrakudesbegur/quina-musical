<!--
  The gallery's H1 · Icon section (27 Nov, D245): the one registry (packages/ui/icons/line.ts) in the line look beside
  a text, and the throw songs' two icons (crossed swords, a cloud raining corn) in every look: beside a text, alone,
  and the outline look on their buttons' colours. The swords' back one is cut where the front one crosses it (a
  `behind` part, icons.css › the cut). Captions in English with GLOSSARY.md's terms.
-->
<script lang="ts">
  import type { Snippet } from 'svelte';
  import Icon from '../../../packages/ui/icons/Icon.svelte';
  import { LINE_ICONS, type LineIconName } from '../../../packages/ui/icons/line.ts';
  import { CONCEPTS } from '../../../packages/ui/concepts.ts';

  let { cell }: { cell: Snippet<[string, Snippet]> } = $props();

  const NAMES = Object.keys(LINE_ICONS) as LineIconName[];
  /** The throw songs' drawings, from the shared concepts (D245). */
  const THROWS = [
    { id: 'throw', name: CONCEPTS.throw.icon, color: CONCEPTS.throw.color, label: CONCEPTS.throw.label },
    { id: 'storm', name: CONCEPTS.storm.icon, color: CONCEPTS.storm.color, label: CONCEPTS.storm.label },
  ] as const;
</script>

<section class="ds-gallery__section" aria-labelledby="h1-icon">
  <h2 id="h1-icon">H1 · Icon</h2>
  <p class="ds-prose">
    One registry of line icons, named after their drawings. The ink is the stem of the text beside the icon; alone it is
    the box’s size step; the outline look (a big button’s) is the line over an ink line a little wider. A part marked
    <code>behind</code> is cut where the parts in front cross it, with a gap as wide as a line, so outlines never cross
    (the crossed swords, D245).
  </p>
  <h3>The throw songs’ icons (U170 option A, drawn as line icons: D245)</h3>
  <div class="ds-gallery__grid ds-gallery__grid--wide">
    {#each THROWS as t (t.id)}
      {#snippet looks()}
        <div class="ds-icons__looks">
          <span class="ds-icons__text"><Icon name={t.name} /><span>{t.label}</span></span>
          <Icon name={t.name} alone class="ds-icons__alone" />
          <span class="ds-icons__tile" data-color={t.color}><Icon name={t.name} outline /></span>
        </div>
      {/snippet}
      {@render cell(`${t.name} · beside a text, alone, the outline look on its ${t.color}`, looks)}
    {/each}
  </div>
  <h3>The registry, beside a 17 px text</h3>
  <ul class="ds-icons__grid">
    {#each NAMES as name (name)}
      <li><Icon {name} /><code>{name}</code></li>
    {/each}
  </ul>
</section>

<style>
  .ds-icons__looks {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--space-5);
  }

  .ds-icons__text {
    display: inline-flex;
    align-items: center;
    gap: var(--space-2);
    font-size: 1.0625rem;
    font-weight: 900;
  }

  .ds-icons__text :global(.icon) {
    width: 1.5rem;
    height: 1.5rem;
  }

  .ds-icons__looks :global(.ds-icons__alone) {
    width: 3rem;
    height: 3rem;
  }

  /* The outline look on its button's colour, at a big button's size (button.css: a 44 px box by a 36 px label) */
  .ds-icons__tile {
    display: inline-grid;
    place-items: center;
    padding: var(--space-3);
    border: var(--line-width-bold) solid var(--color-line);
    border-radius: var(--radius-md);
    background: var(--palette-solid);
    color: var(--color-white);
    font-size: 2.25rem;
  }

  .ds-icons__tile :global(.icon) {
    width: 2.75rem;
    height: 2.75rem;
  }

  .ds-icons__grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(7.5rem, 1fr));
    gap: var(--space-3);
    margin: 0;
    padding: 0;
    list-style: none;
    font-size: 1.0625rem;
  }

  .ds-icons__grid li {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--space-1);
  }

  .ds-icons__grid :global(.icon) {
    width: 1.5rem;
    height: 1.5rem;
  }

  .ds-icons__grid code {
    color: var(--color-text-muted);
    font-size: var(--text-xs);
    text-align: center;
    overflow-wrap: anywhere;
  }
</style>
