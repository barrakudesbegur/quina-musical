<script lang="ts">
  // The Check on the phone (ANIMATIONS.md `check`): a slim ribbon under the drum, never over it (the user's canvas
  // comment, 28 Nov evening). AraHome places it in the drum's box, so it rides with the drum's collapse and sticks under
  // the strip. Pending: «Comprovant el cartró #57…», the kind and three stepping dots; on the cue the result takes the
  // dots' place and the card's number the words', so the line stays one line.
  import type { PlayerApp } from '../model.svelte.ts';
  import { S } from '../strings.ts';

  let { app, el = $bindable() }: { app: PlayerApp; el?: HTMLElement } = $props();
  const check = $derived(app.scene === 'check' ? app.state?.check : null);
</script>

{#if check}
  <section class="check-strip" bind:this={el} data-anim="check" data-state={check.result} aria-live="polite">
    <!-- One line of words: the kind and the dots never part (a narrow phone wraps the words before them, never between
         them); the result follows them on the cue. -->
    <p class="check-strip__text">
      {check.result === 'pending' ? S.checking(check.cardId) : S.cardNumber(check.cardId)}
      <span class="check-strip__tail"
        ><span class="check-strip__kind">{S.checkFor[check.kind]}</span
        >{#if check.result === 'pending'}<span class="check-strip__dots" aria-hidden="true"><span></span><span></span><span></span></span>{/if}</span
      >
      {#if check.result !== 'pending'}
        <span class="check-strip__result">{check.result === 'valid' ? S.checkValid : S.checkInvalid}</span>
      {/if}
    </p>
  </section>
{/if}
