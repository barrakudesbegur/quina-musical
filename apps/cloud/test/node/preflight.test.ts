// The preflight's verdicts, from facts shaped like the real ones (macOS tools, the pool's files, the link's status).
import test from 'node:test';
import assert from 'node:assert/strict';
import * as c from '../../laptop/preflight/checks.ts';

const device = (name: string, transport: string, extra: Record<string, string> = {}) => ({
  SPAudioDataType: [{ _items: [{ _name: 'MacBook Pro Microphone', coreaudio_device_transport: 'coreaudio_device_type_builtin' }, { _name: name, coreaudio_default_audio_output_device: 'spaudio_yes', coreaudio_device_transport: `coreaudio_device_type_${transport}`, ...extra }] }],
});

test('audio output: wireless fails (its delay breaks the landings), the laptop speakers warn, a wire passes', () => {
  assert.equal(c.audioOutputCheck(device('AirPods', 'bluetooth')).status, 'fail');
  assert.equal(c.audioOutputCheck(device('Living room', 'airplay')).status, 'fail');
  assert.equal(c.audioOutputCheck(device('MacBook Pro Speakers', 'builtin', { coreaudio_output_source: 'MacBook Pro Speakers' })).status, 'warn');
  assert.equal(c.audioOutputCheck(device('MacBook Pro Speakers', 'builtin', { coreaudio_output_source: 'External Headphones' })).status, 'warn', 'the name still says speakers');
  assert.equal(c.audioOutputCheck(device('External Headphones', 'builtin')).status, 'pass');
  assert.equal(c.audioOutputCheck(device('Scarlett 2i2', 'usb')).status, 'pass');
  assert.equal(c.audioOutputCheck(device('LG TV', 'hdmi')).status, 'pass');
  assert.equal(c.audioOutputCheck(device('BlackHole', 'virtual')).status, 'warn');
  assert.equal(c.audioOutputCheck({ SPAudioDataType: [] }).status, 'fail');
  assert.equal(c.audioOutputCheck(null).status, 'fail');
});

test('sleep: never, or prevented right now, passes; otherwise the show would stop: fail', () => {
  const prevented = ' sleep                1 (sleep prevented by caffeinate)\n displaysleep         2 (display sleep prevented by CaffeineMate)\n';
  assert.deepEqual(c.sleepChecks(prevented, '').map((x) => x.status), ['pass', 'pass']);
  assert.deepEqual(c.sleepChecks(' sleep 0\n displaysleep 0\n', '').map((x) => x.status), ['pass', 'pass']);
  assert.deepEqual(c.sleepChecks(' sleep 10\n displaysleep 5\n', '').map((x) => x.status), ['fail', 'fail']);
  assert.deepEqual(c.sleepChecks(' sleep 10\n displaysleep 5\n', '   PreventUserIdleDisplaySleep    1\n   PreventUserIdleSystemSleep     1\n').map((x) => x.status), ['pass', 'pass']);
  assert.deepEqual(c.sleepChecks(' sleep 10\n displaysleep 5\n', '   PreventUserIdleDisplaySleep    0\n   PreventUserIdleSystemSleep     1\n').map((x) => x.status), ['pass', 'fail']);
});

test('power, disk and the browser', () => {
  assert.equal(c.powerCheck("Now drawing from 'AC Power'\n").status, 'pass');
  assert.match(c.powerCheck("Now drawing from 'Battery Power'\n -InternalBattery-0 (id=1)\t97%; discharging").detail, /97%/);
  assert.equal(c.diskCheck(0.5e9).status, 'fail');
  assert.equal(c.diskCheck(3e9).status, 'warn');
  assert.equal(c.diskCheck(50e9).status, 'pass');
  const chrome = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
  const flags = '--disable-background-timer-throttling --disable-renderer-backgrounding --disable-backgrounding-occluded-windows';
  assert.equal(c.browserCheck([`${chrome} --user-data-dir=/tmp/quina-show --autoplay-policy=no-user-gesture-required ${flags} --kiosk http://localhost:5174/show/?autostart=1`]).status, 'pass');
  // Without the throttling flags a covered window stalls the show: fail.
  assert.equal(c.browserCheck([`${chrome} --user-data-dir=/tmp/quina-show --autoplay-policy=no-user-gesture-required --kiosk http://localhost:5174/show/`]).status, 'fail');
  assert.equal(c.browserCheck([`${chrome} --user-data-dir=/tmp/quina-show --autoplay-policy=no-user-gesture-required --disable-background-timer-throttling --kiosk http://localhost:5174/show/`]).status, 'fail');
  // The flags but no autoplay: the page waits for a click.
  assert.equal(c.browserCheck([`${chrome} --user-data-dir=/tmp/quina-show ${flags} --kiosk http://localhost:5174/show/`]).status, 'warn');
  // Only someone's everyday Chrome: not the show's.
  assert.equal(c.browserCheck([`${chrome} --profile-directory=Default`]).status, 'warn');
  assert.equal(c.browserCheck([chrome, `${chrome} Helper (Renderer) --type=renderer`]).status, 'warn');
  assert.equal(c.browserCheck(['/usr/bin/zsh']).status, 'warn');
});

