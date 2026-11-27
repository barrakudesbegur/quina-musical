<script lang="ts">
  // The Premis drawer's content (D244, answering U30; board Mobil-Premis-D244; components-v2.md § 11.11): one round at
  // a time. P1's round selector stays at the top (‹ Quina 3 ARA ›: the round's name and mark, «Ara» on the round being
  // played, «La següent» on the one coming, a lock while its prizes are secret); under it, P2's page: the Line's and the
  // Quina's bundles (the Desgraciat round's one), or, on a locked round, «Premis sorpresa» and the night's sponsors as
  // big logos (the user: larger, and the drawer scrolls). It opens on the round Horari asked for, else the round in
  // focus. A step turns the page towards the arrow pressed (ANIMATIONS.md `prizes-step`).
  import Chip from '../../../packages/ui/components/Chip.svelte';
  import IconButton from '../../../packages/ui/components/IconButton.svelte';
  import SponsorList from '../../../packages/ui/components/SponsorList.svelte';
  import StickerIcon from '../../../packages/ui/icons/StickerIcon.svelte';
  import { PLAYER_ICONS } from '../actions.ts';
  import type { PlayerApp } from '../model.svelte.ts';
  import { prizesStartRound, stepRound } from '../logic/prizes.ts';
  import { prizeRounds, roundNameOf } from '../logic/view.ts';
  import { S } from '../strings.ts';
  import Icon from './Icon.svelte';
  import PrizeBundle from './PrizeBundle.svelte';
  import RoundMark from './RoundMark.svelte';
  import './prizes.css';

  let { app, round: asked }: { app: PlayerApp; round?: number } = $props();
  const rounds = $derived(prizeRounds(app.plan, app.state, app.data.cards.map((c) => c.id)));
  /** The round the player stepped to; until then the drawer follows the round asked for or in focus. */
  let picked: number | null = $state(null);
  const shown = $derived(picked !== null && rounds.some((r) => r.number === picked) ? picked : prizesStartRound(rounds, asked, app.focusRound));
  const page = $derived(rounds.find((r) => r.number === shown) ?? null);
  const prev = $derived(shown === null ? null : stepRound(rounds, shown, -1));
  const next = $derived(shown === null ? null : stepRound(rounds, shown, 1));
  const nameOf = (n: number | null): string | null => (n === null ? null : roundNameOf(n, app.state, app.plan));
  const sponsors = $derived((app.plan?.sponsors ?? []).map((s) => ({ name: s.name, logo: s.logo })));
  /** The side the last step came from (prizes-step); none when the page changes by itself or on opening. */
  let from: 'left' | 'right' | null = $state(null);
  let root: HTMLElement | undefined = $state();

  function step(by: -1 | 1): void {
    if (shown === null) return;
    const to = stepRound(rounds, shown, by);
    if (to === null) return;
    from = by < 0 ? 'left' : 'right';
    picked = to;
    // The new page starts at its top, the selector still stuck above it.
    root?.closest('.sheet__body')?.scrollTo({ top: 0 });
  }
</script>

<section class="prizes" bind:this={root}>
  {#if !page}
    <p class="prizes__empty">{S.noPlan}</p>
  {:else}
    <nav class="prizes__pager" aria-label={S.prizesRounds}>
      <IconButton {...PLAYER_ICONS.prizesPrev} label={S.prizesPrev(nameOf(prev))} disabled={prev === null} onclick={() => step(-1)} />
      <p class="prizes__round" aria-live="polite" data-kind={page.kind}>
        <RoundMark kind={page.kind} />
        <span class="prizes__name">{nameOf(page.number)}</span>
        {#if page.lockedUntil}
          <span class="prizes__lock"><Icon name="lock" /><span class="visually-hidden">{S.prizesSecretName}</span></span>
        {:else if page.state === 'current'}
          <Chip class="prizes__tag" label={S.roundState.current} color="orange" variant="solid" size="s" />
        {:else if page.state === 'next'}
          <Chip class="prizes__tag" label={S.roundState.next} color="grey" size="s" />
        {/if}
      </p>
      <IconButton {...PLAYER_ICONS.prizesNext} label={S.prizesNext(nameOf(next))} disabled={next === null} onclick={() => step(1)} />
    </nav>
    {#key page.number}
      <div class="prizes__page" data-anim="prizes-step" data-from={from ?? undefined} data-locked={page.lockedUntil ? 'true' : undefined}>
        {#if page.lockedUntil}
          <div class="prizes__surprise">
            <span class="prizes__gift" aria-hidden="true"><StickerIcon name="gift" /><span class="prizes__question">?</span></span>
            <h3 class="prizes__surprise-title">{S.prizesSurprise}</h3>
            <p class="prizes__surprise-note">{S.prizesSurpriseNote[page.lockedUntil]}</p>
            <!-- A round won before its prizes were revealed (an all-secret plan) still says so. -->
            {#each page.lines.filter((l) => l.won) as line (line.kind)}
              <PrizeBundle {line} mine={app.data.cards} locked />
            {/each}
          </div>
          {#if sponsors.length}
            <h3 class="prizes__sponsors-title">{S.prizesSponsors}</h3>
            <SponsorList {sponsors} label={S.prizesSponsors} />
          {/if}
        {:else}
          {#each page.lines as line (line.kind)}
            <PrizeBundle {line} mine={app.data.cards} />
          {/each}
        {/if}
      </div>
    {/key}
  {/if}
</section>
