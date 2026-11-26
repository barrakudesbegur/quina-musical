// The Worker: checks Cloudflare Access once, for the routes that need it, then hands the request to the
// edition's GameRoom. Static files never get here (wrangler.jsonc `run_worker_first`).
import { identityLabel, requireAccess, type AccessEnv } from './access.ts';
import { CLOUD } from './config.ts';
import { findRoute, jxlUploadKey, mediaId, syncTarget, wantsJxl } from './domain/routes.ts';
import { checkManifest, fileKey, isSha256, isSyncPath, manifestKey, MAX_SYNC_FILE_BYTES, REPERTOIRES_PREFIX } from './domain/media-sync.ts';
import { GameRoom, IDENTITY_HEADER } from './game-room.ts';

export { GameRoom };

/** The R2 bucket for the repertoire's media: optional, absent until the user creates it (wrangler.jsonc). */
interface MediaEnv {
  MEDIA?: R2Bucket;
}

type WorkerEnv = Env & AccessEnv & MediaEnv;

export default {
  async fetch(request, env, ctx): Promise<Response> {
    const url = new URL(request.url);
    const route = findRoute(url.pathname);
    if (!route) return text(404, 'not found');
    if (route.websocket && request.headers.get('upgrade')?.toLowerCase() !== 'websocket') return text(426, 'expected a WebSocket');
    if (!route.methods.includes(request.method)) return text(405, `only ${route.methods.join(', ')}`);

    let identity = 'public';
    if (route.access) {
      const result = await requireAccess(request, env, route.access);
      if (result instanceof Response) return result;
      identity = identityLabel(result);
    }

    if (route.name === 'health') return json({ ok: true, edition: env.EDITION });
    if (route.name === 'media') return media(request, env, ctx, mediaId(url.pathname) as string, wantsJxl(url.pathname));
    if (route.name === 'sync') return sync(request, env, url);
    const room = roomOf(env);
    switch (route.name) {
      case 'plan': {
        if (request.method === 'GET') return json({ plan: await room.getPlan(), savedAtMs: await room.getPlanSavedAtMs() });
        if (identity.startsWith('service:')) return text(403, 'only organizers save the plan');
        const body = await readBody(request, CLOUD.maxPlanBytes);
        if (body === null) return text(413, `a plan of at most ${CLOUD.maxPlanBytes / 1024} KB`);
        let parsed: unknown;
        try {
          parsed = JSON.parse(new TextDecoder().decode(body));
        } catch {
          return json({ ok: false, errors: ['plan: not JSON'] }, {}, 400);
        }
        const saved = await room.setPlan(parsed);
        return json(saved, {}, saved.ok ? 200 : 400);
      }
      case 'upload': {
        if (request.method === 'GET') return json({ media: await room.listMedia() });
        const body = await readBody(request, CLOUD.media.maxBytes);
        if (body === null) return text(413, `files of at most ${CLOUD.media.maxBytes / 1024} KB`);
        const name = url.searchParams.get('name')?.trim().slice(0, CLOUD.media.maxNameLength) || null;
        const saved = await room.putMedia(body, (request.headers.get('content-type') ?? '').split(';')[0]?.trim() ?? '', name);
        return json(saved, {}, saved.ok ? 201 : saved.status);
      }
      case 'uploadJxl': {
        const body = await readBody(request, CLOUD.media.maxBytes);
        if (body === null) return text(413, `files of at most ${CLOUD.media.maxBytes / 1024} KB`);
        const saved = await room.putMediaJxl(jxlUploadKey(url.pathname) as string, body);
        return json(saved, {}, saved.ok ? 201 : saved.status);
      }
      case 'games':
        return json({ games: await room.listGames() });
      case 'resume': {
        const body = await readBody(request, 4096);
        let gameId: unknown = null;
        try {
          gameId = body ? (JSON.parse(new TextDecoder().decode(body)) as { gameId?: unknown }).gameId : null;
        } catch {
          // answered below
        }
        if (typeof gameId !== 'string' || !gameId || gameId.length > 100) return json({ ok: false, error: 'send { "gameId": "…" }' }, {}, 400);
        // Who asked goes to the cloud's log only: the laptop gets a role, never an email (it lands in a file).
        console.log(`manual resume of ${gameId} by ${identity}`);
        const resumed = await room.resumeGame(gameId, identity.startsWith('person:') ? 'an organizer' : identity === 'dev' ? 'dev' : 'the laptop');
        return json(resumed, {}, resumed.ok ? 200 : 404);
      }
      case 'ping':
        return json(await room.ping());
      case 'phones':
        return json(await room.phonesNow());
      case 'notice':
      case 'sounds': {
        const body = await readBody(request, 4096);
        let parsed: Record<string, unknown> = {};
        try {
          parsed = body ? (JSON.parse(new TextDecoder().decode(body)) as Record<string, unknown>) : {};
        } catch {
          return json({ ok: false, error: 'not JSON' }, {}, 400);
        }
        const saved = route.name === 'notice' ? await room.setNotice(parsed?.notice) : await room.setSoundsDefault(parsed?.soundsDefault);
        return json(saved, {}, saved.ok ? 200 : 400);
      }
      case 'export':
        return json(await room.exportEdition(), { 'content-disposition': `attachment; filename="quina-${env.EDITION}-export.json"` });
      case 'stats':
        return json(await room.getStats());
      case 'feed':
      case 'show':
      case 'console': {
        // The identity header is always the Worker's own, never a client's.
        const headers = new Headers(request.headers);
        headers.set(IDENTITY_HEADER, identity);
        return room.fetch(new Request(request, { headers }));
      }
    }
  },
} satisfies ExportedHandler<WorkerEnv>;

