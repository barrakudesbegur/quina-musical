<!--
  The prize ticket (C2's `Ticket` recipe; the console's «Premis» tab, the Consola-Pestanyes board): a PaperCard
  `ticket` with its kind's ribbon («LÍNIA», «QUINA», «DEMPEUS»), the headline prizes big with their sponsor, then
  after the perforation the rest of the bundle: a hamper's staples (no sponsor, no detail) as one wrapped run, then
  each sponsor's prize on its own line, wrapping rather than cut, since the presenters read every sponsor out.
-->
<script lang="ts">
  import PaperCard from '../components/PaperCard.svelte';
  import Icon from '../icons/Icon.svelte';
  import type { WinKind } from '../flow.ts';
  import { CA } from '../i18n/ca.ts';
  import { prizeRuns } from '../plan.ts';
  import { ticketRibbon, type PrizeLine } from './prizes.ts';
  import './prizes.css';

  let {
    kind,
    prizes,
    label,
    empty,
  }: {
    kind: WinKind;
    /** The bundle, headline prizes first (`headline`), sponsors resolved. */
    prizes: readonly (PrizeLine & { readonly headline: boolean })[];
    /** The article's name («Premi de línia»). */
    label: string;
    /** Said when the bundle is empty («Sense premi»). */
    empty: string;
  } = $props();

  const lead = $derived(prizes.filter((p) => p.headline));
  const rest = $derived(prizes.filter((p) => !p.headline));
</script>

{#snippet head()}
  {#if prizes.length === 0}<span class="ticket__none">{empty}</span>{/if}
  {#each lead as prize, j (j)}
    <span class="ticket__title">{prize.title}</span>
    {#if prize.detail}<span class="ticket__detail">{prize.detail}</span>{/if}
    {#if prize.sponsor}<span class="ticket__sponsor"><Icon name="star" />{CA.sponsoredBy(prize.sponsor)}</span>{/if}
  {/each}
{/snippet}

{#snippet tail()}
  <ul class="ticket__items">
    {#each prizeRuns(rest) as run, j (j)}
      {#if run.plain}
        <li class="ticket__item" data-plain="true">
          <b>+ {#each run.items as prize, k (k)}<span class="ticket__staple">{prize.title}</span>{#if k < run.items.length - 1}{' · '}{/if}{/each}</b>
        </li>
      {:else}
        {@const prize = run.items[0]}
        <li class="ticket__item">
          <b>+ {prize?.title}</b>
          <span>· {[prize?.detail, prize?.sponsor].filter(Boolean).join(' · ')}</span>
        </li>
      {/if}
    {/each}
  </ul>
{/snippet}

<PaperCard class="ticket" layout="ticket" ribbon={ticketRibbon(kind)} data-prize={kind} aria-label={label} children={head} tail={rest.length ? tail : undefined} />
