<!-- The printable cheat sheet (#xuleta): every round's prizes with sponsors, the sponsors no prize names, the claim and special-round
     rules, the laptop's Plan B keys, the setup checklist, and the Wii remote ("Comandament": the same drawing
     and legend as the console's dialog, packages/ui/wii, with the console's own mapping, so the sheet
     always matches the remote). The content model is logic/cheatsheet.ts; print.css turns it into A4 pages
     in black on white (the remote's colours print too, and every button also carries its own label). -->
<script lang="ts">
  import { CA } from '../../../packages/ui/i18n/ca.ts';
  import { prizeRuns, type GamePlan } from '../../../packages/ui/plan.ts';
  import WiiGuide from '../../../packages/ui/wii/WiiGuide.svelte';
  import { consoleWiiLegend } from '../../console/wii/guide.ts';
  import { cheatSheetModel } from '../logic/cheatsheet.ts';
  import { CHEAT_SHEET_COPY, S } from '../strings.ts';

  let { plan }: { plan: GamePlan | null } = $props();
  const sheet = $derived(cheatSheetModel(plan, CHEAT_SHEET_COPY));
  const wiiLegend = consoleWiiLegend();
</script>

<div class="cheat-sheet__actions no-print panel__actions">
  <button type="button" data-color="orange" onclick={() => window.print()}>{S.cheat.print}</button>
  <span class="panel__help">{S.cheat.printHelp}</span>
</div>

<article class="cheat-sheet paper" aria-labelledby="cheat-title">
  <h1 class="cheat-sheet__title" id="cheat-title">{S.cheat.title} · {sheet.title}</h1>
  {#if !plan}<p class="cheat-sheet__note no-print">{S.cheat.noPlan}</p>{/if}

  {#if sheet.rounds.length}
    <section class="cheat-sheet__section cheat-sheet__section--prizes">
      <h2 class="cheat-sheet__heading">{S.cheat.prizes}</h2>
      <table class="cheat-sheet__prizes">
        <colgroup>
          <col class="cheat-sheet__col-round" />
          <col class="cheat-sheet__col-line" />
          <col />
        </colgroup>
        <thead>
          <tr>
            <th scope="col"><span class="visually-hidden">{S.rounds.title}</span></th>
            <th scope="col">{CA.prize.line}</th>
            <th scope="col">{CA.prize.bingo}</th>
          </tr>
        </thead>
        <tbody>
          {#each sheet.rounds as round (round.number)}
            <tr data-kind={round.special ? 'special' : round.desgraciat ? 'desgraciat' : 'normal'}>
              <th scope="row">
                {round.label}
              </th>
              {#each round.prizes as prize (prize.kind)}
                <!-- The Quina del Desgraciat has no Line: its one prize, the last card standing's, spans both
                     columns. -->
                <td colspan={round.desgraciat ? 2 : undefined}>
                  {#if round.desgraciat}<span class="cheat-sheet__label">{prize.label}</span>{/if}
                  {#if prize.items.length}
                    <!-- The headline prizes in bold with "Gentilesa de …" under each; then the rest, compact: a hamper's
                         staples (no sponsor, no detail) as one wrapped run, each sponsor's prize on its own line. -->
                    <ul class="cheat-sheet__bundle">
                      {#each prize.items.filter((i) => i.headline) as item, j (j)}
                        <li class="cheat-sheet__item" data-headline="true">
                          <strong>{item.title}</strong>
                          {#if item.detail}<span class="cheat-sheet__detail">{item.detail}</span>{/if}
                          {#if item.sponsor}<span class="cheat-sheet__sponsor">{CA.sponsoredBy(item.sponsor)}</span>{/if}
                        </li>
                      {/each}
                      {#each prizeRuns(prize.items.filter((i) => !i.headline)) as run, j (j)}
                        {#if run.plain}
                          <li class="cheat-sheet__item" data-headline="false" data-plain="true">
                            {#each run.items as item, k (k)}<span class="cheat-sheet__staple">{item.title}</span>{#if k < run.items.length - 1}{' · '}{/if}{/each}
                          </li>
                        {:else}
                          {@const item = run.items[0]}
                          <li class="cheat-sheet__item" data-headline="false">
                            {item.title}{#if item.detail}<span class="cheat-sheet__aside">{` · ${item.detail}`}</span>{/if}{#if item.sponsor}<span class="cheat-sheet__aside">{` · ${item.sponsor}`}</span>{/if}
                          </li>
                        {/if}
                      {/each}
                    </ul>
                  {:else}
                    <span class="cheat-sheet__none">{S.cheat.noPrize}</span>
                  {/if}
                </td>
              {/each}
            </tr>
          {/each}
        </tbody>
      </table>
    </section>
  {/if}

  {#if sheet.otherSponsors.length}
    <section class="cheat-sheet__section">
      <h2 class="cheat-sheet__heading">{S.cheat.otherSponsors}</h2>
      <p class="cheat-sheet__others">{sheet.otherSponsors.join(' · ')}</p>
    </section>
  {/if}

  <div class="cheat-sheet__columns">
    {#if sheet.claimRules.length}
      <section class="cheat-sheet__section">
        <h2 class="cheat-sheet__heading">{S.cheat.claimRules}</h2>
        <ul>
          {#each sheet.claimRules as rule, i (i)}<li>{rule}</li>{/each}
        </ul>
      </section>
    {/if}
    {#if sheet.specialRoundRules.length}
      <section class="cheat-sheet__section">
        <h2 class="cheat-sheet__heading">{S.cheat.specialRules}</h2>
        <ul>
          {#each sheet.specialRoundRules as rule, i (i)}<li>{rule}</li>{/each}
        </ul>
      </section>
    {/if}
  </div>

  <div class="cheat-sheet__columns">
    <section class="cheat-sheet__section">
      <h2 class="cheat-sheet__heading">{S.cheat.keys}</h2>
      <dl class="cheat-sheet__keys">
        {#each sheet.keys as key (key.keys)}
          <div class="cheat-sheet__key">
            <dt><kbd>{key.keys}</kbd></dt>
            <dd>{key.action}</dd>
          </div>
        {/each}
      </dl>
    </section>
    <section class="cheat-sheet__section">
      <h2 class="cheat-sheet__heading">{S.cheat.checklist}</h2>
      <ul class="cheat-sheet__checklist">
        {#each sheet.checklist as item, i (i)}<li>{item}</li>{/each}
      </ul>
    </section>
  </div>

  <section class="cheat-sheet__section cheat-sheet__wii" aria-labelledby="cheat-wii">
    <h2 class="cheat-sheet__heading" id="cheat-wii">{S.cheat.wii}</h2>
    <p>{sheet.wiiReminder}</p>
    <WiiGuide items={wiiLegend} footer={CA.wii.footer} sideLabel={CA.wii.side} />
  </section>
</article>

<style>
  @layer app {
  /* The Quina del Desgraciat's one prize names itself in its cell ("Premi de l'últim dempeus"): it has no Line. */
  .cheat-sheet__label {
    display: block;
    font-size: var(--text-xs);
    font-weight: var(--font-weight-strong);
    letter-spacing: 0.06em;
    text-transform: uppercase;
  }
  .cheat-sheet {
    display: grid;
    /* The screen's width at most: on a phone the prize table scrolls inside its section, the page doesn't. */
    grid-template-columns: minmax(0, 1fr);
    gap: var(--space-5);
    padding: var(--space-5);
    font-size: var(--text-md);
  }
  .cheat-sheet__title {
    font-size: var(--text-2xl);
  }
  @media screen {
    .cheat-sheet__section--prizes {
      overflow-x: auto;
    }
  }
  .cheat-sheet__heading {
    font-size: var(--text-lg);
    margin-bottom: var(--space-2);
  }
  .cheat-sheet__section ul {
    margin: 0;
    padding-left: var(--space-5);
    display: grid;
    gap: var(--space-1);
  }
  .cheat-sheet__columns {
    display: grid;
    gap: var(--space-5);
    grid-template-columns: repeat(auto-fit, minmax(18rem, 1fr));
  }
  .cheat-sheet__prizes {
    width: 100%;
    border-collapse: collapse;
  }
  .cheat-sheet__prizes th,
  .cheat-sheet__prizes td {
    padding: var(--space-1) var(--space-2);
    border-bottom: var(--line-width) solid var(--color-line);
    text-align: left;
    vertical-align: top;
  }
  .cheat-sheet__prizes tbody th {
    white-space: nowrap;
  }
  .cheat-sheet__section .cheat-sheet__bundle {
    list-style: none;
    padding: 0;
    gap: var(--space-1);
  }
  .cheat-sheet__item[data-headline='false'] {
    font-size: var(--text-sm);
  }
  /* A Line holds a few prizes, a Quina's hamper 17–19: the hamper gets the room. */
  .cheat-sheet__col-round {
    width: 6.5em;
  }
  .cheat-sheet__col-line {
    width: 32%;
  }
  .cheat-sheet__staple {
    white-space: nowrap;
  }
  .cheat-sheet__aside {
    font-weight: var(--font-weight-body);
  }
  .cheat-sheet__others {
    margin: 0;
  }
  .cheat-sheet__detail,
  .cheat-sheet__sponsor {
    display: block;
    font-size: var(--text-sm);
    font-weight: var(--font-weight-body);
  }
  .cheat-sheet__keys {
    display: grid;
    gap: var(--space-1);
    margin: 0;
  }
  .cheat-sheet__key {
    display: grid;
    grid-template-columns: 7em 1fr;
    gap: var(--space-2);
  }
  .cheat-sheet__key dd {
    margin: 0;
  }
  .cheat-sheet__key kbd {
    font-family: inherit;
    font-weight: var(--font-weight-strong);
  }
  .cheat-sheet__checklist {
    list-style: '☐  ';
  }
  .cheat-sheet__wii {
    display: grid;
    gap: var(--space-3);
    --wii-height: 18rem;
  }
  .cheat-sheet__wii p {
    margin: 0;
  }

  @media print {
    .cheat-sheet {
      border: 0;
      padding: 0;
      gap: var(--space-4);
    }
    .cheat-sheet__section {
      break-inside: avoid;
    }
    /* The prizes run over pages (10 hampers don't fit one): a round never splits, and the column heads repeat. */
    .cheat-sheet__section--prizes {
      break-inside: auto;
    }
    .cheat-sheet__heading {
      break-after: avoid;
    }
    .cheat-sheet__prizes tr {
      break-inside: avoid;
    }
    .cheat-sheet__wii {
      --wii-height: 15rem;
      --wii-muted: #000;
    }
  }
  }
</style>
