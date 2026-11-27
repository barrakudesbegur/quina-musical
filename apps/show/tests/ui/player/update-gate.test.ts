// The app reloads into a new version by itself (D222), but never mid-tap or mid-typing: logic/update-gate.ts.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { PLAYER_CONFIG } from '../../../../player/config.ts';
import { checkDue, isNewVersion, reloadVerdict, type ReloadMoment } from '../../../../player/logic/update-gate.ts';
import { servedAtRoot } from '../../../../player/device/updates.ts';

const QUIET = PLAYER_CONFIG.update.quietMs;
const idle: ReloadMoment = { hidden: false, drawers: 0, padTyping: false, pressing: false, editing: false, bigMoment: false, sinceInputMs: QUIET };

test('a quiet home screen reloads into the new version', () => {
  assert.equal(reloadVerdict(idle, QUIET), 'now');
});

test('never mid-tap, mid-typing, with a drawer open or a text field in use, even in the background', () => {
  for (const busy of [{ pressing: true }, { padTyping: true }, { drawers: 1 }, { drawers: 3 }, { editing: true }] satisfies Partial<ReloadMoment>[]) {
    assert.equal(reloadVerdict({ ...idle, ...busy }, QUIET), 'wait', JSON.stringify(busy));
    assert.equal(reloadVerdict({ ...idle, ...busy, hidden: true, sinceInputMs: 3_600_000 }, QUIET), 'wait', `hidden ${JSON.stringify(busy)}`);
  }
});

test('waits for a few quiet seconds after the last touch, key or scroll', () => {
  assert.equal(reloadVerdict({ ...idle, sinceInputMs: 0 }, QUIET), 'wait');
  assert.equal(reloadVerdict({ ...idle, sinceInputMs: QUIET - 1 }, QUIET), 'wait');
  assert.equal(reloadVerdict({ ...idle, sinceInputMs: QUIET }, QUIET), 'now');
});

test('not during a Celebration or the your-song moment, unless the phone is in the background', () => {
  assert.equal(reloadVerdict({ ...idle, bigMoment: true, sinceInputMs: 60_000 }, QUIET), 'wait');
  assert.equal(reloadVerdict({ ...idle, bigMoment: true, hidden: true }, QUIET), 'now');
});

test('in the background, with nothing open, it reloads at once (no quiet wait)', () => {
  assert.equal(reloadVerdict({ ...idle, hidden: true, sinceInputMs: 0 }, QUIET), 'now');
});

test('the first worker taking control is not a new version; a later change of worker is', () => {
  assert.equal(isNewVersion(false), false);
  assert.equal(isNewVersion(true), true);
});

test('update checks: at most one per gap, whatever asks', () => {
  const gap = PLAYER_CONFIG.update.minCheckGapMs;
  assert.ok(checkDue(null, 0, gap));
  assert.ok(!checkDue(1000, 1000 + gap - 1, gap));
  assert.ok(checkDue(1000, 1000 + gap, gap));
});

test('the worker only where the cloud serves the app, at the root (never the laptop’s /player/ pages)', () => {
  assert.ok(servedAtRoot('/'));
  assert.ok(servedAtRoot('/26/123'));
  assert.ok(!servedAtRoot('/player/'));
  assert.ok(!servedAtRoot('/player/index.html'));
});
