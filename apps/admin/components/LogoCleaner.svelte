<!-- The logo clean-up step: upload the sponsor's JPEG or PNG, remove its background, trim it, fit it inside
     512×256 and keep it as PNG (its JPEG XL is made when it's uploaded). The pixel work is logic/logo-pixels.ts;
     decoding and encoding are data/logo-canvas.ts. -->
<script lang="ts">
  import { cleanLogo, toHex, type CleanResult, type Pixels, type RemoveMode } from '../logic/logo-pixels.ts';
  import { encodeLogo, readImageFile, type EncodedLogo } from '../data/logo-canvas.ts';
  import { LOGO_CONFIG } from '../config.ts';
  import { S } from '../strings.ts';

  let { sponsorName, onuse, onclose }: { sponsorName: string; onuse: (dataUrl: string) => void; onclose: () => void } = $props();

  const uid = $props.id();
  let source = $state.raw<Pixels | null>(null);
  let sourceUrl = $state<string | null>(null);
  let removeBg = $state(true);
  let mode = $state<RemoveMode>('edges');
  let tolerance = $state(LOGO_CONFIG.tolerance);
  let softness = $state(LOGO_CONFIG.softness);
  let result = $state.raw<CleanResult | null>(null);
  let encoded = $state.raw<EncodedLogo | null>(null);
  let working = $state(false);
  let error = $state<string | null>(null);

  const tooBig = $derived(encoded !== null && encoded.bytes > LOGO_CONFIG.maxBytes);
  const kb = (bytes: number) => Math.round(bytes / 1024);

  async function pick(event: Event) {
    const file = (event.currentTarget as HTMLInputElement).files?.[0];
    if (!file) return;
    error = null;
    encoded = null;
    result = null;
    if (sourceUrl) URL.revokeObjectURL(sourceUrl);
    sourceUrl = URL.createObjectURL(file);
    try {
      source = await readImageFile(file);
    } catch {
      source = null;
      error = S.logo.readError;
    }
  }

  // Re-run the pipeline a moment after the image or a setting changes.
  $effect(() => {
    const src = source;
    const options = { removeBackground: removeBg, mode, tolerance, softness };
    if (!src) return;
    let cancelled = false;
    const timer = setTimeout(async () => {
      working = true;
      try {
        const cleaned = cleanLogo(src, options);
        const next = cleaned.empty ? null : await encodeLogo(cleaned.pixels, cleaned.size);
        if (cancelled) return;
        result = cleaned;
        encoded = next;
        error = null;
      } catch {
        if (!cancelled) error = S.logo.readError;
      } finally {
        if (!cancelled) working = false;
      }
    }, 150);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  });

  $effect(() => () => {
    if (sourceUrl) URL.revokeObjectURL(sourceUrl);
  });
</script>

<section class="logo-cleaner" aria-labelledby="{uid}-title">
  <h3 class="logo-cleaner__title" id="{uid}-title">{S.logo.title(sponsorName)}</h3>
  <p class="panel__help">{S.logo.help}</p>

  <label class="field">
    <span class="field__label">{S.logo.file}</span>
    <input type="file" accept="image/png,image/jpeg,image/webp" onchange={pick} />
  </label>

  {#if source}
    <div class="logo-cleaner__controls">
      <label class="field field--inline">
        <input type="checkbox" bind:checked={removeBg} />
        <span>{S.logo.removeBackground}</span>
      </label>
      <fieldset class="logo-cleaner__mode" disabled={!removeBg}>
        <legend>{S.logo.mode}</legend>
        <label class="field field--inline"><input type="radio" name="{uid}-mode" value="edges" bind:group={mode} /> <span>{S.logo.modeEdges}</span></label>
        <label class="field field--inline"><input type="radio" name="{uid}-mode" value="all" bind:group={mode} /> <span>{S.logo.modeAll}</span></label>
      </fieldset>
      <label class="field">
        <span class="field__label">{S.logo.tolerance}: {tolerance}</span>
        <input type="range" min="0" max={LOGO_CONFIG.toleranceMax} bind:value={tolerance} disabled={!removeBg} />
      </label>
      <label class="field">
        <span class="field__label">{S.logo.softness}: {softness}</span>
        <input type="range" min="0" max={LOGO_CONFIG.softnessMax} bind:value={softness} disabled={!removeBg} />
      </label>
    </div>
  {/if}

  <div aria-live="polite" class="logo-cleaner__status">
    {#if error}<p class="notice notice--error">{error}</p>{/if}
    {#if working}<p class="panel__help">{S.logo.working}</p>{/if}
    {#if result && removeBg}
      {#if result.background.kind === 'color'}
        <p class="logo-cleaner__bg">
          <span class="logo-cleaner__swatch" style:background-color={toHex(result.background.color)}></span>
          {S.logo.detected(toHex(result.background.color), result.background.corners)}
        </p>
      {:else if result.background.kind === 'transparent'}
        <p class="panel__help">{S.logo.transparent}</p>
      {:else}
        <p class="notice notice--warn">{S.logo.unclear}</p>
      {/if}
    {/if}
    {#if result?.empty}<p class="notice notice--warn">{S.logo.empty}</p>{/if}
  </div>

  {#if sourceUrl}
    <div class="logo-cleaner__previews">
      <figure class="logo-cleaner__figure">
        <img src={sourceUrl} alt="" />
        <figcaption>{S.logo.original}</figcaption>
      </figure>
      {#if encoded}
        <figure class="logo-cleaner__figure checkerboard">
          <img src={encoded.dataUrl} alt={S.sponsors.logoAlt(sponsorName)} />
          <figcaption>{S.logo.onCheckerboard}</figcaption>
        </figure>
        <figure class="logo-cleaner__figure show-background">
          <img src={encoded.dataUrl} alt="" />
          <figcaption>{S.logo.onShow}</figcaption>
        </figure>
      {/if}
    </div>
  {/if}

  {#if encoded}
    <p class="panel__help">{S.logo.size(encoded.width, encoded.height, kb(encoded.bytes), 'PNG')}</p>
    {#if tooBig}<p class="notice notice--error">{S.logo.tooBig(kb(encoded.bytes), kb(LOGO_CONFIG.maxBytes))}</p>{/if}
  {/if}

  <p class="panel__help">{S.logo.storageNote}</p>
  <div class="panel__actions">
    <button type="button" data-color="orange" disabled={!encoded || tooBig || working} onclick={() => encoded && onuse(encoded.dataUrl)}>{S.logo.use}</button>
    <button type="button" onclick={onclose}>{S.logo.close}</button>
  </div>
</section>

<style>
  @layer app {
  .logo-cleaner {
    display: grid;
    gap: var(--space-3);
    padding: var(--space-4);
    border: var(--line-width) dashed var(--color-line);
    border-radius: var(--radius-md);
    background: var(--color-bg);
  }
  .logo-cleaner__title {
    font-size: var(--text-md);
  }
  .logo-cleaner__controls {
    display: grid;
    gap: var(--space-3);
    grid-template-columns: repeat(auto-fit, minmax(14rem, 1fr));
  }
  .logo-cleaner__mode {
    display: grid;
    gap: var(--space-2);
  }
  .logo-cleaner__bg {
    display: flex;
    gap: var(--space-2);
    align-items: center;
    font-size: var(--text-sm);
  }
  .logo-cleaner__swatch {
    width: var(--space-5);
    height: var(--space-5);
    border: var(--line-width) solid var(--color-line);
    border-radius: var(--radius-sm);
  }
  .logo-cleaner__previews {
    display: grid;
    gap: var(--space-3);
    grid-template-columns: repeat(auto-fit, minmax(12rem, 1fr));
  }
  .logo-cleaner__figure {
    display: grid;
    gap: var(--space-2);
    justify-items: center;
    margin: 0;
    padding: var(--space-3);
    border-radius: var(--radius-sm);
    border: var(--line-width) solid var(--color-line);
  }
  .logo-cleaner__figure img {
    max-height: calc(var(--space-7) * 3);
    width: auto;
  }
  .logo-cleaner__figure figcaption {
    font-size: var(--text-xs);
    padding: var(--space-1) var(--space-2);
    border-radius: var(--radius-sm);
    background: var(--color-surface);
    color: var(--color-text);
  }
  }
</style>
