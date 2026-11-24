// Where consoles connect: the relay when served by the laptop on the LAN, the cloud's console socket otherwise.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { controlSocketUrl, isLocalHost, labelForId } from '../../ui/client/endpoints.ts';

test('the laptop on a hotspot or this machine counts as local', () => {
  for (const h of ['localhost', '127.0.0.1', '192.168.43.12', '172.20.10.3', '10.0.0.5', 'quina.local', '[::1]']) assert.equal(isLocalHost(h), true, h);
  for (const h of ['quina.barrakudesbegur.org', 'example.workers.dev', '8.8.8.8', '172.32.0.1']) assert.equal(isLocalHost(h), false, h);
});

test('LAN pages use the relay; cloud pages the console socket, over wss', () => {
  assert.equal(controlSocketUrl('http://172.20.10.3:5174/console/'), 'ws://172.20.10.3:5174/ws');
  assert.equal(controlSocketUrl('https://control.example.org/console/'), 'wss://control.example.org/ws/console');
});

test('labels become safe id prefixes', () => {
  assert.equal(labelForId('Mòbil admin'), 'Mobil_admin');
  assert.equal(labelForId('Tauleta'), 'Tauleta');
  assert.equal(labelForId('  ¡!  '), 'device');
});
