// The Worker: checks Cloudflare Access once, for the routes that need it, then hands the request to the
// edition's GameRoom. Static files never get here (wrangler.jsonc `run_worker_first`).
import { identityLabel, requireAccess, type AccessEnv } from './access.ts';
import { CLOUD } from './config.ts';
import { findRoute } from './domain/routes.ts';
import { GameRoom, IDENTITY_HEADER } from './game-room.ts';

export { GameRoom };

type WorkerEnv = Env & AccessEnv;

export default {
  async fetch(request, env): Promise<Response> {
    const url = new URL(request.url);
    const route = findRoute(url.pathname);
    if (!route) return text(404, 'not found');
    if (route.websocket && request.headers.get('upgrade')?.toLowerCase() !== 'websocket') return text(426, 'expected a WebSocket');
    if (!route.websocket && request.method !== 'GET') return text(405, 'only GET');

    let identity = 'public';
    if (route.access) {
      const result = await requireAccess(request, env, route.access);
      if (result instanceof Response) return result;
      identity = identityLabel(result);
    }

    if (route.name === 'health') return json({ ok: true, edition: env.EDITION });
    const room = roomOf(env);
    switch (route.name) {
      case 'export':
        return json(await room.exportEdition(), { 'content-disposition': `attachment; filename="quina-${env.EDITION}-export.json"` });
      case 'stats':
        return json(await room.getStats());
      case 'feed':
      case 'show': {
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

function json(body: unknown, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), { headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...headers } });
}

function text(status: number, body: string): Response {
  return new Response(`${body}\n`, { status, headers: { 'content-type': 'text/plain; charset=utf-8' } });
}
