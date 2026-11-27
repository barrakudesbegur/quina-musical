<script lang="ts">
  // «Instal·la l'app» on the home screen (D221; ANIMATIONS.md `install-offer`): only while Chrome holds an install
  // prompt and the app isn't installed (Android and desktop Chrome; never an iPhone, where only Ajustos offers it).
  // A tap opens Chrome's own install dialog. The home places it where the cards list ends, under the floating
  // «+ Cartró» (U193 pending: the Orchestrator's reading).
  import { fade } from 'svelte/transition';
  import Button from '../../../packages/ui/components/Button.svelte';
  import { PLAYER } from '../actions.ts';
  import type { InstallState } from '../device/install.svelte.ts';
  import { homeOffersInstall } from '../logic/install.ts';
  import './install.css';

  let { install, class: className = '' }: { install: InstallState; class?: string } = $props();
</script>

{#if homeOffersInstall(install.offer)}
  <div class="install-prompt {className}" data-anim="install-offer" out:fade={{ duration: 160 }}>
    <Button {...PLAYER.install} onclick={() => void install.prompt()} />
  </div>
{/if}
