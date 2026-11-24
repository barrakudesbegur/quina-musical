// The Worker: checks Cloudflare Access once, for the routes that need it, then hands the request to the
// edition's GameRoom. Static files never get here (wrangler.jsonc `run_worker_first`).
import { identityLabel, requireAccess, type AccessEnv } from './access.ts';
import { CLOUD } from './config.ts';
import { findRoute, mediaId } from './domain/routes.ts';
import { GameRoom, IDENTITY_HEADER } from './game-room.ts';

export { GameRoom };

type WorkerEnv = Env & AccessEnv;

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
    if (route.name === 'media') return media(request, env, ctx, mediaId(url.pathname) as string);
    const room = roomOf(env);
    switch (route.name) {
      case 'plan': {
        if (request.method === 'GET') return json({ plan: await room.getPlan() });
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
        const body = await readBody(request, CLOUD.media.maxBytes);
        if (body === null) return text(413, `files of at most ${CLOUD.media.maxBytes / 1024} KB`);
        const saved = await room.putMedia(body, (request.headers.get('content-type') ?? '').split(';')[0]?.trim() ?? '');
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
        const resumed = await room.resumeGame(gameId, identity);
        return json(resumed, {}, resumed.ok ? 200 : 404);
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
async function media(request: Request, env: Env, ctx: ExecutionContext, id: string): Promise<Response> {
  const cache = caches.default;
  const cached = await cache.match(request);
  if (cached) return cached;
  const file = await roomOf(env).getMedia(id);
  if (!file) return text(404, 'not found');
  const response = new Response(file.bytes, {
    headers: { 'content-type': file.contentType, 'cache-control': 'public, max-age=31536000, immutable', 'x-content-type-options': 'nosniff' },
  });
  ctx.waitUntil(cache.put(request, response.clone()));
  return response;
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
