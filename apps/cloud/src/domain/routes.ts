// The Worker's routes, and who may use each. Pure, so the access table is tested on its own. Static files
// (the player app, covers) never reach the Worker: wrangler.jsonc's `run_worker_first` lists only these paths.
import type { AccessRule } from '../access.ts';

export type RouteName = 'feed' | 'show' | 'console' | 'plan' | 'upload' | 'uploadJxl' | 'media' | 'sync' | 'games' | 'resume' | 'phones' | 'notice' | 'sounds' | 'ping' | 'export' | 'stats' | 'health';

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
const ANYONE_SIGNED_IN: AccessRule = { people: true, services: true };
const SERVICES: AccessRule = { people: false, services: true };

export const ROUTES: Readonly<Record<string, Route>> = Object.freeze({
  /** Players' phones: the public feed. */
  '/feed': { name: 'feed', websocket: true, access: null, methods: GET },
  /** The show laptop's cloud link (its Access service token). */
  '/ws/show': { name: 'show', websocket: true, access: SERVICES, methods: GET },
  /** Presenters' and admins' consoles: the relay protocol, through the cloud (organizers). */
  '/ws/console': { name: 'console', websocket: true, access: PEOPLE, methods: GET },
  /** The Game plan: Admin reads it (GET) and saves it whole (PUT, checked with checkGamePlan). */
  // The laptop's service token may read it (a spare laptop's setup fetches it without connecting as the show
  // laptop, which would take over from the one playing) and save it: the edition tool sends the edition's plan up by
  // hand with it (D116, D227), as the link could already do (link.plan). A token of its own for agents is U63.
  '/api/plan': { name: 'plan', websocket: false, access: ANYONE_SIGNED_IN, methods: ['GET', 'PUT'] },
  /**
   * Admin's media: POST a logo or prize picture (the body is the PNG or JPEG fallback, `?name=` optional; answers
   * its /media/ path and key), GET the list for the picker. The laptop's token too: the edition tool uploads the
   * sponsors' logos with the plan that names them.
   */
  '/api/media': { name: 'upload', websocket: false, access: ANYONE_SIGNED_IN, methods: ['GET', 'POST'] },
  /** The whole edition as JSON: every Game's journal and record (admins). */
  /** The edition's Games (rehearsals, the night), newest first: Admin's resume picker. */
  '/api/games': { name: 'games', websocket: false, access: PEOPLE, methods: GET },
  /** Admin's manual resume: `{ gameId }` becomes current and its journal goes to the laptop. */
  '/api/resume': { name: 'resume', websocket: false, access: PEOPLE, methods: ['POST'] },
  /** Phones following the feed now, and the card numbers they follow (anonymous): Admin's "cards opened on phones". */
  '/api/phones': { name: 'phones', websocket: false, access: PEOPLE, methods: GET },
  /** Admin's banner to every phone: `{ notice: string | null }`, sent (PUT) or read back as phones have it (GET). */
  '/api/notice': { name: 'notice', websocket: false, access: PEOPLE, methods: ['GET', 'PUT'] },
  /** The player app's default for interface sounds: `{ soundsDefault: boolean }` (a player's own choice wins); PUT or GET. */
  '/api/sounds': { name: 'sounds', websocket: false, access: PEOPLE, methods: ['GET', 'PUT'] },
  '/api/export': { name: 'export', websocket: false, access: PEOPLE, methods: GET },
  /** Connections, messages and rows since the GameRoom last woke, today's usage against the free plan's daily limits, and the laptop link's lag (admins, the preflight, the load test). */
  // Counts only (no names, no Queue): the laptop's preflight reads today's usage against the free limits too.
  '/api/stats': { name: 'stats', websocket: false, access: ANYONE_SIGNED_IN, methods: GET },
  /** Signed in (the laptop's preflight, organizers): the cloud's clock, edition and current Game. */
  '/api/ping': { name: 'ping', websocket: false, access: ANYONE_SIGNED_IN, methods: GET },
  /** Liveness, without waking the GameRoom. */
  '/api/health': { name: 'health', websocket: false, access: null, methods: GET },
});

/** Uploaded media, by content hash: public and immutable (phones, the projector). WebP: uploads from before JXL. */
export const MEDIA_ROUTE: Route = Object.freeze({ name: 'media', websocket: false, access: null, methods: GET });
const MEDIA_PATH = /^\/media\/([0-9a-f]{32})\.(webp|png|jpg|jxl)$/;

/** Admin attaches the JPEG XL to an uploaded fallback: PUT /api/media/<key>.jxl (the body is the JXL). */
export const MEDIA_JXL_ROUTE: Route = Object.freeze({ name: 'uploadJxl', websocket: false, access: ANYONE_SIGNED_IN, methods: ['PUT'] });
const MEDIA_JXL_PATH = /^\/api\/media\/([0-9a-f]{32})\.jxl$/;

/** The repertoire's media in R2 (C3): `/api/sync/<repertoire>/manifest` and `/api/sync/<repertoire>/file?path=…`. The laptops only. */
export const SYNC_ROUTE: Route = Object.freeze({ name: 'sync', websocket: false, access: SERVICES, methods: ['GET', 'PUT', 'DELETE'] });
const SYNC_PATH = /^\/api\/sync\/([a-z0-9_-]{1,40})\/(manifest|file)$/;

export function findRoute(pathname: string): Route | null {
  if (Object.hasOwn(ROUTES, pathname)) return ROUTES[pathname] ?? null;
  if (SYNC_PATH.test(pathname) || pathname === '/api/sync') return SYNC_ROUTE;
  if (MEDIA_JXL_PATH.test(pathname)) return MEDIA_JXL_ROUTE;
  return MEDIA_PATH.test(pathname) ? MEDIA_ROUTE : null;
}

/** The repertoire and the resource of a sync path, or null. */
export function syncTarget(pathname: string): { repertoire: string; resource: 'manifest' | 'file' } | null {
  const match = SYNC_PATH.exec(pathname);
  return match ? { repertoire: match[1] as string, resource: match[2] as 'manifest' | 'file' } : null;
}

/** The media id in a /media/ path, or null. */
export function mediaId(pathname: string): string | null {
  return MEDIA_PATH.exec(pathname)?.[1] ?? null;
}

/** Whether a /media/ path asks for the JPEG XL. */
export function wantsJxl(pathname: string): boolean {
  return MEDIA_PATH.exec(pathname)?.[2] === 'jxl';
}

/** The key in a PUT /api/media/<key>.jxl path, or null. */
export function jxlUploadKey(pathname: string): string | null {
  return MEDIA_JXL_PATH.exec(pathname)?.[1] ?? null;
}
