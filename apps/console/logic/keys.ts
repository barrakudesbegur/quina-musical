// The console's keyboard: a fallback controller (docs/event.md: the tech can drive the whole show from the laptop
// alone). One key does what the Wii remote's A does, the default action (the highlighted control), so a plain
// keyboard or a USB presenter clicker, which sends PageDown/PageUp or the arrows, can run the night:
// - → or PageDown: the default action;
// - nothing else. Back, Parlem and the rest stay on screen, because they need a long press or a choice.
// A key typed into a field, a key with a modifier, an auto-repeat, or any key while a dialog is open does nothing,
// so typing a card number or a winner's name never presses Següent. Pure: the event's fields come in.

export type KeyCommand = 'default';

export interface KeyInput {
  key: string;
  repeat: boolean;
  altKey: boolean;
  ctrlKey: boolean;
  metaKey: boolean;
  shiftKey: boolean;
  /** The focused element's tag (lowercase), e.g. 'input'; null when nothing in particular has focus. */
  targetTag: string | null;
  /** The focused element is content-editable. */
  targetEditable: boolean;
  /** A modal dialog (number pad, menu, Wii dialog…) is open. */
  dialogOpen: boolean;
}

const DEFAULT_KEYS = new Set(['ArrowRight', 'PageDown']);
const TYPING_TAGS = new Set(['input', 'textarea', 'select']);

export function keyCommand(k: KeyInput): KeyCommand | null {
  if (k.repeat || k.altKey || k.ctrlKey || k.metaKey || k.shiftKey || k.dialogOpen) return null;
  if (k.targetEditable || (k.targetTag !== null && TYPING_TAGS.has(k.targetTag))) return null;
  return DEFAULT_KEYS.has(k.key) ? 'default' : null;
}
