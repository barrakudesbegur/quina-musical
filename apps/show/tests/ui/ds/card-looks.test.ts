// CardGrid's looks table (packages/ui/components/card-looks.ts) and the marks it paints: a ✗ is the error red
// #E8363D (--color-danger) on every screen, never the button fills' brighter palette red (U175 item 4, D211).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { CELL_LOOKS, cellLook } from '../../../../../packages/ui/components/card-looks.ts';
import { resolve } from './palette.ts';

const UI = new URL('../../../../../packages/ui/', import.meta.url);
const css = (path: string) => readFileSync(new URL(path, UI), 'utf8');
/** The custom property a rule block sets, for the first block whose selector list contains `selector`. */
function blockValue(text: string, selector: string, prop: string): string | null {
  const at = text.indexOf(selector);
  if (at < 0) return null;
  const body = text.slice(text.indexOf('{', at), text.indexOf('}', at));
  return new RegExp(`${prop}:\\s*([^;]+);`).exec(body)?.[1].trim() ?? null;
}

test('✗ marks are the error red #E8363D: the cells’ ring and badge, the type label, the phone’s fallen cells', () => {
  assert.equal(resolve('var(--color-danger)'), '#e8363d');
  const cell = css('components/card-cell.css');
  assert.equal(resolve(blockValue(cell, ".card-cell__badge[data-color='red']", '--palette-solid') ?? ''), '#e8363d');
  assert.equal(resolve(blockValue(cell, ".card-cell__ring[data-color='red']", '--palette-solid') ?? ''), '#e8363d');
  const label = css('components/type-side-label.css');
  assert.equal(resolve(blockValue(label, ".type-side-label[data-ring-color='red']", '--tsl-ring-color') ?? ''), '#e8363d');
  assert.equal(resolve(blockValue(label, ".type-side-label__badge[data-color='red']", '--palette-solid') ?? ''), '#e8363d');
  const player = readFileSync(new URL('../../../../player/player.css', import.meta.url), 'utf8');
  assert.match(player, /--player-cross:\s*var\(--color-danger\);/);
});

test('the looks table: every ✗ is red, every ✓ green, playing orange and running', () => {
  for (const look of [CELL_LOOKS.missed, CELL_LOOKS.upcomingFail]) assert.equal(look.badgeColor, 'red');
  assert.equal(CELL_LOOKS.missed.ring, 'red');
  for (const look of [CELL_LOOKS.landed, CELL_LOOKS.upcomingOk]) assert.equal(look.badgeColor, 'green');
  assert.deepEqual([CELL_LOOKS.playing.ring, CELL_LOOKS.playing.ringStyle, CELL_LOOKS.playing.badge], ['orange', 'running', 'play']);
});

test('the console’s count to the reveal (#78) and the phone’s playing song (#74)', () => {
  assert.equal(cellLook('upcomingOk', { ahead: 1, nextTag: 'Següent' }).tag, 'Següent');
  assert.equal(cellLook('upcomingFail', { ahead: 3 }).tag, '+3');
  assert.equal(cellLook('upcomingOk', { ahead: null }).tag, undefined);
  assert.deepEqual([cellLook('marked', { playing: true }).ring, cellLook('marked', { playing: true }).ringStyle], ['orange', 'running']);
  assert.equal(cellLook('empty', { playing: true }).ring, undefined, 'a song not on the card never runs');
});
