// Which touch sound each of the phone's controls makes (temp/design-canvas/ds/ui-sounds.md § 5; ANIMATIONS.md
// `press`, `pad-keys`, `icon-pick`, `corner-press`, `tab-switch`, `refused-tap`). The first rule an element matches
// wins, so the specific ones come first; any other button is a small one. The generic components (packages/ui/components)
// carry their own `data-touch` (their `sound` prop, by kind: Button's is 'big'), which wins over these rules. The drawers' own sounds play from
// Drawer.svelte (closing) and PlayerApp.open (opening); the Sons switch plays its own (PlayerApp.toggleSounds).
import type { TouchWiring } from '../../../packages/ui/sounds/delegate.ts';

export const PLAYER_TOUCH: TouchWiring = {
  rules: [
    { selector: '.menu__switch', cls: () => null },
    { selector: '.number-pad__key--delete', cls: 'backspace', refuse: true },
    { selector: '.number-pad__key', cls: 'digit', refuse: true },
    { selector: '.number-pad__save', cls: 'submit', refuse: true },
    { selector: '.rename button[type="submit"]', cls: 'submit' },
    { selector: '.icon-picker__option', cls: 'iconPick', refuse: true },
    { selector: '.corner-button', cls: 'corner' },
    { selector: '.cards__add', cls: 'floating' },
    { selector: 'button, [role="button"]', cls: 'small' },
  ],
  // The lists people scroll: a control in them sounds at its click, so a scroll that starts on it stays silent.
  scrollers: '.drawer--horari, .drawer--premis, .drawer--ajustos, .drawer--any-passat, .cards, .song-list',
  // An icon another card has is a label over a disabled radio: the label itself isn't disabled.
  unusable: ':disabled, [aria-disabled="true"], .is-taken',
  // A short vibration with each press (R4), where the phone can.
  haptics: true,
  // Typing a card's name (or any text field) with the phone's keyboard plays the keypad's sounds.
  typing: true,
};
