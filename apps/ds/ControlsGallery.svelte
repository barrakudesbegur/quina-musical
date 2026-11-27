<!--
  The controls family in the gallery (components-v2.md § 3, B1–B10; comments-27nov.md). Every component in every
  layout, size and state, set through its real inputs (a value, its validity, `disabled`), never a `state` prop (D-c).
  Content is neutral (#42): the gallery shows components, never a screen's story. Captions in English with
  GLOSSARY.md's terms; the controls' words are UI content, so Catalan.
-->
<script lang="ts">
  import type { Snippet } from 'svelte';
  import Chip from '../../packages/ui/components/Chip.svelte';
  import IconPicker from '../../packages/ui/components/IconPicker.svelte';
  import NumberField from '../../packages/ui/components/NumberField.svelte';
  import NumberPad from '../../packages/ui/components/NumberPad.svelte';
  import WiiKey from '../../packages/ui/components/WiiKey.svelte';
  import Slider from '../../packages/ui/components/Slider.svelte';
  import SegmentedControl from '../../packages/ui/components/SegmentedControl.svelte';
  import Switch from '../../packages/ui/components/Switch.svelte';
  import Tabs from '../../packages/ui/components/Tabs.svelte';
  import TextField from '../../packages/ui/components/TextField.svelte';
  import type { TabSpec } from '../../packages/ui/components/control-types.ts';

  let { phone }: { phone: boolean } = $props();

  // Live examples: a press changes them, as in the apps.
  let on = $state(true);
  let off = $state(false);
  let two = $state<'a' | 'b'>('a');
  let three = $state<'x' | 'y' | 'z'>('x');
  let view = $state<'list' | 'grid'>('grid');

  // Neutral tabs (#42: the gallery shows the component, never a screen's story).
  type TabId = 'one' | 'two' | 'three' | 'four' | 'five';
  const FIVE: TabSpec<TabId>[] = [
    { id: 'one', label: 'Primera', icon: 'chart' },
    { id: 'two', label: 'Segona', icon: 'magnifier' },
    { id: 'three', label: 'Tercera', icon: 'star' },
    { id: 'four', label: 'Quarta', icon: 'gift', badge: 3 },
    { id: 'five', label: 'Cinquena', icon: 'speaker' },
  ];
  let wide = $state<TabId>('one');
  let narrow = $state<TabId>('two');
  let withExtra = $state<TabId>('two');
  let three3 = $state<TabId>('one');
  let mode = $state<'a' | 'b'>('a');
  let shown = $state(true);
  let name = $state('');
  let query = $state('Elefants');
  let vol = $state(80);
  let loud = $state(130);
  let digits = $state('12');
  let typed = $state('57');
  let pick = $state(3);
  const PICKS = [
    { value: 1, label: 'Estrella', icon: 'star', disabled: true, tag: 'Àvia' },
    { value: 2, label: 'Regal', icon: 'gift', disabled: true, tag: '#57' },
    { value: 3, label: 'Música', icon: 'music' },
    { value: 4, label: 'Trofeu', icon: 'trophy' },
    { value: 5, label: 'Bandera', icon: 'flag' },
    { value: 6, label: 'Rellotge', icon: 'clock' },
    { value: 7, label: 'Bitllet', icon: 'ticket' },
    { value: 8, label: 'Copa', icon: 'cup' },
    { value: 9, label: 'Cara', icon: 'sad-face', disabled: true, tag: 'Un nom molt llarg' },
    { value: 10, label: 'Ull', icon: 'eye' },
  ] as const;
  const press = (key: string) => {
    if (key === 'back') digits = digits.slice(0, -1);
    else if (key !== 'enter' && digits.length < 3) digits += key;
  };
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

<section class="ds-gallery__section" aria-labelledby="b3">
  <h2 id="b3">B3 · Tabs</h2>
  <p class="ds-prose">
    Folder tabs over one panel: <code>tabs</code> (<code>id</code>, <code>label</code>, <code>icon</code>, <code>badge</code>),
    <code>selected</code>, <code>label</code>, <code>panel</code> (a snippet), <code>extras</code> (a snippet per tab id: the tab’s own control,
    drawn on the selected tab, D-g, #41), <code>sound</code>. The tabs and their focus ring sit behind the panel (#39); the bar’s insets
    are equal (#40). When the tabs’ own width is too small, the tabs that aren’t selected show their icon only (a container query,
    #44). Arrows, Home and End move and select.
  </p>
  {#snippet body(id: string)}<p class="ds-prose">Contingut de la pestanya «{FIVE.find((t) => t.id === id)?.label}».</p>{/snippet}
  {#snippet modes()}<SegmentedControl size="s" class="ds-gallery__tab-modes" label="Mode" options={[{ id: 'a', label: 'Una', icon: 'music' }, { id: 'b', label: 'Altra', icon: 'grid' }]} bind:value={mode} />{/snippet}
  {#snippet toggle()}<Switch layout="inline" class="ds-gallery__tab-switch" icon="eye" label="Visible" checked={shown} onchange={(v) => (shown = v)} />{/snippet}
  <div class="ds-gallery__stack">
    {#snippet t1()}<div class="ds-gallery__tabs" style:width="46rem"><Tabs tabs={FIVE} bind:selected={wide} label="Exemple" panel={body} /></div>{/snippet}
    {@render cell('five tabs with room: every label shows; a badge on the fourth', t1)}
    {#snippet t2()}<div class="ds-gallery__tabs" style:width="24rem"><Tabs tabs={FIVE} bind:selected={narrow} label="Exemple estret" panel={body} /></div>{/snippet}
    {@render cell('narrow: only the selected tab keeps its label (#44)', t2)}
    {#snippet t3()}<div class="ds-gallery__tabs" style:width="37rem"><Tabs tabs={FIVE} bind:selected={withExtra} label="Amb control" panel={body} extras={{ two: modes, three: toggle }} /></div>{/snippet}
    {@render cell('extras: a segmented control on «Segona», a switch on «Tercera»; the others collapse to make room', t3)}
    {#snippet t4()}<div class="ds-gallery__tabs" style:width="30rem"><Tabs tabs={FIVE.slice(0, 3)} bind:selected={three3} label="Tres" panel={body} /></div>{/snippet}
    {@render cell('three tabs: wider padding', t4)}
  </div>
</section>

<section class="ds-gallery__section" aria-labelledby="b9">
  <h2 id="b9">B9 · TextField</h2>
  <p class="ds-prose">
    Free text with a visible label: <code>label</code>, <code>value</code>, <code>placeholder</code> (a hint, never the label),
    <code>hint</code>, <code>invalid</code>, <code>prefixIcon</code>, <code>clearable</code> + <code>clearLabel</code>, <code>rows</code>
    (a textarea), <code>size</code> (m | l). The hint lines up with the text in the box (#57); the clear button is as far from the end
    as from the top and the bottom (#59); the text in the box is never highlighted (#58).
  </p>
  <div class="ds-gallery__grid ds-gallery__grid--wide">
    {#snippet f1()}<TextField label="Nom (opcional)" placeholder="Per exemple: Àvia" bind:value={name} />{/snippet}
    {@render cell('m: label, placeholder as a hint', f1)}
    {#snippet f2()}<TextField label="Nom de qui ha guanyat" value="" invalid hint="Escriu un nom o un número de butlleta." />{/snippet}
    {@render cell('invalid, with its hint', f2)}
    {#snippet f3()}<search><TextField type="search" size="l" label="Cerca una cançó" placeholder="Títol o artista" prefixIcon="magnifier" clearable clearLabel="Esborra la cerca" autocomplete="off" spellcheck="false" enterkeyhint="search" bind:value={query} /></search>{/snippet}
    {@render cell('l · search: big text, the leading icon, the clear button (D-f)', f3)}
    {#snippet f4()}<TextField label="Notes" rows={2} hint="Només a la consola." value="Recull el premi a la barra" />{/snippet}
    {@render cell('rows=2: a textarea, with a hint', f4)}
    {#snippet f5()}<TextField label="Nom del dispositiu" value="Tauleta" disabled />{/snippet}
    {@render cell('disabled', f5)}
  </div>

  <h3>Design resource · Match highlight (D-e)</h3>
  <p class="ds-prose">A search’s matched letters, in the result rows only: <code>&lt;mark class="ds-mark"&gt;</code> per run, built from text (no <code>{'{@html}'}</code>).</p>
  <div class="ds-gallery__grid">
    {#snippet m1()}<p class="ds-gallery__result"><b><mark class="ds-mark">Ele</mark>fants</b><br />Oques Grasses</p>{/snippet}
    {@render cell('a title’s match', m1)}
    {#snippet m2()}<p class="ds-gallery__result"><b>All I Want for Christmas Is You</b><br /><mark class="ds-mark">Mar</mark>iah <mark class="ds-mark">C</mark>arey</p>{/snippet}
    {@render cell('an artist’s, in runs', m2)}
  </div>
</section>

<section class="ds-gallery__section" aria-labelledby="b10">
  <h2 id="b10">B10 · Slider</h2>
  <p class="ds-prose">
    A native range: <code>label</code>, <code>note</code>, <code>value</code>, <code>min</code>, <code>max</code>, <code>step</code>,
    <code>nudge</code> (− and +, 1), <code>page</code> (Page Up / Down, 10), <code>defaultValue</code> (the notch; past it the fill is
    gold), <code>format</code> («80%», #62), <code>disabled</code>, <code>oninput</code> / <code>onchange</code>. The value ends flush with
    the track (#60); the thumb’s focus ring keeps one gap all round (#63). Silent.
  </p>
  <div class="ds-gallery__grid ds-gallery__grid--wide">
    {#snippet v1()}<Slider label="Cançons" note="Les cançons de la quina" max={150} defaultValue={100} value={vol} oninput={(v) => (vol = v)} lessLabel="Baixa 1%" moreLabel="Puja 1%" />{/snippet}
    {@render cell('under the default: orange', v1)}
    {#snippet v2()}<Slider label="Victòria" note="La fanfàrria i la música de victòria" max={150} defaultValue={100} value={loud} oninput={(v) => (loud = v)} lessLabel="Baixa 1%" moreLabel="Puja 1%" />{/snippet}
    {@render cell('past the default: the fill turns gold (D157)', v2)}
    {#snippet v3()}<Slider label="General" max={150} defaultValue={100} value={100} lessLabel="Baixa 1%" moreLabel="Puja 1%" />{/snippet}
    {@render cell('at the default: the value muted', v3)}
    {#snippet v4()}<Slider label="Efectes" max={150} value={60} disabled lessLabel="Baixa 1%" moreLabel="Puja 1%" />{/snippet}
    {@render cell('disabled', v4)}
  </div>
</section>

<section class="ds-gallery__section" aria-labelledby="b7">
  <h2 id="b7">B7 · NumberField + NumberPad</h2>
  <p class="ds-prose">
    NumberField: <code>value</code>, <code>label</code>, <code>invalid</code>, <code>disabled</code>, <code>keyboard</code> (pad | system),
    <code>trailing</code>. No <code>state</code> prop (D-c, #51): empty, typed and red come from the value and its validity.
    NumberPad: <code>enabled</code> digits, <code>canDelete</code>, <code>enter</code> + <code>canEnter</code>, <code>deleteKey</code>,
    <code>row</code>, <code>onkey</code>. Keys press like every piece (R4).
  </p>
  <div class="ds-gallery__grid ds-gallery__grid--wide">
    {#snippet n1()}<div class="ds-gallery__pad"><NumberField label="Número del cartró" value={digits} /><NumberPad label="Teclat" backLabel="Esborra" enabled={new Set(['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'].filter((d) => d !== '7'))} canDelete={digits !== ''} onkey={press} /></div>{/snippet}
    {@render cell('pad: the field typed by the keys; «7» can’t lead to a card here (enabled)', n1)}
    {#snippet n2()}<div class="ds-gallery__pad"><NumberField label="Número del cartró" value="" /><NumberPad label="Teclat" backLabel="Esborra" enter enterLabel="Entra" canEnter={false} canDelete={false} onkey={() => {}} /></div>{/snippet}
    {@render cell('empty, with ↵ (disabled until a number is typed)', n2)}
    {#snippet n3()}<NumberField label="Número del cartró" value="999" invalid />{/snippet}
    {@render cell('invalid: «Aquest cartró no existeix» (the frame stays, #53)', n3)}
    {#snippet n4()}<NumberField label="Número del cartró" keyboard="system" bind:value={typed} />{/snippet}
    {@render cell('system: a real numeric input (the card’s edit drawer)', n4)}
    {#snippet n5()}<NumberPad row label="Teclat" backLabel="Esborra" enter enterLabel="Mostra" onkey={() => {}} />{/snippet}
    {@render cell('row: twelve keys in one line', n5)}
  </div>
</section>

<section class="ds-gallery__section" aria-labelledby="b8">
  <h2 id="b8">B8 · IconPicker</h2>
  <p class="ds-prose">
    Radios in a fieldset: <code>options</code> (<code>value</code>, <code>label</code>, <code>icon</code>, <code>disabled</code>,
    <code>tag</code>; generic, D-c, #50), <code>value</code>, <code>legend</code>, <code>hint</code>, <code>mark</code> (a snippet: the phone
    draws its card marks), <code>sound</code>. A tag overlaps its swatch’s foot (#54); the chosen swatch’s gold ring keeps one gap all
    round (#55, #56).
  </p>
  <div class="ds-gallery__grid ds-gallery__grid--wide">
    {#snippet p1()}<IconPicker legend="Icona" hint="Cada cartró en té una de diferent" options={PICKS} bind:value={pick} />{/snippet}
    {@render cell('two disabled with a tag, a long tag clipped; the third chosen', p1)}
  </div>
</section>

<section class="ds-gallery__section" aria-labelledby="b5">
  <h2 id="b5">B5 · WiiKey</h2>
  <p class="ds-prose">
    The remote’s keys a control answers to (the <code>wii</code> slot: <code>keys</code>, <code>hold</code>, <code>withA</code>,
    <code>size</code>), drawn like the real keys and always white (the colours are the legend’s, C9). «− +» is two keys (D91). The
    D-pad arm is a cross as tall as A, with soft corners (#46). Shown only while a remote is connected; decorative.
  </p>
  <div class="ds-gallery__grid">
    {#snippet w1()}<span class="ds-gallery__keys"><WiiKey spec={{ keys: ['a'] }} /><WiiKey spec={{ keys: ['b'] }} /><WiiKey spec={{ keys: ['minus', 'plus'] }} /><WiiKey spec={{ keys: ['one', 'two'] }} /><WiiKey spec={{ keys: ['home'] }} /></span>{/snippet}
    {@render cell('md: A, B, − +, 1 2, HOME', w1)}
    {#snippet w2()}<span class="ds-gallery__keys"><WiiKey spec={{ keys: ['a'], size: 'sm' }} /><WiiKey spec={{ keys: ['b'], size: 'sm' }} /><WiiKey spec={{ keys: ['minus', 'plus'], size: 'sm' }} /><WiiKey spec={{ keys: ['one', 'two'], size: 'sm' }} /><WiiKey spec={{ keys: ['home'], size: 'sm' }} /></span>{/snippet}
    {@render cell('sm: inside strips', w2)}
    {#snippet w3()}<span class="ds-gallery__keys"><WiiKey spec={{ keys: ['up'] }} /><WiiKey spec={{ keys: ['right'] }} /><WiiKey spec={{ keys: ['down'] }} /><WiiKey spec={{ keys: ['left'] }} /><WiiKey spec={{ keys: ['up'], size: 'sm' }} /></span>{/snippet}
    {@render cell('the D-pad’s four arms (the Efectes pads), and one sm (#46)', w3)}
    {#snippet w4()}<span class="ds-gallery__keys"><WiiKey spec={{ keys: ['one', 'two'], hold: true }} /><WiiKey spec={{ keys: ['b'], hold: true, withA: true }} /></span>{/snippet}
    {@render cell('held: the three-quarter ring; B + A held (Suspens)', w4)}
    {#snippet w5()}<span class="ds-gallery__keys"><WiiKey spec={{ keys: ['shake'] }} /><WiiKey spec={{ keys: ['shake'], size: 'sm' }} /></span>{/snippet}
    {@render cell('shake ×3 (D94): the remote as tall as A', w5)}
  </div>
</section>

<section class="ds-gallery__section" aria-labelledby="b4">
  <h2 id="b4">B4 · Chip</h2>
  <p class="ds-prose">
    A status label, never tappable: <code>color</code> × <code>variant</code> (subtle | solid), <code>glow</code> (a separate boolean,
    D-d, #45), <code>border</code> (ink | edge), <code>size</code> (m | s), <code>customColor</code>, <code>dot</code> or
    <code>icon</code>, <code>label</code>, <code>value</code>.
  </p>
  <div class="ds-gallery__grid">
    {#snippet c1()}<span class="ds-gallery__keys"><Chip label="Avanç manual" /><Chip color="ink" variant="solid" label="#57" /><Chip color="green" label="Línia · vàlid" /><Chip color="red" label="Cartró descartat" /></span>{/snippet}
    {@render cell('grey, ink solid, green and red subtle', c1)}
    {#snippet c2()}<span class="ds-gallery__keys"><Chip color="cyan" label="Parlem · des de fa 0:42" /><Chip color="purple" label="Aguanta · des de fa 0:15" /><Chip color="gold" label="Suspens obert" /><Chip color="orange" label="Girant · aterra en 6 s" /></span>{/snippet}
    {@render cell('cyan, purple, gold, orange subtle', c2)}
    {#snippet c3()}<span class="ds-gallery__keys"><Chip color="red" variant="solid" label="+2 min" /><Chip color="orange" border="edge" icon="warning" label="No registrat com a venut" /></span>{/snippet}
    {@render cell('red solid (the drift); orange with its edge (a warning)', c3)}
    {#snippet c4()}<span class="ds-gallery__dark"><Chip color="green" variant="solid" glow label="Dempeus" /><Chip color="slate" variant="solid" label="Assegut" /></span>{/snippet}
    {@render cell('glow: a separate prop on green solid (D-d); slate solid', c4)}
    {#snippet c5()}<span class="ds-gallery__keys"><Chip dot="on" label="LAN" /><Chip dot="off" label="Wii" /><Chip dot="off" label="Mòbils" value="312" /><Chip color="red" dot="alert" label="Núvol" /></span>{/snippet}
    {@render cell('dots (on, off, alert) and a value', c5)}
    {#snippet c6()}<span class="ds-gallery__keys"><Chip size="s" color="ink" variant="solid" label="Línia" /><Chip size="s" label="falten 3" /><Chip customColor="#cfe8ff" label="Normal 1–5" /><Chip customColor="#ffd9e8" icon="star" label="Especial" /></span>{/snippet}
    {@render cell('s; customColor (the card types’ pastels)', c6)}
  </div>
</section>
