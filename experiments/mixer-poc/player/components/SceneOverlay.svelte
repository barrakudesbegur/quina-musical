<script lang="ts">
  // The technical pause ("Tornem de seguida") and the offline notice: a calm full-screen notice. The cards stay
  // reachable: the tab bar stays usable, and a button closes it to see them.
  import { S } from '../strings.ts';

  let { kind, ondismiss }: { kind: 'pause' | 'offline'; ondismiss: () => void } = $props();
</script>

<div class="scene-overlay" data-anim={kind} data-state={kind} role="alertdialog" aria-labelledby="scene-overlay-title" aria-describedby="scene-overlay-hint">
  <div class="scene-overlay__panel">
    <span class="scene-overlay__nino" aria-hidden="true"></span>
    <h2 class="scene-overlay__title" id="scene-overlay-title">{kind === 'pause' ? S.pause : S.offline}</h2>
    <p class="scene-overlay__hint" id="scene-overlay-hint">{S.overlayHint}</p>
    <button type="button" class="big-button scene-overlay__button" onclick={ondismiss}>{S.seeCards}</button>
  </div>
</div>
