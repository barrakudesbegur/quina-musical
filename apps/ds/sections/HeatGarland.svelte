<!--
  The gallery's E2 · Garland, HeatMeter section: the Heat as each screen draws it, with the apps' own components. The
  phone's garland (apps/player/components/Heat.svelte) and the projector's (apps/stage/render/garland.ts, on the stage's
  own CSS lifted by stage-garland.ts) play the light patterns of packages/ui/motion/garland.ts (ANIMATIONS.md › "The
  garland's lights", D-t); the console's HeatMeter is the real Heat as a bar with its Phase zones. The captions name the
  pattern garlandLights picks for each value and mood. Captions in English (GLOSSARY.md); the meter's words are Catalan.
-->
<script lang="ts">
  import { untrack, type Snippet } from 'svelte';
  import type { PhaseName, WinKind } from '@quina/protocol';
  import { garlandLights, type GarlandMood, type GarlandPattern } from '../../../packages/ui/motion/garland.ts';
  import HeatMeter from '../../console/components/HeatMeter.svelte';
  import { HEAT_BANDS } from '../../console/logic/engine-rules.ts';
  import { phaseZones } from '../../console/logic/phase-zones.ts';
  import Heat from '../../player/components/Heat.svelte';
  import { PLAYER_CONFIG } from '../../player/config.ts';
  import { STAGE } from '../../stage/config.ts';
  import { garlandLook } from '../../stage/model/garland.ts';
  import { Garland } from '../../stage/render/garland.ts';
  import { STAGE_ROOT_CLASS } from '../stage-garland.ts';

  let { density }: { density: 'console' | 'phone' | 'projector' } = $props();
  const mode = untrack(() => density);

  /** What each pattern does (ANIMATIONS.md's table). */
  const PATTERN: Record<GarlandPattern, string> = {
    none: 'the lights out, nothing moves',
    breathe: 'each lamp fades 100 → 55 % and back at its own phase',
    wave: 'a swell of light rolls left to right',
    chase: 'the three-step chase: one bulb in three lit, running left to right',
    fire: 'the lamps flicker; flames behind every {n} bulb',
    party: 'the six party colours blink in three groups, stepping along',
    win: 'the party colours at 50 %, a burst of light running along the string',
  };
  /** The heats shown: one per level, mid-level. */
  const HEATS = [
    { name: 'cool', value: 0.15 },
    { name: 'warm', value: 0.38 },
    { name: 'hot', value: 0.62 },
    { name: 'very hot', value: 0.88 },
  ] as const;
  const seconds = (ms: number) => `${Math.round(ms / 100) / 10} s`;
  /** A caption: the case, the pattern garlandLights picks and its period, and what it does. */
  function caption(what: string, heat: number, mood: GarlandMood, flameEvery: number): string {
    const lights = garlandLights(heat, mood);
    const does = PATTERN[lights.pattern].replace('{n}', flameEvery === 2 ? 'other' : `${flameEvery === 3 ? 'third' : `${flameEvery}th`}`);
    const flames = lights.fire && lights.pattern !== 'fire' ? `, with flames behind every ${flameEvery === 2 ? 'other' : 'third'} bulb` : '';
    return `${what}: ${lights.pattern === 'none' ? 'no pattern' : lights.pattern}${lights.periodMs ? `, ${seconds(lights.periodMs)}` : ''} (${does}${flames})`;
  }

  // ---- the phone ----
  const PHONE: { caption: string; value: number; off?: boolean; party?: boolean; win?: boolean }[] = [
    ...HEATS.map((h) => ({ caption: caption(`${h.name} · Heat ${h.value}`, h.value, 'live', PLAYER_CONFIG.garland.flameEvery), value: h.value })),
    { caption: caption('party · your song, Heat 0.62', 0.62, 'party', PLAYER_CONFIG.garland.flameEvery), value: 0.62, party: true },
    { caption: caption('win · a Celebration’s scene, Heat 0.62', 0.62, 'win', PLAYER_CONFIG.garland.flameEvery), value: 0.62, win: true },
    { caption: caption('off · offline, Heat 0.38', 0.38, 'off', PLAYER_CONFIG.garland.flameEvery), value: 0.38, off: true },
  ];

  // ---- the projector ----
  const STAGE_CASES: { caption: string; heat: number; mood: 'live' | 'win' }[] = [
    ...HEATS.map((h) => ({ caption: caption(`${h.name} · Heat ${h.value}`, h.value, 'live', STAGE.garland.flameEvery), heat: h.value, mood: 'live' as const })),
    { caption: caption('win · the Celebration, Heat 0.62', 0.62, 'win', STAGE.garland.flameEvery), heat: 0.62, mood: 'win' },
  ];
  /** The stage's own garland DOM, painted before it is attached (so it doesn't ease in from cold). */
  function stageGarland(heat: number, mood: 'live' | 'win') {
    return (node: HTMLElement) => {
      const garland = new Garland(STAGE.garland, Math.random);
      garland.paint(garlandLook(heat, mood));
      node.append(garland.root);
      return () => garland.root.remove();
    };
  }

  // ---- the console ----
  const ZONES = phaseZones(HEAT_BANDS);
  const METERS: { percent: number; phase: PhaseName; climbing: WinKind }[] = (ZONES ?? []).map((zone) => ({
    percent: Math.round(((zone.start + zone.end) / 2) * 100),
    phase: zone.phase,
    climbing: zone.phase === 'early' || zone.phase === 'mid' ? 'line' : 'bingo',
  }));
</script>

{#snippet cell(caption: string, body: Snippet)}
  <figure class="ds-gallery__cell">
    <div class="ds-gallery__stage" lang="ca">{@render body()}</div>
    <figcaption>{caption}</figcaption>
  </figure>
{/snippet}

<section class="ds-gallery__section" aria-labelledby="s-e2">
  <h2 id="s-e2">E2 · Garland, HeatMeter</h2>
  {#if mode === 'console'}
    <p class="ds-prose">
      The console shows the real Heat as a bar (HeatMeter): the ▼ points at it, a mark where each Phase starts (the engine’s
      Heat bands) and the Phase names under it, the current one bold. The label names the engine’s Phase, never one read off the
      bar. The phones and the projector show the Heat as the garland instead (on their pages).
    </p>
    <div class="ds-gallery__grid ds-gallery__grid--wide">
      {#each METERS as m (m.phase)}
        {#snippet b()}
          <div class="header__panel header__panel--round ds-e2__meter">
            <p class="header__round">Quina 3</p>
            <HeatMeter percent={m.percent} phase={m.phase} zones={ZONES} fixed={false} climbing={m.climbing} />
          </div>
        {/snippet}
        {@render cell(`${m.percent} %: the ${m.phase} zone, climbing to a ${m.climbing === 'line' ? 'Line' : 'Bingo'}`, b)}
      {/each}
    </div>
  {:else}
    <p class="ds-prose">
      The Heat as a garland of lights across the top, never a bar that fills (D-t): its colour and glow follow the value, and its
      lights play a pattern for the Heat’s level ({mode === 'phone' ? '13 bulbs on 2 swags, 390 px wide, stretched to the screen' : '34 bulbs on 4 swags across the 1440 px box, hung 26 px above its top'}).
      Only each bulb’s lamp moves, by opacity, on CSS keyframes (with motion allowed{mode === 'phone' ? ' and the phone’s data-motion="full"' : ''}).
      Reduced motion: the lights stand still and still show the Heat.
    </p>
    {#if mode === 'phone'}
      <div class="ds-gallery__grid ds-gallery__grid--wide ds-e2__grid">
        {#each PHONE as p (p.caption)}
          {#snippet b()}
            <div class="ds-e2__phone"><Heat value={p.value} off={p.off} party={p.party} win={p.win} /></div>
          {/snippet}
          {@render cell(p.caption, b)}
        {/each}
      </div>
    {:else}
      <div class="ds-e2__stack">
        {#each STAGE_CASES as s (s.caption)}
          {#snippet b()}
            <div class="ds-e2__wide"><div class="ds-e2__projector {STAGE_ROOT_CLASS}" {@attach stageGarland(s.heat, s.mood)}></div></div>
          {/snippet}
          {@render cell(s.caption, b)}
        {/each}
      </div>
      <p class="ds-gallery__note">The stage has no <code>party</code> (a phone’s own song) and no <code>off</code> (it has no offline look of its own).</p>
    {/if}
  {/if}
</section>

<style>
  @layer app {
  /* The phone's garland in a box as wide as the phone, on the night sky (it is fixed to the screen's top in the app). */
  .ds-e2__grid {
    grid-template-columns: repeat(auto-fill, minmax(min(100%, 390px), 1fr));
  }

  .ds-e2__phone {
    position: relative;
    inline-size: 390px;
    max-inline-size: 100%;
    block-size: calc(var(--player-garland-height) + var(--space-4));
    overflow: hidden;
    border-radius: var(--radius-md);
    background-color: var(--color-night);
    background-image: var(--sky-stars);
    background-size: var(--sky-stars-size);
    background-position: var(--sky-stars-position);

    & :global(.heat) {
      position: absolute;
      top: 0;
    }
  }

  /* The projector's: the top of the 1440 px box, which hides the hooks above it. */
  .ds-e2__stack {
    display: grid;
    gap: var(--space-6);
  }

  .ds-e2__wide {
    max-inline-size: 100%;
    overflow-x: auto;
  }

  .ds-e2__projector {
    position: relative;
    inline-size: 1440px;
    block-size: 112px;
    overflow: hidden;
    border-radius: var(--radius-md);
    background-color: var(--color-night);
    background-image: var(--sky-stars);
    background-size: var(--sky-stars-size);
    background-position: var(--sky-stars-position);
  }

  /* The console's header panel, at a header's width */
  .ds-e2__meter {
    max-inline-size: 34rem;
  }
  }
</style>
