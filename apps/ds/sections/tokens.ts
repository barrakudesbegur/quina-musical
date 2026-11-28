// The gallery's Tokens section reads every value from the stylesheets the page loaded (CSSOM), never from a copy, so it
// can't drift from packages/ui/tokens.css or the apps' own sheets: each custom property declared in a style rule, with
// the file it comes from (Vite's dev id; in the gallery's build, the file's mark), its selector and the cascade layer it sits in. Helpers turn a declared value
// into what the page draws: var() references resolved, a colour's hex, a duration's milliseconds, an easing's curve.
// Development only, like the rest of apps/ds.

/** One custom property declaration in a loaded stylesheet. */
export interface TokenDecl {
  name: string;
  /** The value as declared (var() references kept). */
  raw: string;
  /** The stylesheet's repo path (packages/ui/tokens.css), or its id when it isn't one of the repo's files. */
  file: string;
  selector: string;
  /** The cascade layers it sits in, outermost first. */
  layers: string[];
  /** The @media / @supports / @container conditions around it. */
  conditions: string[];
}

/** A stylesheet's repo path: Vite's dev id (an absolute path), or the gallery's own tag for a sheet it built. */
export function sheetFile(sheet: CSSStyleSheet): string {
  const node = sheet.ownerNode instanceof HTMLElement ? sheet.ownerNode : null;
  const id = node?.dataset.dsSource ?? node?.dataset.viteDevId ?? sheet.href ?? 'inline';
  const repo = id.match(/\/((?:apps|packages)\/[^?#]+)/);
  return repo ? (repo[1] as string) : id;
}

/**
 * The file a rule of the gallery's build comes from: there, Vite bundles the stylesheets into a few, and
 * apps/show/vite.config.ts › galleryCssSources starts each file's part with `ds-source { --ds-source: "<path>" }`.
 */
function sourceMark(rule: CSSRule): string | null {
  if (!(rule instanceof CSSStyleRule) || rule.selectorText !== 'ds-source') return null;
  const value = rule.style.getPropertyValue('--ds-source').trim();
  return value ? (JSON.parse(value) as string) : null;
}

function walk(rules: CSSRuleList, file: string, layers: string[], conditions: string[], out: TokenDecl[]): void {
  for (const rule of Array.from(rules)) {
    const mark = sourceMark(rule);
    if (mark !== null) {
      file = mark;
      continue;
    }
    if (rule instanceof CSSStyleRule) {
      for (const name of Array.from(rule.style)) {
        if (name.startsWith('--')) out.push({ name, raw: rule.style.getPropertyValue(name).trim(), file, selector: rule.selectorText, layers, conditions });
      }
    } else if (rule instanceof CSSImportRule) {
      if (rule.styleSheet) walk(rule.styleSheet.cssRules, sheetFile(rule.styleSheet), rule.layerName ? [...layers, rule.layerName] : layers, conditions, out);
    } else if (rule instanceof CSSLayerBlockRule) {
      walk(rule.cssRules, file, [...layers, rule.name], conditions, out);
    } else if (rule instanceof CSSConditionRule) {
      walk(rule.cssRules, file, layers, [...conditions, rule.conditionText], out);
    } else if (rule instanceof CSSGroupingRule) {
      walk(rule.cssRules, file, layers, conditions, out);
    }
  }
}

/** Every custom property declared in the page's stylesheets, in cascade source order. */
export function readTokenDecls(doc: Document = document): TokenDecl[] {
  const out: TokenDecl[] = [];
  for (const sheet of Array.from(doc.styleSheets)) {
    try {
      walk(sheet.cssRules, sheetFile(sheet), [], [], out);
    } catch {
      // A cross-origin sheet hides its rules; the gallery loads none.
    }
  }
  return out;
}

/** The cascade layer statement the page starts with (apps/show/vite.config.ts), as the page has it. */
export function pageLayerOrder(doc: Document = document): string[] | null {
  for (const sheet of Array.from(doc.styleSheets)) {
    for (const rule of Array.from(sheet.cssRules)) if (rule instanceof CSSLayerStatementRule) return Array.from(rule.nameList);
  }
  return null;
}

// ---- values ----------------------------------------------------------------------------------------------

/**
 * `raw` with every var() replaced by `lookup(name)` (itself resolved), else by its fallback; a name nobody defines and
 * no fallback stay as written.
 */
export function resolveVars(raw: string, lookup: (name: string) => string | null, depth = 0): string {
  if (depth > 16) return raw;
  let out = '';
  let i = 0;
  while (i < raw.length) {
    const at = raw.indexOf('var(', i);
    if (at < 0) {
      out += raw.slice(i);
      break;
    }
    out += raw.slice(i, at);
    let open = 1;
    let j = at + 4;
    for (; j < raw.length && open > 0; j++) {
      if (raw[j] === '(') open++;
      else if (raw[j] === ')') open--;
    }
    const inner = raw.slice(at + 4, j - 1);
    const comma = inner.indexOf(',');
    const name = (comma < 0 ? inner : inner.slice(0, comma)).trim();
    const fallback = comma < 0 ? null : inner.slice(comma + 1).trim();
    const value = lookup(name);
    out += value !== null ? resolveVars(value, lookup, depth + 1) : fallback !== null ? resolveVars(fallback, lookup, depth + 1) : `var(${inner})`;
    i = j;
  }
  return out;
}

/** A lookup over declarations (the last one of a name wins, as in the cascade), then the root's computed value. */
export function lookupIn(decls: readonly TokenDecl[], root: Element = document.documentElement): (name: string) => string | null {
  const own = new Map(decls.map((d) => [d.name, d.raw]));
  const computed = getComputedStyle(root);
  return (name) => own.get(name) ?? (computed.getPropertyValue(name).trim() || null);
}

let ctx: CanvasRenderingContext2D | null | undefined;
const hex2 = (v: number) => v.toString(16).padStart(2, '0');

/** A resolved CSS colour as #rrggbb (or #rrggbbaa when it is see-through), or null when it isn't a colour. */
export function hexOf(color: string): string | null {
  if (!color || color.includes('var(') || !CSS.supports('color', color)) return null;
  ctx ??= document.createElement('canvas').getContext('2d', { willReadFrequently: true });
  if (!ctx) return null;
  ctx.clearRect(0, 0, 1, 1);
  ctx.fillStyle = '#000';
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, 1, 1);
  const [r = 0, g = 0, b = 0, a = 0] = ctx.getImageData(0, 0, 1, 1).data;
  return `#${hex2(r)}${hex2(g)}${hex2(b)}${a < 255 ? hex2(a) : ''}`;
}

let probe: HTMLElement | null = null;

/** What the browser computes for `property: value` on a hidden element under <body> (calc() and units resolved). */
export function computedAs(property: string, value: string): string {
  if (!probe) {
    probe = document.createElement('span');
    probe.hidden = true;
    probe.dataset.dsProbe = '';
    document.body.append(probe);
  }
  probe.style.setProperty(property, value);
  const out = getComputedStyle(probe).getPropertyValue(property).trim();
  probe.style.removeProperty(property);
  return out;
}

/** A resolved duration in ms, or null when it isn't one. */
export function msOf(value: string): number | null {
  if (!value || value.includes('var(') || !CSS.supports('transition-duration', value)) return null;
  const s = computedAs('transition-duration', value).split(',')[0]?.trim() ?? '';
  const m = s.match(/^(-?[\d.]+)(ms|s)$/);
  return m ? Number(m[1]) * (m[2] === 's' ? 1000 : 1) : null;
}

/** A resolved length in px, or null when it isn't an absolute one. */
export function pxOf(value: string): number | null {
  if (!value || value.includes('var(') || !CSS.supports('width', value)) return null;
  const m = computedAs('width', value).match(/^(-?[\d.]+)px$/);
  return m ? Number(m[1]) : null;
}

/** A file the build copied into its assets folder, named with Vite's content hash: «/assets/nino-afro-B8LgNj0y.svg». */
const BUILT_ASSET = /^\/assets\/(?:.*\/)?[^/]+-[\w-]{8}\.\w+$/;

/** A file's name as the source names it: a built asset's without its hash, so the build's captions read as development's. */
function sourceName(url: string): string {
  const path = url.split(/[?#]/)[0] ?? '';
  const name = path.split('/').pop() ?? '';
  return BUILT_ASSET.test(path) ? name.replace(/-[\w-]{8}(\.\w+)$/, '$1') : name;
}

/** A value as a caption shows it: an image's url() names only its file (a data: URL only its type), never a long path. */
export function tidyValue(raw: string): string {
  let out = '';
  let i = 0;
  for (let at = raw.indexOf('url(', i); at >= 0; at = raw.indexOf('url(', i)) {
    out += raw.slice(i, at);
    const quote = raw[at + 4] === '"' || raw[at + 4] === "'" ? (raw[at + 4] as string) : '';
    const end = quote ? raw.indexOf(`${quote})`, at + 5) + 1 : raw.indexOf(')', at + 4);
    if (end <= 0) return out + raw.slice(at);
    const url = raw.slice(at + 4 + quote.length, end - quote.length);
    out += url.startsWith('data:') ? `url(${url.slice(0, url.search(/[;,]/))}…)` : `url(…/${sourceName(url)})`;
    i = end + 1;
  }
  return out + raw.slice(i);
}

export const formatMs = (ms: number): string => (ms >= 1000 ? `${Math.round(ms / 10) / 100} s` : `${Math.round(ms * 10) / 10} ms`);
export const formatPx = (px: number): string => `${Math.round(px * 100) / 100} px`;

// ---- easing --------------------------------------------------------------------------------------------------

/** Points (x = time 0..1, y = progress) along an easing function, or null for one this can't draw (steps()). */
export function easingPoints(value: string): [number, number][] | null {
  const v = value.trim();
  const KEYWORDS: Record<string, [number, number, number, number]> = {
    ease: [0.25, 0.1, 0.25, 1],
    'ease-in': [0.42, 0, 1, 1],
    'ease-out': [0, 0, 0.58, 1],
    'ease-in-out': [0.42, 0, 0.58, 1],
  };
  if (v === 'linear') return [[0, 0], [1, 1]];
  const keyword = KEYWORDS[v];
  if (keyword) return bezier(...keyword);
  const cubic = v.match(/^cubic-bezier\(([^)]*)\)$/);
  if (cubic) {
    const n = (cubic[1] as string).split(',').map(Number);
    return n.length === 4 && n.every(Number.isFinite) ? bezier(n[0] as number, n[1] as number, n[2] as number, n[3] as number) : null;
  }
  const lin = v.match(/^linear\((.*)\)$/s);
  return lin ? linearStops(lin[1] as string) : null;
}

function bezier(x1: number, y1: number, x2: number, y2: number): [number, number][] {
  const at = (t: number, a: number, b: number) => 3 * (1 - t) ** 2 * t * a + 3 * (1 - t) * t ** 2 * b + t ** 3;
  return Array.from({ length: 65 }, (_, i) => {
    const t = i / 64;
    return [at(t, x1, x2), at(t, y1, y2)];
  });
}

/** linear()'s stops (CSS Easing 2): each an output with up to two input percentages; missing ones spread evenly. */
function linearStops(list: string): [number, number][] | null {
  const stops: { y: number; x: number | null }[] = [];
  for (const part of list.split(',')) {
    const [out, ...at] = part.trim().split(/\s+/);
    const y = Number(out);
    if (!Number.isFinite(y)) return null;
    if (!at.length) stops.push({ y, x: null });
    for (const p of at) stops.push({ y, x: Number.parseFloat(p) / 100 });
  }
  if (stops.length < 2) return null;
  const first = stops[0] as { y: number; x: number | null };
  const last = stops[stops.length - 1] as { y: number; x: number | null };
  first.x ??= 0;
  last.x ??= 1;
  // An input never goes back: each is at least the largest before it.
  let max = 0;
  for (const s of stops) if (s.x !== null) s.x = max = Math.max(max, s.x);
  for (let i = 1; i < stops.length; i++) {
    if (stops[i]?.x !== null) continue;
    let j = i;
    while (stops[j]?.x === null) j++;
    const from = stops[i - 1]?.x as number;
    const to = stops[j]?.x as number;
    for (let k = i; k < j; k++) (stops[k] as { x: number | null }).x = from + ((to - from) * (k - i + 1)) / (j - i + 1);
    i = j;
  }
  return stops.map((s) => [s.x as number, s.y]);
}
