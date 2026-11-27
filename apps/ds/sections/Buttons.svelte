<!--
  The gallery's buttons family (A2–A9; the buttons helper, 27 Nov): every component in its variants, sizes and states,
  with long words (R9). Captions in English with GLOSSARY.md's terms; the words on the controls are UI content, so
  Catalan. The hold gestures are live: press and hold to see the fill, the strip and the hint.
-->
<script lang="ts">
  import type { Snippet } from 'svelte';
  import CornerButton from '../../../packages/ui/components/CornerButton.svelte';
  import IconButton from '../../../packages/ui/components/IconButton.svelte';
  import LongPressButton from '../../../packages/ui/components/LongPressButton.svelte';
  import MiniButton from '../../../packages/ui/components/MiniButton.svelte';
  import SoundPad from '../../../packages/ui/components/SoundPad.svelte';
  import TextLink from '../../../packages/ui/components/TextLink.svelte';
  import TwoLevelButton from '../../../packages/ui/components/TwoLevelButton.svelte';
  import Button from '../../../packages/ui/components/Button.svelte';
  import Icon from '../../../packages/ui/icons/Icon.svelte';
  import { ACTIONS, FX, ICONS, MINI, WII } from '../../console/actions.ts';
  import ThrowIcon from '../../console/components/ThrowIcon.svelte';
  import { PLAYER, PLAYER_CORNERS, PLAYER_ICONS, PLAYER_LINKS } from '../../player/actions.ts';
  import './buttons.css';

  let { phone, cell }: { phone: boolean; cell: Snippet<[string, Snippet]> } = $props();

  const LONG = 'Confirmar la línia sense comprovació, ara mateix';
  const noop = () => {};
  /** A Suspens's strip keys while the shake is on: «×3 / B+A» (D-j). */
  const SHAKE_OR = { keys: ['shake'], size: 'sm', or: WII.suspense } as const;
  const meter = { fraction: 0.2, start: '0:44', end: '3:33', marker: { at: 0.32, label: 'Drop' }, icon: 'music' } as const;
  const padItems = (names: readonly string[], arms = false) =>
    names.map((id, i) => ({ id, label: id, wii: arms && i < 4 ? { keys: [(['up', 'right', 'down', 'left'] as const)[i]], size: 'sm' as const } : null }));
  const ART = ['star', 'trophy', 'drum', 'music', 'speaker-loud', 'warning', 'cup', 'flag-finish', 'gift', 'sun'] as const;
  const effects = padItems(ART.slice(0, 6), true);
  const fanfares = padItems(ART.slice(6, 9));
  /** Two cells sounding (a static time: their light runs). */
  const playing = { star: 1, drum: 1 };
</script>

