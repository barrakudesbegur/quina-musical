<!--
  B7 · NumberPad: the keypad that types a card's number (components-v2.md § 3 › B7; comments-27nov.md D-c).

  1–9 in three columns, then a last row: ⌫ 0 ↵ with `enter` (the finalists' pad), else 0 and ⌫ with ⌫ at
  `deleteKey`'s end (the phone: blank, 0, ⌫; the claim pad: ⌫, 0). A digit the parent can't use any more (the phone's
  smart keypad: no card starts that way) is disabled: `enabled` lists the usable digits (all by default), and
  `canDelete` / `canEnter` the other two. The keys are pieces on the press resource (R4: they sink onto their edge);
  a disabled key takes the dashed, faded look (pad-keys). Each key says what it is to the touch delegate (`digit`,
  `backspace`); ↵ is silent, since the parent plays the entry's own sound (a chip added, or refused). The parent
  owns the number (`onkey`) and the physical keyboard. Sizes come from the density; `--numpad-columns` lays the
  keys in one row (Cerca's card keypad).
-->
<script lang="ts">
  import Icon from '../icons/Icon.svelte';
  import type { PadKey } from './control-types.ts';
  import './number-pad.css';

  type Digit = Exclude<PadKey, 'back' | 'enter'>;

  interface Props {
    /** The keypad's name («Teclat del número»). */
    label: string;
    backLabel: string;
    enterLabel?: string;
    /** The digits that can still be typed; null: all of them. */
    enabled?: ReadonlySet<string> | null;
    canDelete?: boolean;
    enter?: boolean;
    canEnter?: boolean;
    deleteKey?: 'start' | 'end';
    /** One row, as wide as its container (12 keys: Cerca's card keypad). */
    row?: boolean;
    disabled?: boolean;
    onkey: (key: PadKey) => void;
    class?: string;
    enterTestid?: string;
  }

  let {
    label,
    backLabel,
    enterLabel = '↵',
    enabled = null,
    canDelete = true,
    enter = false,
    canEnter = true,
    deleteKey = 'end',
    row = false,
    disabled = false,
    onkey,
    class: className = '',
    enterTestid,
  }: Props = $props();

  const DIGITS: readonly Digit[] = ['1', '2', '3', '4', '5', '6', '7', '8', '9'];
  /** The last row: null is an empty cell. */
  const last = $derived<readonly (PadKey | null)[]>(enter ? ['back', '0', 'enter'] : deleteKey === 'start' ? ['back', '0', null] : [null, '0', 'back']);
  const keys = $derived<readonly (PadKey | null)[]>(row ? [...DIGITS, '0', 'back', ...(enter ? (['enter'] as const) : [])] : [...DIGITS, ...last]);
  const usable = (key: PadKey): boolean =>
    !disabled && (key === 'back' ? canDelete : key === 'enter' ? canEnter : enabled === null || enabled.has(key));
</script>

<div class="numpad {className}" role="group" aria-label={label} data-row={row || undefined}>
  {#each keys as key, i (i)}
    {#if key === null}
      <span class="numpad__blank" aria-hidden="true"></span>
    {:else}
      <button
        type="button"
        class="numpad__key ds-pushable"
        class:numpad__key--delete={key === 'back'}
        class:numpad__key--enter={key === 'enter'}
        data-key={key}
        data-color={key === 'enter' ? 'green' : 'snow'}
        data-touch={key === 'back' ? 'backspace' : key === 'enter' ? 'none' : 'digit'}
        data-testid={key === 'enter' ? enterTestid : undefined}
        aria-label={key === 'back' ? backLabel : key === 'enter' ? enterLabel : undefined}
        disabled={!usable(key)}
        onclick={() => onkey(key)}
      >
        <span class="numpad__face ds-piece">
          {#if key === 'back'}<Icon name="backspace" alone />{:else if key === 'enter'}<Icon name="enter" alone />{:else}{key}{/if}
          <!-- The dashed, faded look of a key that can't be used (pad-keys); drawn over the key and faded in. -->
          <span class="numpad__off" aria-hidden="true">{#if key === 'back'}<Icon name="backspace" alone />{:else if key === 'enter'}<Icon name="enter" alone />{:else}{key}{/if}</span>
        </span>
      </button>
    {/if}
  {/each}
</div>
