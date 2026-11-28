<!--
  The gallery's panels family (components-v2.md § 4: C1 Panel, C2 PaperCard with the Ticket and PrizeCard recipes,
  C3 Sheet, C4 Dialog), with the 27 Nov comments' D-n, D-o, D-p (#64–#69). Captions in English with GLOSSARY.md's
  terms; the content is Catalan UI. Sheets and dialogs are modal, so they open from buttons: try the drag (the title
  bar, or the content at its top), the flick, Esc, a tap outside, and the stacked sheet's ‹ and ✕.
  The projector's page shows only the prize card (P7, P11).
-->
<script lang="ts">
  import type { Snippet } from 'svelte';
  import Button from '../../packages/ui/components/Button.svelte';
  import Dialog from '../../packages/ui/components/Dialog.svelte';
  import Panel from '../../packages/ui/components/Panel.svelte';
  import PaperCard from '../../packages/ui/components/PaperCard.svelte';
  import Sheet, { type SheetOrigin } from '../../packages/ui/components/Sheet.svelte';
  import TextField from '../../packages/ui/components/TextField.svelte';
  import PrizeCard from '../../packages/ui/recipes/PrizeCard.svelte';
  import Ticket from '../../packages/ui/recipes/Ticket.svelte';

  let { density }: { density: 'console' | 'phone' | 'projector' } = $props();
  const phone = $derived(density === 'phone');
  /** The projector shows only what it draws: the prize card (P7, P11). */
  const projector = $derived(density === 'projector');

  const LINE = [
    { title: 'Entrada al spa per a 2', detail: null, sponsor: '[Patrocinador 1]', headline: true },
    { title: 'Fuet', detail: null, sponsor: null, headline: false },
    { title: 'Neules', detail: null, sponsor: null, headline: false },
    { title: 'Coca de vidre', detail: null, sponsor: 'Forn del poble', headline: false },
  ];
  const BINGO = [
    { title: 'Pernil', detail: null, sponsor: 'Carnisseria Puig', headline: true },
    ...['Xocolata', 'Panettone', 'Torró', 'Neules', 'Vi negre', 'Cava', 'Taronges'].map((title) => ({ title, detail: null, sponsor: null, headline: false })),
    { title: 'Sopar per a dos', detail: 'Menú de migdia o de vespre', sponsor: 'Restaurant La Riera', headline: false },
  ];
  const LONG = [{ title: 'All I Want for Christmas Is You: un SUPERESTRELLA-pack de nadal', detail: null, sponsor: 'Associació de Comerciants i Restauradors de Begur', headline: true }];

  let sheet = $state<SheetOrigin | null>(null);
  let stacked = $state(false);
  let withFooter = $state(false);
  /** A sheet holding a form (§8 Y3): `drag="stiff"`; its rows have a grip that owns its own gesture. */
  let stiff = $state(false);
  let formName = $state('');
  let dialog = $state<'s' | 'paper' | 'm' | 'l' | null>(null);
  const ROWS = Array.from({ length: 24 }, (_, i) => `Quina ${i + 1}`);
</script>

