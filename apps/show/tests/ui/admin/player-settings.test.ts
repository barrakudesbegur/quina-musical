// Admin's player-app settings reach the phones (D227): the bodies Admin sends to the cloud's PUT /api/sounds and
// PUT /api/notice, how a send ends, and the phone's side (the public feed's change, the sound default). The cloud's
// handlers themselves are checked against these bodies in apps/cloud/test/node/player-settings.e2e.test.ts.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { applyPublic, emptyPublicState } from '@quina/protocol';
import { sendPlayerSettings } from '../../../../admin/data/cloud-player-settings.ts';
import { BANNER_MAX_LENGTH, DEFAULT_PLAYER_SETTINGS, noticeBody, soundsBody } from '../../../../admin/logic/player-settings.ts';
import { S } from '../../../../admin/strings.ts';
import type { FetchLike } from '../../../../../packages/ui/data/cloud-plan.ts';
import { emptyData, soundsOn } from '../../../../player/logic/storage.ts';

const ON = { soundsOnByDefault: false, banner: '  El bar tanca a les 00:30  ', bannerOn: true };

test("the bodies: the message trimmed while it's on, else null; the sounds default as it is", () => {
  assert.deepEqual(noticeBody(ON), { notice: 'El bar tanca a les 00:30' });
  assert.deepEqual(noticeBody({ ...ON, bannerOn: false }), { notice: null }, 'off: the phones show none, the text stays here');
  assert.deepEqual(noticeBody({ ...ON, banner: '   ' }), { notice: null }, 'on but empty: none');
  assert.equal(noticeBody({ ...ON, banner: 'x'.repeat(500) }).notice?.length, BANNER_MAX_LENGTH);
  assert.ok(BANNER_MAX_LENGTH <= 200, "within the cloud's limit (apps/cloud config maxNoticeLength)");
  assert.deepEqual(soundsBody(ON), { soundsDefault: false });
  assert.deepEqual(soundsBody(DEFAULT_PLAYER_SETTINGS), { soundsDefault: true });
  assert.deepEqual(noticeBody(DEFAULT_PLAYER_SETTINGS), { notice: null }, 'by default no message');
});

/** A cloud that answers each path with a status, and records what it got. */
function fakeCloud(statuses: Record<string, number | 'down'>) {
  const calls: { path: string; method?: string; type?: string; body: unknown }[] = [];
  const fetchImpl: FetchLike = async (path, init) => {
    calls.push({ path, method: init?.method, type: init?.headers?.['content-type'], body: JSON.parse(String(init?.body)) });
    const status = statuses[path] ?? 200;
    if (status === 'down') throw new TypeError('Failed to fetch');
    return { ok: status < 300, status, json: async () => (status < 300 ? { ok: true } : { ok: false, error: 'no' }) };
  };
  return { fetchImpl, calls };
}

test('a send PUTs the sounds default and the message as JSON, and is sent only when the cloud takes both', async () => {
  const ok = fakeCloud({});
  assert.deepEqual(await sendPlayerSettings(ok.fetchImpl, ON), { kind: 'sent' });
  assert.deepEqual(ok.calls, [
    { path: '/api/sounds', method: 'PUT', type: 'application/json', body: { soundsDefault: false } },
    { path: '/api/notice', method: 'PUT', type: 'application/json', body: { notice: 'El bar tanca a les 00:30' } },
  ]);
  assert.deepEqual(await sendPlayerSettings(fakeCloud({ '/api/notice': 400 }).fetchImpl, ON), { kind: 'failed', status: 400 });
  assert.deepEqual(await sendPlayerSettings(fakeCloud({ '/api/sounds': 403 }).fetchImpl, ON), { kind: 'failed', status: 403 }, 'Access refused');
  const down = fakeCloud({ '/api/sounds': 'down', '/api/notice': 'down' });
  assert.deepEqual(await sendPlayerSettings(down.fetchImpl, ON), { kind: 'failed', status: 0 }, 'no answer: never thrown');
  assert.equal(down.calls.length, 2, 'the message is still tried when the sounds fail');
});

test("the states' words, in Catalan", () => {
  assert.equal(S.night.send, 'Enviar als mòbils');
  assert.equal(S.night.sending, 'Enviant als mòbils…');
  assert.equal(S.night.sent, 'Enviat a tots els mòbils.');
  assert.match(S.night.sendFailed(0), /connexió amb el núvol/);
  assert.match(S.night.sendFailed(400), /error 400/);
});

test("on the phone: the cloud's changes from those bodies set the banner and the sounds default; a player's choice wins", () => {
  const state = applyPublic(emptyPublicState('26'), [
    { kind: 'notice', notice: noticeBody(ON).notice },
    { kind: 'sounds', soundsDefault: soundsBody(ON).soundsDefault },
  ]);
  assert.equal(state.notice, 'El bar tanca a les 00:30', "the home screen's strip shows it (StatusStrip)");
  assert.equal(soundsOn(emptyData('26'), state.soundsDefault), false, 'no choice of their own: the default');
  assert.equal(soundsOn({ ...emptyData('26'), sounds: true }, state.soundsDefault), true);
  assert.equal(applyPublic(state, [{ kind: 'notice', notice: noticeBody({ ...ON, bannerOn: false }).notice }]).notice, null);
});
