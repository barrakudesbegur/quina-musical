// The laptop's addresses on the hotspot or the venue's Wi-Fi, for the console's pairing URL the relay prints. The first
// non-internal IPv4 os.networkInterfaces() lists is often the wrong one (a VPN's tunnel, a bridge, an older network),
// so the default route's interface comes first, tunnels last, and the relay prints the list again when it changes.
import { execFile } from 'node:child_process';
import type { NetworkInterfaceInfo } from 'node:os';

/** One IPv4 address of this laptop, and the interface it is on. */
export interface LanAddress {
  iface: string;
  address: string;
  /** The interface the default route goes through. */
  isDefault: boolean;
  /** A VPN's or another tunnel's interface: tablets on the Wi-Fi can't reach it. */
  isTunnel: boolean;
}

/** Interfaces that are tunnels, not a network the tablets are on (macOS utun/ipsec/ppp, Linux tun/wg). */
const TUNNEL = /^(utun|ipsec|ppp|tun|tap|wg|gif|stf)\d*/;

/**
 * The laptop's non-internal IPv4 addresses, best first: the default route's interface (unless it is a tunnel), then
 * the other physical ones in the order the system lists them, tunnels last. Link-local (169.254.*) ones are left out.
 */
export function lanAddresses(interfaces: Record<string, NetworkInterfaceInfo[] | undefined>, defaultIface: string | null): LanAddress[] {
  const all: LanAddress[] = [];
  for (const [iface, infos] of Object.entries(interfaces)) {
    for (const info of infos ?? []) {
      if (info.family !== 'IPv4' || info.internal || info.address.startsWith('169.254.')) continue;
      all.push({ iface, address: info.address, isDefault: iface === defaultIface, isTunnel: TUNNEL.test(iface) });
    }
  }
  const rank = (a: LanAddress) => (a.isTunnel ? 2 : a.isDefault ? 0 : 1);
  return all.map((a, i) => ({ a, i })).sort((x, y) => rank(x.a) - rank(y.a) || x.i - y.i).map(({ a }) => a);
}

/**
 * The default route's interface (`route -n get default` on macOS, `ip route show default` on Linux), or null: offline,
 * no such tool, or slower than 1 s. Asynchronous, so the relay never waits on it.
 */
export function defaultRouteInterface(platform: NodeJS.Platform = process.platform): Promise<string | null> {
  const [command, argv, pattern] =
    platform === 'darwin' ? ['route', ['-n', 'get', 'default'], /^\s*interface:\s*(\S+)/m] as const
    : platform === 'linux' ? ['ip', ['route', 'show', 'default'], /\bdev\s+(\S+)/] as const
    : [null, [], null] as const;
  if (!command) return Promise.resolve(null);
  return new Promise((resolve) => {
    execFile(command, [...argv], { encoding: 'utf8', timeout: 1000 }, (error, stdout) => resolve(error ? null : stdout.match(pattern)?.[1] ?? null));
  });
}

/** How an address reads in the relay's output: `192.168.10.153 (en0)`, with a tunnel marked. */
export function describeAddress(a: LanAddress): string {
  return `${a.address} (${a.iface}${a.isTunnel ? ', a VPN or tunnel: tablets can\'t reach it' : ''})`;
}
