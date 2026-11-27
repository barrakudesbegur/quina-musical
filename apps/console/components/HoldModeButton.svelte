<!--
  Parlem or Aguanta (the Consola-Joc board): the generic TwoLevelButton (packages/ui/components, A3) with the engine's
  side. Its look is the preset (actions.ts: ACTIONS.hold, ACTIONS.stay; the strip in the top's own palette, D-k), its
  state comes from the show: a tap is the first level, holding past CONSOLE.escalateHoldMs the second
  (logic/hold-modes.ts decides what each sends). Parlem → Pausa; Aguanta → Suspens, landing when let go. An open
  Suspens pulses with its auto-release countdown (hook suspense-hold).
  With a Wii remote connected: Parlem −+ (a tap) and Pausa −+ held; Aguanta B held, Suspens B + A held at the strip's
  right end (D144, D147), after the shake «×3 / » while the shake is switched on (D148, D-j), until a Suspens is open.
  During Pausa Parlem shows on and locked (D128): a padlock, no pattern (#23); a tap ends Pausa.
  The lock mirror (D234, logic/two-level-lock.ts): every press and let-go of this button here, and of its Wii keys
  (wii/controller.svelte.ts), tells the engine (`twoLevelHold`); while another console holds it (`twoLevelHeld`), this
  one shows it locked: disabled, the padlock, «la manté <console>» as its note, no pattern (ANIMATIONS.md ›
  hold-locked-elsewhere).
-->
<script lang="ts">
  import { CONSOLE } from '../config.ts';
  import { getConsole, getWii } from '../context.ts';
  import { suspenseCountdown } from '../logic/countdown.ts';
  import { modeCommand, secondLevel, type HoldMode } from '../logic/hold-modes.ts';
  import { holderName, LOCK_BUTTON } from '../logic/two-level-lock.ts';
  import type { TwoLevelAction } from '../../../packages/ui/components/hold/two-level.ts';
  import { S } from '../strings.ts';
  import { ACTIONS, WII } from '../actions.ts';
  import TwoLevelButton from '../../../packages/ui/components/TwoLevelButton.svelte';

  interface Props {
    mode: HoldMode;
    /** The Hold in progress, if any (its mode shows pressed). */
    active: HoldMode | null;
    enabled: boolean;
  }

  let { mode, active, enabled }: Props = $props();

  const model = getConsole();
  const wii = getWii();
  const preset = $derived(mode === 'talk' ? ACTIONS.hold : ACTIONS.stay);

  const level2 = $derived(
    secondLevel(mode, {
      paused: model.show.flow.pause !== null,
      suspenseOpen: model.controls.suspense.open,
      canPause: model.can('pause'),
      canSuspense: model.controls.suspense.enabled,
    }),
  );
  /** Parlem during Pausa: on, and it can't be turned off until Pausa ends (D128). */
  const locked = $derived(mode === 'talk' && level2.on);
  const button = $derived(LOCK_BUTTON[mode]);
  /** D234: the console holding this button elsewhere, by name, while it's locked here. */
  const heldBy = $derived.by(() => {
    const label = model.heldElsewhere(button);
    return label === null ? null : (holderName(label, CONSOLE.labelPresets) ?? S.cluster.anotherConsole);
  });
  // Usable when either level is: the first one (hold), or leaving the second (a tap while it's on).
  const usable = $derived(enabled || level2.on || level2.canEnter);
  const countdown = $derived(mode === 'stay' && level2.on && model.show.state ? suspenseCountdown(model.show.state, model.show.now) : null);
  /** The hold reached Suspens and the finger is still down. */
  let escalated = $state(false);
  const note = $derived.by(() => {
    if (heldBy !== null) return S.cluster.heldElsewhere(heldBy);
    if (mode === 'talk' && level2.on) return S.cluster.pauseOn;
    if (mode === 'stay' && level2.on) return escalated ? S.cluster.suspenseOpen : S.cluster.suspenseTap;
    return active === mode ? S.cluster.activeNote : preset.note;
  });
  /** The strip's keys: Pausa's always; Suspens's until it's open, with the shake first while it's on (D148). */
  const stripWii = $derived(mode === 'talk' ? WII.pause : level2.on ? null : wii.shake ? { keys: ['shake'] as const, size: 'sm' as const, or: WII.suspense } : WII.suspense);

  function act(action: TwoLevelAction): void {
    if (action === 'escalate') escalated = true;
    if (action === 'release') escalated = false;
    // Read the current state for each action: a tap acts on what is on now.
    const command = modeCommand(mode, action, active, level2);
    // No command when its level isn't allowed now (a tap while only the second level could be entered).
    if (!command || (command.cmd === 'hold' && !enabled)) return;
    if (command.cmd === 'hold') model.act('hold', command.args);
    else if (command.cmd === 'pause') model.act('pause', command.args);
    else model.act('suspense', command.args);
  }
</script>

<TwoLevelButton
  {...preset}
  iconPlacement="top"
  {note}
  level2={{ ...preset.level2, wii: stripWii }}
  lead={S.cluster.holdFor}
  active={level2.on ? 2 : active === mode ? 1 : null}
  canEscalate={level2.canEnter}
  disabled={!usable || heldBy !== null}
  holdMs={CONSOLE.escalateHoldMs}
  badge={heldBy !== null ? { icon: 'lock', label: S.cluster.heldElsewhereLong(heldBy) } : locked ? { icon: 'lock', label: S.cluster.talkLocked } : null}
  timer={countdown ? S.cluster.suspenseAutoRelease(countdown.secondsLeft) : null}
  pulse={mode === 'stay' && level2.on ? (countdown ? 1 - countdown.remaining : 0) : null}
  data-mode={mode}
  ontap={() => act('tap')}
  onescalate={() => act('escalate')}
  onrelease={() => act('release')}
  onpress={() => model.twoLevelPress(button, 'touch')}
  onletgo={() => model.twoLevelRelease(button, 'touch')}
/>
