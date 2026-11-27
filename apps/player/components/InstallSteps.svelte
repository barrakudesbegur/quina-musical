<script lang="ts">
  // The iPhone's «Instal·la l'app» drawer (D221; ANIMATIONS.md `install-steps`): no iPhone browser can install from
  // the page, so this shows the shortest steps, each with the drawing of the button to tap and its name in bold.
  // Safari: ⋯ by the address bar → Compartir → Afegir a la pantalla d'inici → Afegir («Obrir com a app web» left on).
  import LineIcon from '../../../packages/ui/icons/Icon.svelte';
  import { installSteps, type IosBrowser } from '../logic/install.ts';
  import { S } from '../strings.ts';
  import './install.css';

  let { browser }: { browser: IosBrowser } = $props();
  const steps = $derived(installSteps(browser, S.installSteps));
</script>

<div class="install-steps">
  <p class="install-steps__intro">{S.installIntro}</p>
  <ol class="install-steps__list" aria-label={S.installStepsLabel} data-anim="install-steps">
    {#each steps as step, i (i)}
      {@const [before, after] = step.text.split('{}')}
      <li class="install-steps__step" style:--step={i}>
        <span class="install-steps__number" aria-hidden="true">{i + 1}</span>
        <span class="install-steps__key"><LineIcon name={step.icon} alone /></span>
        <span class="install-steps__text">{before}<b>{step.button}</b>{after}</span>
      </li>
    {/each}
  </ol>
  <p class="install-steps__after">{S.installAfter}</p>
</div>
