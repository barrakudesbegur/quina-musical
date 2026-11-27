// What the CSS order check (check.ts) records of a page, and how two records compare. A page's snapshot is every
// element's computed style (and its ::before and ::after when they draw), for the properties below, plus the order
// its stylesheets loaded in. `dumpPage` runs inside the page; `comparePages` is pure.

/** The properties compared: what a flipped rule can change on screen. Custom properties are left out (their effect
 *  shows in these), and so are the ones only an animation's timing moves. */
export const PROPS = [
  'display', 'position', 'top', 'right', 'bottom', 'left', 'z-index', 'float', 'box-sizing',
  'width', 'height', 'min-width', 'min-height', 'max-width', 'max-height', 'aspect-ratio',
  'margin-top', 'margin-right', 'margin-bottom', 'margin-left',
  'padding-top', 'padding-right', 'padding-bottom', 'padding-left',
  'border-top-width', 'border-right-width', 'border-bottom-width', 'border-left-width',
  'border-top-style', 'border-right-style', 'border-bottom-style', 'border-left-style',
  'border-top-color', 'border-right-color', 'border-bottom-color', 'border-left-color',
  'border-top-left-radius', 'border-top-right-radius', 'border-bottom-right-radius', 'border-bottom-left-radius',
  'outline-style', 'outline-width', 'outline-color', 'outline-offset',
  'box-shadow', 'background-color', 'background-image', 'background-size', 'background-position', 'background-repeat', 'background-clip',
  'color', 'opacity', 'visibility', 'overflow-x', 'overflow-y', 'clip-path', 'mask-image',
  'transform', 'translate', 'scale', 'rotate', 'transform-origin', 'filter', 'backdrop-filter', 'mix-blend-mode', 'isolation',
  'font-family', 'font-size', 'font-weight', 'font-style', 'line-height', 'letter-spacing', 'text-transform', 'text-align',
  'text-decoration-line', 'text-shadow', 'white-space-collapse', 'text-wrap-mode', 'text-wrap-style', 'text-overflow',
  'overflow-wrap', 'word-break', '-webkit-line-clamp', 'vertical-align', '-webkit-text-stroke-width', '-webkit-text-stroke-color', 'paint-order',
  'flex-direction', 'flex-wrap', 'flex-grow', 'flex-shrink', 'flex-basis', 'order',
  'align-items', 'align-self', 'align-content', 'justify-content', 'justify-items', 'justify-self', 'row-gap', 'column-gap',
  'grid-template-columns', 'grid-template-rows', 'grid-template-areas', 'grid-auto-flow', 'grid-auto-rows', 'grid-auto-columns',
  'grid-row-start', 'grid-row-end', 'grid-column-start', 'grid-column-end',
  'object-fit', 'object-position', 'fill', 'stroke', 'stroke-width', 'stroke-dasharray', 'stroke-linecap', 'stroke-linejoin',
  'cursor', 'pointer-events', 'user-select', 'touch-action', 'content', 'container-type', 'contain', 'list-style-type',
  'accent-color', 'caret-color', 'appearance', 'color-scheme', 'animation-name', 'transition-property', 'transition-duration',
] as const;

/** One element (or its ::before / ::after): its key and its values, in PROPS order, as indexes into the page's
 *  value table. */
export interface ElementRecord {
  /** `div.player` for an element, `div.player::after` for a pseudo-element: what elements are matched by. */
  key: string;
  /** Up to three ancestors' keys, for the report. */
  path: string;
  values: number[];
}

export interface PageSnapshot {
  name: string;
  url: string;
  /** The stylesheets in the order they apply (Vite's dev ids, or the build's files). */
  sheets: string[];
  /** Every distinct value on the page. */
  table: string[];
  /** Font faces that failed to load: the text then measures in a fallback face and every width differs. */
  fontErrors: string[];
  elements: ElementRecord[];
}

/**
 * Runs in the page (page.evaluate): the snapshot's elements, values and stylesheets. Every running animation is
 * cancelled first, so the values are the cascade's, not a moment of a tween. Svelte's scoping classes
 * (`svelte-…`) are left out of the keys: they change with the component's CSS.
 */
