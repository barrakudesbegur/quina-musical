// The support lint (packages/ui/baseline.ts): nothing newer than the floor (Safari 18.0 / iOS 18, Chrome on Android
// from two years back) that can hide content or break layout where it's missing, outside a guard. Playwright's WebKit is
// newer than Safari 18, so the browser tests can't see these; on 28 Nov an unguarded scroll-driven animation blanked the
// phone's Historial and cards on an iPhone on iOS 18.
// - CSS (stylesheets, Svelte <style>s and inline `style:` / `style="…"`): a guarded feature sits inside a positive
//   `@supports` that tests it (any member of the same web feature: `@supports (animation-timeline: scroll())` covers
//   `animation-range` too). Keyframes that run on a scroll or view timeline somewhere count as that feature wherever an
//   `animation` names them: outside the guard they'd run with no time.
// - Script (.ts, .svelte): a file that uses a guarded API also tests for it (`'types' in ViewTransition.prototype`…).
// - An escape the lint can't see (a selector set only where a `CSS.supports(…)` is false, say) carries a comment
//   `baseline-ok: <why>` on its line or the line above it (above a rule's selector: the whole rule).
// - `@supports` and `CSS.supports('…')` never test a `var()`: it parses everywhere, so the test is always true.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { ALLOWED_CSS, FLOOR, GUARDED_CSS, GUARDED_JS, newerThanFloor, type GuardedCss } from '../../../../../packages/ui/baseline.ts';

const REPO = path.resolve(import.meta.dirname, '../../../../..');
/** The screens that run on the night's phones and tablets (the stage and Admin run on the team's own laptops). */
const ROOTS = ['apps/player', 'apps/console', 'packages/ui', 'apps/ds'];
const SKIP = new Set(['node_modules', 'dist', 'assets', 'public', 'fixtures', 'tests']);

function files(dir: string, pattern: RegExp, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (SKIP.has(name)) continue;
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) files(full, pattern, out);
    else if (pattern.test(name) && !name.endsWith('.test.ts')) out.push(full);
  }
  return out;
}

const lineAt = (text: string, index: number): number => text.slice(0, index).split('\n').length;
const blank = (s: string): string => s.replace(/[^\n]/g, ' ');

/** The lines a `baseline-ok: <why>` comment covers: its own, and the next one when the comment stands on its own line. */
function okLines(text: string): Set<number> {
  const ok = new Set<number>();
  for (const m of text.matchAll(/\/\*[\s\S]*?\*\/|\/\/[^\n]*|<!--[\s\S]*?-->/g)) {
    if (!/baseline-ok:\s*\S/.test(m[0])) continue;
    const at = m.index ?? 0;
    const end = lineAt(text, at + m[0].length - 1);
    ok.add(end);
    const before = text.slice(text.lastIndexOf('\n', at - 1) + 1, at);
    if (!before.trim()) ok.add(end + 1);
  }
  return ok;
}

/** Splits at the commas outside parentheses. */
function splitTop(value: string): string[] {
  const out: string[] = [];
  let depth = 0;
  let from = 0;
  for (let i = 0; i < value.length; i++) {
    const c = value[i];
    if (c === '(') depth++;
    else if (c === ')') depth--;
    else if (c === ',' && depth === 0) {
      out.push(value.slice(from, i).trim());
      from = i + 1;
    }
  }
  out.push(value.slice(from).trim());
  return out;
}

const ANIMATION_KEYWORDS = new Set(['none', 'auto', 'linear', 'ease', 'ease-in', 'ease-out', 'ease-in-out', 'step-start', 'step-end', 'both', 'forwards', 'backwards', 'infinite', 'alternate', 'alternate-reverse', 'reverse', 'normal', 'running', 'paused']);

/** The keyframes' name in one item of an `animation` list (functions such as var() and steps() dropped). */
function keyframesName(item: string): string | null {
  let rest = item;
  for (let prev = ''; prev !== rest; ) [prev, rest] = [rest, rest.replace(/[\w-]*\([^()]*\)/g, ' ')];
  return rest.split(/\s+/).find((t) => /^-?[a-z_][\w-]*$/i.test(t) && !ANIMATION_KEYWORDS.has(t)) ?? null;
}