{#snippet art(id: string)}<Icon name={id as (typeof ART)[number]} alone />{/snippet}

<section class="ds-gallery__section ds-buttons" aria-labelledby="a2">
  <h2 id="a2">A2 · LongPressButton</h2>
  <p class="ds-prose">
    A Button (or the menu's row) that fires only after a hold: the fill sweeps left to right, clipped to the piece's
    inner corners (#14); a short tap shows the hint above it; reduced motion shows a percentage. Props: A1's look plus
    <code>layout</code>, <code>tag</code>, <code>hint</code>, <code>holdMs</code>, <code>onconfirm</code>.
  </p>
  <div class="ds-gallery__grid">
    {#snippet l1()}<LongPressButton {...ACTIONS.back} wii={phone ? null : ACTIONS.back.wii} onconfirm={noop} />{/snippet}
    {@render cell('button · red, the remote’s 1 / 2 held (Enrere)', l1)}
    {#snippet l2()}<LongPressButton {...ACTIONS.panic} onconfirm={noop} />{/snippet}
    {@render cell('row · solid red (Pànic)', l2)}
    {#snippet l3()}<LongPressButton {...ACTIONS.endNight} onconfirm={noop} />{/snippet}
    {@render cell('row · plain red (Acabar la nit)', l3)}
    {#snippet l4()}<LongPressButton {...ACTIONS.confirmLine} label={LONG} tag="Mantén premut" onconfirm={noop} />{/snippet}
    {@render cell('row · green, a long label, the tag (D92)', l4)}
    {#snippet l5()}<LongPressButton {...ACTIONS.resume} disabled onconfirm={noop} />{/snippet}
    {@render cell('row · disabled', l5)}
  </div>
</section>

<section class="ds-gallery__section ds-buttons" aria-labelledby="a3">
  <h2 id="a3">A3 · TwoLevelButton</h2>
  <p class="ds-prose">
    A tap is level 1, a hold escalates to level 2 on the strip at its foot, in its own palette (D-k). Off has no
    pattern; level 1 on pans the stripes; level 2 on is the strip's dark shade with the dots panning; locked never shows
    a pattern (R3, #17–#23). The Throw's two buttons are the same component with a meter and sticker art.
  </p>
  <div class="ds-gallery__grid ds-buttons__tall">
    {#snippet t1()}<TwoLevelButton {...ACTIONS.hold} iconPlacement="top" lead="mantén" />{/snippet}
    {@render cell('off (cyan): no pattern', t1)}
    {#snippet t2()}<TwoLevelButton {...ACTIONS.stay} iconPlacement="top" lead="mantén" active={1} note="prem per reprendre" />{/snippet}
    {@render cell('level 1 on (purple): sunk, stripes panning', t2)}
    {#snippet t3()}<TwoLevelButton {...ACTIONS.stay} iconPlacement="top" active={2} level2={{ ...ACTIONS.stay.level2, wii: null }} note="toca per aterrar" timer="s'allibera sol en 8 s" pulse={0.4} />{/snippet}
    {@render cell('level 2 on: the strip’s edge shade, dots panning, the countdown pulsing', t3)}
    {#snippet t4()}<TwoLevelButton {...ACTIONS.hold} iconPlacement="top" active={2} note="en pausa · toca per tornar" badge={{ icon: 'lock', label: 'Parlem queda posat' }} />{/snippet}
    {@render cell('locked on (the padlock): no pattern on the body (#23)', t4)}
    {#snippet t5()}<TwoLevelButton {...ACTIONS.stay} iconPlacement="top" lead="mantén" level2={{ ...ACTIONS.stay.level2, wii: phone ? null : SHAKE_OR }} />{/snippet}
    {@render cell('the strip’s keys: «×3 / B+A», OR is «/» (D-j, #12)', t5)}
    {#snippet t6()}<TwoLevelButton {...ACTIONS.hold} iconPlacement="top" lead="mantén" disabled />{/snippet}
    {@render cell('disabled', t6)}
  </div>
  <h3>The Throw’s two buttons</h3>
  <div class="ds-gallery__grid ds-gallery__grid--wide ds-buttons__tall">
    {#snippet r1()}<TwoLevelButton {...ACTIONS.throw} label="Llançament" note="toca: sona el llançament">{#snippet art()}<ThrowIcon song="throw" />{/snippet}</TwoLevelButton>{/snippet}
    {@render cell('idle: its colour, no stripes (#20)', r1)}
    {#snippet r2()}<TwoLevelButton {...ACTIONS.storm} label="Tempesta" sub="de blat de moro" note="toca: atura" active={1} {meter}>{#snippet art()}<ThrowIcon song="storm" />{/snippet}</TwoLevelButton>{/snippet}
    {@render cell('playing: sunk, stripes panning, the meter with the drop', r2)}
    {#snippet r3()}<TwoLevelButton {...ACTIONS.storm} label="Tempesta" sub="de blat de moro" level2={null}>{#snippet art()}<ThrowIcon song="storm" />{/snippet}</TwoLevelButton>{/snippet}
    {@render cell('no strip (level2 null): the hold sweeps the whole body', r3)}
  </div>
</section>

<section class="ds-gallery__section ds-buttons" aria-labelledby="a4">
  <h2 id="a4">A4 · MiniButton</h2>
  <p class="ds-prose">The small secondary button, the toggle and the pace preset. On the press resource: its ring has one gap all round (R1, #24); the dashed «suggested» look has a dashed edge too (R11, #25).</p>
  <div class="ds-gallery__grid">
    {#each ['grey', 'gold', 'green', 'orange'] as const as color (color)}
      {#snippet m()}<MiniButton {color} icon="eye" label="Mirar el futur" />{/snippet}
      {@render cell(`${color} at rest`, m)}
    {/each}
    {#snippet m1()}<MiniButton {...MINI.lock} pressed />{/snippet}
    {@render cell('pressed · gold (a toggle on)', m1)}
    {#snippet m2()}<MiniButton {...MINI.auto} pressed wii={phone ? null : MINI.auto.wii} />{/snippet}
    {@render cell('pressed · green, HOME on its corner', m2)}
    {#snippet m3()}<span class="ds-buttons__row"><MiniButton label="Ràpid" sub="14 s" variant="dashed" /><MiniButton label="Normal" sub="18 s" pressed /></span>{/snippet}
    {@render cell('the pace presets: sub, dashed «suggested», selected', m3)}
    {#snippet m4()}<span class="ds-buttons__row"><MiniButton {...MINI.paceMinus} aria-label="Més ràpid" /><MiniButton {...MINI.pacePlus} aria-label="Més lent" /></span>{/snippet}
    {@render cell('icon-only (aria-label)', m4)}
    {#snippet m5()}<MiniButton label="Ràpid" sub="14 s" variant="dashed" ring="orange" />{/snippet}
    {@render cell('a ring: one gap all round, the edge and shadow included (#24)', m5)}
    {#snippet m6()}<MiniButton {...MINI.lock} disabled />{/snippet}
    {@render cell('disabled', m6)}
  </div>
  <h3>Sizes (D-h: xs for tight spots, #87)</h3>
  <div class="ds-gallery__grid">
    {#each ['xs', 's', 'm', 'l'] as const as size (size)}
      {#snippet ms()}<MiniButton {size} icon="pencil" label="Editar" />{/snippet}
      {@render cell(`size ${size}`, ms)}
    {/each}
  </div>
</section>

<section class="ds-gallery__section ds-buttons" aria-labelledby="a5">
  <h2 id="a5">A5 · CornerButton</h2>
  <p class="ds-prose">The phone’s two corner discs, fixed to a bottom corner of the page’s column; a quarter shows. Press one: the disc dips and its sticker tilts further (#27).</p>
  <div class="ds-buttons__corners">
    <CornerButton {...PLAYER_CORNERS.prizes} />
    <CornerButton {...PLAYER_CORNERS.schedule} expanded />
  </div>
  <p class="ds-gallery__note">Placement: <code>--corner-button-column</code> (the player sets its column) and <code>--corner-button-size</code>; leave it out with <code>{'{#if}'}</code> during a Celebration (D-b).</p>
</section>

<section class="ds-gallery__section ds-buttons" aria-labelledby="a6">
  <h2 id="a6">A6 · Button floating (the home’s «+ Cartró»)</h2>
  <div class="ds-gallery__grid">
    {#snippet f1()}<Button {...PLAYER.addCardFloating} />{/snippet}
    {@render cell('the quiet preset: navy on the night, the floating shadow (the user’s phone test)', f1)}
    {#snippet f2()}<Button color="orange" floating size="s" icon="plus" label="Cartró" sound="floating" />{/snippet}
    {@render cell('orange, for comparison', f2)}
  </div>
</section>

<section class="ds-gallery__section ds-buttons" aria-labelledby="a7">
  <h2 id="a7">A7 · IconButton</h2>
  <p class="ds-prose">Only an icon; its label is the accessible name. Framed: its 3D edge is the fill’s own shade, never ink black (R2, #32). Bare: the icon travels when pressed (#33). Floating: the paper disc.</p>
  <div class="ds-gallery__grid">
    {#each ['surface', 'navy', 'grey', 'red', 'gold', 'snow'] as const as color (color)}
      {#snippet ib()}<IconButton icon="cog" label="Ajustos" {color} />{/snippet}
      {@render cell(`framed · ${color}`, ib)}
    {/each}
    {#snippet ib1()}<span class="ds-buttons__row"><IconButton {...PLAYER_ICONS.sheetBack} /><IconButton {...PLAYER_ICONS.sheetClose} /></span>{/snippet}
    {@render cell('a sheet’s ‹ and ✕ (48 px)', ib1)}
    {#snippet ib2()}<span class="ds-buttons__row"><IconButton {...ICONS.menu} size="s" /><IconButton icon="cog" label="Ajustos" pressed /></span>{/snippet}
    {@render cell('size s · pressed', ib2)}
    {#snippet ib3()}<span class="ds-buttons__row"><IconButton {...PLAYER_ICONS.cardEdit} label="Editar" /><IconButton {...PLAYER_ICONS.cardRemove} label="Treure" /></span>{/snippet}
    {@render cell('bare', ib3)}
    {#snippet ib4()}<IconButton {...ICONS.removeFinalist} label="Treu el #57" />{/snippet}
    {@render cell('floating: the disc, a 44 px hit area', ib4)}
    {#snippet ib5()}<IconButton icon="close" label="Tancar" disabled />{/snippet}
    {@render cell('disabled', ib5)}
  </div>
</section>

<section class="ds-gallery__section ds-buttons" aria-labelledby="a8">
  <h2 id="a8">A8 · TextLink</h2>
  <div class="ds-gallery__grid">
    {#snippet x1()}<TextLink {...PLAYER_LINKS.wipe} />{/snippet}
    {@render cell('red: opens a confirmation, never confirms (D188)', x1)}
    {#snippet x2()}<TextLink {...PLAYER_LINKS.seeOwned} />{/snippet}
    {@render cell('gold', x2)}
    {#snippet x3()}<TextLink color="gold" label="Veure el cartró de l’any passat que encara tens guardat" href="#a8" />{/snippet}
    {@render cell('a link (href), long words wrapping', x3)}
  </div>
</section>

<section class="ds-gallery__section ds-buttons" aria-labelledby="a9">
  <h2 id="a9">A9 · SoundPad</h2>
  <p class="ds-prose">One grid, one ink line between cells with rounded inner corners; bumps that dip when pressed; no colour bar; a sounding cell’s light runs round its inner ring (D-l, #34). The last row fills with blank cells.</p>
  <div class="ds-buttons__pads">
    <figure class="ds-gallery__cell">
      <div class="ds-gallery__stage"><SoundPad {...FX.stingers} items={fanfares} {art} onplay={noop} aria-label="Fanfares" /></div>
      <figcaption>gold, one column</figcaption>
    </figure>
    <figure class="ds-gallery__cell">
      <div class="ds-gallery__stage"><SoundPad {...FX.effects} items={phone ? padItems(ART.slice(0, 6)) : effects} {art} {playing} onplay={noop} aria-label="Efectes" /></div>
      <figcaption>snow, four columns: two sounding, the D-pad arms (console), blank cells filling the row</figcaption>
    </figure>
    <figure class="ds-gallery__cell">
      <div class="ds-gallery__stage"><SoundPad {...FX.effects} items={padItems(ART.slice(0, 4))} {art} disabled onplay={noop} aria-label="Efectes" /></div>
      <figcaption>disabled</figcaption>
    </figure>
  </div>
</section>
