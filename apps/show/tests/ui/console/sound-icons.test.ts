// The sound pad shows icons only (the user's decision, 2026-11-24), so every sound needs one, and every tone a shape
// uses must have its token rule in console.css, named as the palette (D210). No LED strip any more (D-l).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { SOUND_NAMES } from '@quina/protocol';
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

test('every tone an icon uses is styled from a token', () => {
  for (const { shapes } of Object.values(SOUND_ICONS)) {
    for (const s of shapes) {
      assert.ok(css.includes(`.sound-icon__fill-${s.fill ?? 'none'}`), `no fill rule for ${s.fill}`);
      assert.ok(css.includes(`.sound-icon__stroke-${s.stroke ?? 'none'}`), `no stroke rule for ${s.stroke}`);
    }
  }
});

test('the tones are named as the palette, never the old ice or lilac', () => {
  for (const { shapes } of Object.values(SOUND_ICONS)) {
    for (const s of shapes) for (const tone of [s.fill, s.stroke]) assert.ok(!tone || !/ice|lilac|lemon/i.test(tone), `old tone name ${tone}`);
  }
});
