<!--
  A QR of this console's LAN address, for an admin's phone on the same hotspot (labelled "Mòbil admin").
  The qrcode library loads only when the menu shows this. On localhost there is nothing to share.
-->
<script lang="ts">
  import { withToken } from '../../ui/client/pairing.ts';
  import { getConsole } from '../context.ts';
  import { consoleLinkFor } from '../logic/device.ts';
  import { S } from '../strings.ts';

  // The link carries the relay token, so the other phone pairs with the laptop when it opens it.
  const model = getConsole();
  const base = typeof location === 'undefined' ? null : consoleLinkFor(location.origin, S.menu.lanLabel);
  const link = base ? withToken(base, model.show.client.token) : null;
  let svg = $state<string | null>(null);

  $effect(() => {
    if (!link) return;
    let alive = true;
    import('qrcode')
      .then(({ default: QRCode }) => QRCode.toString(link, { type: 'svg', margin: 1, errorCorrectionLevel: 'M' }))
      .then((markup) => {
        if (alive) svg = markup;
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  });
</script>

<div class="lan-qr">
  {#if link}
    {#if svg}
      <!-- The library's own SVG markup for a URL we built: no user input reaches it. -->
      <div class="lan-qr__code" role="img" aria-label={S.menu.lan}>{@html svg}</div>
    {/if}
    <p class="lan-qr__link"><code>{link}</code></p>
    <p class="note">{S.menu.lanNote}</p>
  {:else}
    <p class="note">{S.menu.lanLocalhost}</p>
  {/if}
</div>