test('cards: every song on a card must be in the pool and playable, or that card can never be completed', () => {
  const line = (...ids: number[]) => ids.map((id) => ({ id }));
  const card = (id: number, ids: number[], type = 'normal') => ({ id, type, lines: [line(...ids.slice(0, 4)), line(...ids.slice(4, 8)), line(...ids.slice(8, 12))] });
  const pool = new Set(Array.from({ length: 20 }, (_, i) => i + 1));
  const ids = Array.from({ length: 12 }, (_, i) => i + 1);
  assert.equal(c.cardsCheck([card(1, ids), card(2, ids, 'special')], pool, pool).status, 'pass');
  assert.match(c.cardsCheck([card(1, ids)], pool, new Set([...pool].filter((id) => id !== 5))).detail, /can't play.*5/);
  assert.match(c.cardsCheck([card(1, [...ids.slice(0, 11), 99])], pool, pool).detail, /99, not in the pool/);
  assert.match(c.cardsCheck([card(1, ids), card(1, ids)], pool, pool).detail, /twice/);
  assert.match(c.cardsCheck([{ id: 3, type: 'normal', lines: [line(1, 2, 3)] }], pool, pool).detail, /3 lines of 4/);
  assert.equal(c.cardsCheck([], pool, pool).status, 'fail');
});

test('songs, sounds and media files', () => {
  const pool = new Set([1, 2, 3]);
  assert.equal(c.songsCheck(pool, pool, []).status, 'pass');
  assert.equal(c.songsCheck(pool, new Set([1, 2]), []).status, 'warn');
  assert.equal(c.songsCheck(pool, pool, [2]).status, 'fail');
  assert.equal(c.songsCheck(pool, new Set(), []).status, 'fail');
  assert.deepEqual(c.soundsCheck([], 4, []).map((x) => x.status), ['pass', 'pass']);
  assert.deepEqual(c.soundsCheck(['mkwii-mission-clear'], 4, ['windows-error-remix']).map((x) => x.status), ['fail', 'fail']);
  const reference = { source: 'the cloud', files: { 'cache/1/mix.flac': { size: 3, sha256: 'a'.repeat(64) }, 'covers/1.jpg': { size: 1, sha256: 'b'.repeat(64) } } };
  const same = new Map(Object.entries(reference.files));
  assert.equal(c.mediaCheck(reference, same, true).status, 'pass');
  assert.equal(c.mediaCheck(reference, new Map([...same].slice(0, 1)), true).status, 'fail', 'a missing file');
  assert.equal(c.mediaCheck(reference, new Map([...same, ['covers/1.jpg', { size: 1, sha256: 'c'.repeat(64) }]]), true).status, 'fail', 'a changed file');
  assert.equal(c.mediaCheck(null, same, true).status, 'warn');
});

test('the relay, the LAN and the cloud', () => {
  assert.equal(c.relayCheck('default', { ok: true, name: 'default' }).status, 'pass');
  assert.equal(c.relayCheck('2026', { ok: true, name: 'default' }).status, 'fail', 'the wrong pool');
  assert.equal(c.relayCheck('default', { ok: false, error: 'ECONNREFUSED' }).status, 'fail');
  assert.equal(c.showPageCheck([{ role: 'show' }, { role: 'tablet' }]).status, 'pass');
  assert.equal(c.showPageCheck([{ role: 'tablet' }]).status, 'warn');
  assert.equal(c.lanCheck(null, false).status, 'warn');
  assert.equal(c.lanCheck('http://192.168.1.2:5174/console/', false).status, 'fail');
  assert.equal(c.cloudCheck('https://x', { ok: false, error: 'timeout' }, '26').status, 'fail');
  assert.equal(c.cloudCheck('https://x', { ok: true, edition: '25' }, '26').status, 'fail', 'the wrong edition');
  assert.equal(c.cloudAuthCheck({ ok: false, status: 403 }).status, 'fail');
  assert.equal(c.cloudAuthCheck({ ok: true, rttMs: 80, offsetMs: 40 }).status, 'pass');
  assert.equal(c.cloudAuthCheck({ ok: true, rttMs: 80, offsetMs: -3500 }).status, 'warn', 'the laptop clock is off');
});

test('the cloud link and the Game', () => {
  const now = 1_000_000;
  const status: c.LinkStatusFile = { updatedAtMs: now - 3000, cloud: 'online', gameId: 'g1', journalled: 40, ackSeq: 40, pending: 0, uploader: { kind: 'syncing' } };
  assert.equal(c.linkCheck(status, now).status, 'pass');
  assert.equal(c.linkCheck(null, now).status, 'fail');
  assert.equal(c.linkCheck({ ...status, updatedAtMs: now - 120_000 }, now).status, 'fail', 'the link died');
  assert.equal(c.linkCheck({ ...status, uploader: { kind: 'stopped', reason: 'conflict' } }, now).status, 'fail');
  assert.equal(c.linkCheck({ ...status, cloud: 'replaced' }, now).status, 'fail');
  assert.equal(c.linkCheck({ ...status, pending: 3 }, now).status, 'warn');
  assert.equal(c.gameCheck(status, { gameId: 'g1', seq: 40 }, '26').status, 'pass');
  assert.equal(c.gameCheck(status, { gameId: 'rehearsal', seq: 300 }, '26').status, 'warn');
  assert.equal(c.gameCheck(status, null, null).status, 'warn');
  assert.equal(c.exitCode([{ group: 'Pool', name: 'x', status: 'warn', detail: '' }]), 0);
  assert.equal(c.exitCode([{ group: 'Pool', name: 'x', status: 'fail', detail: '' }]), 1);
});
