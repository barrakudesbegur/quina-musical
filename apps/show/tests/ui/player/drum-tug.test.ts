// The drum's tug (D220; §8 Y1: on the projector's geometry): a stiff wobble of at most 14 px at the front tile that never
// brings a tile into view.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MASK_EDGE, TUG, drumRadius, tugAxis, tugLimit, tugTurn, visibleTiles, type DrumGeometry } from '../../../../player/logic/drum-tug.ts';

const geometry = (tiles: number, widthPx = 390): DrumGeometry => ({ tiles, tilePx: 120, gap: 0.08, perspectiveTiles: 5, widthPx });

test("the projector's radius: a tile for a few, then the ring's from the tile count with an 8 % gap", () => {
  assert.equal(drumRadius(geometry(3)), 120);
  assert.ok(Math.abs(drumRadius(geometry(69)) - (120 * 1.08) / (2 * Math.tan(Math.PI / 69))) < 1e-9);
});

test('what shows at rest: the front tile and its neighbours, never a turned-away face or one past the mask', () => {
  assert.deepEqual(visibleTiles(geometry(69, 358), 0), [-1, 0, 1]);
  assert.deepEqual(visibleTiles(geometry(10), 0), [-2, -1, 0, 1, 2], 'a small cylinder: its back faces hide');
  assert.deepEqual(visibleTiles(geometry(1), 0), [0]);
  assert.ok(MASK_EDGE > 0 && MASK_EDGE < 0.1);
});

test('the tug reveals nothing: at its most, the same tiles show as at rest (any tile count, any phone width)', () => {
  for (const tiles of [1, 2, 3, 4, 5, 7, 10, 20, 40, 69, 77]) {
    for (const widthPx of [320, 358, 390, 430]) {
      const g: DrumGeometry = { tiles, tilePx: 120, gap: 0.08, perspectiveTiles: 5, widthPx };
      const rest = visibleTiles(g, 0);
      const limit = tugLimit(g);
      for (const turn of [-limit, limit, tugTurn(400, g), tugTurn(-400, g)]) {
        assert.ok(visibleTiles(g, turn).every((k) => rest.includes(k)), `${tiles} tiles, ${widthPx} px, turn ${turn}`);
      }
      const R = drumRadius(g);
      const most = (Math.asin(TUG.maxPx / R) * tiles) / (2 * Math.PI);
      assert.ok(Math.abs(tugTurn(10_000, g)) <= most + 1e-9, 'never more than the design\'s 14 px at the front tile');
    }
  }
  const g: DrumGeometry = { tiles: 69, tilePx: 120, gap: 0.08, perspectiveTiles: 5, widthPx: 390 };
  assert.ok(tugTurn(60, g) < 0 && tugTurn(-60, g) > 0, 'the tiles follow the finger');
  assert.equal(tugTurn(0, g), 0);
  assert.equal(tugAxis(3, 4), null);
  assert.equal(tugAxis(20, 4), 'x');
  assert.equal(tugAxis(4, 20), 'y');
});

test('stiff: a small drag barely moves it, more drag a little more', () => {
  const g = geometry(69);
  assert.ok(Math.abs(tugTurn(20, g)) < Math.abs(tugTurn(200, g)));
  assert.ok(Math.abs(tugTurn(20, g)) * ((2 * Math.PI * drumRadius(g)) / 69) < 5, 'under 5 px at the front for a 20 px drag');
  assert.equal(TUG.maxPx, 14);
});
