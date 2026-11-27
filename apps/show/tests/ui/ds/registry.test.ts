// The domain layer's registry (components-v2.md § 11.1; D210): the shared concepts (packages/ui/concepts.ts) and each
// app's presets (apps/console/actions.ts, apps/player/actions.ts) only name what exists, read well and never collide:
// - every preset has words (colour is never alone) and a palette a Button takes;
// - its icon is a drawing the app's icon set has; its sound a class the app's sprite has;
// - every note on its fill reads at 4.5:1 or better (D2's table), from the CSS's own values;
// - no two controls on one screen share a Wii key;
// - asDefault adds the orange ring and the A key, and never stacks a ring on a cue's.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CONCEPTS } from '../../../../../packages/ui/concepts.ts';
import { PALETTE_COLORS } from '../../../../../packages/ui/components/types.ts';
import { SPRITES } from '../../../../../packages/ui/sounds/sprites.ts';
import { LINE_ICONS } from '../../../../../packages/ui/icons/line.ts';
import { ACTIONS, SCREENS, WII, asDefault, type ConsolePreset } from '../../../../console/actions.ts';
import { wiiBadgeButton } from '../../../../console/logic/wii-keys.ts';
import { PLAYER, confirmColors, type PlayerPreset } from '../../../../player/actions.ts';
import { contrast, fillAndText, paletteBlock } from './palette.ts';

const BUTTON_COLORS = ['orange', 'red', 'green', 'gold', 'cyan', 'purple', 'pink', 'navy', 'grey'];
const drawn = (icon: string) => icon in LINE_ICONS;

const entries = <T>(table: Record<string, T>) => Object.entries(table) as [string, T][];

test('every palette a component can name has its slots', () => {
  for (const color of PALETTE_COLORS) {
    const block = paletteBlock(color);
    assert.ok(block, `no data-color block for ${color}`);
    assert.ok(fillAndText(color).fill, `${color} has no fill that resolves to a colour`);
  }
});

test('the shared concepts have words and a palette colour', () => {
  for (const [id, look] of entries(CONCEPTS)) {
    assert.ok(look.label.trim().length > 0, `${id} has no label`);
    assert.ok((PALETTE_COLORS as readonly string[]).includes(look.color), `${id}: ${look.color} is not a palette`);
    if (look.icon) assert.ok(drawn(look.icon), `${id}: no drawing ${look.icon}`);
  }
});

test("the console's presets: words, a Button's palette, a drawing the family has, a sound its sprite has", () => {
  const sounds = Object.keys(SPRITES.console.classes);
  for (const [id, preset] of entries<ConsolePreset>(ACTIONS)) {
    assert.ok(preset.label && preset.label.trim().length > 0, `${id} has no label`);
    assert.ok(BUTTON_COLORS.includes(preset.color), `${id}: ${preset.color} is not a Button colour`);
    if (preset.icon) assert.ok(drawn(preset.icon), `${id}: no drawing ${preset.icon}`);
    if (preset.level2) assert.ok(drawn(preset.level2.icon), `${id}: no drawing ${preset.level2.icon}`);
    if (preset.sound) assert.ok(sounds.includes(preset.sound), `${id}: the console has no ${preset.sound} sound`);
  }
});

test("the phone's presets: words, a Button's palette, a drawing the family has, a sound its sprite has", () => {
  const sounds = Object.keys(SPRITES.player.classes);
  for (const [id, preset] of entries<PlayerPreset>(PLAYER)) {
    assert.ok(preset.label && preset.label.trim().length > 0, `${id} has no label`);
    assert.ok(BUTTON_COLORS.includes(preset.color), `${id}: ${preset.color} is not a Button colour`);
    if (preset.icon) assert.ok(drawn(preset.icon), `${id}: no drawing ${preset.icon}`);
    if (preset.sound) assert.ok(sounds.includes(preset.sound), `${id}: the phone has no ${preset.sound} sound`);
  }
  for (const danger of [true, false]) {
    const { yes, no } = confirmColors(danger);
    assert.notEqual(yes, no, 'a confirmation shows two different answers');
  }
});

test('every note reads on its fill at 4.5:1 or better (D2)', () => {
  for (const [id, preset] of [...entries<ConsolePreset>(ACTIONS), ...entries<PlayerPreset>(PLAYER)]) {
    if (!preset.note || (preset.variant && preset.variant !== 'solid')) continue;
    const { fill, text } = fillAndText(preset.color);
    assert.ok(fill && text, `${id}: ${preset.color} doesn't resolve`);
    const ratio = contrast(fill, text);
    assert.ok(ratio >= 4.5, `${id}: its note on ${preset.color} reads at ${ratio.toFixed(2)}:1`);
  }
});

test('no two controls on one screen share a Wii key', () => {
  for (const [screen, ids] of entries<readonly (keyof typeof ACTIONS)[]>(SCREENS)) {
    const seen = new Map<string, string>();
    for (const id of ids) {
      const preset: ConsolePreset = ACTIONS[id];
      if (!preset.wii) continue;
      const key = [...preset.wii.keys].sort().join('+');
      assert.ok(!seen.has(key), `${screen}: ${id} and ${seen.get(key)} both show ${key}`);
      seen.set(key, id);
      assert.ok(wiiBadgeButton(preset.wii.keys), `${id}: the badge can't draw ${key}`);
    }
  }
});

test('asDefault: the A key and the orange ring, never on top of a cue ring', () => {
  assert.equal(asDefault(ACTIONS.next, false), ACTIONS.next);
  const next = asDefault(ACTIONS.next, true);
  assert.equal(next.ring, 'orange');
  assert.deepEqual(next.wii, WII.a);
  assert.equal(asDefault(ACTIONS.checkCelebrate, true).ring, 'gold');
  assert.equal(asDefault(ACTIONS.checkFail, true).ring, 'red');
});

test("the Wii keys map to the console's badges", () => {
  assert.equal(wiiBadgeButton(['plus', 'minus']), 'talk');
  assert.equal(wiiBadgeButton(['one', 'two']), 'back');
  assert.equal(wiiBadgeButton(['a']), 'a');
  assert.equal(wiiBadgeButton(['up']), 'up');
  assert.equal(wiiBadgeButton(['a', 'b']), null);
});
