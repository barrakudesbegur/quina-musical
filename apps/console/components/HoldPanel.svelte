<!-- During a Hold: why, for how long, Hold music, and Resume. -->
<script lang="ts">
  import { formatCountdown } from '../../../packages/rules/time.ts';
  import { getConsole } from '../context.ts';
  import { elapsedSec, holdMusicCountdown } from '../logic/countdown.ts';
  import { S, holdReasonText } from '../strings.ts';
  import Icon from './Icon.svelte';
  import Switch from './Switch.svelte';

  const model = getConsole();
  const snap = $derived(model.show.state);
  const hold = $derived(snap?.hold ?? null);
  const toMusic = $derived(snap ? holdMusicCountdown(snap, model.show.now) : null);
</script>

{#if snap && hold}
  <section class="panel hold-panel" data-reason={hold.reason} aria-labelledby="hold-title">
    <h2 class="panel__title" id="hold-title">{S.hold.title}</h2>
    <p class="hold-panel__reason">{holdReasonText(hold.reason)}</p>
    <p class="hold-panel__since">{S.hold.since(formatCountdown(elapsedSec(hold.sinceMs, model.show.now)))}</p>
    {#if toMusic}<p class="hold-panel__music-in">{S.hold.holdMusicIn(toMusic.secondsLeft)}</p>{/if}
    <div class="hold-panel__actions">
      <Switch
        label={S.hold.holdMusic}
        on={snap.holdMusic}
        note={snap.holdMusic ? S.hold.holdMusicOn : null}
        disabled={snap.holdMusic || !model.can('holdMusic')}
        onchange={() => model.act('holdMusic')}
      />
      <Switch
        label={S.hold.autoMusic}
        on={snap.game.holdMusicOn ?? true}
        note={S.hold.autoMusicNote}
        disabled={!model.can('setGame')}
        onchange={(on) => model.act('setGame', { holdMusicOn: on })}
      />
      <button type="button" class="action tone-primary" data-anim="press" disabled={!model.can('hold')} onclick={() => model.act('hold', { on: false })}>
        <Icon name="play" /><span>{S.hold.resume}</span>
      </button>
    </div>
  </section>
{/if}
