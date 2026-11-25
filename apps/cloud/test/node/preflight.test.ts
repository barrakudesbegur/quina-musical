// The preflight's verdicts, from facts shaped like the real ones (macOS tools, the pool's files, the link's status).
import test from 'node:test';
import assert from 'node:assert/strict';
import * as c from '../../laptop/preflight/checks.ts';
import { PLAN } from '../support/plan.ts';

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
  const types = ['normal', 'especial'];
  const both = c.cardsCheck([card(1, ids), card(2, ids, 'especial')], types, pool, pool);
  assert.equal(both.status, 'pass');
  assert.match(both.detail, /2 cards \(1 normal, 1 especial\)/);
  // A type card-types.json doesn't list (here the round kind's spelling, not the printed one) could never play.
  assert.match(c.cardsCheck([card(1, ids), card(2, ids, 'special')], types, pool, pool).detail, /card 2 has type "special", not in card-types.json \(normal, especial\)/);
  // This year's types are whatever apps/cards prints.
  assert.equal(c.cardsCheck([card(1, ids, 'groc')], ['groc'], pool, pool).status, 'pass');
  // Without card-types.json: the default types stand in, and it warns (screens can't name them).
  const untyped = c.cardsCheck([card(1, ids)], null, pool, pool);
  assert.equal(untyped.status, 'warn');
  assert.match(untyped.detail, /no card-types.json/);
  assert.match(c.cardsCheck([card(1, ids)], types, pool, new Set([...pool].filter((id) => id !== 5))).detail, /can't play.*5/);
  assert.match(c.cardsCheck([card(1, [...ids.slice(0, 11), 99])], types, pool, pool).detail, /99, not in the pool/);
  assert.match(c.cardsCheck([card(1, ids), card(1, ids)], types, pool, pool).detail, /twice/);
  assert.match(c.cardsCheck([{ id: 3, type: 'normal', lines: [line(1, 2, 3)] }], types, pool, pool).detail, /3 lines of 4/);
  assert.equal(c.cardsCheck([], types, pool, pool).status, 'fail');
});

test("card-types.json's ids, and the printed cards by type", () => {
  assert.deepEqual(c.cardTypeIds([{ type: 'normal', name: 'Cartró normal' }, { type: 'especial' }]), ['normal', 'especial']);
  assert.equal(c.cardTypeIds(null), null);
  assert.equal(c.cardTypeIds([]), null);
  assert.equal(c.cardTypeIds([{ type: 'Not-An-Id' }]), null);
  assert.deepEqual([...(c.printedByType([{ type: 'normal' }, { type: 'normal' }, { type: 'especial' }]) ?? [])], [['normal', 2], ['especial', 1]]);
});