/** A positive `@supports` condition: the text with its `not (…)` / `not selector(…)` parts taken out. */
function positive(condition: string): string {
  let text = condition;
  for (let at = text.search(/\bnot\s*(?:selector)?\s*\(/); at >= 0; at = text.search(/\bnot\s*(?:selector)?\s*\(/)) {
    let i = text.indexOf('(', at);
    let depth = 0;
    for (; i < text.length; i++) {
      if (text[i] === '(') depth++;
      else if (text[i] === ')' && --depth === 0) break;
    }
    text = text.slice(0, at) + text.slice(i + 1);
  }
  return text;
}

interface Declaration {
  line: number;
  prop: string;
  value: string;
  /** The rule it's in (one id per block). */
  rule: number;
  /** The positive @supports conditions around it. */
  guards: string[];
  ok: boolean;
}

export interface CssScan {
  problems: string[];
  declarations: Declaration[];
}

const guarded = (feature: GuardedCss, guards: string[]): boolean => guards.some((g) => feature.guard.test(g));

/** One stylesheet's problems ("line: …"), and its declarations for the keyframes pass. */
export function scanCss(source: string, features: readonly GuardedCss[] = GUARDED_CSS): CssScan {
  const ok = okLines(source);
  const css = source.replace(/\/\*[\s\S]*?\*\//g, blank);
  const problems: string[] = [];
  const declarations: Declaration[] = [];
  const stack: { guards: string[]; ok: boolean; rule: number }[] = [{ guards: [], ok: false, rule: 0 }];
  let rules = 0;
  let from = 0;
  let depth = 0;
  let quote: string | null = null;

  const check = (text: string, at: number, frame: (typeof stack)[number]): void => {
    const line = lineAt(css, at);
    if (frame.ok || ok.has(line)) return;
    for (const f of features) {
      if (f.use.test(text) && !guarded(f, frame.guards)) problems.push(`${line}: ${f.name} outside @supports (${text.replace(/\s+/g, ' ').slice(0, 90)})`);
    }
  };
  const piece = (end: number): { text: string; at: number } | null => {
    const raw = css.slice(from, end);
    const text = raw.trim();
    return text ? { text, at: from + raw.indexOf(text[0] as string) } : null;
  };

  for (let i = 0; i < css.length; i++) {
    const c = css[i] as string;
    if (quote) {
      if (c === quote && css[i - 1] !== '\\') quote = null;
      continue;
    }
    if (c === '"' || c === "'") quote = c;
    else if (c === '(') depth++;
    else if (c === ')') depth--;
    else if (depth > 0) continue;
    else if (c === '{') {
      const parent = stack.at(-1)!;
      const p = piece(i);
      const frame = { guards: parent.guards, ok: parent.ok, rule: ++rules };
      if (p) {
        const line = lineAt(css, p.at);
        frame.ok ||= ok.has(line) || ok.has(lineAt(css, i));
        const supports = p.text.match(/^@supports\b([\s\S]*)$/);
        if (supports) {
          const condition = supports[1] as string;
          if (/var\(/.test(condition)) problems.push(`${line}: @supports tests a var(), always true (${p.text.replace(/\s+/g, ' ')})`);
          frame.guards = [...parent.guards, positive(condition)];
        } else check(p.text, p.at, frame);
      }
      stack.push(frame);
      from = i + 1;
    } else if (c === ';' || c === '}') {
      const frame = stack.at(-1)!;
      const p = piece(i);
      if (p) {
        check(p.text, p.at, frame);
        const decl = p.text.match(/^([\w-]+)\s*:([\s\S]*)$/);
        if (decl) {
          const line = lineAt(css, p.at);
          declarations.push({ line, prop: decl[1] as string, value: (decl[2] as string).trim(), rule: frame.rule, guards: frame.guards, ok: frame.ok || ok.has(line) });
        }
      }
      if (c === '}' && stack.length > 1) stack.pop();
      from = i + 1;
    }
  }
  return { problems, declarations };
}

const SCROLL = GUARDED_CSS.find((f) => f.name === 'Scroll-driven animations')!;

/** The keyframes that run on a scroll or view timeline in some rule (an `animation-timeline` item that isn't `auto`). */
export function scrollTimedKeyframes(declarations: readonly Declaration[]): Set<string> {
  const names = new Set<string>();
  const byRule = Map.groupBy(declarations, (d) => d.rule);
  for (const decls of byRule.values()) {
    const timeline = decls.findLast((d) => d.prop === 'animation-timeline');
    if (!timeline) continue;
    const timelines = splitTop(timeline.value);
    const animation = decls.findLast((d) => d.prop === 'animation' || d.prop === 'animation-name');
    if (!animation) continue;
    splitTop(animation.value).forEach((item, i) => {
      const name = keyframesName(item);
      if (name && !/^(?:auto|none)$/.test(timelines[i % timelines.length] ?? 'auto')) names.add(name);
    });
  }
  return names;
}

/** The `animation`s that name scroll-timed keyframes outside a scroll-driven guard. */
export function unguardedScrollKeyframes(declarations: readonly Declaration[], names: ReadonlySet<string>): string[] {
  const found: string[] = [];
  for (const d of declarations) {
    if ((d.prop !== 'animation' && d.prop !== 'animation-name') || d.ok || guarded(SCROLL, d.guards)) continue;
    for (const item of splitTop(d.value)) {
      const name = keyframesName(item);
      if (name && names.has(name)) found.push(`${d.line}: keyframes ${name} run on a scroll timeline, here outside @supports: with no time they jump to their end`);
    }
  }
  return found;
}

/** Inline styles in a component's markup (`style:prop=` and `style="…"`): they can't sit in an @supports. */
export function inlineStyleProblems(markup: string, features: readonly GuardedCss[] = GUARDED_CSS): string[] {
  const ok = okLines(markup);
  const found: string[] = [];
  const text = markup.replace(/<!--[\s\S]*?-->/g, blank);
  for (const m of text.matchAll(/\bstyle:([\w-]+)\s*=|\bstyle="([^"]*)"/g)) {
    const line = lineAt(text, m.index ?? 0);
    if (ok.has(line)) continue;
    const declarations = m[1] ? [`${m[1]}: x`] : (m[2] as string).split(';');
    for (const d of declarations) for (const f of features) if (f.use.test(d.trim())) found.push(`${line}: ${f.name} in an inline style (${d.trim()})`);
  }
  return found;
}

/** A script's problems: a guarded API used in a file that never tests for it; a CSS.supports() of a var(). */
export function scriptProblems(source: string): string[] {
  const ok = okLines(source);
  const code = source
    .replace(/<style[^>]*>[\s\S]*?<\/style>/g, blank)
    .replace(/\/\*[\s\S]*?\*\/|<!--[\s\S]*?-->/g, blank)
    .replace(/(^|[\s;{}()])\/\/[^\n]*/gm, (m, lead: string) => lead + blank(m.slice(lead.length)));
  const lines = code.split('\n');
  const found: string[] = [];
  for (const f of GUARDED_JS) {
    if (f.guard.test(code)) continue;
    lines.forEach((l, i) => {
      if (f.use.test(l) && !ok.has(i + 1)) found.push(`${i + 1}: ${f.name} without a test for it (${f.without})`);
    });
  }
  lines.forEach((l, i) => {
    if (/CSS\.supports\(\s*(['"`])(?:(?!\1).)*var\(/.test(l) && !ok.has(i + 1)) found.push(`${i + 1}: CSS.supports() of a var(), always true`);
  });
  return found;
}

/** A file's CSS: a stylesheet whole, or a component's <style> blocks with everything else blanked (lines kept). */
function cssOf(file: string, text: string): string {
  if (file.endsWith('.css')) return text;
  return text.replace(/^[\s\S]*?<style[^>]*>|<\/style>[\s\S]*?(<style[^>]*>|$)/g, (m) => m.replace(/[^\n]/g, ''));
}

/** A component's markup: the file with its <script> and <style> blocks blanked. */
const markupOf = (text: string): string => text.replace(/<(script|style)[^>]*>[\s\S]*?<\/\1>/g, blank);

test('the CSS lint: a guarded feature only inside a positive @supports that tests it', () => {
  const p = (css: string) => scanCss(css).problems;
  assert.deepEqual(p('@supports (animation-timeline: scroll()) {\n.a { animation-timeline: scroll(); animation-range: 0 10px }\n}'), []);
  assert.match(p('.a {\n  animation-timeline: view();\n}').join(), /^2: Scroll-driven animations outside @supports/);
  assert.equal(p('@supports not (animation-timeline: scroll()) {\n.a { animation-timeline: scroll() }\n}').length, 1);
  assert.deepEqual(p('@layer app {\n@supports (anchor-name: --a) {\n@media (width > 1px) {\n.a { top: anchor(top) }\n}\n}\n}'), []);
  assert.equal(p('@supports (animation-timeline: scroll()) {\n.a { top: anchor(top) }\n}').length, 1);
  assert.equal(p('@container scroll-state(stuck: top) {\n.a { color: red }\n}').length, 1);
  assert.deepEqual(p("@supports ((animation-timeline: view()) and (animation-range: entry)) {\n.a { content: '{'; animation-range: entry }\n}"), []);
  assert.match(p('@supports (top: var(--a)) {\n.a {}\n}').join(), /tests a var\(\)/);
  // The escapes: on the line, or on the line above a declaration or a rule.
  assert.deepEqual(p('.a { top: anchor(top); /* baseline-ok: test */ }'), []);
  assert.deepEqual(p('/* baseline-ok: set only where CSS.supports() is false */\n.a[data-x] {\n  top: anchor(top);\n}'), []);
  assert.equal(p('.a { color: red } /* baseline-ok: test */\n.b { top: anchor(top) }').length, 1);
  // Harmless ones pass anywhere.
  assert.deepEqual(p('.a { text-wrap: pretty; scrollbar-width: none; transition-property: opacity, display, overlay }'), []);
});

test('the CSS lint: keyframes on a scroll timeline count wherever they run', () => {
  const css =
    '@supports (animation-timeline: scroll()) {\n.a { animation: drum linear both, pop 1s both; animation-timeline: scroll(), auto }\n}\n' +
    '.b { animation: pop 1s both }\n.c { animation: drum var(--d) linear both }\n';
  const { declarations } = scanCss(css);
  const names = scrollTimedKeyframes(declarations);
  assert.deepEqual([...names], ['drum']);
  assert.deepEqual(unguardedScrollKeyframes(declarations, names), ['5: keyframes drum run on a scroll timeline, here outside @supports: with no time they jump to their end']);
});

test('the inline-style and script lints', () => {
  assert.equal(inlineStyleProblems('<div style:anchor-name="--a"></div>').length, 1);
  assert.equal(inlineStyleProblems('<div style="color: red; position-anchor: --a"></div>').length, 1);
  assert.deepEqual(inlineStyleProblems('<div style:--tabs-anchor="--a" style="color: red"></div>'), []);
  assert.equal(scriptProblems("document.startViewTransition({ update, types: ['a'] });").length, 1);
  assert.deepEqual(scriptProblems("if ('types' in ViewTransition.prototype) document.startViewTransition({ update, types: ['a'] });"), []);
  assert.deepEqual(scriptProblems('document.startViewTransition(update);\ndocument?.startViewTransition(update);'), []);
  assert.equal(scriptProblems('el.startViewTransition(update);').length, 1);
  assert.deepEqual(scriptProblems('// closedby="any" is Chrome only\n/* el.moveBefore(a, b) */\nconst x = 1;'), []);
  assert.deepEqual(scriptProblems('el.moveBefore(a, b); // baseline-ok: test'), []);
  assert.equal(scriptProblems('<dialog closedby="any"></dialog>').length, 1);
  assert.equal(scriptProblems("CSS.supports('animation-delay: calc(sibling-index() * var(--s))')").length, 1);
});

test(`every listed feature is newer than the floor (Safari ${FLOOR.safari}, Chrome ${FLOOR.chrome}): raising it lists the ones to drop`, () => {
  const supported = [...GUARDED_CSS, ...ALLOWED_CSS, ...GUARDED_JS].filter((f) => !newerThanFloor(f)).map((f) => f.name);
  assert.deepEqual(supported, [], 'the floor supports these now: drop them from packages/ui/baseline.ts (and their guards, if nothing older remains)');
});

test('the screens use nothing newer than the floor outside a guard (packages/ui/baseline.ts)', () => {
  const found: string[] = [];
  const declarations: (Declaration & { file: string })[] = [];
  let sheets = 0;
  let scripts = 0;
  for (const root of ROOTS) {
    for (const file of files(path.join(REPO, root), /\.(css|svelte|html|ts)$/)) {
      const rel = path.relative(REPO, file).split(path.sep).join('/');
      if (rel === 'packages/ui/baseline.ts') continue; // the lint's own data
      const text = readFileSync(file, 'utf8');
      if (!file.endsWith('.ts')) {
        sheets++;
        const scan = scanCss(cssOf(file, text));
        for (const problem of scan.problems) found.push(`${rel}:${problem}`);
        for (const d of scan.declarations) declarations.push({ ...d, file: rel });
      }
      if (!file.endsWith('.css')) {
        scripts++;
        for (const problem of scriptProblems(text)) found.push(`${rel}:${problem}`);
        if (!file.endsWith('.ts')) for (const problem of inlineStyleProblems(markupOf(text))) found.push(`${rel}:${problem}`);
      }
    }
  }
  // The keyframes pass, across files (keyframes are global); rule ids are per file.
  const byFile = Map.groupBy(declarations, (d) => d.file);
  const names = new Set([...byFile.values()].flatMap((decls) => [...scrollTimedKeyframes(decls)]));
  for (const [file, decls] of byFile) for (const problem of unguardedScrollKeyframes(decls, names)) found.push(`${file}:${problem}`);
  assert.ok(sheets > 150 && scripts > 150, `only ${sheets} stylesheets and ${scripts} scripts found`);
  assert.deepEqual(found, [], `newer than the floor (Safari ${FLOOR.safari}, Chrome ${FLOOR.chrome}) outside a guard (packages/ui/baseline.ts):\n${found.join('\n')}`);
});
