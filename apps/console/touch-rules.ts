// Which touch sound each of the tablet's controls makes (ANIMATIONS.md › Console sounds). The first rule an element
// matches wins, so the specific ones come first; any other button is a small one. Silent: the Efectes pads (their
// effect plays on the PA) and the volume sliders (not buttons). The hold buttons play their own (holdSounds), and
// the pads' «+ Un altre» and ↵ play the chip's sound once the number is in (or refused).
import type { TouchWiring } from '../../packages/ui/sounds/delegate.ts';

export const CONSOLE_TOUCH: TouchWiring = {
  rules: [
    { selector: '.pad, .long-press, .two-level, .throw-button, .claim-pad__add, .pad-key--enter', cls: () => null },
    { selector: '.switch', cls: (el) => (el.getAttribute('aria-checked') === 'true' ? 'switchOff' : 'switchOn') },
    { selector: '.pad-key--back', cls: 'backspace' },
    { selector: '.pad-key', cls: 'digit' },
    { selector: '.claim-pad__submit', cls: 'submit' },
    { selector: '.claim-chip__remove, .finale-stage__remove', cls: 'chipRemove' },
    { selector: '.tabs__tab, .segmented__option', cls: 'tab' },
    { selector: '.big-button, .action', cls: 'big' },
    { selector: 'button, [role="button"]', cls: 'small' },
  ],
  // The lists people scroll: a control in them sounds at its click.
  scrollers: '.tabs__panel, .menu-sheet__body',
};
