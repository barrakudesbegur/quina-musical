// Admin's views, one per URL hash (#preparacio, #json, #nit, #eines, #xuleta), so a link or a reload opens
// the same view and the cheat sheet can be opened directly at /manage/#xuleta. Pure.

export const ROUTES = ['preparacio', 'json', 'nit', 'eines', 'xuleta'] as const;
export type Route = (typeof ROUTES)[number];
export const DEFAULT_ROUTE: Route = 'preparacio';

/** "#nit" → "nit"; anything unknown → the default view. */
export function routeFromHash(hash: string): Route {
  const name = hash.replace(/^#\/?/, '').split(/[?/]/)[0];
  return (ROUTES as readonly string[]).includes(name) ? (name as Route) : DEFAULT_ROUTE;
}
