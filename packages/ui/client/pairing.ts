// Pairing a device with the show laptop's relay. On the hotspot's LAN the relay accepts only devices that
// present its token in their hello. The relay prints the LAN address with the token (`?t=…`), and the
// console's QR carries it. The page keeps the token on this device, so later visits without `?t=` still pair,
// and removes it from the address bar so it isn't shown or shared by accident. Pages on the laptop itself
// need no token. The pure part (`resolveToken`) is tested; the rest is browser glue that never throws.

export const RELAY_TOKEN_KEY = 'quina.relay.token.v1';
const TOKEN_RE = /^[A-Za-z0-9_-]{8,128}$/;

/** `?t=` wins and is stored; otherwise the stored token; junk is ignored. */
export function resolveToken(param: string | null, stored: string | null): { token: string | null; store: boolean } {
  if (param !== null && TOKEN_RE.test(param)) return { token: param, store: param !== stored };
  return { token: stored !== null && TOKEN_RE.test(stored) ? stored : null, store: false };
}

/** The token this page resolved, so every caller gets the same one (the address bar loses `?t=` on the first). */
let pageToken: string | null | undefined;

/** This page's relay token: from `?t=` (then stored, and removed from the address bar) or from storage. */
export function relayTokenForPage(): string | null {
  if (typeof location === 'undefined') return null;
  if (pageToken !== undefined) return pageToken;
  const url = new URL(location.href);
  const param = url.searchParams.get('t');
  let stored: string | null = null;
  try {
    stored = localStorage.getItem(RELAY_TOKEN_KEY);
  } catch {
    stored = null;
  }
  const { token, store } = resolveToken(param, stored);
  if (store && token) {
    try {
      localStorage.setItem(RELAY_TOKEN_KEY, token);
    } catch {
      // Storage refused: this visit still pairs; the next one needs the link again.
    }
  }
  if (param !== null) {
    url.searchParams.delete('t');
    try {
      history.replaceState(history.state, '', url.toString());
    } catch {
      // Some embedded views refuse it; the token just stays in the address bar.
    }
  }
  pageToken = token;
  return token;
}

/** A link with the relay token, so another device opening it pairs (the console's QR). */
export function withToken(link: string, token: string | null): string {
  if (!token) return link;
  const url = new URL(link);
  url.searchParams.set('t', token);
  return url.toString();
}
