// A reload opens on the state this tab saw a moment ago (logic/boot-cache.ts), never the before-the-night screen.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { emptyPublicState } from '../../../../player/feed/public.ts';
import { BOOT_STATE_MAX_AGE_MS, bootKey, loadBootState, saveBootState } from '../../../../player/logic/boot-cache.ts';
import { MemoryStorage } from '../../../../player/logic/storage.ts';

const T = 1_700_000_000_000;
const playing = { ...emptyPublicState('26'), gameId: 'g', scene: 'play' as const };

test('a saved state comes back on a reload within five minutes, for the same edition only', () => {
  const store = new MemoryStorage();
  saveBootState(store, '26', playing, T);
  assert.deepEqual(loadBootState(store, '26', T + 1000), playing);
  assert.deepEqual(loadBootState(store, '26', T + BOOT_STATE_MAX_AGE_MS), playing, 'the edge counts');
  assert.equal(loadBootState(store, '27', T + 1000), null, 'another edition waits for the feed');
});

test('a stale, broken or missing copy opens nothing, and a stale or broken one is removed', () => {
  const store = new MemoryStorage();
  assert.equal(loadBootState(store, '26', T), null);
  saveBootState(store, '26', playing, T);
  assert.equal(loadBootState(store, '26', T + BOOT_STATE_MAX_AGE_MS + 1), null, 'older than five minutes');
  assert.equal(store.getItem(bootKey('26')), null);
  store.setItem(bootKey('26'), '{not json');
  assert.equal(loadBootState(store, '26', T), null);
  store.setItem(bootKey('26'), JSON.stringify({ edition: '26', savedAtMs: T, state: { nope: true } }));
  assert.equal(loadBootState(store, '26', T), null, 'not a state');
  assert.equal(store.getItem(bootKey('26')), null);
  saveBootState(store, '26', playing, T + 10_000);
  assert.equal(loadBootState(store, '26', T), null, 'saved in the future: a clock change, not trusted');
});

test('no store (privacy mode, a demo) or a full one: nothing saved, nothing thrown', () => {
  saveBootState(null, '26', playing, T);
  assert.equal(loadBootState(null, '26', T), null);
  const full = { getItem: () => null, setItem: () => { throw new Error('QuotaExceededError'); }, removeItem: () => {} };
  assert.doesNotThrow(() => saveBootState(full, '26', playing, T));
});
