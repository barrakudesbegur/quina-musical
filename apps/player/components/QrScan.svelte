<script lang="ts">
  import Button from '../../../packages/ui/components/Button.svelte';
  import { PLAYER } from '../actions.ts';
  // The add-card drawer's camera (D141; board Mobil-Afegir-QR): the rear camera fills the drawer's body, dimmed outside
  // a gold viewfinder where a line sweeps (ANIMATIONS.md `qr-scan`). The browser asks for the camera the first time.
  // A QR of this year's card hands its number back (`qr-found`); any other QR shows an orange note and it keeps looking
  // (`qr-other`). Without the camera (refused, or none), it says so and offers to type the number. The camera stops
  // as soon as this goes.
  import { PLAYER_CONFIG } from '../config.ts';
  import { frameReader } from '../device/qr-reader.ts';
  import { readCardQr } from '../logic/qr.ts';
  import { S } from '../strings.ts';
  import Icon from './Icon.svelte';

  let { onfound, onwrite }: { onfound: (cardId: number) => void; onwrite: () => void } = $props();

  type ScanState = 'asking' | 'scanning' | 'denied' | 'failed';
  let phase = $state<ScanState>('asking');
  let other = $state(false);
  let video: HTMLVideoElement | undefined = $state();

  $effect(() => {
    const el = video;
    if (!el) return;
    let stream: MediaStream | null = null;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let noteTimer: ReturnType<typeof setTimeout> | undefined;
    let done = false;
    const stop = () => {
      done = true;
      clearTimeout(timer);
      clearTimeout(noteTimer);
      for (const track of stream?.getTracks() ?? []) track.stop();
    };

    async function start(target: HTMLVideoElement): Promise<void> {
      if (!navigator.mediaDevices?.getUserMedia) {
        phase = 'failed';
        return;
      }
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' } }, audio: false });
      } catch (error) {
        const name = error instanceof DOMException ? error.name : '';
        phase = name === 'NotAllowedError' || name === 'SecurityError' ? 'denied' : 'failed';
        return;
      }
      if (done) return stop();
      target.srcObject = stream;
      await target.play().catch(() => undefined);
      phase = 'scanning';
      const read = await frameReader();
      const look = async () => {
        if (done) return;
        const text = await read(target).catch(() => null);
        if (done) return;
        if (text !== null) {
          const qr = readCardQr(text, PLAYER_CONFIG.edition);
          if (qr.kind === 'card') {
            stop();
            onfound(qr.cardId);
            return;
          }
          other = true;
          clearTimeout(noteTimer);
          noteTimer = setTimeout(() => (other = false), PLAYER_CONFIG.qrOtherNoteMs);
        }
        timer = setTimeout(look, PLAYER_CONFIG.qrReadEveryMs);
      };
      void look();
    }

    void start(el);
    return stop;
  });
</script>

<div class="qr-scan" data-state={phase} data-other={other ? 'true' : undefined}>
  {#if phase === 'denied' || phase === 'failed'}
    <div class="qr-scan__off" role="alert">
      <span class="qr-scan__off-icon" aria-hidden="true">
        <Icon name="cameraOff" alone />
      </span>
      <p class="qr-scan__off-title">{S.qrOffTitle}</p>
      <p class="qr-scan__off-text">{phase === 'denied' ? S.qrDenied : S.qrFailed}</p>
      <Button {...PLAYER.typeNumber} class="qr-scan__write" onclick={onwrite} />
    </div>
  {:else}
    <!-- svelte-ignore a11y_media_has_caption -->
    <video class="qr-scan__video" bind:this={video} playsinline muted autoplay aria-label={S.qrCamera}></video>
    {#if phase === 'asking'}
      <span class="qr-scan__asking" aria-hidden="true">
        <Icon name="camera" alone />
      </span>
    {:else}
      <div class="qr-scan__finder" aria-hidden="true">
        <span class="qr-scan__corner qr-scan__corner--tl"></span><span class="qr-scan__corner qr-scan__corner--tr"></span>
        <span class="qr-scan__corner qr-scan__corner--bl"></span><span class="qr-scan__corner qr-scan__corner--br"></span>
        <span class="qr-scan__line" data-anim="qr-scan"></span>
      </div>
    {/if}
    {#if other}
      <p class="qr-scan__note" role="status" data-anim="qr-other"><span class="qr-scan__note-mark" aria-hidden="true">!</span>{S.qrOther}</p>
    {/if}
    <p class="qr-scan__hint">{phase === 'asking' ? S.qrAsk : other ? S.qrKeepLooking : S.qrPoint}</p>
  {/if}
</div>
