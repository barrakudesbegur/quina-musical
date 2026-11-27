<!--
  Work stream S's gallery sections (status, the finale, the stickers): E1 Ring, E3 Toast, F1 Nino, F2's compact
  «Editar», G1 StickerTitle, G2 Plate, G4 LogoTile + SponsorList / SponsorStrip, G5 QrBlock. Each in its variants and
  states at the page's density; the projector's pieces show on /ds/?density=projector. Captions in English
  (GLOSSARY.md); the words inside the components are UI content, so Catalan.
-->
<script lang="ts">
  import { untrack, type Snippet } from 'svelte';
  import Button from '../../packages/ui/components/Button.svelte';
  import LogoTile from '../../packages/ui/components/LogoTile.svelte';
  import Nino from '../../packages/ui/components/Nino.svelte';
  import Plate from '../../packages/ui/components/Plate.svelte';
  import Ring from '../../packages/ui/components/Ring.svelte';
  import SponsorList from '../../packages/ui/components/SponsorList.svelte';
  import StickerTitle from '../../packages/ui/components/StickerTitle.svelte';
  import Toast from '../../packages/ui/components/Toast.svelte';
  import type { PlateColor, StickerTitleSize } from '../../packages/ui/components/types.ts';
  import type { SponsorLogo } from '../../packages/ui/components/sponsor-types.ts';
  import { NINO_FOR, type NinoMoment } from '../../packages/ui/concepts.ts';
  import { NINO_POSES } from '../../packages/ui/ninos.ts';
  import { FINALE_POSES } from '../../packages/rules/finale.ts';
  import { ACTIONS, TOASTS } from '../console/actions.ts';
  import { RING_BADGES, RING_LOOKS } from '../console/ring-looks.ts';
  import { RING_STATES } from '../console/logic/now-ring.ts';
  import { PLAYER_TOASTS } from '../player/actions.ts';
  import CardMark from '../player/components/CardMark.svelte';
  import { SponsorStrip } from '../stage/render/parts.ts';
  import { QrBlock } from '../stage/render/qr.ts';

  let { density }: { density: 'console' | 'phone' | 'projector' } = $props();
  const mode = untrack(() => density);
  const projector = mode === 'projector';
  const phone = mode === 'phone';

  /** Sample logos of different shapes (a wide wordmark, a square badge, a tall crest), drawn here as SVG. */
  const logo = (w: number, h: number, fill: string, text: string): string =>
    `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}"><rect width="${w}" height="${h}" rx="${h / 6}" fill="${fill}"/><text x="50%" y="58%" text-anchor="middle" font-family="Arial Black,sans-serif" font-size="${h / 3}" fill="#fff">${text}</text></svg>`)}`;
  const SPONSORS: SponsorLogo[] = [
    { name: 'Forn del poble', logo: logo(300, 100, '#C45A00', 'FORN') },
    { name: 'Botiga d’esports', logo: logo(120, 120, '#2D8FC4', 'BE') },
    { name: 'Restaurant del port', logo: logo(100, 140, '#157140', 'RP') },
    { name: 'Barrakudes', logo: null },
    { name: 'Ferreteria i Subministraments Industrials de Begur', logo: null },
    { name: 'Gelats', logo: logo(260, 120, '#C42F7A', 'GELATS') },
    { name: 'Cava', logo: logo(140, 140, '#7D4BC4', 'CAVA') },
    { name: 'Llibreria', logo: logo(320, 90, '#17132B', 'LLIBRES') },
  ];

  const MOMENTS = Object.keys(NINO_FOR) as NinoMoment[];
  const PLATES: PlateColor[] = ['gold', 'orange', 'slate', 'periwinkle', 'live', 'snow', 'red'];
  const PLATE_WORDS: Record<PlateColor, string> = {
    gold: 'Quina 3',
    orange: 'Cartró #57',
    slate: 'Cartró #57',
    periwinkle: 'Revisió manual',
    live: 'Salvats!',
    snow: '#57',
    red: '#34',
  };
  const PLATE_USE: Record<PlateColor, string> = {
    gold: 'the round’s name, always (U175 item 7)',
    orange: 'only the Check’s «CARTRÓ #57»',
    slate: 'a failed Check',
    periwinkle: 'a Review',
    live: '«Salvats!»',
    snow: 'a standing finalist',
    red: 'a fallen finalist',
  };
  const SIZES: StickerTitleSize[] = ['hero', 'hero-2', 'xl', 'l', 'm', 's', 'xs'];

  /** The projector's strip and QR are the stage's own DOM classes, on the shared CSS. */
  function strip(node: HTMLElement) {
    const s = new SponsorStrip();
    s.set(SPONSORS.map((x) => ({ label: x.name, logo: x.logo })));
    node.append(s.root);
    let raf = requestAnimationFrame(function loop(t) {
      s.tick(t);
      raf = requestAnimationFrame(loop);
    });
    return () => cancelAnimationFrame(raf);
  }
  function qr(node: HTMLElement) {
    const q = new QrBlock();
    q.set({ href: 'https://quina.barrakudesbegur.org/c/57', label: 'quina.barrakudesbegur.org' });
    node.append(q.root);
  }
</script>

{#snippet cell(caption: string, body: Snippet)}
  <figure class="ds-gallery__cell">
    <div class="ds-gallery__stage" lang="ca">{@render body()}</div>
    <figcaption>{caption}</figcaption>
  </figure>
{/snippet}

<!-- ---- E1 · Ring ---------------------------------------------------------------------------------------------- -->
<section class="ds-gallery__section" aria-labelledby="s-e1">
  <h2 id="s-e1">E1 · Ring</h2>
  <p class="ds-prose">
    Props say what it draws: <code>arc</code> (progress, full, segments, none) in a <code>color</code>, <code>progress</code> (the share left: it
    empties as time passes), <code>pattern="hazard"</code>, <code>halo</code>, the <code>face</code> (number, icon, disc, record, bars),
    <code>pulse</code>, <code>tick</code> and a corner <code>badge</code>. The console’s show states are its looks table (ring-looks.ts), shown here
    one per state.
  </p>
  <div class="ds-gallery__grid ds-s__rings">
    {#each RING_STATES as state, i (state)}
      {#snippet r()}
        <span class="ds-s__ring">
          <Ring
            {...RING_LOOKS[state]}
            progress={0.62 - i * 0.02}
            value={state === 'waiting' ? null : state === 'autoLast' ? '2' : state === 'suspense' ? '12' : '7'}
            unit=" s"
            badge={state === 'auto' ? RING_BADGES.auto : state === 'manual' ? RING_BADGES.autoOff : state === 'manualFinal' ? RING_BADGES.final : state === 'talk' ? RING_BADGES.talk : state === 'stay' ? RING_BADGES.stay : null}
            label={state}
            faceKey={state}
          />
        </span>
      {/snippet}
      {@render cell(state, r)}
    {/each}
    {#snippet big()}<Ring arc="progress" color="cyan" face="number" framed progress={0.7} value="2" unit="min" label="Tornem d’aquí a uns 2 minuts" size={projector ? 390 : 170} />{/snippet}
    {@render cell(`framed: the Break’s countdown, cyan, ${projector ? '390' : '170'} px (the projector’s CountdownRing is this, ring-dom.ts)`, big)}
  </div>
</section>

<!-- ---- E3 · Toast --------------------------------------------------------------------------------------------- -->
{#if !projector}
  <section class="ds-gallery__section" aria-labelledby="s-e3">
    <h2 id="s-e3">E3 · Toast</h2>
    <p class="ds-prose">
      One radius, no pill. <code>solid</code>: the fill, white words, the ink outline and the fill’s own dark 3D edge (R2). <code>paper</code>: the
      colour’s outline and its bottom edge in the colour’s dark shade, never ink (#85). Presets: the console’s TOASTS, the phone’s PLAYER_TOASTS.
    </p>
    <div class="ds-gallery__grid ds-gallery__grid--wide">
      {#snippet t1()}
        {#snippet mark()}<CardMark identity={3} decorative />{/snippet}
        <Toast {...PLAYER_TOASTS.card} text="Cartró #88 afegit" {mark} />
      {/snippet}
      {@render cell('solid · green + a card’s mark: a card added (phone)', t1)}
      {#snippet t2()}<Toast {...TOASTS.error} text="Següent: deixeu anar Aguanta o el Suspens primer" detail="Ho ha rebutjat el portàtil." onclose={() => {}} />{/snippet}
      {@render cell('paper · red, urgent (role alert), closable: a rejected command (#85: the bottom edge red)', t2)}
      {#snippet t3()}<Toast {...TOASTS.info} text="Desat" onclose={() => {}} />{/snippet}
      {@render cell('paper · navy: a notice', t3)}
      {#snippet t4()}<Toast {...PLAYER_TOASTS.info} text="Aquest cartró ja el segueixes" />{/snippet}
      {@render cell('paper · navy, no icon (phone)', t4)}
      {#snippet t5()}<Toast color="orange" variant="solid" icon="warning" text="All I Want for Christmas Is You: SUPERESTRELLA no ha sonat encara" />{/snippet}
      {@render cell('solid · orange, long words wrap (R9)', t5)}
    </div>
  </section>
{/if}

<!-- ---- F1 · Nino ---------------------------------------------------------------------------------------------- -->
<section class="ds-gallery__section" aria-labelledby="s-f1">
  <h2 id="s-f1">F1 · Nino</h2>
  <p class="ds-prose">
    Every pose that ships ({NINO_POSES.length}; tools/ninos/stickers.ts makes them from brand/ninos, the newest set preferred, #86). Props:
    <code>pose</code>, <code>size</code>, <code>tilt</code>, <code>hue</code>, <code>motion</code> (sway, breathe, none), <code>faded</code>,
    <code>flip</code>. Decorative (<code>alt=""</code>).
  </p>
  <div class="ds-s__ninos">
    {#each NINO_POSES as pose (pose)}
      <figure class="ds-s__nino">
        <Nino {pose} size={projector ? 150 : 96} motion="none" />
        <figcaption>{pose}{(FINALE_POSES as readonly string[]).includes(pose) ? ' · finalist' : ''}</figcaption>
      </figure>
    {/each}
  </div>

  <h3>Looks</h3>
  <div class="ds-gallery__grid">
    {#snippet n1()}<Nino pose="afro" size={110} motion="sway" />{/snippet}
    {@render cell('motion sway: ±3° (with motion allowed)', n1)}
    {#snippet n2()}<Nino pose="meditant" size={110} motion="breathe" />{/snippet}
    {@render cell('motion breathe: 1 → 1.04 over 4 s (the Pause)', n2)}
    {#snippet n3()}<Nino pose="ballet" size={110} motion="none" faded />{/snippet}
    {@render cell('faded: a Fallen finalist (D182)', n3)}
    {#snippet n4()}<Nino pose="sardana" size={110} motion="none" hue={150} />{/snippet}
    {@render cell('hue 150°: a ninth finalist’s tint', n4)}
    {#snippet n5()}<Nino pose="cuiner" size={110} motion="none" flip tilt={-8} />{/snippet}
    {@render cell('flip + tilt −8°', n5)}
  </div>

  <h3>NINO_FOR: a pool per moment (concepts.ts)</h3>
  <p class="ds-gallery__note">ninoFor(moment, seed) picks by a seed that changes each time (a round, a card number), so the same nino doesn’t always come back.</p>
  <div class="ds-s__moments">
    {#each MOMENTS as moment (moment)}
      <div class="ds-s__moment">
        <p>{moment}</p>
        <div>{#each NINO_FOR[moment] as pose (pose)}<Nino {pose} size={56} motion="none" />{/each}</div>
      </div>
    {/each}
  </div>
</section>

<!-- ---- F2 · FinalistSlot + FinaleRow: the compact «Editar» ------------------------------------------------------ -->
{#if !phone && !projector}
  <section class="ds-gallery__section" aria-labelledby="s-f2">
    <h2 id="s-f2">F2 · FinaleRow’s head</h2>
    <p class="ds-prose">«Editar» and «+ Afegir» are the compact <code>Button size="xs"</code> (D-h, #87): 44 px, the console’s floor.</p>
    <div class="ds-gallery__grid">
      {#snippet e1()}<Button {...ACTIONS.finaleEdit} pressed={false} />{/snippet}
      {@render cell('«Editar» off', e1)}
      {#snippet e2()}<Button {...ACTIONS.finaleEditOn} pressed />{/snippet}
      {@render cell('«Editar» on: gold, pressed', e2)}
      {#snippet e3()}<Button {...ACTIONS.finaleAddOne} />{/snippet}
      {@render cell('«+ Afegir» while editing', e3)}
    </div>
  </section>
{/if}

<!-- ---- G1 · StickerTitle, G2 · Plate ---------------------------------------------------------------------------- -->
<section class="ds-gallery__section" aria-labelledby="s-g1">
  <h2 id="s-g1">G1 · StickerTitle, G2 · Plate</h2>
  <p class="ds-prose">Londrina in capitals with the ink stroke under the fill and a hard drop; a <code>.unit</code> keeps its case (D114).</p>
  <div class="ds-s__titles">
    {#each SIZES as size (size)}
      <div class="ds-s__title">
        <StickerTitle as="p" {size} color={size === 'hero' ? 'gold' : size === 'hero-2' ? 'live' : size === 'xl' ? 'mist' : 'white'} text={size === 'hero' ? 'Línia!' : size === 'hero-2' ? 'Quina potra!' : size === 'xl' ? 'Descans' : 'Superestrella'} />
        <code>{size}</code>
      </div>
    {/each}
    <div class="ds-s__title">
      <StickerTitle as="p" size="l" color="gold" tilt={-5}>2 <span class="unit">min</span></StickerTitle>
    </div>
    <code class="ds-s__code">l · gold · tilt −5° · a .unit</code>
  </div>
  <h3>Plate: which plate is which colour (§ 11)</h3>
  <div class="ds-s__plates">
    {#each PLATES as color (color)}
      {#snippet p()}<Plate {color} size={projector ? 'm' : 'xs'} label={PLATE_WORDS[color]} icon={color === 'periwinkle' ? 'magnifier' : null} tilt={color === 'live' ? -3 : 0} />{/snippet}
      {@render cell(`${color}: ${PLATE_USE[color]}`, p)}
    {/each}
  </div>
</section>

<!-- ---- G4 · LogoTile, SponsorList / SponsorStrip ------------------------------------------------------------------ -->
<section class="ds-gallery__section" aria-labelledby="s-g4">
  <h2 id="s-g4">G4 · LogoTile, {projector ? 'SponsorStrip' : 'SponsorList'}</h2>
  {#if projector}
    <p class="ds-prose">
      The strip before the Game and in the Break (#88, D-v): 150 px tiles in one row that pans slowly without end (60 px/s), from a random point of
      its loop each time it shows; its ends fade. Reduced motion: it stands still and turns its page every 8 s, from a random page.
    </p>
    <div class="ds-s__strip" {@attach strip}></div>
  {:else}
    <p class="ds-prose">
      The phone’s list (#90, D-v): big tiles, two a row, in a list that scrolls. A tap opens the logo larger in a dialog that grows out of its tile
      (a view transition; reduced motion fades). Logos are contained, never cropped; a sponsor without a logo shows its name.
    </p>
    <div class="ds-s__phone">
      <SponsorList sponsors={SPONSORS} />
    </div>
  {/if}
  <h3>LogoTile</h3>
  <div class="ds-gallery__grid">
    {#each [SPONSORS[0], SPONSORS[2], SPONSORS[3], SPONSORS[4]] as sponsor (sponsor.name)}
      {#snippet l()}<LogoTile {sponsor} />{/snippet}
      {@render cell(sponsor.logo ? 'a logo, contained' : 'no logo yet: the name', l)}
    {/each}
  </div>
</section>

<!-- ---- G5 · QrBlock --------------------------------------------------------------------------------------------- -->
{#if projector}
  <section class="ds-gallery__section" aria-labelledby="s-g5">
    <h2 id="s-g5">G5 · QrBlock</h2>
    <p class="ds-prose">Before the Game only (D32). The panel is pure white, the QR’s own paper, with one more step of padding (#89).</p>
    <div class="ds-s__qr" {@attach qr}></div>
  </section>
{/if}

<style>
  .ds-s__ring {
    display: block;
    width: 112px;
    height: 112px;
    margin: 6px;
  }

  .ds-s__rings {
    grid-template-columns: repeat(auto-fill, minmax(10rem, 1fr));
  }

  .ds-s__ninos {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(8rem, 1fr));
    gap: var(--space-4);
  }

  .ds-s__nino {
    display: grid;
    justify-items: center;
    align-content: end;
    gap: var(--space-2);
    margin: 0;
    font-size: var(--text-sm);
    font-weight: 800;
  }

  .ds-s__moments {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(16rem, 1fr));
    gap: var(--space-3);
  }

  .ds-s__moment p {
    margin: 0 0 var(--space-1);
    font-weight: 900;
  }

  .ds-s__moment div {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-2);
    align-items: end;
  }

  .ds-s__titles {
    display: grid;
    gap: var(--space-4);
    padding: var(--space-4);
    border-radius: var(--radius-lg);
    background: var(--color-night);
    overflow-x: auto;
  }

  .ds-s__title {
    display: grid;
    gap: var(--space-1);
    color: var(--color-snow);
  }

  .ds-s__plates {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-5);
    align-items: start;
  }

  .ds-s__code {
    color: var(--color-snow);
  }

  .ds-s__phone {
    max-width: 24rem;
    padding: var(--space-4);
    border-radius: var(--radius-lg);
    background: var(--color-night);
  }

  .ds-s__strip {
    margin-inline: calc(-1 * clamp(var(--space-4), 4vw, var(--space-7)));
  }

  .ds-s__qr {
    width: 34.25rem;
    max-width: 100%;
  }
</style>
