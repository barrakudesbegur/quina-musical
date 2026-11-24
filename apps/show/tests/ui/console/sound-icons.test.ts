// The sound pad shows icons only (the user's decision, 2026-11-24), so every sound needs one, every effect its
// LED colour, and every tone a shape uses must have its token rule in console.css.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { SFX_NAMES, SOUND_NAMES, STINGER_NAMES } from '@quina/protocol';
import { SOUND_ICONS } from '../../../../console/sound-icons.ts';
import { soundText } from '../../../../console/strings.ts';

const css = readFileSync(new URL('../../../../console/console.css', import.meta.url), 'utf8');

test('every sound has an icon and a spoken name', () => {
  for (const name of SOUND_NAMES) {
    assert.ok(SOUND_ICONS[name]?.shapes.length > 0, `no icon for ${name}`);
    assert.ok(soundText(name).trim().length > 0, `no name for ${name}`);
  }
  assert.deepEqual(Object.keys(SOUND_ICONS).sort(), [...SOUND_NAMES].sort(), 'no icon for a sound that does not exist');
});

test('each effect has its LED colour; the fanfares have none', () => {
  for (const name of SFX_NAMES) assert.ok(SOUND_ICONS[name].led, `no LED for ${name}`);
  for (const name of STINGER_NAMES) assert.equal(SOUND_ICONS[name].led, null);
});

test('every tone an icon uses is styled from a token', () => {
  for (const { led, shapes } of Object.values(SOUND_ICONS)) {
    if (led) assert.ok(css.includes(`.pad[data-led='${led}']`), `no LED rule for ${led}`);
    for (const s of shapes) {
      assert.ok(css.includes(`.sound-icon__fill-${s.fill ?? 'none'}`), `no fill rule for ${s.fill}`);
      assert.ok(css.includes(`.sound-icon__stroke-${s.stroke ?? 'none'}`), `no stroke rule for ${s.stroke}`);
    }
  }
});
