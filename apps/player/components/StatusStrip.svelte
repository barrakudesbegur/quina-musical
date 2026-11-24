<script lang="ts">
  // Thin strips under the header, on every tab: Admin's notice, and the Check in progress and its result. (The
  // connection strip is ConnectionStrip, at the very top.)
  import type { PlayerApp } from '../model.svelte.ts';
  import { S } from '../strings.ts';

  let { app }: { app: PlayerApp } = $props();
  const check = $derived(app.scene === 'check' ? app.state?.check : null);
</script>

{#if app.state?.notice}
  <p class="notice" role="note"><strong class="notice__label">{S.noticeLabel}:</strong> {app.state.notice}</p>
{/if}

{#if check}
  <section class="check-strip" data-anim="check" data-state={check.result} aria-live="polite">
    <p class="check-strip__text">
      {S.checking(check.cardId)}
      <span class="check-strip__kind">{S.checkFor[check.kind]}</span>
    </p>
    {#if check.result === 'pending'}
      <span class="check-strip__dots" aria-hidden="true"><span></span><span></span><span></span></span>
    {:else}
      <p class="check-strip__result">{check.result === 'valid' ? S.checkValid : S.checkInvalid}</p>
    {/if}
  </section>
{/if}