export function dumpPage(props: readonly string[]): Omit<PageSnapshot, 'name' | 'url'> {
  for (const animation of document.getAnimations()) animation.cancel();
  const table: string[] = [];
  const index = new Map<string, number>();
  const intern = (value: string): number => {
    let i = index.get(value);
    if (i === undefined) {
      i = table.length;
      table.push(value);
      index.set(value, i);
    }
    return i;
  };
  // Asset URLs differ by build (a hashed /assets/ file, or a source path): keep the file's name only.
  const normalise = (value: string) =>
    value.includes('url(')
      ? value.replace(/url\("?([^")]*)"?\)/g, (_, url: string) => `url(${url.split(/[?#]/)[0]?.split('/').pop()?.replace(/-[\w-]{8}(\.\w+)$/, '$1')})`)
      : value;
  const keyOf = (el: Element) =>
    el.tagName.toLowerCase() + Array.from(el.classList).filter((c) => !c.startsWith('svelte-')).map((c) => `.${c}`).join('');
  const elements: ElementRecord[] = [];
  for (const el of Array.from(document.querySelectorAll('body *'))) {
    if (el.tagName === 'SCRIPT' || el.tagName === 'STYLE' || el.tagName === 'LINK') continue;
    // Nothing under display: none (a scene that isn't on, a closed drawer): Chrome works its style out on demand,
    // animations included, so the values there are a moment's, and another fixture shows that part anyway.
    if (!el.checkVisibility()) continue;
    const key = keyOf(el);
    const ancestors: string[] = [];
    for (let p = el.parentElement; p && p !== document.body && ancestors.length < 3; p = p.parentElement) ancestors.unshift(keyOf(p));
    const path = ancestors.join(' > ');
    for (const pseudo of [null, '::before', '::after'] as const) {
      const style = getComputedStyle(el, pseudo);
      if (pseudo && (style.content === 'none' || style.content === 'normal')) continue;
      elements.push({ key: pseudo ? key + pseudo : key, path, values: props.map((p) => intern(normalise(style.getPropertyValue(p)))) });
    }
  }
  const sheets = Array.from(document.styleSheets).map((sheet) => {
    const node = sheet.ownerNode as Element | null;
    const id = node?.getAttribute('data-vite-dev-id');
    if (id) return id.replace(/^.*?\/(apps|packages)\//, '$1/');
    if (sheet.href) return new URL(sheet.href).pathname;
    return `inline: ${(node?.textContent ?? '').trim().slice(0, 60)}`;
  });
  const fontErrors: string[] = [];
  document.fonts.forEach((face) => {
    if (face.status === 'error') fontErrors.push(`${face.family} ${face.weight}`);
  });
  return { sheets, table, elements, fontErrors };
}

export interface PropertyDiff {
  page: string;
  key: string;
  path: string;
  prop: string;
  a: string;
  b: string;
}

export interface PageComparison {
  page: string;
  diffs: PropertyDiff[];
  /** Elements only one side has (a structure difference, not a style one). */
  onlyA: string[];
  onlyB: string[];
}

/** Matches two pages' elements by key (a longest common subsequence, so one extra element doesn't shift the rest),
 *  then lists every property that differs. */
export function comparePages(a: PageSnapshot, b: PageSnapshot, props: readonly string[] = PROPS): PageComparison {
  const pairs = alignByKey(a.elements.map((e) => e.key), b.elements.map((e) => e.key));
  const diffs: PropertyDiff[] = [];
  const matchedA = new Set<number>();
  const matchedB = new Set<number>();
  for (const [i, j] of pairs) {
    matchedA.add(i);
    matchedB.add(j);
    const ea = a.elements[i];
    const eb = b.elements[j];
    if (!ea || !eb) continue;
    props.forEach((prop, k) => {
      const va = a.table[ea.values[k] ?? -1] ?? '';
      const vb = b.table[eb.values[k] ?? -1] ?? '';
      if (va !== vb && canonical(prop, va) !== canonical(prop, vb)) diffs.push({ page: a.name, key: ea.key, path: ea.path, prop, a: va, b: vb });
    });
  }
  return {
    page: a.name,
    diffs,
    onlyA: a.elements.filter((_, i) => !matchedA.has(i)).map((e) => e.key),
    onlyB: b.elements.filter((_, j) => !matchedB.has(j)).map((e) => e.key),
  };
}

/**
 * A value as the build's minifier leaves it, where the dev server keeps the author's spelling with the same result:
 * `0%` as `0` in a position or origin (`background: none` becomes `0 0`), a gradient's side keyword as its angle (and
 * the default `to bottom` dropped), a computed `color(srgb …)` (from color-mix or a relative colour) as `rgba()`; and
 * a Svelte component's keyframes, named after a hash of its CSS.
 */
