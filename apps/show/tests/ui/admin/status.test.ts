// Admin's header words (logic/status.ts), state by state: the title with no dangling separator, the connection badge
// naming the cloud or the show's laptop, «Desat…» only for a plan that is somewhere, and the load failure in Catalan.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { connBadge, headerTitle, loadFailureText, saveBadge } from '../../../../admin/logic/status.ts';
import type { SaveStatus } from '../../../../admin/state/plan-session.svelte.ts';

test('the header title has no separator without a plan, and says when the plan on screen is not saved', () => {
  assert.equal(headerTitle(null, false), 'Admin');
  assert.equal(headerTitle(undefined, true), 'Admin');
  assert.equal(headerTitle('  ', false), 'Admin');
  assert.equal(headerTitle('Quina Quina 3', false), 'Admin · Quina Quina 3');
  assert.equal(headerTitle('Des d’aquí', true), 'Admin · Des d’aquí (sense desar)');
});

test('the connection badge names what the socket connects to: the cloud, or the show’s laptop', () => {
  const down = { demo: null, connected: false, wasConnected: false, showOnline: false };
  assert.deepEqual(connBadge({ ...down, where: 'cloud' }), { text: 'Connectant amb el núvol…', status: 'error' });
  assert.deepEqual(connBadge({ ...down, where: 'relay' }), { text: 'Connectant amb el portàtil del show…', status: 'error' });
  assert.deepEqual(connBadge({ ...down, wasConnected: true, where: 'cloud' }), { text: 'Sense connexió amb el núvol', status: 'error' });
  assert.deepEqual(connBadge({ ...down, wasConnected: true, where: 'local' }), { text: 'Sense connexió amb el portàtil del show', status: 'error' });
  for (const where of ['cloud', 'relay', 'local'] as const) {
    assert.doesNotMatch(connBadge({ ...down, where }).text, /relay/, 'no "relay" on screen');
  }
  assert.equal(connBadge({ ...down, connected: true, where: 'cloud' }).status, 'warn');
  assert.equal(connBadge({ ...down, connected: true, showOnline: true, where: 'relay' }).text, 'Connectat al show');
});

test('«Desat…» only once a plan is somewhere: with none anywhere, the blank plan says nothing is saved yet', () => {
  const at = (status: SaveStatus, hasSavedPlan: boolean, where: 'cloud' | 'relay' = 'cloud') =>
    saveBadge({ phase: 'ready', status, where, hasSavedPlan, clock: () => '21:05' });
  assert.deepEqual(at({ kind: 'saved', atMs: null }, false), { text: 'Encara no hi ha cap pla desat', status: 'calm' });
  assert.deepEqual(at({ kind: 'saved', atMs: null }, false, 'relay'), { text: 'Encara no hi ha cap pla desat', status: 'calm' });
  assert.deepEqual(at({ kind: 'saved', atMs: null }, true), { text: 'Desat al núvol', status: 'ok' });
  assert.deepEqual(at({ kind: 'saved', atMs: null }, true, 'relay'), { text: 'Desat al portàtil del show', status: 'ok' });
  assert.deepEqual(at({ kind: 'saved', atMs: 1 }, true), { text: 'Desat a les 21:05', status: 'ok' });
  const base = { status: { kind: 'saved', atMs: null } as SaveStatus, where: 'cloud' as const, hasSavedPlan: false, clock: String };
  assert.deepEqual(saveBadge({ ...base, phase: 'loading' }), { text: 'Carregant el pla del núvol…', status: 'calm' });
  assert.deepEqual(saveBadge({ ...base, phase: 'failed' }), { text: "No s'ha pogut carregar el pla", status: 'error' });
});

test('why the plan could not load, in plain Catalan, naming where from', () => {
  assert.equal(loadFailureText({ cause: 'timeout', seconds: 15 }, 'cloud'), 'El núvol no ha respost en 15 segons.');
  assert.equal(loadFailureText({ cause: 'timeout', seconds: 15 }, 'relay'), 'El portàtil del show no ha respost en 15 segons.');
  assert.equal(loadFailureText({ cause: 'answer', detail: 'HTTP 503' }, 'relay'), 'El portàtil del show ha respost amb un error (503).');
  assert.equal(loadFailureText({ cause: 'answer', detail: 'the plan there does not pass the check' }, 'cloud'), 'El pla que hi ha al núvol no passa la comprovació.');
  assert.equal(loadFailureText({ cause: 'answer', detail: 'not a plan answer' }, 'cloud'), 'El núvol no ha respost amb un pla.');
  assert.equal(loadFailureText({ cause: 'answer', detail: 'Failed to fetch' }, 'cloud'), "No s'ha pogut connectar amb el núvol.");
});
