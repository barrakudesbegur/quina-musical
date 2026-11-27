// The Worker: checks Cloudflare Access once, for the routes that need it, then hands the request to the
// edition's GameRoom. Static files never get here (wrangler.jsonc `run_worker_first`).
import { identityLabel, requireAccess, type AccessEnv } from './access.ts';
import { CLOUD } from './config.ts';
import { findRoute, jxlUploadKey, mediaId, SYNC_METHODS, syncTarget, wantsJxl, type SyncTarget } from './domain/routes.ts';
import {
  BLOB_PAGE,
  blobKey,
  blobOfKey,
  BLOBS_PREFIX,
  checkManifest,
  FREE_TIER_BYTES,
  isSha256,
  manifestKey,
  MANIFESTS_PREFIX,
  MAX_MANIFEST_BYTES,
  MAX_PRUNE_BLOBS,
  MAX_SYNC_FILE_BYTES,
  missingBlobs,
  namedBlobs,
  repertoireOfKey,
  unnamedBlobs,
  type BlobPage,
  type MediaManifest,
  type SyncOverview,
} from './domain/media-sync.ts';
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
        if (request.method === 'GET') {
          // What every phone has now, so Admin's form starts from it rather than from what this device last sent.
          const { notice, soundsDefault } = await room.playerSettings();
          return json(route.name === 'notice' ? { notice } : { soundsDefault });
        }
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
 * A repertoire's media in R2, for the laptops (Access service token), content-addressed (D248): each distinct file once
 * as `blobs/<sha256>` (R2 itself checks the hash on the way in, so a key never holds other bytes), and one manifest per
 * repertoire, `manifests/<name>.json`, mapping each path to its blob. Never public, never cached: no-store everywhere.
 * Each request stays far under the Worker's ~1,000 R2 operations: one per blob page, one per blob, one per manifest.
 */
async function sync(request: Request, env: MediaEnv, url: URL): Promise<Response> {
  const bucket = env.MEDIA;
  if (!bucket) return text(503, 'media sync is not configured: create the R2 bucket (docs/deploy-plan.md, step 4)');
  const target = syncTarget(url.pathname) as SyncTarget;
  const methods = SYNC_METHODS[target.resource];
  if (!methods.includes(request.method)) return text(405, `only ${methods.join(', ')}`);
  switch (target.resource) {
    case 'overview': {
      // Every repertoire from its manifest, and the bucket's real size: each blob once (for `media prune`; the free tier is 10 GB).
      const manifests = await allManifests(bucket);
      if (manifests instanceof Response) return manifests;
      const blobs = await allBlobs(bucket);
      const unnamed = unnamedBlobs(blobs, manifests);
      const sum = (sizes: Iterable<number>) => [...sizes].reduce((total, size) => total + size, 0);
      const overview: SyncOverview = {
        repertoires: manifests.map((m) => ({ name: m.repertoire, files: Object.keys(m.files).length, bytes: sum(Object.values(m.files).map((f) => f.size)), blobs: namedBlobs(m.files).size, updatedAtMs: m.updatedAtMs })),
        blobs: { count: blobs.size, bytes: sum(blobs.values()) },
        unnamed: { count: unnamed.length, bytes: sum(unnamed.map((b) => b.size)) },
        totalBytes: sum(blobs.values()),
        freeTierBytes: FREE_TIER_BYTES,
      };
      return json(overview);
    }
    case 'blobs': {
      // One page of the list (one R2 call): the laptop pages through with the cursor.
      const page = await bucket.list({ prefix: BLOBS_PREFIX, cursor: url.searchParams.get('cursor') || undefined, limit: BLOB_PAGE });
      const body: BlobPage = {
        blobs: page.objects.flatMap((o) => {
          const sha256 = blobOfKey(o.key);
          return sha256 ? [{ sha256, size: o.size }] : [];
        }),
        cursor: page.truncated ? page.cursor : null,
      };
      return json(body);
    }
    case 'blob': {
      const key = blobKey(target.sha256);
      if (request.method === 'GET') {
        const object = await bucket.get(key);
        if (!object) return text(404, 'no such blob');
        return new Response(object.body, { headers: { 'content-type': 'application/octet-stream', 'content-length': String(object.size), 'cache-control': 'no-store' } });
      }
      const size = Number(request.headers.get('content-length'));
      if (!request.headers.has('content-length') || !Number.isInteger(size) || size < 0 || size > MAX_SYNC_FILE_BYTES) return text(413, `a content-length up to ${MAX_SYNC_FILE_BYTES} bytes`);
      if (!request.body) return text(400, 'no body');
      try {
        await bucket.put(key, request.body, { sha256: target.sha256 });
      } catch (error) {
        // Only R2's checksum refusal is the sender's fault (400). Anything else (`… (10001)`, R2's internal error, or
        // unknown) is a 503 with its message: the laptop retries 5xx and 429, while a 400 stops the whole push.
        const message = error instanceof Error ? error.message : String(error);
        if (isDigestMismatch(message)) return text(400, `refused: the content doesn't match its SHA-256: ${message}`);
        return text(503, `R2 failed, try again: ${message}`);
      }
      return json({ ok: true });
    }
    case 'manifest': {
      const key = manifestKey(target.repertoire);
      if (request.method === 'GET') {
        const object = await bucket.get(key);
        if (!object) return text(404, `no manifest for repertoire ${target.repertoire}`);
        return new Response(object.body, { headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } });
      }
      if (request.method === 'DELETE') {
        // The manifest only: its blobs stay until a prune finds that no manifest names them. Named twice, against slips.
        if (request.headers.get('x-confirm-repertoire') !== target.repertoire) return text(400, `send x-confirm-repertoire: ${target.repertoire} to drop that repertoire`);
        const existed = (await bucket.head(key)) !== null;
        if (existed) await bucket.delete(key);
        return json({ ok: true, existed });
      }
      const body = await readBody(request, MAX_MANIFEST_BYTES);
      if (body === null) return text(413, `a manifest of at most ${MAX_MANIFEST_BYTES >> 20} MB`);
      let manifest: MediaManifest | null = null;
      try {
        manifest = checkManifest(JSON.parse(new TextDecoder().decode(body)), target.repertoire);
      } catch {
        // answered below
      }
      if (!manifest) return text(400, 'not a v3 manifest for this repertoire');
      // Every blob it names must be in the bucket, so a pull never meets a hash that isn't there. One list call per
      // 1,000 blobs (3 for 2026), not a HEAD per file (2,796, past the per-request limit).
      const missing = missingBlobs(manifest.files, await allBlobs(bucket));
      if (missing.length > 0) return json({ ok: false, error: `${missing.length} blob(s) it names are not in the bucket: upload them first`, missing: missing.slice(0, 20).map((b) => b.sha256) }, {}, 409);
      await bucket.put(key, JSON.stringify(manifest), { httpMetadata: { contentType: 'application/json' } });
      return json({ ok: true, files: Object.keys(manifest.files).length, blobs: namedBlobs(manifest.files).size });
    }
    case 'prune': {
      // Delete these blobs (one R2 call, at most 1,000), only if no manifest names any of them now.
      const body = await readBody(request, 128 << 10);
      let hashes: unknown = null;
      try {
        hashes = body ? (JSON.parse(new TextDecoder().decode(body)) as { sha256?: unknown }).sha256 : null;
      } catch {
        // answered below
      }
      if (!Array.isArray(hashes) || hashes.length === 0 || hashes.length > MAX_PRUNE_BLOBS || !hashes.every(isSha256)) return text(400, `send { "sha256": [...] }, 1 to ${MAX_PRUNE_BLOBS} hashes`);
      const manifests = await allManifests(bucket);
      if (manifests instanceof Response) return manifests;
      const named = new Set(manifests.flatMap((m) => [...namedBlobs(m.files).keys()]));
      const refused = hashes.filter((h) => named.has(h));
      if (refused.length > 0) return json({ ok: false, error: `${refused.length} of them are named by a manifest (pushed since the prune looked?): run it again`, named: refused.slice(0, 20) }, {}, 409);
      await bucket.delete(hashes.map(blobKey));
      return json({ ok: true, deleted: hashes.length });
    }
  }
}

