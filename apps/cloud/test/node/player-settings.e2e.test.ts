// Admin's player-app settings against the real Worker under `wrangler dev` (D227): the bodies Admin's client sends
// (apps/admin/data/cloud-player-settings.ts) pass the handlers' checks, and land in the public state every phone
// follows (here read back through the edition export, which carries it).
import test from 'node:test';
import assert from 'node:assert/strict';
import { sendPlayerSettings, type PutFetch } from '../../../admin/data/cloud-player-settings.ts';
import { BANNER_MAX_LENGTH } from '../../../admin/logic/player-settings.ts';
import type { EditionExport } from '../../src/api.ts';
import { CLOUD } from '../../src/config.ts';
import { startDevServer } from '../../loadtest/dev-server.ts';

test("Admin's banner and sounds default reach the public state; its limit fits the cloud's", async () => {
  assert.ok(BANNER_MAX_LENGTH <= CLOUD.maxNoticeLength);
  const server = await startDevServer();
  try {
    const fetchImpl: PutFetch = (path, init) => fetch(`${server.http}${path}`, init);
    const published = async () => ((await (await fetch(`${server.http}/api/export`)).json()) as EditionExport).publicState;
    const settings = { soundsOnByDefault: false, banner: '  El bar tanca a les 00:30  ', bannerOn: true };
    assert.deepEqual(await sendPlayerSettings(fetchImpl, settings), { kind: 'sent' });
    let state = await published();
    assert.equal(state.notice, 'El bar tanca a les 00:30');
    assert.equal(state.soundsDefault, false);
    assert.deepEqual(await sendPlayerSettings(fetchImpl, { ...settings, soundsOnByDefault: true, banner: 'x'.repeat(BANNER_MAX_LENGTH), bannerOn: false }), { kind: 'sent' });
    state = await published();
    assert.equal(state.notice, null, 'off: no message on the phones');
    assert.equal(state.soundsDefault, true);
  } finally {
    await server.stop();
  }
});
