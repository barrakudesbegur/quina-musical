<!--
  Work stream S's gallery sections (status, the finale, the stickers): E1 Ring, E2 Garland + HeatMeter (its own file,
  sections/HeatGarland.svelte), E3 Toast, F1 Nino, F2's compact «Editar», G1 StickerTitle, G2 Plate, G4 LogoTile +
  SponsorList / SponsorStrip, G5 QrBlock. Each in its variants and states at the page's density; the projector's pieces
  show on /ds/?density=projector. Captions in English (GLOSSARY.md); the words inside the components are UI content, so
  Catalan.
-->
<script lang="ts">
  import { untrack, type Snippet } from 'svelte';
  import Button from '../../packages/ui/components/Button.svelte';
  import Icon from '../../packages/ui/icons/Icon.svelte';
  import LogoTile from '../../packages/ui/components/LogoTile.svelte';
  import Nino from '../../packages/ui/components/Nino.svelte';
  import Plate from '../../packages/ui/components/Plate.svelte';
  import Ring from '../../packages/ui/components/Ring.svelte';
  import SponsorList from '../../packages/ui/components/SponsorList.svelte';
  import StickerCollage from '../../packages/ui/components/StickerCollage.svelte';
  import { boxObstacle } from '../../packages/ui/components/sticker-collage.ts';
  import StickerTitle from '../../packages/ui/components/StickerTitle.svelte';
  import Toast from '../../packages/ui/components/Toast.svelte';
  import Notice from '../../packages/ui/components/Notice.svelte';
  import PriceTag from '../../packages/ui/components/PriceTag.svelte';
  import Confetti from '../../packages/ui/components/Confetti.svelte';
  import '../../packages/ui/components/particles.css';
  import type { PlateColor, StickerTitleSize } from '../../packages/ui/components/types.ts';
  import type { SponsorLogo } from '../../packages/ui/components/sponsor-types.ts';
  import { NINO_FOR, type NinoMoment } from '../../packages/ui/concepts.ts';
  import { NINO_POSES } from '../../packages/ui/ninos.ts';
  import { FINALE_POSES } from '../../packages/rules/finale.ts';
  import { ACTIONS, NOTICES, TOASTS, VERDICT_LOOKS } from '../console/actions.ts';
  import { RING_BADGES, RING_LOOKS } from '../console/ring-looks.ts';
  import { RING_STATES } from '../console/logic/now-ring.ts';
  import { PLAYER_TOASTS } from '../player/actions.ts';
  import CardMark from '../player/components/CardMark.svelte';
  import { SponsorStrip } from '../stage/render/parts.ts';
  import { QrBlock } from '../stage/render/qr.ts';
  import HeatGarland from './sections/HeatGarland.svelte';
  import ConsoleFinale from './sections/ConsoleFinale.svelte';

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

  /** The collage's stand-ins: logos of every shape on transparency, as sponsors send them (a wordmark, a ring badge with
   * its hole, a crest, a boxed logo, a thin wide one), and two with no logo yet. Real logos never go in the repo. */
  const shape = (w: number, h: number, body: string): string =>
    `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">${body}</svg>`)}`;
  const word = (x: number, y: number, size: number, fill: string, text: string) =>
    `<text x="${x}" y="${y}" text-anchor="middle" font-family="Arial Black,sans-serif" font-size="${size}" fill="${fill}">${text}</text>`;
  const COLLAGE: SponsorLogo[] = [
    { name: 'Forn del poble', logo: shape(320, 150, word(160, 70, 64, '#C45A00', 'FORN') + word(160, 132, 46, '#C45A00', 'DEL POBLE')) },
    { name: 'Botiga d’esports', logo: shape(200, 200, `<circle cx="100" cy="100" r="88" fill="none" stroke="#2D8FC4" stroke-width="26"/>${word(100, 118, 52, '#17132B', 'BE')}`) },
    { name: 'Gelats', logo: shape(380, 120, word(190, 92, 96, '#C42F7A', 'GELATS')) },
    { name: 'Restaurant del port', logo: shape(150, 210, `<path d="M10 10h130v110c0 50-40 76-65 86C50 196 10 170 10 120Z" fill="#157140"/>${word(75, 120, 54, '#fff', 'RP')}`) },
    { name: 'Cava', logo: shape(170, 150, `<rect width="170" height="150" rx="10" fill="#7D4BC4"/>${word(85, 92, 48, '#fff', 'CAVA')}`) },
    { name: 'Barrakudes', logo: null },
    { name: 'Llibreria', logo: shape(520, 90, word(260, 70, 72, '#17132B', 'LLIBRERIA')) },
    { name: 'Fleca', logo: shape(170, 170, `<circle cx="85" cy="85" r="80" fill="#FFC531"/>${word(85, 100, 40, '#17132B', 'FLECA')}`) },
    { name: 'Ferreteria i Subministraments Industrials de Begur', logo: null },
    { name: 'Pàdel', logo: shape(260, 160, `<rect x="4" y="4" width="252" height="152" rx="30" fill="#17132B"/>${word(130, 100, 56, '#3EE07F', 'PÀDEL')}`) },
  ];
  /** The demo Celebration on the projector (the 1440 × 1080 box, drawn at 60 %): the title tilted −5°, the round's plate,
   * two ninos at the bottom corners; the module keeps off their boxes, and grows the collage from under the plate. */
  const SCENE = { title: { x: 330, y: 168, width: 780, height: 262 }, plate: { x: 555, y: 486, width: 330, height: 132 }, left: { x: 48, y: 760, width: 230, height: 270 }, right: { x: 1162, y: 760, width: 230, height: 270 } };
  const SCENE_OBSTACLES = [boxObstacle(SCENE.title, -5), boxObstacle(SCENE.plate, 2), boxObstacle(SCENE.left, -4), boxObstacle(SCENE.right, 5)].map((o) => ({ points: o.points.map((q) => ({ x: q.x - 32, y: q.y - 32 })) }));
  let collageCount = $state(5);
  let collageSeed = $state(1);
  let collageRun = $state(0);

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
  /** The countdown before the start (not built yet): the share left of the last 3 hours, full while more is left. */
  const BEFORE_WINDOW_MIN = 180;
  const before = (minutes: number, value: string, unit: string, label: string) => {
    const progress = Math.min(1, minutes / BEFORE_WINDOW_MIN);
    return { value, unit, label, progress, caption: `«${value} ${unit}»: ${progress === 1 ? 'full (more than 3 h left)' : `${Math.round(progress * 100)} % of the last 3 h left`}` };
  };
  const BEFORE = [
    before(24 * 60, '1', 'd', 'Comencem d’aquí a 1 dia'),
    before(120, '2', 'h', 'Comencem d’aquí a 2 hores'),
    before(60, '1', 'h', 'Comencem d’aquí a 1 hora'),
    before(25, '25', 'min', 'Comencem d’aquí a 25 minuts'),
  ];

  /** The projector's strip and QR are the stage's own DOM classes, on the shared CSS. `rows`: the strip's rows (S4's
   * knob); `count`: how many of the sample sponsors (a short list repeats, never a gap). */
  function strip(rows: number, count: number) {
    return (node: HTMLElement) => {
      const s = new SponsorStrip('', { rows });
      s.set(SPONSORS.slice(0, count).map((x) => ({ label: x.name, logo: x.logo })));
      node.append(s.root);
      let raf = requestAnimationFrame(function loop(t) {
        s.tick(t);
        raf = requestAnimationFrame(loop);
      });
      return () => cancelAnimationFrame(raf);
    };
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

  <h3>Before the start (not built yet)</h3>
  <p class="ds-gallery__note">
    A countdown to the Game’s start: the framed Ring in gold, the value with its unit (D114). How full: the share left of the last
    3 hours (full while more is left). Ring draws no words, so the start shows its closest face.
  </p>
  <div class="ds-gallery__grid ds-s__rings ds-s__before">
    {#each BEFORE as b (b.caption)}
      {#snippet r()}<Ring arc="progress" color="gold" face="number" framed progress={b.progress} value={b.value} unit={b.unit} label={b.label} size={projector ? 390 : 170} />{/snippet}
      {@render cell(`${b.caption} (not built yet: the projector’s Before shows no countdown)`, r)}
    {/each}
    {#snippet start()}<Ring arc="full" color="gold" face="disc" icon="play" pulse framed label="Ja comencem!" size={projector ? 390 : 170} />{/snippet}
    {@render cell('the start («JA COMENCEM!»): Ring shows no words, so its closest face, the full gold ring and a play disc breathing, the words only its spoken label (not built yet: the projector’s Before shows no countdown)', start)}
  </div>
</section>

<!-- ---- E2 · Garland, HeatMeter (sections/HeatGarland.svelte) ------------------------------------------------- -->
<HeatGarland {density} />

<!-- ---- E3 · Toast --------------------------------------------------------------------------------------------- -->
{#if !projector}
  <section class="ds-gallery__section" aria-labelledby="s-e3">
    <h2 id="s-e3">E3 · Toast</h2>
    <p class="ds-prose">
      A passing notice, never a control (27 Nov, §8 Y3): no ink outline, no 3D edge and no hard drop, only a soft shadow; one radius, no pill; it
      hugs its words. <code>solid</code>: the fill, white words. <code>paper</code>: paper, the icon in the colour’s text shade, a hairline in its pale
      shade. The phone places it just under the garland (<code>toast-drop</code>); the console stacks them above the cluster. Presets: the console’s
      TOASTS, the phone’s PLAYER_TOASTS.
    </p>
    <div class="ds-gallery__grid ds-gallery__grid--wide">
      {#snippet t1()}
        {#snippet mark()}<CardMark identity={3} decorative />{/snippet}
        <Toast {...PLAYER_TOASTS.card} text="Cartró #88 afegit" {mark} />
      {/snippet}
      {@render cell('solid · green + a card’s mark: a card added (phone)', t1)}
      {#snippet t2()}<Toast {...TOASTS.error} text="Següent: deixeu anar Aguanta o el Suspens primer" detail="Ho ha rebutjat el portàtil." onclose={() => {}} />{/snippet}
      {@render cell('paper · red, urgent (role alert), closable: a rejected command', t2)}
      {#snippet t3()}<Toast {...TOASTS.info} text="Desat" onclose={() => {}} />{/snippet}
      {@render cell('paper · navy: a notice', t3)}
      {#snippet t4()}<Toast {...PLAYER_TOASTS.info} text="Aquest cartró ja el segueixes" />{/snippet}
      {@render cell('paper · navy, no icon (phone)', t4)}
      {#snippet t5()}<Toast color="orange" variant="solid" icon="warning" text="All I Want for Christmas Is You: SUPERESTRELLA no ha sonat encara" />{/snippet}
      {@render cell('solid · orange, long words wrap (R9)', t5)}
      {#snippet t6()}
        <div class="ds-gallery__toast-phone">
          <span class="ds-gallery__toast-garland" aria-hidden="true"></span>
          <Toast {...PLAYER_TOASTS.info} text="Dades esborrades" />
        </div>
      {/snippet}
      {@render cell('the phone’s place: centred just under the garland and the safe area, over the header (toast-drop)', t6)}
    </div>
  </section>
{/if}

<!-- ---- E4 · Notice -------------------------------------------------------------------------------------------- -->
{#if !projector}
  <section class="ds-gallery__section" aria-labelledby="s-e4">
    <h2 id="s-e4">E4 · Notice</h2>
    <p class="ds-prose">
      One component, <code>layout</code> × <code>color</code> × <code>fill</code>: strip, note, box, scene; <code>solid</code> (the fill, its contrast
      words) or <code>subtle</code> (the tint, outlined in the colour’s dark edge). Presets: the console’s NOTICES; the phone’s Pause.
    </p>
    <div class="ds-gallery__grid ds-gallery__grid--wide">
      {#snippet n1()}<Notice {...NOTICES.recovery} text="Anem avançats: cada cançó dura 1 s més." />{/snippet}
      {@render cell('note · orange · subtle: the pace’s recovery', n1)}
      {#snippet n2()}<Notice {...NOTICES.warning} text="El cartró no passa: Falta «All I Want for Christmas Is You»." />{/snippet}
      {@render cell('box · orange · subtle: the review’s warning (words in the colour’s text shade)', n2)}
      {#snippet n3()}<Notice {...NOTICES.refused} live="off" text="Aquest cartró no existeix" />{/snippet}
      {@render cell('note · red · solid: a pad’s refusal (ink on #FF5A60)', n3)}
      {#snippet n4()}<Notice {...NOTICES.accepted} text="#57 és a la final" />{/snippet}
      {@render cell('note · green · solid', n4)}
      {#snippet n5()}<Notice layout="strip" color="periwinkle" icon="eye-off" live="off" text="Sense connexió · reconnectant…" />{/snippet}
      {@render cell('strip · periwinkle: offline (M34)', n5)}
      {#snippet n6()}<Notice layout="strip" color="navy" live="off" progress="dots" text="Comprovant el cartró #123" />{/snippet}
      {@render cell('strip · navy · dots: the check line', n6)}
      {#snippet n7()}<Notice layout="scene" color="navy" live="off" text="Tornem de seguida"><Nino pose="meditant" size={110} motion="breathe" /></Notice>{/snippet}
      {@render cell('scene: the Pause (the breathing nino)', n7)}
    </div>
  </section>

  <!-- ---- E5 · Verdict (the console's) --------------------------------------------------------------------------- -->
  {#if !phone}
    <section class="ds-gallery__section" aria-labelledby="s-e5">
      <h2 id="s-e5">E5 · Verdict (console)</h2>
      <p class="ds-prose">A recipe: VERDICT_LOOKS gives the outcome its palette; the words take its text shade, the ✗ disc its fill; the ✗ is the outline look, its line the word’s stem (S1). The projector’s verdict draws through Plate, the rays and Nino.</p>
      <div class="ds-gallery__grid ds-gallery__grid--wide">
        {#snippet v1()}<div class="check-verdict" data-pass="true" data-color={VERDICT_LOOKS.pass.color}><p class="check-verdict__line"><Icon name="check" /><span>Té línia: la fila 2 és completa</span></p></div>{/snippet}
        {@render cell('pass · green', v1)}
        {#snippet v2()}<div class="check-verdict" data-pass="false" data-color={VERDICT_LOOKS.fail.color}><p class="check-verdict__fail"><span class="check-verdict__cross"><Icon name="close" outline /></span><span class="check-verdict__word">Fallada</span></p></div>{/snippet}
        {@render cell('fail · red', v2)}
      </div>
    </section>
  {/if}
{/if}

<!-- ---- E6 · PriceTag, G3 · Rays + Confetti ---------------------------------------------------------------------- -->
<section class="ds-gallery__section" aria-labelledby="s-e6">
  <h2 id="s-e6">E6 · PriceTag, G3 · Rays + Confetti</h2>
  <p class="ds-prose">The price for the coming round only (D61): a gold tag, or a line. The rays: one resource in a palette colour; the confetti: one canvas, the palette’s colours.</p>
  <div class="ds-s__night">
    <PriceTag amount="10,50 €" />
    <PriceTag amount="Cartró: 4,50 €" variant="line" />
    <PriceTag amount="— €" />
  </div>
  <div class="ds-s__rays">
    {#each ['gold', 'red', 'live'] as const as color (color)}
      <figure class="ds-s__ray-cell"><div class="ds-rays ds-s__ray" data-color={color}></div><figcaption>rays · {color}</figcaption></figure>
    {/each}
    <figure class="ds-s__ray-cell ds-s__confetti"><Confetti count={projector ? 80 : 40} duration={60000} /><figcaption>confetti (reduced motion: none)</figcaption></figure>
  </div>
</section>

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

  <!-- ---- F2 · the finale's Dempeus row (sections/ConsoleFinale.svelte) ------------------------------------------ -->
  <ConsoleFinale />
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
      The strip before the Game and in the Break (#88, D-v, S4): 240 × 150 px tiles in one row that pans slowly without end (60 px/s), from a random
      point of its loop each time it shows; its ends fade. Reduced motion: it stands still and turns its page every 8 s, from a random page. Its
      three knobs: the speed and the rows in the stage's <code>STAGE.sponsorStrip</code>, the tile size in <code>--stage-sponsor-w</code> /
      <code>-h</code>.
    </p>
    <div class="ds-s__strip" {@attach strip(1, SPONSORS.length)}></div>
    <h3>rows: 2</h3>
    <p class="ds-prose">The list split in order into two rows, each panning on its own from its own random point.</p>
    <div class="ds-s__strip" {@attach strip(2, SPONSORS.length)}></div>
    <h3>A short list</h3>
    <p class="ds-prose">Three sponsors: narrower than the strip, so the list repeats until one loop fills it, and no gap ever shows.</p>
    <div class="ds-s__strip" {@attach strip(1, 3)}></div>
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
  <h3>Sticker collage</h3>
  <p class="ds-prose">
    A Celebration’s sponsors (D285, D287), as die-cut stickers made in the browser from each logo (<code>logo-sticker.ts</code>, <code>die-cut.ts</code>:
    the logo untouched, a white rim of 5 % with its holes filled, no keyline) and packed together by <code>sticker-collage.ts</code> round what the box
    holds, by their real shapes: every sticker the same area, the headline’s sponsor 30 % more; never under the floor
    ({projector ? 'the SponsorStrip’s 240 × 150 tile' : '112 × 70, the phone’s logo tile'}), bigger for fewer; tilted 3–9°, a wordmark less; the white rims may
    overlap, never a logo. The same seed (the Celebration’s key) draws the same collage. They slap on one at a time from the headline outward
    ({projector ? 'from 900 ms, 110 ms apart' : 'from 200 ms, 80 ms apart'}); reduced motion: they fade in together. A sponsor with no logo gets its name.
  </p>
  <div class="ds-s__collage-bar">
    {#each [1, 3, 5, 6, 10] as n (n)}
      <Button size="xs" color="navy" label={String(n)} pressed={collageCount === n} sound="small" onclick={() => (collageCount = n)} />
    {/each}
    <Button size="xs" color="purple" label="Another Celebration" sound="small" onclick={() => collageSeed++} />
    <Button size="xs" color="grey" label="Replay the entry" sound="small" onclick={() => collageRun++} />
  </div>
  {#key `${collageRun}`}
    {#if projector}
      <div class="ds-s__collage-stage">
        <div class="ds-s__collage-scene">
          <div class="ds-s__collage-title" style:left="{SCENE.title.x}px" style:top="{SCENE.title.y}px" style:width="{SCENE.title.width}px" style:height="{SCENE.title.height}px">
            <StickerTitle text="Quina!" size="hero" color="gold" fit />
          </div>
          <div class="ds-s__collage-plate" style:left="{SCENE.plate.x}px" style:top="{SCENE.plate.y}px" style:width="{SCENE.plate.width}px" style:height="{SCENE.plate.height}px">
            <Plate color="gold" size="l" label="Quina 3" />
          </div>
          <div class="ds-s__collage-nino" style:left="{SCENE.left.x}px" style:top="{SCENE.left.y}px" style:height="{SCENE.left.height}px"><Nino pose="mans-adalt" size={SCENE.left.height} tilt={-4} motion="none" /></div>
          <div class="ds-s__collage-nino" style:left="{SCENE.right.x}px" style:top="{SCENE.right.y}px" style:height="{SCENE.right.height}px"><Nino pose="angel" size={SCENE.right.height} tilt={5} motion="none" /></div>
          <div class="ds-s__collage-box">
            <StickerCollage sponsors={COLLAGE.slice(0, collageCount)} seed="3:bingo@{collageSeed}" look="projector" obstacles={SCENE_OBSTACLES} focus={{ x: 720 - 32, y: 830 - 32 }} label="Patrocinadors del premi" />
          </div>
        </div>
      </div>
    {:else}
      <div class="ds-s__collage-phone">
        <StickerCollage sponsors={COLLAGE.slice(0, collageCount)} seed="3:bingo@{collageSeed}" look="phone" grow={1200} label="Patrocinadors del premi" />
      </div>
    {/if}
  {/key}
  <p class="ds-gallery__note">
    The stand-in logos are drawn here; the boards (Projector-Celebracio-Stickers) show the real 2025 logos. Not yet placed in the stage’s or the
    phone’s Celebration (design only until the user says so).
  </p>
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
  @layer app {
  .ds-s__ring {
    display: block;
    width: 112px;
    height: 112px;
    margin: 6px;
  }

  .ds-s__rings {
    grid-template-columns: repeat(auto-fill, minmax(10rem, 1fr));
  }

  /* The framed rings at their own size (170 px; the projector's 390 px) */
  .ds-s__before {
    grid-template-columns: repeat(auto-fill, minmax(min(100%, 13rem), 1fr));
  }

  :global([data-density='projector']) .ds-s__before {
    grid-template-columns: repeat(auto-fill, minmax(min(100%, 26rem), 1fr));
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

  .ds-s__night {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-6);
    align-items: center;
    padding: var(--space-5);
    border-radius: var(--radius-lg);
    background: var(--color-night);
    --color-text: var(--color-snow);
    --color-bg: var(--color-night);
  }

  .ds-s__rays {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(14rem, 1fr));
    gap: var(--space-4);
  }

  .ds-s__ray-cell {
    position: relative;
    display: grid;
    gap: var(--space-2);
    margin: 0;
    overflow: hidden;
    border-radius: var(--radius-lg);
    background: var(--color-night);
    color: var(--color-snow);
    font-size: var(--text-sm);
    font-weight: 800;
  }

  .ds-s__ray {
    width: 100%;
    aspect-ratio: 1;
  }

  .ds-s__ray-cell figcaption {
    padding: 0 var(--space-2) var(--space-2);
  }

  .ds-s__confetti {
    min-height: 14rem;
    align-content: end;
    padding: var(--space-2);
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

  .ds-s__collage-bar {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-2);
    margin-block: var(--space-2) var(--space-4);
  }

  .ds-s__collage-bar :global(.button) {
    width: auto;
  }

  /* The projector's 1440 × 1080 box at 60 %: the module packs in the box's own px (a transform doesn't change them). */
  .ds-s__collage-stage {
    width: 864px;
    max-width: 100%;
    aspect-ratio: 4 / 3;
    overflow: hidden;
    border-radius: var(--radius-lg);
    background: var(--color-bg, #18204a);
  }

  .ds-s__collage-scene {
    position: relative;
    width: 1440px;
    height: 1080px;
    transform: scale(0.6);
    transform-origin: 0 0;
  }

  .ds-s__collage-title,
  .ds-s__collage-plate,
  .ds-s__collage-nino {
    position: absolute;
    display: grid;
    place-items: center;
  }

  .ds-s__collage-title {
    rotate: -5deg;
  }

  .ds-s__collage-plate {
    rotate: 2deg;
  }

  .ds-s__collage-box {
    position: absolute;
    inset: 32px;
    display: grid;
  }

  .ds-s__collage-phone {
    display: grid;
    width: 342px;
    max-width: 100%;
    height: 420px;
    padding: var(--space-3) 0;
    border-radius: var(--radius-lg);
    background: var(--color-bg, #18204a);
  }
  }
</style>
