// Londrina is always in capitals (D96, D114). CSS can't select by font, and a component picks its font per variant, so
// the capitals go beside the font: every rule that sets the display font (`font-family` or `font` with
// `var(--font-display…)`) says `text-transform: uppercase` in the same block, or `none` when its whole text is a number
// with its unit ("4 s", "10:14 pm"). A unit inside a capitals block is wrapped in `.unit` (packages/ui/base.css).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';

const REPO = path.resolve(import.meta.dirname, '../../../../..');
const ROOTS = ['packages/ui', 'apps/console', 'apps/player', 'apps/stage', 'apps/admin', 'apps/ds'];
const SKIP = new Set(['node_modules', 'dist', 'assets', 'fixtures', 'public']);

function files(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (SKIP.has(name)) continue;
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) files(full, out);
    else if (/\.(css|svelte)$/.test(name)) out.push(full);
  }
  return out;
}

/** A stylesheet's CSS, or a component's <style> blocks, comments blanked (line numbers kept). */
function css(file: string): string {
  const text = readFileSync(file, 'utf8');
  const blank = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, (c) => c.replace(/[^\n]/g, ' '));
  if (file.endsWith('.css')) return blank(text);
  // Keep the lines before each <style> so a problem's line number is the file's.
  return blank(text.replace(/^[\s\S]*?<style[^>]*>|<\/style>[\s\S]*?(<style[^>]*>|$)/g, (m) => m.replace(/[^\n]/g, '')));
}

/** The innermost blocks that set the display font without a text-transform of uppercase or none: "line: selector". */
export function capsProblems(source: string): string[] {
  const found: string[] = [];
  for (const m of source.matchAll(/([^{}]*)\{([^{}]*)\}/g)) {
    const body = m[2] as string;
    if (!/(?:^|[;{\s])font(?:-family)?\s*:[^;]*var\(--font-display\b/.test(body)) continue;
    const transform = body.match(/text-transform\s*:\s*([^;]+?)\s*(?:;|$)/)?.[1];
    if (transform === 'uppercase' || transform === 'none') continue;
    const line = source.slice(0, (m.index ?? 0) + (m[1] as string).length).split('\n').length;
    found.push(`${line}: ${(m[1] as string).trim().replace(/\s+/g, ' ')}${transform ? ` (text-transform: ${transform})` : ''}`);
  }
  return found;
}

test('the lint finds a Londrina block without its capitals', () => {
  assert.deepEqual(capsProblems('.a {\n  font-family: var(--font-display);\n  text-transform: uppercase;\n}'), []);
  assert.deepEqual(capsProblems('.a { font: 900 2rem/1 var(--font-display); text-transform: none }'), []);
  assert.deepEqual(capsProblems('.a { font-family: var(--font-body) }'), []);
  assert.deepEqual(capsProblems('@layer app {\n.a {\n  font-family: var(--font-display, sans-serif);\n}\n}'), ['2: .a']);
  assert.deepEqual(capsProblems('.a, .b { font-family: var(--font-display); text-transform: capitalize; }'), ['1: .a, .b (text-transform: capitalize)']);
});

test('every rule that sets Londrina sets its capitals (D96, D114)', () => {
  const found: string[] = [];
  let checked = 0;
  for (const root of ROOTS) {
    for (const file of files(path.join(REPO, root))) {
      const rel = path.relative(REPO, file).split(path.sep).join('/');
      const source = css(file);
      if (/var\(--font-display\b/.test(source)) checked++;
      for (const problem of capsProblems(source)) found.push(`${rel}:${problem}`);
    }
  }
  assert.ok(checked > 15, `only ${checked} stylesheets set Londrina`);
  assert.deepEqual(found, [], `Londrina without text-transform: uppercase (or none for a number with its unit):\n${found.join('\n')}`);
});