/** The edition's one GameRoom, placed near the venue. */
export function roomOf(env: Env): DurableObjectStub<GameRoom> {
  const namespace = env.GAME_ROOM as DurableObjectNamespace<GameRoom>;
  return namespace.get(namespace.idFromName(`edition:${env.EDITION}`), { locationHint: CLOUD.locationHint });
}

/**
 * A media file, by content hash, so it never changes: cached for a year by browsers and by Cloudflare's cache
 * (on a custom domain; the Cache API does nothing on workers.dev), so phones rarely wake the GameRoom for it.
 */
async function media(request: Request, env: Env, ctx: ExecutionContext, id: string, jxl: boolean): Promise<Response> {
  const cache = caches.default;
  const cached = await cache.match(request);
  if (cached) return cached;
  const file = await roomOf(env).getMedia(id, jxl);
  if (!file) return text(404, 'not found');
  // A .jxl with no JPEG XL yet answers with the fallback's bytes (a <picture> never breaks), cached only briefly.
  const cacheControl = file.isFallback ? `public, max-age=${CLOUD.media.fallbackForJxlMaxAgeS}` : 'public, max-age=31536000, immutable';
  const response = new Response(file.bytes, {
    headers: { 'content-type': file.contentType, 'cache-control': cacheControl, 'x-content-type-options': 'nosniff' },
  });
  ctx.waitUntil(cache.put(request, response.clone()));
  return response;
}

/**
 * A repertoire's media in R2, for the laptops (Access service token). The manifest says what its files are;
 * a file is stored under its sync path, and R2 itself checks the SHA-256 the laptop sends with it.
 */
