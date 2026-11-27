// Every stylesheet declares its cascade layer; nothing is unlayered (packages/ui/README.md › Cascade layers). An
// unlayered rule beats every layered one, and two rules of one weight in the same layer still flip with the order
// Vite loads the files in (the dev server and the build differ), so each file's rules sit in its own layer by path
// (packages/ui/layers.ts › layerFor): `@layer <name> { … }` blocks holding all of a stylesheet after its @imports, and
// all of a component's <style> (an app's files may also hold `defaults` blocks). An @import names its layer too, or
// brings a file that names its own.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { CSS_LAYERS, LAYER_STATEMENT, layersAllowed } from '../../../../../packages/ui/layers.ts';

const REPO = path.resolve(import.meta.dirname, '../../../../..');
const ROOTS = ['packages/ui', 'apps/console', 'apps/player', 'apps/stage', 'apps/admin', 'apps/ds', 'apps/show/engine', 'apps/show/remote'];
const SKIP = new Set(['node_modules', 'dist', 'assets', 'fixtures', 'public']);

function files(dir: string, out: string[] = []): string[] {
  let names: string[];
  try {
    names = readdirSync(dir);
  } catch {
    return out;
  }
  for (const name of names) {
    if (SKIP.has(name)) continue;
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) files(full, out);
    else if (/\.(css|svelte|html)$/.test(name)) out.push(full);
  }
  return out;
}

/**
 * What's wrong with one stylesheet's CSS (comments already removed), or null: only @import statements (each with
 * `layer(…)`, or of a relative file, which this test checks on its own), then nothing but `@layer <name> { … }`
 * blocks, each named one of `allowed`.
 */
export function layerProblem(source: string, allowed: readonly string[]): string | null {
  let rest = source.trim();
  for (let m = rest.match(/^@import\s+([^;]+);/); m; m = rest.match(/^@import\s+([^;]+);/)) {
    const spec = m[1] as string;
    if (!/\blayer\(\w+\)/.test(spec) && !/^['"]\.\.?\//.test(spec)) return `@import ${spec} names no layer`;
    rest = rest.slice(m[0].length).trim();
  }
  while (rest) {
    const open = rest.match(/^@layer\s+([\w.-]+)\s*\{/);
    if (!open) return `rules outside a layer (at "${rest.slice(0, 40).replace(/\s+/g, ' ')}")`;
    if (!allowed.includes(open[1] as string)) return `in @layer ${open[1]}, but its folder's layer is ${allowed.join(' or ')}`;
    // The block's closing brace (strings skipped: a brace in a string doesn't count).
    let depth = 0;
    let end = -1;
    for (let i = open[0].length - 1; i < rest.length && end < 0; i++) {
      const c = rest[i];
      if (c === '"' || c === "'") {
        const close = rest.indexOf(c, i + 1);
        i = close < 0 ? rest.length : close;
      } else if (c === '{') depth++;
      else if (c === '}' && --depth === 0) end = i;
    }
    if (end < 0) return 'a @layer block never closes';
    rest = rest.slice(end + 1).trim();
  }
  return null;
}

/** The CSS a file holds, comments removed: a stylesheet whole; a component's or a page's <style> blocks. */
function blocks(file: string): string[] {
  const text = readFileSync(file, 'utf8');
  const strip = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, '');
  if (file.endsWith('.css')) return [strip(text)];
  return [...text.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)].map((m) => strip(m[1] as string));
}

test('the lint takes a wrapped stylesheet and refuses the unlayered ones', () => {
  const app = ['app', 'defaults'];
  assert.equal(layerProblem("@import './a.css';\n@layer app {\n.a { color: red }\n@media print { .a { color: blue } }\n}\n", app), null);
  assert.equal(layerProblem('@layer app {\n.a {}\n}\n@layer defaults {\n.icon {}\n}\n@layer app {\n.b {}\n}', app), null);
  assert.equal(layerProblem("@import '@fontsource/x.css' layer(tokens);", ['tokens']), null);
  assert.match(layerProblem("@import '@fontsource/x.css';", ['tokens']) ?? '', /names no layer/);
  assert.match(layerProblem('.a { color: red }', app) ?? '', /outside a layer/);
  assert.match(layerProblem('@layer components {\n.a {}\n}', app) ?? '', /folder's layer is app or defaults/);
  assert.match(layerProblem('@layer app {\n.a {}\n}\n.b {}', app) ?? '', /outside a layer/);
  assert.match(layerProblem('@layer app {\n.a {\n}', app) ?? '', /never closes/);
});

test('the layer order is declared once, weakest first, with the app last', () => {
  assert.equal(LAYER_STATEMENT, '@layer reset, tokens, resources, defaults, components, recipes, app;');
  assert.equal(CSS_LAYERS.at(-1), 'app');
});

test('every stylesheet and every <style> sits in its folder\'s cascade layer (nothing unlayered)', () => {
  const found: string[] = [];
  let checked = 0;
  for (const root of ROOTS) {
    for (const file of files(path.join(REPO, root))) {
      const rel = path.relative(REPO, file).split(path.sep).join('/');
      const allowed = layersAllowed(rel);
      for (const css of blocks(file)) {
        checked++;
        const problem = allowed.length ? layerProblem(css, allowed) : 'no layer for this folder (packages/ui/layers.ts › layerFor)';
        if (problem) found.push(`${rel}: ${problem}`);
      }
    }
  }
  assert.ok(checked > 80, `only ${checked} stylesheets found`);
  assert.deepEqual(found, [], `every stylesheet declares its layer (packages/ui/README.md › Cascade layers):\n${found.join('\n')}`);
});
