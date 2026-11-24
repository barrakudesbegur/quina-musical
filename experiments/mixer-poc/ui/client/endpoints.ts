// Where a console (or Admin) connects, decided by where the page was served from (ADR 0003):
// - Served by the show laptop on the hotspot LAN (localhost, a private IPv4 or a .local name): the laptop's
//   relay at `/ws`.
// - Served by the cloud hostname: the cloud's console socket at `/ws/console`. It speaks the same relay
//   protocol, behind Cloudflare Access.
// Either way the socket is on the page's own origin, so nothing needs configuring. Pure, with a URL passed in.

/** Is this hostname the show laptop on a local network (or this machine)? */
export function isLocalHost(hostname: string): boolean {
  const h = hostname.toLowerCase().replace(/^\[|\]$/g, '');
  if (h === 'localhost' || h === '::1' || h.endsWith('.local') || h.endsWith('.localhost')) return true;
  const m = h.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (!m) return false;
  const [a, b] = [Number(m[1]), Number(m[2])];
  return a === 127 || a === 10 || (a === 192 && b === 168) || (a === 172 && b >= 16 && b <= 31) || (a === 169 && b === 254);
}

/** The control socket's URL for a page at `pageUrl`: the relay on the LAN, the console socket in the cloud. */
export function controlSocketUrl(pageUrl: string | URL): string {
  const url = new URL(pageUrl);
  const scheme = url.protocol === 'https:' ? 'wss' : 'ws';
  const path = isLocalHost(url.hostname) ? '/ws' : '/ws/console';
  return `${scheme}://${url.host}${path}`;
}

/**
 * A device label made safe for ids: "Mòbil admin" → "Mobil_admin" (letters, digits and underscores, at
 * most 24). No dashes, because ids join their parts with dashes ("Mobil_admin-r…"), so the label reads back whole.
 */
export function labelForId(label: string): string {
  const ascii = label.normalize('NFD').replace(/[̀-ͯ]/g, '');
  const cleaned = ascii.replace(/[^A-Za-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 24);
  return cleaned || 'device';
}
