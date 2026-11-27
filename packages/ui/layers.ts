// The cascade layers every stylesheet belongs to, weakest first (README.md › Cascade layers). A rule in a later layer
// beats any rule in an earlier one, whatever their weight and whatever order Vite loads the files in (the dev server
// and the build load them differently). apps/show/vite.config.ts declares this order first thing in every page's
// <head>; apps/show/tests/ui/ds/layers-lint.test.ts checks that every stylesheet and every component's <style> names
// its layer (`layerFor`); tools/e2e/css-order compares the dev server with the build.
export const CSS_LAYERS = [
  /** base.css: the element defaults (box sizing, body, button, input, the focus ring) and the plain utilities. */
  'reset',
  /** tokens.css, fonts.css, ds/palette.css: values only (custom properties, the font faces, the palette slots). */
  'tokens',
  /** ds/resources.css, ds/mark.css: the design resources every component shares (rings, the press, patterns…). */
  'resources',
  /** The overridable defaults, where weight decides as it always did: an app's own defaults for what the components
   *  also draw (its `.icon` size, a cover's frame, its title type, the stage's element reset, the throw stickers), and
   *  the zero-weight `:where()` bases of components those defaults tune (Cover's, SongTile's). Blocks in those files. */
  'defaults',
  /** components/, icons/, wii/: the design system's components. */
  'components',
  /** recipes/: the domain's compositions of components (the prize card, the ticket). */
  'recipes',
  /** apps/: each app's own stylesheets and components; its contexts tune the components inside them. */
  'app',
] as const;

export type CssLayer = (typeof CSS_LAYERS)[number];

/** The layer statement every page starts with. */
export const LAYER_STATEMENT = `@layer ${CSS_LAYERS.join(', ')};`;

/** The layer a stylesheet (or a component's <style>) belongs to, by its repo path; null for code outside the screens
 *  (apps/cards, apps/cloud and legacy/ keep their own CSS). An app's or a component's file may also hold `defaults`
 *  blocks (`layersAllowed`). */
export function layerFor(repoPath: string): CssLayer | null {
  if (repoPath === 'packages/ui/base.css') return 'reset';
  if (['packages/ui/tokens.css', 'packages/ui/fonts.css', 'packages/ui/ds/palette.css'].includes(repoPath)) return 'tokens';
  if (repoPath.startsWith('packages/ui/ds/')) return 'resources';
  if (/^packages\/ui\/(components|icons|wii)\//.test(repoPath)) return 'components';
  if (repoPath.startsWith('packages/ui/recipes/')) return 'recipes';
  if (repoPath.startsWith('apps/') && !/^apps\/(cards|cloud)\//.test(repoPath)) return 'app';
  return null;
}

/** The layers a file's blocks may use: its own, and `defaults` too in an app's file or a component's. */
export function layersAllowed(repoPath: string): CssLayer[] {
  const layer = layerFor(repoPath);
  if (!layer) return [];
  return layer === 'app' || layer === 'components' ? [layer, 'defaults'] : [layer];
}
