// The relay's pairing address (relay/lan.ts): the default route's interface first, tunnels (a VPN) last.
import assert from 'node:assert/strict';
import test from 'node:test';
import type { NetworkInterfaceInfo } from 'node:os';
import { defaultRouteInterface, describeAddress, lanAddresses } from '../relay/lan.ts';

const v4 = (address: string, internal = false): NetworkInterfaceInfo => ({ address, family: 'IPv4', internal, netmask: '255.255.255.0', mac: '00:00:00:00:00:00', cidr: `${address}/24` });
const v6 = (address: string): NetworkInterfaceInfo => ({ address, family: 'IPv6', internal: false, netmask: 'ffff:ffff:ffff:ffff::', mac: '00:00:00:00:00:00', cidr: `${address}/64`, scopeid: 0 });

test("the default route's interface comes first, before an interface the system lists earlier", () => {
  const list = lanAddresses({ lo0: [v4('127.0.0.1', true)], en5: [v4('172.26.205.80')], en0: [v4('192.168.10.153'), v6('fe80::1')] }, 'en0');
  assert.deepEqual(list.map((a) => a.address), ['192.168.10.153', '172.26.205.80']);
  assert.equal(list[0].isDefault, true);
});

test('a VPN tunnel goes last even when the default route goes through it, and is marked', () => {
  const list = lanAddresses({ utun4: [v4('10.2.0.2')], en0: [v4('192.168.10.153')], bridge100: [v4('192.168.2.1')] }, 'utun4');
  assert.deepEqual(list.map((a) => `${a.iface} ${a.address}`), ['en0 192.168.10.153', 'bridge100 192.168.2.1', 'utun4 10.2.0.2']);
  assert.match(describeAddress(list[2]), /VPN or tunnel/);
  assert.equal(describeAddress(list[0]), '192.168.10.153 (en0)');
});

test('without a default route the system order stays; internal, IPv6 and link-local addresses are left out', () => {
  const list = lanAddresses({ lo0: [v4('127.0.0.1', true)], en1: [v4('169.254.10.2')], en7: [v4('10.0.0.5'), v6('fe80::2')], en0: [v4('192.168.1.20')] }, null);
  assert.deepEqual(list.map((a) => a.address), ['10.0.0.5', '192.168.1.20']);
  assert.deepEqual(lanAddresses({}, null), []);
});

test('the default route lookup answers (an interface name, or null) and never throws', async () => {
  const iface = await defaultRouteInterface();
  assert.ok(iface === null || /^\S+$/.test(iface));
  assert.equal(await defaultRouteInterface('win32'), null);
});
