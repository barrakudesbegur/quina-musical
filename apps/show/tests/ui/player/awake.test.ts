// The screen kept on (§8 Y4): only while a game is live, never before the night or after it.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { emptyPublicState, type PublicState } from '../../../../player/feed/public.ts';
import { gameLive } from '../../../../player/logic/awake.ts';

const at = (scene: PublicState['scene']): PublicState => ({ ...emptyPublicState('26'), gameId: 'g', scene });

test('the screen is kept on only while a game is live (§8 Y4)', () => {
  for (const scene of ['roundStart', 'play', 'check', 'celebration', 'interval'] as const) assert.equal(gameLive(at(scene)), true, scene);
  for (const scene of ['before', 'after'] as const) assert.equal(gameLive(at(scene)), false, scene);
  assert.equal(gameLive(null), false, 'no state yet');
});