/**
 * Whether R2 refused a put because the body doesn't hash to the checksum it was given: R2's BadDigest, code 10037,
 * which the binding throws as `put: The SHA-256 checksum you specified did not match what we received. … (10037)`
 * (miniflare's r2 bucket.worker.js, BadDigest, mirrors R2's wording and code).
 */
export function isDigestMismatch(message: string): boolean {
  return /\(10037\)\s*$/.test(message) || /checksum you specified did not match/i.test(message);
}

/** Every blob in the bucket, hash → size: one list call per 1,000. */
async function allBlobs(bucket: R2Bucket): Promise<Map<string, number>> {
  const blobs = new Map<string, number>();
  let cursor: string | undefined;
  do {
    const page = await bucket.list({ prefix: BLOBS_PREFIX, cursor, limit: BLOB_PAGE });
    for (const o of page.objects) {
      const sha256 = blobOfKey(o.key);
      if (sha256) blobs.set(sha256, o.size);
    }
    cursor = page.truncated ? page.cursor : undefined;
  } while (cursor);
  return blobs;
}

/**
 * Every repertoire's manifest, by name (one list call, then one get each). One that doesn't read is a 500: what it
 * names is unknown, so nothing may be counted unnamed or pruned until it's fixed or dropped.
 */
async function allManifests(bucket: R2Bucket): Promise<MediaManifest[] | Response> {
  const manifests: MediaManifest[] = [];
  let cursor: string | undefined;
  do {
    const page = await bucket.list({ prefix: MANIFESTS_PREFIX, cursor });
    for (const o of page.objects) {
      const name = repertoireOfKey(o.key);
      const object = name ? await bucket.get(o.key) : null;
      const manifest = name && object ? checkManifest(await object.json().catch(() => null), name) : null;
      if (!manifest) return text(500, `the bucket's ${o.key} is not a v3 manifest: drop it (DELETE /api/sync/manifests/<name>) or push it again`);
      manifests.push(manifest);
    }
    cursor = page.truncated ? page.cursor : undefined;
  } while (cursor);
  return manifests.sort((a, b) => (a.repertoire < b.repertoire ? -1 : 1));
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
