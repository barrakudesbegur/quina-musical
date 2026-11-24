// Who may call the cloud's private routes: Cloudflare Access (Zero Trust) with Google for people, and an Access
// service token for the show laptop's cloud link. Adapted from `functions/_lib/access.ts` in the Barrakudes
// coin-reader project (the `requireAccess` pattern: multiple AUDs, fail-closed, an ACCESS_DEV bypass).
//
// Access authenticates at the edge and forwards a signed JWT in `Cf-Access-Jwt-Assertion`. Verifying its
// signature here (not just trusting the header) is what prevents spoofing. Changes from coin-reader:
// - service tokens: their JWT has a `common_name` (the token's client ID) and no `email`. They pass only when
//   that client ID is in CF_ACCESS_SERVICE_TOKENS, and only on routes that allow services;
// - people pass only on routes that allow people, and only when their email is in CF_ACCESS_EMAILS or under
//   CF_ACCESS_EMAIL_DOMAIN (on top of the Access policy, the first gate). With neither set, no person passes;
// - the ACCESS_DEV bypass only works on a localhost URL, so a stray dev variable can't open a deployed Worker.
// FAILS CLOSED: without a team domain and at least one AUD, every request is refused.
import { createRemoteJWKSet, jwtVerify, type JWTVerifyGetKey } from 'jose';

/** The Access settings, from secrets (`wrangler secret put`) or .dev.vars. */
export interface AccessEnv {
  /** `true` only in .dev.vars: every check passes with a placeholder identity, on localhost only. */
  ACCESS_DEV?: string;
  /** For example `https://<team>.cloudflareaccess.com`. */
  CF_ACCESS_TEAM_DOMAIN?: string;
  /** Comma-separated: the Access application's AUD tag(s). */
  CF_ACCESS_AUD?: string;
  /** Comma-separated emails allowed in, on top of the Access policy. */
  CF_ACCESS_EMAILS?: string;
  /** An email domain allowed in, on top of the Access policy (for example `barrakudesbegur.org`). */
  CF_ACCESS_EMAIL_DOMAIN?: string;
  /** Comma-separated client IDs of the service tokens allowed in (the show laptop's). */
  CF_ACCESS_SERVICE_TOKENS?: string;
}

export type AccessIdentity =
  | { kind: 'person'; email: string }
  | { kind: 'service'; clientId: string }
  | { kind: 'dev' };

/** Who a route lets in. */
export interface AccessRule {
  people: boolean;
  services: boolean;
}

const list = (value: string | undefined): string[] =>
  (value ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]']);

// One JWKS resolver per team domain, reused across requests in this isolate (jose caches the keys).
const jwksCache = new Map<string, JWTVerifyGetKey>();
function teamKeys(teamDomain: string): JWTVerifyGetKey {
  let resolver = jwksCache.get(teamDomain);
  if (!resolver) {
    resolver = createRemoteJWKSet(new URL(`${teamDomain}/cdn-cgi/access/certs`));
    jwksCache.set(teamDomain, resolver);
  }
  return resolver;
}

const forbidden = (reason: string): Response => new Response(`forbidden: ${reason}\n`, { status: 403, headers: { 'content-type': 'text/plain; charset=utf-8' } });

/**
 * Require Access for a request. Returns the caller's identity, or a 403 Response to return as it is.
 * `keys` is for tests; it defaults to the team's published keys.
 */
export async function requireAccess(request: Request, env: AccessEnv, rule: AccessRule, keys?: JWTVerifyGetKey): Promise<AccessIdentity | Response> {
  if (env.ACCESS_DEV === 'true') {
    return LOCAL_HOSTS.has(new URL(request.url).hostname) ? { kind: 'dev' } : forbidden('the dev bypass only works on localhost');
  }

  const team = env.CF_ACCESS_TEAM_DOMAIN?.replace(/\/+$/, '');
  const audiences = list(env.CF_ACCESS_AUD);
  if (!team || audiences.length === 0) return forbidden('access not configured');

  const token = request.headers.get('cf-access-jwt-assertion');
  if (!token) return forbidden('not signed in');

  let payload: Record<string, unknown>;
  try {
    ({ payload } = await jwtVerify(token, keys ?? teamKeys(team), { issuer: team, audience: audiences }));
  } catch {
    return forbidden('invalid access token');
  }

  const email = typeof payload.email === 'string' ? payload.email.toLowerCase() : '';
  if (email) {
    if (!rule.people) return forbidden('people may not use this route');
    const emails = list(env.CF_ACCESS_EMAILS).map((e) => e.toLowerCase());
    const domain = env.CF_ACCESS_EMAIL_DOMAIN?.trim().toLowerCase().replace(/^@/, '');
    const allowed = emails.includes(email) || (domain ? email.endsWith(`@${domain}`) : false);
    if (!allowed) return forbidden('email not allowed');
    return { kind: 'person', email };
  }

  const clientId = typeof payload.common_name === 'string' ? payload.common_name : '';
  if (clientId) {
    if (!rule.services) return forbidden('service tokens may not use this route');
    if (!list(env.CF_ACCESS_SERVICE_TOKENS).includes(clientId)) return forbidden('service token not allowed');
    return { kind: 'service', clientId };
  }

  return forbidden('no identity');
}

/** A short label for logs and the console ("person:ana@…", "service:…", "dev"). */
export function identityLabel(identity: AccessIdentity): string {
  switch (identity.kind) {
    case 'person':
      return `person:${identity.email}`;
    case 'service':
      return `service:${identity.clientId}`;
    case 'dev':
      return 'dev';
  }
}
