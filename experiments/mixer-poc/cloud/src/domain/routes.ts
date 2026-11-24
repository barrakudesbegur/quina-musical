// The Worker's routes, and who may use each. Pure, so the access table is tested on its own. Static files
// (the player app, covers) never reach the Worker: wrangler.jsonc's `run_worker_first` lists only these paths.
import type { AccessRule } from '../access.ts';

export type RouteName = 'feed' | 'show' | 'console' | 'export' | 'stats' | 'health';

export interface Route {
  name: RouteName;
  /** The route only takes WebSocket upgrades. */
  websocket: boolean;
  /** null: public. Otherwise Cloudflare Access, for people and/or service tokens. */
  access: AccessRule | null;
}

const PEOPLE: AccessRule = { people: true, services: false };
const SERVICES: AccessRule = { people: false, services: true };

export const ROUTES: Readonly<Record<string, Route>> = Object.freeze({
  /** Players' phones: the public feed. */
  '/feed': { name: 'feed', websocket: true, access: null },
  /** The show laptop's cloud link (its Access service token). */
  '/ws/show': { name: 'show', websocket: true, access: SERVICES },
  /** Presenters' and admins' consoles: the relay protocol, through the cloud (organizers). */
  '/ws/console': { name: 'console', websocket: true, access: PEOPLE },
  /** The whole edition as JSON: every Game's journal and record (admins). */
  '/api/export': { name: 'export', websocket: false, access: PEOPLE },
  /** Connections, messages and SQLite rows since the GameRoom last woke (admins, the load test). */
  '/api/stats': { name: 'stats', websocket: false, access: PEOPLE },
  /** Liveness, without waking the GameRoom. */
  '/api/health': { name: 'health', websocket: false, access: null },
});

export function findRoute(pathname: string): Route | null {
  return Object.hasOwn(ROUTES, pathname) ? (ROUTES[pathname] ?? null) : null;
}
