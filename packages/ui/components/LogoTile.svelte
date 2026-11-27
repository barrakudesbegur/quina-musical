<!--
  G4 · LogoTile: a sponsor's logo contained on a white tile (components-v2.md § 8; sponsors.css), or its name while it
  has no logo. The logo is a <picture>: its JPEG XL where the browser reads it, else the PNG (packages/ui/data/media.ts),
  never cropped, its alt the sponsor's name. Given `onclick` it is a button (the phone's list: a tap opens the logo
  larger) with the small-button sound; otherwise a still tile. Its size comes from the density and its context.
-->
<script lang="ts">
  import { imageSources } from '../data/media.ts';
  import type { SponsorLogo } from './sponsor-types.ts';
  import './sponsors.css';

  let {
    sponsor,
    label = null,
    onclick = null,
    imgStyle = undefined,
    element = $bindable(),
  }: {
    sponsor: SponsorLogo;
    /** The button's accessible name (it says what a tap does); the logo's alt is the sponsor's name. */
    label?: string | null;
    onclick?: ((event: MouseEvent) => void) | null;
    /** The logo's inline style (the view transition's name while it morphs). */
    imgStyle?: string;
    element?: HTMLElement;
  } = $props();
  const sources = $derived(sponsor.logo ? imageSources(sponsor.logo) : null);
</script>

{#snippet face()}
  {#if sources}
    <picture class="logo-tile__picture">
      {#if sources.jxl}<source type="image/jxl" srcset={sources.jxl} />{/if}
      <img class="logo-tile__img" src={sources.src} alt={onclick ? '' : sponsor.name} decoding="async" draggable="false" style={imgStyle} />
    </picture>
  {:else}
    <span class="logo-tile__name" style={imgStyle}>{sponsor.name}</span>
  {/if}
{/snippet}

{#if onclick}
  <button bind:this={element} type="button" class="logo-tile" data-touch="small" aria-label={label ?? sponsor.name} {onclick}>{@render face()}</button>
{:else}
  <span bind:this={element} class="logo-tile">{@render face()}</span>
{/if}