async function sync(request: Request, env: MediaEnv, url: URL): Promise<Response> {
  const bucket = env.MEDIA;
  if (!bucket) return text(503, 'media sync is not configured: create the R2 bucket (docs/deploy-plan.md, step 4)');
  // GET /api/sync: every repertoire in the bucket, from its manifest (for `media prune`: the free tier is 10 GB).
  if (url.pathname === '/api/sync') {
    if (request.method !== 'GET') return text(405, 'only GET');
    const listed = await bucket.list({ prefix: REPERTOIRES_PREFIX, delimiter: '/' });
    const repertoires = [];
    for (const prefix of listed.delimitedPrefixes) {
      const name = prefix.slice(REPERTOIRES_PREFIX.length, -1);
      const object = await bucket.get(manifestKey(name));
      const manifest = object ? (checkManifest(await object.json(), name) ?? null) : null;
      const files = manifest ? Object.values(manifest.files) : [];
      repertoires.push({ name, files: files.length, bytes: files.reduce((sum, f) => sum + f.size, 0), updatedAtMs: manifest?.updatedAtMs ?? 0 });
    }
    return json({ repertoires, totalBytes: repertoires.reduce((sum, r) => sum + r.bytes, 0), freeTierBytes: 10e9 });
  }
  const target = syncTarget(url.pathname) as { repertoire: string; resource: 'manifest' | 'file' };
  if (target.resource === 'manifest') {
    // DELETE: the whole repertoire goes (every file, then its manifest); x-confirm-repertoire must name it, against slips.
    if (request.method === 'DELETE') {
      if (request.headers.get('x-confirm-repertoire') !== target.repertoire) return text(400, `send x-confirm-repertoire: ${target.repertoire} to delete that repertoire`);
      let deleted = 0;
      let cursor: string | undefined;
      do {
        const page = await bucket.list({ prefix: `${REPERTOIRES_PREFIX}${target.repertoire}/files/`, cursor, limit: 1000 });
        const keys = page.objects.map((o) => o.key);
        if (keys.length) await bucket.delete(keys);
        deleted += keys.length;
        cursor = page.truncated ? page.cursor : undefined;
      } while (cursor);
      await bucket.delete(manifestKey(target.repertoire));
      return json({ ok: true, deleted });
    }
    if (request.method === 'GET') {
      const object = await bucket.get(manifestKey(target.repertoire));
      return object ? new Response(object.body, { headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } }) : json({ v: 2, repertoire: target.repertoire, files: {}, updatedAtMs: 0 });
    }
    const body = await readBody(request, 4 << 20);
    let manifest = null;
    try {
      manifest = body ? checkManifest(JSON.parse(new TextDecoder().decode(body)), target.repertoire) : null;
    } catch {
      // answered below
    }
    if (!manifest) return text(400, 'not a manifest for this repertoire');
    await bucket.put(manifestKey(target.repertoire), JSON.stringify(manifest), { httpMetadata: { contentType: 'application/json' } });
    return json({ ok: true, files: Object.keys(manifest.files).length });
  }
  const path = url.searchParams.get('path');
  if (!isSyncPath(path)) return text(400, 'path must be <root>/<file>, a known root and plain names');
  const key = fileKey(target.repertoire, path);
  if (request.method === 'DELETE') return text(405, 'delete a whole repertoire: DELETE /api/sync/<repertoire>/manifest');
  if (request.method === 'GET') {
    const object = await bucket.get(key);
    if (!object) return text(404, 'not found');
    return new Response(object.body, { headers: { 'content-length': String(object.size), 'x-sha256': object.customMetadata?.sha256 ?? '', 'cache-control': 'no-store' } });
  }
  const sha256 = request.headers.get('x-sha256');
  const size = Number(request.headers.get('content-length'));
  if (!isSha256(sha256)) return text(400, 'x-sha256 must be the hex SHA-256 of the file');
  if (!Number.isInteger(size) || size < 0 || size > MAX_SYNC_FILE_BYTES) return text(413, `a content-length up to ${MAX_SYNC_FILE_BYTES} bytes`);
  if (!request.body) return text(400, 'no body');
  try {
    await bucket.put(key, request.body, { sha256, customMetadata: { sha256 } });
  } catch (error) {
    return text(400, `refused: ${error instanceof Error ? error.message : String(error)} (the content doesn't match x-sha256?)`);
  }
  return json({ ok: true });
}

/** The request body, or null when it is bigger than `limit` bytes. */
async function readBody(request: Request, limit: number): Promise<ArrayBuffer | null> {
  const declared = Number(request.headers.get('content-length') ?? 0);
  if (declared > limit) return null;
  const body = await request.arrayBuffer();
  return body.byteLength > limit ? null : body;
}

function json(body: unknown, headers: Record<string, string> = {}, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...headers } });
}

function text(status: number, body: string): Response {
  return new Response(`${body}\n`, { status, headers: { 'content-type': 'text/plain; charset=utf-8' } });
}
