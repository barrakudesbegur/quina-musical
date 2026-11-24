// Pairing with the relay: ?t= wins and is kept; junk is ignored; the QR link carries the token.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolveToken, withToken } from '../../ui/client/pairing.ts';

const TOKEN = 'k3Jx9QpL2mZ7';

test('the link token wins and is stored; later visits use the stored one', () => {
  assert.deepEqual(resolveToken(TOKEN, null), { token: TOKEN, store: true });
  assert.deepEqual(resolveToken(TOKEN, TOKEN), { token: TOKEN, store: false });
  assert.deepEqual(resolveToken(null, TOKEN), { token: TOKEN, store: false });
  assert.deepEqual(resolveToken(null, null), { token: null, store: false });
});

test('junk tokens are ignored, in the link and in storage', () => {
  assert.deepEqual(resolveToken('<script>', TOKEN), { token: TOKEN, store: false });
  assert.deepEqual(resolveToken('short', null), { token: null, store: false });
  assert.deepEqual(resolveToken(null, 'bad token!'), { token: null, store: false });
});

test('the console QR link carries the token, or stays as it is without one', () => {
  assert.equal(withToken('http://192.168.43.2:5174/console/?label=M%C3%B2bil+admin', TOKEN), `http://192.168.43.2:5174/console/?label=M%C3%B2bil+admin&t=${TOKEN}`);
  assert.equal(withToken('http://192.168.43.2:5174/console/', null), 'http://192.168.43.2:5174/console/');
});
