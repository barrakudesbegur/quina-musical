// The drum's motion as the stage knows it: timestamps only.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { breathPeriodMs, motionAt, motionView, pruneSpinNote, type SpinNote } from '../../../stage/model/motion.ts';

const spinNote: SpinNote = { id: 'tr-1', spinStartAtMs: 1000, landAtMs: 8000, autoReleaseAtMs: null };
const transition = { id: 'tr-1', recipe: 'R7' as const, phase: 'late' as const, to: 74, landAtMs: 8000 };

test('a Spin runs from its start to its landing', () => {
  const m = motionView({ transition, suspense: null }, spinNote);
  assert.deepEqual(m, { kind: 'spin', startAtMs: 1000, landAtMs: 8000, sinceMs: null, autoReleaseAtMs: null });
  assert.ok(!('to' in (m ?? {})));
  assert.equal(motionAt(m, 999), 'idle');
  assert.equal(motionAt(m, 1000), 'spin');
  assert.equal(motionAt(m, 7999), 'spin');
  assert.equal(motionAt(m, 8000), 'idle');
});

test('a late join (snapshot only) is already spinning', () => {
  const m = motionView({ transition, suspense: null }, null);
  assert.equal(m?.startAtMs, null);
  assert.equal(motionAt(m, 0), 'spin');
});

test('a Suspense is open until released', () => {
  const suspense = { id: 'tr-2', sinceMs: 1000, autoReleaseAtMs: 31000 };
  const m = motionView({ transition: null, suspense }, null);
  assert.equal(motionAt(m, 20000), 'suspense');
  assert.equal(breathPeriodMs(m, 1000, { slowMs: 1600, fastMs: 800 }), 1600);
  assert.equal(breathPeriodMs(m, 16000, { slowMs: 1600, fastMs: 800 }), 1200);
  assert.equal(breathPeriodMs(m, 99999, { slowMs: 1600, fastMs: 800 }), 800);
});

test('the event before its snapshot is enough', () => {
  const m = motionView({ transition: null, suspense: null }, { id: 's', spinStartAtMs: 500, landAtMs: null, autoReleaseAtMs: 30500 });
  assert.equal(m?.kind, 'suspense');
  assert.equal(motionAt(m, 600), 'suspense');
});

test('the note lives only while its transition runs', () => {
  assert.equal(pruneSpinNote(spinNote, { transition, suspense: null }), spinNote);
  assert.equal(pruneSpinNote(spinNote, { transition: null, suspense: null }), null);
  assert.equal(pruneSpinNote(spinNote, { transition: { ...transition, id: 'tr-9' }, suspense: null }), null);
});