{#snippet saveBar()}<Button color="green" size="m" icon="check" label="Desar" />{/snippet}

{#snippet cell(caption: string, body: Snippet)}
  <figure class="ds-gallery__cell">
    <div class="ds-gallery__stage" lang="ca">{@render body()}</div>
    <figcaption>{caption}</figcaption>
  </figure>
{/snippet}

{#if !projector}
<section class="ds-gallery__section" aria-labelledby="c1">
  <h2 id="c1">C1 · Panel</h2>
  <p class="ds-prose">
    Props say what it draws: <code>fill</code> (surface, snow, panel), <code>border</code> (dashed: «only you see this», D15),
    <code>line</code>, <code>shadow</code>, <code>padding</code>, <code>kicker</code>, <code>title</code>; slots <code>actions</code> and
    <code>children</code>. A <code>&lt;section&gt;</code> named by its title or kicker.
  </p>
  <div class="ds-gallery__grid ds-gallery__grid--wide">
    {#snippet p1()}<Panel kicker="Ritme"><p>Contingut del bloc.</p></Panel>{/snippet}
    {@render cell('surface (default) with a kicker', p1)}
    {#snippet p2()}<Panel fill="snow" border="dashed" shadow={false} kicker="Següent"><p><b>Waka Waka</b> · Shakira</p></Panel>{/snippet}
    {@render cell('snow + dashed, no shadow: the private next song (D15)', p2)}
    {#snippet p3()}<Panel fill="panel" kicker="Ajustos"><p>Sons dels botons</p></Panel>{/snippet}
    {@render cell('panel: the night panel with its shine', p3)}
    {#snippet p4()}<Panel line="normal" padding="s" title="Comandament"><p>Sacsejar per fer Suspens</p></Panel>{/snippet}
    {@render cell('line normal, padding s, a title', p4)}
    {#snippet p5()}
      <Panel kicker="Premis de la Quina 3" title="All I Want for Christmas Is You">
        {#snippet actions()}<Button color="grey" size="xs" label="Editar" />{/snippet}
        <p>R9: a long title wraps, balanced (R6).</p>
      </Panel>
    {/snippet}
    {@render cell('kicker + title + actions; a long title', p5)}
  </div>
</section>
{/if}

<section class="ds-gallery__section" aria-labelledby="c2">
  <h2 id="c2">C2 · PaperCard, Ticket, PrizeCard</h2>
  <p class="ds-prose">
    PaperCard draws <code>layout</code> (ticket, hero, row), <code>ribbon</code> (the kind chip in a palette colour) and <code>ring</code>;
    slots <code>children</code> and <code>tail</code> (after the perforation). The ticket's holes are cut by a CSS mask with their ink
    outline (D-o, #64). The recipes Ticket and PrizeCard fill it from the game's data; the prize card reads top to bottom: the kind
    chip, the prize, the sponsor, «i N premis més» (D-p, #66). Titles balance, the rest is pretty (#65). Takes no card colour (R10
    doesn't apply).
  </p>
  {#if !projector}
  <div class="ds-gallery__grid">
    {#snippet t1()}<Ticket kind="line" prizes={LINE} label="Premi de línia" empty="Sense premi" />{/snippet}
    {@render cell('Ticket · line: the headline, the perforation, the rest', t1)}
    {#snippet t2()}<Ticket kind="bingo" prizes={BINGO} label="Premi de quina" empty="Sense premi" />{/snippet}
    {@render cell('Ticket · bingo: a hamper’s staples on one run, each sponsor on its own line', t2)}
    {#snippet t3()}<Ticket kind="standing" prizes={LONG} label="Premi de l'últim dempeus" empty="Sense premi" />{/snippet}
    {@render cell('Ticket · standing, no rest: no perforation; a long name (R9)', t3)}
    {#snippet t4()}<Ticket kind="line" prizes={[]} label="Premi de línia" empty="Sense premi" />{/snippet}
    {@render cell('Ticket · an empty bundle', t4)}
  </div>
  {/if}
  <div class="ds-gallery__grid ds-gallery__grid--wide">
    {#snippet h1()}<PrizeCard prize={{ kind: 'line', headline: [{ title: 'Entrada al spa per a 2', detail: null, sponsor: '[Patrocinador 1]' }], more: 4 }} />{/snippet}
    {@render cell('PrizeCard · line (the projector’s round start; no Line’s Celebration shows it for now, D242)', h1)}
    {#snippet h2()}<PrizeCard prize={{ kind: 'bingo', headline: [{ title: 'Sopar per a dos', detail: 'Menú de migdia o de vespre', sponsor: 'Restaurant La Riera' }, { title: 'Pernil', detail: null, sponsor: 'Carnisseria Puig' }], more: 17 }} />{/snippet}
    {@render cell('PrizeCard · bingo, two headline prizes', h2)}
    {#snippet h3()}<PrizeCard prize={{ kind: 'standing', headline: [{ title: LONG[0]?.title ?? '', detail: null, sponsor: LONG[0]?.sponsor ?? null }], more: 0 }} />{/snippet}
    {@render cell('PrizeCard · standing, a long name and sponsor (R9)', h3)}
    {#snippet r1()}<PaperCard layout="row"><b>10:40 · Quina 3</b></PaperCard>{/snippet}
    {@render cell('PaperCard · row (Horari’s current round)', r1)}
    {#snippet r2()}<PaperCard layout="hero" ring="gold" ribbon={{ label: 'Premi principal', color: 'gold' }}><b>Ring gold (R1)</b></PaperCard>{/snippet}
    {@render cell('PaperCard · hero with ring="gold"', r2)}
  </div>
</section>

{#if !projector}
<section class="ds-gallery__section" aria-labelledby="c3">
  <h2 id="c3">C3 · Sheet</h2>
  <p class="ds-prose">
    The native modal <code>&lt;dialog&gt;</code> (D-n, #67): Esc and the back gesture close it, and a tap outside on the phone. It
    rises out of its <code>origin</code> (@starting-style), follows the finger on its title bar or on its content pulled down from
    the top (the scroll hands over at the top, the axis locks), closes on a flick or past 30 %, and springs back otherwise. ✕ and ‹
    sit as far from the side as from the top; the grab handle floats over them (R7, #68). <strong>(27 Nov, §8 Y3)</strong>
    <code>drag="stiff"</code> for a sheet that holds a form («Afegir cartró», «Editar»): a rubber band downwards too (40 % of the
    finger, never past 30 % of its height) and a close only after the finger travels half its height, whatever the flick; the app
    asks before losing what was typed. A touch that starts in <code>[data-own-gesture]</code> (a list’s grip) is never the sheet’s
    drag. A sheet opened from another sheet’s content (the QR camera) closes only itself, every way, and shows no ‹.
    <strong>(28 Nov, edge to edge)</strong> The sheet reaches the screen’s bottom edge, under a phone’s gesture bar: its body’s
    last row, or its footer’s buttons, keep the safe area clear inside (<code>env(safe-area-inset-bottom)</code>), so the
    content scrolls on under the bar.
  </p>
  <div class="ds-gallery__grid">
    {#if phone}
      {#each [['bottom', 'origin bottom (Ajustos, Afegir cartró)'], ['left', 'origin left: out of Premis’s corner'], ['right', 'origin right: out of Horari’s corner']] as const as [origin, caption] (origin)}
        {#snippet s()}<Button color="navy" size="s" label="Obre" onclick={() => (sheet = origin)} />{/snippet}
        {@render cell(caption, s)}
      {/each}
      {#snippet s4()}<Button color="navy" size="s" label="Obre amb peu" onclick={() => ((withFooter = true), (sheet = 'bottom'))} />{/snippet}
      {@render cell('with a sticky footer (D188)', s4)}
      {#snippet s6()}<Button color="navy" size="s" label="Obre un formulari" onclick={() => ((stiff = true), (withFooter = true), (sheet = 'bottom'))} />{/snippet}
      {@render cell('drag="stiff": a form (pull it: it resists, and closes only past half its height)', s6)}
    {:else}
      {#snippet s5()}<Button color="grey" size="s" label="Obre el menú" onclick={() => (sheet = 'side-right')} />{/snippet}
      {@render cell('origin side-right: the console’s menu (✕ with its label, Esc or a tap outside; no drag)', s5)}
    {/if}
  </div>
</section>

{#if sheet}
  <Sheet
    title={sheet === 'side-right' ? 'Menú' : stiff ? 'Afegir cartró' : 'Horari'}
    subtitle={sheet === 'side-right' ? 'Tauleta · Quina 3' : null}
    origin={sheet}
    depth={stacked ? 'under' : 'top'}
    dismiss="any"
    closeLabel="Tanca"
    closeText={sheet === 'side-right'}
    class={phone ? 'drawer' : undefined}
    footer={withFooter ? saveBar : undefined}
    drag={stiff ? 'stiff' : 'free'}
    onclose={() => ((sheet = null), (withFooter = false), (stiff = false))}
  >
    {#if stiff}
      <TextField label="Nom (opcional)" placeholder="Per exemple: Àvia" bind:value={formName} />
      <p class="ds-prose">Estira’l avall: es resisteix, i només es tanca si l’estires més de mig full.</p>
    {:else}
      <p class="ds-prose">Arrossega la barra del títol, o el contingut des de dalt.</p>
    {/if}
    {#if phone}<Button color="orange" size="s" label="Apila’n un altre" onclick={() => (stacked = true)} />{/if}
    <ol class="ds-gallery__rows">
      {#each ROWS as row (row)}<li>{row}</li>{/each}
    </ol>
    {#if stacked}
      <Sheet title="Quina 2" origin="bottom" back closeLabel="Tanca" backLabel="Enrere" class="drawer" onclose={() => (stacked = false)} closeAll={() => ((stacked = false), (sheet = null))}>
        <p class="ds-prose">‹ torna al de sota; ✕ els tanca tots.</p>
      </Sheet>
    {/if}
  </Sheet>
{/if}

<section class="ds-gallery__section" aria-labelledby="c4">
  <h2 id="c4">C4 · Dialog</h2>
  <p class="ds-prose">
    The native modal <code>&lt;dialog&gt;</code> (D-n, #69): it pops in from @starting-style and leaves the same way while still open;
    the focus starts on the safe action (<code>autofocus</code>), and Esc means it. Props: <code>title</code>, <code>icon</code>,
    <code>body</code>, <code>size</code> (s, m, l), <code>fill</code> (surface, paper), <code>role</code>, <code>dismiss</code>; slots
    <code>trailing</code>, <code>warning</code>, <code>children</code>, <code>actions</code>.
  </p>
  <div class="ds-gallery__grid">
    {#if phone}
      {#snippet d1()}<Button color="navy" size="s" label="Sortir del teclat" onclick={() => (dialog = 'paper')} />{/snippet}
      {@render cell('size s, fill paper: «Descartar el #123?» (M13 ②)', d1)}
    {:else}
      {#snippet d2()}<Button color="gold" size="s" label="Dona-la per bona" onclick={() => (dialog = 'm')} />{/snippet}
      {@render cell('size m with a warning: the review’s confirmation (C12 ②)', d2)}
      {#snippet d3()}<Button color="grey" size="s" label="Comandament" onclick={() => (dialog = 'l')} />{/snippet}
      {@render cell('size l, role dialog: a panel (Comandament)', d3)}
    {/if}
  </div>
</section>

{/if}

{#if dialog === 'paper'}
  <Dialog fill="paper" title="Descartar el #123?" body="Encara no l’has desat." onclose={() => (dialog = null)} oncancel={() => (dialog = null)}>
    {#snippet actions()}
      <Button color="green" size="s" icon="pencil" label="Continuar" autofocus onclick={() => (dialog = null)} />
      <Button color="red" variant="soft" size="s" icon="trash" label="Descartar" onclick={() => (dialog = null)} />
    {/snippet}
  </Dialog>
{:else if dialog === 'm' || dialog === 'l'}
  {@const panel = dialog === 'l'}
  <Dialog
    size={dialog}
    role={panel ? 'dialog' : 'alertdialog'}
    icon={panel ? 'wii-remote' : null}
    title={panel ? 'Comandament' : 'Dona-la per bona?'}
    body={panel ? null : 'Les cançons que queden no es destapen: sonen la fanfàrria i la celebració, com si hagués passat.'}
    onclose={() => (dialog = null)}
  >
    {#snippet warning()}{#if !panel}<p class="ds-gallery__warning">El cartró no passa: hi falta «Elefants».</p>{/if}{/snippet}
    {#if panel}<p class="ds-prose">Apareix sol quan es connecta un comandament.</p>{/if}
    {#snippet actions()}
      <Button color="grey" size="s" label="Torna a la revisió" autofocus onclick={() => (dialog = null)} />
      {#if !panel}<Button color="gold" size="s" icon="star" label="Sí, dona-la per bona" onclick={() => (dialog = null)} />{/if}
    {/snippet}
  </Dialog>
{/if}
