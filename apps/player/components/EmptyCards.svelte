<script lang="ts">
  // The home's empty state (D290, 28 Nov; boards Mobil-Inici-Buit-*): no banner, a heading and two floating pills,
  // centred in the view's free space (home.css). «Afegir cartrons», plural on purpose: a phone can follow several cards.
  // «Escanejar el QR» is the main one (the camera opens over «Afegir cartró» at once, `qr-scan`); «Escriure el número»
  // opens «Afegir cartró» on its number pad. While it shows, the floating «+ Cartró» doesn't (HomeFloats: 1+ cards), so
  // the same action is never offered twice. Nothing moves in; nothing takes the focus on load. When it shows:
  // logic/empty-cards.ts.
  import Button from '../../../packages/ui/components/Button.svelte';
  import { PLAYER } from '../actions.ts';
  import { S } from '../strings.ts';
  import './empty-cards.css';

  let { onscan, onwrite }: { onscan: () => void; onwrite: () => void } = $props();
</script>

<div class="empty-cards">
  <h3 class="empty-cards__title">{S.emptyTitle}</h3>
  <div class="empty-cards__actions">
    <Button {...PLAYER.emptyScan} class="empty-cards__scan" aria-label={S.qrButton} aria-haspopup="dialog" onclick={onscan} />
    <Button {...PLAYER.emptyWrite} class="empty-cards__write" aria-label={S.emptyWriteLabel} aria-haspopup="dialog" onclick={onwrite} />
  </div>
</div>