export function canonical(prop: string, value: string): string {
  let v = value;
  // Svelte names a component's keyframes after a hash of its CSS: the same animation under another hash.
  if (prop === 'animation-name') v = v.replace(/\bsvelte-[a-z0-9]+-/g, 'svelte-');
  if (prop === 'background-position' || prop === 'transform-origin' || prop === 'object-position') v = v.replace(/(^|[\s,])0%(?=$|[\s,])/g, '$10px');
  if (v.includes('gradient(')) {
    const angles: Record<string, string> = { top: '0deg', right: '90deg', bottom: '180deg', left: '270deg' };
    v = v.replace(/gradient\(to (top|right|bottom|left), /g, (_, side: string) => `gradient(${angles[side]}, `).replace(/linear-gradient\(180deg, /g, 'linear-gradient(');
  }
  if (v.includes('color(srgb')) {
    v = v.replace(/color\(srgb ([\d.e-]+) ([\d.e-]+) ([\d.e-]+)(?: \/ ([\d.e-]+))?\)/g, (_, r: string, g: string, b: string, a?: string) => {
      const c = [r, g, b].map((x) => Math.round(Number(x) * 255)).join(', ');
      return a === undefined || Number(a) === 1 ? `rgb(${c})` : `rgba(${c}, ${Number(a)})`;
    });
  }
  return v;
}

/** Index pairs of a longest common subsequence of two key lists; identical lists pair up one to one. */
export function alignByKey(a: readonly string[], b: readonly string[]): [number, number][] {
  if (a.length === b.length && a.every((k, i) => k === b[i])) return a.map((_, i) => [i, i]);
  // Trim the common head and tail, then a dynamic programme over the middle.
  let head = 0;
  while (head < a.length && head < b.length && a[head] === b[head]) head++;
  let tail = 0;
  while (tail < a.length - head && tail < b.length - head && a[a.length - 1 - tail] === b[b.length - 1 - tail]) tail++;
  const n = a.length - head - tail;
  const m = b.length - head - tail;
  const pairs: [number, number][] = [];
  for (let i = 0; i < head; i++) pairs.push([i, i]);
  const lcs = Array.from({ length: n + 1 }, () => new Uint32Array(m + 1));
  for (let i = n - 1; i >= 0; i--) {
    const row = lcs[i] as Uint32Array;
    const next = lcs[i + 1] as Uint32Array;
    for (let j = m - 1; j >= 0; j--) row[j] = a[head + i] === b[head + j] ? (next[j + 1] as number) + 1 : Math.max(next[j] as number, row[j + 1] as number);
  }
  for (let i = 0, j = 0; i < n && j < m; ) {
    if (a[head + i] === b[head + j]) {
      pairs.push([head + i, head + j]);
      i++;
      j++;
    } else if ((lcs[i + 1]?.[j] ?? 0) >= (lcs[i]?.[j + 1] ?? 0)) i++;
    else j++;
  }
  for (let t = tail; t > 0; t--) pairs.push([a.length - t, b.length - t]);
  return pairs;
}

/** The report: per page, each differing property once per element key with how many elements share it. */
export function formatComparison(c: PageComparison, labels: [string, string]): string {
  const lines: string[] = [];
  const grouped = new Map<string, { d: PropertyDiff; count: number }>();
  for (const d of c.diffs) {
    const id = `${d.key}\u0000${d.prop}\u0000${d.a}\u0000${d.b}`;
    const g = grouped.get(id);
    if (g) g.count++;
    else grouped.set(id, { d, count: 1 });
  }
  for (const { d, count } of grouped.values()) {
    lines.push(`  ${d.path ? `${d.path} > ` : ''}${d.key}${count > 1 ? ` (×${count})` : ''}\n    ${d.prop}: ${labels[0]} ${d.a} | ${labels[1]} ${d.b}`);
  }
  if (c.onlyA.length) lines.push(`  only in ${labels[0]}: ${summarise(c.onlyA)}`);
  if (c.onlyB.length) lines.push(`  only in ${labels[1]}: ${summarise(c.onlyB)}`);
  return lines.join('\n');
}

function summarise(keys: string[]): string {
  const counts = new Map<string, number>();
  for (const k of keys) counts.set(k, (counts.get(k) ?? 0) + 1);
  const parts = [...counts].slice(0, 12).map(([k, n]) => (n > 1 ? `${k} ×${n}` : k));
  return parts.join(', ') + (counts.size > 12 ? `, … (${keys.length} in all)` : '');
}
