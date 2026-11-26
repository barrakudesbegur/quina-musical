// The thumb cluster's layout per scene (D138, D155, D194, D195, D199): which buttons show and where.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SHOW_SCENES } from '@quina/protocol';
import { FIXTURES } from '../../../../../packages/ui/fixtures/states.ts';
import { flowOf } from '../../../../../packages/ui/flow.ts';
import { clusterLayout, shownThrowSongs } from '../../../../console/logic/cluster-layout.ts';
import { canSend } from '../../../../console/logic/scene.ts';

const NOW = 1_800_000_000_000;

test('a break: «Comença la quina» is the big button, «Llançament» a slim line on top, no Enrere or Comprovar (D195)', () => {
  assert.deepEqual(clusterLayout('interval', false), { backAndClaim: false, line: 'throw', top: null, big: 'roundIntro' });
  assert.deepEqual(clusterLayout('interval', true), { backAndClaim: false, line: 'throw', top: null, big: 'roundIntro' });
});

test('the end: «Tempesta» alone in the big place, no Throw (D194), no Enrere or Comprovar (D199)', () => {
  assert.deepEqual(clusterLayout('after', false), { backAndClaim: false, line: null, top: null, big: 'storm' });
  assert.deepEqual(clusterLayout('after', true), { backAndClaim: false, line: null, top: null, big: 'storm' });
});

test('before the night: «Llançament» in the big place, with Enrere and Comprovar, until the user settles the doors (U173)', () => {
  assert.deepEqual(clusterLayout('before', false), { backAndClaim: true, line: null, top: null, big: 'throw' });
});

test("«Tempesta» joins the top row in the night's last round, in play and in its Check; never in a Celebration (U138)", () => {
  assert.deepEqual(clusterLayout('play', true), { backAndClaim: true, line: null, top: 'storm', big: 'next' });
  assert.deepEqual(clusterLayout('check', true), { backAndClaim: true, line: null, top: 'storm', big: 'next' });
  assert.deepEqual(clusterLayout('play', false), { backAndClaim: true, line: null, top: null, big: 'next' });
  assert.deepEqual(clusterLayout('check', false), { backAndClaim: true, line: null, top: null, big: 'next' });
  for (const scene of ['roundStart', 'celebration'] as const) assert.deepEqual(clusterLayout(scene, true), { backAndClaim: true, line: null, top: null, big: 'next' }, scene);
});

test('every button shown is one the scene rules allow, and Enrere and Comprovar only go where neither can ever act', () => {
  const cases = { before: 'before', interval: 'interval', afterMusic: 'after', lastRound: 'play', checkLastRound: 'check', play: 'play', celebration: 'celebration' } as const;
  for (const [name, scene] of Object.entries(cases)) {
    const state = FIXTURES[name](NOW).state;
    const flow = flowOf(state);
    assert.equal(flow.scene, scene, name);
    const layout = clusterLayout(flow.scene, state.lastRound);
    const shown = shownThrowSongs(layout);
    for (const song of shown) assert.equal(canSend(song, { state, flow, online: true }), true, `${name}: ${song}`);
    for (const song of ['throw', 'storm'] as const) if (!shown.includes(song)) assert.equal(canSend(song, { state, flow, online: true }), false, `${name}: no ${song}`);
    if (!layout.backAndClaim) {
      assert.equal(canSend('back', { state, flow, online: true }), false, `${name}: Enrere can't act`);
      assert.equal(canSend('claim', { state, flow, online: true }), false, `${name}: Comprovar can't act`);
    }
    if (layout.big === 'roundIntro') assert.equal(canSend('roundIntro', { state, flow, online: true }), true, `${name}: «Comença la quina»`);
  }
  assert.equal(SHOW_SCENES.length, 7, 'a new scene needs its place here');
});

test('a throw song is on screen once at most', () => {
  for (const scene of SHOW_SCENES) {
    for (const last of [false, true]) {
      const shown = shownThrowSongs(clusterLayout(scene, last));
      assert.equal(new Set(shown).size, shown.length, `${scene} ${last}`);
    }
  }
});
