// R5 (the user's comment of 27 Nov): focus styles use :focus-visible only, never a bare :focus, so a tap or a click
// never draws a focus ring. This reads every stylesheet and every component's <style> in the screens' code and fails
// on a :focus that isn't :focus-visible. (:focus-within is a different selector, allowed for behaviour, such as
// showing a visually hidden skip link; a ring on a field's box uses :has(:focus-visible).)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';

const REPO = path.resolve(import.meta.dirname, '../../../../..');
const ROOTS = ['packages/ui', 'apps/console', 'apps/player', 'apps/stage', 'apps/admin', 'apps/ds'];
const SKIP = new Set(['node_modules', 'dist', 'assets', 'fixtures']);

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
    else if (name.endsWith('.css') || name.endsWith('.svelte')) out.push(full);
  }
  return out;
}

/** The CSS in a file: a stylesheet whole, a component's <style> blocks; comments removed. */
function css(file: string): string {
  const text = readFileSync(file, 'utf8');
  const source = file.endsWith('.svelte') ? [...text.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)].map((m) => m[1]).join('\n') : text;
  return source.replace(/\/\*[\s\S]*?\*\//g, '');
}

/** The bare :focus selectors in some CSS (a line number for each). */
export function bareFocus(source: string): number[] {
  const lines: number[] = [];
  source.split('\n').forEach((line, i) => {
    if (/:focus(?![-\w])/.test(line)) lines.push(i + 1);
  });
  return lines;
}

test('the lint finds a bare :focus and lets :focus-visible and :focus-within be', () => {
  assert.deepEqual(bareFocus('a:focus { outline: 0 }\nb:focus-visible {}\nc:focus-within {}\nd:not(:focus) {}'), [1, 4]);
});

test('no stylesheet or component uses a bare :focus (R5: :focus-visible only)', () => {
  const found: string[] = [];
  for (const root of ROOTS) {
    for (const file of files(path.join(REPO, root))) {
      for (const line of bareFocus(css(file))) found.push(`${path.relative(REPO, file)} (CSS line ${line})`);
    }
  }
  assert.deepEqual(found, [], `a bare :focus draws a ring on a tap too; use :focus-visible:\n${found.join('\n')}`);
});