test("the Game plan: it must pass the protocol's check, and every round's card type must be printed", () => {
  const printed = new Map([['normal', 399], ['especial', 300]]);
  const ok = c.planCheck(PLAN, printed);
  assert.equal(ok.status, 'pass');
  assert.match(ok.detail, /"Quina Musical", 2 rounds \(1 normal, 1 especial\), edition 26/);
  assert.equal(c.planCheck(null, printed).status, 'warn');
  // A round of a type nobody printed could never be won.
  const groc = c.planCheck({ ...PLAN, rounds: PLAN.rounds.map((r) => (r.number === 2 ? { ...r, cardType: 'groc' } : r)) }, printed);
  assert.equal(groc.status, 'fail');
  assert.match(groc.detail, /round 2 plays "groc" cards, but no printed card has that type/);
  // Without cards.json the cards check fails already: the plan isn't held against it.
  assert.equal(c.planCheck(PLAN, null).status, 'pass');
  // A plan the screens would refuse.
  assert.equal(c.planCheck({ ...PLAN, rounds: 'many' }, printed).status, 'fail');
  // An older plan reads as the current one: v2's card types give each round its type.
  const { rounds, ...rest } = PLAN;
  const v2 = { ...rest, v: 2, cardTypes: [], rounds: rounds.map((r) => ({ number: r.number, kind: r.kind, line: r.line, bingo: r.bingo })) };
  assert.equal(c.planCheck(v2, printed).status, 'pass');
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

test('the daily usage: WARN from 60 %, FAIL from 85 %, with the reset time in Catalonia', () => {
  const stats = (shareRequests: number): c.CloudStats => ({
    phonesConnected: 120,
    today: {
      billedRequests: Math.round(shareRequests * 100_000),
      rowsRead: 0,
      rowsWritten: 0,
      phonesPeak: 180,
      limits: { requests: 100_000, rowsRead: 5_000_000, rowsWritten: 100_000 },
      shares: { requests: shareRequests, rowsRead: 0, rowsWritten: 0.01 },
      level: shareRequests >= 0.85 ? 'fail' : shareRequests >= 0.6 ? 'warn' : 'ok',
      resetAtMs: Date.UTC(2026, 11, 21),
    },
    link: { online: true, lastSeenAgoMs: 1000, journalDelayMs: 1200 },
  });
  const night = Date.UTC(2026, 11, 20, 21, 30); // 22:30 in Catalonia
  const ok = c.usageCheck(stats(0.21), night);
  assert.equal(ok.status, 'pass');
  assert.match(ok.detail, /requests 21 % \(21,000 of 100,000\)/);
  assert.match(ok.detail, /120 phones now, 180 at most today; resets at 01:00 \(in 2 h 30 min\)/);
  assert.match(ok.detail, /1\.2 s late/);
  assert.equal(c.usageCheck(stats(0.6), night).status, 'warn');
  assert.equal(c.usageCheck(stats(0.9), night).status, 'fail');
  assert.equal(c.usageCheck(null, night).status, 'warn');
});

test('without the tablet: a console must be open on the laptop, and the LAN address is optional', () => {
  const show = { role: 'show' };
  assert.equal(c.consoleCheck([show, { role: 'tablet' }], true).status, 'pass');
  assert.equal(c.consoleCheck([show], true).status, 'fail');
  assert.equal(c.consoleCheck([show], false).status, 'warn', 'with the tablet, it may just not be open yet');
  assert.equal(c.consoleCheck(null, true).status, 'warn');
  assert.equal(c.lanCheck('http://172.20.10.2:5174/console/', false).status, 'fail');
  assert.equal(c.lanCheck('http://172.20.10.2:5174/console/', false, true).status, 'warn');
});

test('the projector: connected, and never mirroring the laptop when the console is on its screen', () => {
  const display = (name: string, internal: boolean, mirror = false, main = false) => ({
    _name: name,
    spdisplays_connection_type: internal ? 'spdisplays_internal' : 'spdisplays_displayport',
    spdisplays_main: main ? 'spdisplays_yes' : 'spdisplays_no',
    spdisplays_mirror: mirror ? 'spdisplays_on' : 'spdisplays_off',
    spdisplays_online: 'spdisplays_yes',
  });
  const profile = (...ds: object[]) => ({ SPDisplaysDataType: [{ spdisplays_ndrvs: ds }] });
  const separate = c.displaysCheck(profile(display('Color LCD', true, false, true), display('EPSON PJ', false)), true);
  assert.equal(separate.status, 'pass');
  assert.match(separate.detail, /EPSON PJ, a separate display \(main display: Color LCD\)/);
  assert.equal(c.displaysCheck(profile(display('Color LCD', true)), false).status, 'warn', 'no projector yet');
  const mirrored = profile(display('Color LCD', true, true, true), display('EPSON PJ', false, true));
  assert.equal(c.displaysCheck(mirrored, true).status, 'fail', "the console's secrets would be on the projector");
  assert.equal(c.displaysCheck(mirrored, false).status, 'warn');
  assert.equal(c.displaysCheck(null, false).status, 'warn');
});

test('the Wii remote: optional, so it only warns; connected, battery, and when it last dropped', () => {
  const now = 1_800_000_000_000;
  const ok = c.wiiRemoteCheck({ connected: true, battery: 0.8, sinceMs: now - 12 * 60_000 }, now);
  assert.equal(ok.status, 'pass');
  assert.match(ok.detail, /connected for 12 min, battery 80%/);
  assert.equal(c.wiiRemoteCheck({ connected: true, battery: 0.1, sinceMs: now }, now).status, 'warn');
  assert.match(c.wiiRemoteCheck({ connected: false, battery: 0.9, sinceMs: now - 3 * 60_000 }, now).detail, /disconnected 3 min ago.*range/);
  assert.equal(c.wiiRemoteCheck({ connected: true, battery: null, sinceMs: now }, now).status, 'pass');
  assert.equal(c.wiiRemoteCheck(null, now).status, 'warn');
});
