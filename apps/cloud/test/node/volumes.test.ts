// The volume sliders a fresh Game starts with (D139): the journal's newest go into the plan; nothing else moves them.
import test from 'node:test';
import assert from 'node:assert/strict';
import type { GamePlan } from '@quina/protocol';
import { journalledVolumes, keepingVolumes, withVolumes } from '../../src/domain/volumes.ts';
import { JournalBuilder } from '../support/journal-builder.ts';
import { PLAN } from '../support/plan.ts';

test('the newest volumes an upload journals, with when; only the keys the protocol knows', () => {
  const b = new JournalBuilder('g-volumes').settings().startRound().land(2);
  assert.equal(journalledVolumes(b.entries), null, 'no slider moved, no plan volumes: nothing to fold');
  b.settings({ volumes: { master: 80 } }).land(1).settings({ volumes: { master: 70, songs: 90, laterSlider: 5 } as never });
  const last = b.entries.at(-1);
  assert.deepEqual(journalledVolumes(b.entries), { volumes: { master: 70, songs: 90 }, atMs: last?.atMs });
  // A round started after carries the same settings: still the newest.
  b.startRound();
  assert.deepEqual(journalledVolumes(b.entries)?.volumes, { master: 70, songs: 90 });
});

test('folding into the plan merges, in the protocol order, and says when nothing changes', () => {
  const plan: GamePlan = { ...PLAN, volumes: { songs: 90, pausa: 60 } };
  const folded = withVolumes(plan, { pausa: 50, master: 80 });
  assert.deepEqual(folded?.volumes, { master: 80, songs: 90, pausa: 50 });
  assert.deepEqual(Object.keys(folded?.volumes ?? {}), ['master', 'songs', 'pausa']);
  assert.equal(withVolumes(plan, { pausa: 60 }), null, 'the same volumes: nothing to save');
  assert.deepEqual(withVolumes(PLAN, { end: 0 })?.volumes, { end: 0 }, 'a plan with none yet');
});

test("a plan saved from Admin or the laptop keeps the cloud's volumes: only the sliders move them", () => {
  const current: GamePlan = { ...PLAN, volumes: { master: 80 } };
  assert.deepEqual(keepingVolumes({ ...PLAN, title: 'Nou', volumes: { master: 20 } }, current), { ...PLAN, title: 'Nou', volumes: { master: 80 } });
  assert.deepEqual(keepingVolumes({ ...PLAN, title: 'Nou' }, current).volumes, { master: 80 }, 'an editor that drops the field loses nothing');
  assert.equal('volumes' in keepingVolumes({ ...PLAN, volumes: { master: 20 } }, PLAN), false, 'none in the cloud: none');
  assert.equal('volumes' in keepingVolumes({ ...PLAN, volumes: { master: 20 } }, null), false, 'no plan yet: none');
});
