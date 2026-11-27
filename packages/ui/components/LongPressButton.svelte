<!--
  A2 · LongPressButton: a risky action that fires only after a hold (components-v2.md § 2 › A2). A Button (A1) or a
  menu row (`layout='row'`), plus a fill of light that sweeps left to right while it's held (hook long-press-confirm),
  clipped to the piece's inner corners (#14), and drains back when it's let go early; a short tap shows the hint
  «Mantén premut per confirmar» above it instead (hook hold-hint). With reduced motion a percentage shows instead of
  the sweep. The timing is the pure machine in hold/long-press.ts; the gesture (finger, Enter, Space, a bare click)
  is hold/gesture.svelte.ts, shared with TwoLevelButton.

  Its look is A1's visual props (`color`, `variant`, `size`, `icon`, `label`, `note`, `wii`, `ring`), from a preset in
  the domain layer: `<LongPressButton {...ACTIONS.back} onconfirm={…} />`. Its own: `layout`, `tag` (the menu's rare
  «Mantén premut» chip, D92), `hint`, `holdMs` (default: the page's --dur-hold-confirm), and `sound`, the press's
  touch sound; the confirmed hold plays `holdDone` (packages/ui/sounds/touch.ts › holdSounds), so the page's delegate
  leaves it alone (data-touch="none").
-->
<script lang="ts">
  import { CA } from '../i18n/ca.ts';
  import { holdSounds } from '../sounds/touch.ts';
  import Button from './Button.svelte';
  import { HoldGesture } from './hold/gesture.svelte.ts';
  import { LONG_PRESS_IDLE, longPress, longPressProgress, parseCssDurationMs, type LongPressState } from './hold/long-press.ts';
  import type { ButtonLook, UiSound } from './types.ts';
  import './long-press.css';

  /** The fallback when the page has no --dur-hold-confirm (tokens.css). */
  const HOLD_MS = 900;
  /** How long the hint stays after a short tap. */
  const HINT_MS = 1500;

  type Props = Pick<ButtonLook, 'color' | 'size' | 'icon' | 'iconPlacement' | 'label' | 'note' | 'wii' | 'ring' | 'disabled'> & {
    variant?: 'solid' | 'soft' | 'plain';
    /** A Button, or the menu's row: the icon at the start, the words beside it in Nunito. */
    layout?: 'button' | 'row';
    /** The menu's «Mantén premut» chip after the words (D92: menu rows only, never a play button, D91). */
    tag?: string | null;
    hint?: string;
    holdMs?: number | null;
    /** The press's touch sound (A1's kinds); the default by layout: a big button's, or a small one's for a row. */
    sound?: UiSound | null;
    onconfirm: () => void;
    class?: string;
    'data-testid'?: string;
  };

  let {
    variant = 'solid',
    layout = 'button',
    tag = null,
    hint = CA.controls.holdHint,
    holdMs = null,
    sound = undefined,
    disabled = false,
    onconfirm,
    class: className = '',
    ...look
  }: Props = $props();

  const uid = $props.id();
  let element: HTMLButtonElement | undefined = $state();
  const pressSound = $derived<UiSound | null>(sound === undefined ? (layout === 'row' ? 'small' : 'big') : sound);
  const sounds = holdSounds(() => pressSound ?? 'small');

  const config = () => ({
    holdMs: holdMs ?? parseCssDurationMs(element ? getComputedStyle(element).getPropertyValue('--dur-hold-confirm') : null, HOLD_MS),
    hintMs: HINT_MS,
  });

  const hold = new HoldGesture<LongPressState>({
    idle: LONG_PRESS_IDLE,
    usable: () => !disabled,
    pressing: (s) => s.phase === 'pressing',
    next: (s) => (s.phase === 'pressing' ? 'frame' : s.phase === 'hint' ? s.hintUntilMs : null),
    progress: (s, at) => longPressProgress(s, at, config()),
    step(state, event) {
      const step = longPress(state, event, config());
      if (pressSound !== null) {
        if (event.type === 'down' && step.state.phase === 'pressing' && state.phase !== 'pressing') sounds.down();
        if (step.fire) sounds.done();
        if (event.type === 'up') sounds.up();
        if (event.type === 'cancel') sounds.cancel();
      }
      if (step.fire) onconfirm();
      return step.state;
    },
  });
</script>

<span class="long-press" data-layout={layout}>
  <Button
    {...look}
    {variant}
    {disabled}
    bind:element
    class="long-press__button {className}"
    sound={null}
    data-layout={layout}
    data-state={hold.state.phase}
    data-sunk={hold.state.phase === 'pressing' || hold.state.phase === 'confirmed' || undefined}
    data-anim="long-press-confirm"
    style="--progress: {hold.progress}"
    aria-describedby="{uid}-how"
    {...hold.handlers}
    {@attach hold.attach}
  >
    {#if tag}<span class="long-press__tag">{tag}</span>{/if}
    <span class="long-press__fill" aria-hidden="true"></span>
    <span class="long-press__percent" aria-hidden="true">{CA.controls.percent(Math.round(hold.progress * 100))}</span>
  </Button>
  <span class="visually-hidden" id="{uid}-how">{hint}</span>
  <span class="long-press__hint" role="status" data-anim="hold-hint" data-state={hold.state.phase === 'hint' ? 'shown' : 'hidden'}>
    {hold.state.phase === 'hint' ? hint : ''}
  </span>
</span>
