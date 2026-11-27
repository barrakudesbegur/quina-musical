<!--
  «Llançament» or «Tempesta» (logic/throw-songs.ts; the Consola-Llancament-Tempesta board): the generic TwoLevelButton
  (packages/ui/components, A3) with the engine's side. A tap starts the song, stops it while it plays and resumes it;
  holding it past CONSOLE.escalateHoldMs plays it again from its hook (hook throw-hold), on the «Des del principi»
  strip. While its song plays the button is on: sunk, its stripes panning (hook throw-on); idle or stopped it has no
  pattern, like every other button (R3, #20). While it's on, the big one shows its time from the hook: ♪ or ‖, the
  time, a bar with the drop's mark («Llançament» only: «Tempesta» starts at the drop) and its length
  (logic/throw-songs.ts throwProgress); idle, no song name (the user: the banner was unnecessary).
  `variant`: big (the big bottom place), line (a break's slim line along the top, D195: the name and its note on the
  left, the time on the right, the strip under them) or top (the last round's top row, between «Enrere» and
  «Comprovar»: no strip, the fill sweeps the whole button). The layouts are console.css's (`.throw-button`).
  Its icon is the preset's (actions.ts): crossed swords or a cloud raining corn, in the outline look like the other big
  buttons' (D245). Only on the tablet: no Wii keys, and A never plays it. Hooks: data-testid="throw-button" or
  "storm-button".
-->
<script lang="ts">
  import type { ThrowSong } from '@quina/protocol';
  import { CONSOLE } from '../config.ts';
  import { getConsole } from '../context.ts';
  import { throwButtonState, throwClock, throwCommand, throwProgress } from '../logic/throw-songs.ts';
  import type { TwoLevelAction } from '../../../packages/ui/components/hold/two-level.ts';
  import { ACTIONS } from '../actions.ts';
  import { S } from '../strings.ts';
  import TwoLevelButton from '../../../packages/ui/components/TwoLevelButton.svelte';

  interface Props {
    song: ThrowSong;
    variant?: 'big' | 'line' | 'top';
  }

  let { song, variant = 'big' }: Props = $props();

  const model = getConsole();
  const t = $derived(S.throws.names[song]);
  const preset = $derived(ACTIONS[song]);
  const info = $derived(model.show.state?.throwSong ?? null);
  const songState = $derived(throwButtonState(info, song));
  const enabled = $derived(model.can(song));
  const note = $derived(songState === 'playing' ? S.throws.stop : songState === 'stopped' ? S.throws.resume : songState === 'other' ? t.replace : t.start);
  // Its time while it's on (the bar), on the show's clock.
  const time = $derived(info && info.song === song ? throwProgress(info, model.show.now) : null);
  const clock = $derived(time ? S.throws.time(throwClock(time.atSec), throwClock(Math.round(time.totalSec))) : null);

  function act(action: TwoLevelAction): void {
    const command = throwCommand(song, action);
    if (!command || !enabled) return;
    if (command.cmd === 'throw') model.act('throw', command.args);
    else model.act('storm', command.args);
  }
</script>

<TwoLevelButton
  {...preset}
  class="throw-button"
  label={t.label}
  sub={t.sub}
  note={variant === 'top' ? null : note}
  level2={variant === 'top' ? null : preset.level2}
  meter={time && variant !== 'top'
    ? {
        fraction: time.fraction,
        start: throwClock(time.atSec),
        end: throwClock(Math.round(time.totalSec)),
        marker: time.dropAt !== null ? { at: time.dropAt, label: S.throws.drop } : null,
        icon: songState === 'playing' ? 'music' : 'pause',
      }
    : null}
  active={songState === 'playing' ? 1 : null}
  canEscalate={enabled}
  disabled={!enabled}
  holdMs={CONSOLE.escalateHoldMs}
  how={`${clock ? `${clock}. ` : ''}${S.throws.howTo(note)}`}
  data-testid="{song}-button"
  data-layout={variant}
  data-song-state={songState}
  ontap={() => act('tap')}
  onescalate={() => act('escalate')}
  onrelease={() => act('release')}
/>
