<!--
  «Proves», in the menu (logic/tests-mode.ts): only while the relay runs with `--test` (Menu.svelte mounts it on
  `model.testMode`), never on the night. Three controls, from the console's own parts, no design of its own:
  - «Nova partida» (`testReset`): a new Game, behind «Acabar la nit»'s hold (LongPressButton, «Mantén premut»);
  - a round picker (the plan's rounds, in order, by their names), then «Anar a la presentació» (`testJump { round }`);
  - «Cançons ja comptades» K (a Slider, 0 … the round's songs) and «Anar-hi després de K cançons»
    (`testJump { round, songs: K }`).
  Disabled offline and while the show page is locked, like the other game commands. Hook: data-testid="tests-panel".
-->
<script lang="ts">
  import MiniButton from '../../../packages/ui/components/MiniButton.svelte';
  import LongPressButton from '../../../packages/ui/components/LongPressButton.svelte';
  import Slider from '../../../packages/ui/components/Slider.svelte';
  import { getConsole } from '../context.ts';
  import { testJumpArgs, testRounds, testSongsMax } from '../logic/tests-mode.ts';
  import { S } from '../strings.ts';
  import { ACTIONS, MINI } from '../actions.ts';
  import Icon from './Icon.svelte';

  const model = getConsole();
  const uid = $props.id();

  const rounds = $derived(testRounds(model.plan, model.show.state?.game.roundsTotal ?? 0, model.catalog?.cards ?? null));
  let picked = $state<number | null>(null);
  const round = $derived(rounds.find((r) => r.number === picked) ?? rounds.find((r) => r.number === model.show.state?.round.number) ?? rounds[0] ?? null);
  const max = $derived(testSongsMax(round));
  let songs = $state(0);
  const k = $derived(Math.min(songs, max));
  const allowed = $derived(model.can('testReset'));
</script>

<section class="menu-group tests" aria-labelledby="{uid}-title" data-testid="tests-panel">
  <h3 class="menu-group__title" id="{uid}-title"><Icon name="tests" />{S.tests.title}</h3>
  <p class="note">{S.tests.note}</p>

  <LongPressButton {...ACTIONS.testReset} disabled={!allowed} data-testid="tests-reset" onconfirm={() => model.act('testReset', {})} />

  <span class="menu-group__field" id="{uid}-round">{S.tests.round}</span>
  <div class="choice-group" role="group" aria-labelledby="{uid}-round">
    {#each rounds as r (r.number)}
      <MiniButton size="s" label={S.roundShort(r, model.plan)} pressed={r.number === round?.number} onclick={() => (picked = r.number)} />
    {/each}
  </div>

  <MiniButton {...MINI.testIntro} disabled={!allowed || !round} data-testid="tests-intro" onclick={() => round && model.act('testJump', testJumpArgs(round.number, null))} />
  <p class="note">{S.tests.introNote}</p>

  <Slider
    label={S.tests.songs}
    value={k}
    min={0}
    {max}
    page={5}
    format={S.tests.songsValue}
    lessLabel={S.tests.songsLess}
    moreLabel={S.tests.songsMore}
    disabled={!round}
    oninput={(v) => (songs = v)}
    data-testid="tests-songs"
  />
  <MiniButton {...MINI.testPlay} label={S.tests.play(k)} disabled={!allowed || !round} data-testid="tests-play" onclick={() => round && model.act('testJump', testJumpArgs(round.number, k))} />
  <p class="note">{S.tests.playNote}</p>
</section>
