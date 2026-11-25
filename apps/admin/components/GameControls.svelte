<!-- The show's status, and starting and ending the Game. Start introduces the first round (`roundIntro`);
     End (`endGame`) can't be undone, so it needs the confirmation word typed. -->
<script lang="ts">
  import type { ShowStore } from '../../../packages/ui/client/show.svelte.ts';
  import { CA } from '../../../packages/ui/i18n/ca.ts';
  import { roundIntroFields, type GamePlan } from '../../../packages/ui/plan.ts';
  import type { CommandTracker } from '../state/commands.svelte.ts';
  import { S } from '../strings.ts';
  import CommandStatus from './CommandStatus.svelte';

  let { show, commands, plan }: { show: ShowStore; commands: CommandTracker; plan: GamePlan | null } = $props();

  const snapshot = $derived(show.state);
  const scene = $derived(show.flow.scene);
  const canStart = $derived(snapshot !== null && scene === 'before' && commands.canSend);
  let confirmText = $state('');
  const confirmed = $derived(confirmText.trim().toUpperCase() === S.night.endWord);
  const canEnd = $derived(snapshot !== null && scene !== 'after' && confirmed && commands.canSend);

  function start() {
    // Its kind and card type from the plan, as the console sends them.
    commands.send('roundIntro', null, roundIntroFields(plan, 1));
  }

  function end(event: SubmitEvent) {
    event.preventDefault();
    if (!canEnd) return;
    commands.send('endGame', null);
    confirmText = '';
  }
</script>

<section class="panel surface game-status" aria-labelledby="game-status-title" data-scene={scene}>
  <h2 class="panel__title" id="game-status-title">{S.night.statusTitle}</h2>
  {#if snapshot}
    <dl class="game-status__facts">
      <div><dt>{S.night.scene}</dt><dd>{CA.scene[scene]}</dd></div>
      <div><dt>{S.night.status}</dt><dd>{S.night.statusNames[snapshot.status]}</dd></div>
      <div>
        <dt>{S.night.round}</dt>
        <dd>{snapshot.round.number > 0 ? CA.roundOf(snapshot.round.number, snapshot.game.roundsTotal) : '—'}{snapshot.round.kind === 'special' ? ` · ${CA.specialRound}` : snapshot.round.kind === 'desgraciat' ? ` · ${CA.desgraciatRound}` : ''}</dd>
      </div>
      {#if show.flow.pause}<div><dt>{CA.pause}</dt><dd>✓</dd></div>{/if}
    </dl>
  {:else}
    <p class="panel__help">{S.night.noState}</p>
  {/if}
</section>

<section class="panel surface game-controls" aria-labelledby="game-controls-title">
  <h2 class="panel__title" id="game-controls-title">{S.night.gameTitle}</h2>

  <div class="game-controls__block">
    <p class="panel__help">{S.night.startHelp}</p>
    <div class="panel__actions">
      <button type="button" class="tone-primary" onclick={start} disabled={!canStart}>{S.night.start}</button>
      {#if snapshot && scene !== 'before'}<span class="panel__help">{S.night.startOnlyBefore}</span>{/if}
      <CommandStatus record={commands.last('roundIntro')} />
    </div>
  </div>

  <form class="game-controls__block" onsubmit={end}>
    <p class="panel__help">{S.night.endHelp}</p>
    <label class="field">
      <span class="field__label">{S.night.endConfirm(S.night.endWord)}</span>
      <input type="text" bind:value={confirmText} autocomplete="off" autocapitalize="characters" spellcheck="false" />
    </label>
    <div class="panel__actions">
      <button type="submit" class="tone-danger" disabled={!canEnd}>{S.night.end}</button>
      <CommandStatus record={commands.last('endGame')} />
    </div>
  </form>
</section>

<style>
  .game-status__facts {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(10rem, 1fr));
    gap: var(--space-3);
    margin: 0;
  }
  .game-status__facts dt {
    font-size: var(--text-xs);
    color: var(--color-text-muted);
  }
  .game-status__facts dd {
    margin: 0;
    font-size: var(--text-lg);
    font-weight: var(--font-weight-strong);
  }
  .game-controls__block {
    display: grid;
    gap: var(--space-2);
  }
</style>
