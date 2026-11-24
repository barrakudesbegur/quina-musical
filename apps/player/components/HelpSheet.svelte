<script lang="ts">
  // Help: how to play, the sound switch, privacy, and "Esborrar dades".
  import type { PlayerApp } from '../model.svelte.ts';
  import { S } from '../strings.ts';
  import HowToPlay from './HowToPlay.svelte';
  import Sheet from './Sheet.svelte';

  let { app }: { app: PlayerApp } = $props();
</script>

<Sheet name="help" title={S.helpTitle} onclose={() => app.closeDialog()}>
  <HowToPlay />
  <section class="help__settings">
    <p class="help__row">
      <span class="help__label" id="help-sounds">{S.soundsLabel}</span>
      <button type="button" class="help__toggle" aria-labelledby="help-sounds" aria-pressed={app.soundsOn} onclick={() => app.toggleSounds()}>
        {app.soundsOn ? S.on : S.off}
      </button>
    </p>
  </section>
  <p class="help__privacy">{S.privacy}</p>
  <p class="help__install">{S.install}</p>
  <button type="button" class="big-button tone-danger help__wipe" onclick={() => app.open({ kind: 'wipe' })}>{S.wipeData}</button>
</Sheet>
