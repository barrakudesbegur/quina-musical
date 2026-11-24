// The Worker's routes, and who may use each. Pure, so the access table is tested on its own. Static files
// (the player app, covers) never reach the Worker: wrangler.jsonc's `run_worker_first` lists only these paths.
import type { AccessRule } from '../access.ts';

export type RouteName = 'feed' | 'show' | 'console' | 'plan' | 'upload' | 'media' | 'games' | 'resume' | 'export' | 'stats' | 'health';

export interface Route {
  name: RouteName;
  /** The route only takes WebSocket upgrades. */
  websocket: boolean;
  /** null: public. Otherwise Cloudflare Access, for people and/or service tokens. */
  access: AccessRule | null;
  /** The HTTP methods it takes (WebSocket routes: GET). */
  methods: readonly string[];
}

const GET = ['GET'] as const;

const PEOPLE: AccessRule = { people: true, services: false };
const SERVICES: AccessRule = { people: false, services: true };

export const ROUTES: Readonly<Record<string, Route>> = Object.freeze({
  /** Players' phones: the public feed. */
  '/feed': { name: 'feed', websocket: true, access: null, methods: GET },
  /** The show laptop's cloud link (its Access service token). */
  '/ws/show': { name: 'show', websocket: true, access: SERVICES, methods: GET },
  /** Presenters' and admins' consoles: the relay protocol, through the cloud (organizers). */
  '/ws/console': { name: 'console', websocket: true, access: PEOPLE, methods: GET },
  /** The Game plan: Admin reads it (GET) and saves it whole (PUT, checked with checkGamePlan). */
  '/api/plan': { name: 'plan', websocket: false, access: PEOPLE, methods: ['GET', 'PUT'] },
  /** Admin uploads a logo or prize picture (the body is the image); answers its /media/ path. */
  '/api/media': { name: 'upload', websocket: false, access: PEOPLE, methods: ['POST'] },
  /** The whole edition as JSON: every Game's journal and record (admins). */
  /** The edition's Games (rehearsals, the night), newest first: Admin's resume picker. */
  '/api/games': { name: 'games', websocket: false, access: PEOPLE, methods: GET },
  /** Admin's manual resume: `{ gameId }` becomes current and its journal goes to the laptop. */
  '/api/resume': { name: 'resume', websocket: false, access: PEOPLE, methods: ['POST'] },
  '/api/export': { name: 'export', websocket: false, access: PEOPLE, methods: GET },
  /** Connections, messages and SQLite rows since the GameRoom last woke (admins, the load test). */
  '/api/stats': { name: 'stats', websocket: false, access: PEOPLE, methods: GET },
  /** Liveness, without waking the GameRoom. */
  '/api/health': { name: 'health', websocket: false, access: null, methods: GET },
});

/** Uploaded media, by content hash: public and immutable (phones, the projector). */
export const MEDIA_ROUTE: Route = Object.freeze({ name: 'media', websocket: false, access: null, methods: GET });
const MEDIA_PATH = /^\/media\/([0-9a-f]{32})\.(webp|png|jpg)$/;

export function findRoute(pathname: string): Route | null {
  if (Object.hasOwn(ROUTES, pathname)) return ROUTES[pathname] ?? null;
  return MEDIA_PATH.test(pathname) ? MEDIA_ROUTE : null;
}

/** The media id in a /media/ path, or null. */
export function mediaId(pathname: string): string | null {
  return MEDIA_PATH.exec(pathname)?.[1] ?? null;
}
