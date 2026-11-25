// The console's keyboard fallback: → or PageDown is the default action, as the Wii remote's A; nothing fires while
// typing, with a modifier, on auto-repeat, or with a dialog open.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { keyCommand, type KeyInput } from '../../../../console/logic/keys.ts';

const key = (k: string, over: Partial<KeyInput> = {}): KeyInput => ({
  key: k, repeat: false, altKey: false, ctrlKey: false, metaKey: false, shiftKey: false, targetTag: null, targetEditable: false, dialogOpen: false, ...over,
});

test('→ and PageDown (a presenter clicker) press the default action; other keys do nothing', () => {
  assert.equal(keyCommand(key('ArrowRight')), 'default');
  assert.equal(keyCommand(key('PageDown')), 'default');
  assert.equal(keyCommand(key('ArrowRight', { targetTag: 'button' })), 'default', 'a focused button is no reason to ignore it');
  for (const other of ['ArrowLeft', 'PageUp', 'Enter', ' ', 'b', 'Escape']) assert.equal(keyCommand(key(other)), null, other);
});

test('never while typing, with a modifier, on auto-repeat or with a dialog open', () => {
  for (const tag of ['input', 'textarea', 'select']) assert.equal(keyCommand(key('ArrowRight', { targetTag: tag })), null, tag);
  assert.equal(keyCommand(key('ArrowRight', { targetEditable: true })), null);
  for (const mod of ['altKey', 'ctrlKey', 'metaKey', 'shiftKey'] as const) assert.equal(keyCommand(key('PageDown', { [mod]: true })), null, mod);
  assert.equal(keyCommand(key('PageDown', { repeat: true })), null, 'a held key fires once');
  assert.equal(keyCommand(key('ArrowRight', { dialogOpen: true })), null, 'the number pad or the menu is open');
});
