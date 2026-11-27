<!--
  The design system's gallery (development only; main.ts). Captions are English with GLOSSARY.md's terms; the buttons'
  words are UI content, so they're Catalan. Sections: the palette slots, A1 · Button in every variant, size and state,
  then the design resources (R1–R11 of the user's 27 Nov comments). Each family the next helpers build adds a section.
-->
<script lang="ts">
  import { onMount, untrack, type Snippet } from 'svelte';
  import Button from '../../packages/ui/components/Button.svelte';
  import { provideDs } from '../../packages/ui/components/providers.ts';
  import { PALETTE_COLORS, type ButtonColor, type ButtonSize, type ButtonVariant } from '../../packages/ui/components/types.ts';
  import { CONCEPTS } from '../../packages/ui/concepts.ts';
  import { ACTIONS, WII, asDefault } from '../console/actions.ts';
  import { setWii } from '../console/context.ts';
  import ConsoleWii from '../console/components/DsWii.svelte';
  import type { WiiController } from '../console/wii/controller.svelte.ts';
  import { PLAYER } from '../player/actions.ts';
  import StatusSections from './StatusSections.svelte';
  import CardsSongs from './sections/CardsSongs.svelte';
  import PanelsSection from './PanelsSection.svelte';
  import ButtonsFamily from './sections/Buttons.svelte';
  import IconsSection from './sections/Icons.svelte';
  import ControlsGallery from './ControlsGallery.svelte';
  import ConsoleMenu from './sections/ConsoleMenu.svelte';

  let { density, theme }: { density: 'console' | 'phone' | 'projector'; theme: 'light' | 'dark' } = $props();

  // The page's density is fixed for its life (main.ts reads it once from the URL and loads that app's stylesheet).
  const phone = untrack(() => density) === 'phone';
  const projector = untrack(() => density) === 'projector';
  // The console's Wii keys, as if a remote were connected (the phone shows none).
  if (!phone) {
    setWii({ badges: true, shake: false } as unknown as WiiController);
    provideDs({ wii: ConsoleWii });
  }

  let reduced = $state(false);
  onMount(() => {
    const query = matchMedia('(prefers-reduced-motion: reduce)');
    reduced = query.matches;
    const update = () => (reduced = query.matches);
    query.addEventListener('change', update);
    return () => query.removeEventListener('change', update);
  });

  /** One word per Button colour, the concept that wears it (UI content, so Catalan). */
  const COLOR_WORDS: Record<ButtonColor, string> = {
    orange: CONCEPTS.next.label,
    red: CONCEPTS.back.label,
    green: 'Comprovar',
    gold: CONCEPTS.celebration.label,
    cyan: CONCEPTS.hold.label,
    purple: CONCEPTS.stay.label,
    pink: CONCEPTS.throw.label,
    navy: CONCEPTS.storm.label,
    grey: 'Torna a la quina',
  };
  const BUTTON_COLORS = Object.keys(COLOR_WORDS) as ButtonColor[];
  const VARIANTS: ButtonVariant[] = ['solid', 'soft', 'plain', 'dashed'];
  const SIZES: ButtonSize[] = ['xs', 's', 'm', 'l'];
  const SLOTS = ['solid', 'edge', 'pale', 'subtle', 'fg', 'contrast'] as const;
  const ICON = phone ? 'plus' : 'skip';
  const LONG_TITLES = ['All I Want for Christmas Is You', 'SUPERESTRELLA', 'Boig Per Tu'];
  const nextSong = { title: 'Dancing in the Moonlight', artist: 'Toploader · 3 de 4' };

  /** Focus one button the way a keyboard would (R5), so its ring shows. */
  function focusRing(node: HTMLElement): void {
    const button = node.querySelector('button');
    requestAnimationFrame(() => (button as HTMLElement & { focus(o?: { focusVisible?: boolean; preventScroll?: boolean }): void })?.focus({ focusVisible: true, preventScroll: true }));
  }
</script>

{#snippet cell(caption: string, body: Snippet)}
  <figure class="ds-gallery__cell">
    <div class="ds-gallery__stage" lang="ca">{@render body()}</div>
    <figcaption>{caption}</figcaption>
  </figure>
{/snippet}

<div
  class="ds-gallery {phone ? 'player' : 'console'}"
  data-density={density}
  data-theme={phone || projector ? undefined : theme}
  data-ground={phone || projector || theme === 'dark' ? 'night' : 'paper'}
  data-motion={phone ? (reduced ? 'reduced' : 'full') : undefined}
>
  <header class="ds-gallery__header">
    <h1>Design system · {phone ? 'phone' : projector ? 'projector' : `console, ${theme} theme`}</h1>
    <nav aria-label="Density and theme">
      <a href="?density=console&amp;theme=light" aria-current={!phone && !projector && theme === 'light' ? 'page' : undefined}>Console · light</a>
      <a href="?density=console&amp;theme=dark" aria-current={!phone && !projector && theme === 'dark' ? 'page' : undefined}>Console · dark</a>
      <a href="?density=phone" aria-current={phone ? 'page' : undefined}>Phone</a>
      <a href="?density=projector" aria-current={projector ? 'page' : undefined}>Projector</a>
    </nav>
    <p class="ds-prose">
      Development only (not in the build). Every button here is live: press one to feel R4's press, and Tab to see R5's
      focus ring. Moving things move only with motion allowed{phone ? ' (and the phone’s data-motion="full")' : ''}; now: {reduced ? 'reduced, so they stand still' : 'allowed'}.
      Spec: components-v2.md (A1 and § 11) with the 27 Nov comments (comments-27nov.md).
    </p>
  </header>

  <section class="ds-gallery__section" aria-labelledby="pal">
    <h2 id="pal">Palette slots (§ 1.1, D210)</h2>
    <p class="ds-prose">A component reads only these slots; its <code>color</code> prop picks the palette through <code>data-color</code>. A blank slot is one no component uses with that colour yet.</p>
    <div class="ds-gallery__table-wrap">
      <table class="ds-gallery__palette">
        <thead><tr><th>color</th>{#each SLOTS as slot (slot)}<th>{slot}</th>{/each}</tr></thead>
        <tbody>
          {#each PALETTE_COLORS as color (color)}
            <tr data-color={color}>
              <th scope="row">{color}</th>
              {#each SLOTS as slot (slot)}
                <td><span class="ds-gallery__swatch" data-slot={slot}>{slot === 'fg' || slot === 'contrast' ? 'Aa' : ''}</span></td>
              {/each}
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
  </section>

  <section class="ds-gallery__section" aria-labelledby="a1">
    <h2 id="a1">A1 · Button</h2>
    <p class="ds-prose">
      Props say what it draws: <code>color</code>, <code>variant</code>, <code>size</code>, <code>floating</code>, <code>pattern</code>,
      <code>ring</code>, <code>ribbon</code>, <code>pressed</code>, <code>disabled</code>, <code>busy</code>, <code>sound</code>; slots
      <code>icon</code>, <code>label</code>, <code>note</code>, <code>wii</code> and <code>children</code>. No <code>hidden</code> or
      <code>state</code> prop (D-b, D-c).
    </p>

    <h3>Colours (solid)</h3>
    <div class="ds-gallery__grid">
      {#each BUTTON_COLORS as color (color)}
        {#snippet b()}<Button {color} label={COLOR_WORDS[color]} note={color === 'grey' ? 'tanca el teclat' : null} />{/snippet}
        {@render cell(color, b)}
      {/each}
    </div>

    <h3>Variants</h3>
    <div class="ds-gallery__grid">
      {#each VARIANTS as variant (variant)}
        {#each ['orange', 'red', 'grey'] as const as color (color)}
          {#snippet b()}<Button {color} {variant} icon={variant === 'plain' ? null : ICON} label={COLOR_WORDS[color]} />{/snippet}
          {@render cell(`${variant} · ${color}`, b)}
        {/each}
      {/each}
    </div>
    <p class="ds-gallery__note">dashed is R11's «suggested» look: its 3D edge is dashed too (#25).</p>

    <h3>Sizes (D165, D-h's xs)</h3>
    <div class="ds-gallery__grid ds-gallery__grid--wide">
      {#each SIZES as size (size)}
        {#snippet b()}<Button color="orange" {size} icon={ICON} label={CONCEPTS.next.label} note={size === 'xs' ? null : 'toca: la següent cançó'} />{/snippet}
        {@render cell(`size ${size}`, b)}
      {/each}
    </div>

    <h3>Slots and icon placement</h3>
    <div class="ds-gallery__grid">
      {#snippet s1()}<Button color="green" icon="rosette" label={CONCEPTS.claim.label} />{/snippet}
      {@render cell('icon start (default) + label', s1)}
      {#snippet s2()}<Button color="cyan" icon="mic" iconPlacement="top" label={CONCEPTS.hold.label} note="toca: la música baixa" />{/snippet}
      {@render cell('icon top + label + note', s2)}
      {#snippet s3()}<Button color="grey" label="Revisió manual" note="sense resultat" />{/snippet}
      {@render cell('label + note, no icon', s3)}
      {#snippet s4()}
        <Button {...ACTIONS.checkReveal} class="ds-gallery__destapa" note={null}>
          <span class="ds-gallery__song"><span class="ds-gallery__cover" aria-hidden="true">♪</span><span><b>{nextSong.title}</b><br />{nextSong.artist}</span></span>
        </Button>
      {/snippet}
      {@render cell('children: «Destapa» shows the next song inside (D-i: not a TwoLevelButton)', s4)}
    </div>

    <h3>States</h3>
    <div class="ds-gallery__grid">
      {#snippet t1()}<Button color="cyan" icon={ICON} label="Seguides" pressed={false} pattern="stripes" />{/snippet}
      {@render cell('toggle off (pressed=false): no pattern', t1)}
      {#snippet t2()}<Button color="cyan" icon={ICON} label="Seguides" pressed pattern="stripes" />{/snippet}
      {@render cell('toggle on (pressed): sunk, stripes panning (R3)', t2)}
      {#snippet t3()}<Button color="pink" icon="star" label={CONCEPTS.throw.label} pressed pattern="dots" />{/snippet}
      {@render cell('on with the second level’s dots (R3)', t3)}
      {#snippet t4()}<Button color="cyan" icon="lock" label="Parlem" pressed pattern="stripes" disabled />{/snippet}
      {@render cell('on but disabled or locked: never a pattern (#23)', t4)}
      {#snippet t5()}<Button color="orange" icon={ICON} label="Destapant" busy />{/snippet}
      {@render cell('busy: held down, the dots step', t5)}
      {#snippet t6()}<Button color="red" icon="undo" label="Enrere" disabled />{/snippet}
      {@render cell('disabled', t6)}
    </div>

    <h3>Floating (D-a, D189: the only pill)</h3>
    <div class="ds-gallery__grid">
      {#snippet f1()}<Button color="orange" floating size="s" icon="plus" label={phone ? PLAYER.addCard.label : 'Cartró'} sound="floating" />{/snippet}
      {@render cell('floating · s: the home’s «+ Cartró» (D188, D218)', f1)}
    </div>
  </section>

  <PanelsSection {density} />
  <!-- A2–A9, the buttons family (the buttons helper's section) -->
  {#if !projector}<ButtonsFamily {phone} {cell} />{/if}
  <IconsSection {cell} />

  <section class="ds-gallery__section" aria-labelledby="res">
    <h2 id="res">Design resources (R1–R11, 27 Nov)</h2>

    <h3>R1 · Rings, R11 · marks</h3>
    <p class="ds-prose">One even gap all round the whole control, its 3D edge and shadow included, drawn over its neighbours. One value, so two rings never stack.</p>
    <div class="ds-gallery__grid">
      {#snippet r1()}<Button {...asDefault({ ...ACTIONS.next, size: 'm' }, true)} />{/snippet}
      {@render cell('default action: orange ring + A (asDefault)', r1)}
      {#snippet r2()}<Button color="green" icon="podium" iconPlacement="top" label="Començar final" ring="gold" ribbon="Recomanat" />{/snippet}
      {@render cell('recommended: gold ring + ribbon', r2)}
      {#snippet r3()}<Button {...ACTIONS.checkFail} />{/snippet}
      {@render cell('the fail cue: red at 45 %', r3)}
      {#snippet r4()}<Button color="grey" variant="dashed" label="Ràpid" note="14 s" />{/snippet}
      {@render cell('suggested: dashed, its edge dashed too', r4)}
      {#snippet r5()}<Button {...asDefault(ACTIONS.checkCelebrate, true)} />{/snippet}
      {@render cell('a cue that is also the default: its own ring + A', r5)}
    </div>

    <h3>R2 · The 3D edge in the fill’s own shade</h3>
    <div class="ds-gallery__grid">
      {#each ['orange', 'cyan', 'purple', 'navy'] as const as color (color)}
        {#snippet e()}<Button {color} label={COLOR_WORDS[color]} />{/snippet}
        {@render cell(`${color}: --palette-edge`, e)}
      {/each}
    </div>

    <h3>R4 · Press, R5 · focus</h3>
    <div class="ds-gallery__grid">
      {#snippet p1()}<Button color="orange" icon={ICON} label="Prem-me" />{/snippet}
      {@render cell('press: the piece sinks onto its shadow and springs back', p1)}
      {#snippet p2()}<span {@attach focusRing}><Button color="green" label="Focus" /></span>{/snippet}
      {@render cell(':focus-visible only (a keyboard’s focus), the same gap; on a ringed control it goes outside the ring', p2)}
    </div>
    <p class="ds-gallery__note">Haptics: on the phone a ~10 ms vibration with each press, where the browser can (Android); never on the console.</p>

    <h3>R6 · text-wrap</h3>
    <div class="ds-gallery__grid ds-gallery__grid--wide">
      {#snippet w1()}<h4 class="ds-gallery__narrow">Les cançons que queden no es destapen mai</h4>{/snippet}
      {@render cell('a heading: balance', w1)}
      {#snippet w2()}<p class="ds-gallery__narrow">Pregunteu-ho mentre aneu cap al cartró. Cada número és un xip; es comproven seguits, en aquest ordre.</p>{/snippet}
      {@render cell('body text: pretty', w2)}
    </div>

    <h3>R7 · Corners: the Wii keys</h3>
    {#if phone}
      <p class="ds-gallery__note">The phone shows no Wii keys; the sheets’ ✕ and ‹ use the same corner resource (P helper).</p>
    {:else}
      <div class="ds-gallery__grid">
        {#snippet k1()}<Button color="red" icon="undo" label="Enrere" note="treu una marca" wii={WII.checkBack} />{/snippet}
        {@render cell('1 / 2: the same inset from the top and the side', k1)}
        {#snippet k2()}<Button color="grey" label="Revisió manual" wii={WII.review} />{/snippet}
        {@render cell('− + held: the hold ring', k2)}
        {#snippet k3()}<Button color="orange" size="xs" label="Editar" wii={WII.a} />{/snippet}
        {@render cell('a short button: the key centres', k3)}
        {#snippet k4()} <Button color="purple" icon="hand" label="Aguanta" wii={{ keys: ['b'], hold: true, withA: true }} />{/snippet}
        {@render cell('B + A held (shake ×3 / B+A: D-j)', k4)}
      </div>
    {/if}

    <h3>R9 · Long text</h3>
    <div class="ds-gallery__grid">
      {#each LONG_TITLES as title (title)}
        {#snippet l()}<p class="ds-gallery__title ds-clamp-2">{title}</p>{/snippet}
        {@render cell('.ds-clamp-2 in a narrow box', l)}
      {/each}
      {#snippet l2()}<Button color="orange" label="SUPERESTRELLA" />{/snippet}
      {@render cell('a Button label wraps by words', l2)}
    </div>

    <h3>R10 · The white and black card themes</h3>
    <div class="ds-gallery__grid">
      {#each ['snow', 'ink'] as const as card (card)}
        {#snippet c()}<div class="ds-gallery__card" data-color={card} data-ground={card === 'ink' ? 'night' : 'paper'}><Button color="orange" size="s" label="Veure'l" /></div>{/snippet}
        {@render cell(card === 'snow' ? 'on the white card' : 'on the black card', c)}
      {/each}
    </div>
    <p class="ds-gallery__note">Every family that takes a card colour shows both here (the K helper’s cards first).</p>
  </section>

  {#if !projector}<CardsSongs {phone} {cell} />{/if}
  <StatusSections {density} />
  {#if !projector}<ControlsGallery {phone} />{/if}
  {#if !phone && !projector}<ConsoleMenu {cell} />{/if}
</div>
