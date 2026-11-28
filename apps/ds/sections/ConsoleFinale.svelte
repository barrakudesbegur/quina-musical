<!--
  The gallery's F2 · the finale's Dempeus row (console density only): the console's own FinaleStage, with the demo
  fixtures' Desgraciat finale (packages/ui/fixtures/states.ts: eight finalists on stage, «Love Story» takes out three,
  then the 22nd song leaves #57). Each specimen gets a ConsoleModel stand-in (ConsoleStub.svelte) with that state, so
  «Editar» and «Al revés» work here and change nothing else. Captions in English (GLOSSARY.md).
-->
<script lang="ts">
  import type { Snippet } from 'svelte';
  import type { FinaleInfo } from '@quina/protocol';
  import { flowOf } from '../../../packages/ui/flow.ts';
  import { FIXTURES, type FullState } from '../../../packages/ui/fixtures/states.ts';
  import FinaleStage from '../../console/components/FinaleStage.svelte';
  import ConsoleStub from './ConsoleStub.svelte';

  const now = Date.now();

  /** A finale fixture's state, with the console's own finale switches («Editar», «Al revés») working on the stand-in. */
  function stub(fixture: string, { editing = false, reversed = false } = {}) {
    const script = FIXTURES[fixture]?.(now);
    if (!script) throw new Error(`ds: no fixture ${fixture}`);
    const state = script.state as FullState;
    const model = $state({
      show: { state, flow: flowOf(state), now, demo: true },
      catalog: null,
      finaleEditing: editing,
      finaleReversed: reversed,
      can: () => true,
      openFinalePad: () => {},
      removeFinalist: () => {},
      setFinaleReversed(on: boolean) {
        model.finaleReversed = on;
      },
    });
    return { model, finale: state.finale as FinaleInfo };
  }

  const ROWS = [
    { caption: 'eight finalists, three fallen at «Love Story»: faded at their places with a ✗ until the next Spin; five standing', ...stub('finaleFallen') },
    { caption: '«Editar» on: a × on each one standing, «+ Afegir» beside it (D-h’s xs buttons)', ...stub('finaleFallen', { editing: true }) },
    { caption: '«Al revés» on: the row the other way round', ...stub('finaleFallen', { reversed: true }) },
    { caption: 'the winner, #57: the party nino, the count in gold; no «Editar» any more', ...stub('finaleCelebration') },
  ];
</script>

{#snippet cell(caption: string, body: Snippet)}
  <figure class="ds-gallery__cell">
    <div class="ds-gallery__stage" lang="ca">{@render body()}</div>
    <figcaption>{caption}</figcaption>
  </figure>
{/snippet}

<section class="ds-gallery__section" aria-labelledby="s-f3">
  <h2 id="s-f3">F2 · The finale's Dempeus row (console)</h2>
  <p class="ds-prose">
    The Dempeus tab once the finale is on (D187): the count, «Editar» and «Al revés», then a nino per finalist on its card
    number’s plate (finalists are card numbers, never names). The demo fixtures’ Desgraciat finale.
  </p>
  <div class="ds-gallery__grid ds-f3__grid">
    {#each ROWS as row (row.caption)}
      {#snippet b()}<div class="ds-f3__tab"><ConsoleStub model={row.model}><FinaleStage finale={row.finale} /></ConsoleStub></div>{/snippet}
      {@render cell(row.caption, b)}
    {/each}
  </div>
</section>

<style>
  @layer app {
  .ds-f3__grid {
    grid-template-columns: repeat(auto-fill, minmax(min(100%, 40rem), 1fr));
  }

  /* The tab's panel behind the row, as in the Dempeus tab */
  .ds-f3__tab {
    padding: var(--space-3);
    border: var(--line-width-bold) solid var(--color-line);
    border-radius: var(--radius-lg);
    background: var(--color-surface);
  }
  }
</style>
