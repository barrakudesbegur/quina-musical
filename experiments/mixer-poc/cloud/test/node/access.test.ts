// Cloudflare Access: fail-closed, multi-AUD, people by email list or domain, service tokens by allow-list, the dev
// bypass on localhost only, and each route lets in only who it should. Tokens are signed with a local key pair.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createLocalJWKSet, exportJWK, generateKeyPair, SignJWT, type JWTPayload } from 'jose';
import { requireAccess, type AccessEnv, type AccessIdentity, type AccessRule } from '../../src/access.ts';
import { ROUTES, findRoute } from '../../src/domain/routes.ts';

const TEAM = 'https://quina-test.cloudflareaccess.com';
const AUD_APP = 'aud-app';
const AUD_PREVIEW = 'aud-preview';
const PEOPLE: AccessRule = { people: true, services: false };
const SERVICES: AccessRule = { people: false, services: true };

const { publicKey, privateKey } = await generateKeyPair('RS256');
const keys = createLocalJWKSet({ keys: [{ ...(await exportJWK(publicKey)), kid: 'k1', alg: 'RS256' }] });
const other = await generateKeyPair('RS256');

async function token(payload: JWTPayload, { aud = AUD_APP, iss = TEAM, key = privateKey, expiresIn = '5m' } = {}): Promise<string> {
  return new SignJWT(payload).setProtectedHeader({ alg: 'RS256', kid: 'k1' }).setIssuer(iss).setAudience(aud).setIssuedAt().setExpirationTime(expiresIn).sign(key);
}

const env: AccessEnv = {
  CF_ACCESS_TEAM_DOMAIN: TEAM,
  CF_ACCESS_AUD: `${AUD_APP}, ${AUD_PREVIEW}`,
  CF_ACCESS_EMAILS: 'Organizer@Example.org',
  CF_ACCESS_EMAIL_DOMAIN: 'barrakudes.test',
  CF_ACCESS_SERVICE_TOKENS: 'laptop-token.access',
};

function request(jwt?: string, url = 'https://quina.example/api/export'): Request {
  return new Request(url, { headers: jwt ? { 'cf-access-jwt-assertion': jwt } : {} });
}

async function check(jwt: string | undefined, rule: AccessRule, overrides: Partial<AccessEnv> = {}, url?: string): Promise<AccessIdentity | number> {
  const result = await requireAccess(request(jwt, url), { ...env, ...overrides }, rule, keys);
  return result instanceof Response ? result.status : result;
}

test('people pass by email list or domain, on people routes only', async () => {
  assert.deepEqual(await check(await token({ email: 'organizer@example.org' }), PEOPLE), { kind: 'person', email: 'organizer@example.org' });
  assert.deepEqual(await check(await token({ email: 'Ana@Barrakudes.test' }), PEOPLE), { kind: 'person', email: 'ana@barrakudes.test' });
  assert.equal(await check(await token({ email: 'stranger@example.org' }), PEOPLE), 403);
  assert.equal(await check(await token({ email: 'organizer@example.org' }), SERVICES), 403, 'a person on the laptop route');
  assert.equal(await check(await token({ email: 'ana@notbarrakudes.test' }), PEOPLE), 403, 'the domain must match exactly');
});

test('with no email list or domain configured, no person passes (fail closed)', async () => {
  const jwt = await token({ email: 'organizer@example.org' });
  assert.equal(await check(jwt, PEOPLE, { CF_ACCESS_EMAILS: '', CF_ACCESS_EMAIL_DOMAIN: '' }), 403);
});

test('service tokens pass by client ID allow-list, on service routes only', async () => {
  assert.deepEqual(await check(await token({ common_name: 'laptop-token.access' }), SERVICES), { kind: 'service', clientId: 'laptop-token.access' });
  assert.equal(await check(await token({ common_name: 'other.access' }), SERVICES), 403);
  assert.equal(await check(await token({ common_name: 'laptop-token.access' }), PEOPLE), 403, 'the laptop on an admin route');
  assert.equal(await check(await token({ common_name: 'laptop-token.access' }), SERVICES, { CF_ACCESS_SERVICE_TOKENS: '' }), 403);
});

test('any of the configured AUDs is accepted; anything else about the token is refused', async () => {
  const person = { email: 'organizer@example.org' };
  assert.equal(typeof (await check(await token(person, { aud: AUD_PREVIEW }), PEOPLE)), 'object');
  assert.equal(await check(await token(person, { aud: 'aud-other' }), PEOPLE), 403);
  assert.equal(await check(await token(person, { iss: 'https://evil.cloudflareaccess.com' }), PEOPLE), 403);
  assert.equal(await check(await token(person, { key: other.privateKey }), PEOPLE), 403, 'signed by another key');
  assert.equal(await check(await token(person, { expiresIn: '-1m' }), PEOPLE), 403, 'expired');
  assert.equal(await check(await token({}), PEOPLE), 403, 'no identity');
  assert.equal(await check(undefined, PEOPLE), 403, 'no token');
  assert.equal(await check('not.a.jwt', PEOPLE), 403);
});

test('without a team domain or an AUD, everything is refused (fail closed)', async () => {
  const jwt = await token({ email: 'organizer@example.org' });
  assert.equal(await check(jwt, PEOPLE, { CF_ACCESS_TEAM_DOMAIN: '' }), 403);
  assert.equal(await check(jwt, PEOPLE, { CF_ACCESS_AUD: ' , ' }), 403);
});

test('the dev bypass works on localhost only', async () => {
  assert.deepEqual(await check(undefined, PEOPLE, { ACCESS_DEV: 'true' }, 'http://localhost:8787/api/export'), { kind: 'dev' });
  assert.deepEqual(await check(undefined, SERVICES, { ACCESS_DEV: 'true' }, 'http://127.0.0.1:8787/ws/show'), { kind: 'dev' });
  assert.equal(await check(undefined, PEOPLE, { ACCESS_DEV: 'true' }, 'https://quina-cloud.example.workers.dev/api/export'), 403);
  assert.equal(await check(undefined, PEOPLE, { ACCESS_DEV: 'yes' }, 'http://localhost:8787/api/export'), 403, 'only the exact value');
});

test('routes: phones and health are public, the laptop needs its service token, admin routes need a person', () => {
  assert.equal(findRoute('/feed')?.access, null);
  assert.equal(findRoute('/api/health')?.access, null);
  assert.deepEqual(findRoute('/ws/show')?.access, SERVICES);
  assert.deepEqual(findRoute('/api/export')?.access, PEOPLE);
  assert.deepEqual(findRoute('/api/stats')?.access, PEOPLE);
  assert.deepEqual(findRoute('/api/ping')?.access, { people: true, services: true }, 'the preflight signs in with the laptop token');
  assert.equal(findRoute('/'), null);
  assert.equal(findRoute('/toString'), null, 'no prototype keys');
  assert.equal(findRoute('/feed/'), null);
  const open = Object.entries(ROUTES).filter(([, r]) => r.access === null).map(([path]) => path);
  assert.deepEqual(open.sort(), ['/api/health', '/feed'], 'nothing else is public');
});
