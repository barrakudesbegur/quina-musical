// The icon registry's drawings that layer one part behind another (packages/ui/icons/line.ts `behind`, D245) and the
// throw songs' icons: a part behind always has parts in front to cut it, the swords mirror each other, and the
// concepts name the drawings the console's buttons draw.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CONCEPTS } from '../../../../../packages/ui/concepts.ts';
import { LINE_ICONS, isBehind, pathOf, type IconPath } from '../../../../../packages/ui/icons/line.ts';
import { ACTIONS } from '../../../../console/actions.ts';

const entries = Object.entries(LINE_ICONS) as [string, readonly IconPath[]][];
/** A path's corners (M and L), or a circle's centre (line.ts's circle(): M at its left point, then two arcs). */
function points(d: string): (readonly [number, number])[] {
  const pts = [...d.matchAll(/[ML]\s*(-?\d*\.?\d+)\s+(-?\d*\.?\d+)/g)].map(([, x, y]) => [Number(x), Number(y)] as const);
  const arc = /a\s*(-?\d*\.?\d+)/.exec(d);
  return arc ? [[pts[0][0] + Number(arc[1]), pts[0][1]]] : pts;
}

test('a drawing with parts behind has parts in front that cut them', () => {
  for (const [name, parts] of entries) {
    if (!parts.some(isBehind)) continue;
    assert.ok(parts.some((p) => !isBehind(p)), `${name}: every part is behind, nothing cuts them`);
  }
});

test('the crossed swords: the back one is the front one mirrored, and only the back one is cut', () => {
  const parts = LINE_ICONS['crossed-swords'] as readonly IconPath[];
  const back = parts.filter(isBehind).map(pathOf);
  const front = parts.filter((p) => !isBehind(p)).map(pathOf);
  assert.equal(back.length, front.length);
  front.forEach((d, i) => {
    const mirrored = points(d).map(([x, y]) => [+(24 - x).toFixed(2), y]);
    assert.deepEqual(points(back[i]).map(([x, y]) => [+x.toFixed(2), y]), mirrored, `part ${i} is not the mirror image`);
  });
});

test('the throw songs show their line icons, the same in the concepts and the console presets', () => {
  assert.equal(CONCEPTS.throw.icon, 'crossed-swords');
  assert.equal(CONCEPTS.storm.icon, 'cloud-corn');
  assert.equal(ACTIONS.throw.icon, CONCEPTS.throw.icon);
  assert.equal(ACTIONS.storm.icon, CONCEPTS.storm.icon);
});
