<!--
  The throw song's name as a chip beside «Ara sona» («Llançament», «Tempesta»; D138, D151), in its button's colour
  (ACTIONS): IntervalMusic while it plays over a playlist, NowPlaying while it plays with no playlist (at the doors).
-->
<script lang="ts">
  import type { ThrowSong } from '@quina/protocol';
  import { ACTIONS } from '../actions.ts';
  import { S } from '../strings.ts';

  let { song }: { song: ThrowSong } = $props();
</script>

<span class="throw-chip" data-color={ACTIONS[song].color}>{S.throws.names[song].label}</span>

<style>
  @layer app {
  .throw-chip {
    display: inline-block;
    margin-inline-start: var(--space-2);
    padding: 0 8px;
    border: var(--line-width-thin) solid var(--color-ink);
    border-radius: var(--radius-pill);
    background: var(--palette-solid);
    color: var(--palette-contrast);
    font-size: var(--text-xs);
    letter-spacing: 0;
    text-transform: none;
    vertical-align: middle;
  }
  }
</style>
